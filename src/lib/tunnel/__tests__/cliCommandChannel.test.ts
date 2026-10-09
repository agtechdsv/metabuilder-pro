import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'node:module'

const req = createRequire(import.meta.url)
const { fanIn } = req('../../../../cli/commandChannel.js') as any

function fakeChannel(name: string) {
  const handlers: Array<{ event: string; cb: (m: any) => void }> = []
  let status: ((s: string) => void) | null = null
  return {
    name, handlers, sent: [] as any[],
    on: (_t: string, f: { event: string }, cb: (m: any) => void) => { handlers.push({ event: f.event, cb }) },
    send: vi.fn(async function (this: any, m: any) { return m }),
    subscribe: (cb: (s: string) => void) => { status = cb },
    unsubscribe: vi.fn(),
    bindings: { broadcast: [] },
    emitStatus: (s: string) => status?.(s),
  }
}

describe('Agente: ouve os comandos nos dois tópicos', () => {
  it('o mesmo tratador vale no tópico privado e no público', () => {
    const priv = fakeChannel('priv'), pub = fakeChannel('pub')
    const ch = fanIn([priv, pub], pub)
    const cb = vi.fn()
    ch.on('broadcast', { event: 'sql_query' }, cb)
    expect(priv.handlers).toHaveLength(1)
    expect(pub.handlers).toHaveLength(1)
    priv.handlers[0].cb({ payload: 1 })
    pub.handlers[0].cb({ payload: 2 })
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('"pronto" só depois de TODOS os tópicos inscritos; falha é repassada na hora', () => {
    const priv = fakeChannel('priv'), pub = fakeChannel('pub')
    const ch = fanIn([priv, pub], pub)
    const status = vi.fn()
    ch.subscribe(status)
    priv.emitStatus('SUBSCRIBED')
    expect(status).not.toHaveBeenCalled()
    pub.emitStatus('SUBSCRIBED')
    expect(status).toHaveBeenCalledWith('SUBSCRIBED', undefined)
    priv.emitStatus('CHANNEL_ERROR')
    expect(status).toHaveBeenLastCalledWith('CHANNEL_ERROR', undefined)
  })

  it('envios sem destino certo (avisos) vão só ao canal indicado', async () => {
    const priv = fakeChannel('priv'), pub = fakeChannel('pub')
    const ch = fanIn([priv, pub], pub)
    await ch.send({ type: 'broadcast', event: 'download_progress', payload: {} })
    expect(pub.send).toHaveBeenCalledTimes(1)
    expect(priv.send).not.toHaveBeenCalled()
  })
})
