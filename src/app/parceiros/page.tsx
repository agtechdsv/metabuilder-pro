import { createClient, createAdminClient } from '@/utils/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import PartnersLanding from '@/components/partner/PartnersLanding'
import { DEFAULT_PARTNER_SETTINGS } from '@/lib/partners'

export const dynamic = 'force-dynamic'

/**
 * Página pública do programa de parceiros (divulgação). As condições mostradas (%, carência e mínimo de pagamento) vêm dos ajustes que o SuperAdmin
 * edita, então a página nunca promete um número diferente do que vale. Se a leitura falhar, usa os padrões do sistema.
 */
async function readTerms() {
  const terms = { percent: DEFAULT_PARTNER_SETTINGS.defaultPercent, days: DEFAULT_PARTNER_SETTINGS.graceDays, min: DEFAULT_PARTNER_SETTINGS.minPayout }
  try {
    const { data } = await createAdminClient().from('platform_settings').select('key, value')
      .in('key', ['partner_default_percent', 'partner_grace_days', 'partner_min_payout'])
    for (const r of data || []) {
      const v = r.value as Record<string, unknown>
      if (r.key === 'partner_default_percent' && Number.isFinite(Number(v?.percent))) terms.percent = Number(v.percent)
      if (r.key === 'partner_grace_days' && Number.isFinite(Number(v?.days))) terms.days = Number(v.days)
      if (r.key === 'partner_min_payout' && Number.isFinite(Number(v?.amount))) terms.min = Number(v.amount)
    }
  } catch { /* sem leitura: padrões */ }
  return terms
}

export default async function PartnersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data
  }
  const terms = await readTerms()

  return (
    <div className="min-h-screen pt-16 flex flex-col bg-white dark:bg-[#050505] transition-colors duration-500">
      <Navbar user={user} profile={profile} />
      <main className="flex-grow">
        <PartnersLanding terms={terms} />
      </main>
      <Footer />
    </div>
  )
}
