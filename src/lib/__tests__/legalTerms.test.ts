import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { LEGAL_DOCS, LEGAL_VERSION, isLegalAccepted, isLegalSource } from '../legal/legalVersions'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const lang = (l: string) => JSON.parse(read(`src/i18n/translations/${l}.json`))
const LANGS = ['pt', 'en', 'es']

describe('versão e regra do aceite', () => {
  it('a versão vigente e os documentos', () => {
    expect(LEGAL_VERSION).toBe('3.0')
    expect([...LEGAL_DOCS]).toEqual(['terms', 'privacy'])
  })

  it('só vale quando os DOIS documentos foram aceitos na versão vigente', () => {
    const both = [{ doc: 'terms', version: '3.0' }, { doc: 'privacy', version: '3.0' }]
    expect(isLegalAccepted(both)).toBe(true)
    expect(isLegalAccepted([both[0]])).toBe(false)
    expect(isLegalAccepted([{ doc: 'terms', version: '2.0' }, { doc: 'privacy', version: '2.0' }])).toBe(false) // aceitou a versão anterior
    expect(isLegalAccepted([...both, { doc: 'terms', version: '2.0' }])).toBe(true)
    expect(isLegalAccepted([])).toBe(false)
    expect(isLegalAccepted(null)).toBe(false)
    expect(isLegalAccepted(undefined)).toBe(false)
    expect(isLegalAccepted(both, '4.0')).toBe(false) // subiu a versão: todo mundo volta a ver o aviso
  })

  it('a origem do aceite só pode ser checkout ou aviso do painel', () => {
    expect(isLegalSource('checkout')).toBe(true)
    expect(isLegalSource('notice')).toBe(true)
    for (const v of ['admin', '', null, undefined, 1, 'CHECKOUT']) expect(isLegalSource(v), String(v)).toBe(false)
  })

  it('a linha de versão dos dois documentos acompanha a constante, nos três idiomas', () => {
    for (const l of LANGS) {
      const j = lang(l)
      expect(j.terms.version, `${l} terms`).toContain(`V${LEGAL_VERSION}`)
      expect(j.privacy.version, `${l} privacy`).toContain(`V${LEGAL_VERSION}`)
    }
    // o cabeçalho do modal usa a constante, e as páginas usam a data do idioma (nada de "Maio 2026" escrito no código)
    expect(read('src/components/legal/LegalModal.tsx')).toContain('V{LEGAL_VERSION}')
    expect(read('src/app/terms/page.tsx')).toContain("t('terms.updated')")
    expect(read('src/app/privacy/page.tsx')).toContain("t('privacy.updated')")
    expect(read('src/app/terms/page.tsx')).not.toContain('Maio 2026')
    expect(read('src/app/privacy/page.tsx')).not.toContain('Maio 2026')
  })
})

describe('textos das cláusulas', () => {
  it('Termos 1 a 10 e Privacidade 1 a 7 existem, com título e texto, nos três idiomas', () => {
    for (const l of LANGS) {
      const j = lang(l)
      for (let i = 1; i <= 10; i++) {
        expect(j.terms[`item${i}_title`], `${l} terms item${i}_title`).toBeTruthy()
        expect(j.terms[`item${i}_desc`], `${l} terms item${i}_desc`).toBeTruthy()
      }
      for (let i = 1; i <= 7; i++) {
        expect(j.privacy[`item${i}_title`], `${l} privacy item${i}_title`).toBeTruthy()
        expect(j.privacy[`item${i}_desc`], `${l} privacy item${i}_desc`).toBeTruthy()
      }
      expect(j.terms.updated, `${l} terms.updated`).toBeTruthy()
      expect(j.privacy.updated, `${l} privacy.updated`).toBeTruthy()
    }
  })

  it('as regras de negócio que o sistema pratica estão escritas (30 dias, 7 dias, renovação, carência, campanha)', () => {
    const pt = lang('pt').terms
    expect(pt.item6_desc).toContain('renova automaticamente')
    expect(pt.item7_desc).toContain('30 dias')
    expect(pt.item7_desc).toContain('nunca altera o período já pago')
    expect(pt.item8_desc).toContain('7 dias corridos')
    expect(pt.item8_desc).toContain('não há multa')
    expect(pt.item9_desc).toContain('nunca é maior do que o preço visto')
    expect(pt.item10_desc).toContain('carência')
    expect(pt.item10_desc).toContain('10 dias')
    const en = lang('en').terms
    expect(en.item7_desc).toContain('30 days')
    expect(en.item8_desc).toContain('7 calendar days')
    expect(lang('es').terms.item7_desc).toContain('30 días')
    // cartão: a Privacidade diz o que de fato guardamos
    expect(lang('pt').privacy.item6_desc).toContain('quatro últimos dígitos')
  })

  it('os componentes mostram todos os itens (Termos até o 10 e Privacidade até o 7)', () => {
    const terms = read('src/components/legal/TermsContent.tsx')
    for (let i = 1; i <= 10; i++) expect(terms, `terms item${i}`).toContain(`t('terms.item${i}_desc')`)
    const privacy = read('src/components/legal/PrivacyContent.tsx')
    for (let i = 1; i <= 7; i++) expect(privacy, `privacy item${i}`).toContain(`t('privacy.item${i}_desc')`)
  })
})

describe('aceite no servidor e nas telas', () => {
  it('a ação usa a sessão (nunca o corpo do pedido) e a versão do servidor, sem duplicar', () => {
    const act = read('src/app/actions/legalAcceptance.ts')
    expect(act).toContain('supabase.auth.getUser()')
    expect(act).toContain('isLegalSource(source)')
    expect(act).toContain('version: LEGAL_VERSION')
    expect(act).toContain("onConflict: 'user_id,doc,version'")
    expect(act).toContain('ignoreDuplicates: true')
    // o usuário nunca vem como parâmetro
    expect(act).not.toMatch(/acceptLegalAction\([^)]*userId/)
  })

  it('o checkout exige o aceite e o grava ANTES de falar com o Asaas', () => {
    const hook = read('src/components/checkout/hooks/useCheckoutState.ts')
    expect(hook).toContain('if (!acceptedLegal)')
    expect(hook.indexOf("acceptLegalAction('checkout')")).toBeGreaterThan(0)
    expect(hook.indexOf("acceptLegalAction('checkout')")).toBeLessThan(hook.indexOf("functions.invoke('asaas-checkout', {\n        body: {\n          licenses"))
    expect(hook).toContain('if (!accepted.success) throw')
    const ui = read('src/components/checkout/CheckoutClient.tsx')
    expect(ui).toContain('data-testid="checkout-accept-legal"')
    expect(ui).toContain('!acceptedLegal ||') // o botão fica desabilitado sem o aceite
    expect(ui).toContain("t('legal.accept_checkout'")
  })

  it('os hooks do checkout ficam antes dos retornos antecipados (regra do React)', () => {
    const ui = read('src/components/checkout/CheckoutClient.tsx')
    expect(ui.indexOf('const [legalDoc, setLegalDoc]')).toBeGreaterThan(0)
    expect(ui.indexOf('const [legalDoc, setLegalDoc]')).toBeLessThan(ui.indexOf("if (checkoutStep === 'success')"))
  })

  it('o aviso do painel aparece só para o dono e grava o aceite com origem "notice"', () => {
    expect(read('src/components/client/ClientDashboardClient.tsx')).toContain('{!isGuest && <LegalNoticeBanner />}')
    const b = read('src/components/legal/LegalNoticeBanner.tsx')
    expect(b).toContain("acceptLegalAction('notice')")
    expect(b).toContain('data-testid="legal-notice"')
    expect(b).toContain('myLegalStatusAction()')
  })

  it('o SQL cria a tabela, única por usuário/documento/versão e sem acesso do navegador', () => {
    const sql = read('scripts/aceite-termos.sql')
    for (const s of ['create table if not exists public.terms_acceptances', "check (doc in ('terms', 'privacy'))", "check (source in ('checkout', 'notice'))",
      'terms_acceptances_user_doc_version_uidx', 'enable row level security', 'revoke all on public.terms_acceptances from public, anon, authenticated']) expect(sql, s).toContain(s)
  })

  it('os textos do aceite existem nos três idiomas', () => {
    for (const l of LANGS) {
      const j = lang(l)
      for (const k of ['accept_checkout', 'accept_required', 'accept_error', 'notice_title', 'notice_desc', 'notice_accept', 'notice_accepting', 'notice_dismiss']) expect(j.legal[k], `${l} legal.${k}`).toBeTruthy()
      expect(j.legal.accept_checkout, l).toContain('{terms}')
      expect(j.legal.accept_checkout, l).toContain('{privacy}')
    }
  })
})
