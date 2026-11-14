import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isAuthCallbackPath, waitForSession } from '../auth/callbackExchange'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

describe('retorno do login: uma troca de código só', () => {
  it('reconhece a página de retorno e nenhuma outra', () => {
    expect(isAuthCallbackPath('/auth/callback')).toBe(true)
    expect(isAuthCallbackPath('/auth/callback/')).toBe(true)
    expect(isAuthCallbackPath('/auth/callbackx')).toBe(false)
    expect(isAuthCallbackPath('/login')).toBe(false)
    expect(isAuthCallbackPath('/auth/sessao-ativa')).toBe(false)
    expect(isAuthCallbackPath(null)).toBe(false)
    expect(isAuthCallbackPath(undefined)).toBe(false)
  })

  it('espera a sessão aparecer: devolve na primeira tentativa que a tiver, sem esperar o resto', async () => {
    let calls = 0
    const waits: number[] = []
    const session = await waitForSession(async () => (++calls === 3 ? { id: 's1' } : null), 5, 400, async ms => { waits.push(ms) })
    expect(session).toEqual({ id: 's1' })
    expect(calls).toBe(3)
    expect(waits).toEqual([400, 400])
  })

  it('desiste depois do número de tentativas e devolve null; erro numa tentativa não derruba a espera', async () => {
    let calls = 0
    const none = await waitForSession(async () => { calls++; return null }, 4, 10, async () => {})
    expect(none).toBeNull()
    expect(calls).toBe(4)
    let n = 0
    const recovered = await waitForSession(async () => { if (++n < 2) throw new Error('rede'); return 'ok' }, 3, 1, async () => {})
    expect(recovered).toBe('ok')
  })

  it('o cliente compartilhado não troca o código sozinho na página de retorno e a tela espera a sessão antes de dar erro', () => {
    const client = read('src/utils/supabase/client.ts')
    expect(client).toContain("isAuthCallbackPath(window.location.pathname)")
    expect(client).toMatch(/onCallbackPage \? \{ auth: \{ detectSessionInUrl: false, \.\.\.options\?\.auth \} \}/)
    const page = read('src/app/auth/callback/page.tsx')
    expect(page).toContain('waitForSession(')
    // a troca explícita continua sendo feita só pela página, com o cliente dela sem detecção automática
    expect(page).toContain('detectSessionInUrl: false')
    expect(page).toContain('exchangeCodeForSession(code)')
  })
})
