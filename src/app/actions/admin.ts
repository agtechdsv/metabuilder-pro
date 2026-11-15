'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { clampTrashHours, MIN_TRASH_HOURS, MAX_TRASH_HOURS } from '@/lib/trash/trash'
import { billingFunctionUrl, readBillingResponse, type BillingInspection, type BillingPurpose, type BillingResult } from '@/lib/admin/billingCancel'

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

/** Pede à Edge Function `admin-cancel-billing` (que guarda a chave do Asaas) para ver ou cancelar a cobrança de um cliente. Usa a sessão do SuperAdmin. */
async function callBillingFunction(supabase: Awaited<ReturnType<typeof createClient>>, body: { userId: string; mode: 'inspect' | 'cancel'; purpose?: BillingPurpose }): Promise<BillingResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return { ok: false, error: 'Sessão expirada. Entre de novo e repita.' }
  try {
    const res = await fetch(billingFunctionUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const json = await res.json().catch(() => ({}))
    return readBillingResponse(res.status, json)
  } catch (err: any) {
    return { ok: false, error: `Não foi possível falar com o Asaas agora: ${err?.message || 'falha de rede'}` }
  }
}

/** O que seria cancelado no Asaas para este cliente (assinatura e cobranças abertas), para o modal avisar antes de confirmar. */
export async function inspectClientBilling(profileId: string): Promise<{ success: boolean; info?: BillingInspection; error?: string }> {
  try {
    const { supabase } = await checkSuperAdmin()
    const r = await callBillingFunction(supabase, { userId: profileId, mode: 'inspect' })
    return r.ok ? { success: true, info: r.info } : { success: false, error: r.error }
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

/**
 * Bloqueia ou desbloqueia o cliente. `cancelBilling` (só ao bloquear, e só quando o SuperAdmin marcou) cancela antes a assinatura e as cobranças
 * abertas no Asaas; se o Asaas falhar, NÃO bloqueia (para não parecer bloqueado e continuar cobrando).
 */
export async function toggleClientBlock(profileId: string, isBlocked: boolean, cancelBilling = false) {
  try {
    const { supabase, adminSupabase } = await checkSuperAdmin()

    if (isBlocked && cancelBilling) {
      const r = await callBillingFunction(supabase, { userId: profileId, mode: 'cancel', purpose: 'block' })
      if (!r.ok) return { success: false, error: r.error }
    }

    // 1. Block Profile
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .update({
        is_blocked: isBlocked,
        subscription_status: isBlocked ? 'blocked' : 'active'
      })
      .eq('id', profileId)

    if (profileError) throw profileError

    // 2. Workspaces are now blocked implicitly because billing/blocking is at profile level
    
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
    const { supabase, adminSupabase } = await checkSuperAdmin()

    // 0a. Quem é parceiro não pode ser excluído (o banco recusa): avisa antes de mexer em qualquer coisa
    // (vale também para os convidados do cliente, que seriam excluídos junto)
    const { data: guestRows } = await adminSupabase.from('owner_guests').select('user_id').eq('owner_id', profileId)
    const affectedIds = [profileId, ...(guestRows ?? []).map((g: any) => g.user_id).filter(Boolean)]
    const { data: asPartner } = await adminSupabase.from('partners').select('code').in('user_id', affectedIds).limit(1).maybeSingle()
    if (asPartner) {
      return { success: false, error: `Este cliente (ou um convidado dele) também é parceiro (código ${asPartner.code}). Exclua ou arquive o parceiro antes de excluir o cliente.` }
    }

    // 0b. Cobrança no Asaas: cancela a assinatura e as cobranças abertas ANTES de apagar. Se o Asaas falhar, não exclui
    // (excluir primeiro deixaria a assinatura cobrando um cliente que não existe mais).
    const { data: billing } = await adminSupabase.from('profiles').select('asaas_customer_id, asaas_subscription_id').eq('id', profileId).maybeSingle()
    if (billing?.asaas_customer_id || billing?.asaas_subscription_id) {
      const r = await callBillingFunction(supabase, { userId: profileId, mode: 'cancel', purpose: 'delete' })
      if (!r.ok) return { success: false, error: `Nada foi excluído. ${r.error}` }
    }

    // 0. Encontrar convidados deste owner
    const { data: guests } = await adminSupabase
      .from('owner_guests')
      .select('user_id')
      .eq('owner_id', profileId)

    // Build list of all user IDs that will be deleted (owner + guests)
    const usersToDelete = [profileId]
    if (guests && guests.length > 0) {
      for (const guest of guests) {
        if (guest.user_id) usersToDelete.push(guest.user_id)
      }
    }

    // Limpeza de tabelas que referenciam auth.users mas não possuem ON DELETE CASCADE:
    // Ex: agent_tasks.created_by
    for (const userId of usersToDelete) {
      await adminSupabase.from('agent_tasks').delete().eq('created_by', userId)
    }

    // 1. Deletar os convidados
    if (guests && guests.length > 0) {
      for (const guest of guests) {
        if (guest.user_id) {
          await adminSupabase.auth.admin.deleteUser(guest.user_id)
        }
      }
    }

    // 2. Delete owner from auth.users (triggers cascade deletes on profiles, workspaces, etc.)
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

// ---- Campanhas de preço (Black November...) e ajustes do iClub: só o SuperAdmin ----

export interface CampaignInput {
  id?: string
  name: { pt: string; en: string; es: string }
  headline: { pt: string; en: string; es: string }
  discount_percent: number
  months: number
  starts_at: string
  ends_at: string
  is_active: boolean
  allowed_emails: string[]
}

export async function listCampaigns() {
  try {
    const { adminSupabase } = await checkSuperAdmin()
    const { data, error } = await adminSupabase.from('pricing_campaigns').select('*').order('created_at', { ascending: false })
    if (error) return { success: false, error: error.message }
    return { success: true, campaigns: data || [] }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function saveCampaign(input: CampaignInput) {
  try {
    const { adminSupabase } = await checkSuperAdmin()
    const percent = Number(input.discount_percent)
    const months = Math.round(Number(input.months))
    const starts = new Date(input.starts_at)
    const ends = new Date(input.ends_at)
    if (!input.name?.pt?.trim()) return { success: false, error: 'Dê um nome em português à campanha.' }
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return { success: false, error: 'O % cobrado da tabela deve ficar entre 1 e 100 (50 = metade do preço).' }
    if (!Number.isFinite(months) || months < 1 || months > 36) return { success: false, error: 'Os meses da campanha devem ficar entre 1 e 36.' }
    if (isNaN(starts.getTime()) || isNaN(ends.getTime()) || ends <= starts) return { success: false, error: 'A data de fim deve ser depois da data de início.' }

    const row = {
      name: { pt: input.name.pt.trim(), en: (input.name.en || input.name.pt).trim(), es: (input.name.es || input.name.pt).trim() },
      headline: { pt: (input.headline?.pt || '').trim(), en: (input.headline?.en || input.headline?.pt || '').trim(), es: (input.headline?.es || input.headline?.pt || '').trim() },
      discount_percent: percent,
      months,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      is_active: !!input.is_active,
      allowed_emails: (input.allowed_emails || []).map(e => e.trim().toLowerCase()).filter(Boolean),
      updated_at: new Date().toISOString(),
    }
    const { error } = input.id
      ? await adminSupabase.from('pricing_campaigns').update(row).eq('id', input.id)
      : await adminSupabase.from('pricing_campaigns').insert(row)
    if (error) return { success: false, error: error.message }
    revalidatePath('/')
    revalidatePath('/checkout')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function deleteCampaign(id: string) {
  try {
    const { adminSupabase } = await checkSuperAdmin()
    const { error } = await adminSupabase.from('pricing_campaigns').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function getIClubSettings() {
  try {
    const { adminSupabase } = await checkSuperAdmin()
    const { data } = await adminSupabase.from('platform_settings').select('key, value').in('key', ['iclub_referral_cap_percent', 'iclub_grace_days'])
    const map = new Map((data || []).map((r: any) => [r.key, r.value]))
    const cap = Number((map.get('iclub_referral_cap_percent') as any)?.percent)
    const grace = Number((map.get('iclub_grace_days') as any)?.days)
    return { success: true, capPercent: Number.isFinite(cap) ? cap : 30, graceDays: Number.isFinite(grace) ? grace : 7 }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function saveIClubSettings(capPercent: number, graceDays: number) {
  try {
    const { adminSupabase, user } = await checkSuperAdmin()
    const cap = Number(capPercent)
    const grace = Math.round(Number(graceDays))
    if (!Number.isFinite(cap) || cap < 0 || cap > 100) return { success: false, error: 'O teto do desconto de indicação deve ficar entre 0 e 100%.' }
    if (!Number.isFinite(grace) || grace < 0 || grace > 60) return { success: false, error: 'A carência deve ficar entre 0 e 60 dias.' }
    const now = new Date().toISOString()
    const { error } = await adminSupabase.from('platform_settings').upsert([
      { key: 'iclub_referral_cap_percent', value: { percent: cap }, updated_at: now, updated_by: user?.id ?? null },
      { key: 'iclub_grace_days', value: { days: grace }, updated_at: now, updated_by: user?.id ?? null },
    ])
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/** Prazo da lixeira (em horas), lido do ajuste global. Só o SuperAdmin lê por aqui; as demais pessoas usam a função mb_trash_retention_hours. */
export async function getTrashRetention() {
  try {
    const { adminSupabase } = await checkSuperAdmin()
    const { data } = await adminSupabase.from('platform_settings').select('value').eq('key', 'trash_retention_hours').maybeSingle()
    return { success: true, hours: clampTrashHours((data?.value as any)?.hours) }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/** Muda o prazo da lixeira. Só o SuperAdmin do MetaBuilder: dono de workspace e desenvolvedor nunca chegam aqui. */
export async function saveTrashRetention(hours: number) {
  try {
    const { adminSupabase, user } = await checkSuperAdmin()
    const h = Math.round(Number(hours))
    if (!Number.isFinite(h) || h < MIN_TRASH_HOURS || h > MAX_TRASH_HOURS) {
      return { success: false, error: `O prazo deve ficar entre ${MIN_TRASH_HOURS} e ${MAX_TRASH_HOURS} horas.` }
    }
    const { error } = await adminSupabase.from('platform_settings').upsert({ key: 'trash_retention_hours', value: { hours: h }, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
    if (error) return { success: false, error: error.message }
    return { success: true, hours: h }
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
