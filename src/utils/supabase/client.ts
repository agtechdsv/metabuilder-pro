import { createBrowserClient } from '@supabase/ssr'

export function createClient(options?: any) {
  let cookieDomain: string | undefined = undefined
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname.endsWith('metabuilderpro.com')) {
      cookieDomain = '.metabuilderpro.com'
    }
  }

  const mergedOptions = {
    ...options,
    cookieOptions: {
      domain: cookieDomain,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      ...options?.cookieOptions,
    },
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    mergedOptions
  )
}
