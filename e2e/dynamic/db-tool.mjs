// Ferramenta de banco do motor de testes (a IDE a chama): testa a conexão com o banco de teste, cria o usuário de teste do app e o remove.
//   node dynamic/db-tool.mjs check     -> conecta e confere se as tabelas dos casos de uso existem
//   node dynamic/db-tool.mjs prepare   -> cria o usuário de teste (ou renova a senha dele), com a senha gerada, e o põe no grupo de administração, se houver
//   node dynamic/db-tool.mjs remove    -> remove o usuário de teste e o vínculo dele com o grupo
// Entrada: E2E_CONFIG (JSON com dbUrl e, opcionalmente, robotPassword) e E2E_MANIFEST (manifesto com a configuração de login). Saída: uma linha @@MB-DB@@{json}.
import crypto from 'node:crypto'
import fs from 'node:fs'
import bcrypt from 'bcryptjs'
import pg from 'pg'

const MARCA = '@@MB-DB@@'
const ROBO_EMAIL = 'e2e_motor@metabuilder.local'
const ROBO_NOME = 'E2E Motor (testes automáticos)'
const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/

const out = o => { console.log(MARCA + JSON.stringify(o)); process.exit(o.ok ? 0 : 1) }
const cfg = JSON.parse(fs.readFileSync(process.env.E2E_CONFIG, 'utf8'))
const manifest = process.env.E2E_MANIFEST && fs.existsSync(process.env.E2E_MANIFEST) ? JSON.parse(fs.readFileSync(process.env.E2E_MANIFEST, 'utf8')) : null
const action = process.argv[2]
const limpar = msg => String(msg || '').replace(/(:\/\/[^:@/]+:)[^@]+@/g, '$1***@')
const id = n => { if (!IDENT.test(String(n))) throw new Error(`nome inválido: ${n}`); return `"${n}"` }

const c = new pg.Client({ connectionString: cfg.dbUrl, connectionTimeoutMillis: 8000 })
try {
  await c.connect()
} catch (e) {
  out({ ok: false, error: limpar(e.message) })
}

try {
  if (action === 'check') {
    const versao = (await c.query('select version() as v, current_database() as d')).rows[0]
    const esperadas = manifest ? [...new Set(manifest.views.flatMap(v => [v.table, ...v.details.map(d => d.table)]).filter(Boolean))] : []
    const achadas = new Set((await c.query("select table_name from information_schema.tables where table_schema not in ('pg_catalog','information_schema')")).rows.map(r => r.table_name))
    const faltam = esperadas.filter(t => !achadas.has(t))
    out({ ok: true, database: versao.d, version: String(versao.v).split(' ').slice(0, 2).join(' '), tables: { expected: esperadas.length, missing: faltam }, authType: manifest?.auth?.type ?? null })
  }

  const auth = manifest?.auth
  if (!auth || auth.type === 'none') out({ ok: true, noAuth: true })
  if (auth.type !== 'database') out({ ok: false, error: `O login do tipo "${auth.type}" ainda não é suportado pelos testes automáticos.` })
  const { usersTable, emailColumn, passwordColumn } = auth
  if (!usersTable || !emailColumn || !passwordColumn) out({ ok: false, error: 'A configuração de login do projeto não informa a tabela de usuários e as colunas de e-mail e senha.' })

  const pkUser = auth.usersPk || 'id'
  const link = auth.access?.link
  const achar = async () => (await c.query(`select ${id(pkUser)}::text as id from ${id(usersTable)} where ${id(emailColumn)} = $1`, [ROBO_EMAIL])).rows[0]?.id

  if (action === 'remove') {
    const uid = await achar()
    if (uid && link?.kind === 'table') await c.query(`delete from ${id(link.table)} where ${id(link.userColumn)}::text = $1`, [uid])
    if (uid) await c.query(`delete from ${id(usersTable)} where ${id(pkUser)}::text = $1`, [uid])
    out({ ok: true, removed: !!uid })
  }

  if (action === 'prepare') {
    const senha = cfg.robotPassword || crypto.randomBytes(18).toString('base64url')
    const formato = String(auth.hash || 'bcrypt').toLowerCase()
    const hash = formato === 'bcrypt' ? bcrypt.hashSync(senha, 10)
      : formato === 'md5' ? crypto.createHash('md5').update(senha).digest('hex')
      : formato === 'sha256' ? crypto.createHash('sha256').update(senha).digest('hex')
      : senha

    const colunas = (await c.query("select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema = current_schema() and table_name = $1", [usersTable])).rows
    if (colunas.length === 0) out({ ok: false, error: `A tabela de usuários "${usersTable}" não existe no banco de teste.` })
    const tem = n => colunas.some(x => x.column_name === n)
    if (!tem(emailColumn) || !tem(passwordColumn)) out({ ok: false, error: `A tabela "${usersTable}" não tem as colunas ${emailColumn} e ${passwordColumn}.` })

    let uid = await achar()
    const criado = !uid
    if (uid) {
      const sets = [`${id(passwordColumn)} = $1`]
      for (const n of ['ativo', 'active', 'enabled']) if (tem(n) && colunas.find(x => x.column_name === n).data_type === 'boolean') sets.push(`${id(n)} = true`)
      await c.query(`update ${id(usersTable)} set ${sets.join(', ')} where ${id(pkUser)}::text = $2`, [hash, uid])
    } else {
      const cols = [id(emailColumn), id(passwordColumn)]
      const vals = ['$1', '$2']
      const params = [ROBO_EMAIL, hash]
      const usadas = new Set([emailColumn, passwordColumn])
      if (auth.nameColumn && tem(auth.nameColumn)) { cols.push(id(auth.nameColumn)); vals.push(`$${params.push(ROBO_NOME)}`); usadas.add(auth.nameColumn) }
      for (const col of colunas) {
        if (usadas.has(col.column_name)) continue
        const ehAtivo = ['ativo', 'active', 'enabled'].includes(col.column_name) && col.data_type === 'boolean'
        const obrigatoria = col.is_nullable === 'NO' && col.column_default == null
        if (!ehAtivo && !obrigatoria) continue
        const t = col.data_type
        const expr = ehAtivo || t === 'boolean' ? 'true' : t === 'uuid' ? 'gen_random_uuid()' : /timestamp|date|time/.test(t) ? 'now()'
          : /int|numeric|decimal|real|double/.test(t) ? '0' : /json/.test(t) ? "'{}'" : `'${ROBO_NOME.replace(/'/g, "''")}'`
        cols.push(id(col.column_name)); vals.push(expr)
      }
      await c.query(`insert into ${id(usersTable)} (${cols.join(', ')}) values (${vals.join(', ')})`, params)
      uid = await achar()
    }

    // gestão de acesso: coloca o usuário no grupo de administração, se o projeto tiver um (não cria grupo nenhum)
    let grupo = null
    const ac = auth.access
    if (ac && uid) {
      const grupos = (await c.query(`select ${id(ac.groupsPk)}::text as id, ${id(ac.groupsNameColumn)}::text as nome from ${id(ac.groupsTable)}`).catch(() => ({ rows: [] }))).rows
      const admin = grupos.find(g => /admin/i.test(g.nome))
      if (admin) {
        grupo = admin.nome
        if (link?.kind === 'table') {
          // duas consultas (e não "insert ... select ... where not exists"): assim o Postgres tipa $1 e $2 pelas colunas (uuid, texto, número)
          const jaTem = (await c.query(`select 1 from ${id(link.table)} where ${id(link.userColumn)}::text = $1 and ${id(link.roleColumn)}::text = $2`, [uid, admin.id])).rowCount > 0
          if (!jaTem) await c.query(`insert into ${id(link.table)} (${id(link.userColumn)}, ${id(link.roleColumn)}) values ($1, $2)`, [uid, admin.id])
        } else if (link?.kind === 'column') {
          await c.query(`update ${id(usersTable)} set ${id(link.column)} = $1 where ${id(pkUser)}::text = $2 and ${id(link.column)} is null`, [admin.id, uid])
        }
      }
    }
    out({ ok: true, user: ROBO_EMAIL, password: senha, created: criado, group: grupo, hash: formato })
  }

  out({ ok: false, error: `ação desconhecida: ${action}` })
} catch (e) {
  out({ ok: false, error: limpar(e.message) })
} finally {
  await c.end().catch(() => {})
}
