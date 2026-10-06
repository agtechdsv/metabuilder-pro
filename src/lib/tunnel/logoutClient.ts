/**
 * Sai da sessão do usuário final: o servidor apaga a sessão assinada (o navegador não consegue, ela é httpOnly) e o
 * cookie de exibição é limpo aqui. Seguro de chamar com o relay desligado (só limpa o cookie).
 */
export async function logoutEndUser(projectId: string): Promise<void> {
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
