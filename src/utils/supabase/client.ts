import { createBrowserClient } from '@supabase/ssr'
import { patchChannelForRelay, tunnelTopicFor } from '@/lib/tunnel/relayClient'
import { installDemoGuards } from '@/lib/demo/demoMode'
import { isAuthCallbackPath } from '@/lib/auth/callbackExchange'

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

  // Na página de retorno do login, só ela troca o código PKCE por sessão (a troca consome o verificador: duas trocas = erro na segunda).
  // O cliente compartilhado criado aqui não pode tentar trocar o mesmo código sozinho ao carregar.
  const onCallbackPage = typeof window !== 'undefined' && isAuthCallbackPath(window.location.pathname)

  const mergedOptions = {
    ...options,
    ...(onCallbackPage ? { auth: { detectSessionInUrl: false, ...options?.auth } } : {}),
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

  // modo demonstração (Ajuda Interativa): bloqueia escrita por HTTP; o canal do túnel é tratado em relayClient/chunkedChannel
  installDemoGuards()

  if (typeof window !== 'undefined' && !options) {
    clientInstance = client
  }

  return client
}
