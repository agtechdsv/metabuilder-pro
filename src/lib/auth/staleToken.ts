/**
 * Decide se o erro do Supabase Auth indica um token de renovação que não vale mais (ou que está em loop de renovação).
 * Nesses casos a tela de login limpa a sessão local e para de tentar: assim um cookie ruim nunca vira loop de requisições.
 * 400 = token inválido/já usado; 429 = limite de requisições do Auth atingido (o que aconteceu na VM em 2026-11-16).
 */
export function isStaleRefreshError(error: { message?: string; status?: number; code?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.status === 400 || error.status === 429) return true
  const text = `${error.message ?? ''} ${error.code ?? ''}`.toLowerCase()
  return (
    text.includes('invalid refresh token') ||
    text.includes('refresh token not found') ||
    text.includes('refresh_token_not_found') ||
    text.includes('refresh_token_already_used') ||
    text.includes('over_request_rate_limit') ||
    text.includes('request rate limit')
  )
}
