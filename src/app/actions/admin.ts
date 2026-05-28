'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// Helper to check if the current user is a super admin
async function checkSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_super_admin) {
    throw new Error('Acesso negado: Apenas administradores globais podem realizar esta ação.')
  }

  const adminSupabase = createAdminClient()
  return { supabase, adminSupabase, user }
}

export async function savePlan(plan: {
  id?: string
  name: string
  licenses_count: number
  price: number
  price_monthly?: number
  price_quarterly?: number
  price_semiannually?: number
  price_yearly?: number
  description: string
  features: string[]
  is_active: boolean
}) {
  try {
    const { adminSupabase } = await checkSuperAdmin()

    const planData = {
      name: plan.name,
      licenses_count: plan.licenses_count,
      price: plan.price,
      price_monthly: plan.price_monthly ?? plan.price,
      price_quarterly: plan.price_quarterly,
      price_semiannually: plan.price_semiannually,
      price_yearly: plan.price_yearly,
      description: plan.description,
      features: plan.features,
      is_active: plan.is_active
    }

    let error
    if (plan.id) {
      // Update
      const { error: err } = await adminSupabase
        .from('subscription_plans')
        .update(planData)
        .eq('id', plan.id)
      error = err
    } else {
      // Insert
      const { error: err } = await adminSupabase
        .from('subscription_plans')
        .insert(planData)
      error = err
    }

    if (error) {
      console.error('Erro ao salvar plano:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/')
    revalidatePath('/admin/platform')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function deletePlan(planId: string) {
  try {
    const { adminSupabase } = await checkSuperAdmin()

    const { error } = await adminSupabase
      .from('subscription_plans')
      .delete()
      .eq('id', planId)

    if (error) {
      console.error('Erro ao deletar plano:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/')
    revalidatePath('/admin/platform')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function toggleWorkspaceBlock(workspaceId: string, isBlocked: boolean) {
  try {
    const { adminSupabase } = await checkSuperAdmin()

    const { error } = await adminSupabase
      .from('workspaces')
      .update({
        is_blocked: isBlocked
      })
      .eq('id', workspaceId)

    if (error) {
      console.error('Erro ao alternar bloqueio de workspace:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/platform')
    revalidatePath(`/admin/${workspaceId}`) // revalidate paths associated
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function toggleUserCommunityBlock(userId: string, isBlocked: boolean) {
  try {
    const { adminSupabase } = await checkSuperAdmin()

    const { error } = await adminSupabase
      .from('profiles')
      .update({
        is_blocked_community: isBlocked
      })
      .eq('id', userId)

    if (error) throw error

    revalidatePath('/admin/platform')
    revalidatePath('/client/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao alternar bloqueio de comunidade do usuário:', err)
    return { success: false, error: err.message }
  }
}

export async function toggleUserMetaVoiceBlock(userId: string, isBlocked: boolean) {
  try {
    const { adminSupabase } = await checkSuperAdmin()

    const { error } = await adminSupabase
      .from('profiles')
      .update({
        is_blocked_metavoice: isBlocked
      })
      .eq('id', userId)

    if (error) throw error

    revalidatePath('/admin/platform')
    revalidatePath('/client/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao alternar bloqueio de MetaVoice do usuário:', err)
    return { success: false, error: err.message }
  }
}

export async function toggleCommunityPostHide(postId: string, isHidden: boolean) {
  try {
    const { adminSupabase } = await checkSuperAdmin()

    const { error } = await adminSupabase
      .from('community_posts')
      .update({
        is_hidden: isHidden
      })
      .eq('id', postId)

    if (error) throw error

    revalidatePath('/admin/platform')
    revalidatePath('/client/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao alternar ocultação de post da comunidade:', err)
    return { success: false, error: err.message }
  }
}

export async function deleteCommunityPostAdmin(postId: string) {
  try {
    const { adminSupabase } = await checkSuperAdmin()

    const { error } = await adminSupabase
      .from('community_posts')
      .delete()
      .eq('id', postId)

    if (error) throw error

    revalidatePath('/admin/platform')
    revalidatePath('/client/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao deletar post da comunidade:', err)
    return { success: false, error: err.message }
  }
}

export async function toggleCommunityCommentHide(commentId: string, isHidden: boolean) {
  try {
    const { adminSupabase } = await checkSuperAdmin()

    const { error } = await adminSupabase
      .from('community_comments')
      .update({
        is_hidden: isHidden
      })
      .eq('id', commentId)

    if (error) throw error

    revalidatePath('/admin/platform')
    revalidatePath('/client/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao alternar ocultação de comentário da comunidade:', err)
    return { success: false, error: err.message }
  }
}

export async function deleteCommunityCommentAdmin(commentId: string) {
  try {
    const { adminSupabase } = await checkSuperAdmin()

    const { error } = await adminSupabase
      .from('community_comments')
      .delete()
      .eq('id', commentId)

    if (error) throw error

    revalidatePath('/admin/platform')
    revalidatePath('/client/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao deletar comentário da comunidade:', err)
    return { success: false, error: err.message }
  }
}

export async function toggleSuggestionHide(suggestionId: string, isHidden: boolean) {
  try {
    const { adminSupabase } = await checkSuperAdmin()

    const { error } = await adminSupabase
      .from('suggestions')
      .update({
        is_hidden: isHidden
      })
      .eq('id', suggestionId)

    if (error) throw error

    revalidatePath('/admin/platform')
    revalidatePath('/client/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao alternar ocultação de sugestão:', err)
    return { success: false, error: err.message }
  }
}

export async function deleteSuggestionAdmin(suggestionId: string) {
  try {
    const { adminSupabase } = await checkSuperAdmin()

    const { error } = await adminSupabase
      .from('suggestions')
      .delete()
      .eq('id', suggestionId)

    if (error) throw error

    revalidatePath('/admin/platform')
    revalidatePath('/client/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao deletar sugestão:', err)
    return { success: false, error: err.message }
  }
}

