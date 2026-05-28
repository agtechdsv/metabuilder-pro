'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// Helper to determine role of a profile dynamically
async function getUserDisplayRole(userId: string): Promise<'ADMIN' | 'OWNER' | 'DEV'> {
  const adminSupabase = createAdminClient()

  // 1. check if super admin
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.is_super_admin) return 'ADMIN'

  // 2. check if they own any workspace
  const { data: ownedWs } = await adminSupabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)

  if (ownedWs && ownedWs.length > 0) return 'OWNER'

  // 3. check if they are owner or admin in workspace_members
  const { data: adminWs } = await adminSupabase
    .from('workspace_members')
    .select('id')
    .eq('user_id', userId)
    .in('role', ['owner', 'admin'])
    .limit(1)

  if (adminWs && adminWs.length > 0) return 'OWNER'

  // Default is DEV
  return 'DEV'
}

export async function getPosts() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: posts, error } = await supabase
      .from('community_posts')
      .select(`
        id,
        content,
        image_url,
        created_at,
        user_id,
        profile:profiles(id, full_name, avatar_url, is_super_admin)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    const adminSupabase = createAdminClient()

    const enrichedPosts = await Promise.all((posts || []).map(async (post: any) => {
      // Get likes
      const { data: likes } = await adminSupabase
        .from('community_post_likes')
        .select('user_id')
        .eq('post_id', post.id)

      // Get comments count
      const { count: commentsCount } = await adminSupabase
        .from('community_comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id)

      const likedByMe = user ? (likes || []).some((l: any) => l.user_id === user.id) : false
      const role = await getUserDisplayRole(post.user_id)

      return {
        id: post.id,
        content: post.content,
        image_url: post.image_url,
        created_at: post.created_at,
        likesCount: likes?.length || 0,
        commentsCount: commentsCount || 0,
        likedByMe,
        user: {
          id: post.user_id,
          name: post.profile?.full_name || 'Usuário da Comunidade',
          avatar: post.profile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.user_id}`,
          role: role
        }
      }
    }))

    return { success: true, posts: enrichedPosts }
  } catch (err: any) {
    console.error('Error in getPosts:', err)
    return { success: false, error: err.message }
  }
}

export async function createPost(content: string, imageUrl?: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado')

    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        user_id: user.id,
        content,
        image_url: imageUrl || null
      })
      .select()

    if (error) throw error
    revalidatePath('/client/dashboard')
    revalidatePath('/admin/platform')
    return { success: true, post: data[0] }
  } catch (err: any) {
    console.error('Error in createPost:', err)
    return { success: false, error: err.message }
  }
}

export async function toggleLikePost(postId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado')

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('community_post_likes')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingLike) {
      // Unlike
      const { error } = await supabase
        .from('community_post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id)
      if (error) throw error
    } else {
      // Like
      const { error } = await supabase
        .from('community_post_likes')
        .insert({
          post_id: postId,
          user_id: user.id
        })
      if (error) throw error
    }

    return { success: true }
  } catch (err: any) {
    console.error('Error in toggleLikePost:', err)
    return { success: false, error: err.message }
  }
}

export async function getComments(postId: string) {
  try {
    const supabase = await createClient()
    const { data: comments, error } = await supabase
      .from('community_comments')
      .select(`
        *,
        profile:profiles(id, full_name, avatar_url, is_super_admin)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (error) throw error

    const enrichedComments = await Promise.all((comments || []).map(async (comment: any) => {
      const role = await getUserDisplayRole(comment.user_id)
      return {
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        user: {
          id: comment.user_id,
          name: comment.profile?.full_name || 'Membro',
          avatar: comment.profile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${comment.user_id}`,
          role: role
        }
      }
    }))

    return { success: true, comments: enrichedComments }
  } catch (err: any) {
    console.error('Error in getComments:', err)
    return { success: false, error: err.message }
  }
}

export async function createComment(postId: string, content: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado')

    const { data, error } = await supabase
      .from('community_comments')
      .insert({
        post_id: postId,
        user_id: user.id,
        content
      })
      .select()

    if (error) throw error
    return { success: true, comment: data[0] }
  } catch (err: any) {
    console.error('Error in createComment:', err)
    return { success: false, error: err.message }
  }
}

export async function getConnections() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado')

    // Query accepted or pending connections where user is requester or addressee
    const { data: conns, error } = await supabase
      .from('community_connections')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    if (error) throw error

    const adminSupabase = createAdminClient()

    const connections = await Promise.all((conns || []).map(async (conn: any) => {
      const otherUserId = conn.requester_id === user.id ? conn.addressee_id : conn.requester_id

      const { data: otherProfile } = await adminSupabase
        .from('profiles')
        .select('id, full_name, avatar_url, is_super_admin')
        .eq('id', otherUserId)
        .single()

      const role = await getUserDisplayRole(otherUserId)

      return {
        id: conn.id,
        status: conn.status,
        isRequester: conn.requester_id === user.id,
        user: {
          id: otherUserId,
          name: otherProfile?.full_name || 'Usuário',
          avatar: otherProfile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${otherUserId}`,
          role
        }
      }
    }))

    return { success: true, connections }
  } catch (err: any) {
    console.error('Error in getConnections:', err)
    return { success: false, error: err.message }
  }
}

export async function sendConnectionRequest(targetUserId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado')

    const { data, error } = await supabase
      .from('community_connections')
      .insert({
        requester_id: user.id,
        addressee_id: targetUserId,
        status: 'PENDING'
      })
      .select()

    if (error) throw error
    return { success: true, connection: data[0] }
  } catch (err: any) {
    console.error('Error in sendConnectionRequest:', err)
    return { success: false, error: err.message }
  }
}

export async function acceptConnection(connectionId: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('community_connections')
      .update({
        status: 'ACCEPTED',
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)

    if (error) throw error
    return { success: true }
  } catch (err: any) {
    console.error('Error in acceptConnection:', err)
    return { success: false, error: err.message }
  }
}

export async function rejectOrRemoveConnection(connectionId: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('community_connections')
      .delete()
      .eq('id', connectionId)

    if (error) throw error
    return { success: true }
  } catch (err: any) {
    console.error('Error in rejectOrRemoveConnection:', err)
    return { success: false, error: err.message }
  }
}

export async function getDiscoverySuggestions() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado')

    // 1. Get all user IDs that are already connected or requested connection
    const { data: conns } = await supabase
      .from('community_connections')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    const connectedUserIds = new Set<string>()
    connectedUserIds.add(user.id)

    if (conns) {
      conns.forEach((c: any) => {
        connectedUserIds.add(c.requester_id)
        connectedUserIds.add(c.addressee_id)
      })
    }

    // 2. Fetch profiles that are NOT in the connectedUserIds set
    const adminSupabase = createAdminClient()
    const { data: profiles, error } = await adminSupabase
      .from('profiles')
      .select('id, full_name, avatar_url, is_super_admin')
      .limit(30)

    if (error) throw error

    const suggestions = await Promise.all(
      (profiles || [])
        .filter((p: any) => !connectedUserIds.has(p.id))
        .map(async (p: any) => {
          const role = await getUserDisplayRole(p.id)
          return {
            id: p.id,
            name: p.full_name || 'Membro da Comunidade',
            avatar: p.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${p.id}`,
            role
          }
        })
    )

    return { success: true, suggestions }
  } catch (err: any) {
    console.error('Error in getDiscoverySuggestions:', err)
    return { success: false, error: err.message }
  }
}

export async function getOrCreateChatRoom(targetUserId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado')

    // Check if room exists
    const { data: existingRooms, error } = await supabase
      .from('community_chat_rooms')
      .select('*')
      .or(`and(user1_id.eq.${user.id},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${user.id})`)

    if (error) throw error

    if (existingRooms && existingRooms.length > 0) {
      return { success: true, roomId: existingRooms[0].id }
    }

    // Create new room
    const { data: newRoom, error: createError } = await supabase
      .from('community_chat_rooms')
      .insert({
        user1_id: user.id,
        user2_id: targetUserId
      })
      .select()

    if (createError) throw createError
    return { success: true, roomId: newRoom[0].id }
  } catch (err: any) {
    console.error('Error in getOrCreateChatRoom:', err)
    return { success: false, error: err.message }
  }
}

export async function getChatMessages(roomId: string) {
  try {
    const supabase = await createClient()

    // Mark messages as read
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('community_chat_messages')
        .update({ is_read: true })
        .eq('room_id', roomId)
        .not('sender_id', 'eq', user.id)
    }

    const { data: messages, error } = await supabase
      .from('community_chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return { success: true, messages }
  } catch (err: any) {
    console.error('Error in getChatMessages:', err)
    return { success: false, error: err.message }
  }
}

export async function sendChatMessage(roomId: string, content: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado')

    const { data: message, error } = await supabase
      .from('community_chat_messages')
      .insert({
        room_id: roomId,
        sender_id: user.id,
        content
      })
      .select()

    if (error) throw error
    return { success: true, message: message[0] }
  } catch (err: any) {
    console.error('Error in sendChatMessage:', err)
    return { success: false, error: err.message }
  }
}
