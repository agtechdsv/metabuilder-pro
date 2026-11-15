import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

describe('janela de login e cadastro em telas baixas', () => {
  const modal = read('src/components/auth/AuthModal.tsx')

  it('a janela rola quando é mais alta que a tela (antes o topo e o fim ficavam cortados)', () => {
    expect(modal).toContain('fixed inset-0 z-[60] overflow-y-auto')
    expect(modal).toContain('flex min-h-full items-center justify-center')
    // o cartão não fica preso a uma altura nem some atrás do corte
    expect(modal).not.toMatch(/fixed inset-0 z-\[60\] flex items-center justify-center p-4 md:p-6 pointer-events-none/)
  })

  it('clicar na área vazia em volta continua fechando', () => {
    expect((modal.match(/e\.target === e\.currentTarget\) onClose\(\)/g) || []).length).toBe(2)
  })

  it('o título do cadastro não mistura idiomas ("Join Gratuitamente")', () => {
    const form = read('src/components/auth/LoginForm.tsx')
    expect(form).not.toContain("'Gratuitamente'")
    expect(form).toContain("mode === 'login' ? 'PRO' : 'MetaBuilder PRO'")
  })

  it('a saudação do painel usa o nome informado, e não o começo do e-mail', () => {
    const page = read('src/app/workspace/page.tsx')
    expect(page).toContain('profile?.full_name || user.user_metadata?.full_name')
    expect(page.indexOf('givenName ||')).toBeLessThan(page.indexOf("user.email?.split('@')[0]"))
  })
})
