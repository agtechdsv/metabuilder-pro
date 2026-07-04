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

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify if user is super admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    if (!category || !category.startsWith('ide-')) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    // Determine extensions based on category
    let matchExtensions: string[] = []
    if (category === 'ide-linux') {
      matchExtensions = ['.AppImage', '.AppImage.tar.gz', '.deb']
    } else if (category === 'ide-win') {
      matchExtensions = ['.exe', '.nsis.zip', '.msi', '.msi.zip']
    } else if (category === 'ide-mac') {
      matchExtensions = ['.dmg', '.app.tar.gz']
    }

    if (matchExtensions.length === 0) {
      return NextResponse.json({ success: true, deletedCount: 0 })
    }

    // Fetch all releases
    const releases = await githubFetch(`releases?per_page=100`)
    let deletedCount = 0

    // Iterate through all releases and delete matching assets
    for (const release of releases) {
      for (const asset of release.assets) {
        const isMatch = matchExtensions.some(ext => asset.name.endsWith(ext))
        if (isMatch) {
          try {
            await githubFetch(`releases/assets/${asset.id}`, { method: 'DELETE' })
            deletedCount++
          } catch (e) {
            console.error(`Failed to delete asset ${asset.name} (${asset.id})`, e)
          }
        }
      }
    }

    return NextResponse.json({ success: true, deletedCount })

  } catch (error: any) {
    console.error('Delete Release Assets API error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
