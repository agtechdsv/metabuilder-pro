import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { planWidgetQuery } from '../../bi/widgetPlan'

const req = createRequire(import.meta.url)
const { applyToSelect, guardCustom, enforceWrite, literal, PolicyError } = req('../../../../cli/sqlPolicy.js') as any

const eq = (table: string, column: string, value: string) => ({ table, conds: [{ column, op: 'eq', values: [value] }] })
const access = (...policies: any[]) => ({ policies, flags: {} as any })
const SUB7 = '(SELECT * FROM "pedidos" WHERE ("funcionario_id" = \'7\'))'

describe('leitura — cada referência à tabela vira uma subconsulta filtrada', () => {
  const a = access(eq('pedidos', 'funcionario_id', '7'))

  it('lista simples: a tabela mantém o nome como apelido, então o resto da consulta não muda', () => {
    const sql = 'SELECT "pedidos"."id", "pedidos"."status" FROM "pedidos"  WHERE CAST("pedidos"."status" AS text) ILIKE $1 ORDER BY "pedidos"."id" DESC LIMIT 20 OFFSET 0'
    expect(applyToSelect(sql, a)).toBe(`SELECT "pedidos"."id", "pedidos"."status" FROM ${SUB7} AS "pedidos"  WHERE CAST("pedidos"."status" AS text) ILIKE $1 ORDER BY "pedidos"."id" DESC LIMIT 20 OFFSET 0`)
  })

  it('lista com subconsulta paginada (o formato que a tela envia quando há JOIN)', () => {
    const sql = `SELECT "pedidos"."id", "clientes"."nome_empresa" AS "clientes.nome_empresa" FROM (
    SELECT DISTINCT "pedidos".* FROM "pedidos"
    LEFT JOIN "clientes" ON "pedidos"."cliente_id" = "clientes"."id"
     WHERE ("pedidos"."status" = $1)
    ORDER BY "pedidos"."id" DESC
    LIMIT 20 OFFSET 0
  ) AS "pedidos" LEFT JOIN "clientes" ON "pedidos"."cliente_id" = "clientes"."id"
  ORDER BY "pedidos"."id" DESC`
    const out = applyToSelect(sql, a)
    expect(out).toContain(`FROM ${SUB7} AS "pedidos"\n    LEFT JOIN "clientes"`)
    // o apelido da subconsulta externa continua igual
    expect(out).toContain(') AS "pedidos" LEFT JOIN "clientes"')
    expect(out.match(/SELECT \* FROM "pedidos"/g)).toHaveLength(1)
  })

  it('apelidos (mapa mental): `t` e `th0` seguem valendo', () => {
    const sql = `SELECT DISTINCT t.* FROM "clientes" t INNER JOIN "pedidos" th0 ON t."id" = th0."cliente_id" WHERE th0."id" = '5'`
    expect(applyToSelect(sql, a)).toBe(`SELECT DISTINCT t.* FROM "clientes" t INNER JOIN ${SUB7} th0 ON t."id" = th0."cliente_id" WHERE th0."id" = '5'`)
  })

  it('formato estruturado do Agente: row_to_json("tabela".*) e o JOIN também são filtrados', () => {
    const a2 = access(eq('clientes', 'ativo', 'sim'))
    const sql = 'SELECT "pedidos".*, row_to_json("clientes".*) AS "clientes" FROM "pedidos" LEFT JOIN "clientes" ON "pedidos"."cliente_id" = "clientes"."id" LIMIT 100 OFFSET 0'
    expect(applyToSelect(sql, a2)).toBe('SELECT "pedidos".*, row_to_json("clientes".*) AS "clientes" FROM "pedidos" LEFT JOIN (SELECT * FROM "clientes" WHERE ("ativo" = \'sim\')) AS "clientes" ON "pedidos"."cliente_id" = "clientes"."id" LIMIT 100 OFFSET 0')
  })

  it('contagem', () => {
    expect(applyToSelect('SELECT COUNT(*) as total FROM "pedidos" WHERE "pedidos"."status" = $1', a))
      .toBe(`SELECT COUNT(*) as total FROM ${SUB7} AS "pedidos" WHERE "pedidos"."status" = $1`)
  })

  it('Oracle: sem AS antes do apelido', () => {
    expect(applyToSelect('SELECT * FROM "pedidos"', a, { dbType: 'oracle' })).toBe('SELECT * FROM (SELECT * FROM "pedidos" WHERE ("funcionario_id" = \'7\')) "pedidos"')
  })

  it('sem política nas tabelas citadas, o SQL não muda', () => {
    const sql = 'SELECT * FROM "clientes" WHERE 1=1'
    expect(applyToSelect(sql, a)).toBe(sql)
    expect(applyToSelect(sql, { policies: [], flags: {} })).toBe(sql)
  })

  it('texto que apenas contém o nome da tabela, e EXTRACT(... FROM ...), não confundem', () => {
    const sql = `SELECT EXTRACT(year FROM "pedidos"."data_pedido") AS y, 'pedidos' AS nome FROM "pedidos" WHERE "pedidos"."status" = 'pedidos'`
    expect(applyToSelect(sql, a)).toBe(`SELECT EXTRACT(year FROM "pedidos"."data_pedido") AS y, 'pedidos' AS nome FROM ${SUB7} AS "pedidos" WHERE "pedidos"."status" = 'pedidos'`)
  })

  it('esquema.tabela', () => {
    expect(applyToSelect('SELECT * FROM "crm"."pedidos" p', a)).toBe('SELECT * FROM (SELECT * FROM "crm"."pedidos" WHERE ("funcionario_id" = \'7\')) p')
  })

  it('o SQL do planejador do BI também é filtrado (junção, agrupamento, período)', () => {
    let n = 0
    const f = (m: string, c: string, t: string, x: any = {}) => ({ id: `${m}.${c}`, db_column_name: c, data_type: t, order_index: n++, ...x })
    const models = [
      { id: 'm_ped', db_table_name: 'pedidos', db_schema_name: 'crm', fields: [f('ped', 'id', 'uuid', { is_primary_key: true }), f('ped', 'cliente_id', 'uuid'), f('ped', 'data_pedido', 'timestamp with time zone'), f('ped', 'status', 'text'), f('ped', 'funcionario_id', 'uuid')] },
      { id: 'm_cli', db_table_name: 'clientes', db_schema_name: 'crm', fields: [f('cli', 'id', 'uuid', { is_primary_key: true }), f('cli', 'nome_empresa', 'text')] },
    ]
    const relations = [{ id: 'r', from_model_id: 'm_ped', from_field_id: 'ped.cliente_id', to_model_id: 'm_cli', to_field_id: 'cli.id' }]
    const plan = planWidgetQuery({
      widget: { id: 'w', type: 'bar', model_id: 'm_ped', calc: 'COUNT', field: '', width: 'half', group_by: 'clientes.nome_empresa', period_field: 'pedidos.data_pedido' } as any,
      models, relations, dialect: 'postgres', rawRowLimit: 1000, maxGroups: 2000, projectSlug: 'x',
      period: { from: '2026-01-01', to: '2026-03-31' },
    })
    expect(plan.kind).toBe('agg')
    const out = applyToSelect(plan.sql!, a)
    expect(out).toContain(`FROM ${SUB7} AS "pedidos"`)
    expect(out).toContain('LEFT JOIN "clientes"')
  })
})

describe('leitura — formas não permitidas são recusadas (falha fechada)', () => {
  const a = access(eq('pedidos', 'funcionario_id', '7'))
  const bad = (sql: string) => expect(() => applyToSelect(sql, a)).toThrow(PolicyError)

  it('junção por vírgula, tabela sem aspas fora de FROM/JOIN, linha inteira da tabela', () => {
    bad('SELECT * FROM "clientes", "pedidos"')
    bad('SELECT "pedidos" FROM "clientes"')
    bad('SELECT row_to_json(pedidos) FROM "clientes"')
  })

  it('comentários, textos entre cifrões, texto sem fechar e vários comandos', () => {
    bad('SELECT * FROM "pedidos" -- tudo')
    bad('SELECT * /* x */ FROM "pedidos"')
    bad('SELECT $$a$$ FROM "pedidos"')
    bad("SELECT 'abc FROM \"pedidos\"")
    bad('SELECT 1; SELECT * FROM "pedidos"')
  })

  it('subconsulta escondida só reconhecida por FROM continua filtrada, não recusada', () => {
    const out = applyToSelect('SELECT (SELECT COUNT(*) FROM "pedidos") AS n FROM "clientes"', a)
    expect(out).toContain(`FROM ${SUB7} AS "pedidos"`)
  })

  it('"OR 1=1" no WHERE do usuário não escapa da regra, que está na própria tabela de origem', () => {
    const out = applyToSelect('SELECT * FROM "pedidos" WHERE 1=1 OR 1=1', a)
    expect(out).toBe(`SELECT * FROM ${SUB7} AS "pedidos" WHERE 1=1 OR 1=1`)
  })
})

describe('regras', () => {
  it('lista de valores, tabela relacionada, negado e várias regras juntas (E)', () => {
    const a = access({
      table: 'pedidos',
      conds: [
        { column: 'funcionario_id', op: 'in', values: ['1', '2', '3'] },
        { column: 'depto_id', op: 'related', values: ['9'], related: { table: 'funcionarios', key: 'id', column: 'depto_id' } },
      ],
    })
    expect(applyToSelect('SELECT * FROM "pedidos"', a)).toBe(
      `SELECT * FROM (SELECT * FROM "pedidos" WHERE ("funcionario_id" IN ('1', '2', '3')) AND ("depto_id" IN (SELECT "id" FROM "funcionarios" WHERE "depto_id" = '9'))) AS "pedidos"`)
    expect(applyToSelect('SELECT * FROM "pedidos"', access({ table: 'pedidos', deny: true, conds: [] }))).toContain('WHERE 1 = 0')
  })

  it('o valor do usuário é escapado (aspas, barra invertida) e o byte nulo é recusado', () => {
    expect(literal("O'Brien", 'postgres')).toBe("'O''Brien'")
    expect(literal('a\\b', 'postgres')).toBe("E'a\\\\b'")
    expect(literal('a\\b', 'oracle')).toBe("'a\\b'")
    expect(() => literal('a\0b', 'postgres')).toThrow(PolicyError)
    const a = access(eq('pedidos', 'funcionario_id', "x' OR '1'='1"))
    expect(applyToSelect('SELECT * FROM "pedidos"', a)).toContain(`"funcionario_id" = 'x'' OR ''1''=''1'`)
  })

  it('identificador inválido na política é recusado', () => {
    const a = access({ table: 'pedidos', conds: [{ column: 'a"; DROP TABLE x; --', op: 'eq', values: ['1'] }] })
    expect(() => applyToSelect('SELECT * FROM "pedidos"', a)).toThrow(PolicyError)
  })
})

describe('SQL de dados livre (execute_custom)', () => {
  const a = { policies: [eq('pedidos', 'funcionario_id', '7')], flags: { itens_pedido: { delete: false } } as any }

  it('DELETE e UPDATE recebem a regra no WHERE (com ou sem WHERE e RETURNING)', () => {
    expect(guardCustom(`DELETE FROM "pedidos" WHERE "id" = '1'`, a)).toBe(`DELETE FROM "pedidos" WHERE ( "id" = '1') AND (("pedidos"."funcionario_id" = '7'))`)
    expect(guardCustom('DELETE FROM "pedidos"', a)).toBe(`DELETE FROM "pedidos" WHERE ("pedidos"."funcionario_id" = '7')`)
    expect(guardCustom(`UPDATE "pedidos" SET "status" = 'x' WHERE "id" = '1' RETURNING *`, a))
      .toBe(`UPDATE "pedidos" SET "status" = 'x' WHERE ( "id" = '1' ) AND (("pedidos"."funcionario_id" = '7')) RETURNING *`)
    // "OR" do usuário fica entre parênteses: a regra não é anulada
    expect(guardCustom(`DELETE FROM "pedidos" WHERE "id" = '1' OR 1=1`, a)).toContain(`( "id" = '1' OR 1=1) AND (`)
    // com apelido, a regra usa o apelido
    expect(guardCustom(`DELETE FROM "pedidos" p WHERE p."id" = '1'`, a)).toContain(`("p"."funcionario_id" = '7')`)
  })

  it('exclusão em cascata: vários comandos, cada um conferido; a tabela sem política passa', () => {
    const out = guardCustom(`DELETE FROM "clientes" WHERE "id" = '3'; DELETE FROM "pedidos" WHERE "cliente_id" = '3'`, a)
    expect(out).toBe(`DELETE FROM "clientes" WHERE "id" = '3'; DELETE FROM "pedidos" WHERE ( "cliente_id" = '3') AND (("pedidos"."funcionario_id" = '7'))`)
  })

  it('a permissão da tabela (excluir desligado) vale', () => {
    expect(() => guardCustom(`DELETE FROM "itens_pedido" WHERE "id" = '1'`, a)).toThrow(/não permite excluir/)
  })

  it('INSERT em tabela com política é recusado; em tabela livre passa', () => {
    expect(() => guardCustom(`INSERT INTO "pedidos" ("status") VALUES ('x')`, a)).toThrow(PolicyError)
    expect(guardCustom(`INSERT INTO "clientes" ("nome") VALUES ('x')`, a)).toBe(`INSERT INTO "clientes" ("nome") VALUES ('x')`)
  })

  it('SELECT livre é filtrado; comando de gravação escondido em WITH e DDL são recusados', () => {
    expect(guardCustom('SELECT * FROM "pedidos"', a)).toContain('FROM (SELECT * FROM "pedidos" WHERE')
    expect(() => guardCustom('WITH x AS (DELETE FROM "pedidos" RETURNING *) SELECT * FROM x', a)).toThrow(PolicyError)
    expect(() => guardCustom('DROP TABLE "pedidos"', a)).toThrow(PolicyError)
  })

  it('DELETE ... USING / UPDATE ... FROM em outra tabela com política também filtra a outra', () => {
    const b = { policies: [eq('pedidos', 'funcionario_id', '7'), eq('clientes', 'ativo', 'sim')], flags: {} }
    const out = guardCustom(`DELETE FROM "pedidos" USING "clientes" WHERE "pedidos"."cliente_id" = "clientes"."id"`, b)
    expect(out).toContain(`USING (SELECT * FROM "clientes" WHERE ("ativo" = 'sim')) AS "clientes"`)
    expect(out).toContain(`("pedidos"."funcionario_id" = '7')`)
  })
})

describe('gravação estruturada (insert / update / delete)', () => {
  const a = { policies: [eq('pedidos', 'funcionario_id', '7')], flags: { clientes: { create: false } } as any }
  const queryReturning = (rows: Record<string, any[]>) => async (sql: string) => {
    // a primeira consulta conta todas as linhas do id; a segunda, as que a regra deixa ver
    return sql.includes('funcionario_id') ? rows.mine : rows.all
  }

  it('a permissão da tabela vale', async () => {
    await expect(enforceWrite({ access: a, action: 'insert', table: 'clientes', data: {}, dbType: 'postgres', query: async () => [] })).rejects.toThrow(/não permite criar/)
    // tabela sem flag passa
    await expect(enforceWrite({ access: a, action: 'insert', table: 'produtos', data: { nome: 'x' }, dbType: 'postgres', query: async () => [] })).resolves.toEqual({ nome: 'x' })
  })

  it('insert: o valor da regra preenche a coluna ausente; valor de outro usuário é recusado', async () => {
    const out = await enforceWrite({ access: a, action: 'insert', table: 'pedidos', data: { status: 'novo' }, dbType: 'postgres', query: async () => [] })
    expect(out).toEqual({ status: 'novo', funcionario_id: '7' })
    await expect(enforceWrite({ access: a, action: 'insert', table: 'pedidos', data: { funcionario_id: '8' }, dbType: 'postgres', query: async () => [] })).rejects.toThrow(/fora do seu acesso/)
    await expect(enforceWrite({ access: a, action: 'insert', table: 'pedidos', data: { FUNCIONARIO_ID: '7' }, dbType: 'postgres', query: async () => [] })).resolves.toBeTruthy()
    await expect(enforceWrite({ access: a, action: 'insert', table: 'pedidos', data: { funcionario_id: '' }, dbType: 'postgres', query: async () => [] })).rejects.toThrow(/não pode ficar vazio/)
  })

  it('insert sem dados (undefined) também recebe o valor da regra', async () => {
    const out = await enforceWrite({ access: a, action: 'insert', table: 'pedidos', data: undefined, dbType: 'postgres', query: async () => [] })
    expect(out).toEqual({ funcionario_id: '7' })
  })

  it('Oracle: a coluna preenchida pela regra mantém o nome configurado (o Agente põe em maiúsculas; o app exportado usa o nome do cadastro)', async () => {
    const out = await enforceWrite({ access: a, action: 'insert', table: 'pedidos', data: {}, dbType: 'oracle', query: async () => [] })
    expect(out).toEqual({ funcionario_id: '7' })
  })

  it('checkRows: false não conta as linhas (o WHERE do comando garante isso)', async () => {
    let calls = 0
    await enforceWrite({ access: a, action: 'update', table: 'pedidos', data: { status: 'x' }, idColumn: 'id', idValue: '1', dbType: 'postgres', checkRows: false, query: async () => { calls++; return [] } })
    expect(calls).toBe(0)
  })

  it('update: não pode passar a linha para outro dono; só atinge linhas dentro da regra', async () => {
    await expect(enforceWrite({ access: a, action: 'update', table: 'pedidos', data: { funcionario_id: '9' }, idColumn: 'id', idValue: '1', dbType: 'postgres', query: async () => [{ c: 1 }] })).rejects.toThrow(/fora do seu acesso/)
    // todas as linhas do id estão dentro da regra
    await expect(enforceWrite({ access: a, action: 'update', table: 'pedidos', data: { status: 'x' }, idColumn: 'id', idValue: '1', dbType: 'postgres', query: queryReturning({ all: [{ c: 1 }], mine: [{ c: 1 }] }) })).resolves.toEqual({ status: 'x' })
    // a linha é de outro: a contagem com a regra é menor
    await expect(enforceWrite({ access: a, action: 'update', table: 'pedidos', data: { status: 'x' }, idColumn: 'id', idValue: '2', dbType: 'postgres', query: queryReturning({ all: [{ c: 1 }], mine: [{ c: 0 }] }) })).rejects.toThrow(/fora do seu acesso/)
    // idColumn que atinge várias linhas, só parte delas minhas
    await expect(enforceWrite({ access: a, action: 'update', table: 'pedidos', data: { status: 'x' }, idColumn: 'status', idValue: 'novo', dbType: 'postgres', query: queryReturning({ all: [{ c: 5 }], mine: [{ c: 2 }] }) })).rejects.toThrow()
  })

  it('delete: mesma conferência de linhas; coluna de id inválida é recusada', async () => {
    await expect(enforceWrite({ access: a, action: 'delete', table: 'pedidos', idColumn: 'id', idValue: '3', dbType: 'postgres', query: queryReturning({ all: [{ c: 1 }], mine: [{ c: 0 }] }) })).rejects.toThrow()
    await expect(enforceWrite({ access: a, action: 'delete', table: 'pedidos', idColumn: 'id"; --', idValue: '3', dbType: 'postgres', query: async () => [{ c: 1 }] })).rejects.toThrow(PolicyError)
  })

  it('regra por tabela relacionada confere o valor gravado no banco', async () => {
    const rel = { policies: [{ table: 'pedidos', conds: [{ column: 'depto_id', op: 'related', values: ['9'], related: { table: 'funcionarios', key: 'id', column: 'depto_id' } }] }], flags: {} }
    await expect(enforceWrite({ access: rel, action: 'insert', table: 'pedidos', data: { depto_id: '4' }, dbType: 'postgres', query: async () => [{ ok: 1 }] })).resolves.toBeTruthy()
    await expect(enforceWrite({ access: rel, action: 'insert', table: 'pedidos', data: { depto_id: '5' }, dbType: 'postgres', query: async () => [] })).rejects.toThrow(/fora do seu acesso/)
  })

  it('tabela negada (usuário sem o dado da regra) não grava nada', async () => {
    const d = { policies: [{ table: 'pedidos', deny: true, conds: [] }], flags: {} }
    await expect(enforceWrite({ access: d, action: 'insert', table: 'pedidos', data: { status: 'x' }, dbType: 'postgres', query: async () => [] })).rejects.toThrow(/não tem acesso/)
  })
})
