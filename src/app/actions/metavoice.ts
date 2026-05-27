'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export interface Suggestion {
  id: string
  title: string
  description: string
  category: string
  status: string
  author_id: string | null
  is_anonymous: boolean
  admin_response_public: string | null
  admin_response_private: string | null
  created_at: string
  updated_at: string
  votes?: SuggestionVote[]
  comments?: SuggestionComment[]
  _count?: {
    likes: number
    comments: number
  }
  avgStars?: number
}

export interface SuggestionVote {
  id: string
  suggestion_id: string
  user_id: string
  type: 'like' | 'star'
  star_value: number | null
}

export interface SuggestionComment {
  id: string
  suggestion_id: string
  author_id: string | null
  content: string
  is_admin_response: boolean
  created_at: string
  author?: {
    id: string
    full_name: string | null
    email: string | null
  }
}

// ─── Fetching ───────────────────────────────────────────────────────────────

export async function getSuggestions(filters?: { category?: string; status?: string }) {
  const supabase = await createClient()

  let query = supabase
    .from('suggestions')
    .select(`
      *,
      votes:suggestion_votes(*),
      comments:suggestion_comments(count)
    `)
    .order('created_at', { ascending: false })

  if (filters?.category && filters.category !== 'all') {
    query = query.eq('category', filters.category)
  }
  
  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching suggestions:', error)
    return { data: [], error: error.message }
  }

  // Calculate aggregates
  const enhancedData = data?.map(s => {
    const likes = s.votes?.filter((v: any) => v.type === 'like').length || 0
    const starVotes = s.votes?.filter((v: any) => v.type === 'star') || []
    
    // Average rating
    const avgStars = starVotes.length > 0 
      ? starVotes.reduce((acc: number, v: any) => acc + (v.star_value || 0), 0) / starVotes.length
      : 0

    return {
      ...s,
      _count: {
        likes,
        comments: s.comments?.[0]?.count || 0
      },
      avgStars
    }
  })

  return { data: enhancedData as any, error: null }
}

export async function getSuggestionById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('suggestions')
    .select(`
      *,
      votes:suggestion_votes(*),
      comments:suggestion_comments(
        *,
        author:profiles(id, full_name, email)
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching suggestion:', error)
    return { data: null, error: error.message }
  }

  // Sort comments oldest to newest
  if (data?.comments) {
    data.comments.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }

  return { data: data as Suggestion, error: null }
}

// ─── Creating ───────────────────────────────────────────────────────────────

export async function createSuggestion(payload: {
  title: string
  description: string
  category: string
  is_anonymous: boolean
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  const { data, error } = await supabase
    .from('suggestions')
    .insert({
      title: payload.title,
      description: payload.description,
      category: payload.category,
      is_anonymous: payload.is_anonymous,
      author_id: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating suggestion:', error)
    return { error: error.message }
  }

  revalidatePath('/client/dashboard')
  return { data }
}

// ─── Voting ─────────────────────────────────────────────────────────────────

export async function voteSuggestion(suggestionId: string, type: 'like' | 'star', starValue?: number) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  // Check if vote exists
  const { data: existingVote } = await supabase
    .from('suggestion_votes')
    .select('id')
    .eq('suggestion_id', suggestionId)
    .eq('user_id', user.id)
    .eq('type', type)
    .single()

  if (existingVote) {
    if (type === 'like') {
      // Toggle off
      const { error } = await supabase.from('suggestion_votes').delete().eq('id', existingVote.id)
      if (error) return { error: error.message }
    } else if (type === 'star') {
      // Update star value
      const { error } = await supabase.from('suggestion_votes').update({ star_value: starValue }).eq('id', existingVote.id)
      if (error) return { error: error.message }
    }
  } else {
    // Insert new
    const { error } = await supabase
      .from('suggestion_votes')
      .insert({
        suggestion_id: suggestionId,
        user_id: user.id,
        type,
        star_value: type === 'star' ? starValue : null
      })
    if (error) return { error: error.message }
  }

  revalidatePath('/client/dashboard')
  return { success: true }
}

// ─── Comments ───────────────────────────────────────────────────────────────

export async function addSuggestionComment(suggestionId: string, content: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  const { error } = await supabase
    .from('suggestion_comments')
    .insert({
      suggestion_id: suggestionId,
      author_id: user.id,
      content,
      is_admin_response: false
    })

  if (error) {
    console.error('Error adding comment:', error)
    return { error: error.message }
  }

  revalidatePath('/client/dashboard')
  return { success: true }
}

// ─── Admin Actions ──────────────────────────────────────────────────────────

export async function updateSuggestionStatus(suggestionId: string, status: string) {
  const supabase = await createClient()
  
  // RLS will enforce that only super_admins can do this, but we'll try it anyway
  const { error } = await supabase
    .from('suggestions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', suggestionId)

  if (error) {
    console.error('Error updating suggestion status:', error)
    return { error: error.message }
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function adminReplyToSuggestion(suggestionId: string, payload: { publicResponse?: string; privateNote?: string }) {
  const supabase = await createClient()
  
  const updates: any = { updated_at: new Date().toISOString() }
  if (payload.publicResponse !== undefined) updates.admin_response_public = payload.publicResponse || null
  if (payload.privateNote !== undefined) updates.admin_response_private = payload.privateNote || null

  const { error } = await supabase
    .from('suggestions')
    .update(updates)
    .eq('id', suggestionId)

  if (error) {
    console.error('Error admin replying:', error)
    return { error: error.message }
  }

  revalidatePath('/admin')
  return { success: true }
}
