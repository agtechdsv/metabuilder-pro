import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ALWAYS_SEND_KINDS, WELCOME_KIND } from '../../../supabase/functions/_shared/billingCore'
import { welcomeMail } from '../billing/welcomeMailText'
import { EMAIL_TOPIC_IDS } from '../email/routing'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

describe('e-mail de boas-vindas ao cliente novo', () => {
  it('nos 3 idiomas, com o nome escapado, o botão para o painel e a linha de ajuda', () => {
    const d = { name: 'Ana <script>x</script>', appUrl: 'https://x.com' }
    const pt = welcomeMail('pt', d)
    expect(pt.subject).toBe('Bem-vindo ao MetaBuilder PRO')
    expect(pt.html).toContain('Ana &lt;script&gt;x&lt;/script&gt;')
    expect(pt.html).not.toContain('<script>x</script>')
    expect(pt.html).toContain('https://x.com/workspace')
    expect(pt.text).toContain('suporte@metabuilderpro.com')
    expect(welcomeMail('en', d).subject).toBe('Welcome to MetaBuilder PRO')
    expect(welcomeMail('es', d).subject).toBe('Bienvenido a MetaBuilder PRO')
    expect(welcomeMail('en', d).text).toContain('Need help?')
  })

  it('sai sempre (não depende do interruptor dos avisos de cobrança) e tem assunto próprio no Gerenciador de e-mails', () => {
    expect(WELCOME_KIND).toBe('welcome')
    expect(ALWAYS_SEND_KINDS).toContain('welcome')
    expect(ALWAYS_SEND_KINDS).toContain('partner_payout_paid')
    expect(EMAIL_TOPIC_IDS).toContain('welcome')
    const svc = read('src/lib/billing/billingService.ts')
    expect(svc).toContain("if (!cfg.enabled) query = query.in('kind', [...ALWAYS_SEND_KINDS])")
    expect(svc).toContain("sendMailTo(to, mail, 'welcome')")
  })

  it('uma vez por usuário e só para conta recém-criada; endereço e idioma vêm da conta, nunca do pedido', () => {
    const svc = read('src/lib/billing/billingService.ts')
    const q = svc.slice(svc.indexOf('export async function queueWelcome'), svc.indexOf('export async function sendWelcomeIfNew'))
    expect(q).toContain('WELCOME_WINDOW_DAYS * 86_400_000')
    expect(q).toContain("queue(admin, { kind: 'welcome', userId, ref: noticeRef([userId]) })") // fila única por usuário
    const send = svc.slice(svc.indexOf("if (it.kind === 'welcome')"), svc.indexOf('} else if (isPayoutKind(it.kind))'))
    expect(send).toContain('auth.admin.getUserById(')
    expect(send).toContain('resolveMailLang(meta.lang')
  })

  it('é enviado no cadastro com sessão e na página de retorno (Google e confirmação), e a ação usa a sessão', () => {
    const auth = read('src/app/auth/actions.ts')
    expect(auth).toContain('if (data.session) {')
    expect(auth).toContain('sendWelcomeIfNew(data.user.id)')
    expect(read('src/app/auth/callback/page.tsx')).toContain('welcomeCurrentUser()')
    const act = read('src/app/actions/welcome.ts')
    expect(act).toContain("'use server'")
    expect(act).toContain('auth.getUser()')
    expect(act).toContain('sendWelcomeIfNew(user.id)')
    expect(act).not.toMatch(/welcomeCurrentUser\(\s*\w+/) // não recebe quem é: vem da sessão
  })
})
