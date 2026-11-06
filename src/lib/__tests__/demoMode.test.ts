import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DemoStore, buildDemoWriteReply, demoStore, handleDemoMessage, isWriteMessage, shouldBlockHttp, transformDemoReply, demoHandleSend, __setDemoModeForTests,
} from '../demo/demoMode'

type Binding = { filter: { event: string }; callback: (m: any) => void }
const makeChannel = () => {
  const received: Array<{ event: string; payload: any }> = []
  const bindings: Binding[] = ['sql_result'].map(event => ({ filter: { event }, callback: (m: any) => received.push({ event: m.event, payload: m.payload }) }))
  return { channel: { bindings: { broadcast: bindings } }, received, listenQuery: (id: string) => bindings.push({ filter: { event: `query_result_${id}` }, callback: (m: any) => received.push({ event: m.event, payload: m.payload }) }) }
}
const msg = (payload: any) => ({ type: 'broadcast', event: 'sql_query', payload })

beforeEach(() => { demoStore.reset(); vi.useFakeTimers() })

describe('repositório sintético', () => {
  it('insert entra no topo da lista, com chave própria', () => {
    const s = new DemoStore()
    const row = s.insert('clientes', { nome: 'Cliente 01' }, 'id')
    expect(String(row.id)).toMatch(/^demo-/)
    expect(s.mergeRows('clientes', [{ id: 1, nome: 'Real' }]).map(r => r.nome)).toEqual(['Cliente 01', 'Real'])
  })

  it('editar altera a linha sintética e aplica a edição em linha real sem tocar no banco', () => {
    const s = new DemoStore()
    s.seed('clientes', { id: 's1', nome: 'Semente' }, 'id')
    s.update('clientes', 's1', { nome: 'Editada' })
    s.update('clientes', 1, { nome: 'Real editada' })
    expect(s.mergeRows('clientes', [{ id: 1, nome: 'Real' }, { id: 2, nome: 'Outra' }]).map(r => r.nome)).toEqual(['Editada', 'Real editada', 'Outra'])
  })

  it('excluir some da lista, seja sintética ou real', () => {
    const s = new DemoStore()
    s.seed('clientes', { id: 's1', nome: 'Semente' }, 'id')
    s.remove('clientes', 's1')
    s.remove('clientes', 2)
    expect(s.mergeRows('clientes', [{ id: 1, nome: 'Real' }, { id: 2, nome: 'Outra' }]).map(r => r.nome)).toEqual(['Real'])
  })

  it('o filtro da pesquisa vale para as linhas sintéticas (sem diferenciar maiúsculas)', () => {
    const s = new DemoStore()
    s.seed('clientes', { id: 's1', nome_empresa: 'Nome Empresa 01' }, 'id')
    expect(s.synthetic('clientes', { nome_empresa: 'empresa' })).toHaveLength(1)
    expect(s.synthetic('clientes', { nome_empresa: 'zzz' })).toHaveLength(0)
    expect(s.synthetic('clientes', { nome_empresa: '' })).toHaveLength(1)
  })

  it('a semente não duplica ao ser registrada de novo', () => {
    const s = new DemoStore()
    s.seed('t', { id: 'a', x: 1 }, 'id'); s.seed('t', { id: 'a', x: 1 }, 'id')
    expect(s.synthetic('t')).toHaveLength(1)
  })
})

describe('o que é leitura e o que é escrita', () => {
  it('só select, contagem e atualização de metadados leem; todo o resto é escrita', () => {
    for (const action of ['select', 'count_records', 'system_refresh']) expect(isWriteMessage(msg({ action }))).toBe(false)
    for (const action of ['insert', 'update', 'delete', 'execute_custom', 'trigger_bpm', 'trigger_bpm_sync', 'algo_novo', '']) expect(isWriteMessage(msg({ action }))).toBe(true)
    expect(isWriteMessage({ type: 'broadcast', event: 'outro', payload: { action: 'insert' } })).toBe(false)
  })

  it('escrita é respondida localmente, pelos dois eventos, e NÃO segue adiante', () => {
    const { channel, received, listenQuery } = makeChannel()
    listenQuery('q1')
    const handled = handleDemoMessage(channel, msg({ queryId: 'q1', action: 'insert', table: 'clientes', idColumn: 'id', data: { nome: 'Cliente 01' } }))
    expect(handled).toBe(true)
    vi.advanceTimersByTime(200)
    expect(received.map(r => r.event).sort()).toEqual(['query_result_q1', 'sql_result'])
    expect(received[0].payload).toMatchObject({ queryId: 'q1', success: true, demo: true, action: 'insert' })
    expect(received[0].payload.data[0]).toMatchObject({ nome: 'Cliente 01' })
  })

  it('leitura segue para o banco de verdade e fica registrada para ajustar a resposta', () => {
    const { channel } = makeChannel()
    expect(handleDemoMessage(channel, msg({ queryId: 'r1', action: 'select', table: 'clientes' }))).toBe(false)
    demoStore.insert('clientes', { nome: 'Cliente 01' }, 'id')
    const reply = transformDemoReply({ payload: { queryId: 'r1', success: true, data: [{ id: 1, nome: 'Real' }] } })
    expect(reply.payload.data.map((r: any) => r.nome)).toEqual(['Cliente 01', 'Real'])
    // não duplica se a mesma resposta passar por dois ouvintes
    transformDemoReply(reply)
    expect(reply.payload.data).toHaveLength(2)
  })

  it('a contagem do grid soma as linhas sintéticas; resposta de erro não é mexida', () => {
    const { channel } = makeChannel()
    handleDemoMessage(channel, msg({ queryId: 'c1', action: 'count_records', table: 'clientes' }))
    demoStore.insert('clientes', { nome: 'X' }, 'id')
    expect(transformDemoReply({ payload: { queryId: 'c1', success: true, total: 2 } }).payload.total).toBe(3)
    handleDemoMessage(channel, msg({ queryId: 'r2', action: 'select', table: 'clientes' }))
    const erro = { payload: { queryId: 'r2', success: false, error: 'x' } }
    expect(transformDemoReply(erro)).toBe(erro)
  })

  it('BPM síncrono devolve a própria linha; SQL customizado devolve sucesso vazio', () => {
    expect(buildDemoWriteReply({ action: 'trigger_bpm_sync', rowData: { a: 1 } }).data).toEqual([{ a: 1 }])
    expect(buildDemoWriteReply({ action: 'execute_custom', query: 'DELETE FROM x' })).toMatchObject({ success: true, data: [] })
  })

  it('fora do modo demonstração, o gancho dos canais não faz nada', () => {
    __setDemoModeForTests(false)
    expect(demoHandleSend(makeChannel().channel, msg({ action: 'insert', table: 't' }))).toBe(false)
    __setDemoModeForTests(true)
    expect(demoHandleSend(makeChannel().channel, msg({ action: 'insert', table: 't', queryId: 'z' }))).toBe(true)
    __setDemoModeForTests(null)
  })
})

describe('escrita por HTTP', () => {
  const origin = 'https://metabuilderpro.com'
  it('bloqueia escrita nas rotas /api e no REST do Supabase; deixa leitura e o relay passarem', () => {
    expect(shouldBlockHttp('POST', '/api/v1/help-feedback', origin)).toBe(true)
    expect(shouldBlockHttp('PUT', '/api/projects/1', origin)).toBe(true)
    expect(shouldBlockHttp('POST', 'https://x.supabase.co/rest/v1/ui_views', origin)).toBe(true)
    expect(shouldBlockHttp('PATCH', 'https://x.supabase.co/rest/v1/ui_views?id=eq.1', origin)).toBe(true)
    expect(shouldBlockHttp('POST', 'https://x.supabase.co/rest/v1/rpc/buscar', origin)).toBe(false)
    expect(shouldBlockHttp('GET', '/api/v1/help-feedback', origin)).toBe(false)
    expect(shouldBlockHttp('POST', '/api/tunnel/send', origin)).toBe(false)
    expect(shouldBlockHttp('POST', 'https://x.supabase.co/auth/v1/token', origin)).toBe(false)
  })
})

describe('linha sintética pela URL', () => {
  it('codifica e decodifica (com acentos) e recusa lixo', async () => {
    const { encodeDemoSeed, decodeDemoSeed } = await import('../demo/demoMode')
    const raw = encodeDemoSeed({ table: 'clientes', pk: 'id', row: { nome_empresa: 'Razão São Paulo 01' } })
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeDemoSeed(raw)).toEqual({ table: 'clientes', pk: 'id', row: { nome_empresa: 'Razão São Paulo 01' } })
    expect(decodeDemoSeed('%%%')).toBeNull()
    expect(decodeDemoSeed(encodeDemoSeed({ table: 'a b; drop', pk: 'id', row: {} } as any))).toBeNull()
    expect(decodeDemoSeed(null)).toBeNull()
  })
})

describe('exclusão em cascata (o caso do tutorial "Excluir" em Clientes)', () => {
  it('execute_custom com DELETE tira a linha raiz da lista, como a exclusão simples', () => {
    const { channel } = makeChannel()
    demoStore.seed('clientes', { id: 'demo-seed-1', nome_empresa: 'Nome Empresa 01' }, 'id')
    handleDemoMessage(channel, msg({ queryId: 'r0', action: 'select', table: 'clientes' }))
    const query = "DELETE FROM pedidos WHERE cliente_id = 'demo-seed-1'; DELETE FROM clientes WHERE id = 'demo-seed-1'"
    const reply = buildDemoWriteReply({ action: 'execute_custom', table: 'clientes', idColumn: 'id', idValue: 'demo-seed-1', query, sql: query })
    expect(reply).toMatchObject({ success: true, rowsAffected: 1 })
    expect(demoStore.mergeRows('clientes', [{ id: 1, nome_empresa: 'Real' }]).map(r => r.nome_empresa)).toEqual(['Real'])
  })

  it('exclusão simples também informa a linha afetada (o app trata 0 como "não encontrado")', () => {
    demoStore.seed('clientes', { id: 's1' }, 'id')
    expect(buildDemoWriteReply({ action: 'delete', table: 'clientes', idColumn: 'id', idValue: 's1' }).rowsAffected).toBe(1)
  })

  it('execute_custom que não é exclusão (ou sem id) continua só um sucesso vazio, sem tocar na lista', () => {
    demoStore.seed('clientes', { id: 's1' }, 'id')
    buildDemoWriteReply({ action: 'execute_custom', table: 'clientes', idValue: 's1', query: 'UPDATE clientes SET x = 1' })
    buildDemoWriteReply({ action: 'execute_custom', table: 'clientes', query: 'DELETE FROM clientes' })
    expect(demoStore.synthetic('clientes')).toHaveLength(1)
  })
})

describe('cache da lista no modo demonstração (sessionStorage é compartilhado com o app)', () => {
  const store: Record<string, string> = {}
  const fake = { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = v }, removeItem: (k: string) => { delete store[k] }, key: (i: number) => Object.keys(store)[i] ?? null, get length() { return Object.keys(store).length } }

  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k]
    vi.stubGlobal('window', {})
    vi.stubGlobal('sessionStorage', fake)
  })

  it('fora da demonstração o cache funciona como sempre', async () => {
    const { getCachedData, setCachedData } = await import('../viewCache')
    __setDemoModeForTests(false)
    setCachedData('p:clientes', [{ id: 1 }])
    expect(getCachedData('p:clientes')).toEqual([{ id: 1 }])
    __setDemoModeForTests(null)
  })

  it('na demonstração NÃO lê o cache real (começaria com as linhas reais antes da linha de exemplo)', async () => {
    const { getCachedData } = await import('../viewCache')
    store['metabuilder_cache_p:clientes'] = JSON.stringify([{ id: 1 }, { id: 2 }, { id: 3 }])
    __setDemoModeForTests(true)
    expect(getCachedData('p:clientes')).toBeNull()
    __setDemoModeForTests(null)
  })

  it('na demonstração NÃO grava no cache (poluiria a lista do app real com as linhas de exemplo)', async () => {
    const { setCachedData } = await import('../viewCache')
    __setDemoModeForTests(true)
    setCachedData('p:clientes', [{ id: 'demo-seed-1' }])
    expect(Object.keys(store)).toEqual([])
    __setDemoModeForTests(null)
  })
})
