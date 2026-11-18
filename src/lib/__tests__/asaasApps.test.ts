import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_ASAAS_APPS, MAX_ASAAS_APPS, MAX_ASAAS_APP_NAME, classifyKey, isForeignAsaasEvent, isOwnCustomerRef, isOwnPaymentRef, keyAlertDecision,
  loadAsaasApps, ownCustomerRef, parseAsaasApps,
} from '../../../supabase/functions/_shared/asaasApps'
import { adminBillingMail } from '../billing/billingMailText'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

// Vários apps na mesma conta do Asaas (MetaBuilderPRO e TraderMasterPRO): o webhook é da conta, então cada app tem de reconhecer o que é seu.
describe('referências: o que é do MetaBuilder', () => {
  it('pagamentos e assinaturas nossos começam com w_, ws_ ou u_; o resto não é nosso', () => {
    for (const ref of ['w_abc_l_1_c_mo_1700000000', 'ws_x', 'u_1234']) expect(isOwnPaymentRef(ref), ref).toBe(true)
    for (const ref of ['tmp_123', 'TM-77', 'mb_x', '', null, undefined, 42]) expect(isOwnPaymentRef(ref), String(ref)).toBe(false)
  })

  it('clientes nossos levam mb_<id do usuário>', () => {
    expect(ownCustomerRef('uuid-1')).toBe('mb_uuid-1')
    expect(isOwnCustomerRef(ownCustomerRef('uuid-1'))).toBe(true)
    expect(isOwnCustomerRef('tmp_9')).toBe(false)
    expect(isOwnCustomerRef(undefined)).toBe(false)
  })
})

describe('apps cadastrados (nomes das chaves de API)', () => {
  const settings = parseAsaasApps({ apps: [{ name: 'MetaBuilderPRO', own: true }, { name: 'TraderMasterPRO', own: false }], otherKeyAlerts: 'info' })

  it('lê com segurança: descarta vazios, repetidos (sem acento, sem diferenciar maiúscula) e o que passa do limite', () => {
    const p = parseAsaasApps({ apps: [{ name: '  A  ', own: true }, { name: 'a', own: false }, { name: '', own: true }, { nome: 'x' }, null, 'texto', { name: 'Áb', own: false }, { name: 'ab', own: true }] })
    expect(p.apps).toEqual([{ name: 'A', own: true }, { name: 'Áb', own: false }])
    expect(parseAsaasApps(null)).toEqual(DEFAULT_ASAAS_APPS)
    expect(parseAsaasApps({ apps: 'x', otherKeyAlerts: 'lixo' })).toEqual({ apps: [], otherKeyAlerts: 'info' })
    expect(parseAsaasApps({ apps: [], otherKeyAlerts: 'none' }).otherKeyAlerts).toBe('none')
    const many = parseAsaasApps({ apps: Array.from({ length: MAX_ASAAS_APPS + 5 }, (_, i) => ({ name: `app${i}`, own: false })) })
    expect(many.apps).toHaveLength(MAX_ASAAS_APPS)
    expect(parseAsaasApps({ apps: [{ name: 'x'.repeat(200), own: true }] }).apps[0].name).toHaveLength(MAX_ASAAS_APP_NAME)
  })

  it('classifica a chave: nossa, de outro app ou desconhecida (sem nome, ou nome fora da lista)', () => {
    expect(classifyKey('MetaBuilderPRO', settings)).toBe('own')
    expect(classifyKey('  metabuilderpro ', settings)).toBe('own') // maiúscula e espaços não importam
    expect(classifyKey('TraderMasterPRO', settings)).toBe('other')
    expect(classifyKey('Outra Coisa', settings)).toBe('unknown')
    expect(classifyKey('', settings)).toBe('unknown')
    expect(classifyKey(null, settings)).toBe('unknown')
    expect(classifyKey('TraderMasterPRO', DEFAULT_ASAAS_APPS)).toBe('unknown') // nada cadastrado: tudo é "desconhecido" (e avisa, como sempre foi)
  })

  it('decide o aviso: nossa e desconhecida avisam sempre; de outro app, conforme o ajuste', () => {
    expect(keyAlertDecision('MetaBuilderPRO', settings)).toEqual({ scope: 'own', send: true })
    expect(keyAlertDecision('Desconhecida', settings)).toEqual({ scope: 'unknown', send: true })
    expect(keyAlertDecision(undefined, settings)).toEqual({ scope: 'unknown', send: true }) // sem nome: na dúvida, avisa
    expect(keyAlertDecision('TraderMasterPRO', settings)).toEqual({ scope: 'other', send: true })
    expect(keyAlertDecision('TraderMasterPRO', { ...settings, otherKeyAlerts: 'none' })).toEqual({ scope: 'other', send: false })
    // desligar o aviso de outro app NUNCA cala a chave nossa nem a desconhecida
    expect(keyAlertDecision('MetaBuilderPRO', { ...settings, otherKeyAlerts: 'none' }).send).toBe(true)
    expect(keyAlertDecision('Desconhecida', { ...settings, otherKeyAlerts: 'none' }).send).toBe(true)
  })

  it('lê do banco e, em qualquer falha, cai em "nada cadastrado"', async () => {
    const ok = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { value: { apps: [{ name: 'X', own: true }], otherKeyAlerts: 'none' } } }) }) }) }) }
    expect(await loadAsaasApps(ok)).toEqual({ apps: [{ name: 'X', own: true }], otherKeyAlerts: 'none' })
    const boom = { from: () => { throw new Error('banco fora') } }
    expect(await loadAsaasApps(boom)).toEqual(DEFAULT_ASAAS_APPS)
    expect(await loadAsaasApps({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) })).toEqual(DEFAULT_ASAAS_APPS)
  })
})

describe('evento de pagamento: é de outro app?', () => {
  it('só quando a referência existe, não é nossa e o pagamento/assinatura não está no nosso banco', () => {
    expect(isForeignAsaasEvent({ externalReference: 'tmp_1', isKnownPayment: false, isKnownSubscription: false })).toBe(true)
    // já está no nosso banco: é nosso mesmo com referência estranha
    expect(isForeignAsaasEvent({ externalReference: 'tmp_1', isKnownPayment: true, isKnownSubscription: false })).toBe(false)
    expect(isForeignAsaasEvent({ externalReference: 'tmp_1', isKnownPayment: false, isKnownSubscription: true })).toBe(false)
    // formato nosso: nunca é de outro app, mesmo sem estar no banco (cai no alerta de "não identificado")
    expect(isForeignAsaasEvent({ externalReference: 'w_abc_l_1_c_mo_1', isKnownPayment: false, isKnownSubscription: false })).toBe(false)
    // sem referência: não dá para saber, então NÃO ignora
    for (const ref of [undefined, null, '', '   ']) expect(isForeignAsaasEvent({ externalReference: ref, isKnownPayment: false, isKnownSubscription: false }), String(ref)).toBe(false)
  })
})

describe('e-mail do alerta de chave conforme o dono da chave', () => {
  const base = { appUrl: 'https://x.com', event: 'ACCESS_TOKEN_EXPIRED', keyName: 'TraderMasterPRO' }

  it('chave de outro app: informativo, sem mandar mexer nos Secrets do MetaBuilder', () => {
    const m = adminBillingMail('admin_key_alert', { ...base, keyScope: 'other' })!
    expect(m.subject).toBe('Chave de API do Asaas expirou (outro app)')
    expect(m.text).toContain('não afeta o checkout nem os repasses do MetaBuilder')
    expect(m.text).toContain('Nada no MetaBuilder')
    expect(m.text).not.toContain('ASAAS_API_KEY')
    expect(m.text).not.toContain('estão parados')
  })

  it('chave desconhecida: mantém o alerta de urgência e pede o cadastro; chave nossa e sem escopo ficam como sempre', () => {
    const unk = adminBillingMail('admin_key_alert', { ...base, keyName: 'Nova', keyScope: 'unknown' })!
    expect(unk.subject).toBe('Chave de API do Asaas expirou')
    expect(unk.text).toContain('estão parados')
    expect(unk.text).toContain('Chave cadastrada?: Não')
    for (const keyScope of ['own', null, undefined] as const) {
      const m = adminBillingMail('admin_key_alert', { ...base, keyName: 'MetaBuilderPRO', keyScope })!
      expect(m.subject).toBe('Chave de API do Asaas expirou')
      expect(m.text).toContain('ASAAS_API_KEY')
      expect(m.text).not.toContain('Chave cadastrada?')
    }
  })
})

describe('código das Edge Functions e da tela', () => {
  it('o webhook ignora evento de outro app ANTES de qualquer tratamento e nunca derruba o evento por erro nessa conferência', () => {
    const hook = read('supabase/functions/asaas-webhook/index.ts')
    const guard = hook.indexOf('isForeignAsaasEvent(')
    expect(guard).toBeGreaterThan(0)
    expect(guard).toBeLessThan(hook.indexOf('event === "PAYMENT_RECEIVED"')) // antes de resolver o contexto
    expect(guard).toBeLessThan(hook.indexOf('"admin_unresolved"'))
    expect(guard).toBeLessThan(hook.indexOf('"admin_refund"'))
    const block = hook.slice(hook.lastIndexOf('try {', guard), hook.indexOf('} catch (e) { console.error("[app-externo]', guard))
    expect(block).toContain('isOwnPaymentRef(ref)') // só consulta o banco quando a referência não tem o formato nosso
    expect(block).toContain('from("payments")') // e confere se o pagamento já é nosso
    expect(block).toContain('from("profiles")') // ou a assinatura
    expect(block).toContain('ignored: "other_app"')
    expect(block).toContain('status: 200') // 200 para o Asaas não reenviar o evento
    expect(hook).toContain('segue o fluxo normal') // erro na conferência = fluxo normal
  })

  it('o alerta de chave do webhook usa o cadastro de apps e leva o escopo; sem aviso para outro app só quando o ajuste manda', () => {
    const hook = read('supabase/functions/asaas-webhook/index.ts')
    const i = hook.indexOf('event.startsWith("ACCESS_TOKEN_")')
    const block = hook.slice(i, i + 1800)
    expect(block).toContain('keyAlertDecision(str(tok.name), await loadAsaasApps(supabase))')
    expect(block).toContain('if (!send)')
    expect(block).toContain('scope }') // o escopo vai no payload
    expect(read('src/lib/billing/billingService.ts')).toContain('keyScope: p.scope ?? null')
  })

  it('o checkout só usa cliente NOSSO: perfil, depois a marca mb_; nunca o e-mail solto; só mexe em cliente nosso; cria já com a marca', () => {
    const co = read('supabase/functions/asaas-checkout/index.ts')
    expect(co).not.toContain('customers?email=') // o risco antigo: reaproveitar cliente de outro app pelo e-mail
    expect(co).toContain('prevProfile?.asaas_customer_id')
    expect(co).toContain('customers?externalReference=')
    expect(co).toContain('isOwnCustomerRef(linkedRef)') // cliente do perfil marcado por outro app não é usado
    expect(co).toContain('first.externalReference === ownCustomerRefValue')
    // o PUT (marca e notificações desligadas) só acontece dentro de "if (asaasCustomerId)": cliente já confirmado como nosso
    const put = co.indexOf('notificationDisabled: true,\n          externalReference: ownCustomerRefValue')
    expect(put).toBeGreaterThan(0)
    expect(co.slice(co.lastIndexOf('if (asaasCustomerId) {', put), put)).not.toContain('POST')
    // a criação leva a marca
    const create = co.slice(co.indexOf('// Create new customer'))
    expect(create.slice(0, 700)).toContain('externalReference: ownCustomerRefValue')
  })

  it('o código novo vai junto nos arquivos únicos do webhook e do checkout (o empacotador conhece o módulo)', () => {
    expect(read('scripts/bundle-edge-functions.mjs')).toContain("'asaasApps'")
  })

  it('a tela e a ação: só SuperAdmin, e recusa o que o leitor descartaria calado', () => {
    const act = read('src/app/actions/asaasApps.ts')
    expect(act).toContain("is_super_admin")
    expect(act).toContain("'invalid_apps'")
    expect(act).toContain("key: 'asaas_apps'")
    const ui = read('src/components/admin/BillingNoticesAdmin.tsx')
    expect(ui).toContain("k('apps_title')")
    expect(ui).toContain('saveAsaasApps')
  })
})
