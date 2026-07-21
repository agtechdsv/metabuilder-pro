import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { ShieldAlert, ArrowLeft, Building2 } from 'lucide-react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

interface WorkspaceLayoutProps {
  children: React.ReactNode
  params: Promise<{
    workspace_slug: string
  }>
}

export default async function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const { workspace_slug } = await params
  const supabase = await createClient()

  // 1. Get logged-in user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Enforce password setup if required
  if (user.user_metadata?.need_password_setup === true) {
    redirect(`/auth/set-password?workspace_slug=${workspace_slug}`)
  }

  // 2. Fetch profile for navbar
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // 3. Resolve Workspace with subscription details from owner's profile
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, name, slug, owner_id')
    .eq('slug', workspace_slug)
    .single()

  if (workspaceError || !workspace) notFound()

  // Buscar o profile do owner separadamente para evitar erro de FK
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('subscription_status, is_blocked')
    .eq('id', workspace.owner_id)
    .single()

  // 4. Enforce subscription check (Unless Super Admin)
  const isSuperAdmin = profile?.is_super_admin === true


  let isBlocked = false;
  if (ownerProfile) {
    isBlocked = ownerProfile.is_blocked || ownerProfile.subscription_status === 'blocked' || ownerProfile.subscription_status === 'pending'
  }

  if (isBlocked && !isSuperAdmin) {
    const isOwner = workspace.owner_id === user.id

    if (isOwner) {
      // Free tier owners: redirect to workspace (not checkout)
      redirect('/workspace')
    } else {
      // Non-owner members see a premium paywall message
      return (
        <div className="min-h-screen flex flex-col pt-16 bg-white dark:bg-[#050505] text-black dark:text-white transition-colors duration-300">
          <Navbar user={user} profile={profile} />

          <main className="flex-grow flex items-center justify-center p-6 relative">
            {/* Ambient gradients */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
              <div className="absolute top-[20%] left-[-10%] w-[40%] h-[40%] bg-red-500/5 rounded-full blur-[120px]"></div>
              <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px]"></div>
            </div>

            <div className="w-full max-w-lg bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 p-8 md:p-10 rounded-[2.5rem] shadow-xl text-center space-y-6 backdrop-blur-md relative z-10">
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <ShieldAlert className="w-8 h-8" />
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                  Acesso Restrito
                </span>
                <h3 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">Workspace Suspenso</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  O acesso ao workspace <strong className="text-neutral-900 dark:text-white">/{workspace.slug}</strong> está temporariamente suspenso.
                </p>
                <div className="p-4 bg-neutral-50 dark:bg-neutral-950/60 rounded-2xl border border-neutral-100 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-450 leading-relaxed text-left flex items-start gap-3 mt-4">
                  <Building2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-neutral-850 dark:text-neutral-300 block mb-1">Como regularizar?</span>
                    Apenas o proprietário deste workspace pode realizar a ativação do plano. Se você é um membro, solicite ao proprietário que entre em contato com o suporte MetaBuilder PRO.
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/workspace"
                  className="flex items-center justify-center gap-2 h-12 px-6 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Meus Workspaces</span>
                </Link>
              </div>
            </div>
          </main>

          <Footer />
        </div>
      )
    }
  }

  return <>{children}</>
}
