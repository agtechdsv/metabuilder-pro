import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

describe('"Esqueceu?" da tela de login', () => {
  const form = read('src/components/auth/LoginForm.tsx')

  it('o botão faz alguma coisa (era um botão sem ação) e pede o e-mail antes', () => {
    expect(form).toMatch(/onClick=\{handleForgotPassword\}/)
    const fn = form.slice(form.indexOf('const handleForgotPassword'), form.indexOf('// ── Tela de "Retomando sessão"'))
    expect(fn).toContain('auth.login.forgot_need_email')
    expect(fn).toContain('resetPasswordForEmail(address')
  })

  it('o link volta pela página de retorno do login e leva à nova senha; a resposta não revela se a conta existe', () => {
    const fn = form.slice(form.indexOf('const handleForgotPassword'), form.indexOf('// ── Tela de "Retomando sessão"'))
    expect(fn).toContain("/auth/callback?next=${encodeURIComponent('/auth/reset-password')}")
    // só o limite de envios é dito; qualquer outro resultado (inclusive conta inexistente) mostra a mesma mensagem de sucesso
    expect(fn).toContain('forgot_rate_limit')
    expect(fn.match(/forgot_sent/g)?.length).toBe(2)
  })

  it('a página de nova senha exige a sessão da recuperação e reutiliza o formulário do primeiro acesso', () => {
    const page = read('src/app/auth/reset-password/page.tsx')
    expect(page).toContain("redirect('/auth/session-expired')")
    expect(page).toContain('<SetPasswordForm')
    expect(page).toContain('auth.getUser()')
  })

  it('os textos novos existem nos três idiomas', () => {
    for (const lang of ['pt', 'en', 'es']) {
      const j = JSON.parse(read(`src/i18n/translations/${lang}.json`))
      for (const key of ['forgot_need_email', 'forgot_sent', 'forgot_rate_limit']) expect(j.auth.login[key], `${lang} ${key}`).toBeTruthy()
    }
  })
})
