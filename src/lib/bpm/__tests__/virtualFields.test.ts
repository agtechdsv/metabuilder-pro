import { describe, it, expect } from 'vitest'
import { virtualFieldsForTable, compileVirtualField } from '../virtualFields'

// o mesmo desenho do caso de uso Pedidos do projeto Vendas PG: Total Item = quantidade × preço (itens), Total Pedido = SOMA(Total Item)
const op = (value: string) => ({ type: 'operator', value })
const field = (value: string) => ({ type: 'field', value })
const totalItem = { label: { text: 'Total Item' }, virtual_model_id: 'm_items', content: { formula_tokens: [field('itens_pedido.quantidade'), op('*'), field('itens_pedido.preco_unitario')] } }
const totalPedido = { label: { text: 'Total Pedido' }, virtual_model_id: 'm_orders', content: { formula_tokens: [{ type: 'function', value: 'SOMA' }, op('('), field('itens_pedido.virt_em0m10oj'), op(')')] } }

const models = [{ id: 'm_orders', db_table_name: 'pedidos' }, { id: 'm_items', db_table_name: 'itens_pedido' }, { id: 'm_deliv', db_table_name: 'entregas' }]
const joins = [{ from: 'pedidos', to: 'itens_pedido', localKey: 'id', foreignKey: 'pedido_id' }, { from: 'pedidos', to: 'entregas', localKey: 'id', foreignKey: 'pedido_id' }]
const view = (fields_metadata: any, extra: any = {}) => ({ layout_config: { fields_metadata, joins, ...extra } })

describe('campos calculados dos casos de uso (Consultar dados)', () => {
  it('Total Pedido = SOMA(Total Item): vira agregação sobre os itens, com a fórmula do item expandida', () => {
    const out = virtualFieldsForTable([view({ virt_3tyizuoq: totalPedido, virt_em0m10oj: totalItem })], models, 'm_orders')
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({
      key: 'virt_3tyizuoq', label: 'Total Pedido', fn: 'sum', childTable: 'itens_pedido', fk: 'pedido_id', localKey: 'id',
      expr: [{ t: 'op', v: '(' }, { t: 'col', v: 'quantidade' }, { t: 'op', v: '*' }, { t: 'col', v: 'preco_unitario' }, { t: 'op', v: ')' }],
    })
  })

  it('o campo da tabela filha (Total Item) é oferecido na tabela dele, como fórmula linha a linha', () => {
    const out = virtualFieldsForTable([view({ virt_3tyizuoq: totalPedido, virt_em0m10oj: totalItem })], models, 'm_items')
    expect(out.map((v) => [v.key, v.fn])).toEqual([['virt_em0m10oj', null]])
    expect(out[0].expr.map((t) => t.v)).toEqual(['quantidade', '*', 'preco_unitario'])
  })

  it('aceita layout_config como texto e ignora as cópias "form-virt_…" e o mesmo campo repetido em vários casos de uso', () => {
    const cfg = JSON.stringify({ fields_metadata: { virt_3tyizuoq: totalPedido, 'form-virt_3tyizuoq': totalPedido, virt_em0m10oj: totalItem }, joins })
    const out = virtualFieldsForTable([{ layout_config: cfg }, view({ virt_3tyizuoq: totalPedido, virt_em0m10oj: totalItem })], models, 'm_orders')
    expect(out.map((v) => v.key)).toEqual(['virt_3tyizuoq'])
  })

  it('média, máximo, mínimo e contagem; números e operadores na fórmula', () => {
    const avg = { label: { text: 'Ticket' }, virtual_model_id: 'm_orders', content: { formula_tokens: [{ type: 'function', value: 'MEDIA' }, op('('), field('itens_pedido.preco_unitario'), op('*'), { type: 'number', value: '1.1' }, op(')')] } }
    const out = virtualFieldsForTable([view({ virt_a: avg })], models, 'm_orders')
    expect(out[0].fn).toBe('avg')
    expect(out[0].expr.map((t) => t.v)).toEqual(['preco_unitario', '*', '1.1'])
  })

  it('fórmula linha a linha da própria tabela principal (sem agregação)', () => {
    const own = { label: { text: 'Dobro' }, virtual_model_id: 'm_orders', content: { formula_tokens: [field('pedidos.desconto'), op('*'), { type: 'number', value: '2' }] } }
    const out = virtualFieldsForTable([view({ virt_o: own })], models, 'm_orders')
    expect(out[0]).toMatchObject({ key: 'virt_o', fn: null })
    expect(out[0].childTable).toBeUndefined()
  })

  it('não oferece o que não dá para calcular com segurança: SE e outras funções, duas tabelas filhas, relação inexistente, parênteses errados', () => {
    const se = { label: { text: 'Se' }, virtual_model_id: 'm_orders', content: { formula_tokens: [{ type: 'function', value: 'SE' }, op('('), field('pedidos.a'), op(')')] } }
    const duas = { label: { text: 'Duas' }, virtual_model_id: 'm_orders', content: { formula_tokens: [{ type: 'function', value: 'SOMA' }, op('('), field('itens_pedido.a'), op('+'), field('entregas.b'), op(')')] } }
    const semJoin = { label: { text: 'Sem' }, virtual_model_id: 'm_orders', content: { formula_tokens: [{ type: 'function', value: 'SOMA' }, op('('), field('produtos.preco'), op(')')] } }
    const parenteses = { label: { text: 'Par' }, virtual_model_id: 'm_orders', content: { formula_tokens: [{ type: 'function', value: 'SOMA' }, op('('), op('('), field('itens_pedido.a'), op(')')] } }
    const aninhadaDeOutraTabela = { label: { text: 'Out' }, virtual_model_id: 'm_orders', content: { formula_tokens: [field('clientes.limite'), op('*'), { type: 'number', value: '2' }] } }
    const semTokens = { label: { text: 'Vazio' }, virtual_model_id: 'm_orders', content: {} }
    const out = virtualFieldsForTable([view({ virt_se: se, virt_duas: duas, virt_sem: semJoin, virt_par: parenteses, virt_out: aninhadaDeOutraTabela, virt_vazio: semTokens })], models, 'm_orders')
    expect(out).toEqual([])
  })

  it('nome de coluna ou tabela fora do padrão de identificador é recusado já na compilação', () => {
    const ctx = { metaByKey: { virt_x: { label: { text: 'X' }, virtual_model_id: 'm_orders', content: { formula_tokens: [{ type: 'function', value: 'SOMA' }, op('('), field('itens_pedido.preco"; DROP TABLE x; --'), op(')')] } } }, tableOfModel: () => 'pedidos' }
    expect(compileVirtualField('virt_x', ctx as any, 'pedidos', joins)).toBeNull()
  })

  it('referência circular entre campos calculados não trava (limite de profundidade)', () => {
    const a = { label: { text: 'A' }, virtual_model_id: 'm_orders', content: { formula_tokens: [field('pedidos.virt_b')] } }
    const b = { label: { text: 'B' }, virtual_model_id: 'm_orders', content: { formula_tokens: [field('pedidos.virt_a')] } }
    expect(virtualFieldsForTable([view({ virt_a: a, virt_b: b })], models, 'm_orders')).toEqual([])
  })
})
