'use server'

import { createClient } from '@supabase/supabase-js'

// Usamos Service Role Key aqui para ter acesso à admin API e contornar RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const isEmailExistsError = (err: any) => {
  if (!err) return false
  const msg = (err.message || '').toLowerCase()
  return (
    err.code === 'email_exists' ||
    msg.includes('already registered') ||
    msg.includes('already exists') ||
    msg.includes('email_exists') ||
    msg.includes('registrado') ||
    msg.includes('existe')
  )
}

export async function inviteWorkspaceMember(workspaceId: string, workspaceSlug: string, email: string, role: string) {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const redirectUrl = `${siteUrl}/auth/set-password?workspace_slug=${workspaceSlug}`

    // 0. Buscar o dono do workspace e seus limites
    const { data: workspaceData, error: wsError } = await supabaseAdmin
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single()
      
    if (wsError || !workspaceData) throw new Error('Workspace não encontrado.')
    const ownerId = workspaceData.owner_id

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('plan_id, subscription_status, is_super_admin, subscription_plans(licenses_count)')
      .eq('id', ownerId)
      .single()

    if (profileError || !profileData) throw new Error('Perfil do dono não encontrado.')

    // Se não for super admin e a assinatura não estiver ativa, bloqueia
    if (!profileData.is_super_admin && profileData.subscription_status !== 'active') {
      throw new Error('A assinatura do dono deste workspace não está ativa.')
    }

    // Verificar limites
    let allowedGuests = 0;
    if (profileData.is_super_admin) {
      allowedGuests = 9999;
    } else if (profileData.subscription_plans) {
      // licenses_count inclui o dono. Ex: 5 licenças = 1 dono + 4 convidados.
      const totalLicenses = (profileData.subscription_plans as any).licenses_count || 1;
      allowedGuests = Math.max(0, totalLicenses - 1);
    }

    // 1. Tentar convidar o usuário via Auth do Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectUrl,
      data: {
        invited_workspace_id: workspaceId,
        invited_role: role,
        need_password_setup: true
      }
    })

    if (authError) {
      // Se o usuário já está registrado, nós o associamos diretamente a este workspace específico
      if (isEmailExistsError(authError)) {
        // Busca o perfil na tabela pública profiles pelo email
        const { data: existingProfile, error: profileSearchError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle()

        let userId = existingProfile?.id

        if (!userId) {
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
          const existingUser = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
          if (!existingUser) throw new Error('Usuário não encontrado.')
          userId = existingUser.id
        }

        // Antes de adicionar, verificar se já é guest deste owner
        const { data: existingGuest } = await supabaseAdmin
          .from('owner_guests')
          .select('id')
          .eq('owner_id', ownerId)
          .eq('user_id', userId)
          .maybeSingle()

        if (!existingGuest) {
          // Checar contagem atual
          const { count } = await supabaseAdmin
            .from('owner_guests')
            .select('*', { count: 'exact', head: true })
            .eq('owner_id', ownerId)
          
          if ((count || 0) >= allowedGuests) {
            throw new Error(`Limite do plano atingido. Você pode ter no máximo ${allowedGuests} convidados.`)
          }

          // Inserir em owner_guests
          await supabaseAdmin.from('owner_guests').insert({
            owner_id: ownerId,
            user_id: userId,
            access_level: 'granular'
          })
        }

        // Insere o membro na tabela workspace_members associando-o apenas a este workspace
        const { error: insertError } = await supabaseAdmin.from('workspace_members').insert({
          workspace_id: workspaceId,
          user_id: userId,
          role: role
        })

        if (insertError) {
          if (insertError.message?.includes('duplicate key value') || insertError.code === '23505') {
            return { success: false, error: 'Este usuário já é membro deste Workspace.' }
          }
          throw insertError
        }

        // Auto assign to all projects if role is developer
        if (role === 'developer') {
          const { data: projects } = await supabaseAdmin
            .from('projects')
            .select('id')
            .eq('workspace_id', workspaceId)
            
          if (projects && projects.length > 0) {
            const projectInserts = projects.map(p => ({
              workspace_id: workspaceId,
              user_id: userId,
              project_id: p.id
            }))
            await supabaseAdmin.from('workspace_member_projects').insert(projectInserts)
          }
        }

        return { success: true, message: 'Usuário já cadastrado foi adicionado com sucesso ao Workspace!' }
      }
      throw authError
    }

    if (authData?.user) {
      // Usuário recém-convidado. Verificar contagem antes de inserir
      const { count } = await supabaseAdmin
        .from('owner_guests')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', ownerId)
      
      if ((count || 0) >= allowedGuests) {
        // Como o convite Auth já foi enviado, idealmente cancelaríamos.
        // Por ora, vamos bloquear o acesso via owner_guests
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        throw new Error(`Limite do plano atingido. Você pode ter no máximo ${allowedGuests} convidados.`)
      }

      await supabaseAdmin.from('owner_guests').insert({
        owner_id: ownerId,
        user_id: authData.user.id,
        access_level: 'granular'
      })

      // 2. Inserir na tabela de workspace_members
      const { error: insertError } = await supabaseAdmin.from('workspace_members').insert({
        workspace_id: workspaceId,
        user_id: authData.user.id,
        role: role
      })

      if (insertError) throw insertError

      // Auto assign to all projects if role is developer
      if (role === 'developer') {
        const { data: projects } = await supabaseAdmin
          .from('projects')
          .select('id')
          .eq('workspace_id', workspaceId)
          
        if (projects && projects.length > 0) {
          const projectInserts = projects.map(p => ({
            workspace_id: workspaceId,
            user_id: authData.user.id,
            project_id: p.id
          }))
          await supabaseAdmin.from('workspace_member_projects').insert(projectInserts)
        }
      }

      return { success: true, message: 'Convite enviado com sucesso!' }
    }

    throw new Error('Falha ao processar o convite do usuário.')
  } catch (err: any) {
    if (err.message?.includes('duplicate key value')) {
      return { success: false, error: 'Este usuário já é membro deste Workspace.' }
    }
    return { success: false, error: err.message }
  }
}

export async function removeWorkspaceMember(workspaceId: string, userId: string) {
  try {
    // 0. Pegar owner_id do workspace
    const { data: wsData } = await supabaseAdmin
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single()

    const { error } = await supabaseAdmin
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)

    if (error) throw error

    if (wsData?.owner_id) {
      // 1. Verifica se o usuário pertence a outros workspaces deste MESMO owner
      const { count: countOwnerWs } = await supabaseAdmin
        .from('workspace_members')
        .select('workspaces!inner(owner_id)', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('workspaces.owner_id', wsData.owner_id)

      if (countOwnerWs === 0) {
        // Remove da tabela owner_guests para liberar a licença
        await supabaseAdmin
          .from('owner_guests')
          .delete()
          .eq('owner_id', wsData.owner_id)
          .eq('user_id', userId)
      }
    }

    // 2. Verifica se o usuário pertence a outros workspaces (de qualquer owner)
    const { count, error: countError } = await supabaseAdmin
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // 3. Se ele não pertence a nenhum outro workspace (count === 0), excluímos a conta geral
    if (!countError && count === 0) {
      // Verifica se ele também não é owner_guest de ninguém globalmente
      const { count: guestCount } = await supabaseAdmin
        .from('owner_guests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (guestCount === 0) {
        await supabaseAdmin.from('profiles').delete().eq('id', userId)
        await supabaseAdmin.auth.admin.deleteUser(userId)
      }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function toggleMemberProject(workspaceId: string, userId: string, projectId: string, isAssigned: boolean) {
  try {
    if (isAssigned) {
      const { error } = await supabaseAdmin.from('workspace_member_projects').insert({
        workspace_id: workspaceId,
        user_id: userId,
        project_id: projectId
      })
      if (error && !error.message.includes('duplicate key')) throw error
    } else {
      const { error } = await supabaseAdmin
        .from('workspace_member_projects')
        .delete()
        .match({ user_id: userId, project_id: projectId })
      if (error) throw error
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function getStudioTeamData() {
  try {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado.')

    // Resolve ownerId se for convidado com Acesso Global
    let ownerId = user.id
    const { data: guestRecord } = await supabaseAdmin
      .from('owner_guests')
      .select('owner_id, access_level')
      .eq('user_id', user.id)
      .maybeSingle()
    if (guestRecord?.access_level === 'global') {
      ownerId = guestRecord.owner_id
    }

    // 1. Fetch owner profile & subscription plans to check quotas
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan_id, subscription_status, is_super_admin, subscription_plans(licenses_count)')
      .eq('id', ownerId)
      .single()

    if (!profile) throw new Error('Perfil não encontrado.')

    // 2. Fetch workspaces owned by the current user
    const { data: workspaces } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, slug')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: true })

    const workspaceIds = workspaces?.map(w => w.id) || []

    // 3. Fetch all projects in those workspaces
    let projects: any[] = []
    if (workspaceIds.length > 0) {
      const { data: projectsData } = await supabaseAdmin
        .from('projects')
        .select('id, name, slug, workspace_id')
        .in('workspace_id', workspaceIds)
        .order('name', { ascending: true })
      projects = projectsData || []
    }

    // 4. Fetch all guests of the owner
    const { data: guests, error: guestsError } = await supabaseAdmin
      .from('owner_guests')
      .select('id, user_id, access_level, created_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: true })

    if (guestsError) throw guestsError

    // Fetch details of guest profiles separately
    let guestDetails: any[] = []
    if (guests && guests.length > 0) {
      const guestUserIds = guests.map(g => g.user_id)
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', guestUserIds)

      // Fetch workspace members for these guests across owner workspaces
      let workspaceMemberships: any[] = []
      let projectAssignments: any[] = []

      if (workspaceIds.length > 0) {
        const { data: wsMembers } = await supabaseAdmin
          .from('workspace_members')
          .select('workspace_id, user_id, role, can_create, can_edit, can_delete')
          .in('workspace_id', workspaceIds)
          .in('user_id', guestUserIds)
        workspaceMemberships = wsMembers || []

        const { data: projAssigns } = await supabaseAdmin
          .from('workspace_member_projects')
          .select('workspace_id, user_id, project_id, can_create, can_edit, can_deactivate, can_delete')
          .in('workspace_id', workspaceIds)
          .in('user_id', guestUserIds)
        projectAssignments = projAssigns || []
      }

      guestDetails = guests.map(g => {
        const profileInfo = profiles?.find(p => p.id === g.user_id) || { full_name: 'Desconhecido', email: '' }
        return {
          id: g.id,
          user_id: g.user_id,
          access_level: g.access_level,
          created_at: g.created_at,
          full_name: profileInfo.full_name,
          email: profileInfo.email,
          workspaces: workspaceMemberships.filter(m => m.user_id === g.user_id),
          projects: projectAssignments.filter(p => p.user_id === g.user_id)
        }
      })
    }

    // Allowed guests quota
    let allowedGuests = 0;
    if (profile.is_super_admin) {
      allowedGuests = 9999;
    } else if (profile.subscription_plans) {
      const totalLicenses = (profile.subscription_plans as any).licenses_count || 1;
      allowedGuests = Math.max(0, totalLicenses - 1);
    }

    return {
      success: true,
      data: {
        guests: guestDetails,
        workspaces: workspaces || [],
        projects,
        allowedGuests,
        usedGuests: guests?.length || 0
      }
    }
  } catch (err: any) {
    console.error('Error in getStudioTeamData:', err)
    return { success: false, error: err.message }
  }
}

export async function inviteStudioGuest(email: string) {
  try {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado.')

    // Resolve ownerId se for convidado com Acesso Global
    let ownerId = user.id
    const { data: guestRecord } = await supabaseAdmin
      .from('owner_guests')
      .select('owner_id, access_level')
      .eq('user_id', user.id)
      .maybeSingle()
    if (guestRecord?.access_level === 'global') {
      ownerId = guestRecord.owner_id
    }

    // Fetch limits
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan_id, subscription_status, is_super_admin, subscription_plans(licenses_count)')
      .eq('id', ownerId)
      .single()

    if (!profile) throw new Error('Perfil não encontrado.')

    if (!profile.is_super_admin && profile.subscription_status !== 'active') {
      throw new Error('Sua assinatura não está activa.')
    }

    let allowedGuests = 0;
    if (profile.is_super_admin) {
      allowedGuests = 9999;
    } else if (profile.subscription_plans) {
      const totalLicenses = (profile.subscription_plans as any).licenses_count || 1;
      allowedGuests = Math.max(0, totalLicenses - 1);
    }

    // Check count of current guests
    const { count } = await supabaseAdmin
      .from('owner_guests')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', ownerId)

    if ((count || 0) >= allowedGuests) {
      throw new Error(`Limite do plano atingido. Você pode ter no máximo ${allowedGuests} convidados.`)
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const redirectUrl = `${siteUrl}/auth/set-password`

    // Invite user via auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectUrl,
      data: {
        need_password_setup: true
      }
    })

    if (authError) {
      // If user is already registered, associate them
      if (isEmailExistsError(authError)) {
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle()

        let userId = existingProfile?.id

        if (!userId) {
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
          const existingUser = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
          if (!existingUser) throw new Error('Usuário não encontrado.')
          userId = existingUser.id
        }

        // Check if already guest
        const { data: existingGuest } = await supabaseAdmin
          .from('owner_guests')
          .select('id')
          .eq('owner_id', ownerId)
          .eq('user_id', userId)
          .maybeSingle()

        if (existingGuest) {
          return { success: false, error: 'Este usuário já está na sua equipe.' }
        }

        // Insert into owner_guests
        const { error: insertError } = await supabaseAdmin.from('owner_guests').insert({
          owner_id: ownerId,
          user_id: userId,
          access_level: 'granular'
        })

        if (insertError) throw insertError
        return { success: true, message: 'Usuário já cadastrado foi adicionado com sucesso à sua equipe!' }
      }
      throw authError
    }

    if (authData?.user) {
      const { error: insertError } = await supabaseAdmin.from('owner_guests').insert({
        owner_id: ownerId,
        user_id: authData.user.id,
        access_level: 'granular'
      })

      if (insertError) throw insertError
      return { success: true, message: 'Convite enviado com sucesso!' }
    }

    throw new Error('Falha ao processar convite.')
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function removeStudioGuest(guestUserId: string) {
  try {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado.')

    // Resolve ownerId se for convidado com Acesso Global
    let ownerId = user.id
    const { data: guestRecord } = await supabaseAdmin
      .from('owner_guests')
      .select('owner_id, access_level')
      .eq('user_id', user.id)
      .maybeSingle()
    if (guestRecord?.access_level === 'global') {
      ownerId = guestRecord.owner_id
    }

    // Ensure the caller is the owner or global guest
    const { data: ownerGuest, error: ogError } = await supabaseAdmin
      .from('owner_guests')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('user_id', guestUserId)
      .single()

    if (ogError || !ownerGuest) throw new Error('Não autorizado.')

    // 1. Delete from owner_guests
    await supabaseAdmin
      .from('owner_guests')
      .delete()
      .eq('owner_id', ownerId)
      .eq('user_id', guestUserId)

    // 2. Fetch owner's workspaces
    const { data: ownerWorkspaces } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('owner_id', ownerId)

    const ownerWorkspaceIds = ownerWorkspaces?.map(w => w.id) || []

    if (ownerWorkspaceIds.length > 0) {
      // Delete from workspace_members
      await supabaseAdmin
        .from('workspace_members')
        .delete()
        .eq('user_id', guestUserId)
        .in('workspace_id', ownerWorkspaceIds)

      // Delete from workspace_member_projects
      await supabaseAdmin
        .from('workspace_member_projects')
        .delete()
        .eq('user_id', guestUserId)
        .in('workspace_id', ownerWorkspaceIds)
    }

    // 3. Clean up the user account globally if they have no other workspace memberships
    const { count } = await supabaseAdmin
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', guestUserId)

    if (count === 0) {
      // Check if they are owner_guest of any other owner
      const { count: guestCount } = await supabaseAdmin
        .from('owner_guests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', guestUserId)

      if (guestCount === 0) {
        await supabaseAdmin.from('profiles').delete().eq('id', guestUserId)
        await supabaseAdmin.auth.admin.deleteUser(guestUserId)
      }
    }

    return { success: true }
  } catch (err: any) {
    console.error('Error in removeStudioGuest:', err)
    return { success: false, error: err.message }
  }
}

export async function updateGuestAccess(
  guestUserId: string,
  accessLevel: 'global' | 'granular',
  workspaces: { id: string; can_create: boolean; can_edit: boolean; can_delete: boolean }[],
  projects: { id: string; can_create: boolean; can_edit: boolean; can_deactivate: boolean; can_delete: boolean }[]
) {
  try {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado.')

    // Resolve ownerId se for convidado com Acesso Global
    let ownerId = user.id
    const { data: guestRecord } = await supabaseAdmin
      .from('owner_guests')
      .select('owner_id, access_level')
      .eq('user_id', user.id)
      .maybeSingle()
    if (guestRecord?.access_level === 'global') {
      ownerId = guestRecord.owner_id
    }

    // Ensure the caller is indeed the owner of this guest (security check)
    const { data: ownerGuest, error: ogError } = await supabaseAdmin
      .from('owner_guests')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('user_id', guestUserId)
      .single()

    if (ogError || !ownerGuest) throw new Error('Acesso não autorizado para gerenciar este convidado.')

    // 1. Update owner_guests access_level
    const { error: updateOgError } = await supabaseAdmin
      .from('owner_guests')
      .update({ access_level: accessLevel })
      .eq('user_id', guestUserId)
      .eq('owner_id', ownerId)

    if (updateOgError) throw updateOgError

    // 2. Fetch all workspaces owned by this owner (to restrict what we add/remove)
    const { data: ownerWorkspaces } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('owner_id', ownerId)

    const ownerWorkspaceIds = ownerWorkspaces?.map(w => w.id) || []

    if (ownerWorkspaceIds.length === 0) {
      return { success: true }
    }

    // 3. Clear existing workspace memberships for this user within OWNER'S workspaces
    const { error: deleteMembersError } = await supabaseAdmin
      .from('workspace_members')
      .delete()
      .eq('user_id', guestUserId)
      .in('workspace_id', ownerWorkspaceIds)

    if (deleteMembersError) throw deleteMembersError

    // Clear existing project assignments for this user within OWNER'S workspaces
    const { error: deleteProjectsError } = await supabaseAdmin
      .from('workspace_member_projects')
      .delete()
      .eq('user_id', guestUserId)
      .in('workspace_id', ownerWorkspaceIds)

    if (deleteProjectsError) throw deleteProjectsError

    // 4. If granular access, rebuild memberships & project assignments
    if (accessLevel === 'granular') {
      // Filter workspaces to ensure they belong to this owner
      const validWorkspaces = workspaces.filter(w => ownerWorkspaceIds.includes(w.id))

      if (validWorkspaces.length > 0) {
        // Insert new workspace memberships
        const memberInserts = validWorkspaces.map(w => ({
          workspace_id: w.id,
          user_id: guestUserId,
          role: 'developer', // Default role for granular guests
          can_create: w.can_create,
          can_edit: w.can_edit,
          can_delete: w.can_delete
        }))

        const { error: insertMembersError } = await supabaseAdmin
          .from('workspace_members')
          .insert(memberInserts)

        if (insertMembersError) throw insertMembersError

        // Filter projects to ensure they belong to the owner's workspaces
        const validProjIds = projects.map(p => p.id)
        const validWorkspaceIds = validWorkspaces.map(w => w.id)

        const { data: validProjects } = await supabaseAdmin
          .from('projects')
          .select('id, workspace_id')
          .in('id', validProjIds)
          .in('workspace_id', validWorkspaceIds)

        if (validProjects && validProjects.length > 0) {
          const projectInserts = validProjects.map(p => {
            const uiProj = projects.find(up => up.id === p.id)
            return {
              workspace_id: p.workspace_id,
              user_id: guestUserId,
              project_id: p.id,
              can_create: uiProj?.can_create || false,
              can_edit: uiProj?.can_edit || false,
              can_deactivate: uiProj?.can_deactivate || false,
              can_delete: uiProj?.can_delete || false
            }
          })

          const { error: insertProjectsError } = await supabaseAdmin
            .from('workspace_member_projects')
            .insert(projectInserts)

          if (insertProjectsError) throw insertProjectsError
        }
      }
    }

    return { success: true }
  } catch (err: any) {
    console.error('Error in updateGuestAccess:', err)
    return { success: false, error: err.message }
  }
}

export async function resendStudioGuestInvite(email: string) {
  try {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado.')

    // Resolve ownerId se for convidado com Acesso Global
    let ownerId = user.id
    const { data: guestRecord } = await supabaseAdmin
      .from('owner_guests')
      .select('owner_id, access_level')
      .eq('user_id', user.id)
      .maybeSingle()
    if (guestRecord?.access_level === 'global') {
      ownerId = guestRecord.owner_id
    }

    // 1. Encontrar o usuário convidado na base do Supabase Auth pelo email
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (listError) throw listError
    
    const existingUser = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!existingUser) {
      throw new Error('Convidado não encontrado no sistema de autenticação.')
    }

    // 2. Verificar se ele realmente é guest deste owner
    const { data: ownerGuest } = await supabaseAdmin
      .from('owner_guests')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('user_id', existingUser.id)
      .maybeSingle()

    if (!ownerGuest) {
      throw new Error('Você não tem permissão para gerenciar este convidado.')
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const redirectUrl = `${siteUrl}/auth/set-password`

    // 3. Tentar reenviar o convite
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectUrl,
      data: {
        need_password_setup: true
      }
    })

    if (inviteError) {
      // Se der erro de "already registered" ou "already exists", significa que a conta já foi criada/confirmada.
      // Nesse caso, atualizamos o metadado e enviamos o e-mail de redefinição de senha.
      if (isEmailExistsError(inviteError)) {
        // Atualiza para garantir que ele passe pela tela de setup de senha
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          user_metadata: { ...existingUser.user_metadata, need_password_setup: true }
        })

        // Envia o e-mail de redefinição/recuperação
        const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl
        })
        if (resetError) throw resetError

        return { success: true, message: 'Link de definição de senha enviado com sucesso!' }
      }
      throw inviteError
    }

    return { success: true, message: 'Convite reenviado com sucesso!' }
  } catch (err: any) {
    console.error('Error in resendStudioGuestInvite:', err)
    return { success: false, error: err.message }
  }
}

