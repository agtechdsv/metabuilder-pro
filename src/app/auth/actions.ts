'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    let friendlyMessage = error.message
    if (error.message === 'Invalid login credentials') {
      friendlyMessage = 'Usuário ou senha inválidos.'
    }
    return { error: friendlyMessage }
  }

  // -- MFA Verification --
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
    const totpFactor = factors?.totp?.find(f => f.status === 'verified')

    if (totpFactor) {
      // O usuário já configurou o MFA, redirecionar para a tela de desafio
      return { mfaChallengeRequired: true, factorId: totpFactor.id }
    } else {
      // Verifica se a política exige MFA
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      
      if (profile?.enforce_mfa === true) {
        return { mfaSetupRequired: true }
      }

      // Se for convidado, checa a política do Owner
      const { data: guestRecord } = await supabase.from('owner_guests').select('owner_id').eq('user_id', user.id).limit(1).maybeSingle()
      if (guestRecord?.owner_id) {
        const { data: ownerProfile } = await supabase.from('profiles').select('*').eq('id', guestRecord.owner_id).single()
        if (ownerProfile?.enforce_mfa === true) {
          return { mfaSetupRequired: true }
        }
      }
    }
  }

  return { success: true }
}

export async function updateEnforceMfa(enforceMfa: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const { error } = await supabase
    .from('profiles')
    .update({ enforce_mfa: enforceMfa, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    console.error('Erro ao atualizar enforce_mfa:', error)
    return { error: error.message }
  }

  return { success: true }
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const displayName = formData.get('display_name') as string

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: displayName,
      }
    }
  })

  if (error) {
    return { error: error.message }
  }

  // Se o cadastro foi realizado com sucesso, registra a indicação
  if (data?.user) {
    try {
      const { registerReferral } = await import('@/app/actions/iclub')
      await registerReferral(email, data.user.id)
    } catch (refError) {
      console.error('Erro ao registrar indicação no cadastro:', refError)
    }
  }

  return { success: true }
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  
  // No ambiente local usamos localhost, em produção você usará a sua URL oficial
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
      queryParams: {
        prompt: 'select_account',
      }
    },
  })

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  if (data.url) {
    return redirect(data.url)
  }
}

export async function updateAvatar(formData: FormData) {
  const supabase = await createClient()
  const file = formData.get('avatar') as File
  
  if (!file) return
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const fileExt = file.name.split('.').pop()
  const fileName = `${user.id}-${Math.random()}.${fileExt}`
  const filePath = `avatars/${fileName}`

  // 1. Upload da imagem para o bucket 'community'
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('community')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    })

  if (uploadError) {
    console.error('DETALHE ERRO UPLOAD:', uploadError)
    throw new Error(`Erro no upload: ${uploadError.message}`)
  }

  // 2. Pegar a URL pública da imagem
  const { data: { publicUrl } } = supabase.storage
    .from('community')
    .getPublicUrl(filePath)

  // Adicionamos um timestamp para evitar cache do navegador ao trocar a foto
  const timestampUrl = `${publicUrl}?t=${Date.now()}`

  // 3. Atualizar o avatar_url na tabela public.profiles
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ 
      avatar_url: timestampUrl,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id)

  if (updateError) {
    console.error('DETALHE ERRO PROFILES:', updateError)
    throw new Error(`Erro ao atualizar perfil: ${updateError.message}`)
  }

  return timestampUrl
}

export async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('Erro ao buscar perfil:', error)
    return null
  }

  return data
}

export async function resetAvatar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Pegamos a foto original do metadados (Google) para restaurar no perfil
  const originalPicture = user.user_metadata?.picture || user.user_metadata?.avatar_url

  // Restaura o avatar_url na tabela profiles
  const { error } = await supabase
    .from('profiles')
    .update({ 
      avatar_url: originalPicture,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id)

  if (error) {
    console.error('Erro ao restaurar avatar:', error.message)
    return
  }

  return true
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const updates = {
    full_name: formData.get('full_name') as string,
    whatsapp: formData.get('whatsapp') as string,
    company_name: formData.get('company_name') as string,
    cnpj: formData.get('cnpj') as string,
    address_zip: formData.get('address_zip') as string,
    address_street: formData.get('address_street') as string,
    address_number: formData.get('address_number') as string,
    address_complement: formData.get('address_complement') as string,
    address_neighborhood: formData.get('address_neighborhood') as string,
    address_city: formData.get('address_city') as string,
    address_state: formData.get('address_state') as string,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) {
    console.error('Erro ao atualizar perfil:', error)
    return { error: error.message }
  }

  return { success: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function getPostLoginRedirectPath(userId: string): Promise<string> {
  const supabase = await createClient()

  try {
    // 1. Fetch profile to check if is_super_admin or has subscription licenses
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin, subscription_licenses, subscription_status')
      .eq('id', userId)
      .single()

    if (profile?.is_super_admin) {
      return '/admin/platform'
    }

    // 2. Check if they are a guest (in owner_guests)
    const { data: guestRecord } = await supabase
      .from('owner_guests')
      .select('access_level')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (guestRecord) {
      if (guestRecord.access_level === 'global') {
        return '/workspace'
      } else {
        // access_level === 'granular'
        const { data: memberships } = await supabase
          .from('workspace_members')
          .select('workspace_id, workspaces(slug)')
          .eq('user_id', userId)

        const validMemberships = memberships?.filter((m: any) => m.workspaces?.slug) || []

        if (validMemberships.length === 1) {
          const slug = (validMemberships[0]?.workspaces as any)?.slug
          if (slug) {
            return `/admin/${slug}`
          }
        }
        return '/workspace'
      }
    }

    // 3. User is an Owner (not super admin, not guest)
    if (profile?.subscription_licenses && profile.subscription_licenses > 0 && profile?.subscription_status === 'active') {
      return '/client/dashboard'
    }
  } catch (err) {
    console.error('Error determining post-login redirect path:', err)
  }

  return '/checkout'
}

