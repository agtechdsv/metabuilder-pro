import { createBrowserClient } from '@supabase/ssr'
import { patchChannelForRelay, tunnelTopicFor } from '@/lib/tunnel/relayClient'

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

  // Canais do túnel: comandos sem token (relay ligado) passam pelo servidor, que coloca o token do projeto
  const originalChannel = client.channel.bind(client)
  client.channel = ((name: string, opts?: any) => patchChannelForRelay(originalChannel(tunnelTopicFor(name), opts))) as typeof client.channel

  if (typeof window !== 'undefined' && !options) {
    clientInstance = client
  }

  return client
}
