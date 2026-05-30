'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Server Action para definição de senha.
 *
 * Executando no servidor, o `updateUser` tem acesso direto ao cookie store,
 * garantindo que a sessão atualizada (com need_password_setup: false) já esteja
 * gravada antes do redirect — eliminando o race-condition do fluxo client-side.
 */
export async function setPasswordAction(
  password: string,
  workspaceSlug: string | undefined
): Promise<{ error: string }> {
  const supabase = await createClient()

  // Verifica sessão atual
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'Sessão inválida. Por favor, solicite um novo link.' }
  }

  // Atualiza a senha E limpa o flag need_password_setup no mesmo request
  const { error } = await supabase.auth.updateUser({
    password,
    data: { need_password_setup: false },
  })

  if (error) {
    return { error: error.message }
  }

  // Redireciona server-side usando a lógica centralizada de redirecionamento pós-login
  let destination = '/workspace'
  try {
    const { getPostLoginRedirectPath } = await import('@/app/auth/actions')
    destination = await getPostLoginRedirectPath(user.id)
  } catch (err) {
    console.error('Error in setPasswordAction redirect:', err)
    destination = workspaceSlug && workspaceSlug !== 'default'
      ? `/admin/${workspaceSlug}`
      : '/workspace'
  }

  redirect(destination)
}
