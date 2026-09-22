import { createBrowserClient } from '@supabase/ssr'

const createDefaultClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

let clientInstance: ReturnType<typeof createDefaultClient> | undefined

export function createClient(options?: any) {
  // Return cached singleton in browser if no custom options
  if (typeof window !== 'undefined' && !options && clientInstance) {
    return clientInstance
  }

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
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      ...options?.cookieOptions,
    },
  }

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    mergedOptions
  )

  if (typeof window !== 'undefined' && !options) {
    clientInstance = client
  }

  return client
}
