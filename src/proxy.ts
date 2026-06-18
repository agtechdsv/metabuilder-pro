import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { createClient } from '@supabase/supabase-js'

export async function proxy(request: NextRequest) {
  // Update session cookies first to keep auth working
  let response = await updateSession(request)

  const url = request.nextUrl
  const hostHeader = request.headers.get('host') || ''
  // Remove port if exists (e.g., localhost:3000 -> localhost)
  const hostname = hostHeader.split(':')[0]

  // Define our core application domains (without ports)
  const appDomains = [
    'localhost', 
    process.env.NEXT_PUBLIC_APP_URL?.replace('https://', '').replace('http://', '').split(':')[0],
    'metabuilderpro.com', 
    'www.metabuilderpro.com',
    'metabuilder-pro.vercel.app'
  ].filter(Boolean)

  // If we don't have a hostname or it's one of our core domains, proceed normally
  if (!hostname || appDomains.includes(hostname)) {
    return response
  }

  // It's a custom domain! Query Supabase to find which project this belongs to
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars in proxy')
    return response
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  })

  // 1. Try to find a workspace with this custom domain
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('slug')
    .eq('custom_domain', hostname)
    .single()

  if (workspace && !wsError) {
    const workspaceSlug = workspace.slug
    const targetPrefix = `/${workspaceSlug}`
    let rewritePath = url.pathname
    
    if (!rewritePath.startsWith(targetPrefix)) {
      rewritePath = `${targetPrefix}${rewritePath === '/' ? '' : rewritePath}`
    }

    const rewriteUrl = new URL(`${rewritePath}${url.search}`, request.url)
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-custom-domain', 'true')
    requestHeaders.set('x-custom-domain-type', 'workspace')

    const rewriteResponse = NextResponse.rewrite(rewriteUrl, {
      request: { headers: requestHeaders },
    })
    
    response.headers.forEach((value, key) => {
      if(key.toLowerCase() === 'set-cookie') rewriteResponse.headers.append(key, value)
    })
    return rewriteResponse
  }

  // 2. Try to find a project with this custom domain
  const { data: project, error } = await supabase
    .from('projects')
    .select('slug, workspaces(slug)')
    .eq('custom_domain', hostname)
    .single()

  if (error || !project || !project.workspaces) {
    console.error(`Custom domain not found or error: ${hostname}`)
    return response
  }

  const workspaceSlug = Array.isArray(project.workspaces) 
    ? project.workspaces[0]?.slug 
    : (project.workspaces as any).slug

  const projectSlug = project.slug

  if (workspaceSlug && projectSlug) {
    // Check if the URL already has the workspace and project in the path (e.g., from a redirect)
    const targetPrefix = `/${workspaceSlug}/${projectSlug}`
    let rewritePath = url.pathname
    
    // Only prepend the prefix if it's not already there
    if (!rewritePath.startsWith(targetPrefix)) {
      rewritePath = `${targetPrefix}${rewritePath === '/' ? '' : rewritePath}`
    }

    // Rewrite URL for the custom domain
    const rewriteUrl = new URL(`${rewritePath}${url.search}`, request.url)
    
    // Pass a header to let Server Components know this is a custom domain
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-custom-domain', 'true')

    const rewriteResponse = NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders,
      },
    })
    
    // Copy cookies from the session update response to the rewrite response
    response.headers.forEach((value, key) => {
        if(key.toLowerCase() === 'set-cookie') {
            rewriteResponse.headers.append(key, value)
        }
    })
    
    return rewriteResponse
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|css|ico|woff|woff2|ttf|eot)$).*)',
  ],
}
