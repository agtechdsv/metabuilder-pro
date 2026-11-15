/**
 * Regra de quando uma indicação de parceiro já existente para o mesmo e-mail impede uma nova.
 *
 * O banco só aceita UMA indicação por e-mail (índice único em lower(referred_email)). Antes, qualquer indicação existente barrava a nova, mesmo
 * cancelada: quem cancelou (ou teve a conta excluída) e voltava por outro link nunca era atribuído ao novo parceiro.
 *
 *  - indicação registrada ou assinante: continua valendo (o primeiro parceiro ganha) e a nova é ignorada;
 *  - indicação CANCELADA: é arquivada e a nova é criada. Arquivar = trocar o e-mail da linha antiga por um com sufixo, o que libera o índice único e mantém
 *    o histórico e as comissões já geradas (elas apontam para a linha, que não é apagada nem muda de parceiro).
 */
export type ReferralAction = 'create' | 'keep' | 'archive_then_create'

export interface ExistingReferral { id: string; status: string }

export function decideReferralAction(existing: ExistingReferral | null | undefined): ReferralAction {
  if (!existing) return 'create'
  return existing.status === 'canceled' ? 'archive_then_create' : 'keep'
}

/** E-mail da linha arquivada: nunca coincide com um e-mail real, e é único por linha. */
export const archivedReferralEmail = (email: string, id: string): string => `${email.trim().toLowerCase()}#arquivada-${id}`
