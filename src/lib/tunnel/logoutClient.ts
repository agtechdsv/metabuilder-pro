/**
 * Apaga as listas que as telas guardam na aba (aceleração do próximo carregamento). Sem isto, depois do logout ou da
 * troca de usuário a aba ainda mostrava os dados de quem estava logado antes. Nunca lança.
 */
export function clearViewCaches(): void {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith('metabuilder_cache_')) sessionStorage.removeItem(key)
    }
  } catch { /* sem armazenamento: nada a limpar */ }
}

let sessionEndHandled = false

/**
 * O servidor recusou a sessão do usuário final (401: desativado/removido no banco, sessão vencida ou adulterada).
 * Encerra a sessão, avisa e leva ao login (voltando à tela de origem depois). Roda uma única vez por página, ainda
 * que várias consultas falhem juntas (o BI dispara várias). Só age no runtime do usuário final (onde existe o cookie
 * `client_session_*`); na IDE e na tela de login não faz nada.
 */
export function handleEndUserSessionEnded(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined' || sessionEndHandled) return
  let m: RegExpMatchArray | null = null
  try { m = document.cookie.match(/(?:^|;\s*)client_session_([^=;]+)=/) } catch { return }
  if (!m) return
  const path = window.location.pathname
  if (/\/login\/?$/.test(path) || path.startsWith('/admin') || path.startsWith('/workspace')) return
  sessionEndHandled = true
  void logoutEndUser(m[1]).finally(() => {
    // 1,5s para ler o aviso (que quem chamou já mostra). Sem sessão, o layout do runtime leva ao login guardando a
    // tela de origem em ?next= (mesmo caminho do acesso sem login: domínio próprio, pastas, ?preview=draft).
    setTimeout(() => window.location.reload(), 1500)
  })
}

/**
 * Sai da sessão do usuário final: o servidor apaga a sessão assinada (o navegador não consegue, ela é httpOnly) e o
 * cookie de exibição é limpo aqui. Seguro de chamar com o relay desligado (só limpa o cookie).
 */
export async function logoutEndUser(projectId: string): Promise<void> {
  clearViewCaches()
  try {
    await fetch('/api/runtime/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    })
  } catch {
    /* sem rede: ainda assim limpa o cookie local */
  }
  document.cookie = `client_session_${projectId}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`
}
