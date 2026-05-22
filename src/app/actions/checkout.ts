'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getOwnerWorkspaces() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Usuário não autenticado' }
    }

    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id)

    if (error) throw error

    return { success: true, workspaces }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function processCheckout(
  planId: string,
  paymentMethod: string,
  billingInfo: {
    name: string
    cpfCnpj: string
    email: string
    cardNumber?: string
    cardExpiry?: string
    cardCvv?: string
  }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Usuário não autenticado' }
    }

    // 1. Verificar se o plano existe e está ativo
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return { success: false, error: 'O plano selecionado é inválido.' }
    }

    // 2. Buscar workspaces do usuário
    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id)

    if (wsError) throw wsError

    let finalSlug = ''

    if (!workspaces || workspaces.length === 0) {
      // Criar workspace padrão
      const userPrefix = user.email ? user.email.split('@')[0] : 'user'
      const sanitizedPrefix = userPrefix.toLowerCase().replace(/[^a-z0-9]/g, '-')
      const wsSlug = `${sanitizedPrefix}-workspace`
      const wsName = `Workspace de ${userPrefix.charAt(0).toUpperCase() + userPrefix.slice(1)}`

      const { data: newWs, error: insertError } = await supabase
        .from('workspaces')
        .insert({
          name: wsName,
          slug: wsSlug,
          owner_id: user.id,
          plan_id: planId,
          subscription_status: 'active',
          is_blocked: false
        })
        .select()
        .single()

      if (insertError) {
        // Se der erro por slug repetido, tenta gerar um aleatório
        const randomSuffix = Math.floor(Math.random() * 1000)
        const uniqueSlug = `${wsSlug}-${randomSuffix}`
        const { data: newWsRetry, error: retryError } = await supabase
          .from('workspaces')
          .insert({
            name: wsName,
            slug: uniqueSlug,
            owner_id: user.id,
            plan_id: planId,
            subscription_status: 'active',
            is_blocked: false
          })
          .select()
          .single()

        if (retryError) throw retryError
        finalSlug = newWsRetry.slug
      } else {
        finalSlug = newWs.slug
      }
    } else {
      // Atualizar o plano de TODOS os workspaces dele
      const { error: updateError } = await supabase
        .from('workspaces')
        .update({
          plan_id: planId,
          subscription_status: 'active',
          is_blocked: false
        })
        .eq('owner_id', user.id)

      if (updateError) throw updateError
      finalSlug = workspaces[0].slug
    }

    // Revalidar rotas pertinentes
    revalidatePath('/workspace')
    revalidatePath(`/admin/${finalSlug}`)
    revalidatePath('/admin/platform')

    return { success: true, workspaceSlug: finalSlug }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function getOrCreateDefaultWorkspace(workspaceSlug?: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Usuário não autenticado' }
    }

    // 1. If a workspace slug is specified, try to find that specific workspace owned by the user
    if (workspaceSlug) {
      const { data: ws, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('slug', workspaceSlug)
        .eq('owner_id', user.id)
        .maybeSingle()

      if (!wsError && ws) {
        return { success: true, workspace: ws }
      }
    }

    // 2. Otherwise, check if the user already has any workspace
    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id)

    if (wsError) throw wsError

    if (workspaces && workspaces.length > 0) {
      return { success: true, workspace: workspaces[0] }
    }

    // 3. Create default workspace with pending subscription status
    const userPrefix = user.email ? user.email.split('@')[0] : 'user'
    const sanitizedPrefix = userPrefix.toLowerCase().replace(/[^a-z0-9]/g, '-')
    const wsSlug = `${sanitizedPrefix}-workspace`
    const wsName = `Workspace de ${userPrefix.charAt(0).toUpperCase() + userPrefix.slice(1)}`

    const { data: newWs, error: insertError } = await supabase
      .from('workspaces')
      .insert({
        name: wsName,
        slug: wsSlug,
        owner_id: user.id,
        subscription_status: 'pending',
        is_blocked: true
      })
      .select()
      .single()

    if (insertError) {
      const randomSuffix = Math.floor(Math.random() * 1000)
      const uniqueSlug = `${wsSlug}-${randomSuffix}`
      const { data: newWsRetry, error: retryError } = await supabase
        .from('workspaces')
        .insert({
          name: wsName,
          slug: uniqueSlug,
          owner_id: user.id,
          subscription_status: 'pending',
          is_blocked: true
        })
        .select()
        .single()

      if (retryError) throw retryError
      return { success: true, workspace: newWsRetry }
    }

    return { success: true, workspace: newWs }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

