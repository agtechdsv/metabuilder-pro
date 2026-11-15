import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { EMAIL_TOPICS, cleanAddress, formatFrom, isTeamTopic, parseEmailRouting, resolveRoute, validateRouting } from '../email/routing'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const DOMAIN = 'metabuilderpro.com'
const SMTP = 'contato@metabuilderpro.com'

describe('Gerenciador de e-mails: regras', () => {
  it('endereço limpo: só e-mail simples, minúsculo; nada de nome, vírgula, várias pessoas ou quebra de linha', () => {
    expect(cleanAddress('  Financeiro@MetaBuilderPRO.com ')).toBe('financeiro@metabuilderpro.com')
    expect(cleanAddress('a@b.com, c@d.com')).toBe('')
    expect(cleanAddress('"Nome" <a@b.com>')).toBe('')
    expect(cleanAddress('a@b.com\nBcc: x@y.com')).toBe('')
    expect(cleanAddress('sem-arroba')).toBe('')
    expect(cleanAddress(null)).toBe('')
    expect(cleanAddress('a'.repeat(201) + '@b.com')).toBe('')
  })

  it('só os assuntos conhecidos; "para quem" só vale nos avisos à equipe', () => {
    expect(EMAIL_TOPICS.filter(t => t.team).map(t => t.id).sort()).toEqual(['billing_team', 'partner_team'])
    const r = parseEmailRouting({ topics: {
      billing_team: { from: 'financeiro@x.com', to: 'admin@x.com', lixo: 1 },
      security: { from: 'suporte@x.com', to: 'admin@x.com' },
      inventado: { from: 'a@b.com' },
      checkout: { from: 'invalido' },
    } })
    expect(r.billing_team).toEqual({ from: 'financeiro@x.com', to: 'admin@x.com' })
    expect(r.security).toEqual({ from: 'suporte@x.com' }) // "to" ignorado fora da equipe
    expect((r as any).inventado).toBeUndefined()
    expect(r.checkout).toBeUndefined()
    expect(parseEmailRouting(null)).toEqual({})
    expect(parseEmailRouting('texto')).toEqual({})
  })

  it('validação: remetente só do domínio do SMTP; campo preenchido e inválido é erro (não some em silêncio)', () => {
    const ok = validateRouting({ billing_customer: { from: 'financeiro@metabuilderpro.com', replyTo: 'qualquer@gmail.com' }, partner_team: { to: 'meu@gmail.com' } }, DOMAIN)
    expect(ok.ok).toBe(true)
    const foreign = validateRouting({ checkout: { from: 'ceo@outrodominio.com' } }, DOMAIN)
    expect(foreign).toEqual({ ok: false, error: { topic: 'checkout', field: 'from', code: 'foreign_domain' } })
    expect(validateRouting({ agenda: { from: 'nao-e-email' } }, DOMAIN)).toEqual({ ok: false, error: { topic: 'agenda', field: 'from', code: 'invalid_from' } })
    expect(validateRouting({ agenda: { replyTo: 'x' } }, DOMAIN)).toEqual({ ok: false, error: { topic: 'agenda', field: 'replyTo', code: 'invalid_reply_to' } })
    expect(validateRouting({ billing_team: { to: 'x' } }, DOMAIN)).toEqual({ ok: false, error: { topic: 'billing_team', field: 'to', code: 'invalid_to' } })
    // vazio é permitido (= padrão)
    expect(validateRouting({ checkout: { from: '', replyTo: '  ' } }, DOMAIN).ok).toBe(true)
  })

  it('resolução: o assunto manda; vazio herda de "default"; sem nada, a conta do SMTP; "to" só na equipe', () => {
    expect(resolveRoute({}, 'checkout', SMTP)).toEqual({ from: SMTP })
    expect(resolveRoute(null, 'security', SMTP)).toEqual({ from: SMTP })
    const routing = { default: { from: 'noreply@metabuilderpro.com', replyTo: 'contato@metabuilderpro.com' }, billing_customer: { from: 'financeiro@metabuilderpro.com' }, billing_team: { to: 'admin@metabuilderpro.com' } }
    expect(resolveRoute(routing, 'billing_customer', SMTP)).toEqual({ from: 'financeiro@metabuilderpro.com', replyTo: 'contato@metabuilderpro.com' })
    expect(resolveRoute(routing, 'agenda', SMTP)).toEqual({ from: 'noreply@metabuilderpro.com', replyTo: 'contato@metabuilderpro.com' })
    expect(resolveRoute(routing, 'billing_team', SMTP).to).toBe('admin@metabuilderpro.com')
    expect(resolveRoute(routing, 'agenda', SMTP).to).toBeUndefined()
    expect(isTeamTopic('partner_team')).toBe(true)
    expect(isTeamTopic('checkout')).toBe(false)
  })

  it('cabeçalho "De": nome da marca, sem aspas nem quebra de linha no nome', () => {
    expect(formatFrom('financeiro@metabuilderpro.com')).toBe('"MetaBuilder PRO" <financeiro@metabuilderpro.com>')
    expect(formatFrom('a@b.com', 'Ev"il\nName')).toBe('"EvilName" <a@b.com>')
  })
})

describe('Gerenciador de e-mails: ligação no sistema', () => {
  it('toda ação do gerenciador exige o SuperAdmin da sessão, e o teste só aceita assunto conhecido e destino válido', () => {
    const a = read('src/app/actions/emailRouting.ts')
    expect(a).toContain("'use server'")
    for (const fn of ['getEmailRoutingAdmin', 'saveEmailRouting', 'sendEmailRoutingTest']) {
      const i = a.indexOf(`export async function ${fn}`)
      expect(i, fn).toBeGreaterThan(0)
      expect(a.slice(i, i + 400), fn).toContain('requireSuperAdmin()')
    }
    expect(a).toContain('isEmailTopic(topic)')
    expect(a).toContain('cleanAddress(recipient)')
    expect(a).toContain('validateRouting(input, domainOf(smtpUser()))')
    expect(a).toContain('forgetEmailRouting()')
  })

  it('o envio central usa o roteamento e, se o servidor recusar o remetente escolhido, tenta de novo pela conta padrão', () => {
    const s = read('src/lib/security/securityMail.ts')
    expect(s).toContain('routeFor(topic)')
    expect(s).toContain('replyTo: route.replyTo')
    expect(s).toContain('enviando pela conta padrão')
    // a equipe: o destino do gerenciador vem antes do campo antigo de cada tela
    expect(s).toMatch(/route\.to \|\| \(to \|\| ''\)\.trim\(\) \|\| process\.env\.PARTNER_NOTIFY_EMAIL/)
  })

  it('os pontos de envio usam o assunto certo (nenhum monta o remetente na mão)', () => {
    for (const [file, topic] of [
      ['src/app/actions/checkout-email.ts', 'checkout'], ['src/app/actions/agenda.ts', 'agenda'], ['src/app/actions/stack-interest.ts', 'stack_interest'],
      ['src/app/api/automations/runs/route.ts', 'automations'], ['src/app/api/automations/email/route.ts', 'automations'],
    ] as const) {
      const src = read(file)
      expect(src, file).toContain(`routeFor('${topic}')`)
      expect(src, file).not.toMatch(/from: `"MetaBuilder ?PRO" <\$\{(process\.env\.)?SMTP_USER\}>`/)
    }
    const billing = read('src/lib/billing/billingService.ts')
    expect(billing).toContain("sendMailTo(prof.email, mail, 'billing_customer')")
    expect(billing).toContain("sendTeamNoticeFor('billing_team'")
    expect(billing).toContain("sendMailTo(r.to, r.mail, 'partner_mail')")
    expect(billing).toContain("sendTeamNoticeFor('partner_team'")
    expect(read('src/app/actions/partners.ts')).toContain("sendMailTo(to, mail, 'partner_mail')")
    expect(read('src/app/actions/partnerApplications.ts')).toContain("sendMailTo(to, mail, 'partner_mail')")
    const dev = read('src/app/actions/deviceSessions.ts')
    expect(dev).toContain('sendSlotCodeEmail')
    expect(read('src/lib/security/securityMail.ts')).toContain("'security'")
  })

  it('a tela está na aba Sistema e todos os textos existem nos três idiomas', () => {
    expect(read('src/components/admin/PlatformAdminClient.tsx')).toContain('<EmailManagerAdmin refreshKey={refreshCount} />')
    for (const lang of ['pt', 'en', 'es']) {
      const j = JSON.parse(read(`src/i18n/translations/${lang}.json`))
      const m = j.admin_email
      expect(m, lang).toBeTruthy()
      for (const t of EMAIL_TOPICS) {
        expect(m[`topic_${t.id}`], `${lang} ${t.id}`).toBeTruthy()
        expect(m[`topic_${t.id}_desc`], `${lang} ${t.id}_desc`).toBeTruthy()
      }
      for (const c of ['not_authorized', 'invalid_from', 'foreign_domain', 'invalid_reply_to', 'invalid_to', 'invalid_test', 'no_smtp', 'send_failed', 'unknown']) expect(m[`err_${c}`], `${lang} err_${c}`).toBeTruthy()
    }
  })
})
