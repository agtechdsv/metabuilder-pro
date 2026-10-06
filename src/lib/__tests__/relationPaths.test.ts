import { describe, it, expect } from 'vitest'
import { resolveAllJoins, buildJoinSql, type ResolvedRelation } from '../relationPathFinder'
import { findAlternativePaths, pathSignature, describePath, ambiguousTables, automaticPath } from '../relationPaths'
import { widgetReferencedTables } from '../bi/widgetTables'

const rel = (from_table: string, from_field: string, to_table: string, to_field = 'id'): ResolvedRelation =>
  ({ id: `${from_table}.${from_field}`, from_table, from_field, to_table, to_field })

// projetos têm duas chaves para funcionários; pedidos chegam em departamentos por duas rotas
const relations: ResolvedRelation[] = [
  rel('projetos', 'gerente_id', 'funcionarios'),
  rel('projetos', 'analista_id', 'funcionarios'),
  rel('pedidos', 'funcionario_id', 'funcionarios'),
  rel('funcionarios', 'depto_id', 'departamentos'),
  rel('pedidos', 'cliente_id', 'clientes'),
  rel('clientes', 'depto_id', 'departamentos'),
]

describe('findAlternativePaths', () => {
  it('duas chaves entre as mesmas tabelas = duas alternativas', () => {
    const p = findAlternativePaths(relations, 'projetos', 'funcionarios')
    expect(p.map(pathSignature)).toEqual(['projetos.gerente_id>funcionarios.id', 'projetos.analista_id>funcionarios.id'])
  })
  it('rotas diferentes de mesmo tamanho', () => {
    const p = findAlternativePaths(relations, 'pedidos', 'departamentos')
    expect(p.map(x => x.length)).toEqual([2, 2])
    expect(p.map(pathSignature)).toContain('pedidos.funcionario_id>funcionarios.id|funcionarios.depto_id>departamentos.id')
    expect(p.map(pathSignature)).toContain('pedidos.cliente_id>clientes.id|clientes.depto_id>departamentos.id')
  })
  it('caminho único devolve uma alternativa; sem caminho, nenhuma; mesma tabela, nenhuma', () => {
    expect(findAlternativePaths(relations, 'pedidos', 'clientes')).toHaveLength(1)
    expect(findAlternativePaths(relations, 'pedidos', 'nao_existe')).toEqual([])
    expect(findAlternativePaths(relations, 'pedidos', 'pedidos')).toEqual([])
  })
  it('só traz caminhos até N passos mais longos que o mais curto', () => {
    expect(findAlternativePaths(relations, 'pedidos', 'funcionarios', { maxExtraLength: 0 })).toHaveLength(1)
    expect(findAlternativePaths(relations, 'pedidos', 'funcionarios', { maxExtraLength: 4 }).length).toBeGreaterThan(1)
  })
  it('anda nos dois sentidos da relação', () => {
    const p = findAlternativePaths(relations, 'funcionarios', 'projetos')
    expect(p).toHaveLength(2)
    expect(p[0][0].fromTable).toBe('funcionarios')
  })
})

describe('ambiguousTables / describePath / automaticPath', () => {
  it('lista só as tabelas com mais de um caminho', () => {
    const a = ambiguousTables(relations, 'pedidos', ['clientes', 'departamentos', 'funcionarios'])
    expect(a.map(x => x.table)).toEqual(['departamentos'])
  })
  it('descreve o caminho com os nomes de exibição', () => {
    const [first] = findAlternativePaths(relations, 'pedidos', 'clientes')
    expect(describePath(first, t => t.toUpperCase())).toBe('PEDIDOS.cliente_id → CLIENTES.id')
    const [, second] = findAlternativePaths(relations, 'pedidos', 'departamentos')
    expect(describePath(second)).toContain('  ›  ')
  })
  it('o automático é o mais curto', () => {
    expect(automaticPath(relations, 'pedidos', 'clientes')).toHaveLength(1)
  })
})

describe('resolveAllJoins com caminho escolhido', () => {
  it('sem escolha usa o primeiro mais curto; com escolha usa o caminho do desenvolvedor', () => {
    const auto = buildJoinSql(resolveAllJoins(relations, 'projetos', ['funcionarios']))
    expect(auto).toContain('"projetos"."gerente_id" = "funcionarios"."id"')

    const analista = findAlternativePaths(relations, 'projetos', 'funcionarios').find(p => p[0].fromField === 'analista_id')!
    const chosen = buildJoinSql(resolveAllJoins(relations, 'projetos', ['funcionarios'], { funcionarios: analista }))
    expect(chosen).toContain('"projetos"."analista_id" = "funcionarios"."id"')
    expect(chosen).not.toContain('gerente_id')
  })
  it('rota escolhida por clientes em vez de funcionários para chegar em departamentos', () => {
    const viaCliente = findAlternativePaths(relations, 'pedidos', 'departamentos').find(p => p[0].toTable === 'clientes')!
    const sql = buildJoinSql(resolveAllJoins(relations, 'pedidos', ['departamentos'], { departamentos: viaCliente }))
    expect(sql).toContain('"clientes"')
    expect(sql).not.toContain('"funcionarios"')
  })
})

describe('widgetReferencedTables', () => {
  const models = [
    { db_table_name: 'pedidos', fields: [{ db_column_name: 'id', is_primary_key: true, data_type: 'uuid' }, { db_column_name: 'cliente_id', data_type: 'uuid' }] },
    { db_table_name: 'clientes', fields: [{ db_column_name: 'id', is_primary_key: true, data_type: 'uuid' }, { db_column_name: 'nome', data_type: 'text' }] },
  ]
  const fk = [{ from_table: 'pedidos', from_field: 'cliente_id', to_table: 'clientes', to_field: 'id' }]
  it('junta valor, fórmula, agrupamento, série, divisor, filtros e período; tira a principal', () => {
    const w = {
      use_formula: true, field: 'itens.preco * itens.qtd',
      group_by: 'funcionarios.nome', series_by: 'pedidos.status',
      divide_by: { calc: 'COUNT', field: 'entregas.id' },
      conditions: [{ field: 'produtos.nome', op: 'eq', value: 'x' }],
      period_field: 'pedidos.data',
    }
    expect(widgetReferencedTables(w, 'pedidos', models, fk).sort()).toEqual(['entregas', 'funcionarios', 'itens', 'produtos'])
  })
  it('agrupar por chave estrangeira inclui a tabela do nome legível', () => {
    expect(widgetReferencedTables({ group_by: 'pedidos.cliente_id' }, 'pedidos', models, fk)).toEqual(['clientes'])
  })
})
