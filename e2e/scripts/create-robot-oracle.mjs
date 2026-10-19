// Cria (ou atualiza) os usuários robô dos testes no banco Oracle REAL (schema crm). Só mexe na linha de cada robô, no vínculo dele com
// o grupo e, para o robô "leitura", no grupo de teste E2E-Leitura e nas permissões dele. Nada de outros usuários ou grupos.
//   node scripts/create-robot-oracle.mjs          -> e2e_robo@metabuilder.local          (grupo Administrador)
//   node scripts/create-robot-oracle.mjs func     -> e2e_robo_func@metabuilder.local     (grupo Funcionário)
//   node scripts/create-robot-oracle.mjs leitura  -> e2e_robo_leitura@metabuilder.local  (grupo de teste E2E-Leitura)
// A conexão vem do .env.local do app ejetado; a senha de cada robô é gerada uma vez e fica em e2e/.env.oracle (fora do git).
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.join(here, '..', '.env.oracle')
const parse = (txt) => Object.fromEntries(txt.split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const env = parse(fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '')
const appDir = process.env.E2E_ORA_APP_DIR || env.E2E_ORA_APP_DIR || 'C:\\Users\\Alexandre\\Downloads\\Vendas_ORA_Node'

const ROBOS = {
  admin: { email: 'e2e_robo@metabuilder.local', nome: 'E2E Robô (testes automáticos)', perfil: '11111111-1111-4111-8111-111111111111', userKey: 'E2E_ORA_USER', passKey: 'E2E_ORA_PASSWORD' },
  func: { email: 'e2e_robo_func@metabuilder.local', nome: 'E2E Robô Funcionário (testes automáticos)', perfil: '33333333-3333-4333-8333-333333333333', userKey: 'E2E_ORA_USER_FUNC', passKey: 'E2E_ORA_PASSWORD_FUNC' },
  leitura: {
    email: 'e2e_robo_leitura@metabuilder.local', nome: 'E2E Robô Leitura (testes automáticos)', perfil: 'e2e00000-0000-4000-8000-0000000000e1', userKey: 'E2E_ORA_USER_LEITURA', passKey: 'E2E_ORA_PASSWORD_LEITURA',
    grupo: { nome: 'E2E-Leitura', descricao: 'Grupo dos testes automáticos de permissão por tela (não usar)', perms: [['clientes', 'read'], ['departamentos', 'none']] },
  },
}
const quem = process.argv[2] || 'admin'
const robo = ROBOS[quem]
if (!robo) { console.error('Use: admin, func ou leitura'); process.exit(1) }

const appEnvFile = path.join(appDir, '.env.local')
if (!fs.existsSync(appEnvFile)) { console.error(`Não achei ${appEnvFile}. Ejete o projeto Vendas ORA para ${appDir}.`); process.exit(1) }
const appEnv = Object.fromEntries(fs.readFileSync(appEnvFile, 'utf8').split(/\r?\n/).map(l => /^([A-Z_]+)=(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]))
const [, host, service] = /^(?:\/\/)?([^:/]+)(?::\d+)?\/(.+)$/.exec(appEnv.DB_CONNECTION_STRING || '') || []
const locais = new Set(['localhost', '127.0.0.1', '::1', os.hostname().toLowerCase(), ...Object.values(os.networkInterfaces()).flatMap(l => (l || []).map(i => i.address.toLowerCase()))])
if (!host || !locais.has(host.toLowerCase())) { console.error(`Recusado: o Oracle do app (${host}) não é desta máquina.`); process.exit(1) }
if (String(service).toUpperCase() !== 'FREEPDB1' || String(appEnv.DB_USER).toLowerCase() !== 'crm') { console.error(`Recusado: esperava crm@FREEPDB1 e achei ${appEnv.DB_USER}@${service}.`); process.exit(1) }

const oracledb = createRequire(path.join(appDir, 'package.json'))('oracledb')
const password = env[robo.passKey] || crypto.randomBytes(18).toString('base64url')
const hash = bcrypt.hashSync(password, 10)

const conn = await oracledb.getConnection({ user: appEnv.DB_USER, password: appEnv.DB_PASSWORD, connectString: appEnv.DB_CONNECTION_STRING })
const q = async (sql, binds = []) => (await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: true })).rows || []
try {
  if (robo.grupo) {
    if ((await q('select 1 from perfis where id = :1', [robo.perfil])).length === 0) {
      await q('insert into perfis (id, nome, descricao, atualizado_em) values (:1, :2, :3, systimestamp)', [robo.perfil, robo.grupo.nome, robo.grupo.descricao])
    }
    await q('delete from mb_role_permissions where role_id = :1', [robo.perfil])
    for (const [slug, nivel] of robo.grupo.perms) await q('insert into mb_role_permissions (role_id, view_slug, access_level) values (:1, :2, :3)', [robo.perfil, slug, nivel])
  }
  if (quem === 'admin') {
    // As telas de gestão de acesso são negadas por padrão: sem linha em MB_ROLE_PERMISSIONS ninguém as abre. O Vendas PG tem estas 3
    // linhas para o Administrador; o Vendas ORA ainda não (nada definido no Studio). Garante-as, sem duplicar.
    for (const slug of ['acesso-usuarios', 'acesso-grupos', 'acesso-permissoes']) {
      if ((await q('select 1 from mb_role_permissions where role_id = :1 and view_slug = :2', [robo.perfil, slug])).length === 0) {
        await q(`insert into mb_role_permissions (role_id, view_slug, access_level) values (:1, :2, 'write')`, [robo.perfil, slug])
        console.log(`Concedi ao grupo Administrador acesso de escrita a ${slug} (faltava no banco Oracle).`)
      }
    }
  }
  const found = await q('select id from usuarios where email = :1', [robo.email])
  let id
  if (found.length > 0) {
    id = found[0].ID
    await q(`update usuarios set hash_senha = :1, ativo = 'true', nome_completo = :2, atualizado_em = systimestamp where id = :3`, [hash, robo.nome, id])
  } else {
    id = crypto.randomUUID()
    await q(`insert into usuarios (id, nome_completo, email, hash_senha, ativo, atualizado_em) values (:1, :2, :3, :4, 'true', systimestamp)`, [id, robo.nome, robo.email, hash])
  }
  if ((await q('select 1 from perfis_usuarios where usuario_id = :1 and perfil_id = :2', [id, robo.perfil])).length === 0) {
    await q('insert into perfis_usuarios (usuario_id, perfil_id) values (:1, :2)', [id, robo.perfil])
  }
  const out = {
    E2E_ORA: '1',
    E2E_ORA_ALLOWED_USERS: env.E2E_ORA_ALLOWED_USERS || 'crm',
    E2E_ORA_ALLOWED_SERVICES: env.E2E_ORA_ALLOWED_SERVICES || 'FREEPDB1',
    ...(env.E2E_ORA_APP_DIR ? { E2E_ORA_APP_DIR: env.E2E_ORA_APP_DIR } : {}),
    ...Object.fromEntries(Object.values(ROBOS).flatMap(r => env[r.userKey] ? [[r.userKey, env[r.userKey]], [r.passKey, env[r.passKey]]] : [])),
    [robo.userKey]: robo.email,
    [robo.passKey]: password,
  }
  fs.writeFileSync(envFile, '# Credenciais dos robôs dos testes no banco Oracle (NÃO versionar: este arquivo está no .gitignore)\n' + Object.entries(out).map(([k, v]) => `${k}=${v}`).join('\n') + '\n')
  console.log(`Robô pronto: ${robo.email} (id ${id}). Credenciais em e2e/.env.oracle`)
} finally { await conn.close() }
