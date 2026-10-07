import { describe, it, expect } from 'vitest'
import { evaluateEndUserAccess, guardMode, loadAccessContext, referencedTables, sqlProblems, clearAccessContextCache } from '../tableAccess'

const ctx = { allowedTables: new Set(['clientes', 'pedidos', 'itens_pedido', 'produtos', 'usuarios']), authTable: 'usuarios' }

describe('guardMode', () => {
  it('padrão é observar; só reconhece off/enforce', () => {
    expect(guardMode({})).toBe('observe')
    expect(guardMode({ TUNNEL_GUARD: 'ENFORCE' })).toBe('enforce')
    expect(guardMode({ TUNNEL_GUARD: 'off' })).toBe('off')
    expect(guardMode({ TUNNEL_GUARD: 'qualquer coisa' })).toBe('observe')
  })
})

describe('referencedTables', () => {
  it('junta o campo table, as junções e os filtros "tabela.coluna"', () => {
    const t = referencedTables({
      table: 'Clientes',
      joins: [{ from: 'clientes', to: 'pedidos' }, { table: 'itens_pedido' }],
      filters: { 'produtos.nome': 'x', status: 'y' },
      advancedFilters: [{ field: 'entregas.data' }],
    })
    expect(t.sort()).toEqual(['clientes', 'entregas', 'itens_pedido', 'pedidos', 'produtos'])
  })

  it('lê as tabelas do texto do SELECT, com aspas, schema e subconsultas', () => {
    const t = referencedTables({
      table: 'pedidos',
      query: `SELECT "pedidos"."id" FROM (SELECT DISTINCT "pedidos".* FROM crm."pedidos" LEFT JOIN "itens_pedido" ON 1=1 LEFT JOIN crm.produtos p ON 1=1) AS "pedidos"`,
    })
    expect(t.sort()).toEqual(['itens_pedido', 'pedidos', 'produtos'])
  })

  it('pega tabelas separadas por vírgula e ignora o que está dentro de textos', () => {
    expect(referencedTables({ query: `SELECT * FROM clientes c, usuarios u WHERE c.id = u.id` }).sort()).toEqual(['clientes', 'usuarios'])
    expect(referencedTables({ query: `SELECT 'from usuarios' AS x FROM clientes -- join senhas` })).toEqual(['clientes'])
  })

  it('o teste de conexão (SELECT 1 em "diagnostico") não conta como tabela', () => {
    expect(referencedTables({ table: 'diagnostico', query: 'SELECT 1 AS ok' })).toEqual([])
    expect(referencedTables({ table: 'diagnostico', query: 'SELECT 1 AS "ok" FROM DUAL' })).toEqual([])
  })
})

describe('sqlProblems', () => {
  it('SELECT e WITH simples passam', () => {
    expect(sqlProblems('SELECT * FROM clientes')).toEqual([])
    expect(sqlProblems('  WITH a AS (SELECT 1) SELECT * FROM a')).toEqual([])
    expect(sqlProblems(undefined)).toEqual([])
  })

  it('coluna chamada "update" entre aspas ou texto com palavra reservada não é comando', () => {
    expect(sqlProblems(`SELECT "update", 'drop table x' AS t FROM clientes`)).toEqual([])
  })

  it('recusa comandos de escrita, vários comandos e catálogos do sistema', () => {
    expect(sqlProblems('DELETE FROM clientes').map(v => v.rule)).toContain('sql_not_select')
    expect(sqlProblems('SELECT 1; DROP TABLE clientes').map(v => v.detail).join()).toContain('mais de um comando')
    expect(sqlProblems('SELECT * FROM clientes WHERE 1=1 UNION SELECT usename FROM pg_user').some(v => v.detail.includes('pg_user'))).toBe(true)
    expect(sqlProblems('SELECT * FROM information_schema.tables').some(v => v.rule === 'sql_forbidden')).toBe(true)
    expect(sqlProblems("SELECT set_config('x','y',false)").some(v => v.detail.includes('set_config'))).toBe(true)
    expect(sqlProblems('SELECT 1 /* x */; SELECT 2').some(v => v.detail === 'mais de um comando')).toBe(true)
  })
})

describe('evaluateEndUserAccess', () => {
  it('as telas normais (tabelas do projeto, SELECT gerado) passam', () => {
    expect(evaluateEndUserAccess({ action: 'select', table: 'pedidos', query: 'SELECT "pedidos".* FROM "pedidos" LEFT JOIN "clientes" ON 1=1' }, ctx)).toEqual([])
    expect(evaluateEndUserAccess({ action: 'insert', table: 'itens_pedido' }, ctx)).toEqual([])
  })

  it('tabela fora do projeto e tabela de usuários são apontadas', () => {
    expect(evaluateEndUserAccess({ action: 'select', table: 'pg_shadow' }, ctx)).toEqual([{ rule: 'table_not_in_project', detail: 'pg_shadow' }])
    expect(evaluateEndUserAccess({ action: 'select', table: 'usuarios' }, ctx)).toEqual([{ rule: 'auth_table', detail: 'usuarios' }])
    const joined = evaluateEndUserAccess({ action: 'select', table: 'clientes', query: 'SELECT * FROM clientes JOIN usuarios ON 1=1' }, ctx)
    expect(joined.map(v => v.rule)).toEqual(['auth_table'])
  })

  it('SQL próprio de escrita é apontado mesmo em tabela permitida', () => {
    const v = evaluateEndUserAccess({ action: 'select', table: 'clientes', query: 'UPDATE clientes SET nome = 1' }, ctx)
    expect(v.map(x => x.rule)).toContain('sql_not_select')
  })
})

describe('loadAccessContext', () => {
  const client = (calls: string[]) => ({
    from: (table: string) => {
      calls.push(table)
      return table === 'models'
        ? { select: () => ({ eq: async () => ({ data: [{ db_table_name: 'Clientes' }, { db_table_name: 'pedidos' }] }) }) }
        : { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { db_table_name: 'usuarios' } }) }) }) }
    },
  }) as any

  it('lê as tabelas do projeto e a tabela de login, e guarda por um minuto', async () => {
    clearAccessContextCache()
    const calls: string[] = []
    let t = 0
    const a = await loadAccessContext('p1', { client: client(calls), now: () => t })
    expect([...a.allowedTables].sort()).toEqual(['clientes', 'pedidos'])
    expect(a.authTable).toBe('usuarios')
    t = 30_000
    await loadAccessContext('p1', { client: client(calls), now: () => t })
    expect(calls).toHaveLength(2) // segunda chamada veio do cache
    t = 61_000
    await loadAccessContext('p1', { client: client(calls), now: () => t })
    expect(calls).toHaveLength(4)
  })
})
