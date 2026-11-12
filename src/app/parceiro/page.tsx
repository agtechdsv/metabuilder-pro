import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Footer } from '@/components/layout/Footer'
import { getMyPartnerDashboard } from '@/app/actions/partners'
import PartnerDashboardClient from '@/components/partner/PartnerDashboardClient'

export const dynamic = 'force-dynamic'

/** Painel do parceiro: quem indicou, comissões e pagamentos. Quem é o parceiro vem da sessão (a action confere); quem não é vê uma explicação. */
export default async function PartnerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/session-expired')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const res = await getMyPartnerDashboard()

  return (
    <div className="min-h-screen flex flex-col pt-16 bg-white dark:bg-[#050505] text-black dark:text-white transition-colors duration-300">
      <Navbar user={user} profile={profile} />
      <Breadcrumbs />
      <main className="w-full max-w-6xl mx-auto px-6 pt-6 pb-8 flex-grow">
        <PartnerDashboardClient dashboard={res.success ? res.dashboard : null} />
      </main>
      <Footer />
    </div>
  )
}
