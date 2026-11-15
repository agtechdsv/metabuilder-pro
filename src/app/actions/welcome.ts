'use server'

import { createClient } from '@/utils/supabase/server'
import { sendWelcomeIfNew } from '@/lib/billing/billingService'

/**
 * Boas-vindas de quem acabou de entrar pela página de retorno do login (Google, confirmação de cadastro). Quem é vem da SESSÃO, nunca do pedido.
 * Só envia uma vez por usuário e só para contas criadas há pouco (ver queueWelcome). Nunca lança: o e-mail é um extra e não pode atrapalhar o login.
 */
export async function welcomeCurrentUser(): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await sendWelcomeIfNew(user.id)
  } catch (e) {
    console.error('[boas-vindas] não foi possível enviar:', (e as Error)?.message)
  }
}
