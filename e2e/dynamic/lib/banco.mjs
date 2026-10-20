// Acesso ao banco de teste em dois dialetos (Postgres e Oracle) com a mesma interface, para o motor inteiro (trava, ferramenta de banco, testes de segurança e specs).
// O SQL do motor é escrito no jeito do Postgres; para o Oracle ele é traduzido aqui (binds, identificadores em maiúsculas, ::text, limit).
// Conexão por URL: postgres://usuario:senha@host:5432/banco · oracle://usuario:senha@host:1521/SERVICO
import crypto from 'node:crypto'
import pg from 'pg'

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_$]*$/

/** Tipo de banco da URL: postgres ou oracle (null = ainda sem suporte nos testes). */
export function tipoDoBanco(url) {
  const p = String(url || '').split(':')[0].toLowerCase()
  return p.startsWith('oracle') ? 'oracle' : p.startsWith('postgres') ? 'postgres' : null
}

export function lerUrl(url) {
  const u = new URL(url)
  return { tipo: tipoDoBanco(url), host: u.hostname, porta: u.port || (tipoDoBanco(url) === 'oracle' ? '1521' : '5432'), banco: decodeURIComponent(u.pathname.replace(/^\//, '')), usuario: decodeURIComponent(u.username), senha: decodeURIComponent(u.password) }
}

/** SQL do jeito do Postgres → SQL do Oracle: $1 vira bind nomeado, "ident" fica em maiúsculas, x::text vira to_char(x), outros casts somem, now() e limit N. */
export function traduzirParaOracle(sql, params = []) {
  const binds = {}
  // só fora dos textos entre aspas simples ('12:00:00' não é bind)
  const texto = sql.split(/('(?:[^']|'')*')/).map((parte, i) => {
    if (i % 2 === 1) return parte
    return parte
      .replace(/\$(\d+)/g, (_m, n) => { binds['b' + n] = params[Number(n) - 1]; return ':b' + n })
      .replace(/"([A-Za-z_][A-Za-z0-9_$]*)"/g, (_m, id) => `"${id.toUpperCase()}"`)
      .replace(/((?:(?:"[^"]+"|\b[A-Za-z_][A-Za-z0-9_$]*)\.)*(?:"[^"]+"|\b[A-Za-z_][A-Za-z0-9_$]*))::text\b/g, 'to_char($1)')
      .replace(/::\w+/g, '')
      .replace(/\bnow\(\)/gi, 'systimestamp')
  }).join('').replace(/\blimit\s+(\d+)\s*$/i, 'fetch first $1 rows only')
  return { texto, binds }
}

const minusculas = row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]))

async function abrirPostgres(url) {
  const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 8000 })
  await c.connect()
  return {
    dialect: 'postgres',
    ident: n => { if (!IDENT.test(n)) throw new Error(`nome inválido: ${n}`); return `"${n}"` },
    verdadeiro: 'true',
    agora: 'now()',
    txt: (ident) => `${ident}::text`,
    query: async (sql, params = []) => (await c.query(sql, params)).rows,
    /** insere e devolve a chave primária (texto) */
    inserir: async (tabela, pk, nomes, exprs, params) => (await c.query(`insert into ${tabela} (${nomes.join(', ')}) values (${exprs.join(', ')}) returning "${pk}"::text as pk`, params)).rows[0].pk,
    colunas: async tabela => (await c.query("select column_name, data_type, is_nullable, column_default, character_maximum_length as max_length from information_schema.columns where table_schema = current_schema() and table_name = $1", [tabela])).rows,
    tabelas: async () => new Set((await c.query("select table_name from information_schema.tables where table_schema not in ('pg_catalog','information_schema')")).rows.map(r => r.table_name)),
    versao: async () => { const r = (await c.query('select version() as v, current_database() as d, pg_size_pretty(pg_database_size(current_database())) as sz')).rows[0]; return { banco: r.d, versao: String(r.v).split(' ').slice(0, 2).join(' '), tamanho: r.sz } },
    fechar: () => c.end().catch(() => {}),
  }
}

async function abrirOracle(url) {
  const db = (await import('oracledb')).default
  db.fetchAsString = [db.CLOB]
  const u = lerUrl(url)
  const conn = await db.getConnection({ user: u.usuario, password: u.senha, connectString: `${u.host}:${u.porta}/${u.banco}` })
  // formato da sessão do motor igual ao do Postgres: ponto decimal e datas em ISO (senão to_char devolve '15,5' e '25/10/26 12:00:00,000000' conforme o idioma do servidor)
  await conn.execute("alter session set nls_numeric_characters = '.,' nls_date_format = 'YYYY-MM-DD HH24:MI:SS' nls_timestamp_format = 'YYYY-MM-DD HH24:MI:SS.FF6' nls_timestamp_tz_format = 'YYYY-MM-DD HH24:MI:SS.FF6 TZH:TZM'")
  const rodar = async (texto, binds = {}, extra = {}) => conn.execute(texto, binds, { outFormat: db.OUT_FORMAT_OBJECT, autoCommit: true, ...extra })
  return {
    dialect: 'oracle',
    ident: n => { if (!IDENT.test(n)) throw new Error(`nome inválido: ${n}`); return `"${n.toUpperCase()}"` },
    // o Oracle do projeto guarda "booleano" como texto 'true'/'false'
    verdadeiro: "'true'",
    agora: 'systimestamp',
    txt: (ident, tipo) => (tipo === 'data' || tipo === 'data-hora') ? `to_char(${ident}, 'YYYY-MM-DD HH24:MI:SS')` : `to_char(${ident})`,
    query: async (sql, params = []) => { const { texto, binds } = traduzirParaOracle(sql, params); return ((await rodar(texto, binds)).rows || []).map(minusculas) },
    inserir: async (tabela, pk, nomes, exprs, params) => {
      const { texto, binds } = traduzirParaOracle(`insert into ${tabela} (${nomes.join(', ')}) values (${exprs.join(', ')})`, params)
      const r = await rodar(`${texto} returning "${pk.toUpperCase()}" into :rid`, { ...binds, rid: { dir: db.BIND_OUT, type: db.STRING, maxSize: 4000 } })
      return String(r.outBinds.rid[0])
    },
    colunas: async tabela => ((await rodar('select column_name, data_type, char_length, nullable, data_default from user_tab_columns where table_name = :t order by column_id', { t: String(tabela).toUpperCase() })).rows || []).map(r => ({
      column_name: String(r.COLUMN_NAME).toLowerCase(), data_type: String(r.DATA_TYPE).toLowerCase(), is_nullable: r.NULLABLE === 'Y' ? 'YES' : 'NO',
      column_default: r.DATA_DEFAULT == null ? null : String(r.DATA_DEFAULT).trim(), max_length: r.CHAR_LENGTH ? Number(r.CHAR_LENGTH) : null,
    })),
    tabelas: async () => new Set(((await rodar('select table_name from user_tables')).rows || []).map(r => String(r.TABLE_NAME).toLowerCase())),
    versao: async () => ({ banco: u.banco, versao: String(((await rodar("select banner from v$version where rownum = 1")).rows || [])[0]?.BANNER || 'Oracle').split(' - ')[0].slice(0, 60), tamanho: '—' }),
    fechar: () => conn.close().catch(() => {}),
  }
}

/** Abre a conexão do banco de teste. Quem abre fecha (`fechar`). */
export async function abrirBanco(url) {
  const tipo = tipoDoBanco(url)
  if (tipo === 'oracle') return abrirOracle(url)
  if (tipo === 'postgres') return abrirPostgres(url)
  throw new Error(`Banco "${String(url).split(':')[0]}" ainda não é suportado pelos testes automáticos (só PostgreSQL e Oracle).`)
}

export const novoUuid = () => crypto.randomUUID()

/**
 * O que o app exportado lê para saber qual banco usar, por pilha. O motor injeta estas variáveis ao subir o app, para ele usar o banco de TESTE
 * (variável de ambiente vale mais que o .env.local do Node e que o application.properties do Spring).
 */
export function envParaApp(url, pilha) {
  const u = lerUrl(url)
  if (pilha === 'java') {
    return {
      SPRING_DATASOURCE_URL: u.tipo === 'oracle' ? `jdbc:oracle:thin:@//${u.host}:${u.porta}/${u.banco}` : `jdbc:postgresql://${u.host}:${u.porta}/${u.banco}`,
      SPRING_DATASOURCE_USERNAME: u.usuario, SPRING_DATASOURCE_PASSWORD: u.senha,
    }
  }
  if (u.tipo === 'oracle') return { DB_CONNECTION_STRING: `${u.host}:${u.porta}/${u.banco}`, DB_USER: u.usuario, DB_PASSWORD: u.senha }
  return { DATABASE_URL: url }
}
