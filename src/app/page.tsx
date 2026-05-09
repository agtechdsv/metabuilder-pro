import { createClient } from '@/utils/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { HeroContent } from '@/components/landing/HeroContent'
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

      <main className="flex-grow flex flex-col items-center justify-center p-6 md:p-12 relative">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[25%] -left-[10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]"></div>
          <div className="absolute -bottom-[25%] -right-[10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]"></div>
          <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-purple-500/5 rounded-full blur-[100px]"></div>
        </div>

        <HeroContent user={user} />
      </main>
      <Footer />
    </div>
  )
}
