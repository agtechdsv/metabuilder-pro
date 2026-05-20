'use server'

import { createClient } from '@supabase/supabase-js'

// Usamos Service Role Key aqui para ter acesso à admin API e contornar RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function inviteWorkspaceMember(workspaceId: string, workspaceSlug: string, email: string, role: string) {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const redirectUrl = `${siteUrl}/admin/${workspaceSlug}`

    // 1. Tentar convidar o usuário via Auth do Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectUrl,
      data: {
        invited_workspace_id: workspaceId,
        invited_role: role
      }
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
         return { success: false, error: 'Este e-mail já está registrado na plataforma. Ele precisa ser adicionado manualmente (ainda não implementado via API admin direto).' }
      }
      throw authError
    }

    if (authData?.user) {
      // 2. Inserir na tabela de workspace_members
      const { error: insertError } = await supabaseAdmin.from('workspace_members').insert({
        workspace_id: workspaceId,
        user_id: authData.user.id,
        role: role
      })

      if (insertError) throw insertError
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
    const { error } = await supabaseAdmin
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)

    if (error) throw error

    // 2. Verifica se o usuário pertence a outros workspaces
    const { count, error: countError } = await supabaseAdmin
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // 3. Se ele não pertence a nenhum outro workspace (count === 0), excluímos a conta geral
    if (!countError && count === 0) {
      // Garantimos a exclusão do profile público (caso não tenha ON DELETE CASCADE)
      await supabaseAdmin.from('profiles').delete().eq('id', userId)
      
      // E por fim, removemos do Auth oficial do Supabase
      await supabaseAdmin.auth.admin.deleteUser(userId)
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
