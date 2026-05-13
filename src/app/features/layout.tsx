import { createClient } from '@/utils/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

export default async function FeaturesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <div className="min-h-screen pt-16 flex flex-col bg-white dark:bg-[#050505] transition-colors duration-500">
      <Navbar user={user} profile={profile} />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
    </div>
  )
}
