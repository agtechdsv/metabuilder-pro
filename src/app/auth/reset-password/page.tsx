import { SetPasswordForm } from '@/components/auth/SetPasswordForm'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Nova senha de quem pediu "Esqueceu?" na tela de login. O link do e-mail passa pela página de retorno do login (que cria a sessão de recuperação)
 * e chega aqui. Sem sessão (link vencido ou aberto em outro navegador), volta para o aviso de sessão expirada. A senha é trocada pelo mesmo
 * formulário e ação do primeiro acesso, que exigem a sessão do próprio usuário.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/session-expired')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-b from-neutral-50 to-neutral-200 dark:from-neutral-900 dark:to-black text-neutral-900 dark:text-white transition-colors duration-300">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="bg-white/80 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-md transition-all">
          <SetPasswordForm workspaceSlug={undefined} />
        </div>
      </div>
    </main>
  )
}
