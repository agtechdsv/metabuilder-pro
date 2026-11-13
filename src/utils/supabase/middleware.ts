import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Domínio dos cookies de login: o mesmo para o site com e sem www. */
export function cookieDomainFor(hostname: string): string | undefined {
  return hostname.endsWith('metabuilderpro.com') ? '.metabuilderpro.com' : undefined
}

export interface AuthContext {
  response: NextResponse
  /** quem está logado (já validado no Supabase), ou null */
  user: { id: string } | null
  /** o token de acesso da sessão (dele sai o id da sessão para a regra de vagas) */
  accessToken: string | null
  cookieDomain: string | undefined
}

export async function updateSessionWithAuth(request: NextRequest): Promise<AuthContext> {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const hostname = request.headers.get('host')?.split(':')[0] || ''
  const cookieDomain = cookieDomainFor(hostname)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain: cookieDomain,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              domain: cookieDomain || options?.domain,
            })
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // O token só é lido (não o usuário dele): quem validou foi o getUser acima.
  let accessToken: string | null = null
  if (user) {
    const { data: { session } } = await supabase.auth.getSession()
    accessToken = session?.access_token ?? null
  }

  return { response: supabaseResponse, user: user ? { id: user.id } : null, accessToken, cookieDomain }
}

export async function updateSession(request: NextRequest) {
  return (await updateSessionWithAuth(request)).response
}
