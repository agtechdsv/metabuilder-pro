// Cria (ou atualiza) os usuários robô dos testes no banco REAL (crm). Só mexe na linha de cada robô e no vínculo dele com o grupo.
//   node scripts/create-robot.mjs        -> e2e_robo@metabuilder.local       (grupo Administrador)
//   node scripts/create-robot.mjs func   -> e2e_robo_func@metabuilder.local  (grupo Funcionária)
// A senha de cada um é gerada uma vez e fica em e2e/.env.real (fora do git). Uso: npm run real:robot  /  npm run real:robot:func
import pg from 'pg'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.join(here, '..', '.env.real')
const REAL_PG_URL = process.env.E2E_REAL_PG_URL || 'postgresql://crm:crm@localhost:5432/crm'

const ROBOS = {
  admin: { email: 'e2e_robo@metabuilder.local', nome: 'E2E Robô (testes automáticos)', perfil: '11111111-1111-4111-8111-111111111111', userKey: 'E2E_REAL_USER', passKey: 'E2E_REAL_PASSWORD' },
  func: { email: 'e2e_robo_func@metabuilder.local', nome: 'E2E Robô Funcionária (testes automáticos)', perfil: '33333333-3333-4333-8333-333333333333', userKey: 'E2E_REAL_USER_FUNC', passKey: 'E2E_REAL_PASSWORD_FUNC' },
}
const quem = process.argv[2] || 'admin'
const robo = ROBOS[quem]
if (!robo) { console.error('Use: admin ou func'); process.exit(1) }

const parse = (txt) => Object.fromEntries(txt.split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const env = parse(fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '')
const password = env[robo.passKey] || crypto.randomBytes(18).toString('base64url')
const hash = bcrypt.hashSync(password, 10)

const c = new pg.Client({ connectionString: REAL_PG_URL })
await c.connect()
try {
  const dbName = (await c.query('select current_database() as db')).rows[0].db
  if (dbName !== 'crm') throw new Error('Esperava o banco crm e conectei em ' + dbName)
  const found = await c.query('select id from usuarios where email = $1', [robo.email])
  let id
  if (found.rowCount > 0) {
    id = found.rows[0].id
    await c.query('update usuarios set hash_senha = $1, ativo = true, nome_completo = $2, atualizado_em = now() where id = $3', [hash, robo.nome, id])
  } else {
    id = (await c.query('insert into usuarios (id, nome_completo, email, hash_senha, ativo, atualizado_em) values (gen_random_uuid(), $1, $2, $3, true, now()) returning id', [robo.nome, robo.email, hash])).rows[0].id
  }
  await c.query('insert into perfis_usuarios (usuario_id, perfil_id) values ($1, $2) on conflict do nothing', [id, robo.perfil])
  const out = {
    E2E_REAL: '1',
    E2E_REAL_PG_URL: env.E2E_REAL_PG_URL || REAL_PG_URL,
    E2E_REAL_ALLOWED_DBS: env.E2E_REAL_ALLOWED_DBS || 'crm',
    ...(env.E2E_REAL_APP_DIR ? { E2E_REAL_APP_DIR: env.E2E_REAL_APP_DIR } : {}),
    ...Object.fromEntries(Object.values(ROBOS).flatMap(r => env[r.userKey] ? [[r.userKey, env[r.userKey]], [r.passKey, env[r.passKey]]] : [])),
    [robo.userKey]: robo.email,
    [robo.passKey]: password,
  }
  fs.writeFileSync(envFile, '# Credenciais dos robôs dos testes no banco real (NÃO versionar: este arquivo está no .gitignore)\n' + Object.entries(out).map(([k, v]) => `${k}=${v}`).join('\n') + '\n')
  console.log(`Robô pronto: ${robo.email} (id ${id}). Credenciais em e2e/.env.real`)
} finally { await c.end() }
