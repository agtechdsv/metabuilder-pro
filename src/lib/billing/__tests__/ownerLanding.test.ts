import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ownerLandingPath, OWNER_DASHBOARD_PATH, OWNER_SUBSCRIPTION_PATH } from '../ownerLanding'

describe('destino do dono logo depois de entrar', () => {
  it('com fatura vencida cai na Assinatura; sem, no painel', () => {
    expect(ownerLandingPath(true)).toBe('/client/dashboard?tab=subscription')
    expect(ownerLandingPath(false)).toBe('/client/dashboard')
    expect(OWNER_SUBSCRIPTION_PATH.startsWith(OWNER_DASHBOARD_PATH)).toBe(true)
  })

  it('o destino do login só olha cobrança vencida do próprio usuário, e só do dono ativo', () => {
    const src = readFileSync('src/app/auth/actions.ts', 'utf8')
    const fn = src.slice(src.indexOf('export async function getPostLoginRedirectPath'), src.indexOf('export async function removePasskeys'))
    expect(fn).toContain(".eq('user_id', userId).eq('status', 'overdue')")
    expect(fn).toContain('ownerLandingPath(!!overdue)')
    // super admin e convidado continuam indo onde iam; o novo destino fica dentro do ramo do dono ativo
    expect(fn.indexOf("return '/admin/platform'")).toBeLessThan(fn.indexOf('ownerLandingPath'))
    expect(fn.indexOf("return '/workspace'")).toBeLessThan(fn.indexOf('ownerLandingPath'))
  })
})
