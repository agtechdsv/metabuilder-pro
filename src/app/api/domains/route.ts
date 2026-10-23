import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { dominioReservado, txtConfere, txtNome, txtValor } from '@/lib/domainVerification'

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

    // 1.5 O domínio precisa ser de quem vincula: nada do sistema e, fora do desenvolvimento, um registro TXT no DNS do domínio com o valor deste vínculo
    const dominio = String(domain).trim().toLowerCase()
    if (dominioReservado(dominio)) return NextResponse.json({ error: 'Este domínio é reservado e não pode ser vinculado.' }, { status: 400 })
    const segredo = process.env.DOMAIN_VERIFY_SECRET || process.env.VERCEL_API_TOKEN
    if (!segredo) {
      if (process.env.NODE_ENV !== 'development') return NextResponse.json({ error: 'Verificação de domínio não configurada no servidor (DOMAIN_VERIFY_SECRET).' }, { status: 500 })
    } else if (!(await txtConfere(dominio, targetId, segredo))) {
      const nome = txtNome(dominio)
      const valor = txtValor(dominio, targetId, segredo)
      return NextResponse.json({
        requiresVerification: true, txtName: nome, txtValue: valor,
        error: `Para provar que o domínio é seu, crie no DNS dele um registro TXT com o nome ${nome} e o valor ${valor}. Depois clique em Vincular de novo.`,
      }, { status: 428 })
    }

    // 2. Find ALL mappings in the DB to detect conflicts
    const { data: workspacesWithDomain } = await supabase.from('workspaces').select('id, name').eq('custom_domain', domain)
    const { data: projectsWithDomain } = await supabase.from('projects').select('id, name').eq('custom_domain', domain)

    let conflicts: { id: string, name: string, type: 'workspace' | 'project' }[] = [];
    
    if (workspacesWithDomain) {
      for (const w of workspacesWithDomain) {
        if (!(targetType === 'workspace' && w.id === targetId)) {
          conflicts.push({ id: w.id, name: w.name, type: 'workspace' });
        }
      }
    }
    
    if (projectsWithDomain) {
      for (const p of projectsWithDomain) {
        if (!(targetType === 'project' && p.id === targetId)) {
          conflicts.push({ id: p.id, name: p.name, type: 'project' });
        }
      }
    }

    // 3. Handle Transfer Logic
    if (conflicts.length > 0) {
      if (!forceTransfer) {
        return NextResponse.json({ 
          error: 'Domain already in use', 
          requiresTransfer: true, 
          existingTargetName: conflicts[0].name,
          existingTargetType: conflicts[0].type
        }, { status: 409 })
      }

      // User confirmed transfer. Remove from all conflicting targets.
      // We use .in() to only affect the conflicts, just to be precise.
      const workspaceConflictIds = conflicts.filter(c => c.type === 'workspace').map(c => c.id)
      const projectConflictIds = conflicts.filter(c => c.type === 'project').map(c => c.id)

      if (workspaceConflictIds.length > 0) {
        await supabase.from('workspaces').update({ custom_domain: null }).in('id', workspaceConflictIds)
      }
      if (projectConflictIds.length > 0) {
        await supabase.from('projects').update({ custom_domain: null }).in('id', projectConflictIds)
      }
    }

    // Whether there were conflicts or not, we now register in Vercel and assign to the target.
    // Domain not in our DB (or owned by another user where RLS hid it). We must call Vercel.
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
        // Se a Vercel diz que já está em uso, vamos checar se está no NOSSO projeto.
        // Como já verificamos o Supabase no início do arquivo e não achamos dono, 
        // se o domínio estiver no nosso projeto Vercel, significa que ele ficou "órfão"
        // (ex: o usuário deletou o workspace sem apagar o domínio). 
        // Nesse caso, fazemos um "Self-Healing" e apenas aceitamos o domínio.
        if (vercelData.error?.code === 'domain_already_in_use' || vercelData.error?.message?.includes('already in use')) {
          const verifyResponse = await fetch(`https://api.vercel.com/v9/projects/${vercelProjectId}/domains/${domain}`, {
            headers: { 'Authorization': `Bearer ${vercelToken}` }
          });
          
          if (verifyResponse.ok) {
            // O domínio está no nosso projeto Vercel e não tem dono no banco. Vamos adotar ele!
            console.log(`[Self-Healing] Domínio órfão ${domain} detectado e reaproveitado.`);
          } else {
            // O domínio está em OUTRO projeto (de outra pessoa/empresa)
            return NextResponse.json({ error: 'Este domínio já está associado a outra conta. Entre em contato com o suporte ou proprietário do domínio.' }, { status: 409 })
          }
        } else {
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

/**
 * Verificar agora: o DNS do domínio já aponta para a plataforma? Responde com o que a Vercel enxerga (configuração do DNS e domínio verificado).
 * Só vale para um domínio que está vinculado a um projeto/portal do próprio usuário.
 */
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const domain = (searchParams.get('domain') || '').trim().toLowerCase()
    const targetId = searchParams.get('targetId')
    const targetType = searchParams.get('targetType')
    if (!domain || !targetId || (targetType !== 'workspace' && targetType !== 'project')) {
      return NextResponse.json({ error: 'Missing domain, targetId or targetType' }, { status: 400 })
    }

    // o domínio precisa estar vinculado a este destino (que o usuário enxerga)
    const { data: alvo } = await supabase.from(targetType === 'workspace' ? 'workspaces' : 'projects').select('id, custom_domain').eq('id', targetId).single()
    if (!alvo || String(alvo.custom_domain || '').toLowerCase() !== domain) {
      return NextResponse.json({ error: 'Domain not linked to this target' }, { status: 403 })
    }

    const token = process.env.VERCEL_API_TOKEN
    const projectId = process.env.VERCEL_PROJECT_ID
    if (!token || !projectId) return NextResponse.json({ error: 'Vercel configuration missing on server' }, { status: 500 })
    const headers = { Authorization: `Bearer ${token}` }

    const [cfg, proj] = await Promise.all([
      fetch(`https://api.vercel.com/v6/domains/${domain}/config`, { headers, signal: AbortSignal.timeout(15_000) }).then(r => r.json()).catch(() => null),
      fetch(`https://api.vercel.com/v9/projects/${projectId}/domains/${domain}`, { headers, signal: AbortSignal.timeout(15_000) }).then(r => r.json()).catch(() => null),
    ])
    const dnsOk = cfg ? cfg.misconfigured === false : null
    const verified = proj ? proj.verified === true : null
    // o CNAME que a Vercel recomenda para este projeto (o genérico cname.vercel-dns.com continua valendo, mas ela pede o específico)
    const rec = Array.isArray(cfg?.recommendedCNAME) ? [...cfg.recommendedCNAME].sort((a: any, b: any) => (a?.rank ?? 99) - (b?.rank ?? 99))[0]?.value : undefined
    const recomendado = typeof rec === 'string' && rec.length > 0 ? { cname: rec.replace(/\.$/, '') } : {}
    return NextResponse.json({ dnsOk, verified, ready: dnsOk === true && verified === true, recomendado })
  } catch (error: any) {
    console.error('Check domain error:', error)
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
