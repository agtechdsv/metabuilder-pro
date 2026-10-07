import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const req = createRequire(import.meta.url)
const { ReplyRouter, CHUNK_SIZE } = req('../../../../cli/replies.js') as any
const { isPathInside } = req('../../../../cli/security.js') as any

const PID = '123e4567-e89b-42d3-a456-426614174000'
const TOPIC = `tunnel:${PID}:abcdefghijklmnopqrstuv`

function make(over: any = {}) {
  const posted: any[] = []
  const base = { send: vi.fn(async () => 'ok') }
  const router = new ReplyRouter({
    projectId: PID,
    supabaseUrl: 'https://x.supabase.co/',
    apiKey: 'chave',
    baseChannel: base,
    fetchImpl: async (url: string, init: any) => { posted.push({ url, init, body: JSON.parse(init.body) }); return { ok: true, status: 202 } },
    sleep: async () => {},
    ...over,
  })
  return { router, posted, base }
}

describe('ReplyRouter.accept', () => {
  it('só aceita tópico do próprio projeto com segredo longo', () => {
    const { router } = make()
    expect(router.accept(TOPIC)).toBe(TOPIC)
    for (const bad of [undefined, null, 5, '', `tunnel:${PID}`, `tunnel:${PID}:curto`, `tunnel:outro:abcdefghijklmnopqrstuv`, 'tunnel:' + PID + ':abc def ghijklmnopqrstu', 'qualquer-coisa']) {
      expect(router.accept(bad)).toBeNull()
    }
  })

  it('lembra as abas ativas e esquece as antigas', () => {
    let t = 0
    const { router } = make({ now: () => t, ttlMs: 1000 })
    router.accept(TOPIC)
    expect(router.activeTopics()).toEqual([TOPIC])
    t = 1001
    expect(router.activeTopics()).toEqual([])
  })
})

describe('ReplyRouter.reply', () => {
  it('com tópico privado: responde por HTTP só ali (nunca no canal público)', async () => {
    const { router, posted, base } = make()
    await router.reply(TOPIC, 'sql_result', { queryId: 'q', success: true })
    expect(base.send).not.toHaveBeenCalled()
    expect(posted).toHaveLength(1)
    expect(posted[0].url).toBe('https://x.supabase.co/realtime/v1/api/broadcast')
    expect(posted[0].init.headers.apikey).toBe('chave')
    expect(posted[0].body.messages[0]).toEqual({ topic: TOPIC, event: 'sql_result', payload: { queryId: 'q', success: true }, private: false })
  })

  it('sem tópico válido a resposta NÃO é enviada (nunca vai ao canal público)', async () => {
    const { router, posted, base } = make()
    await router.reply(null, 'sql_result', { queryId: 'q' })
    expect(posted).toHaveLength(0)
    expect(base.send).not.toHaveBeenCalled()
  })

  it('resposta grande vai em pedaços no formato que as telas já remontam', async () => {
    const { router, posted } = make()
    const big = { queryId: 'q', data: 'x'.repeat(CHUNK_SIZE * 2 + 500) }
    await router.reply(TOPIC, 'sql_result', big)
    expect(posted.length).toBe(3)
    const parts = posted.map(p => p.body.messages[0])
    expect(parts.every((m: any) => m.event === 'chunked_message' && m.topic === TOPIC && m.payload.event === 'sql_result' && m.payload.total === 3)).toBe(true)
    expect(JSON.parse(parts.map((m: any) => m.payload.data).join(''))).toEqual(big)
  })

  it('falha do serviço vira erro (e não vaza para o canal público)', async () => {
    const { router, base } = make({ fetchImpl: async () => ({ ok: false, status: 500 }) })
    await expect(router.reply(TOPIC, 'sql_result', {})).rejects.toThrow(/HTTP 500/)
    expect(base.send).not.toHaveBeenCalled()
  })
})

describe('ReplyRouter.broadcast', () => {
  it('aviso geral vai às abas ativas e, opcionalmente, ao canal de sempre', async () => {
    const { router, posted, base } = make()
    router.accept(TOPIC)
    router.accept(`tunnel:${PID}:zzzzzzzzzzzzzzzzzzzzzz`)
    await router.broadcast('bpm_workflow_completed', { table: 'pedidos' }, true)
    expect(posted).toHaveLength(2)
    expect(base.send).toHaveBeenCalledTimes(1)
    base.send.mockClear()
    await router.broadcast('bpm_workflow_completed', { table: 'pedidos' }, false)
    expect(base.send).not.toHaveBeenCalled()
  })

  it('uma aba com problema não impede as outras', async () => {
    let n = 0
    const { router, posted } = make({ fetchImpl: async (_u: string, init: any) => { posted.push(init); return n++ === 0 ? { ok: false, status: 500 } : { ok: true, status: 202 } } })
    router.accept(TOPIC)
    router.accept(`tunnel:${PID}:zzzzzzzzzzzzzzzzzzzzzz`)
    await expect(router.broadcast('x', {}, false)).resolves.toBeUndefined()
  })
})

describe('isPathInside (download e exclusão de arquivos do Agente)', () => {
  const root = mkdtempSync(join(tmpdir(), 'mb-cli-'))
  const exports = join(root, 'exports')
  mkdirSync(exports)
  writeFileSync(join(exports, 'a.csv'), 'x')
  writeFileSync(join(root, 'segredo.txt'), 'x')

  it('aceita arquivos da pasta de exportações, existentes ou não', () => {
    expect(isPathInside(exports, join(exports, 'a.csv'))).toBe(true)
    expect(isPathInside(exports, join(exports, 'sub', 'novo.csv'))).toBe(true)
  })

  it('recusa fora da pasta, subida com .., a própria pasta, vazio e caracteres nulos', () => {
    expect(isPathInside(exports, join(root, 'segredo.txt'))).toBe(false)
    expect(isPathInside(exports, join(exports, '..', 'segredo.txt'))).toBe(false)
    expect(isPathInside(exports, exports)).toBe(false)
    expect(isPathInside(exports, '')).toBe(false)
    expect(isPathInside(exports, join(exports, 'a.csv\0.txt'))).toBe(false)
    expect(isPathInside(exports, undefined as any)).toBe(false)
    expect(isPathInside(exports, process.platform === 'win32' ? 'C:\\Windows\\win.ini' : '/etc/passwd')).toBe(false)
  })

  it('recusa um atalho (link) que aponta para fora', () => {
    try {
      symlinkSync(join(root, 'segredo.txt'), join(exports, 'atalho.csv'))
    } catch {
      return // sem permissão para criar links neste sistema: o resto do comportamento já foi coberto
    }
    expect(isPathInside(exports, join(exports, 'atalho.csv'))).toBe(false)
  })

  it('limpeza', () => { rmSync(root, { recursive: true, force: true }) })
})
