/**
 * Regras da página de retorno do login (/auth/callback), isoladas para teste.
 *
 * Problema que isto resolve: o código PKCE do login só pode ser trocado por sessão UMA vez (a troca consome o "verificador" guardado no cookie).
 * A página de retorno troca o código por conta própria, mas o cliente de login compartilhado (criado por outros componentes) também tentava trocar
 * o mesmo código sozinho ao carregar. Quem chegava primeiro funcionava e o outro mostrava "PKCE code verifier not found", mesmo com o login certo.
 */

/** A página atual é a de retorno do login? Nela só a própria página troca o código. */
export function isAuthCallbackPath(pathname: string | null | undefined): boolean {
  return typeof pathname === 'string' && /^\/auth\/callback(\/|$)/.test(pathname)
}

/**
 * Espera a sessão aparecer (a troca pode ter sido concluída por outro caminho um instante depois). Tenta `attempts` vezes, `delayMs` entre elas.
 * Devolve a sessão ou null se ela não aparecer.
 */
export async function waitForSession<T>(
  getSession: () => Promise<T | null | undefined>,
  attempts = 5,
  delayMs = 400,
  sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const session = await getSession()
      if (session) return session
    } catch { /* tenta de novo */ }
    if (i < attempts - 1) await sleep(delayMs)
  }
  return null
}
