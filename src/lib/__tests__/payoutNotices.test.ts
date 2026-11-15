import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isPayoutKind, payoutIsFinal, PAYOUT_KINDS } from '../../../supabase/functions/_shared/billingCore'
import { adminPayoutSummaryMail, partnerPayoutPaidMail } from '../billing/payoutMailText'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

describe('avisos de repasse a parceiros', () => {
  it('lote só termina quando todos os itens estão pagos ou com falha', () => {
    expect(payoutIsFinal([])).toBe(false)
    expect(payoutIsFinal(['done'])).toBe(true)
    expect(payoutIsFinal(['done', 'failed'])).toBe(true)
    expect(payoutIsFinal(['done', 'sent'])).toBe(false)
    expect(payoutIsFinal(['sending'])).toBe(false)
    expect(payoutIsFinal(['pending', 'failed'])).toBe(false)
  })

  it('reconhece os tipos de aviso de repasse e nenhum outro', () => {
    for (const k of PAYOUT_KINDS) expect(isPayoutKind(k)).toBe(true)
    expect(isPayoutKind('payment_received')).toBe(false)
    expect(isPayoutKind('admin_digest')).toBe(false)
  })

  it('e-mail ao parceiro: valor, chave mascarada e data, nos 3 idiomas, com o nome escapado', () => {
    const d = { name: 'Ana <b>Souza</b>', amount: 0.75, paidAt: '2026-11-15T03:30:00Z', type: 'CNPJ', keyMasked: '•••101', panelUrl: 'https://x.com/parceiro' }
    const pt = partnerPayoutPaidMail('pt', d)
    expect(pt.subject).toContain('R$')
    expect(pt.subject).toContain('0,75')
    expect(pt.text).toContain('CNPJ: •••101')
    expect(pt.text).toContain('15/11/2026')
    expect(pt.html).toContain('Ana &lt;b&gt;Souza&lt;/b&gt;')
    expect(pt.html).not.toContain('<b>Souza</b>')
    expect(pt.html).toContain('https://x.com/parceiro')
    expect(partnerPayoutPaidMail('en', d).subject).toMatch(/paid/)
    expect(partnerPayoutPaidMail('es', d).subject).toMatch(/pagada/)
    // o e-mail do parceiro nunca leva o comprovante nem a chave inteira
    expect(pt.text).not.toMatch(/comprovante|receipt/i)
  })

  it('resumo ao admin: uma linha por parceiro com valor, situação e data; falhas aparecem com o motivo e os totais', () => {
    const base = { createdAt: '2026-11-15T03:00:00Z', note: 'Novembro <1>', appUrl: 'https://x.com' }
    const ok = adminPayoutSummaryMail({ ...base, items: [{ partner: 'Ana', amount: 0.75, status: 'done', at: '2026-11-15T03:30:00Z', type: 'CPF', keyMasked: '•••605' }] })
    expect(ok.subject).toBe('Repasse de parceiros concluído: R$ 0,75')
    expect(ok.text).toContain('Ana: R$ 0,75 · Pago · 15/11/2026')
    expect(ok.text).toContain('Total pago: R$ 0,75')
    expect(ok.html).toContain('Novembro &lt;1&gt;')

    const mixed = adminPayoutSummaryMail({ ...base, items: [
      { partner: 'Ana', amount: 10, status: 'done', at: '2026-11-15T03:30:00Z' },
      { partner: 'Beto', amount: 5, status: 'failed', at: '2026-11-15T03:31:00Z', failReason: 'Chave inválida' },
    ] })
    expect(mixed.subject).toContain('com falhas')
    expect(mixed.text).toContain('Beto: R$ 5,00 · Falhou')
    expect(mixed.text).toContain('Chave inválida')
    expect(mixed.text).toContain('Total com falha: R$ 5,00')

    const allFailed = adminPayoutSummaryMail({ ...base, items: [{ partner: 'Beto', amount: 5, status: 'failed', at: null }] })
    expect(allFailed.subject).toContain('falhou')
  })

  it('o webhook enfileira o aviso do parceiro (um por item) e o resumo do lote, sem depender do interruptor de cobrança', () => {
    const hook = read('supabase/functions/asaas-webhook/index.ts')
    expect(hook).toContain('queuePayoutNotice(supabase, { kind: "partner_payout_paid", ref: outcome.itemId')
    expect(hook).toContain('payoutIsFinal(')
    expect(hook).toContain('kind: "admin_payout_summary", ref: outcome.payoutId')
    const billing = read('supabase/functions/_shared/billing.ts')
    const fn = billing.slice(billing.indexOf('export async function queuePayoutNotice'), billing.indexOf('export async function pingNotify'))
    expect(fn).not.toContain('cfg.enabled')
    const partners = read('supabase/functions/_shared/partners.ts')
    expect(partners).toContain('Promise<TransferOutcome | null>')
  })

  it('o envio da fila manda só os avisos de repasse quando os de cobrança estão desligados, e a rotina diária também', () => {
    const svc = read('src/lib/billing/billingService.ts')
    expect(svc).toContain("if (!cfg.enabled) query = query.in('kind', [...PAYOUT_KINDS])")
    expect(svc).not.toMatch(/if \(!cfg\.enabled\) return out/)
    expect(svc).toContain('...(await processQueue(admin, cfg))')
    // o aviso do parceiro só sai se o item está pago e vai para o e-mail do próprio parceiro (nunca de um campo vindo da tela)
    expect(svc).toContain("item.status !== 'done'")
    expect(svc).toContain("admin.from('profiles').select('email').eq('id', partner.user_id)")
  })

  it('o lote criado pelo SuperAdmin envia o resumo na hora se já terminou (ex.: tudo recusado)', () => {
    const act = read('src/app/actions/partners.ts')
    expect(act).toContain('queuePayoutSummaryIfFinal(admin, payout.payout_id)')
  })
})
