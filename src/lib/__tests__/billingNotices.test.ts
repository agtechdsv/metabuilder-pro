import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ADMIN_KINDS, CUSTOMER_KINDS, MAX_GRACE_DAYS, daysToDue, graceExpired, isCustomerKind, noticeRef, parseBillingSettings, reminderKindFor, resolveLang, suspensionDate,
} from '../../../supabase/functions/_shared/billingCore'
import { BILLING_CUSTOMER_KINDS, adminBillingMail, customerBillingMail } from '../billing/billingMailText'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const LANGS = ['pt', 'en', 'es'] as const
const jsonCache = new Map<string, any>()
const json = (l: string) => { if (!jsonCache.has(l)) jsonCache.set(l, JSON.parse(read(`src/i18n/translations/${l}.json`))); return jsonCache.get(l) }
const get = (obj: any, path: string) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

const now = new Date('2026-11-20T12:00:00Z')

describe('avisos de cobrança: cadência (3 dias antes, no dia, 1 e 3 depois)', () => {
  it('conta os dias até o vencimento', () => {
    expect(daysToDue('2026-11-23', now)).toBe(3)
    expect(daysToDue('2026-11-20', now)).toBe(0)
    expect(daysToDue('2026-11-19', now)).toBe(-1)
    expect(Number.isNaN(daysToDue('lixo', now))).toBe(true)
  })

  it('cobrança em aberto pede o lembrete certo no dia certo', () => {
    expect(reminderKindFor('pending', '2026-11-25', now)).toBeNull() // faltam 5 dias
    expect(reminderKindFor('pending', '2026-11-23', now)).toBe('reminder_3d')
    expect(reminderKindFor('pending', '2026-11-21', now)).toBe('reminder_3d')
    expect(reminderKindFor('pending', '2026-11-20', now)).toBe('reminder_due')
    expect(reminderKindFor('overdue', '2026-11-19', now)).toBe('overdue_1d')
    expect(reminderKindFor('overdue', '2026-11-18', now)).toBe('overdue_1d')
    expect(reminderKindFor('overdue', '2026-11-17', now)).toBe('overdue_3d')
    expect(reminderKindFor('overdue', '2026-10-01', now)).toBe('overdue_3d')
  })

  it('o que já foi pago ou estornado, ou não tem vencimento, não gera lembrete', () => {
    expect(reminderKindFor('paid', '2026-11-20', now)).toBeNull()
    expect(reminderKindFor('refunded', '2026-11-19', now)).toBeNull()
    expect(reminderKindFor('pending', null, now)).toBeNull()
    expect(reminderKindFor('pending', 'lixo', now)).toBeNull()
  })
})

describe('avisos de cobrança: carência e ajustes', () => {
  it('suspende só depois da carência e nunca sem data de atraso', () => {
    const since = '2026-11-17T12:00:00Z'
    expect(graceExpired(since, 3, new Date('2026-11-20T11:59:00Z'))).toBe(false)
    expect(graceExpired(since, 3, new Date('2026-11-20T12:00:00Z'))).toBe(true)
    expect(graceExpired(since, 0, new Date('2026-11-17T12:00:00Z'))).toBe(true)
    expect(graceExpired(null, 3, now)).toBe(false)
    expect(graceExpired('lixo', 3, now)).toBe(false)
    expect(suspensionDate(since, 3)?.toISOString()).toBe('2026-11-20T12:00:00.000Z')
    expect(suspensionDate(null, 3)).toBeNull()
  })

  it('os ajustes caem no padrão seguro: desligado, 3 dias, valores fora do limite cortados', () => {
    expect(parseBillingSettings(null)).toEqual({ enabled: false, graceDays: 3, adminEmail: '' })
    expect(parseBillingSettings({ enabled: 'true' }).enabled).toBe(false) // só o booleano true liga
    expect(parseBillingSettings({ enabled: true, graceDays: 99 }).graceDays).toBe(MAX_GRACE_DAYS)
    expect(parseBillingSettings({ graceDays: -4 }).graceDays).toBe(0)
    expect(parseBillingSettings({ graceDays: 'x' }).graceDays).toBe(3)
    expect(parseBillingSettings({ adminEmail: '  a@b.com ' }).adminEmail).toBe('a@b.com')
  })

  it('idioma desconhecido vira português; referência junta as partes; tipos separam cliente e admin', () => {
    expect(resolveLang('en')).toBe('en'); expect(resolveLang('es')).toBe('es'); expect(resolveLang('fr')).toBe('pt'); expect(resolveLang(null)).toBe('pt')
    expect(noticeRef(['pay_1', null, 2])).toBe('pay_1::2')
    expect(isCustomerKind('suspended')).toBe(true); expect(isCustomerKind('admin_overdue')).toBe(false)
    expect(ADMIN_KINDS.length).toBe(4)
  })
})

describe('avisos de cobrança: e-mails', () => {
  const d = { name: 'Ana <b>x</b>', amount: 1234.5, dueDate: '2026-11-25', invoiceUrl: 'https://asaas.exemplo/i/123', billingType: 'PIX', validUntil: '2026-12-20T00:00:00Z', suspendOn: '2026-11-28T12:00:00Z', graceDays: 3, wasSuspended: true, appUrl: 'https://s.exemplo' }

  it('todos os tipos de aviso ao cliente existem nos três idiomas, escapam o nome e trazem o valor formatado', () => {
    expect(BILLING_CUSTOMER_KINDS.sort()).toEqual([...CUSTOMER_KINDS].sort())
    for (const lang of LANGS) for (const kind of CUSTOMER_KINDS) {
      const m = customerBillingMail(kind, lang, d)!
      expect(m, `${lang}/${kind}`).toBeTruthy()
      expect(m.subject, `${lang}/${kind}`).toBeTruthy()
      expect(m.html, `${lang}/${kind}`).toContain('linear-gradient(135deg,#10b981')
      expect(m.html, `${lang}/${kind}`).not.toContain('<b>x</b>')
      expect(m.html, `${lang}/${kind}`).toContain('Ana &lt;b&gt;x&lt;/b&gt;')
      expect(m.subject, `${lang}/${kind}`).not.toMatch(/[\r\n]/)
    }
    expect(customerBillingMail('reminder_3d', 'pt', d)!.html).toContain('R$ 1.234,50')
    expect(customerBillingMail('reminder_3d', 'en', d)!.html).toContain('R$ 1,234.50')
    expect(customerBillingMail('inexistente', 'pt', d)).toBeNull()
  })

  it('o botão leva à fatura (Pix, boleto) nos lembretes e ao painel nos demais', () => {
    expect(customerBillingMail('reminder_due', 'pt', d)!.html).toContain('href="https://asaas.exemplo/i/123"')
    expect(customerBillingMail('overdue_1d', 'pt', d)!.html).toContain('href="https://asaas.exemplo/i/123"')
    for (const k of ['suspended', 'payment_received', 'card_refused', 'canceled']) expect(customerBillingMail(k, 'pt', d)!.html, k).toContain('href="https://s.exemplo/client/dashboard"')
    expect(customerBillingMail('reminder_due', 'pt', { ...d, invoiceUrl: null })!.html).toContain('href="https://s.exemplo/client/dashboard"')
  })

  it('o aviso de vencida diz até quando pagar (com carência) ou que pode suspender a qualquer momento (sem carência)', () => {
    expect(customerBillingMail('overdue_1d', 'pt', d)!.text).toContain('pague até 28/11/2026')
    expect(customerBillingMail('overdue_1d', 'pt', { ...d, graceDays: 0 })!.text).toContain('a qualquer momento')
    expect(customerBillingMail('overdue_3d', 'en', d)!.text).toContain('pay by 11/28/2026')
  })

  it('o recibo avisa quando o acesso foi restabelecido e mostra a validade', () => {
    expect(customerBillingMail('payment_received', 'pt', d)!.text).toContain('restabelecido')
    expect(customerBillingMail('payment_received', 'pt', { ...d, wasSuspended: false })!.text).not.toContain('restabelecido')
    expect(customerBillingMail('payment_received', 'es', d)!.text).toContain('Válido hasta')
  })

  it('os alertas ao admin escapam o texto e o resumo diário leva só contagens', () => {
    const base = { customerName: 'Beto <i>', customerEmail: 'b@x.com', amount: 99, dueDate: '2026-11-19', paymentId: 'pay_9', appUrl: 'https://s.exemplo' }
    for (const k of ['admin_overdue', 'admin_refund', 'admin_unresolved']) {
      const m = adminBillingMail(k, { ...base, event: 'PAYMENT_REFUNDED' })!
      expect(m, k).toBeTruthy()
      expect(m.html, k).not.toContain('<i>')
      expect(m.subject, k).not.toMatch(/[\r\n]/)
    }
    const dg = adminBillingMail('admin_digest', { ...base, digest: { overdue: 2, dueSoon: 5, suspendedToday: 1, received24h: 7, failedNotices: 0 } })!
    expect(dg.text).toContain('Vencidas em aberto: 2')
    expect(dg.html + dg.text).not.toContain('b@x.com')
    expect(adminBillingMail('admin_digest', { ...base })).toBeNull()
    expect(adminBillingMail('nada', base)).toBeNull()
  })
})

describe('avisos de cobrança: ligação no sistema', () => {
  it('o SQL cria a fila única, a carência, o vencimento e o idioma, com tudo desligado e a tabela fechada', () => {
    const sql = read('scripts/avisos-cobranca.sql')
    for (const s of ['payments add column if not exists due_date', 'overdue_since', 'billing_language', 'billing_notices_kind_ref_uidx', 'enable row level security', 'revoke all on public.billing_notices from anon, authenticated']) expect(sql, s).toContain(s)
    expect(sql).toMatch(/"enabled": false/)
    expect(sql).not.toMatch(/create policy|grant /i)
  })

  it('o webhook enfileira os avisos, guarda o vencimento, zera a carência ao pagar e só adia a suspensão com os avisos ligados', () => {
    const w = read('supabase/functions/asaas-webhook/index.ts')
    for (const s of ['"invoice_created"', '"payment_received"', '"overdue_1d"', '"admin_overdue"', '"card_refused"', '"refunded"', '"admin_refund"', '"admin_unresolved"', 'PAYMENT_CREATED', 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED']) expect(w, s).toContain(s)
    expect(w).toContain('overdue_since: null')
    expect(w).toMatch(/if \(!cfg\.enabled \|\| cfg\.graceDays <= 0\)/)
    expect(w).toContain('if (queuedAny) await pingNotify()')
    // a fila usa a referência única do pagamento (evento repetido do Asaas não duplica)
    expect(w).toContain('noticeRef([payment.id])')
    const shared = read('supabase/functions/_shared/billing.ts')
    expect(shared).toContain('ignoreDuplicates: true')
    expect(shared).toContain('if (!cfg.enabled) return false')
  })

  it('a rota de envio exige o segredo (comparação em tempo constante) e a rotina diária fecha quem cancelou antes de checar o interruptor', () => {
    const n = read('src/app/api/billing/notify/route.ts')
    expect(n).toContain('timingSafeEqual')
    expect(n).toMatch(/if \(!secret \|\| !sameSecret\(given, secret\)\)/)
    expect(n).toContain("'x-billing-secret'")
    const svc = read('src/lib/billing/billingService.ts')
    expect(svc.indexOf('expireCanceled(admin, now)')).toBeLessThan(svc.indexOf('if (!cfg.enabled) return { enabled: false, expired }'))
    expect(svc).toContain("if (!cfg.enabled) return out")
    expect(read('vercel.json')).toContain('/api/cron/billing-notices')
    expect(read('src/app/api/cron/billing-notices/route.ts')).toContain('CRON_SECRET')
  })

  it('o checkout grava o idioma e cancela a assinatura antiga ANTES de criar a nova (limpando o vínculo primeiro)', () => {
    const c = read('supabase/functions/asaas-checkout/index.ts')
    expect(c).toContain('billing_language: language')
    const clear = c.indexOf('asaas_subscription_id: null')
    const del = c.indexOf('method: "DELETE"')
    const create = c.indexOf('${ASAAS_URL}/subscriptions`, {\n        method: "POST"')
    expect(clear).toBeGreaterThan(-1)
    expect(clear).toBeLessThan(del)
    expect(del).toBeLessThan(create)
    expect(read('src/components/checkout/hooks/useCheckoutState.ts')).toContain('language: language')
    expect(read('supabase/functions/asaas-cancel/index.ts')).toContain('kind: "canceled"')
  })

  it('o app publicado de quem cancelou a renovação fica no ar até a data de fim do acesso', () => {
    const l = read('src/app/[workspace_slug]/[project_slug]/layout.tsx')
    expect(l).toContain('subscription_expires_at')
    expect(l).toMatch(/subscription_status === 'canceled' &&\s*\n\s*!!ownerProfile\.subscription_expires_at && new Date\(ownerProfile\.subscription_expires_at\)\.getTime\(\) < Date\.now\(\)/)
  })

  it('as ações do SuperAdmin conferem a sessão, o aviso na tela só aparece ligado e para o dono, e o banner e o cartão estão nos lugares', () => {
    const a = read('src/app/actions/billingNotices.ts')
    for (const fn of ['getBillingNoticesAdmin', 'saveBillingNoticesSettings']) expect(a.slice(a.indexOf(`export async function ${fn}`)).slice(0, 400), fn).toContain('requireSuperAdmin()')
    const mine = a.slice(a.indexOf('export async function getMyBillingNotice'))
    expect(mine).toContain('if (!cfg.enabled) return null')
    expect(mine).toContain('subscription_licenses')
    expect(read('src/components/admin/PlatformAdminClient.tsx')).toContain('<BillingNoticesAdmin')
    expect(read('src/components/client/ClientDashboardClient.tsx')).toContain('<BillingBanner')
    expect(read('src/components/workspace/WorkspaceManager.tsx')).toContain('<BillingBanner')
  })

  it('os textos do cartão do admin e do banner existem nos três idiomas, com os mesmos marcadores', () => {
    const adminKeys = [...read('src/components/admin/BillingNoticesAdmin.tsx').matchAll(/\bk\('([a-z0-9_]+)'\)/g)].map(m => m[1])
    const dyn = ['err_not_authorized', 'err_invalid_grace', 'err_invalid_email', 'err_unknown', 'on', 'off', 'on_hint', 'off_hint']
    for (const l of LANGS) for (const key of [...adminKeys, ...dyn]) expect(get(json(l), `admin_billing.${key}`), `${l}: admin_billing.${key}`).toBeTruthy()
    const bannerKeys = [...read('src/components/billing/BillingBanner.tsx').matchAll(/P \+ '([a-z_]+)'/g)].map(m => m[1])
    for (const l of LANGS) for (const key of [...bannerKeys, 'soon_title', 'today_title', 'overdue_desc', 'overdue_desc_grace']) expect(get(json(l), `billing_banner.${key}`), `${l}: billing_banner.${key}`).toBeTruthy()
    const marks = (s: string) => (String(s).match(/\{[a-z]+\}/g) || []).sort().join(',')
    for (const ns of ['admin_billing', 'billing_banner']) for (const key of Object.keys(json('pt')[ns])) for (const l of ['en', 'es']) {
      expect(marks(json(l)[ns][key]), `${l}: ${ns}.${key}`).toBe(marks(json('pt')[ns][key]))
    }
  })
})
