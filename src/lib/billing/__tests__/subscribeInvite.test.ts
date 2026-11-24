import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { shouldShowSubscribeInvite, SUBSCRIBE_INVITE_HREF, SUBSCRIBE_INVITE_IDE_HREF } from '../subscribeInvite'

describe('convite para assinar', () => {
  it('aparece para quem acabou de se cadastrar (sem plano e sem convite)', () => {
    expect(shouldShowSubscribeInvite({})).toBe(true)
    expect(shouldShowSubscribeInvite({ subscriptionStatus: 'pending', subscriptionLicenses: 0 })).toBe(true)
    expect(shouldShowSubscribeInvite({ subscriptionStatus: null, subscriptionLicenses: null })).toBe(true)
  })

  it('não aparece para dono ativo ou cancelado com licenças (que já tem a tela de assinatura)', () => {
    expect(shouldShowSubscribeInvite({ subscriptionStatus: 'active', subscriptionLicenses: 3 })).toBe(false)
    expect(shouldShowSubscribeInvite({ subscriptionStatus: 'canceled', subscriptionLicenses: 3 })).toBe(false)
  })

  it('cancelado SEM licenças (desistiu do checkout) volta a poder assinar; bloqueado nunca', () => {
    expect(shouldShowSubscribeInvite({ subscriptionStatus: 'canceled', subscriptionLicenses: 0 })).toBe(true)
    expect(shouldShowSubscribeInvite({ subscriptionStatus: 'canceled', subscriptionLicenses: null })).toBe(true)
    expect(shouldShowSubscribeInvite({ subscriptionStatus: 'blocked', subscriptionLicenses: 0 })).toBe(false)
  })

  it('não aparece com licenças contratadas, para SuperAdmin nem para convidado de outro dono', () => {
    expect(shouldShowSubscribeInvite({ subscriptionLicenses: 1 })).toBe(false)
    expect(shouldShowSubscribeInvite({ isSuperAdmin: true })).toBe(false)
    expect(shouldShowSubscribeInvite({ isInvitedGuest: true })).toBe(false)
  })

  it('no painel do cliente o convidado assina na aba Assinatura (checkout embutido), sem voltar à página inicial', () => {
    const dash = readFileSync(join(process.cwd(), 'src/components/client/ClientDashboardClient.tsx'), 'utf8')
    // elegível: sem licenças, sem cobrança aberta (essa já tem o fluxo de pagar), com o convite liberado pelo servidor (que exclui bloqueado e convidado de outro dono)
    expect(dash).toContain('const canSubscribeAsGuest = isGuest && !hasOpenCharge && showSubscribeInvite && !!rules && !!authUser')
    expect(dash).toContain('<CheckoutClient rules={rules} user={authUser} profile={localProfile} embedded />')
    expect(dash).toContain("onOpen={canOpenSubscription ? () => setActiveTab('subscription') : undefined}")
    // a aba só abre para quem pode (a regra vale também para ?tab=subscription na URL)
    expect(dash).toContain("(tab === 'subscription' && canOpenSubscription)")
    const banner = readFileSync(join(process.cwd(), 'src/components/billing/SubscribeInviteBanner.tsx'), 'utf8')
    expect(banner).toContain('if (onOpen) { e.preventDefault(); onOpen(); return }')
    const checkout = readFileSync(join(process.cwd(), 'src/components/checkout/CheckoutClient.tsx'), 'utf8')
    expect(checkout).toContain('{!embedded && (')
  })

  it('leva à seção de planos da página inicial', () => {
    expect(SUBSCRIBE_INVITE_HREF).toBe('/#pricing')
  })

  it('na IDE vai ao checkout da própria IDE, nunca ao navegador do sistema (que pode estar logado com outro usuário)', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/billing/SubscribeInviteBanner.tsx'), 'utf8')
    expect(SUBSCRIBE_INVITE_IDE_HREF).toBe('/checkout')
    expect(src).toContain('isTauri()')
    expect(src).toContain('router.push(SUBSCRIBE_INVITE_IDE_HREF)')
    expect(src).not.toContain('openExternalUrl')
  })
})
