'use server'

import { createClient } from '@/utils/supabase/server'
import { slotAdminDb } from '@/lib/sessions/slotService'
import { cleanAddress } from '@/lib/email/routing'
import { sendNfseEmail } from '@/lib/security/securityMail'
import { nfseCustomerMail } from '@/lib/nfse/nfseMail'
import {
  availableNfseModes, checkPdfBase64, dayInBrasilia, dueState, effectiveIssuer, isNfseStatus, parseNfseMode, parseWaitDays, safePdfName,
  type NfseStatus,
} from '@/lib/nfse/queue'
import type { NfseErrorCode, NfseItemDto, NfseOverview, NfseResult } from '@/lib/nfse/types'

const fail = (code: NfseErrorCode): { success: false; code: NfseErrorCode } => ({ success: false, code })

/** Só o SuperAdmin mexe nas notas fiscais. A identidade vem da sessão, nunca do corpo do pedido. */
async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const db = slotAdminDb()
  if (!user || !db) return null
  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  return profile?.is_super_admin ? { db, userId: user.id } : null
}

const COLS = 'id, user_id, amount, paid_at, emit_on, status, customer_name, customer_doc, customer_email, nfse_number, issued_at, customer_emailed_at, refunded, note'

async function loadSettings(db: NonNullable<ReturnType<typeof slotAdminDb>>) {
  const { data } = await db.from('platform_settings').select('key, value').in('key', ['nfse_mode', 'nfse_wait_days'])
  const by = new Map((data || []).map((r: any) => [r.key as string, r.value]))
  return { mode: parseNfseMode(by.get('nfse_mode')), waitDays: parseWaitDays(by.get('nfse_wait_days')) }
}

export async function nfseOverviewAction(): Promise<NfseResult<{ overview: NfseOverview }>> {
  const ctx = await requireSuperAdmin()
  if (!ctx) return fail('forbidden')
  const { db } = ctx
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString()

  const [settings, pendingRes, doneRes] = await Promise.all([
    loadSettings(db),
    db.from('mb_nfse_queue').select(COLS).eq('status', 'pending').order('emit_on', { ascending: true }).limit(500),
    db.from('mb_nfse_queue').select(COLS).neq('status', 'pending').gte('updated_at', since).order('updated_at', { ascending: false }).limit(300),
  ])
  // tabela ainda não criada (scripts/nfse-fila.sql não rodou): devolve a tela vazia em vez de quebrar
  if (pendingRes.error || doneRes.error) {
    const msg = (pendingRes.error || doneRes.error)?.message || ''
    console.warn('[nfse] fila indisponível:', msg)
    return fail('unknown')
  }
  const rows = [...(pendingRes.data || []), ...(doneRes.data || [])] as any[]

  const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))] as string[]
  const live = new Map<string, { name: string; doc: string; email: string }>()
  if (ids.length) {
    const { data: profs } = await db.from('profiles').select('id, company_name, full_name, cnpj, email').in('id', ids)
    for (const p of (profs || []) as any[]) live.set(p.id, { name: p.company_name || p.full_name || '', doc: p.cnpj || '', email: p.email || '' })
  }

  const today = dayInBrasilia(new Date())
  const items: NfseItemDto[] = rows.map(r => {
    const l = r.user_id ? live.get(r.user_id) : undefined
    const paidOn = dayInBrasilia(r.paid_at)
    const emitOn = String(r.emit_on).slice(0, 10)
    return {
      id: r.id,
      userId: r.user_id ?? null,
      amount: Number(r.amount),
      paidOn,
      emitOn,
      status: isNfseStatus(r.status) ? r.status : 'pending',
      name: l?.name || r.customer_name || '',
      doc: l?.doc || r.customer_doc || '',
      email: l?.email || r.customer_email || '',
      nfseNumber: r.nfse_number ?? null,
      issuedAt: r.issued_at ?? null,
      emailedAt: r.customer_emailed_at ?? null,
      refunded: !!r.refunded,
      note: r.note ?? null,
      issuer: effectiveIssuer(settings.mode, paidOn, emitOn),
      due: dueState(emitOn, today),
    }
  })
  return { success: true, overview: { ...settings, autoAvailable: availableNfseModes().length > 1, today, items } }
}

export async function nfseSaveSettingsAction(input: { mode: string; waitDays: number }): Promise<NfseResult> {
  const ctx = await requireSuperAdmin()
  if (!ctx) return fail('forbidden')
  const mode = parseNfseMode(input?.mode)
  if (input?.mode !== mode) return fail('invalid_input')
  if (!availableNfseModes().includes(mode)) return fail('mode_unavailable')
  const waitDays = parseWaitDays(input?.waitDays)
  const now = new Date().toISOString()
  const { error } = await ctx.db.from('platform_settings').upsert([
    { key: 'nfse_mode', value: { mode }, updated_at: now, updated_by: ctx.userId },
    { key: 'nfse_wait_days', value: { days: waitDays }, updated_at: now, updated_by: ctx.userId },
  ], { onConflict: 'key' })
  return error ? fail('unknown') : { success: true }
}

export interface NfseIssueInput {
  id: string
  number?: string
  /** true = envia o PDF ao cliente por e-mail antes de marcar como emitida */
  send: boolean
  email?: string
  pdfBase64?: string
  pdfName?: string
}

/** Marca a nota como emitida (e, se pedido, envia o PDF ao cliente). Se o e-mail falhar, NADA é marcado: dá para tentar de novo. */
export async function nfseIssueAction(input: NfseIssueInput): Promise<NfseResult<{ emailed: boolean }>> {
  const ctx = await requireSuperAdmin()
  if (!ctx) return fail('forbidden')
  const { db } = ctx
  if (typeof input?.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.id)) return fail('invalid_input')

  const { data: row } = await db.from('mb_nfse_queue').select(COLS).eq('id', input.id).maybeSingle()
  if (!row) return fail('not_found')
  if (row.status !== 'pending') return fail('already_done')

  const number = String(input.number ?? '').trim().slice(0, 40) || null
  const issuedOn = dayInBrasilia(new Date())
  let emailed = false

  if (input.send) {
    const pdf = checkPdfBase64(input.pdfBase64)
    if (!pdf.ok) return fail(pdf.code === 'empty' ? 'pdf_empty' : pdf.code === 'too_big' ? 'pdf_too_big' : 'pdf_invalid')
    let to = cleanAddress(input.email)
    if (!to) {
      const { data: p } = row.user_id ? await db.from('profiles').select('email').eq('id', row.user_id).maybeSingle() : { data: null }
      to = cleanAddress(p?.email || row.customer_email)
    }
    if (!to) return fail('email_invalid')
    const sent = await sendNfseEmail(
      to,
      nfseCustomerMail({ customerName: row.customer_name, amount: Number(row.amount), number, issuedOn }),
      { filename: safePdfName(input.pdfName, number ? `NFS-e-${number}.pdf` : 'NFS-e.pdf'), content: pdf.bytes },
    )
    if (!sent) return fail('mail_failed')
    emailed = true
  }

  const now = new Date().toISOString()
  const { data: upd, error } = await db.from('mb_nfse_queue')
    .update({ status: 'issued', nfse_number: number, issued_at: now, customer_emailed_at: emailed ? now : null, updated_at: now })
    .eq('id', input.id).eq('status', 'pending').select('id')
  if (error || !upd?.length) return fail(error ? 'unknown' : 'already_done')
  return { success: true, emailed }
}

/** Dispensar (pendente -> cancelada, com motivo) ou reabrir (emitida/cancelada -> pendente). */
export async function nfseSetStatusAction(id: string, to: Extract<NfseStatus, 'pending' | 'canceled'>, note?: string): Promise<NfseResult> {
  const ctx = await requireSuperAdmin()
  if (!ctx) return fail('forbidden')
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || (to !== 'pending' && to !== 'canceled')) return fail('invalid_input')
  const now = new Date().toISOString()
  const patch = to === 'canceled'
    ? { status: 'canceled', note: String(note ?? '').trim().slice(0, 300) || null, updated_at: now }
    : { status: 'pending', issued_at: null, nfse_number: null, customer_emailed_at: null, refunded: false, note: null, updated_at: now }
  const { data, error } = await ctx.db.from('mb_nfse_queue').update(patch).eq('id', id).neq('status', to).select('id')
  if (error) return fail('unknown')
  return data?.length ? { success: true } : fail('not_found')
}
