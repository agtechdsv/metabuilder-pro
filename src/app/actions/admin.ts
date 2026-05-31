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

// Removidos savePlan e deletePlan legados

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

export async function toggleClientBlock(profileId: string, isBlocked: boolean) {
  try {
    const { adminSupabase } = await checkSuperAdmin()

    // 1. Block Profile
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .update({
        is_blocked: isBlocked,
        subscription_status: isBlocked ? 'blocked' : 'active'
      })
      .eq('id', profileId)

    if (profileError) throw profileError

    // 2. Block all their workspaces
    const { error: wsError } = await adminSupabase
      .from('workspaces')
      .update({
        is_blocked: isBlocked
      })
      .eq('owner_id', profileId)

    if (wsError) throw wsError

    revalidatePath('/admin/platform')
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao alternar bloqueio de cliente:', err)
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

export async function deleteClientAdmin(profileId: string) {
  try {
    const { adminSupabase } = await checkSuperAdmin()

    // 0. Encontrar convidados deste owner e excluí-los (cascade delete em perfis, acessos, etc)
    const { data: guests } = await adminSupabase
      .from('owner_guests')
      .select('user_id')
      .eq('owner_id', profileId)

    if (guests && guests.length > 0) {
      for (const guest of guests) {
        if (guest.user_id) {
          await adminSupabase.auth.admin.deleteUser(guest.user_id)
        }
      }
    }

    // 1. Delete owner from auth.users (triggers cascade deletes on profiles, workspaces, etc.)
    const { error: authError } = await adminSupabase.auth.admin.deleteUser(profileId)
    if (authError) {
      console.error('Erro ao deletar usuário do auth:', authError)
      return { success: false, error: authError.message }
    }

    // 2. Direct database delete for profile as backup
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .delete()
      .eq('id', profileId)

    revalidatePath('/admin/platform')
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao excluir cliente:', err)
    return { success: false, error: err.message }
  }
}

// --- Pricing Rules Actions ---

export async function getPricingRules() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('pricing_rules')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar regras de precificação:', error)
      return { success: false, error: error.message }
    }
    
    return { success: true, rules: data }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function savePricingRules(rules: {
  base_price: number
  volume_tiers: any[]
  cycle_discounts: any
}) {
  try {
    const { adminSupabase } = await checkSuperAdmin()

    // check if exists
    const { data: existing } = await adminSupabase
      .from('pricing_rules')
      .select('id')
      .limit(1)

    let error;
    if (existing && existing.length > 0) {
      const { error: updateError } = await adminSupabase
        .from('pricing_rules')
        .update({
          base_price: rules.base_price,
          volume_tiers: rules.volume_tiers,
          cycle_discounts: rules.cycle_discounts,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing[0].id)
      error = updateError
    } else {
      const { error: insertError } = await adminSupabase
        .from('pricing_rules')
        .insert({
          base_price: rules.base_price,
          volume_tiers: rules.volume_tiers,
          cycle_discounts: rules.cycle_discounts
        })
      error = insertError
    }

    if (error) {
      console.error('Erro ao salvar regras de precificação:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/')
    revalidatePath('/checkout')
    revalidatePath('/admin/platform')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
