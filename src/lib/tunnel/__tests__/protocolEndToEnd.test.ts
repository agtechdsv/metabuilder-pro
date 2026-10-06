import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'node:module'
import { tunnelCall, TunnelTimeoutError, type TunnelTransport } from '../server'
import { authenticateCommand, signCommand } from '../commandSigning'
import { buildCommand } from '../relayPolicy'

// Simulação do caminho inteiro com um "Realtime" em memória e um Agente de verdade (security.js + replies.js):
// servidor → canal público → Agente (confere assinatura) → resposta no tópico privado → servidor.
const req = createRequire(import.meta.url)
const { authorizeCommand, NonceCache } = req('../../../../cli/security.js') as any
const { ReplyRouter } = req('../../../../cli/replies.js') as any

const PID = '123e4567-e89b-42d3-a456-426614174000'
const SECRET = 'segredo-do-projeto-0123456789abcdef'
const BASE = `tunnel:${PID}`

/** Realtime em memória: entrega cada mensagem a quem ouve aquele tópico e guarda tudo o que passou pelo canal público. */
function makeBus() {
  const listeners = new Map<string, Set<(event: string, payload: any) => void>>()
  const publicLog: Array<{ event: string; payload: any }> = []
  const deliver = (topic: string, event: string, payload: any) => {
    if (topic === BASE) publicLog.push({ event, payload })
    // entrega assíncrona, como a rede
    setTimeout(() => listeners.get(topic)?.forEach(cb => cb(event, JSON.parse(JSON.stringify(payload)))), 0)
  }
  const on = (topic: string, cb: (e: string, p: any) => void) => {
    if (!listeners.has(topic)) listeners.set(topic, new Set())
    listeners.get(topic)!.add(cb)
    return () => listeners.get(topic)!.delete(cb)
  }
  return { deliver, on, publicLog, listeners }
}

/** Agente: escuta o canal público, confere a autenticação e responde como o index.js faz. */
function startAgent(bus: ReturnType<typeof makeBus>, opts: { requireSigned?: boolean; answer?: (p: any) => any } = {}) {
  const baseChannel = { send: vi.fn(async ({ event, payload }: any) => bus.deliver(BASE, event, payload)) }
  const router = new ReplyRouter({
    projectId: PID, supabaseUrl: 'https://x.supabase.co', apiKey: 'k', baseChannel, sleep: async () => {},
    fetchImpl: async (_url: string, init: any) => {
      for (const m of JSON.parse(init.body).messages) bus.deliver(m.topic, m.event, m.payload)
      return { ok: true, status: 202 }
    },
  })
  const security = { projectId: PID, secretToken: SECRET, requireSigned: !!opts.requireSigned, nonces: new NonceCache() }
  const executed: any[] = []
  bus.on(BASE, async (event, payload) => {
    if (event !== 'sql_query') return
    const auth = authorizeCommand('sql_query', payload, security)
    if (!auth.ok) return // recusado: o Agente não responde
    executed.push({ mode: auth.mode, payload })
    const replyTo = router.accept(payload.replyTo)
    const body = opts.answer ? opts.answer(payload) : { queryId: payload.queryId, success: true, data: [{ ok: 1 }] }
    await router.reply(replyTo, 'sql_result', body)
    await router.reply(replyTo, `query_result_${payload.queryId}`, body)
  })
  return { executed, router }
}

function transportOn(bus: ReturnType<typeof makeBus>): TunnelTransport {
  return {
    async broadcast(topic, event, payload) { bus.deliver(topic, event, payload) },
    async subscribe(topic, onEvent) { return bus.on(topic, onEvent) },
  }
}

describe('protocolo de ponta a ponta (assinado + tópico privado)', () => {
  it('o servidor consulta, o Agente responde SÓ no tópico privado, e o token nunca passa pelo canal público', async () => {
    const bus = makeBus()
    const agent = startAgent(bus)
    const r = await tunnelCall(PID, 'sql_query', { queryId: 'q1', action: 'select' }, { transport: transportOn(bus), secret: SECRET })
    expect(r).toMatchObject({ queryId: 'q1', success: true })
    expect(agent.executed[0].mode).toBe('signed')

    // o canal público só viu o comando assinado: sem token, sem nenhuma resposta
    expect(bus.publicLog.map(m => m.event)).toEqual(['sql_query'])
    expect(JSON.stringify(bus.publicLog)).not.toContain(SECRET)
    expect(bus.publicLog.some(m => m.event.startsWith('sql_result') || m.event.startsWith('query_result'))).toBe(false)
  })

  it('resposta grande atravessa em pedaços e é remontada pelo servidor', async () => {
    const bus = makeBus()
    startAgent(bus, { answer: p => ({ queryId: p.queryId, success: true, data: [{ txt: 'z'.repeat(250_000) }] }) })
    const r = await tunnelCall(PID, 'sql_query', { queryId: 'q2' }, { transport: transportOn(bus), secret: SECRET })
    expect(r.data[0].txt).toHaveLength(250_000)
  })

  it('o fluxo do relay: comando montado pelo servidor para uma aba, com o tópico privado dela', async () => {
    const bus = makeBus()
    const agent = startAgent(bus, { requireSigned: true })
    const tab = `tunnel:${PID}:abcdefghijklmnopqrstuv`
    const tabGot: any[] = []
    bus.on(tab, (e, p) => tabGot.push({ e, p }))

    const command = buildCommand({ projectId: PID, event: 'sql_query', payload: { queryId: 'q3', action: 'select', replyTo: tab, token: 'FALSO' } }, SECRET, { sign: true })
    expect(command.token).toBeUndefined()
    bus.deliver(BASE, 'sql_query', command)
    await new Promise(r => setTimeout(r, 20))

    expect(agent.executed).toHaveLength(1)
    expect(tabGot.map(m => m.e).sort()).toEqual(['query_result_q3', 'sql_result'])
    // nada de resposta no canal público
    expect(bus.publicLog.filter(m => m.event !== 'sql_query')).toEqual([])
  })

  it('comando forjado (sem assinatura, com token errado ou adulterado) não é executado', async () => {
    const bus = makeBus()
    const agent = startAgent(bus, { requireSigned: true })
    const send = (p: any) => bus.deliver(BASE, 'sql_query', p)
    send({ queryId: 'a', action: 'select', query: 'SELECT 1' })
    send({ queryId: 'b', token: 'errado', action: 'select' })
    const ok = signCommand(SECRET, 'sql_query', PID, { queryId: 'c', action: 'select', query: 'SELECT 1' })
    send({ ...ok, query: 'DROP TABLE clientes' })
    await new Promise(r => setTimeout(r, 20))
    expect(agent.executed).toHaveLength(0)
  })

  it('a cópia de um comando válido, reenviada por quem ouviu o canal, é recusada', async () => {
    const bus = makeBus()
    const agent = startAgent(bus)
    const cmd = authenticateCommand(SECRET, 'sql_query', PID, { queryId: 'q4', action: 'select' }, { sign: true })
    bus.deliver(BASE, 'sql_query', cmd)
    bus.deliver(BASE, 'sql_query', cmd) // o "ouvinte" reenvia
    await new Promise(r => setTimeout(r, 20))
    expect(agent.executed).toHaveLength(1)
  })

  it('formato antigo: aceito pelo Agente enquanto não exigir assinatura; com a exigência, recusado', async () => {
    for (const requireSigned of [false, true]) {
      const bus = makeBus()
      const agent = startAgent(bus, { requireSigned })
      bus.deliver(BASE, 'sql_query', { queryId: 'old', action: 'select', token: SECRET })
      await new Promise(r => setTimeout(r, 20))
      expect(agent.executed).toHaveLength(requireSigned ? 0 : 1)
      if (!requireSigned) expect(agent.executed[0].mode).toBe('legacy')
    }
  })

  it('um estranho que ouve o canal público não recebe os resultados do servidor', async () => {
    const bus = makeBus()
    startAgent(bus)
    const snooped: string[] = []
    bus.on(BASE, (e) => snooped.push(e))
    await tunnelCall(PID, 'sql_query', { queryId: 'q5' }, { transport: transportOn(bus), secret: SECRET })
    expect(snooped).toEqual(['sql_query'])
  })

  it('Agente antigo (não entende assinatura) não responde: o servidor estoura o tempo em vez de pendurar', async () => {
    vi.useFakeTimers()
    const bus = makeBus()
    // um Agente "antigo": só aceita o token dentro do comando
    bus.on(BASE, (_e, payload) => { if (payload.token === SECRET) bus.deliver(BASE, 'sql_result', { queryId: payload.queryId, success: true }) })
    const p = tunnelCall(PID, 'sql_query', { queryId: 'q6' }, { transport: transportOn(bus), secret: SECRET, timeoutMs: 1000 })
    const assertion = expect(p).rejects.toBeInstanceOf(TunnelTimeoutError)
    await vi.advanceTimersByTimeAsync(1100)
    await assertion
    vi.useRealTimers()
  })
})
