import { describe, it, expect } from 'vitest'
import { planCascade, cascadeDeleteSql, cascadeCountSql, parseCascadeCounts } from '../cascadePlan'

const models = [
  { id: 'm1', db_table_name: 'clientes', name: 'Clientes', fields: [{ id: 'f1', db_column_name: 'id' }] },
  { id: 'm2', db_table_name: 'pedidos', name: 'Pedidos', fields: [{ id: 'f2', db_column_name: 'id' }, { id: 'f3', db_column_name: 'cliente_id' }] },
  { id: 'm3', db_table_name: 'itens_pedido', name: 'Itens', fields: [{ id: 'f4', db_column_name: 'pedido_id' }] },
]
const relations = [
  { master_model_id: 'm1', detail_model_id: 'm2', referenced_column_id: 'f1', foreign_column_id: 'f3' },
  { master_model_id: 'm2', detail_model_id: 'm3', referenced_column_id: 'f2', foreign_column_id: 'f4' },
]

describe('plano da exclusão em cascata', () => {
  const steps = planCascade({ models, relations, rootTable: 'clientes', pkKey: 'id', pkValue: "a'b" })

  it('apaga de baixo para cima: netos antes dos filhos', () => {
    expect(steps.map(s => s.table)).toEqual(['itens_pedido', 'pedidos'])
    expect(cascadeDeleteSql(steps)[1]).toBe("DELETE FROM pedidos WHERE cliente_id IN (SELECT id FROM clientes WHERE id = 'a''b')")
  })

  it('conta numa consulta só e soma por tabela, inclusive com colunas em maiúsculas (Oracle)', () => {
    const sql = cascadeCountSql(steps)!
    expect(sql).toContain("SELECT 'pedidos' AS t, COUNT(*) AS n FROM pedidos WHERE")
    expect(sql).toContain(' UNION ALL ')
    expect(parseCascadeCounts([{ t: 'pedidos', n: 3 }, { T: 'itens_pedido', N: '7' }, { t: 'x', n: 0 }])).toEqual([
      { table: 'pedidos', count: 3 }, { table: 'itens_pedido', count: 7 },
    ])
  })

  it('sem tabelas filhas não há o que contar', () => {
    expect(cascadeCountSql(planCascade({ models, relations, rootTable: 'itens_pedido', pkKey: 'id', pkValue: 1 }))).toBeNull()
  })
})
