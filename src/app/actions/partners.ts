'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  isPixKeyType, isValidCnpj, isValidCpf, maskEmail, resolvePercent, summarizeCommissions, validatePixKey,
} from '../../../supabase/functions/_shared/partnerCommission'
import {
  DEFAULT_PARTNER_SETTINGS, type PartnerDashboard, type PartnerErrorCode, type PartnerInput, type PartnerRow, type PartnerSettings, type PayoutRow,
} from '@/lib/partners'

type Ok<T = unknown> = { success: true } & T
type Fail = { success: false; code: PartnerErrorCode; error?: string }

// ---------------------------------------------------------------------------------------------------------------------------------
// quem está agindo: sempre vem da SESSÃO, nunca do que a tela mandou
// ---------------------------------------------------------------------------------------------------------------------------------

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('not_authorized')
  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  if (!profile?.is_super_admin) throw new Error('not_authorized')
  return { admin: createAdminClient(), user }
}

const fail = (code: PartnerErrorCode, error?: string): Fail => ({ success: false, code, error })
const codeOf = (e: unknown): PartnerErrorCode => {
  const msg = String((e as { message?: string } | null)?.message || '')
  for (const c of ['not_authorized', 'nothing_to_pay', 'payout_cap_exceeded', 'no_partners'] as const) if (msg.includes(c)) return c
  return 'unknown'
}

// ---------------------------------------------------------------------------------------------------------------------------------
// ajustes globais (só o SuperAdmin)
// ---------------------------------------------------------------------------------------------------------------------------------

const SETTING_KEYS = {
  defaultPercent: ['partner_default_percent', 'percent'],
  graceDays: ['partner_grace_days', 'days'],
  minPayout: ['partner_min_payout', 'amount'],
  payoutCap: ['partner_payout_cap', 'amount'],
} as const

async function readSettings(admin: ReturnType<typeof createAdminClient>): Promise<PartnerSettings> {
  const { data } = await admin.from('platform_settings').select('key, value').in('key', Object.values(SETTING_KEYS).map(v => v[0]))
  const byKey = new Map((data || []).map((r: any) => [r.key as string, r.value as Record<string, unknown>]))
  const out = { ...DEFAULT_PARTNER_SETTINGS }
  for (const [k, [key, field]] of Object.entries(SETTING_KEYS) as [keyof PartnerSettings, readonly [string, string]][]) {
    const v = Number(byKey.get(key)?.[field])
    if (Number.isFinite(v)) out[k] = v
  }
  return out
}

export async function getPartnerSettings(): Promise<Ok<{ settings: PartnerSettings }> | Fail> {
  try {
    const { admin } = await requireSuperAdmin()
    return { success: true, settings: await readSettings(admin) }
  } catch (e) { return fail(codeOf(e)) }
}

export async function savePartnerSettings(input: PartnerSettings): Promise<Ok | Fail> {
  try {
    const { admin, user } = await requireSuperAdmin()
    const ok = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max
    if (!ok(input.defaultPercent, 0, 100) || !ok(input.graceDays, 0, 90) || !ok(input.minPayout, 1, 100000) || !ok(input.payoutCap, 1, 1000000)) return fail('percent_invalid')
    const rows = (Object.entries(SETTING_KEYS) as [keyof PartnerSettings, readonly [string, string]][]).map(([k, [key, field]]) => ({
      key,
      value: { [field]: k === 'graceDays' ? Math.floor(input[k]) : Math.round(input[k] * 100) / 100 },
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }))
    const { error } = await admin.from('platform_settings').upsert(rows, { onConflict: 'key' })
    if (error) return fail('unknown', error.message)
    revalidatePath('/admin/platform')
    return { success: true }
  } catch (e) { return fail(codeOf(e)) }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// parceiros (SuperAdmin)
// ---------------------------------------------------------------------------------------------------------------------------------

export async function listPartners(): Promise<Ok<{ partners: PartnerRow[] }> | Fail> {
  try {
    const { admin } = await requireSuperAdmin()
    const [{ data: partners }, { data: referrals }, { data: commissions }] = await Promise.all([
      admin.from('partners').select('*').order('created_at', { ascending: false }),
      admin.from('partner_referrals').select('partner_id, status'),
      admin.from('partner_commissions').select('partner_id, status, amount, release_at, clawback, clawback_settled'),
    ])
    const userIds = (partners || []).map((p: any) => p.user_id)
    const { data: profiles } = userIds.length ? await admin.from('profiles').select('id, email').in('id', userIds) : { data: [] as any[] }
    const emailOf = new Map((profiles || []).map((p: any) => [p.id as string, (p.email || '') as string]))

    const rows: PartnerRow[] = (partners || []).map((p: any) => {
      const refs = (referrals || []).filter((r: any) => r.partner_id === p.id)
      return {
        id: p.id,
        userId: p.user_id,
        userEmail: emailOf.get(p.user_id) || '',
        name: p.name,
        document: p.document,
        pixKey: p.pix_key,
        pixKeyType: p.pix_key_type,
        code: p.code,
        commissionPercent: p.commission_percent != null ? Number(p.commission_percent) : null,
        status: p.status,
        notes: p.notes,
        referrals: refs.length,
        subscribed: refs.filter((r: any) => r.status === 'subscribed').length,
        summary: summarizeCommissions((commissions || []).filter((c: any) => c.partner_id === p.id)),
      }
    })
    return { success: true, partners: rows }
  } catch (e) { return fail(codeOf(e)) }
}

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,31}$/

export async function savePartner(input: PartnerInput): Promise<Ok<{ id: string }> | Fail> {
  try {
    const { admin } = await requireSuperAdmin()

    const code = (input.code || '').trim().toUpperCase()
    if (!CODE_RE.test(code)) return fail('code_invalid')
    const name = (input.name || '').trim()
    if (!name) return fail('unknown', 'Informe o nome do parceiro.')

    let percent: number | null = null
    if (input.commissionPercent !== null && input.commissionPercent !== undefined && String(input.commissionPercent) !== '') {
      percent = Number(input.commissionPercent)
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) return fail('percent_invalid')
    }

    const doc = (input.document || '').replace(/\D/g, '')
    if (doc && !isValidCpf(doc) && !isValidCnpj(doc)) return fail('document_invalid')

    // chave Pix: opcional no cadastro, mas só entra em lote quem tem uma válida
    let pixKey: string | null = null
    let pixKeyType: string | null = null
    if ((input.pixKey || '').trim()) {
      if (!isPixKeyType(input.pixKeyType)) return fail('pix_invalid')
      const v = validatePixKey(input.pixKeyType, input.pixKey)
      if (!v.ok) return fail('pix_invalid')
      pixKey = v.key
      pixKeyType = input.pixKeyType
    }

    // o código não pode repetir o de outro parceiro nem o código de indicação (iClub) de ninguém
    const { data: sameCode } = await admin.from('partners').select('id').ilike('code', code).maybeSingle()
    if (sameCode && sameCode.id !== input.id) return fail('code_in_use')
    const { data: iclubCode } = await admin.from('profiles').select('id').ilike('referral_code', code).limit(1).maybeSingle()
    if (iclubCode) return fail('code_in_use')

    const base = {
      name,
      document: doc || null,
      pix_key: pixKey,
      pix_key_type: pixKeyType,
      code,
      commission_percent: percent,
      status: input.status === 'suspended' ? 'suspended' : 'active',
      notes: (input.notes || '').trim() || null,
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      const { error } = await admin.from('partners').update(base).eq('id', input.id)
      if (error) return fail('unknown', error.message)
      revalidatePath('/admin/platform')
      return { success: true, id: input.id }
    }

    const email = (input.userEmail || '').trim().toLowerCase()
    const { data: profile } = email ? await admin.from('profiles').select('id').ilike('email', email).maybeSingle() : { data: null }
    if (!profile) return fail('user_not_found')
    const { data: existing } = await admin.from('partners').select('id').eq('user_id', profile.id).maybeSingle()
    if (existing) return fail('already_partner')

    const { data: created, error } = await admin.from('partners').insert({ ...base, user_id: profile.id }).select('id').single()
    if (error) return fail('unknown', error.message)
    revalidatePath('/admin/platform')
    return { success: true, id: created.id }
  } catch (e) { return fail(codeOf(e)) }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// lotes de pagamento (SuperAdmin)
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * Monta o lote dos parceiros escolhidos (SQL atômico: soma o disponível, desconta estornos, confere mínimo, chave Pix e teto) e só então manda a
 * Edge Function enviar os Pix. O SuperAdmin confirmou na tela; a chave do Asaas nunca passa por aqui.
 */
export async function createPartnerPayout(
  partnerIds: string[],
  note?: string
): Promise<Ok<{ payoutId: string; total: number; sent: number; failed: number; skipped: { name: string; reason: string }[] }> | Fail> {
  try {
    const { admin, user } = await requireSuperAdmin()
    const ids = Array.from(new Set((partnerIds || []).filter(x => typeof x === 'string' && x)))
    if (ids.length === 0) return fail('no_partners')

    const { data, error } = await admin.rpc('mb_partner_create_payout', { p_partner_ids: ids, p_created_by: user.id, p_note: (note || '').trim() || null })
    if (error) return fail(codeOf(error), error.message)
    const payout = data as { payout_id: string; total: number; skipped: { name: string; reason: string }[] }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return fail('unknown', 'Credenciais do Supabase ausentes no servidor.')
    const res = await fetch(`${url}/functions/v1/partner-payout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ payout_id: payout.payout_id }),
    })
    const body = (await res.json().catch(() => ({}))) as { results?: { ok: boolean }[]; error?: string }
    revalidatePath('/admin/platform')
    if (!res.ok) return fail('unknown', body?.error || `A função de pagamento respondeu ${res.status}. O lote foi criado: veja o estado dos itens.`)
    const results = body.results || []
    return {
      success: true,
      payoutId: payout.payout_id,
      total: Number(payout.total),
      sent: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      skipped: payout.skipped || [],
    }
  } catch (e) { return fail(codeOf(e)) }
}

export async function listPartnerPayouts(): Promise<Ok<{ payouts: PayoutRow[] }> | Fail> {
  try {
    const { admin } = await requireSuperAdmin()
    const { data: payouts } = await admin.from('partner_payouts').select('*').order('created_at', { ascending: false }).limit(30)
    const ids = (payouts || []).map((p: any) => p.id)
    const { data: items } = ids.length ? await admin.from('partner_payout_items').select('*').in('payout_id', ids) : { data: [] as any[] }
    const partnerIds = Array.from(new Set((items || []).map((i: any) => i.partner_id)))
    const { data: partners } = partnerIds.length ? await admin.from('partners').select('id, name').in('id', partnerIds) : { data: [] as any[] }
    const nameOf = new Map((partners || []).map((p: any) => [p.id as string, p.name as string]))
    const rows: PayoutRow[] = (payouts || []).map((p: any) => ({
      id: p.id,
      status: p.status,
      total: Number(p.total),
      note: p.note,
      createdAt: p.created_at,
      items: (items || []).filter((i: any) => i.payout_id === p.id).map((i: any) => ({
        id: i.id,
        partnerId: i.partner_id,
        partnerName: nameOf.get(i.partner_id) || '',
        amount: Number(i.amount),
        pixKey: i.pix_key,
        pixKeyType: i.pix_key_type,
        status: i.status,
        failReason: i.fail_reason,
        receiptUrl: i.receipt_url,
        asaasTransferId: i.asaas_transfer_id,
      })),
    }))
    return { success: true, payouts: rows }
  } catch (e) { return fail(codeOf(e)) }
}

/**
 * Item preso em "enviando" (sem id de transferência: a chamada ao Asaas não respondeu). Depois de conferir no painel do Asaas que NÃO existe a
 * transferência, o SuperAdmin libera: o item falha e as comissões voltam a ficar disponíveis. Item que já tem id de transferência não pode ser liberado.
 */
export async function releaseStuckPayoutItem(itemId: string): Promise<Ok | Fail> {
  try {
    const { admin } = await requireSuperAdmin()
    const { data: item } = await admin.from('partner_payout_items').select('id, status, asaas_transfer_id').eq('id', itemId).maybeSingle()
    if (!item) return fail('not_found')
    if (item.status !== 'sending' || item.asaas_transfer_id) return fail('unknown', 'Só dá para liberar um item "enviando" que não tem transferência no Asaas.')
    const { error } = await admin.rpc('mb_partner_fail_item', { p_item_id: itemId, p_reason: 'Liberado manualmente (sem transferência no Asaas)' })
    if (error) return fail('unknown', error.message)
    revalidatePath('/admin/platform')
    return { success: true }
  } catch (e) { return fail(codeOf(e)) }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// painel do próprio parceiro (quem é o parceiro vem da sessão)
// ---------------------------------------------------------------------------------------------------------------------------------

export async function getMyPartnerDashboard(): Promise<Ok<{ dashboard: PartnerDashboard }> | Fail> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fail('not_authorized')
    const admin = createAdminClient()

    const settings = await readSettings(admin)
    const empty: PartnerDashboard = {
      partner: null,
      settings: { graceDays: settings.graceDays, minPayout: settings.minPayout },
      summary: summarizeCommissions([]),
      referrals: [],
      commissions: [],
      payouts: [],
    }

    const { data: partner } = await admin.from('partners').select('*').eq('user_id', user.id).maybeSingle()
    if (!partner) return { success: true, dashboard: empty }

    const [{ data: referrals }, { data: commissions }, { data: items }] = await Promise.all([
      admin.from('partner_referrals').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false }),
      admin.from('partner_commissions').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false }).limit(500),
      admin.from('partner_payout_items').select('id, amount, status, created_at, receipt_url').eq('partner_id', partner.id).order('created_at', { ascending: false }).limit(100),
    ])
    const emailOf = new Map((referrals || []).map((r: any) => [r.id as string, maskEmail(r.referred_email)]))

    return {
      success: true,
      dashboard: {
        partner: {
          name: partner.name,
          code: partner.code,
          status: partner.status,
          percent: resolvePercent(partner.commission_percent != null ? Number(partner.commission_percent) : null, settings.defaultPercent),
          hasPixKey: !!partner.pix_key,
          pixKeyType: partner.pix_key_type,
          // a chave aparece mascarada: só os 3 últimos caracteres (quem muda a chave é o SuperAdmin)
          pixKeyMasked: partner.pix_key ? `${'•'.repeat(Math.max(3, String(partner.pix_key).length - 3))}${String(partner.pix_key).slice(-3)}` : null,
        },
        settings: { graceDays: settings.graceDays, minPayout: settings.minPayout },
        summary: summarizeCommissions(commissions || []),
        referrals: (referrals || []).map((r: any) => ({ id: r.id, email: maskEmail(r.referred_email), status: r.status, createdAt: r.created_at, paidAt: r.paid_at, canceledAt: r.canceled_at })),
        commissions: (commissions || []).map((c: any) => ({
          id: c.id,
          referredEmail: emailOf.get(c.referral_id) || '***',
          gross: Number(c.gross),
          net: Number(c.net),
          percent: Number(c.percent),
          amount: Number(c.amount),
          status: c.status,
          releaseAt: c.release_at,
          createdAt: c.created_at,
          revokedReason: c.revoked_reason,
          clawback: !!c.clawback,
        })),
        payouts: (items || []).map((i: any) => ({ id: i.id, amount: Number(i.amount), status: i.status, createdAt: i.created_at, receiptUrl: i.receipt_url })),
      },
    }
  } catch (e) { return fail(codeOf(e)) }
}
