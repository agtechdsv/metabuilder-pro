import { describe, it, expect, beforeEach } from 'vitest'
import { createRequire } from 'node:module'
import { cleanRowPolicy, resolveAccess, type TableAccessConfig } from '../policy'
import { accessForSession, clearTableAccessCache, loadTableAccess } from '../server'
import { exportProblem } from '../exportGuard'
import { buildCommand } from '@/lib/tunnel/relayPolicy'
import { signCommand, computeSignature } from '@/lib/tunnel/commandSigning'

const req = createRequire(import.meta.url)
const { authorizeCommand, computeSignature: cliSignature, NonceCache } = req('../../../../cli/security.js') as any
const sqlPolicy = req('../../../../cli/sqlPolicy.js') as any

const PID = '123e4567-e89b-42d3-a456-426614174000'
const SECRET = 'segredo-do-projeto-0123456789abcdef'

const cfg = (table: string, rules: any[] | null, over: Partial<TableAccessConfig> = {}): TableAccessConfig => ({
  table, canCreate: true, canUpdate: true, canDelete: true, policy: rules ? cleanRowPolicy({ rules }) : null, ...over,
})
const byEmail = { id: 'r1', column: 'funcionario_email', op: 'eq', source: 'user.email' }
const bySeller = { id: 'r2', column: 'funcionario_id', op: 'eq', source: 'user.attr', attr: 'funcionario_id', bypass: { source: 'user.attr', attr: 'perfil', values: ['gerente'] } }
const maria = { email: 'maria@x.com', name: 'Maria', attrs: { funcionario_id: '7', perfil: 'vendedor' } }
const gerente = { email: 'joao@x.com', name: 'João', attrs: { funcionario_id: '9', perfil: 'gerente' } }

describe('cleanRowPolicy', () => {
  it('descarta regras incompletas, com nome inválido e sem a tabela relacionada', () => {
    const p = cleanRowPolicy({
      rules: [
        { column: 'funcionario_id', source: 'user.attr', attr: 'funcionario_id' },
        { column: 'a b', source: 'user.email' },
        { column: 'x', source: 'user.attr' },
        { column: 'x', source: 'qualquer' },
        { column: 'depto_id', op: 'related', source: 'user.attr', attr: 'depto' },
        { column: 'depto_id', op: 'related', source: 'user.attr', attr: 'depto', related: { table: 'funcionarios', key: 'id', column: 'depto_id' } },
        null,
      ],
    })
    expect(p?.rules).toHaveLength(2)
    expect(p?.rules[0]).toMatchObject({ column: 'funcionario_id', op: 'eq', source: 'user.attr', attr: 'funcionario_id' })
    expect(p?.rules[1]).toMatchObject({ op: 'related', related: { table: 'funcionarios', key: 'id', column: 'depto_id' } })
  })

  it('sem regra válida não há política', () => {
    expect(cleanRowPolicy(null)).toBeNull()
    expect(cleanRowPolicy({ rules: [] })).toBeNull()
    expect(cleanRowPolicy({ rules: 'x' })).toBeNull()
  })
})

describe('resolveAccess', () => {
  it('tabela sem política e com tudo permitido não gera nada (o comportamento de antes)', () => {
    expect(resolveAccess([cfg('clientes', null)], maria)).toEqual({ policies: [], flags: {} })
  })

  it('permissões da tabela: só vão as que estão desligadas', () => {
    const r = resolveAccess([cfg('Itens', null, { canDelete: false }), cfg('logs', null, { canCreate: false, canUpdate: false })], maria)
    expect(r.flags).toEqual({ itens: { delete: false }, logs: { create: false, update: false } })
  })

  it('regra por atributo vira condição com o valor DO usuário', () => {
    const r = resolveAccess([cfg('pedidos', [bySeller])], maria)
    expect(r.policies).toEqual([{ table: 'pedidos', conds: [{ column: 'funcionario_id', op: 'eq', values: ['7'] }] }])
  })

  it('quem está na exceção não sofre a regra e a tabela some da lista; os demais sofrem', () => {
    expect(resolveAccess([cfg('pedidos', [bySeller])], gerente).policies).toEqual([])
    expect(resolveAccess([cfg('pedidos', [bySeller])], maria).policies).toHaveLength(1)
  })

  it('sem usuário, ou sem o dado que a regra pede, a tabela fica NEGADA (nunca "mostra tudo")', () => {
    expect(resolveAccess([cfg('pedidos', [byEmail])], null).policies).toEqual([{ table: 'pedidos', deny: true, conds: [] }])
    expect(resolveAccess([cfg('pedidos', [bySeller])], { email: 'a@x.com', attrs: {} }).policies).toEqual([{ table: 'pedidos', deny: true, conds: [] }])
  })

  it('lista (operador "em") separa por vírgula; lista vazia nega; regra relacionada leva a tabela', () => {
    const rules = [
      { id: 'a', column: 'depto_id', op: 'in', source: 'user.attr', attr: 'deptos' },
      { id: 'b', column: 'funcionario_id', op: 'related', source: 'user.attr', attr: 'depto', related: { table: 'funcionarios', key: 'id', column: 'depto_id' } },
    ]
    const ok = resolveAccess([cfg('pedidos', rules)], { attrs: { deptos: ' 1, 2 ,3,', depto: '4' } })
    expect(ok.policies[0].conds).toEqual([
      { column: 'depto_id', op: 'in', values: ['1', '2', '3'] },
      { column: 'funcionario_id', op: 'related', values: ['4'], related: { table: 'funcionarios', key: 'id', column: 'depto_id' } },
    ])
    expect(resolveAccess([cfg('pedidos', rules)], { attrs: { deptos: ' , ', depto: '4' } }).policies[0].deny).toBe(true)
  })

  it('o resultado resolvido pelo servidor vale no Agente: de ponta a ponta, política → SQL', () => {
    const access = resolveAccess([cfg('pedidos', [bySeller], { canDelete: false })], maria)
    expect(sqlPolicy.applyToSelect('SELECT * FROM "pedidos"', access)).toContain(`WHERE ("funcionario_id" = '7')`)
    expect(() => sqlPolicy.guardCustom('DELETE FROM "pedidos" WHERE "id" = 1', access)).toThrow(/não permite excluir/)
  })
})

describe('carregador da configuração das tabelas', () => {
  beforeEach(() => clearTableAccessCache())

  const client = (handler: (cols: string) => { data: any; error: any }) => ({
    from: () => ({ select: (cols: string) => ({ eq: async () => handler(cols) }) }),
  }) as any

  it('lê permissões e política; tabela sem permissão marcada vale como permitida', async () => {
    const c = client(() => ({
      data: [
        { db_table_name: 'pedidos', can_create: true, can_update: false, can_delete: null, row_policy: { rules: [bySeller] } },
        { db_table_name: 'clientes', can_create: null, can_update: null, can_delete: null, row_policy: null },
        { db_table_name: null },
      ],
      error: null,
    }))
    const configs = await loadTableAccess(PID, { client: c })
    expect(configs).toHaveLength(2)
    expect(configs[0]).toMatchObject({ table: 'pedidos', canCreate: true, canUpdate: false, canDelete: true })
    expect(configs[0].policy?.rules).toHaveLength(1)
    expect(configs[1]).toMatchObject({ canCreate: true, policy: null })
  })

  it('coluna da política ainda não criada (migração pendente): vale só as permissões', async () => {
    const seen: string[] = []
    const c = client(cols => {
      seen.push(cols)
      return cols.includes('row_policy')
        ? { data: null, error: { code: '42703', message: 'column "row_policy" does not exist' } }
        : { data: [{ db_table_name: 'pedidos', can_create: true, can_update: true, can_delete: false }], error: null }
    })
    const configs = await loadTableAccess(PID, { client: c })
    expect(seen.length).toBeGreaterThanOrEqual(2)
    expect(configs[0]).toMatchObject({ canDelete: false, policy: null })
  })

  it('outro erro de leitura lança (quem chama recusa: falha fechada); o resultado fica em cache por poucos segundos', async () => {
    await expect(loadTableAccess(PID, { client: client(() => ({ data: null, error: { code: 'XX', message: 'caiu' } })) })).rejects.toThrow(/caiu/)
    let calls = 0
    const c = client(() => { calls++; return { data: [], error: null } })
    let t = 1000
    await loadTableAccess(PID, { client: c, now: () => t })
    await loadTableAccess(PID, { client: c, now: () => t + 5000 })
    expect(calls).toBe(1)
    await loadTableAccess(PID, { client: c, now: () => t + 20000 })
    expect(calls).toBe(2)
  })

  it('accessForSession resolve para a sessão assinada; visitante sem sessão fica sem usuário', async () => {
    const c = client(() => ({ data: [{ db_table_name: 'pedidos', can_create: true, can_update: true, can_delete: true, row_policy: { rules: [byEmail] } }], error: null }))
    const user = await accessForSession(PID, { sub: '5', email: 'maria@x.com' }, { client: c })
    expect(user.policies[0].conds[0].values).toEqual(['maria@x.com'])
    clearTableAccessCache()
    const anon = await accessForSession(PID, { sub: 'anon:1.1.1.1' }, { client: c })
    expect(anon.policies[0].deny).toBe(true)
  })
})

describe('assinatura v2 (comando de usuário final)', () => {
  const ctx = (extra: any = {}) => ({ projectId: PID, secretToken: SECRET, nonces: new NonceCache(), ...extra })
  const access = { policies: [{ table: 'pedidos', conds: [{ column: 'funcionario_id', op: 'eq', values: ['7'] }] }], flags: {} }

  it('o servidor (TS) e o Agente (JS) geram a MESMA assinatura, com e sem `access`', () => {
    for (const payload of [{ queryId: 'q', action: 'select' }, { queryId: 'q', action: 'select', access }]) {
      expect(computeSignature(SECRET, 'sql_query', PID, 1000, 'nonce-12345678', 'tunnel:x', payload))
        .toBe(cliSignature(SECRET, 'sql_query', PID, 1000, 'nonce-12345678', 'tunnel:x', payload))
    }
  })

  it('com `access` a assinatura é diferente da v1: um Agente antigo (só v1) recusa o comando em vez de ignorar `access`', () => {
    const body = { queryId: 'q', action: 'select', access }
    const v2 = computeSignature(SECRET, 'sql_query', PID, 1000, 'nonce-12345678', '', body)
    // o que um Agente 1.2 calcularia (a mesma entrada, sempre "v1")
    const crypto = req('node:crypto')
    const bodyHash = crypto.createHash('sha256').update(req('../../../../cli/security.js').stableStringify(body)).digest('hex')
    const v1 = crypto.createHmac('sha256', SECRET).update(['v1', 'sql_query', PID, '1000', 'nonce-12345678', '', bodyHash].join('\n')).digest('base64url')
    expect(v2).not.toBe(v1)
  })

  it('o Agente aceita o comando de usuário final, e `access` não pode ser tirado, trocado nem acrescentado depois de assinado', () => {
    const cmd = buildCommand({ projectId: PID, event: 'sql_query', payload: { queryId: 'q1', action: 'select', table: 'pedidos' } }, SECRET, access)
    expect(authorizeCommand('sql_query', cmd, ctx())).toMatchObject({ ok: true })

    const semAccess = { ...cmd }; delete semAccess.access
    expect(authorizeCommand('sql_query', semAccess, ctx())).toMatchObject({ ok: false, reason: 'assinatura_invalida' })
    const trocado = { ...cmd, access: { policies: [], flags: {} } }
    expect(authorizeCommand('sql_query', trocado, ctx())).toMatchObject({ ok: false, reason: 'assinatura_invalida' })

    // comando de membro (sem access) assinado e depois com `access` acrescentado também falha
    const membro = buildCommand({ projectId: PID, event: 'sql_query', payload: { queryId: 'q2', action: 'select' } }, SECRET)
    expect(authorizeCommand('sql_query', membro, ctx())).toMatchObject({ ok: true })
    expect(authorizeCommand('sql_query', { ...membro, access }, ctx())).toMatchObject({ ok: false })
  })

  it('signCommand sem `access` continua v1 (comandos de membro e compatibilidade)', () => {
    const cmd = signCommand(SECRET, 'sql_query', PID, { queryId: 'q' }, { ts: 5, nonce: 'abcdefgh1234' })
    expect(cmd.sig).toBe(cliSignature(SECRET, 'sql_query', PID, 5, 'abcdefgh1234', '', { queryId: 'q' }))
  })
})

describe('exportação de usuário final', () => {
  const ctx = { allowedTables: new Set(['pedidos', 'clientes', 'itens_pedido']), authTable: 'usuarios' }
  const ok = { modelName: 'pedidos', columnsList: ['id', 'status', 'clientes.nome_empresa AS "clientes.nome_empresa"', 'NULL AS "virt_1"'], joins: [{ table: 'pedidos', toTable: 'clientes', on: 'cliente_id', toOn: 'id' }] }

  it('o que a tela gera passa', () => {
    expect(exportProblem(ok, ctx)).toBeNull()
  })

  it('tabela fora do projeto, ou a tabela de login, é recusada (principal, coluna, junção e grafo)', () => {
    expect(exportProblem({ ...ok, modelName: 'outra' }, ctx)).toMatch(/tabela não permitida/)
    expect(exportProblem({ ...ok, modelName: 'usuarios' }, ctx)).toMatch(/tabela não permitida/)
    expect(exportProblem({ ...ok, columnsList: ['outra.x AS "outra.x"'] }, ctx)).toMatch(/tabela não permitida/)
    expect(exportProblem({ ...ok, joins: [{ table: 'pedidos', toTable: 'segredos' }] }, ctx)).toMatch(/tabela não permitida/)
    expect(exportProblem({ ...ok, exportGraph: true, dictionary: { a: 'itens_pedido', b: 'segredos' } }, ctx)).toMatch(/tabela não permitida/)
    expect(exportProblem({ ...ok, exportGraph: true, dictionary: { a: 'itens_pedido' } }, ctx)).toBeNull()
  })

  it('expressão no lugar de coluna (injeção) e coluna de senha da tabela de login são recusadas', () => {
    expect(exportProblem({ ...ok, columnsList: ['(SELECT string_agg(hash_senha, \',\') FROM usuarios) AS x'] }, ctx)).toMatch(/formato/)
    expect(exportProblem({ ...ok, columnsList: ['id', '1; DROP TABLE x'] }, ctx)).toMatch(/formato/)
    expect(exportProblem({ ...ok, columnsList: ['usuarios.hash_senha AS "usuarios.hash_senha"'] }, ctx)).toMatch(/coluna não permitida/)
    expect(exportProblem({ ...ok, columnsList: [] }, ctx)).toMatch(/inválida/)
  })
})
