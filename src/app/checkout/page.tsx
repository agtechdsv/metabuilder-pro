import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { CheckoutClient } from '@/components/checkout/CheckoutClient'

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ licenses?: string; workspace_slug?: string; cycle?: string }>
}) {
  const supabase = await createClient()

  // 1. Verificar autenticação
  const { data: { user } } = await supabase.auth.getUser()
  const resolvedSearchParams = await searchParams
  const licensesParam = resolvedSearchParams.licenses
  const workspaceSlug = resolvedSearchParams.workspace_slug
  const cycle = resolvedSearchParams.cycle

  if (!user) {
    let redirectUrl = '/login?redirect_to=/checkout'
    const params = new URLSearchParams()
    if (licensesParam) params.set('licenses', licensesParam)
    if (workspaceSlug) params.set('workspace_slug', workspaceSlug)
    if (cycle) params.set('cycle', cycle)
    const queryString = params.toString()
    if (queryString) {
      redirectUrl = `/login?redirect_to=/checkout?${queryString}`
    }
    redirect(redirectUrl)
  }

  // 2. Buscar perfil para o Header
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // 3. Buscar regras de precificação ativas
  const { data: rules } = await supabase
    .from('pricing_rules')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return (
    <div className="min-h-screen flex flex-col pt-16 bg-white dark:bg-[#050505] text-black dark:text-white transition-colors duration-300 relative overflow-hidden">
      {/* Mesh gradients for modal backdrop effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[10%] left-[-10%] w-[50%] h-[40%] bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[140px]"></div>
        <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[45%] bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-[140px]"></div>
      </div>

      <Navbar user={user} profile={profile} />
      
      <main className="w-full mx-auto px-6 py-12 flex-grow max-w-7xl flex items-center justify-center z-10">
        <CheckoutClient 
          rules={rules} 
          initialLicenses={licensesParam ? parseInt(licensesParam) : 1} 
          initialCycle={cycle as any}
          workspaceSlug={workspaceSlug}
          user={user}
          profile={profile}
        />
      </main>

      <Footer />
    </div>
  )
}

