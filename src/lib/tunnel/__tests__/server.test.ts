import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChunkAssembler, TunnelTimeoutError, chunkMessages, clearTokenCache, getProjectSecretToken, relayEnabled, tunnelCall, tunnelSend, type TunnelTransport } from '../server'

/** Transporte falso: guarda o que foi enviado e deixa o teste "responder" como se fosse o Agente CLI. */
function fakeTransport(onSend?: (topic: string, event: string, payload: any, emit: (event: string, payload: any) => void) => void) {
  const sent: Array<{ topic: string; event: string; payload: any }> = []
  let listener: ((event: string, payload: any) => void) | null = null
  let unsubscribed = 0
  const transport: TunnelTransport = {
    async broadcast(topic, event, payload) {
      sent.push({ topic, event, payload })
      onSend?.(topic, event, payload, (e, p) => listener?.(e, p))
    },
    async subscribe(_topic, onEvent) {
      listener = onEvent
      return () => { unsubscribed++ }
    },
  }
  return { transport, sent, get unsubscribed() { return unsubscribed }, emit: (e: string, p: any) => listener?.(e, p) }
}

describe('relayEnabled', () => {
  it('o relay não tem chave: é sempre o caminho', () => {
    expect(relayEnabled()).toBe(true)
    expect(relayEnabled({ TUNNEL_RELAY: 'off' })).toBe(true)
  })
})

describe('chunkMessages / ChunkAssembler', () => {
  it('comando pequeno vai inteiro', () => {
    expect(chunkMessages('sql_query', { a: 1 })).toEqual([{ event: 'sql_query', payload: { a: 1 } }])
  })

  it('comando grande vira pedaços no formato do navegador e do CLI, e volta igual', () => {
    const payload = { queryId: 'q', sql: 'x'.repeat(2500), token: 't' }
    const msgs = chunkMessages('sql_query', payload, 1000, () => 'id-1')
    expect(msgs.length).toBeGreaterThan(2)
    expect(msgs.every(m => m.event === 'chunked_message' && m.payload.chunkId === 'id-1' && m.payload.total === msgs.length)).toBe(true)
    const asm = new ChunkAssembler()
    // fora de ordem também funciona
    const done = [...msgs].reverse().map(m => asm.push(m.payload)).filter(Boolean)
    expect(done).toHaveLength(1)
    expect(done[0]).toEqual({ event: 'sql_query', payload })
  })

  it('pedaço inválido é ignorado', () => {
    const asm = new ChunkAssembler()
    expect(asm.push({ chunkId: 'a', index: 0, total: 0, event: 'e', data: '' })).toBeNull()
    expect(asm.push({ chunkId: 'a', index: 0, total: 1, event: 'e', data: '{quebrado' })).toBeNull()
    expect(asm.push(null as any)).toBeNull()
  })
})

describe('tunnelSend', () => {
  it('envia ao tópico do projeto', async () => {
    const f = fakeTransport()
    await tunnelSend('proj', 'sql_query', { queryId: 'q', token: 't' }, f.transport)
    expect(f.sent).toEqual([{ topic: 'tunnel:proj', event: 'sql_query', payload: { queryId: 'q', token: 't' } }])
  })
})

describe('tunnelCall', () => {
  it('ouve ANTES de enviar e devolve a resposta do mesmo queryId', async () => {
    const order: string[] = []
    const f = fakeTransport((_t, _e, p, emit) => { order.push('send'); emit('sql_result', { queryId: p.queryId, success: true, data: [{ id: 1 }] }) })
    const orig = f.transport.subscribe
    f.transport.subscribe = async (t, cb) => { order.push('subscribe'); return orig(t, cb) }
    const r = await tunnelCall('proj', 'sql_query', { queryId: 'q1', action: 'validate_login' }, { transport: f.transport })
    expect(r).toEqual({ queryId: 'q1', success: true, data: [{ id: 1 }] })
    expect(order).toEqual(['subscribe', 'send'])
    expect(f.unsubscribed).toBe(1)
  })

  it('ignora respostas de outras consultas', async () => {
    const f = fakeTransport((_t, _e, p, emit) => {
      emit('sql_result', { queryId: 'outra', success: true, data: ['errada'] })
      emit(`query_result_${p.queryId}`, { queryId: p.queryId, success: true, data: ['certa'] })
    })
    const r = await tunnelCall('proj', 'sql_query', { queryId: 'q2' }, { transport: f.transport })
    expect(r.data).toEqual(['certa'])
  })

  it('resposta grande chega em pedaços e é remontada', async () => {
    const big = { queryId: 'q3', success: true, data: [{ txt: 'y'.repeat(3000) }] }
    const f = fakeTransport((_t, _e, p, emit) => {
      for (const m of chunkMessages('sql_result', { ...big, queryId: p.queryId }, 1000)) emit(m.event, m.payload)
    })
    const r = await tunnelCall('proj', 'sql_query', { queryId: 'q3' }, { transport: f.transport })
    expect(r.data[0].txt).toHaveLength(3000)
  })

  it('sem resposta, estoura o tempo e encerra a escuta', async () => {
    vi.useFakeTimers()
    const f = fakeTransport()
    const p = tunnelCall('proj', 'sql_query', { queryId: 'q4' }, { transport: f.transport, timeoutMs: 1000 })
    const assertion = expect(p).rejects.toBeInstanceOf(TunnelTimeoutError)
    await vi.advanceTimersByTimeAsync(1001)
    await assertion
    expect(f.unsubscribed).toBe(1)
    vi.useRealTimers()
  })

  it('falha ao enviar derruba a chamada na hora', async () => {
    const f = fakeTransport()
    f.transport.broadcast = async () => { throw new Error('HTTP 500') }
    await expect(tunnelCall('proj', 'sql_query', { queryId: 'q5' }, { transport: f.transport })).rejects.toThrow('HTTP 500')
    expect(f.unsubscribed).toBe(1)
  })
})

describe('getProjectSecretToken', () => {
  beforeEach(() => clearTokenCache())
  const client = (row: any, spy = vi.fn()) => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => { spy(); return { data: row, error: null } } }) }) }),
  }) as any

  it('lê do banco e guarda por 1 minuto', async () => {
    const spy = vi.fn()
    let t = 0
    const c = client({ secret_token: 'abc' }, spy)
    expect(await getProjectSecretToken('p', { client: c, now: () => t })).toBe('abc')
    t = 30_000
    expect(await getProjectSecretToken('p', { client: c, now: () => t })).toBe('abc')
    expect(spy).toHaveBeenCalledTimes(1)
    t = 61_000
    await getProjectSecretToken('p', { client: c, now: () => t })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('projeto sem token ou inexistente devolve null (e não guarda)', async () => {
    expect(await getProjectSecretToken('p', { client: client({ secret_token: null }) })).toBeNull()
    expect(await getProjectSecretToken('p', { client: client(null) })).toBeNull()
  })
})

import { clearPublicCache, isProjectPublic } from '../authorize'

describe('isProjectPublic', () => {
  beforeEach(() => clearPublicCache())
  const cfg = (row: any, error: any = null) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error }) }) }) }) }) as any

  it('sem configuração de login ou com tipo "none" o projeto é aberto', async () => {
    expect(await isProjectPublic('a', { client: cfg(null) })).toBe(true)
    clearPublicCache()
    expect(await isProjectPublic('a', { client: cfg({ auth_type: 'none' }) })).toBe(true)
  })
  it('com login configurado NÃO é aberto, e erro de banco também fecha', async () => {
    expect(await isProjectPublic('a', { client: cfg({ auth_type: 'database' }) })).toBe(false)
    clearPublicCache()
    expect(await isProjectPublic('a', { client: cfg(null, { message: 'x' }) })).toBe(false)
  })
})

import { isValidReplyTopic, commandTopic, commandTopicFor } from '../commandSigning'
import { tunnelCallAuto } from '../server'

describe('tunnelCall assinado (tópico privado)', () => {
  const PID = '123e4567-e89b-42d3-a456-426614174000'

  it('assina o comando, tira o token e escuta só o tópico privado que ele indicou', async () => {
    const topics: string[] = []
    let command: any
    const f = fakeTransport((_t, _e, p, emit) => { command = p; emit('sql_result', { queryId: p.queryId, success: true, data: [1] }) })
    const orig = f.transport.subscribe
    f.transport.subscribe = async (t, cb) => { topics.push(t); return orig(t, cb) }

    const r = await tunnelCall(PID, 'sql_query', { queryId: 'q', action: 'select' }, { transport: f.transport, secret: 'segredo-do-projeto-123456' })
    expect(r.data).toEqual([1])
    expect(topics).toHaveLength(1)
    expect(isValidReplyTopic(PID, topics[0])).toBe(true)
    expect(topics[0]).not.toBe(`tunnel:${PID}`)
    expect(command.token).toBeUndefined()
    expect(typeof command.sig).toBe('string')
    expect(command.replyTo).toBe(topics[0])
    // o comando vai ao tópico PRIVADO de comandos (derivado do token), não ao canal público
    expect(f.sent[0].topic).toBe(commandTopic(PID, 'segredo-do-projeto-123456'))
    expect(f.sent[0].topic).not.toBe(`tunnel:${PID}`)
  })

  it('resposta no canal PÚBLICO não é aceita no modo privado', async () => {
    vi.useFakeTimers()
    const f = fakeTransport()
    const p = tunnelCall(PID, 'sql_query', { queryId: 'q' }, { transport: f.transport, secret: 'segredo-do-projeto-123456', timeoutMs: 500 })
    const assertion = expect(p).rejects.toBeInstanceOf(TunnelTimeoutError)
    // simula uma "resposta" forjada que só poderia chegar em outro tópico: o falso transporte entrega tudo ao mesmo ouvinte,
    // então aqui provamos apenas que, sem resposta no tópico certo, estoura o tempo
    await vi.advanceTimersByTimeAsync(501)
    await assertion
    vi.useRealTimers()
  })

  it('tunnelCallAuto: tira o token do comando e o envia assinado', async () => {
    const mk = () => {
      let command: any
      const f = fakeTransport((_t, _e, p, emit) => { command = p; emit('sql_result', { queryId: p.queryId, success: true, data: [] }) })
      return { f, get command() { return command } }
    }
    const on = mk()
    await tunnelCallAuto(PID, { queryId: 'a', token: 'segredo-do-projeto-123456', action: 'select' }, { transport: on.f.transport })
    expect(on.command.token).toBeUndefined()
    expect(on.command.sig).toBeTruthy()
  })
})

describe('tópico privado de comandos', () => {
  const PID2 = '123e4567-e89b-42d3-a456-426614174000'
  it('é derivado do token: mesmo token e projeto dão o mesmo tópico; outro token ou projeto, outro', () => {
    const a = commandTopic(PID2, 'token-a-0123456789')
    expect(a).toBe(commandTopic(PID2, 'token-a-0123456789'))
    expect(a).not.toBe(commandTopic(PID2, 'token-b-0123456789'))
    expect(a).not.toBe(commandTopic('outro-projeto', 'token-a-0123456789'))
    expect(a.startsWith('tunnel-cmd:' + PID2 + ':')).toBe(true)
    expect(a).not.toContain('token-a')
  })

  it('só o servidor e o Agente calculam o mesmo valor (a conta é idêntica no CLI)', () => {
    const { commandTopic: cli } = require('../../../../cli/security.js')
    expect(cli(PID2, 'token-a-0123456789')).toBe(commandTopic(PID2, 'token-a-0123456789'))
  })

  it('sem token só existe o canal público; TUNNEL_COMMAND_TOPIC=public volta a ele (período de transição)', () => {
    expect(commandTopicFor(PID2, undefined, {})).toBe('tunnel:' + PID2)
    expect(commandTopicFor(PID2, 'token-a-0123456789', {})).toBe(commandTopic(PID2, 'token-a-0123456789'))
    expect(commandTopicFor(PID2, 'token-a-0123456789', { TUNNEL_COMMAND_TOPIC: 'public' })).toBe('tunnel:' + PID2)
  })
})
