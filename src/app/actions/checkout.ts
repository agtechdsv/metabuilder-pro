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



export async function getOrCreateDefaultWorkspace(workspaceSlug?: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Usuário não autenticado' }
    }

    // Check if the user is an invited guest
    const { data: guestRecord } = await supabase
      .from('owner_guests')
      .select('access_level')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (guestRecord) {
      // For guests, we return the first workspace they are invited to (or null if they haven't been assigned yet)
      const { data: workspaces } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false })
      
      return { success: true, workspace: (workspaces && workspaces.length > 0) ? workspaces[0] : null }
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
    const wsSlug = sanitizedPrefix
    const wsName = `Workspace de ${userPrefix.charAt(0).toUpperCase() + userPrefix.slice(1)}`

    const { data: newWs, error: insertError } = await supabase
      .from('workspaces')
      .insert({
        name: wsName,
        slug: wsSlug,
        owner_id: user.id
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
          owner_id: user.id
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

