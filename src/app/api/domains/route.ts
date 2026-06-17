import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { domain, projectId } = body

    if (!domain || !projectId) {
      return NextResponse.json({ error: 'Missing domain or projectId' }, { status: 400 })
    }

    // 1. Check if the user is authorized to manage this project
    // (Assuming projects table RLS allows the owner to read/update their project)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, custom_domain')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 403 })
    }

    // 2. Vercel API integration
    const vercelToken = process.env.VERCEL_API_TOKEN
    const vercelProjectId = process.env.VERCEL_PROJECT_ID

    if (!vercelToken || !vercelProjectId) {
      return NextResponse.json({ error: 'Vercel configuration missing on server' }, { status: 500 })
    }

    // Add domain to Vercel
    const vercelResponse = await fetch(`https://api.vercel.com/v10/projects/${vercelProjectId}/domains`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: domain })
    })

    const vercelData = await vercelResponse.json()

    if (!vercelResponse.ok) {
      // Sometimes it returns error if domain is already attached to another Vercel project
      return NextResponse.json({ error: vercelData.error?.message || 'Failed to add domain to Vercel' }, { status: 400 })
    }

    // 3. Update Supabase
    const { error: updateError } = await supabase
      .from('projects')
      .update({ custom_domain: domain })
      .eq('id', projectId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update database' }, { status: 500 })
    }

    return NextResponse.json({ success: true, domain: vercelData })

  } catch (error: any) {
    console.error('Add domain error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const domain = searchParams.get('domain')
    const projectId = searchParams.get('projectId')

    if (!domain || !projectId) {
      return NextResponse.json({ error: 'Missing domain or projectId' }, { status: 400 })
    }

    // 1. Verify access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, custom_domain')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 403 })
    }

    // 2. Remove domain from Vercel
    const vercelToken = process.env.VERCEL_API_TOKEN
    const vercelProjectId = process.env.VERCEL_PROJECT_ID

    if (vercelToken && vercelProjectId) {
      const vercelResponse = await fetch(`https://api.vercel.com/v9/projects/${vercelProjectId}/domains/${domain}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${vercelToken}`
        }
      })
      if (!vercelResponse.ok) {
         console.warn('Failed to remove domain from Vercel. It might already be removed.')
      }
    }

    // 3. Update Supabase
    const { error: updateError } = await supabase
      .from('projects')
      .update({ custom_domain: null })
      .eq('id', projectId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update database' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Remove domain error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
