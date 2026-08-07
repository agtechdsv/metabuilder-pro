import { SetPasswordForm } from '@/components/auth/SetPasswordForm'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace_slug?: string }>
}) {
  const resolvedSearchParams = await searchParams
  
  // Verifica se o usuário está logado
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Se não estiver logado, manda pro login
  if (!user) {
    redirect('/auth/session-expired')
  }

  // Se ele já definiu a senha (need_password_setup não é true), redireciona direto
  if (user.user_metadata?.need_password_setup !== true) {
    if (resolvedSearchParams.workspace_slug && resolvedSearchParams.workspace_slug !== 'default') {
      redirect(`/admin/${resolvedSearchParams.workspace_slug}`)
    } else {
      redirect('/workspace')
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-b from-neutral-50 to-neutral-200 dark:from-neutral-900 dark:to-black text-neutral-900 dark:text-white transition-colors duration-300">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="bg-white/80 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-md transition-all">
          <SetPasswordForm 
            workspaceSlug={resolvedSearchParams?.workspace_slug} 
          />
        </div>
      </div>
    </main>
  )
}
