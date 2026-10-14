/**
 * scripts/setup-access.mjs do app exportado (Node.js): cria as tabelas de acesso e grava os dados atuais, usando a conexão do .env.local.
 * Sem texto entre crases dentro do script: ele entra como literal no gerador.
 */
export const SETUP_SCRIPT = `// ARQUIVO GERADO pelo MetaBuilder — cria as tabelas de acesso (permissões de telas, grupos) no banco do app.
//
//   npm run db:setup             cria as tabelas (se faltarem) e grava os dados do projeto que ainda não estão lá
//   npm run db:setup -- --check  só confere se as tabelas já existem (não altera nada)
//
// Usa a conexão do .env.local. Pode rodar mais de uma vez (não duplica dados). Se o usuário do app não pode criar tabelas,
// rode com um usuário administrador:   DB_SETUP_URL="postgres://admin:senha@host:5432/banco" npm run db:setup
// (o usuário do app recebe acesso às tabelas criadas). No Oracle use DB_SETUP_USER e DB_SETUP_PASSWORD.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STACK = '__STACK__'

function loadEnv() {
  const env = { ...process.env }
  const file = path.join(root, '.env.local')
  if (!fs.existsSync(file)) return env
  for (const line of fs.readFileSync(file, 'utf8').split(/\\r?\\n/)) {
    const m = line.match(/^\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*(.*)\\s*$/)
    if (!m || line.trim().startsWith('#')) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (env[m[1]] === undefined) env[m[1]] = v
  }
  return env
}

const env = loadEnv()
const plan = JSON.parse(fs.readFileSync(path.join(root, 'db', 'access-control.json'), 'utf8'))
const ALREADY = /already exists|ORA-00955|ja existe|já existe/i

const userOf = (url) => {
  const m = String(url || '').match(/^[a-z]+:\\/\\/([^:@/]+)/i)
  return m ? decodeURIComponent(m[1]) : undefined
}

async function run(exec, label) {
  let done = 0
  for (const stmt of plan.statements) {
    try {
      await exec(stmt)
      done++
    } catch (e) {
      if (ALREADY.test(String(e && e.message))) continue
      console.error('Falhou: ' + stmt.split('\\n')[0].slice(0, 90))
      throw e
    }
  }
  console.log('Tabelas de acesso prontas (' + label + '): ' + plan.tables.join(', ') + '.')
}

/** Conexão com o banco: exec roda um comando, count devolve o número da primeira coluna da primeira linha. */
async function connect() {
  const setupUrl = env.DB_SETUP_URL || env.DATABASE_URL
  const appUser = userOf(env.DATABASE_URL)
  const asAdmin = !!env.DB_SETUP_URL && !!appUser && appUser !== userOf(env.DB_SETUP_URL)

  if (STACK === 'postgres') {
    const { Client } = require('pg')
    const c = new Client({ connectionString: setupUrl, options: '-c search_path=public' })
    await c.connect()
    return {
      label: 'PostgreSQL',
      exec: (s) => c.query(s),
      count: async (s) => Number((await c.query(s)).rows[0].count),
      grant: async () => {
        // criou como administrador: o usuário do app precisa enxergar as tabelas
        if (!asAdmin) return
        for (const t of plan.tables) await c.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ' + t + ' TO "' + appUser + '"')
        await c.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "' + appUser + '"')
        console.log('Acesso concedido ao usuário do app: ' + appUser + '.')
      },
      close: () => c.end(),
    }
  }
  if (STACK === 'mysql') {
    const mysql = require('mysql2/promise')
    const c = await mysql.createConnection(setupUrl)
    return {
      label: 'MySQL',
      exec: (s) => c.query(s),
      count: async (s) => Number((await c.query(s))[0][0].count),
      grant: async () => {
        if (!asAdmin) return
        for (const t of plan.tables) await c.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ' + t + " TO '" + appUser + "'@'%'")
      },
      close: () => c.end(),
    }
  }
  if (STACK === 'sqlserver') {
    const sql = require('mssql')
    const pool = await sql.connect(setupUrl)
    return {
      label: 'SQL Server',
      exec: (s) => pool.request().query(s),
      count: async (s) => Number((await pool.request().query(s)).recordset[0].count),
      grant: async () => {},
      close: () => pool.close(),
    }
  }
  // oracle
  const oracledb = require('oracledb')
  oracledb.autoCommit = true
  const raw = String(env.DB_CONNECTION_STRING || env.DATABASE_URL || '').replace(/^oracle(db)?:\\/\\//, '')
  let user = env.DB_SETUP_USER || env.DB_USER || ''
  let password = env.DB_SETUP_PASSWORD || env.DB_PASSWORD || ''
  let connectString = raw
  if (raw.includes('@')) {
    const at = raw.lastIndexOf('@')
    connectString = raw.slice(at + 1)
    const cred = raw.slice(0, at)
    const i = cred.indexOf(':')
    if (!user) user = decodeURIComponent(i >= 0 ? cred.slice(0, i) : cred)
    if (!password && i >= 0) password = decodeURIComponent(cred.slice(i + 1))
  }
  const conn = await oracledb.getConnection({ user, password, connectString })
  return {
    label: 'Oracle',
    exec: (s) => conn.execute(s),
    count: async (s) => Number((await conn.execute(s, [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].COUNT),
    grant: async () => {},
    close: () => conn.close(),
  }
}

async function main() {
  if (STACK === 'supabase') {
    console.log('Banco Supabase: abra db/access-control.sql e rode no SQL Editor do seu projeto Supabase.')
    return
  }
  const db = await connect()
  try {
    if (process.argv.includes('--check')) {
      // só confere: as tabelas já existem? (a primeira é a de permissões; as demais, quando o projeto não usa os grupos do banco legado)
      let rows = 0
      for (const [i, t] of plan.tables.entries()) {
        try {
          const n = await db.count('SELECT COUNT(*) AS count FROM ' + t)
          if (i === 0) rows = n
        } catch {
          console.log('MB_ACCESS_CHECK missing')
          return
        }
      }
      console.log('MB_ACCESS_CHECK exists ' + rows)
      return
    }
    await run(db.exec, db.label)
    await db.grant()
  } finally {
    await db.close()
  }
}

main().catch(e => {
  console.error('\\nNão foi possível criar as tabelas de acesso: ' + (e && e.message ? e.message : e))
  console.error('Se o usuário do banco não pode criar tabelas, rode com um administrador (veja o topo de scripts/setup-access.mjs) ou execute db/access-control.sql no banco.')
  process.exit(1)
})
`
