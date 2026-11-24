import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ALWAYS_SEND_KINDS, CUSTOMER_KINDS, PRICE_CHANGE_KINDS } from '../../../supabase/functions/_shared/billingCore'
import { MIN_CHARGE, campaignUnitPriceFor, chargeBreakdown, type PricingRules } from '../../../supabase/functions/_shared/pricing'
import { BILLING_CUSTOMER_KINDS, customerBillingMail } from '../billing/billingMailText'
import {
  MIN_INCREASE_NOTICE_DAYS, addDays, buildNewRules, campaignStillActive, changeForRenewal, daysBetween, isLongCycle, noticeAmounts, oldRulesOf, renewalReminderDue,
  validateReprice, vigenceReminderDue,
} from '../billing/priceChange'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const rules = (base: number): PricingRules => ({ base_price: base, volume_tiers: [], cycle_discounts: { monthly: 0, quarterly: 0, semiannual: 10, yearly: 20 } })

describe('pedido de reajuste', () => {
  it('aumento exige 30 dias de aviso; redução pode valer na hora', () => {
    expect(MIN_INCREASE_NOTICE_DAYS).toBe(30)
    expect(validateReprice({ currentBase: 10, newBase: 12, days: 29 })).toEqual({ ok: false, code: 'notice_too_short' })
    expect(validateReprice({ currentBase: 10, newBase: 12, days: 30 })).toEqual({ ok: true, newBase: 12, days: 30, increase: true })
    expect(validateReprice({ currentBase: 10, newBase: 8, days: 0 })).toEqual({ ok: true, newBase: 8, days: 0, increase: false })
  })

  it('sem assinante a avisar, o aumento vale na hora; com assinante (ou sem informar) a regra dos 30 dias segue', () => {
    expect(validateReprice({ currentBase: 6, newBase: 349, days: 0, subscribers: 0 })).toEqual({ ok: true, newBase: 349, days: 0, increase: true, noticeWaived: true })
    expect(validateReprice({ currentBase: 6, newBase: 349, days: 10, subscribers: 0 })).toMatchObject({ ok: true, noticeWaived: true })
    // com 30 dias ou mais não há o que dispensar
    expect(validateReprice({ currentBase: 6, newBase: 349, days: 30, subscribers: 0 })).toEqual({ ok: true, newBase: 349, days: 30, increase: true })
    // um assinante que seja: aviso obrigatório. Só o NÚMERO 0 dispensa (nada de vazio, nulo, texto ou ausente)
    expect(validateReprice({ currentBase: 6, newBase: 349, days: 0, subscribers: 1 })).toEqual({ ok: false, code: 'notice_too_short' })
    for (const s of [undefined, null, '', '0', false, NaN, -1]) expect(validateReprice({ currentBase: 6, newBase: 349, days: 0, subscribers: s }), String(s)).toEqual({ ok: false, code: 'notice_too_short' })
    // redução nunca precisou de aviso, e a dispensa não aparece nela
    expect(validateReprice({ currentBase: 10, newBase: 8, days: 0, subscribers: 0 })).toEqual({ ok: true, newBase: 8, days: 0, increase: false })
  })

  it('o servidor conta os assinantes no banco (não confia no navegador) e "0 dias" aplica na hora', () => {
    const svc = read('src/lib/billing/priceChangeService.ts')
    expect(svc).toContain('subscribers: subs.length')
    expect(svc.indexOf('const subs = await subscribers(admin)')).toBeLessThan(svc.indexOf('validateReprice('))
    expect(svc).toContain('check.days === 0 ? await applyDueChangesNow() : false')
    const act = read('src/app/actions/priceChange.ts')
    expect(act).not.toMatch(/subscribers:\s*input/) // a contagem nunca vem do corpo do pedido
  })

  it('o que vem do navegador é conferido (valor, dias, igual ao atual)', () => {
    for (const v of [0, -1, NaN, 'abc', null, undefined, 2_000_000, Infinity]) expect(validateReprice({ currentBase: 10, newBase: v, days: 30 }), String(v)).toEqual({ ok: false, code: 'invalid_value' })
    for (const d of [-1, 1.5, 366, 'x', '', null, undefined, NaN]) expect(validateReprice({ currentBase: 10, newBase: 12, days: d }), String(d)).toEqual({ ok: false, code: 'invalid_days' })
    expect(validateReprice({ currentBase: 10, newBase: 10, days: 30 })).toEqual({ ok: false, code: 'same_value' })
    expect(validateReprice({ currentBase: 10, newBase: '10,00', days: 30 })).toEqual({ ok: false, code: 'same_value' })
  })

  it('aceita vírgula e arredonda para centavos', () => {
    expect(validateReprice({ currentBase: 10, newBase: '12,505', days: '45' })).toMatchObject({ ok: true, newBase: 12.51, days: 45 })
  })

  it('a regra nova muda só o valor base (faixas e descontos seguem)', () => {
    const cur = { volume_tiers: [{ min_licenses: 3, discount_percent: 5 }], cycle_discounts: { yearly: 20 } }
    expect(buildNewRules(cur, 12)).toEqual({ base_price: 12, volume_tiers: cur.volume_tiers, cycle_discounts: cur.cycle_discounts })
    expect(buildNewRules({}, 12)).toEqual({ base_price: 12, volume_tiers: [], cycle_discounts: {} })
    const change = { rules: buildNewRules(cur, 12), old_base_price: '10.00' }
    expect(oldRulesOf(change)).toMatchObject({ base_price: 10, volume_tiers: cur.volume_tiers })
  })
})

describe('datas', () => {
  it('soma dias e conta a distância (dias de calendário)', () => {
    expect(addDays('2026-11-23', 30)).toBe('2026-12-23')
    expect(addDays('2026-12-20', 15)).toBe('2027-01-04')
    expect(addDays('2026-11-23', 0)).toBe('2026-11-23')
    expect(daysBetween('2026-11-23', '2026-12-23')).toBe(30)
    expect(daysBetween('2026-12-23', '2026-11-23')).toBe(-30)
    expect(Number.isNaN(daysBetween('x', '2026-11-23'))).toBe(true)
  })
})

describe('preço promocional travado', () => {
  const campaign = { percent: 50, months: 2, licenses: 1, unitPrice: 5 }

  const at = (base: number, c: typeof campaign | Omit<typeof campaign, 'unitPrice'>) => chargeBreakdown({ rules: rules(base), licenses: 1, cycle: 'monthly', campaign: c, campaignMonthsRemaining: 1 }).total

  it('"o melhor para o cliente": um AUMENTO da tabela não encarece o promocional que ele viu', () => {
    expect(at(10, campaign)).toBe(5)
    expect(at(12, campaign)).toBe(5) // tabela subiu (50% = 6), o promocional continua o que ele viu
    expect(at(12, { percent: 50, months: 2, licenses: 1 })).toBe(6) // sem o preço travado (campanha antiga), segue a tabela de hoje
  })

  it('"o melhor para o cliente": uma REDUÇÃO da tabela barateia o promocional (nunca paga mais que um cliente novo na mesma campanha)', () => {
    expect(at(12, campaign)).toBe(5) // tabela sobe: o travado (5) protege
    expect(at(8, { percent: 50, months: 2, licenses: 1 })).toBe(5) // 50% de 8 = 4, mas o Asaas não cobra menos que R$ 5,00
    // 50% de 6 = R$ 3,00, que o Asaas recusa ("não pode ser menor que R$ 5,00"): vale o piso, e o cálculo avisa que o aplicou
    expect(at(6, campaign)).toBe(MIN_CHARGE)
    expect(chargeBreakdown({ rules: rules(6), licenses: 1, cycle: 'monthly', campaign, campaignMonthsRemaining: 2 }).minApplied).toBe(true)
    expect(at(4, campaign)).toBe(MIN_CHARGE)
  })

  it('piso de R$ 5,00 por cobrança (mínimo do Asaas): vale para qualquer total positivo, mas total zero continua zero', () => {
    expect(chargeBreakdown({ rules: rules(6), licenses: 1, cycle: 'monthly' }).total).toBe(6)
    expect(chargeBreakdown({ rules: rules(6), licenses: 1, cycle: 'monthly' }).minApplied).toBeUndefined()
    expect(chargeBreakdown({ rules: rules(4), licenses: 1, cycle: 'monthly' }).total).toBe(MIN_CHARGE)
    expect(chargeBreakdown({ rules: rules(0), licenses: 1, cycle: 'monthly' }).total).toBe(0)
  })

  it('o promocional nunca passa do preço regular nem do que ele viu', () => {
    for (const base of [2, 4, 6, 8, 10, 12, 20]) {
      const total = at(base, campaign)
      expect(total, `base ${base}`).toBeLessThanOrEqual(5)
      // o promocional é o menor entre o travado, o % da tabela e o regular; o piso do Asaas (R$ 5,00) só sobe o que ficaria abaixo dele
      expect(total, `base ${base}`).toBeLessThanOrEqual(Math.max(base, MIN_CHARGE))
      expect(total, `base ${base}`).toBeLessThanOrEqual(Math.max(base / 2, MIN_CHARGE) + 0.001)
    }
  })

  it('depois dos meses da campanha vale o preço novo da tabela', () => {
    expect(chargeBreakdown({ rules: rules(12), licenses: 1, cycle: 'monthly', campaign, campaignMonthsRemaining: 0 }).total).toBe(12)
    expect(chargeBreakdown({ rules: rules(6), licenses: 1, cycle: 'monthly', campaign, campaignMonthsRemaining: 0 }).total).toBe(6)
  })

  it('o valor a travar é o valor base x % da campanha, em centavos', () => {
    expect(campaignUnitPriceFor({ base_price: 10 }, 50)).toBe(5)
    expect(campaignUnitPriceFor({ base_price: '12.34' }, '50')).toBe(6.17)
    expect(campaignUnitPriceFor({ base_price: 9.99 }, 33)).toBe(3.3)
  })

  it('o aviso diz se o cliente ainda tem meses de campanha', () => {
    expect(campaignStillActive(campaign, 1)).toBe(true)
    expect(campaignStillActive(campaign, 2)).toBe(false)
    expect(campaignStillActive(null, 0)).toBe(false)
  })
})

describe('valores do aviso', () => {
  it('atual e novo do plano do cliente, já com o desconto de indicação', () => {
    expect(noticeAmounts({ oldRules: rules(10), newRules: rules(12), licenses: 2, cycle: 'monthly', referralPercent: 10 })).toEqual({ current: 18, next: 21.6 })
    expect(noticeAmounts({ oldRules: rules(10), newRules: rules(12), licenses: 1, cycle: 'semiannual' })).toEqual({ current: 54, next: 64.8 }) // 6 meses, -10% de ciclo
  })
})

describe('lembretes', () => {
  it('7 dias antes da vigência, uma vez', () => {
    expect(vigenceReminderDue('2026-12-23', '2026-12-16')).toBe(true)
    expect(vigenceReminderDue('2026-12-23', '2026-12-15')).toBe(false)
    expect(vigenceReminderDue('2026-12-23', '2026-12-17')).toBe(false)
  })

  it('renovação: só trimestral, semestral ou anual, 30 dias antes, e só se cai na vigência ou depois', () => {
    const base = { effectiveOn: '2026-12-23', today: '2027-02-13', renewalDay: '2027-03-15' }
    expect(daysBetween(base.today, base.renewalDay)).toBe(30)
    expect(renewalReminderDue({ ...base, cycle: 'semiannual' })).toBe(true)
    expect(renewalReminderDue({ ...base, cycle: 'yearly' })).toBe(true)
    expect(renewalReminderDue({ ...base, cycle: 'quarterly' })).toBe(true)
    expect(renewalReminderDue({ ...base, cycle: 'monthly' })).toBe(false) // o mensal já recebeu o aviso geral
    expect(renewalReminderDue({ ...base, cycle: 'yearly', today: '2027-02-14' })).toBe(false)
    expect(renewalReminderDue({ ...base, cycle: 'yearly', renewalDay: '2026-12-22', today: '2026-11-22' })).toBe(false) // renova antes da vigência
    expect(renewalReminderDue({ ...base, cycle: 'yearly', renewalDay: null })).toBe(false)
    expect(isLongCycle('semiannual') && !isLongCycle('monthly')).toBe(true)
  })

  it('a renovação usa o reajuste mais recente cuja vigência já tinha chegado (agendado ou aplicado; cancelado nunca)', () => {
    const list = [
      { id: 'a', effective_on: '2026-12-01', status: 'applied' },
      { id: 'b', effective_on: '2027-02-01', status: 'scheduled' },
      { id: 'c', effective_on: '2027-01-01', status: 'canceled' },
    ]
    expect(changeForRenewal(list, '2027-03-15')?.id).toBe('b')
    expect(changeForRenewal(list, '2027-01-20')?.id).toBe('a')
    expect(changeForRenewal(list, '2026-11-30')).toBeNull()
  })
})

describe('e-mails de reajuste', () => {
  const d = { name: 'Fulano', effectiveOn: '2026-12-23', currentAmount: 10, newAmount: 12, cycle: 'monthly', campaignActive: true, dueDate: '2027-03-15', appUrl: 'https://x.test' }

  it('os três avisos entram na fila de avisos ao cliente e saem mesmo com os avisos de cobrança desligados', () => {
    for (const k of PRICE_CHANGE_KINDS) {
      expect(CUSTOMER_KINDS as readonly string[]).toContain(k)
      expect(ALWAYS_SEND_KINDS as readonly string[]).toContain(k)
      expect(BILLING_CUSTOMER_KINDS).toContain(k)
    }
  })

  it('cada aviso existe nos três idiomas, com a data, os dois valores e o caminho para cancelar', () => {
    for (const k of PRICE_CHANGE_KINDS) {
      for (const lang of ['pt', 'en', 'es'] as const) {
        const m = customerBillingMail(k, lang, d)!
        expect(m, `${lang}/${k}`).toBeTruthy()
        expect(m.subject).not.toMatch(/[\r\n]/)
        expect(m.text, `${lang}/${k}`).toMatch(/10[,.]00/)
        expect(m.text, `${lang}/${k}`).toMatch(/12[,.]00/)
        expect(m.html).toContain('href="https://x.test/client/dashboard?tab=subscription"')
      }
    }
  })

  it('aviso inicial: assunto com a data de vigência e texto que explica que o valor vale na renovação', () => {
    const pt = customerBillingMail('price_change', 'pt', d)!
    expect(pt.subject).toBe('Reajuste de preço do MetaBuilder PRO a partir de 23/12/2026')
    expect(pt.text).toContain('R$ 10,00')
    expect(pt.text).toContain('R$ 12,00')
    expect(pt.text).toContain('por mês')
    expect(pt.text).toContain('primeira renovação a partir dessa data')
    expect(pt.text).toContain('cancelar a renovação')
    expect(customerBillingMail('price_change', 'en', d)!.subject).toBe('MetaBuilder PRO price update starting 12/23/2026')
    expect(customerBillingMail('price_change', 'es', d)!.subject).toBe('Actualización de precio de MetaBuilder PRO desde el 23/12/2026')
  })

  it('quem está na campanha lê que o preço promocional dele não muda; os demais não leem isso', () => {
    expect(customerBillingMail('price_change', 'pt', d)!.text).toContain('preço promocional da sua campanha não aumenta com o reajuste')
    expect(customerBillingMail('price_change', 'pt', { ...d, campaignActive: false })!.text).not.toContain('promocional')
  })

  it('lembrete de renovação mostra a data da renovação e o ciclo por extenso', () => {
    const m = customerBillingMail('price_change_renewal', 'pt', { ...d, cycle: 'semiannual' })!
    expect(m.text).toContain('15/03/2027')
    expect(m.text).toContain('por semestre')
  })
})

describe('ligação no servidor', () => {
  it('a Edge Function trava a campanha, grava a regra e só então marca como aplicado; o recálculo mexe só em vencimentos da vigência em diante', () => {
    const fn = read('supabase/functions/price-change-apply/index.ts')
    expect(fn).toContain('Bearer')
    expect(fn).toContain('bearer !== serviceKey')
    const freeze = fn.indexOf('campaign_unit_price: price')
    const rule = fn.indexOf('.from("pricing_rules").update(')
    const mark = fn.indexOf('status: "applied"')
    expect(freeze).toBeGreaterThan(0)
    expect(freeze).toBeLessThan(rule)
    expect(rule).toBeLessThan(mark)
    expect(fn).toContain('.lte("effective_on", today)')
    expect(fn).toContain('{ fromDueDate: change.effective_on, failures }')
    // só dá o cliente como sincronizado se o Asaas aceitou tudo; com falha ele fica na fila e o reajuste não vira "recalculado por inteiro"
    expect(fn.indexOf('failures.length > 0')).toBeLessThan(fn.indexOf('price_change_synced_id: change.id'))
    expect(fn).toContain('failed === 0')
    expect(fn).toContain('price_change_synced_id')
    const sync = read('supabase/functions/_shared/iclub.ts')
    expect(sync).toContain('updatePendingPayments: !opts.fromDueDate')
    expect(sync).toContain('if (opts.fromDueDate && String(pay.dueDate || "") < opts.fromDueDate) continue;')
  })

  it('o checkout trava o preço promocional na compra e o webhook/cálculo o usam', () => {
    const co = read('supabase/functions/asaas-checkout/index.ts')
    expect(co).toContain('unitPrice: campaignUnitPriceFor(rules, newCampaign.discount_percent)')
    expect(co).toContain('campaign_unit_price: newCampaign ? campaignUnitPriceFor(rules, newCampaign.discount_percent) : null')
    expect(read('supabase/functions/_shared/iclub.ts')).toContain('...(Number.isFinite(unitPrice) && unitPrice > 0 ? { unitPrice } : {})')
    expect(read('supabase/functions/asaas-update-subscription/index.ts')).toContain('campaign_unit_price')
  })

  it('só o SuperAdmin agenda e cancela, pela sessão; o prazo mínimo é conferido no servidor', () => {
    const act = read('src/app/actions/priceChange.ts')
    for (const fn of ['getRepriceStateAction', 'scheduleRepriceAction', 'cancelRepriceAction']) {
      const body = act.slice(act.indexOf(`export async function ${fn}`))
      expect(body.slice(0, 300), fn).toContain('requireSuperAdmin()')
    }
    expect(act).toContain('is_super_admin')
    const svc = read('src/lib/billing/priceChangeService.ts')
    expect(svc).toContain('validateReprice({ currentBase: rules.base_price')
    expect(svc.indexOf('validateReprice(')).toBeLessThan(svc.indexOf(".from('pricing_changes').insert("))
    expect(svc).toContain("kind: 'price_change'")
  })

  it('salvar as regras não aumenta o valor base com assinantes ativos (só o reajuste agendado)', () => {
    const adm = read('src/app/actions/admin.ts')
    expect(adm).toContain('Number(rules.base_price) > Number(existing[0].base_price)')
    expect(adm).toContain('use "Reajustar"')
  })

  it('o aviso some se o reajuste for cancelado ou a assinatura cancelada', () => {
    const svc = read('src/lib/billing/billingService.ts')
    expect(svc).toContain("String(it.kind).startsWith('price_change')")
    expect(svc).toContain("ch.status === 'canceled'")
  })

  it('a rotina diária está agendada e protegida pelo segredo do cron', () => {
    expect(JSON.parse(read('vercel.json')).crons.map((c: any) => c.path)).toContain('/api/cron/price-change')
    const route = read('src/app/api/cron/price-change/route.ts')
    expect(route).toContain('isCronAuthorized(req)')
    expect(route).toContain('/functions/v1/price-change-apply')
  })

  it('o SQL cria a tabela (um agendado por vez, sem acesso do navegador) e as colunas novas', () => {
    const sql = read('scripts/reajuste-precos.sql')
    for (const s of ['create table if not exists public.pricing_changes', 'pricing_changes_one_scheduled_uidx', "where status = 'scheduled'", 'enable row level security',
      'revoke all on public.pricing_changes from public, anon, authenticated', 'campaign_unit_price', 'price_change_synced_id', 'new_base_price numeric(12,2) not null check (new_base_price > 0)']) expect(sql, s).toContain(s)
  })

  it('a tela tem o botão Reajustar e o aviso ao cliente', () => {
    expect(read('src/components/admin/PricingRulesAdmin.tsx')).toContain('<RepriceCard />')
    const card = read('src/components/admin/RepriceCard.tsx')
    for (const s of ['data-testid="reprice-card"', 'data-testid="reprice-go"', 'Confirmar e avisar', 'Cancelar reajuste']) expect(card, s).toContain(s)
    expect(read('src/components/client/ClientSubscriptionView.tsx')).toContain('data-testid="price-change-notice"')
  })

  it('os textos novos do painel do cliente existem nos três idiomas', () => {
    for (const l of ['pt', 'en', 'es']) {
      const j = JSON.parse(read(`src/i18n/translations/${l}.json`))
      for (const k of ['price_notice_title', 'price_notice_desc', 'price_notice_promo']) expect(j.client_views?.subscription?.[k], `${l}: ${k}`).toBeTruthy()
    }
  })
})
