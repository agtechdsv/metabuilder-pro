'use server'

import { createClient } from '@/utils/supabase/server'
import { slotAdminDb } from '@/lib/sessions/slotService'
import { dayInBrasilia } from '@/lib/nfse/queue'
import {
  MAX_SUMMARY_ROWS, PAGE_SIZE, dayEndIso, dayStartIso, normalizeFilters, statusClause, summarizeCharges, toChargeDto,
  type ChargesResult,
} from '@/lib/billing/adminCharges'

/** Só o SuperAdmin vê as cobranças de todos os clientes. A identidade vem da sessão, nunca do corpo do pedido. */
async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const db = slotAdminDb()
  if (!user || !db) return null
  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  return profile?.is_super_admin ? { db, userId: user.id } : null
}

const COLS = 'id, user_id, amount, status, cycle, billing_type, invoice_url, created_at, asaas_payment_id, due_date, webhook_received_at'
const NO_ONE = '00000000-0000-0000-0000-000000000000'

/**
 * Uma página de cobranças, já filtrada, com os totais por situação (sobre o mesmo filtro, menos o de situação, para os cartões do topo
 * continuarem mostrando o conjunto inteiro). Só leitura. Os filtros chegam do navegador e são normalizados aqui.
 */
export async function adminChargesAction(input: unknown): Promise<ChargesResult> {
  const ctx = await requireSuperAdmin()
  if (!ctx) return { success: false, code: 'forbidden' }
  const { db } = ctx
  const f = normalizeFilters(input)
  const today = dayInBrasilia(new Date())

  // busca: id do Asaas (pay_...) direto; senão nome ou e-mail do cliente, resolvido antes em ids de usuário
  let searchUsers: string[] | null = null
  if (f.q && !/^pay_/i.test(f.q)) {
    const like = `%${f.q}%`
    const { data: profs } = await db.from('profiles').select('id').or(`email.ilike.${like},full_name.ilike.${like},company_name.ilike.${like}`).limit(100)
    searchUsers = ((profs || []) as any[]).map(p => p.id as string)
    if (!searchUsers.length) searchUsers = [NO_ONE]
  }

  const base = (qb: any) => {
    if (f.userId) qb = qb.eq('user_id', f.userId)
    if (f.method !== 'all') qb = qb.eq('billing_type', f.method)
    if (f.q && /^pay_/i.test(f.q)) qb = qb.ilike('asaas_payment_id', `%${f.q}%`)
    else if (searchUsers) qb = qb.in('user_id', searchUsers)
    if (f.dateField === 'due') {
      if (f.from) qb = qb.gte('due_date', f.from)
      if (f.to) qb = qb.lte('due_date', f.to)
    } else {
      // "por data de pagamento" só faz sentido para cobranças pagas
      qb = qb.eq('status', 'paid')
      if (f.from) qb = qb.gte('webhook_received_at', dayStartIso(f.from))
      if (f.to) qb = qb.lte('webhook_received_at', dayEndIso(f.to))
    }
    return qb
  }

  let pageQ = base(db.from('payments').select(COLS, { count: 'exact' }))
  const clause = statusClause(f.status, today)
  if (clause) pageQ = pageQ.or(clause)
  pageQ = f.status === 'paid' || f.dateField === 'paid'
    ? pageQ.order('webhook_received_at', { ascending: false, nullsFirst: false })
    : f.status === 'upcoming' || f.status === 'overdue'
      ? pageQ.order('due_date', { ascending: true })
      : pageQ.order('created_at', { ascending: false })
  pageQ = pageQ.range(f.page * PAGE_SIZE, f.page * PAGE_SIZE + PAGE_SIZE - 1)

  const sumQ = base(db.from('payments').select('status, due_date, amount')).limit(MAX_SUMMARY_ROWS + 1)

  const [pageRes, sumRes] = await Promise.all([pageQ, sumQ])
  if (pageRes.error || sumRes.error) {
    console.warn('[cobrancas] consulta falhou:', (pageRes.error || sumRes.error)?.message)
    return { success: false, code: 'unknown' }
  }

  const rows = (pageRes.data || []) as any[]
  const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))] as string[]
  const names = new Map<string, { name: string; email: string }>()
  if (ids.length) {
    const { data: profs } = await db.from('profiles').select('id, company_name, full_name, email').in('id', ids)
    for (const p of (profs || []) as any[]) names.set(p.id, { name: p.company_name || p.full_name || '', email: p.email || '' })
  }

  const sumRows = (sumRes.data || []) as any[]
  const truncated = sumRows.length > MAX_SUMMARY_ROWS
  return {
    success: true,
    today,
    items: rows.map(r => toChargeDto(r, r.user_id ? names.get(r.user_id) : undefined, today)),
    total: pageRes.count ?? rows.length,
    page: f.page,
    pageSize: PAGE_SIZE,
    summary: summarizeCharges(truncated ? sumRows.slice(0, MAX_SUMMARY_ROWS) : sumRows, today, truncated),
  }
}
