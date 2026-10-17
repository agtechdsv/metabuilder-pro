// Cria (ou atualiza) o usuário do robô dos testes no banco REAL (crm): e2e_robo@metabuilder.local, no grupo Administrador.
// Só mexe na linha desse usuário e no vínculo dele com o grupo. A senha é gerada uma vez e fica em e2e/.env.real (fora do git).
// Uso: npm run real:robot
import pg from 'pg'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.join(here, '..', '.env.real')
const REAL_PG_URL = process.env.E2E_REAL_PG_URL || 'postgresql://crm:crm@localhost:5432/crm'
const EMAIL = 'e2e_robo@metabuilder.local'
const NAME = 'E2E Robô (testes automáticos)'
const ADMIN_PROFILE = '11111111-1111-4111-8111-111111111111'

const readEnv = () => Object.fromEntries((fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const env = readEnv()
const password = env.E2E_REAL_PASSWORD || crypto.randomBytes(18).toString('base64url')
const hash = bcrypt.hashSync(password, 10)

const c = new pg.Client({ connectionString: REAL_PG_URL })
await c.connect()
try {
  const dbName = (await c.query('select current_database() as db')).rows[0].db
  if (dbName !== 'crm') throw new Error('Esperava o banco crm e conectei em ' + dbName)
  const found = await c.query('select id from usuarios where email = $1', [EMAIL])
  let id
  if (found.rowCount > 0) {
    id = found.rows[0].id
    await c.query('update usuarios set hash_senha = $1, ativo = true, nome_completo = $2, atualizado_em = now() where id = $3', [hash, NAME, id])
  } else {
    id = (await c.query('insert into usuarios (id, nome_completo, email, hash_senha, ativo, atualizado_em) values (gen_random_uuid(), $1, $2, $3, true, now()) returning id', [NAME, EMAIL, hash])).rows[0].id
  }
  await c.query('insert into perfis_usuarios (usuario_id, perfil_id) values ($1, $2) on conflict do nothing', [id, ADMIN_PROFILE])
  fs.writeFileSync(envFile, [
    '# Credenciais do robô dos testes no banco real (NÃO versionar: este arquivo está no .gitignore)',
    'E2E_REAL=1',
    `E2E_REAL_USER=${EMAIL}`,
    `E2E_REAL_PASSWORD=${password}`,
    `E2E_REAL_PG_URL=${REAL_PG_URL}`,
    'E2E_REAL_ALLOWED_DBS=crm',
    '',
  ].join('\n'))
  console.log(`Robô pronto: ${EMAIL} (id ${id}). Credenciais em e2e/.env.real`)
} finally { await c.end() }
