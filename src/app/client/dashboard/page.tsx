import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Footer } from '@/components/layout/Footer'
import ClientDashboardClient from '@/components/client/ClientDashboardClient'

export const dynamic = 'force-dynamic'

export default async function ClientDashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch full profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, subscription_licenses, subscription_status, subscription_cycle, subscription_expires_at, asaas_customer_id, asaas_subscription_id, is_super_admin, card_brand, card_last_digits, enforce_mfa')
    .eq('id', user.id)
    .single()

  const isOwner = (profile?.subscription_licenses || 0) > 0;
  const isGuest = !isOwner && !profile?.is_super_admin;

  // Owners without active subscriptions go to checkout. Guests are allowed through to MetaConnect.
  if (isOwner && profile?.subscription_status !== 'active' && profile?.subscription_status !== 'canceled') {
    redirect('/checkout')
  }

  // Fetch the active pricing rules
  const { data: rules } = await supabase
    .from('pricing_rules')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Fetch user's workspaces (owner only)
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, slug, created_at, custom_domain')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch projects for each workspace
  let projectsData: any[] = []
  if (workspaces && workspaces.length > 0) {
    const workspaceIds = workspaces.map(w => w.id)
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, workspace_id, created_at, secret_token, custom_domain')
      .in('workspace_id', workspaceIds)
      .order('created_at', { ascending: false })
    projectsData = projects || []
  }

  // Fetch use_cases for all projects
  let useCasesData: any[] = []
  if (projectsData.length > 0) {
    const projectIds = projectsData.map(p => p.id)
    const { data: useCases } = await supabase
      .from('ui_views')
      .select('id, name, project_id, logic_type, created_at')
      .in('project_id', projectIds)
      .neq('slug', 'downloads')
      .order('created_at', { ascending: false })
    useCasesData = useCases || []
  }

  // Fetch workspace members (to compute license usage)
  let membersData: any[] = []
  let profilesData: any[] = []
  if (workspaces && workspaces.length > 0) {
    const workspaceIds = workspaces.map(w => w.id)
    const { data: members } = await supabase
      .from('workspace_members')
      .select('workspace_id, user_id')
      .in('workspace_id', workspaceIds)
    membersData = members || []
    
    // Fetch profiles for those members (and the current user/owner)
    const allUserIds = Array.from(new Set([...membersData.map(m => m.user_id), user.id]))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', allUserIds)
    profilesData = profiles || []
  }

  // Fetch activity logs for productivity tab
  let activityLogsData: any[] = []
  if (workspaces && workspaces.length > 0) {
    const workspaceIds = workspaces.map(w => w.id)
    const { data: logs } = await supabase
      .from('activity_logs')
      .select('id, workspace_id, project_id, user_id, ui_view_id, session_start, session_end, active_time_seconds, actions_count, events')
      .in('workspace_id', workspaceIds)
      .order('session_start', { ascending: false })
      .limit(500)
    activityLogsData = logs || []
  }

  // Fetch payments for this user
  const { data: payments } = await supabase
    .from('payments')
    .select('id, amount, status, cycle, billing_type, invoice_url, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch owner guests to get accurate license counts (global and granular)
  const { data: ownerGuests } = await supabase
    .from('owner_guests')
    .select('id, user_id, access_level')
    .eq('owner_id', user.id)
  const ownerGuestsData = ownerGuests || []

  return (
    <div className="min-h-screen flex flex-col pt-16 bg-white dark:bg-[#050505] text-black dark:text-white transition-colors duration-300">
      <Navbar user={user} profile={profile} />
      <Breadcrumbs />

      <main className="w-full mx-auto px-6 md:px-10 pt-6 pb-10 flex-grow">
        <ClientDashboardClient
          profile={profile}
          rules={rules}
          workspaces={workspaces || []}
          projects={projectsData}
          useCases={useCasesData}
          members={membersData}
          profiles={profilesData}
          payments={payments || []}
          activityLogs={activityLogsData}
          ownerGuests={ownerGuestsData}
        />
      </main>

      <Footer />
    </div>
  )
}
