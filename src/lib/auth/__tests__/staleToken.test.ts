import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isStaleRefreshError } from '../staleToken'

describe('token de renovação ruim ou em loop', () => {
  it('trata 400 e 429 como sessão a limpar (o 429 causou loop de requisições na VM)', () => {
    expect(isStaleRefreshError({ status: 400 })).toBe(true)
    expect(isStaleRefreshError({ status: 429 })).toBe(true)
    expect(isStaleRefreshError({ status: 429, message: 'Request rate limit reached' })).toBe(true)
  })

  it('reconhece pelo texto e pelo código quando o status não vem', () => {
    expect(isStaleRefreshError({ message: 'Invalid Refresh Token: Refresh Token Not Found' })).toBe(true)
    expect(isStaleRefreshError({ code: 'refresh_token_already_used' })).toBe(true)
    expect(isStaleRefreshError({ code: 'over_request_rate_limit' })).toBe(true)
  })

  it('outros erros e a ausência de erro não limpam a sessão', () => {
    expect(isStaleRefreshError(null)).toBe(false)
    expect(isStaleRefreshError(undefined)).toBe(false)
    expect(isStaleRefreshError({ status: 500, message: 'boom' })).toBe(false)
    expect(isStaleRefreshError({ status: 401, message: 'JWT expired' })).toBe(false)
  })

  it('o LoginForm usa o detector nos dois pontos de limpeza e não compara status 400 à mão', () => {
    const src = readFileSync('src/components/auth/LoginForm.tsx', 'utf8')
    expect((src.match(/isStaleRefreshError\(/g) || []).length).toBeGreaterThanOrEqual(2)
    expect(src).not.toContain('error?.status === 400')
    expect(src).not.toContain('userError?.status === 400')
  })
})
