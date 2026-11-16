import { timingSafeEqual } from 'node:crypto'

/**
 * Confere a chamada das rotinas agendadas (/api/cron/*). Em produção a Vercel manda `Authorization: Bearer <CRON_SECRET>`.
 *
 * Antes, cada rota comparava com `Bearer ${process.env.CRON_SECRET}`: sem a variável, o texto esperado virava "Bearer undefined" e qualquer
 * pessoa que o enviasse passava. Agora, sem segredo configurado, a rota RECUSA tudo. Fora da produção (desenvolvimento) segue livre, como era.
 */
export function isCronAuthorized(req: Request): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const secret = process.env.CRON_SECRET
  if (!secret || !secret.trim()) return false
  const sent = Buffer.from(req.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return sent.length === expected.length && timingSafeEqual(sent, expected)
}
