import { describe, it, expect } from 'vitest'
import { sha256Hex, secretMatches, extractSecret, findWebhookTrigger, toFlowData } from '../webhookInbound'

const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null })

describe('webhook de entrada dos fluxos BPM', () => {
  it('só aceita o segredo cujo hash está guardado', () => {
    const hash = sha256Hex('whsec_abc')
    expect(secretMatches('whsec_abc', hash)).toBe(true)
    expect(secretMatches('whsec_abd', hash)).toBe(false)
    expect(secretMatches('', hash)).toBe(false)
    expect(secretMatches(null, hash)).toBe(false)
  })

  it('fechado por padrão: sem hash (ou hash inválido) nada passa', () => {
    expect(secretMatches('qualquer', null)).toBe(false)
    expect(secretMatches('qualquer', '')).toBe(false)
    expect(secretMatches('qualquer', 'não-é-hash')).toBe(false)
  })

  it('lê o segredo do Authorization Bearer ou do X-Webhook-Secret', () => {
    expect(extractSecret(headers({ authorization: 'Bearer abc123' }))).toBe('abc123')
    expect(extractSecret(headers({ authorization: 'bearer  abc123 ' }))).toBe('abc123')
    expect(extractSecret(headers({ 'x-webhook-secret': ' xyz ' }))).toBe('xyz')
    expect(extractSecret(headers({ authorization: 'Basic abc' }))).toBeNull()
    expect(extractSecret(headers({}))).toBeNull()
  })

  it('acha o gatilho de webhook e seu segredo/método', () => {
    const flow = { nodes: [
      { type: 'action', data: {} },
      { type: 'trigger', data: { triggerType: ['insert', 'webhook'], triggerWebhookSecretHash: 'h', triggerWebhookMethod: 'put' } },
    ] }
    expect(findWebhookTrigger(flow)).toEqual({ secretHash: 'h', method: 'PUT' })
    expect(findWebhookTrigger({ nodes: [{ type: 'trigger', data: { triggerType: ['insert'] } }] })).toBeNull()
    expect(findWebhookTrigger({ nodes: [{ type: 'trigger', data: { triggerType: 'webhook' } }] })).toEqual({ secretHash: null, method: 'POST' })
    expect(findWebhookTrigger(null)).toBeNull()
  })

  it('transforma a entrada num objeto plano e limitado', () => {
    expect(toFlowData({ a: 1, b: 'x', c: true, d: null, e: { k: 1 }, 'chave inválida': 1, 'a;b': 2 })).toEqual({ a: 1, b: 'x', c: true, d: null, e: '{"k":1}' })
    expect(toFlowData([1, 2])).toEqual({})
    expect(toFlowData('texto')).toEqual({})
    expect(toFlowData(null)).toEqual({})
    expect(toFlowData({ longo: 'x'.repeat(10000) }).longo).toHaveLength(4000)
    const many = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`k${i}`, i]))
    expect(Object.keys(toFlowData(many))).toHaveLength(100)
  })
})
