import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Footer } from '@/components/layout/Footer'
import { LoungeView } from '@/components/client/LoungeView'

export const dynamic = 'force-dynamic'

export default async function ClientLoungePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/session-expired')

  const { verifyMfaPolicy } = await import('@/app/auth/actions')
  const mfaRes = await verifyMfaPolicy()
  if (mfaRes.mfaSetupRequired) redirect('/login/mfa/setup')
  if (mfaRes.mfaChallengeRequired) redirect(`/login/mfa?factorId=${mfaRes.factorId}`)

  // Fetch full profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen flex flex-col pt-16 bg-white dark:bg-[#050505] text-black dark:text-white transition-colors duration-300">
      <Navbar user={user} profile={profile} />
      <Breadcrumbs />

      <main className="w-full max-w-7xl mx-auto px-6 md:px-10 pt-6 pb-10 flex-grow">
        <LoungeView />
      </main>

      <Footer />
    </div>
  )
}
