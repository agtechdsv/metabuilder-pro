'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import type { IClubRule, IClubReferral, IClubReward } from '@/lib/iclub'
import { iclubCountedLicenses, referralPercentTotal } from '../../../supabase/functions/_shared/pricing'

// Helper to check super admin authorization
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

// 1. Fetch Owner iClub Data
export async function getIClubDashboardData() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado')

    // Fetch user's profile to get referral code
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, referral_code, subscription_licenses, campaign_id, campaign_percent, campaign_months, campaign_licenses, campaign_months_used')
      .eq('id', user.id)
      .single()

    if (!profile) throw new Error('Perfil não encontrado')

    // Fetch active rules
    const { data: rules } = await supabase
      .from('iclub_rules')
      .select('*')
      .eq('is_active', true)
      .order('benefit_type', { ascending: true })

    // Fetch referrals
    const { data: referralsData } = await supabase
      .from('iclub_referrals')
      .select('id, referrer_id, referred_id, referred_email, status, created_at')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false })

    // Hydrate referrals with names if they signed up
    const referrals: IClubReferral[] = []
    if (referralsData && referralsData.length > 0) {
      const referredIds = referralsData.filter(r => r.referred_id).map(r => r.referred_id) as string[]
      
      let profilesMap: Record<string, string> = {}
      if (referredIds.length > 0) {
        const { data: referredProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', referredIds)
        
        if (referredProfiles) {
          profilesMap = referredProfiles.reduce((acc, p) => {
            acc[p.id] = p.full_name || ''
            return acc
          }, {} as Record<string, string>)
        }
      }

      referralsData.forEach(r => {
        referrals.push({
          ...r,
          referred_name: r.referred_id ? (profilesMap[r.referred_id] || null) : null
        } as IClubReferral)
      })
    }

    // Fetch rewards
    const { data: rewards } = await supabase
      .from('iclub_rewards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // as licenças da campanha só contam para as "12 licenças" depois dos meses da campanha
    const campaign = profile.campaign_id && Number(profile.campaign_months) > 0
      ? { percent: Number(profile.campaign_percent) || 50, months: Number(profile.campaign_months), licenses: Number(profile.campaign_licenses) || Number(profile.subscription_licenses) || 1 }
      : null
    const countedLicenses = iclubCountedLicenses(Number(profile.subscription_licenses) || 1, campaign, Number(profile.campaign_months_used) || 0)

    // teto do desconto de indicação (definido pelo SuperAdmin) e o desconto que vale agora
    const { data: capRow } = await supabase.from('platform_settings').select('value').eq('key', 'iclub_referral_cap_percent').maybeSingle()
    const capPercent = Number.isFinite(Number((capRow?.value as any)?.percent)) ? Number((capRow?.value as any).percent) : 30
    const activeDiscountPercent = referralPercentTotal(((rewards || []) as any[]).filter(r => r.reward_type === 'percent_discount'), capPercent)

    return {
      success: true,
      referralCode: profile.referral_code,
      rules: (rules || []) as IClubRule[],
      referrals: referrals as IClubReferral[],
      rewards: (rewards || []) as IClubReward[],
      countedLicenses,
      capPercent,
      activeDiscountPercent
    }
  } catch (err: any) {
    console.error('Error fetching iClub dashboard data:', err)
    return { success: false, error: err.message }
  }
}

// 2. Fetch Admin Rules List
export async function getIClubAdminRules() {
  try {
    const { adminSupabase } = await checkSuperAdmin()
    
    const { data: rules } = await adminSupabase
      .from('iclub_rules')
      .select('*')
      .order('created_at', { ascending: false })

    return {
      success: true,
      rules: (rules || []) as IClubRule[]
    }
  } catch (err: any) {
    console.error('Error fetching iClub admin rules:', err)
    return { success: false, error: err.message }
  }
}

// 3. Save / Update Admin Rule
export async function saveIClubAdminRule(rule: Partial<IClubRule>) {
  try {
    const { adminSupabase } = await checkSuperAdmin()

    let namePayload: any = rule.name
    if (typeof namePayload === 'string') {
      try {
        namePayload = JSON.parse(namePayload)
      } catch {
        namePayload = { pt: rule.name, en: rule.name, es: rule.name }
      }
    } else if (typeof namePayload === 'object' && namePayload !== null) {
      namePayload = {
        pt: namePayload.pt || namePayload.en || namePayload.es || '',
        en: namePayload.en || namePayload.pt || namePayload.es || '',
        es: namePayload.es || namePayload.pt || namePayload.en || ''
      }
    }

    const ruleData = {
      name: namePayload,
      benefit_type: rule.benefit_type,
      target_count: rule.target_count,
      reward_type: rule.reward_type,
      reward_value: rule.reward_value,
      is_active: rule.is_active ?? true
    }

    let error
    if (rule.id) {
      const { error: err } = await adminSupabase
        .from('iclub_rules')
        .update(ruleData)
        .eq('id', rule.id)
      error = err
    } else {
      const { error: err } = await adminSupabase
        .from('iclub_rules')
        .insert(ruleData)
      error = err
    }

    if (error) {
      console.error('Erro ao salvar regra do iClub:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/platform')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// 4. Delete Admin Rule
export async function deleteIClubAdminRule(ruleId: string) {
  try {
    const { adminSupabase } = await checkSuperAdmin()

    const { error } = await adminSupabase
      .from('iclub_rules')
      .delete()
      .eq('id', ruleId)

    if (error) {
      console.error('Erro ao deletar regra do iClub:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/platform')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Indicação por código de PARCEIRO (tabela partners). Devolve null se o código não for de nenhum parceiro ativo (aí vale o iClub).
 * Um e-mail só tem um parceiro; o parceiro não pode indicar a si mesmo.
 */
async function registerPartnerReferral(
  adminSupabase: ReturnType<typeof createAdminClient>,
  refCode: string,
  referredEmail: string,
  referredId?: string
): Promise<{ success: boolean; error?: string; message?: string } | null> {
  const { data: partner } = await adminSupabase.from('partners').select('id, user_id, status').eq('code', refCode.trim().toUpperCase()).maybeSingle()
  if (!partner || partner.status !== 'active') return null

  const email = referredEmail.trim().toLowerCase()
  const { data: partnerProfile } = await adminSupabase.from('profiles').select('email').eq('id', partner.user_id).maybeSingle()
  if ((referredId && partner.user_id === referredId) || (partnerProfile?.email && partnerProfile.email.toLowerCase() === email)) {
    return { success: false, error: 'Auto-indicação não permitida.' }
  }

  const { data: existing } = await adminSupabase.from('partner_referrals').select('id').ilike('referred_email', email).maybeSingle()
  if (existing) return { success: true, message: 'Indicação já existia.' }

  let validReferredId: string | null = null
  if (referredId) {
    const { data: p } = await adminSupabase.from('profiles').select('id').eq('id', referredId).maybeSingle()
    if (p) validReferredId = referredId
  }
  if (!validReferredId) {
    const { data: p } = await adminSupabase.from('profiles').select('id').ilike('email', email).maybeSingle()
    if (p) validReferredId = p.id
  }

  const { error } = await adminSupabase.from('partner_referrals').insert({ partner_id: partner.id, referred_id: validReferredId, referred_email: email, status: 'registered' })
  if (error) {
    console.error('Erro ao registrar indicação de parceiro:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// 5. Register Referral from Cookie
export async function registerReferral(referredEmail: string, referredId?: string) {
  try {
    const cookieStore = await cookies()
    const refCode = cookieStore.get('iclub_ref_code')?.value

    if (!refCode) {
      return { success: false, error: 'Sem código de indicação no cookie.' }
    }

    const adminSupabase = createAdminClient()

    // o código pode ser de um PARCEIRO (programa de comissão): tem prioridade, e o cliente indicado continua livre para indicar pelo iClub depois
    const partnerResult = await registerPartnerReferral(adminSupabase, refCode, referredEmail, referredId)
    if (partnerResult) {
      cookieStore.set('iclub_ref_code', '', { maxAge: 0 })
      return partnerResult
    }

    // Buscar o padrinho (referrer) pelo referral_code
    const { data: referrer, error: refError } = await adminSupabase
      .from('profiles')
      .select('id, email')
      .eq('referral_code', refCode.trim())
      .maybeSingle()

    if (refError || !referrer) {
      console.warn(`Código de indicação ${refCode} não encontrado nos perfis.`)
      return { success: false, error: 'Padrinho não encontrado.' }
    }

    // Evitar auto-indicação
    if (referredId && referrer.id === referredId) {
      console.warn('Auto-indicação não é permitida.')
      return { success: false, error: 'Auto-indicação não permitida.' }
    }
    if (referrer.email?.toLowerCase() === referredEmail.toLowerCase()) {
      console.warn('Auto-indicação por e-mail não é permitida.')
      return { success: false, error: 'Auto-indicação não permitida.' }
    }

    // Verificar se já existe uma indicação para este e-mail
    const { data: existingReferral } = await adminSupabase
      .from('iclub_referrals')
      .select('id')
      .eq('referred_email', referredEmail.toLowerCase())
      .maybeSingle()

    if (existingReferral) {
      console.log(`Indicação já registrada para o e-mail: ${referredEmail}`)
      // Remove o cookie para não tentar novamente
      cookieStore.set('iclub_ref_code', '', { maxAge: 0 })
      return { success: true, message: 'Indicação já existia.' }
    }

    // Verificar se o profile existe para associar referred_id
    let validReferredId: string | null = null
    if (referredId) {
      const { data: profileCheck } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('id', referredId)
        .maybeSingle()
      if (profileCheck) {
        validReferredId = referredId
      }
    }

    if (!validReferredId && referredEmail) {
      const { data: profileCheckEmail } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('email', referredEmail.toLowerCase())
        .maybeSingle()
      if (profileCheckEmail) {
        validReferredId = profileCheckEmail.id
      }
    }

    // Registrar a indicação com status 'registered'
    const { error: insertError } = await adminSupabase
      .from('iclub_referrals')
      .insert({
        referrer_id: referrer.id,
        referred_id: validReferredId,
        referred_email: referredEmail.toLowerCase(),
        status: 'registered'
      })

    if (insertError) {
      console.error('Erro ao registrar indicação no banco:', insertError)
      return { success: false, error: insertError.message }
    }

    // Excluir o cookie após registro com sucesso
    cookieStore.set('iclub_ref_code', '', { maxAge: 0 })
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao registrar indicação:', err)
    return { success: false, error: err.message }
  }
}

