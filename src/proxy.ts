import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { createClient } from '@supabase/supabase-js'

export async function proxy(request: NextRequest) {
  // Update session cookies first to keep auth working
  let response = await updateSession(request)

  const url = request.nextUrl
  const hostname = request.headers.get('host')

  // Define our core application domains
  const appDomains = [
    'localhost:3000', 
    'localhost:3001',
    process.env.NEXT_PUBLIC_APP_URL?.replace('https://', '').replace('http://', ''),
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

  const { data: project, error } = await supabase
    .from('projects')
    .select('slug, workspaces(slug)')
    .eq('custom_domain', hostname)
    .single()

  if (error || !project || !project.workspaces) {
    console.error(`Custom domain not found or error: ${hostname}`, error)
    return response
  }

  const workspaceSlug = Array.isArray(project.workspaces) 
    ? project.workspaces[0]?.slug 
    : (project.workspaces as any).slug

  const projectSlug = project.slug

  if (workspaceSlug && projectSlug) {
    // Rewrite URL for the custom domain
    const rewriteUrl = new URL(`/${workspaceSlug}/${projectSlug}${url.pathname}${url.search}`, request.url)
    const rewriteResponse = NextResponse.rewrite(rewriteUrl)
    
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
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
