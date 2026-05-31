'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'


export interface IClubRule {
  id?: string
  name: string
  benefit_type: 'volume_license' | 'referral_discount'
  target_count: number
  reward_type: 'free_license' | 'percent_discount'
  reward_value: number
  is_active: boolean
  created_at?: string
}

export interface IClubReferral {
  id: string
  referrer_id: string
  referred_id: string | null
  referred_email: string
  status: 'registered' | 'subscribed' | 'reward_applied'
  created_at: string
  referred_name?: string | null
}

export interface IClubReward {
  id: string
  user_id: string
  reward_type: 'free_license' | 'percent_discount'
  reward_value: number
  status: 'active' | 'applied' | 'expired'
  notes: string | null
  created_at: string
}

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
      .select('id, referral_code')
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

    return {
      success: true,
      referralCode: profile.referral_code,
      rules: (rules || []) as IClubRule[],
      referrals: referrals as IClubReferral[],
      rewards: (rewards || []) as IClubReward[]
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

    const ruleData = {
      name: rule.name,
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

// 5. Register Referral from Cookie
export async function registerReferral(referredEmail: string, referredId?: string) {
  try {
    const cookieStore = await cookies()
    const refCode = cookieStore.get('iclub_ref_code')?.value

    if (!refCode) {
      return { success: false, error: 'Sem código de indicação no cookie.' }
    }

    const adminSupabase = createAdminClient()

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

