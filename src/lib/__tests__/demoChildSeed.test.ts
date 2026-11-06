import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAutoTour } from '../interactiveHelp/autoTour'
import { decodeDemoSeed, demoStore, encodeDemoSeed, handleDemoMessage } from '../demo/demoMode'

beforeEach(() => demoStore.reset())

const sendSelect = (table: string, filters: Record<string, any>) => {
  const sent: any[] = []
  const channel: any = { bindings: { broadcast: [{ filter: { event: 'sql_result' }, callback: (m: any) => sent.push(m) }] } }
  const handled = handleDemoMessage(channel, { type: 'broadcast', event: 'sql_query', payload: { queryId: 'q1', action: 'select', table, filters } })
  return { handled, sent, channel }
}

describe('linhas de exemplo das abas de detalhe', () => {
  it('o seed viaja na URL com os filhos e volta validado', () => {
    const raw = encodeDemoSeed({ table: 'clientes', pk: 'id', row: { nome: 'A' }, children: [{ table: 'pedidos', row: { total: '10' } }] })
    const s = decodeDemoSeed(raw)!
    expect(s.children).toEqual([{ table: 'pedidos', pk: 'id', row: { total: '10' } }])
    // tabela com nome inválido é descartada
    const ruim = encodeDemoSeed({ table: 'clientes', pk: 'id', row: {}, children: [{ table: 'x; drop', row: {} }] })
    expect(decodeDemoSeed(ruim)!.children).toEqual([])
  })

  it('a leitura dos pedidos do cliente de exemplo é respondida aqui, sem ir ao banco', async () => {
    demoStore.seed('clientes', { nome: 'A' }, 'id')
    demoStore.seed('pedidos', { total: '10' }, 'id', true)
    const key = demoStore.synthetic('clientes')[0].id
    vi.useFakeTimers()
    const { handled, sent } = sendSelect('pedidos', { cliente_id: String(key) })
    await vi.advanceTimersByTimeAsync(500)
    vi.useRealTimers()
    expect(handled).toBe(true)
    expect(sent[0].payload.data).toHaveLength(1)
    expect(sent[0].payload.data[0].total).toBe('10')
    expect(sent[0].payload.data[0].__mbChild).toBeUndefined()
  })

  it('leitura comum (sem linha de exemplo no filtro) segue para o banco', () => {
    demoStore.seed('clientes', { nome: 'A' }, 'id')
    expect(sendSelect('pedidos', { cliente_id: '123' }).handled).toBe(false)
  })
})

describe('gerador: seedDetails', () => {
  const f = (id: string, extra: any = {}) => ({ id, label: id, column: id, type: 'text', dataType: 'text', ...extra })
  const input: any = {
    formFields: [f('nome', { required: true }), f('obs', { isDetail: true, detailModelId: 'm', detailTable: 'pedidos' })],
    filterFields: [], gridFields: [],
  }
  it('editar e ver levem a linha de exemplo da tabela do detalhe; cadastrar não', () => {
    expect(buildAutoTour(input, { action: 'edit' }).seedDetails?.[0].table).toBe('pedidos')
    expect(buildAutoTour(input, { action: 'view' }).seedDetails?.[0].table).toBe('pedidos')
    expect(buildAutoTour(input, { action: 'create' }).seedDetails).toBeUndefined()
  })
})
