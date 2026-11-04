import { createHash, timingSafeEqual } from 'crypto'

/**
 * Webhook de entrada dos fluxos BPM: pura lógica de segurança e de entrada, sem rede.
 *
 * O segredo de cada fluxo aparece uma única vez no Studio; o que fica guardado no gatilho é só o hash SHA-256
 * (`triggerWebhookSecretHash`). Sem hash configurado o fluxo NÃO aceita chamadas (fechado por padrão).
 */

export const WEBHOOK_MAX_BODY_BYTES = 64 * 1024
export const WEBHOOK_MAX_FIELDS = 100
const WEBHOOK_MAX_VALUE_LENGTH = 4000

export const sha256Hex = (text: string) => createHash('sha256').update(text).digest('hex')

/** Compara o segredo apresentado com o hash guardado, em tempo constante */
export function secretMatches(presented: string | null | undefined, storedHash: string | null | undefined): boolean {
  if (!presented || !storedHash || !/^[0-9a-f]{64}$/i.test(storedHash)) return false
  const a = Buffer.from(sha256Hex(presented), 'hex')
  const b = Buffer.from(storedHash.toLowerCase(), 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Segredo vindo de `Authorization: Bearer <segredo>` ou `X-Webhook-Secret` (nunca da URL, que vai parar em logs) */
export function extractSecret(headers: { get(name: string): string | null }): string | null {
  const auth = headers.get('authorization')
  if (auth) {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim())
    if (m) return m[1].trim()
  }
  const custom = headers.get('x-webhook-secret')
  return custom ? custom.trim() : null
}

/** O gatilho de webhook do fluxo (nó `trigger` com o tipo `webhook`), se houver */
export function findWebhookTrigger(flowData: any): { secretHash: string | null; method: string } | null {
  const nodes: any[] = Array.isArray(flowData?.nodes) ? flowData.nodes : []
  for (const node of nodes) {
    if (node?.type !== 'trigger') continue
    const raw = node.data?.triggerType
    const types: string[] = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((t: any) => String(t).toLowerCase())
    if (!types.includes('webhook')) continue
    return {
      secretHash: typeof node.data?.triggerWebhookSecretHash === 'string' ? node.data.triggerWebhookSecretHash : null,
      method: String(node.data?.triggerWebhookMethod || 'POST').toUpperCase(),
    }
  }
  return null
}

/**
 * Corpo/consulta recebido → objeto plano que o fluxo usa como `{{webhook.campo}}`.
 * Só chaves simples (letras, números e _), valores primitivos (objetos viram texto JSON), com limites de quantidade e tamanho.
 */
export function toFlowData(input: unknown): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out
  let count = 0
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (count >= WEBHOOK_MAX_FIELDS) break
    if (!/^[A-Za-z0-9_]{1,64}$/.test(key)) continue
    if (value === null || typeof value === 'number' || typeof value === 'boolean') out[key] = value as any
    else if (typeof value === 'string') out[key] = value.slice(0, WEBHOOK_MAX_VALUE_LENGTH)
    else out[key] = JSON.stringify(value).slice(0, WEBHOOK_MAX_VALUE_LENGTH)
    count++
  }
  return out
}
