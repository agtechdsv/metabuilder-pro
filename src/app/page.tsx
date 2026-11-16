import { createClient } from '@/utils/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { HeroContent } from '@/components/landing/HeroContent'
import { MarketingSections } from '@/components/marketing/MarketingSections'
import { CampaignTopBar } from '@/components/marketing/CampaignBanner'
import { Footer } from '@/components/layout/Footer'
import { HomeClientRouter } from '@/components/landing/HomeClientRouter'
import { KickedNotice } from '@/components/auth/KickedNotice'

export default async function Home({ searchParams }: { searchParams: Promise<{ motivo?: string; cidade?: string; hora?: string }> }) {
  const params = await searchParams
  // aviso de "sessão encerrada por outro login": aparece na própria página inicial (do site ou da IDE), sem passar pela tela de login
  // ("saiu": escolheu "Permanecer lá e sair daqui" na tela de escolha; a sessão do outro dispositivo continua ativa)
  const kicked = params?.motivo === 'encerrada'
    ? <KickedNotice city={params.cidade?.slice(0, 80)} time={params.hora?.slice(0, 40)} />
    : params?.motivo === 'saiu'
      ? <KickedNotice variant="left" />
      : null
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

  const webContent = (
    <div className="min-h-screen pt-16 flex flex-col bg-white dark:bg-black text-black dark:text-white transition-colors duration-500 relative overflow-hidden">
      <Navbar user={user} profile={profile} />

      <main className="flex-grow flex flex-col items-center relative">
        {/* Campanha de preço vigente (Black November...): só aparece se houver uma ativa */}
        <div className="w-full relative z-10"><CampaignTopBar /></div>

        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[10%] left-[-10%] w-[60%] h-[40%] bg-indigo-500/10 rounded-full blur-[140px]"></div>
          <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[140px]"></div>
        </div>

        {kicked && <div className="relative z-10 w-full max-w-xl px-6 pt-6">{kicked}</div>}

        <HeroContent user={user} />
        
        {/* New Marketing Sections */}
        <MarketingSections />
      </main>
      <Footer />
    </div>
  )

  return <HomeClientRouter webContent={webContent} user={user} ideNotice={kicked} />
}
