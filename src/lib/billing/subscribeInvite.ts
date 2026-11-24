/**
 * Convite para assinar (e aba Assinatura do convidado): vale para quem ainda não tem plano.
 * Não vale para: SuperAdmin, quem tem licenças contratadas (dono pagante, ou cancelado COM licenças, que tem a tela de reativar),
 * quem está bloqueado (status "blocked": bloqueio do administrador ou suspensão por falta de pagamento) e quem foi convidado por outro dono
 * (o acesso dele vem do dono).
 * Quem cancelou ou teve a cobrança cancelada SEM nunca ter licenças (ex.: abriu o checkout e desistiu) volta a poder assinar: antes ficava sem
 * caminho nenhum dentro do painel.
 * Atenção: `is_blocked` NÃO serve para decidir isto: contas gratuitas nascem com is_blocked = true. O bloqueio de verdade é subscription_status = 'blocked'.
 */
export type SubscribeInviteInput = {
  isSuperAdmin?: boolean | null
  subscriptionStatus?: string | null
  subscriptionLicenses?: number | null
  isInvitedGuest?: boolean | null
}

export function shouldShowSubscribeInvite(p: SubscribeInviteInput): boolean {
  if (p.isSuperAdmin) return false
  if (p.isInvitedGuest) return false
  if ((p.subscriptionLicenses ?? 0) > 0) return false
  if (p.subscriptionStatus === 'active' || p.subscriptionStatus === 'blocked') return false
  return true
}

/** Destino do botão fora do painel (workspace): a seção de planos da página inicial (onde se escolhem licenças e ciclo, e a campanha aparece). */
export const SUBSCRIBE_INVITE_HREF = '/#pricing'
/** Na IDE a home é a tela de entrada (sem planos) e o navegador do sistema pode estar logado com outro usuário: vai direto ao checkout da própria IDE. */
export const SUBSCRIBE_INVITE_IDE_HREF = '/checkout'
