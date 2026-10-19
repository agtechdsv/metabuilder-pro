// Ferramenta de banco do motor de testes (a IDE a chama): testa a conexão com o banco de teste (Postgres ou Oracle), cria o usuário de teste do app e o remove.
//   node dynamic/db-tool.mjs check     -> conecta e confere se as tabelas dos casos de uso existem
//   node dynamic/db-tool.mjs prepare   -> cria o usuário de teste (ou renova a senha dele), com a senha gerada, e o põe no grupo de administração, se houver
//   node dynamic/db-tool.mjs copy      -> (só Postgres) cria, no mesmo servidor, uma cópia do banco (CREATE DATABASE ... TEMPLATE); dbUrl = banco de origem, copyName = nome da cópia
//   node dynamic/db-tool.mjs remove    -> remove o usuário de teste e o vínculo dele com o grupo
// Entrada: E2E_CONFIG (JSON com dbUrl e, opcionalmente, robotPassword) e E2E_MANIFEST (manifesto com a configuração de login). Saída: uma linha @@MB-DB@@{json}.
import crypto from 'node:crypto'
import fs from 'node:fs'
import pg from 'pg'
import { abrirBanco, lerUrl, tipoDoBanco } from './lib/banco.mjs'
import { colocarNoGrupo, grupoAdmin, upsertUsuario, apagarUsuario } from './lib/acesso.mjs'

const MARCA = '@@MB-DB@@'
const ROBO_EMAIL = 'e2e_motor@metabuilder.local'
const ROBO_NOME = 'E2E Motor (testes automáticos)'

const out = o => { console.log(MARCA + JSON.stringify(o)); process.exit(o.ok ? 0 : 1) }
const cfg = JSON.parse(fs.readFileSync(process.env.E2E_CONFIG, 'utf8'))
const manifest = process.env.E2E_MANIFEST && fs.existsSync(process.env.E2E_MANIFEST) ? JSON.parse(fs.readFileSync(process.env.E2E_MANIFEST, 'utf8')) : null
const action = process.argv[2]
const limpar = msg => String(msg || '').replace(/(:\/\/[^:@/]+:)[^@]+@/g, '$1***@')

if (!tipoDoBanco(cfg.dbUrl)) out({ ok: false, error: `Banco "${String(cfg.dbUrl).split(':')[0]}" ainda não é suportado pelos testes automáticos (só PostgreSQL e Oracle).` })

if (action === 'copy') {
  // a cópia é feita por quem NÃO está conectado ao banco de origem (o Postgres não deixa copiar um banco em uso), por isso antes de abrir a conexão principal
  if (tipoDoBanco(cfg.dbUrl) !== 'postgres') out({ ok: false, error: 'A cópia automática só existe para PostgreSQL. No Oracle, peça ao administrador do banco (use o script da IDE).' })
  const origem = lerUrl(cfg.dbUrl).banco
  const nome = String(cfg.copyName || '').trim()
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(nome)) out({ ok: false, error: 'Nome inválido para a cópia: use letras minúsculas, números e _ (começando por letra).' })
  if (nome === origem) out({ ok: false, error: 'A cópia precisa ter um nome diferente do banco original.' })
  const adm = new URL(cfg.dbUrl); adm.pathname = '/postgres'
  const a = new pg.Client({ connectionString: adm.toString(), connectionTimeoutMillis: 8000 })
  try { await a.connect() } catch (e) { out({ ok: false, error: limpar(e.message) }) }
  try {
    if ((await a.query('select 1 from pg_database where datname = $1', [nome])).rowCount > 0) out({ ok: true, existed: true, name: nome })
    const tam = Number((await a.query('select pg_database_size($1) as s', [origem])).rows[0].s)
    await a.query(`create database "${nome}" template "${origem.replace(/"/g, '""')}"`)
    out({ ok: true, name: nome, sizeMb: Math.round(tam / 1048576) })
  } catch (e) {
    const porCodigo = { '55006': 'O banco original está em uso por outro programa (o app, DBeaver...). Feche as conexões com ele e tente de novo, ou use o script para o administrador.', '42501': 'O usuário do banco não tem permissão para criar bancos (CREATEDB). Peça ao administrador do banco ou use o script.' }
    out({ ok: false, error: porCodigo[e.code] || limpar(e.message) })
  }
}

let d
try {
  d = await abrirBanco(cfg.dbUrl)
} catch (e) {
  out({ ok: false, error: limpar(e.message) })
}

try {
  if (action === 'check') {
    const v = await d.versao()
    const esperadas = manifest ? [...new Set(manifest.views.flatMap(x => [x.table, ...x.details.map(t => t.table)]).filter(Boolean))] : []
    const achadas = await d.tabelas()
    const faltam = esperadas.filter(t => !achadas.has(t.toLowerCase()))
    out({ ok: true, database: v.banco, size: v.tamanho, version: v.versao, tables: { expected: esperadas.length, missing: faltam }, authType: manifest?.auth?.type ?? null })
  }

  const auth = manifest?.auth
  if (!auth || auth.type === 'none') out({ ok: true, noAuth: true })
  if (auth.type !== 'database') out({ ok: false, error: `O login do tipo "${auth.type}" ainda não é suportado pelos testes automáticos.` })
  const { usersTable, emailColumn, passwordColumn } = auth
  if (!usersTable || !emailColumn || !passwordColumn) out({ ok: false, error: 'A configuração de login do projeto não informa a tabela de usuários e as colunas de e-mail e senha.' })

  const pkUser = auth.usersPk || 'id'
  const achar = async () => (await d.query(`select ${d.ident(pkUser)}::text as id from ${d.ident(usersTable)} where ${d.ident(emailColumn)} = $1`, [ROBO_EMAIL]))[0]?.id

  if (action === 'remove') {
    const uid = await achar()
    if (uid) await apagarUsuario(d, auth, uid)
    out({ ok: true, removed: !!uid })
  }

  if (action === 'prepare') {
    const senha = cfg.robotPassword || crypto.randomBytes(18).toString('base64url')
    const formato = String(auth.hash || 'bcrypt').toLowerCase()
    const colunas = (await d.colunas(usersTable)).map(r => r.column_name)
    if (colunas.length === 0) out({ ok: false, error: `A tabela de usuários "${usersTable}" não existe no banco de teste.` })
    if (!colunas.includes(emailColumn.toLowerCase()) || !colunas.includes(passwordColumn.toLowerCase())) out({ ok: false, error: `A tabela "${usersTable}" não tem as colunas ${emailColumn} e ${passwordColumn}.` })

    const { id: uid, criado } = await upsertUsuario(d, auth, { email: ROBO_EMAIL, nome: ROBO_NOME, senha })

    // gestão de acesso: coloca o usuário no grupo de administração, se o projeto tiver um (não cria grupo nenhum)
    let grupo = null
    const admin = uid ? await grupoAdmin(d, auth) : null
    if (admin) { grupo = admin.nome; await colocarNoGrupo(d, auth, uid, admin.id) }
    out({ ok: true, user: ROBO_EMAIL, password: senha, created: criado, group: grupo, hash: formato })
  }

  out({ ok: false, error: `ação desconhecida: ${action}` })
} catch (e) {
  out({ ok: false, error: limpar(e.message) })
} finally {
  await d?.fechar()
}
