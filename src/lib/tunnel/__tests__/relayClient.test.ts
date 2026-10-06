import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { deliverLocalError, needsRelay, patchChannelForRelay, projectIdFromTopic, relaySend, relayThroughChannel } from '../relayClient'

// o relay só age no navegador: simula a existência de `window` (sem precisar de jsdom)
beforeAll(() => { (globalThis as any).window = {} })
afterAll(() => { delete (globalThis as any).window })
const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

const PID = '123e4567-e89b-42d3-a456-426614174000'
const msg = (over: any = {}) => ({ type: 'broadcast', event: 'sql_query', payload: { queryId: 'q1', action: 'select', token: '', ...over } })

const res = (status: number, body: any = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as any

/** Canal falso com a mesma forma do RealtimeChannel: topic, send e bindings.broadcast. */
function fakeChannel(topic = `realtime:tunnel:${PID}`) {
  const direct: any[] = []
  const received: any[] = []
  const ch: any = {
    topic,
    bindings: { broadcast: [] as any[] },
    send: vi.fn(async (m: any) => { direct.push(m); return 'ok' }),
  }
  ch.listen = (event: string) => ch.bindings.broadcast.push({ filter: { event }, callback: (m: any) => received.push(m) })
  return { ch, direct, received }
}

describe('needsRelay', () => {
  it('só comando de dados sem token', () => {
    expect(needsRelay(msg())).toBe(true)
    expect(needsRelay(msg({ token: undefined }))).toBe(true)
    expect(needsRelay(msg({ token: 'abc' }))).toBe(false)
    expect(needsRelay({ type: 'broadcast', event: 'chunked_message', payload: {} })).toBe(false)
    expect(needsRelay({ type: 'broadcast', event: 'download_progress', payload: {} })).toBe(false)
    expect(needsRelay(null)).toBe(false)
  })
})

describe('projectIdFromTopic', () => {
  it('lê o id dos dois formatos de tópico', () => {
    expect(projectIdFromTopic(`realtime:tunnel:${PID}`)).toBe(PID)
    expect(projectIdFromTopic(`tunnel:${PID}`)).toBe(PID)
    expect(projectIdFromTopic('release-completion-notifier')).toBeNull()
    expect(projectIdFromTopic(undefined)).toBeNull()
  })
})

describe('relaySend', () => {
  it('envia o comando ao servidor com a sessão do navegador', async () => {
    const f = vi.fn(async () => res(202))
    const r = await relaySend(PID, msg(), f as any)
    expect(r.ok).toBe(true)
    const [url, init] = f.mock.calls[0] as any
    expect(url).toBe('/api/tunnel/send')
    expect(init.credentials).toBe('same-origin')
    expect(JSON.parse(init.body)).toEqual({ projectId: PID, event: 'sql_query', payload: msg().payload })
  })

  it('traduz as recusas e a falta de rede em mensagens claras', async () => {
    expect((await relaySend(PID, msg(), (async () => res(401)) as any)).error).toMatch(/Entre novamente/)
    expect((await relaySend(PID, msg(), (async () => res(403)) as any)).error).toMatch(/não é permitida/)
    expect((await relaySend(PID, msg(), (async () => res(500, { error: 'boom' })) as any)).error).toBe('boom')
    expect((await relaySend(PID, msg(), (async () => { throw new Error('net') }) as any)).error).toMatch(/Sem conexão/)
  })
})

describe('deliverLocalError', () => {
  it('avisa quem espera a resposta, pelos dois eventos do CLI, sem tocar em outros', () => {
    const { ch, received } = fakeChannel()
    ch.listen('sql_result'); ch.listen('query_result_q1'); ch.listen('query_result_outro'); ch.listen('bpm_workflow_completed')
    deliverLocalError(ch, 'q1', 'sem permissão')
    expect(received).toHaveLength(2)
    expect(received.every(m => m.payload.queryId === 'q1' && m.payload.success === false && m.payload.error === 'sem permissão')).toBe(true)
  })
})

describe('patchChannelForRelay', () => {
  it('comando sem token vai ao servidor e NÃO pelo canal', async () => {
    const { ch, direct } = fakeChannel()
    const f = vi.fn(async () => res(202))
    vi.stubGlobal('fetch', f)
    patchChannelForRelay(ch)
    expect(await ch.send(msg())).toBe('ok')
    expect(f).toHaveBeenCalledTimes(1)
    expect(direct).toHaveLength(0)
    
  })

  it('comando com token (relay desligado) segue direto pelo canal, como antes', async () => {
    const { ch } = fakeChannel()
    const original = ch.send
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    patchChannelForRelay(ch)
    await ch.send(msg({ token: 'tok' }))
    expect(original).toHaveBeenCalledTimes(1)
    expect(f).not.toHaveBeenCalled()
    
  })

  it('falha do servidor vira resultado de erro para quem espera, e o envio responde "error"', async () => {
    const { ch, received } = fakeChannel()
    ch.listen('sql_result')
    vi.stubGlobal('fetch', vi.fn(async () => res(401)))
    patchChannelForRelay(ch)
    expect(await ch.send(msg())).toBe('error')
    expect(received).toHaveLength(1)
    expect(received[0].payload.error).toMatch(/Entre novamente/)
    
  })

  it('canais que não são do túnel não são tocados e o patch é idempotente', () => {
    const other: any = { topic: 'release-completion-notifier', send: vi.fn() }
    const before = other.send
    patchChannelForRelay(other)
    expect(other.send).toBe(before)
    const { ch } = fakeChannel()
    patchChannelForRelay(ch)
    const once = ch.send
    patchChannelForRelay(ch)
    expect(ch.send).toBe(once)
  })

  it('relayThroughChannel sem id de projeto no tópico não envia', async () => {
    expect(await relayThroughChannel({ topic: 'outro' }, msg())).toBe('error')
  })
})

import { isPrivateTunnel, replyToFromTopic, setPrivateTunnel, tabSecret, tunnelTopicFor } from '../relayClient'

describe('tópico privado por aba', () => {
  const SECRET = 'sAbCdEfGhIjKlMnOpQrStU'
  afterEach(() => setPrivateTunnel(false))

  it('desligado, o nome do canal não muda (Studio e telas de sempre)', () => {
    expect(isPrivateTunnel()).toBe(false)
    expect(tunnelTopicFor(`tunnel:${PID}`)).toBe(`tunnel:${PID}`)
  })

  it('ligado, tunnel:<id> vira tunnel:<id>:<segredo da aba>, sempre o mesmo na aba; outros canais não mudam', () => {
    setPrivateTunnel(true)
    const t = tunnelTopicFor(`tunnel:${PID}`)
    expect(t).toBe(`tunnel:${PID}:${tabSecret()}`)
    expect(tunnelTopicFor(`tunnel:${PID}`)).toBe(t)
    expect(tabSecret()).toMatch(/^[A-Za-z0-9_-]{16,64}$/)
    expect(tunnelTopicFor('release-completion-notifier')).toBe('release-completion-notifier')
    expect(tunnelTopicFor(`tunnel:${PID}:ja-tem-segredo-abcdefghij`)).toBe(`tunnel:${PID}:ja-tem-segredo-abcdefghij`)
  })

  it('lê id do projeto e tópico de resposta dos formatos do Realtime', () => {
    expect(projectIdFromTopic(`realtime:tunnel:${PID}:${SECRET}`)).toBe(PID)
    expect(replyToFromTopic(`realtime:tunnel:${PID}:${SECRET}`)).toBe(`tunnel:${PID}:${SECRET}`)
    expect(replyToFromTopic(`realtime:tunnel:${PID}`)).toBeNull()
    expect(replyToFromTopic('outro-canal')).toBeNull()
  })

  it('o envio pelo servidor leva o tópico de resposta da aba', async () => {
    const { ch } = fakeChannel(`realtime:tunnel:${PID}:${SECRET}`)
    const f = vi.fn(async () => res(202))
    vi.stubGlobal('fetch', f)
    patchChannelForRelay(ch)
    await ch.send(msg())
    const body = JSON.parse((f.mock.calls[0] as any)[1].body)
    expect(body.projectId).toBe(PID)
    expect(body.payload.replyTo).toBe(`tunnel:${PID}:${SECRET}`)
  })

  it('sem tópico privado, o envio não leva replyTo', async () => {
    const { ch } = fakeChannel()
    const f = vi.fn(async () => res(202))
    vi.stubGlobal('fetch', f)
    patchChannelForRelay(ch)
    await ch.send(msg())
    expect(JSON.parse((f.mock.calls[0] as any)[1].body).payload.replyTo).toBeUndefined()
  })
})

import { setRelayMode } from '../relayClient'

describe('relay ligado na tela (Studio com token no comando)', () => {
  afterEach(() => setRelayMode(false))

  it('com o relay ligado até o comando que traz token vai pelo servidor, e o token NÃO segue', async () => {
    setRelayMode(true)
    const { ch, direct } = fakeChannel()
    const f = vi.fn(async () => res(202))
    vi.stubGlobal('fetch', f)
    patchChannelForRelay(ch)
    expect(needsRelay(msg({ token: 'tok-do-studio' }))).toBe(true)
    await ch.send(msg({ token: 'tok-do-studio' }))
    expect(direct).toHaveLength(0)
    const body = JSON.parse((f.mock.calls[0] as any)[1].body)
    expect(body.payload.token).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain('tok-do-studio')
  })

  it('com o relay desligado, o comando com token segue direto como sempre', () => {
    expect(needsRelay(msg({ token: 'tok' }))).toBe(false)
  })
})
