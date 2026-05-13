import { createClient } from '@/utils/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { HeroContent } from '@/components/landing/HeroContent'
import { MarketingSections } from '@/components/marketing/MarketingSections'
import { Footer } from '@/components/layout/Footer'

export default async function Home() {
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
    <div className="min-h-screen pt-16 flex flex-col bg-white dark:bg-black text-black dark:text-white transition-colors duration-500 relative overflow-hidden">
      <Navbar user={user} profile={profile} />

      <main className="flex-grow flex flex-col items-center relative">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[10%] left-[-10%] w-[60%] h-[40%] bg-indigo-500/10 rounded-full blur-[140px]"></div>
          <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[140px]"></div>
        </div>

        <HeroContent user={user} />
        
        {/* New Marketing Sections */}
        <MarketingSections />
      </main>
      <Footer />
    </div>
  )
}
