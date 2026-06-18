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
    const { domain, targetId, targetType, forceTransfer } = body

    if (!domain || !targetId || !targetType) {
      return NextResponse.json({ error: 'Missing domain, targetId or targetType' }, { status: 400 })
    }

    // 1. Check if the user is authorized to manage the NEW target resource
    if (targetType === 'workspace') {
      const { data: workspace, error: wsError } = await supabase.from('workspaces').select('id').eq('id', targetId).single()
      if (wsError || !workspace) return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 403 })
    } else if (targetType === 'project') {
      const { data: project, error: projectError } = await supabase.from('projects').select('id').eq('id', targetId).single()
      if (projectError || !project) return NextResponse.json({ error: 'Project not found or access denied' }, { status: 403 })
    } else {
      return NextResponse.json({ error: 'Invalid targetType' }, { status: 400 })
    }

    // 2. Check if domain is already mapped in our DB (and belongs to this user, since RLS applies)
    let existingMapping: { id: string, name: string, type: 'workspace' | 'project' } | null = null;
    
    const { data: existingWorkspace } = await supabase.from('workspaces').select('id, name').eq('custom_domain', domain).single()
    if (existingWorkspace) {
      existingMapping = { id: existingWorkspace.id, name: existingWorkspace.name, type: 'workspace' };
    } else {
      const { data: existingProject } = await supabase.from('projects').select('id, name').eq('custom_domain', domain).single()
      if (existingProject) {
        existingMapping = { id: existingProject.id, name: existingProject.name, type: 'project' };
      }
    }

    // 3. Handle Transfer Logic
    if (existingMapping) {
      // It's the same target! Just ignore.
      if (existingMapping.id === targetId && existingMapping.type === targetType) {
        return NextResponse.json({ success: true, message: 'Domain already assigned to this target' })
      }

      if (!forceTransfer) {
        return NextResponse.json({ 
          error: 'Domain already in use', 
          requiresTransfer: true, 
          existingTargetName: existingMapping.name,
          existingTargetType: existingMapping.type
        }, { status: 409 })
      }

      // User confirmed transfer. Remove from old target.
      if (existingMapping.type === 'workspace') {
        await supabase.from('workspaces').update({ custom_domain: null }).eq('id', existingMapping.id)
      } else {
        await supabase.from('projects').update({ custom_domain: null }).eq('id', existingMapping.id)
      }
      
      // We DO NOT call Vercel API because Vercel already has it registered.
    } else {
      // Domain not in our DB (or owned by another user where RLS hid it). We must call Vercel.
      const vercelToken = process.env.VERCEL_API_TOKEN
      const vercelProjectId = process.env.VERCEL_PROJECT_ID

      if (!vercelToken || !vercelProjectId) {
        return NextResponse.json({ error: 'Vercel configuration missing on server' }, { status: 500 })
      }

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
        // If Vercel returns "already in use", and we didn't find it in our DB above, 
        // it means another MetaBuilder customer owns it (or it's externally bound).
        if (vercelData.error?.code === 'domain_already_in_use' || vercelData.error?.message?.includes('already in use')) {
          return NextResponse.json({ error: 'Este domínio já está associado a outra conta. Entre em contato com o suporte ou proprietário do domínio.' }, { status: 409 })
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.warn('Vercel API failed but proceeding anyway in development mode:', vercelData.error?.message)
        } else {
          return NextResponse.json({ error: vercelData.error?.message || 'Failed to add domain to Vercel' }, { status: 400 })
        }
      }
    }

    // 4. Update Supabase with the new assignment
    let updateError = null;
    
    if (targetType === 'workspace') {
      const { error } = await supabase.from('workspaces').update({ custom_domain: domain }).eq('id', targetId)
      updateError = error
    } else {
      const { error } = await supabase.from('projects').update({ custom_domain: domain }).eq('id', targetId)
      updateError = error
    }

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update database' }, { status: 500 })
    }

    return NextResponse.json({ success: true, domain })

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
    const targetId = searchParams.get('targetId')
    const targetType = searchParams.get('targetType')

    if (!domain || !targetId || !targetType) {
      return NextResponse.json({ error: 'Missing domain, targetId or targetType' }, { status: 400 })
    }

    // 1. Verify access
    if (targetType === 'workspace') {
      const { data: workspace, error: wsError } = await supabase
        .from('workspaces')
        .select('id, custom_domain')
        .eq('id', targetId)
        .single()
      
      if (wsError || !workspace) return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 403 })
    } else if (targetType === 'project') {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, custom_domain')
        .eq('id', targetId)
        .single()
      
      if (projectError || !project) return NextResponse.json({ error: 'Project not found or access denied' }, { status: 403 })
    } else {
      return NextResponse.json({ error: 'Invalid targetType' }, { status: 400 })
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
    let updateError = null;
    
    if (targetType === 'workspace') {
      const { error } = await supabase.from('workspaces').update({ custom_domain: null }).eq('id', targetId)
      updateError = error
    } else {
      const { error } = await supabase.from('projects').update({ custom_domain: null }).eq('id', targetId)
      updateError = error
    }

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update database' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Remove domain error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
