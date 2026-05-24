import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Footer } from '@/components/layout/Footer'
import PlatformAdminClient from '@/components/admin/PlatformAdminClient'

export const dynamic = 'force-dynamic'

export default async function PlatformAdminPage() {
  const supabase = await createClient()

  // 1. Get logged-in user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Fetch current profile to check super admin status
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // 3. Deny access if not super admin
  if (!profile || !profile.is_super_admin) {
    return (
      <div className="min-h-screen flex flex-col pt-16 bg-white dark:bg-[#050505] text-black dark:text-white transition-colors duration-300">
        <Navbar user={user} profile={profile} />
        <Breadcrumbs />

        <main className="flex-grow flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 p-8 rounded-[2.5rem] shadow-xl text-center space-y-6 backdrop-blur-md">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <ShieldAlert className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-black text-neutral-900 dark:text-white uppercase tracking-wider">Acesso Restrito</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-450 leading-relaxed">
                Desculpe, esta área de controle é exclusiva para o administrador global da plataforma (**agtechtrade@gmail.com**).
              </p>
            </div>

            <div className="pt-2">
              <Link 
                href="/workspace"
                className="inline-flex items-center gap-2 h-11 px-6 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar ao Workspace</span>
              </Link>
            </div>
          </div>
        </main>
        
        <Footer />
      </div>
    )
  }

  // 4. Authorized Super Admin - Fetch BI metrics data using Admin Client to bypass RLS
  const adminSupabase = createAdminClient()

  // Workspaces
  const { data: workspaces } = await adminSupabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: false })

  // Active Profiles
  const { data: profiles } = await adminSupabase
    .from('profiles')
    .select('id, email, full_name, is_super_admin, plan_id')

  // Plans
  const { data: plans } = await adminSupabase
    .from('subscription_plans')
    .select('*')
    .order('price', { ascending: true })

  // Payments
  const { data: payments } = await adminSupabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })

  // Workspace Members (for guest count)
  const { data: workspaceMembers } = await adminSupabase
    .from('workspace_members')
    .select('workspace_id, user_id')

  return (
    <div className="min-h-screen flex flex-col pt-16 bg-white dark:bg-[#050505] text-black dark:text-white transition-colors duration-300">
      <Navbar user={user} profile={profile} />
      <Breadcrumbs />

      <main className="w-full mx-auto px-10 pt-6 pb-4 flex-grow">
        <PlatformAdminClient
          initialPlans={plans || []}
          initialWorkspaces={workspaces || []}
          profiles={profiles || []}
          currentUserEmail={user.email || ''}
          payments={payments || []}
          workspaceMembers={workspaceMembers || []}
        />
      </main>

      <Footer />
    </div>
  )
}
