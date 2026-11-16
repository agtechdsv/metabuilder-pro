import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { canSeeWorkspaceMenu } from '../menuAccess'

describe('item Workspace do menu do avatar', () => {
  it('o plano gratuito (pending, tier free ou vazio) vê o Workspace', () => {
    expect(canSeeWorkspaceMenu({ subscription_status: 'pending', subscription_tier: 'free' })).toBe(true)
    expect(canSeeWorkspaceMenu({ subscription_status: 'pending', subscription_tier: null })).toBe(true)
    expect(canSeeWorkspaceMenu({ subscription_status: 'pending' })).toBe(true)
  })

  it('SuperAdmin, assinante ativo e quem cancelou continuam vendo', () => {
    expect(canSeeWorkspaceMenu({ is_super_admin: true, subscription_status: 'blocked', subscription_tier: 'pro' })).toBe(true)
    expect(canSeeWorkspaceMenu({ subscription_status: 'active', subscription_tier: 'pro' })).toBe(true)
    expect(canSeeWorkspaceMenu({ subscription_status: 'canceled', subscription_tier: 'pro' })).toBe(true)
  })

  it('plano pago ainda não pago ou bloqueado continua sem o atalho, e sem perfil não mostra nada', () => {
    expect(canSeeWorkspaceMenu({ subscription_status: 'pending', subscription_tier: 'pro' })).toBe(false)
    expect(canSeeWorkspaceMenu({ subscription_status: 'blocked', subscription_tier: 'pro' })).toBe(false)
    expect(canSeeWorkspaceMenu(null)).toBe(false)
    expect(canSeeWorkspaceMenu(undefined)).toBe(false)
  })

  it('o UserMenu usa a regra central', () => {
    const src = readFileSync('src/components/auth/UserMenu.tsx', 'utf8')
    expect(src).toContain('canSeeWorkspaceMenu(localProfile)')
    expect(src).not.toContain("localProfile?.subscription_status === 'active' ||")
  })
})
