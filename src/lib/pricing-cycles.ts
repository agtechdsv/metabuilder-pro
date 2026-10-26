export type BillingCycle = 'monthly' | 'quarterly' | 'semiannual' | 'yearly'

export const ALL_BILLING_CYCLES: readonly BillingCycle[] = ['monthly', 'quarterly', 'semiannual', 'yearly']

// Os ciclos desativados ficam em `cycle_discounts.disabled_cycles` (sem migração de banco).
// O ciclo mensal é a base do preço e nunca pode ser desativado.
export function getEnabledCycles(rules: any, alsoKeep?: string | null): BillingCycle[] {
  const disabled: string[] = Array.isArray(rules?.cycle_discounts?.disabled_cycles)
    ? rules.cycle_discounts.disabled_cycles
    : []
  return ALL_BILLING_CYCLES.filter(c => c === 'monthly' || c === alsoKeep || !disabled.includes(c))
}
