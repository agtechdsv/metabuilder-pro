interface MenuProfile {
  is_super_admin?: boolean | null
  subscription_status?: string | null
  subscription_tier?: string | null
}

/**
 * O item "Workspace" do menu do avatar aparece para SuperAdmin, assinante ativo ou que cancelou (e ainda usa até o fim do período)
 * e também para o plano gratuito (freemium: 1 workspace e 4 casos de uso). O gratuito nasce com status "pending", por isso não
 * dá para decidir só pelo status. Quem escolheu um plano pago e ainda não pagou (pending + tier pago) continua sem o atalho.
 */
export function canSeeWorkspaceMenu(profile: MenuProfile | null | undefined): boolean {
  if (!profile) return false
  if (profile.is_super_admin) return true
  if (profile.subscription_status === 'active' || profile.subscription_status === 'canceled') return true
  const tier = profile.subscription_tier
  return !tier || tier === 'free'
}
