// Recria o banco de testes (mb_e2e) com os dados fixos de db/postgres.sql.
// Usa o Postgres local do desenvolvimento; por padrão a mesma conexão do CLI (crm) só para criar o banco.
import pg from 'pg'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const E2E_DB = process.env.E2E_PG_DB || 'mb_e2e'
const admin = process.env.E2E_PG_ADMIN || 'postgresql://crm:crm@localhost:5432/postgres'
export const E2E_PG_URL = process.env.E2E_PG_URL || admin.replace(/\/[^/]*$/, '/' + E2E_DB)

export async function seedPostgres() {
  const a = new pg.Client({ connectionString: admin })
  await a.connect()
  try {
    const exists = await a.query('select 1 from pg_database where datname = $1', [E2E_DB])
    if (exists.rowCount === 0) await a.query(`create database "${E2E_DB}"`)
  } finally { await a.end() }
  const c = new pg.Client({ connectionString: E2E_PG_URL })
  await c.connect()
  try { await c.query(fs.readFileSync(path.join(here, '..', 'db', 'postgres.sql'), 'utf8')) } finally { await c.end() }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seedPostgres().then(() => console.log('Banco de testes pronto:', E2E_PG_URL.replace(/:[^:@]*@/, ':***@'))).catch(e => { console.error('Falha ao preparar o banco de testes:', e.message); process.exit(1) })
}
