import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const OWNER = 'agtechdsv'
const REPO = 'metabuilder-pro'

async function githubFetch(endpoint: string, options: RequestInit = {}) {
  const token = process.env.GITHUB_PAT
  if (!token) throw new Error('GITHUB_PAT is not defined in environment variables.')

  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error(`GitHub API Error (${endpoint}):`, res.status, errorText)
    throw new Error(`GitHub API Error: ${res.statusText}`)
  }

  if (res.status === 204) {
    return null
  }

  return res.json()
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const releases = await githubFetch(`releases?per_page=100`)
    return NextResponse.json({ releases })
  } catch (error: any) {
    console.error('History API GET error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const tag = searchParams.get('tag')
    
    if (!tag) {
      return NextResponse.json({ error: 'Release tag is required' }, { status: 400 })
    }

    const versionStr = tag.startsWith('v') ? tag : `v${tag}`
    const rawVersion = versionStr.replace(/^v/, '') // "1.0.0"

    // 1. Delete from DB app_downloads
    // Wait, the version in app_downloads might be 'v1.0.0' or '1.0.0'.
    const { data: filesToDelete, error: dbFetchError } = await supabase
      .from('app_downloads')
      .select('id, bucket_path')
      .or(`version.eq.${versionStr},version.eq.${rawVersion}`)

    if (!dbFetchError && filesToDelete && filesToDelete.length > 0) {
      const bucketPaths = filesToDelete.map(f => f.bucket_path)
      // 2. Delete from Supabase Bucket
      await supabase.storage.from('releases').remove(bucketPaths)

      // Delete from DB table
      const ids = filesToDelete.map(f => f.id)
      await supabase.from('app_downloads').delete().in('id', ids)
    }

    // 3. Delete Release from GitHub
    // Need to find the release ID by tag
    try {
      const release = await githubFetch(`releases/tags/${versionStr}`)
      if (release && release.id) {
        await githubFetch(`releases/${release.id}`, { method: 'DELETE' })
      }
    } catch (e: any) {
      console.warn(`GitHub Release for tag ${versionStr} not found or error:`, e)
    }

    // 4. Delete Tag from GitHub Git Refs
    try {
      await githubFetch(`git/refs/tags/${versionStr}`, { method: 'DELETE' })
    } catch (e: any) {
      console.warn(`GitHub Tag ${versionStr} not found or error:`, e)
    }

    return NextResponse.json({ success: true, message: `Release ${versionStr} e seus arquivos foram excluídos com sucesso.` })
  } catch (error: any) {
    console.error('History API DELETE error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
