import { createBrowserClient } from '@supabase/ssr'
import { patchChannelForRelay, tunnelTopicFor } from '@/lib/tunnel/relayClient'
import { installDemoGuards } from '@/lib/demo/demoMode'
import { shouldSkipUrlSessionDetection } from '@/lib/auth/callbackExchange'
import { createRefreshGuard } from '@/lib/auth/refreshGuard'

// Um disjuntor por página, compartilhado por todos os clientes: corta a avalanche de renovações de token depois de um 429 (limite por IP).
let refreshGuardedFetch: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | undefined
function guardedFetch() {
  if (typeof window === 'undefined') return undefined
  if (!refreshGuardedFetch) {
    refreshGuardedFetch = createRefreshGuard((input, init) => fetch(input, init), {
      onBlock: ({ status }) => console.warn(`[auth] renovação de token recusada (${status}): pausando novas tentativas desta página. Origem da chamada:`, new Error().stack),
    })
  }
  return refreshGuardedFetch
}

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
  const onCallbackPage = typeof window !== 'undefined' && shouldSkipUrlSessionDetection(window.location.pathname, window.location.search, window.location.hash)

  const guard = guardedFetch()
  const mergedOptions = {
    ...options,
    ...(guard ? { global: { ...options?.global, fetch: options?.global?.fetch ?? guard } } : {}),
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
