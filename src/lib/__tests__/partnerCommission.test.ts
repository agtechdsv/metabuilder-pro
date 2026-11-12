import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  commissionAmount, decideTransferValidation, isAvailable, isValidCnpj, isValidCpf, maskEmail, normalizePixKey, releaseDate, resolvePercent,
  summarizeCommissions, validatePixKey, type PayoutItemLike,
} from '../../../supabase/functions/_shared/partnerCommission'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

describe('comissão do parceiro', () => {
  it('o % do parceiro vale; sem ele, o padrão; sempre entre 0 e 100', () => {
    expect(resolvePercent(15, 20)).toBe(15)
    expect(resolvePercent(null, 20)).toBe(20)
    expect(resolvePercent(undefined, 20)).toBe(20)
    expect(resolvePercent(0, 20)).toBe(0) // 0 é um valor válido (parceiro sem comissão), não "vazio"
    expect(resolvePercent(150, 20)).toBe(100)
    expect(resolvePercent(-5, 20)).toBe(0)
  })

  it('o exemplo combinado: R$ 97 líquidos a 20% = R$ 19,40', () => {
    expect(commissionAmount(97, 20)).toBe(19.4)
  })

  it('arredonda para BAIXO no centavo (nunca paga a mais) e ignora valor sem sentido', () => {
    expect(commissionAmount(10.01, 33.33)).toBe(3.33) // 3,336333 -> 3,33
    expect(commissionAmount(0.05, 10)).toBe(0) // meio centavo vira zero
    expect(commissionAmount(0, 20)).toBe(0)
    expect(commissionAmount(-10, 20)).toBe(0)
    expect(commissionAmount(NaN, 20)).toBe(0)
    expect(commissionAmount(100, 250)).toBe(100) // % limitado a 100
  })

  it('a carência soma os dias ao pagamento', () => {
    const d = releaseDate(new Date('2026-11-12T10:00:00Z'), 7)
    expect(d.toISOString()).toBe('2026-11-19T10:00:00.000Z')
    expect(releaseDate(new Date('2026-11-12T10:00:00Z'), 0).toISOString()).toBe('2026-11-12T10:00:00.000Z')
    expect(releaseDate(new Date('2026-11-12T10:00:00Z'), -3).toISOString()).toBe('2026-11-12T10:00:00.000Z')
  })

  const now = new Date('2026-11-20T00:00:00Z')
  const rows = [
    { status: 'pending', amount: 19.4, release_at: '2026-11-19T00:00:00Z' }, // disponível
    { status: 'pending', amount: 10, release_at: '2026-11-25T00:00:00Z' }, // em carência
    { status: 'in_payout', amount: 5, release_at: '2026-11-01T00:00:00Z' },
    { status: 'paid', amount: 100, release_at: '2026-10-01T00:00:00Z' },
    { status: 'revoked', amount: 7, release_at: '2026-11-01T00:00:00Z' },
    { status: 'paid', amount: 4, release_at: '2026-10-01T00:00:00Z', clawback: true, clawback_settled: false }, // estorno depois de pago
  ]

  it('só é disponível a comissão pendente cuja carência venceu', () => {
    expect(isAvailable(rows[0], now)).toBe(true)
    expect(isAvailable(rows[1], now)).toBe(false)
    expect(isAvailable(rows[2], now)).toBe(false)
  })

  it('o resumo separa carência, disponível, em lote, pago, cancelado e estorno a descontar', () => {
    const s = summarizeCommissions(rows, now)
    expect(s).toEqual({ waiting: 10, available: 19.4, inPayout: 5, paid: 104, revoked: 7, clawback: 4, payable: 15.4 })
  })

  it('estorno já descontado em outro lote não desconta de novo, e o saldo nunca fica negativo', () => {
    const settled = summarizeCommissions([{ status: 'paid', amount: 4, release_at: now, clawback: true, clawback_settled: true }], now)
    expect(settled.clawback).toBe(0)
    const negative = summarizeCommissions([{ status: 'paid', amount: 30, release_at: now, clawback: true, clawback_settled: false }, { status: 'pending', amount: 5, release_at: '2026-01-01' }], now)
    expect(negative.payable).toBe(0)
  })
})

describe('privacidade e chave Pix', () => {
  it('o e-mail do cliente aparece mascarado para o parceiro', () => {
    expect(maskEmail('joao@empresa.com')).toBe('j***@empresa.com')
    expect(maskEmail('')).toBe('***')
    expect(maskEmail('sem-arroba')).toBe('***')
  })

  it('valida CPF e CNPJ pelos dígitos verificadores', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('529.982.247-26')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('11.222.333/0001-82')).toBe(false)
    expect(isValidCnpj('00000000000000')).toBe(false)
  })

  it('normaliza a chave como o Asaas espera', () => {
    expect(normalizePixKey('CPF', '529.982.247-25')).toBe('52998224725')
    expect(normalizePixKey('PHONE', '+55 (31) 98483-8184')).toBe('31984838184')
    expect(normalizePixKey('EMAIL', ' Fulano@Empresa.COM ')).toBe('fulano@empresa.com')
  })

  it('recusa chave que não combina com o tipo', () => {
    expect(validatePixKey('CPF', '529.982.247-25')).toEqual({ ok: true, key: '52998224725' })
    expect(validatePixKey('CPF', '123')).toEqual({ ok: false, reason: 'invalid_cpf' })
    expect(validatePixKey('PHONE', '3198483818')).toEqual({ ok: false, reason: 'invalid_phone' })
    expect(validatePixKey('EMAIL', 'nao-e-email')).toEqual({ ok: false, reason: 'invalid_email' })
    expect(validatePixKey('EVP', 'abc')).toEqual({ ok: false, reason: 'invalid_evp' })
    expect(validatePixKey('EVP', '123e4567-e89b-12d3-a456-426614174000').ok).toBe(true)
  })
})

describe('validação de saque do Asaas (só aprova o que o nosso lote criou)', () => {
  const item = (over: Partial<PayoutItemLike> = {}): PayoutItemLike => ({ id: 'i1', status: 'sent', amount: 120.5, pix_key: '52998224725', pix_key_type: 'CPF', asaas_transfer_id: 'tr_1', ...over })
  const payload = (over: any = {}) => ({ type: 'TRANSFER', transfer: { id: 'tr_1', value: 120.5, bankAccount: { pixAddressKey: '529.982.247-25' }, ...(over.transfer || {}) }, ...(over.type ? { type: over.type } : {}) })

  it('aprova a transferência do lote (id, valor e chave conferem)', () => {
    expect(decideTransferValidation(payload(), [item()])).toEqual({ status: 'APPROVED', itemId: 'i1' })
  })

  it('aprova antes de gravarmos o id da transferência, se houver UM item em envio igual', () => {
    const it = item({ status: 'sending', asaas_transfer_id: null })
    expect(decideTransferValidation(payload(), [it])).toEqual({ status: 'APPROVED', itemId: 'i1' })
    // dois itens iguais em envio: ambíguo, recusa
    expect(decideTransferValidation(payload(), [it, { ...it, id: 'i2' }]).status).toBe('REFUSED')
  })

  it('recusa qualquer operação que não seja transferência do lote', () => {
    for (const type of ['BILL', 'PIX_QR_CODE', 'MOBILE_PHONE_RECHARGE', 'PIX_REFUND', 'PAYMENT_SPLIT', undefined]) {
      expect(decideTransferValidation({ type, transfer: { id: 'tr_1', value: 120.5 } } as any, [item()]).status, String(type)).toBe('REFUSED')
    }
  })

  it('recusa valor diferente, chave diferente, transferência desconhecida e item que não está em envio', () => {
    expect(decideTransferValidation(payload({ transfer: { value: 999 } }), [item()]).status).toBe('REFUSED')
    expect(decideTransferValidation(payload({ transfer: { bankAccount: { pixAddressKey: '111.444.777-35' } } }), [item()]).status).toBe('REFUSED')
    expect(decideTransferValidation(payload({ transfer: { id: 'tr_outra' } }), [item()]).status).toBe('REFUSED')
    expect(decideTransferValidation(payload(), [item({ status: 'done' })]).status).toBe('REFUSED')
    expect(decideTransferValidation(payload(), [item({ status: 'failed' })]).status).toBe('REFUSED')
    expect(decideTransferValidation(payload({ transfer: { value: 0 } }), [item()]).status).toBe('REFUSED')
    expect(decideTransferValidation(null as any, [item()]).status).toBe('REFUSED')
  })
})

describe('SQL do programa de parceiros (scripts/parceiros.sql)', () => {
  const sql = read('scripts/parceiros.sql')

  it('cada bloco $$ abre e fecha (um $ sozinho quebra o script)', () => {
    const n = (sql.match(/\$\$/g) || []).length
    expect(n % 2).toBe(0)
    expect(n).toBe((sql.match(/create or replace function/g) || []).length * 2)
    expect(sql).not.toMatch(/ as \$(?!\$)/)
  })

  it('todas as tabelas têm RLS ligada, sem policy e sem acesso para anon/authenticated', () => {
    for (const t of ['partners', 'partner_referrals', 'partner_commissions', 'partner_payouts', 'partner_payout_items']) {
      expect(sql, t).toContain(`create table if not exists public.${t}`)
      expect(sql, t).toContain(`alter table public.${t}`)
    }
    expect(sql).toContain('revoke all on public.partners, public.partner_referrals, public.partner_commissions, public.partner_payouts, public.partner_payout_items from anon, authenticated')
    expect(sql).not.toMatch(/create policy/)
  })

  it('as funções de dinheiro só rodam para o servidor (service_role), nunca para anon nem authenticated', () => {
    for (const fn of ['mb_partner_create_payout(uuid[], uuid, text)', 'mb_partner_refresh_payout(uuid)', 'mb_partner_finish_item(uuid, text)', 'mb_partner_fail_item(uuid, text)']) {
      expect(sql, fn).toContain(`revoke all on function public.${fn} from public, anon, authenticated`)
      expect(sql, fn).toContain(`grant execute on function public.${fn} to service_role`)
    }
    expect(sql).not.toMatch(/grant execute[^;]*\bto\b[^;]*\b(anon|authenticated|public)\b/)
  })

  it('a comissão é única por pagamento do Asaas (o Asaas repete eventos) e o item de lote tem transferência única', () => {
    expect(sql).toContain('create unique index if not exists partner_commissions_payment_uidx on public.partner_commissions (asaas_payment_id)')
    expect(sql).toContain('partner_payout_items_transfer_uidx')
    expect(sql).toContain('partner_referrals_email_uidx') // um e-mail só tem um parceiro
  })

  it('o lote é atômico: trava as comissões, respeita mínimo, chave Pix e teto, e descarta tudo se passar do teto', () => {
    const i = sql.indexOf('create or replace function public.mb_partner_create_payout')
    const body = sql.slice(i, sql.indexOf('create or replace function public.mb_partner_refresh_payout'))
    for (const s of ['for update', "'below_minimum'", "'no_pix_key'", "'suspended'", 'payout_cap_exceeded', 'nothing_to_pay', 'clawback_item_id']) expect(body, s).toContain(s)
  })

  it('o ajuste global tem padrão para os quatro valores', () => {
    for (const k of ['partner_default_percent', 'partner_grace_days', 'partner_min_payout', 'partner_payout_cap']) expect(sql, k).toContain(`'${k}'`)
  })
})

describe('integração com o pagamento do Asaas e com as telas', () => {
  it('o webhook gera a comissão, revoga no estorno, cancela a indicação e aplica os eventos de transferência', () => {
    const w = read('supabase/functions/asaas-webhook/index.ts')
    for (const s of ['recordPartnerCommission(', 'revokePartnerCommissionForPayment(', 'cancelPartnerReferral(', 'applyTransferEvent(', 'startsWith("TRANSFER_")']) expect(w, s).toContain(s)
    // erro nas comissões nunca derruba a ativação da assinatura
    expect(w).toMatch(/try \{\s*await recordPartnerCommission[\s\S]*?\} catch/)
  })

  it('a função de pagamento só aceita a chave de serviço e a de validação falha de forma segura', () => {
    const pay = read('supabase/functions/partner-payout/index.ts')
    expect(pay).toContain('bearer !== serviceKey')
    expect(pay).toContain('.eq("status", "pending")') // cada item sai uma vez
    expect(pay).toContain('externalReference: it.id')
    const val = read('supabase/functions/partner-transfer-validation/index.ts')
    expect(val).toContain('ASAAS_TRANSFER_VALIDATION_TOKEN')
    expect(val).toMatch(/catch[\s\S]*REFUSED/) // qualquer erro recusa
  })

  it('as ações do SuperAdmin conferem a sessão e o painel do parceiro usa o usuário da sessão', () => {
    const a = read('src/app/actions/partners.ts')
    expect(a).toContain('async function requireSuperAdmin')
    for (const fn of ['getPartnerSettings', 'savePartnerSettings', 'listPartners', 'savePartner', 'createPartnerPayout', 'listPartnerPayouts', 'releaseStuckPayoutItem']) {
      const i = a.indexOf(`export async function ${fn}`)
      expect(i, fn).toBeGreaterThan(0)
      expect(a.slice(i, i + 600), fn).toContain('requireSuperAdmin()')
    }
    const j = a.indexOf('export async function getMyPartnerDashboard')
    expect(a.slice(j)).toContain("eq('user_id', user.id)")
  })

  it('o código de indicação de parceiro é tratado antes do iClub, e a tela do SuperAdmin está na aba de planos', () => {
    expect(read('src/app/actions/iclub.ts')).toContain('registerPartnerReferral(')
    expect(read('src/components/admin/PlatformAdminClient.tsx')).toContain('<PartnersAdmin />')
  })
})
