/**
 * Convite para assinar: aparece para quem acabou de se cadastrar e ainda não tem plano.
 * Não aparece para: SuperAdmin, quem já é dono pagante (ou cancelado, que tem a tela de assinatura),
 * quem tem licenças contratadas e quem foi convidado por outro dono (o acesso dele vem do dono).
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
  if (p.subscriptionStatus === 'active' || p.subscriptionStatus === 'canceled') return false
  return true
}

/** Destino do botão: a seção de planos da página inicial (onde se escolhem licenças e ciclo, e a campanha aparece). */
export const SUBSCRIBE_INVITE_HREF = '/#pricing'
