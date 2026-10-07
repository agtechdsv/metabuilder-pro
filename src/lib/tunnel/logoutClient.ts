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
