// Usuários, grupos e permissões de teste no banco de teste, para QUALQUER projeto: tabelas e colunas vêm da configuração de login do manifesto (auth).
// Usado pela ferramenta de banco (db-tool.mjs) e pelos testes de segurança. Só mexe no que cria: usuários e_mail e2e_*, grupos E2E-Perm*, e as linhas deles.
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/
export const id = n => { if (!IDENT.test(String(n))) throw new Error(`nome inválido: ${n}`); return `"${n}"` }
const q = s => `'${String(s).replace(/'/g, "''")}'`

export const EMAIL_SEG = 'e2e_seg_%@metabuilder.local'
export const GRUPO_SEG = 'E2E-Perm%'

export function hashSenha(formato, senha) {
  const f = String(formato || 'bcrypt').toLowerCase()
  return f === 'bcrypt' ? bcrypt.hashSync(senha, 10)
    : f === 'md5' ? crypto.createHash('md5').update(senha).digest('hex')
    : f === 'sha256' ? crypto.createHash('sha256').update(senha).digest('hex')
    : senha
}

/** Colunas da tabela (nome, tipo, se aceita nulo, se tem valor padrão). */
async function colunas(c, tabela) {
  return (await c.query("select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema = current_schema() and table_name = $1", [tabela])).rows
}

/** Valor SQL para uma coluna obrigatória que o teste não conhece: o mínimo que a faz aceitar a linha. */
function valorPadrao(col, ehChave, rotulo) {
  const t = col.data_type
  if (ehChave && /char|text/.test(t)) return q(`e2e-${crypto.randomBytes(6).toString('hex')}`)
  if (t === 'boolean') return 'true'
  if (t === 'uuid') return 'gen_random_uuid()'
  if (/timestamp|date|time/.test(t)) return 'now()'
  if (/int|numeric|decimal|real|double/.test(t)) return '0'
  if (/json/.test(t)) return "'{}'"
  return q(rotulo)
}

/** Insere uma linha informando só o que se sabe (`dados`: coluna → valor) e completando as colunas obrigatórias sem valor padrão. Devolve a chave primária (texto). */
async function inserir(c, tabela, pk, dados, rotulo) {
  const cols = await colunas(c, tabela)
  if (cols.length === 0) throw new Error(`A tabela "${tabela}" não existe no banco de teste.`)
  const nomes = [], exprs = [], params = []
  const usadas = new Set(Object.keys(dados))
  for (const [col, v] of Object.entries(dados)) { nomes.push(id(col)); exprs.push(`$${params.push(v)}`) }
  for (const col of cols) {
    if (usadas.has(col.column_name)) continue
    const ativo = ['ativo', 'active', 'enabled'].includes(col.column_name) && col.data_type === 'boolean'
    const obrigatoria = col.is_nullable === 'NO' && col.column_default == null
    if (!ativo && !obrigatoria) continue
    nomes.push(id(col.column_name)); exprs.push(ativo ? 'true' : valorPadrao(col, col.column_name === pk, rotulo))
  }
  const r = await c.query(`insert into ${id(tabela)} (${nomes.join(', ')}) values (${exprs.join(', ')}) returning ${id(pk)}::text as pk`, params)
  return r.rows[0].pk
}

const usuarioPor = async (c, auth, email) => (await c.query(`select ${id(auth.usersPk || 'id')}::text as id from ${id(auth.usersTable)} where ${id(auth.emailColumn)} = $1`, [email])).rows[0]?.id

/** Cria o usuário (ou renova a senha do que já existe). Devolve { id, criado }. */
export async function upsertUsuario(c, auth, { email, nome, senha }) {
  const hash = hashSenha(auth.hash, senha)
  const pkU = auth.usersPk || 'id'
  let uid = await usuarioPor(c, auth, email)
  if (uid) {
    const cols = await colunas(c, auth.usersTable)
    const sets = [`${id(auth.passwordColumn)} = $1`]
    for (const n of ['ativo', 'active', 'enabled']) if (cols.some(x => x.column_name === n && x.data_type === 'boolean')) sets.push(`${id(n)} = true`)
    await c.query(`update ${id(auth.usersTable)} set ${sets.join(', ')} where ${id(pkU)}::text = $2`, [hash, uid])
    return { id: uid, criado: false }
  }
  const dados = { [auth.emailColumn]: email, [auth.passwordColumn]: hash }
  if (auth.nameColumn) dados[auth.nameColumn] = nome
  await inserir(c, auth.usersTable, pkU, dados, nome)
  uid = await usuarioPor(c, auth, email)
  return { id: uid, criado: true }
}

/** Coloca o usuário no grupo: linha na tabela de vínculo, ou a coluna do grupo na própria tabela de usuários (só se estiver vazia). */
export async function colocarNoGrupo(c, auth, userId, groupId) {
  const link = auth.access?.link
  if (link?.kind === 'table') {
    const ja = (await c.query(`select 1 from ${id(link.table)} where ${id(link.userColumn)}::text = $1 and ${id(link.roleColumn)}::text = $2`, [userId, groupId])).rowCount > 0
    if (!ja) await c.query(`insert into ${id(link.table)} (${id(link.userColumn)}, ${id(link.roleColumn)}) values ($1, $2)`, [userId, groupId])
  } else if (link?.kind === 'column') {
    await c.query(`update ${id(auth.usersTable)} set ${id(link.column)} = $1 where ${id(auth.usersPk || 'id')}::text = $2`, [groupId, userId])
  }
}

/** Grupo de administração do projeto (o primeiro cujo nome tem "admin"), ou null. */
export async function grupoAdmin(c, auth) {
  const ac = auth.access
  if (!ac) return null
  const grupos = (await c.query(`select ${id(ac.groupsPk)}::text as id, ${id(ac.groupsNameColumn)}::text as nome from ${id(ac.groupsTable)}`).catch(() => ({ rows: [] }))).rows
  return grupos.find(g => /admin/i.test(g.nome)) ?? null
}

/** Cria um grupo temporário (nome E2E-Perm...). Devolve o id dele. */
export async function criarGrupo(c, auth, nome) {
  const ac = auth.access
  return inserir(c, ac.groupsTable, ac.groupsPk, { [ac.groupsNameColumn]: nome }, nome)
}

/** Define o nível de acesso (none, read, write) do grupo numa tela. */
export async function definirNivel(c, auth, groupId, viewSlug, nivel) {
  const ac = auth.access
  await c.query(`delete from ${id(ac.permsTable)} where ${id(ac.permsRoleColumn)}::text = $1 and ${id(ac.permsViewColumn)} = $2`, [groupId, viewSlug])
  await c.query(`insert into ${id(ac.permsTable)} (${id(ac.permsRoleColumn)}, ${id(ac.permsViewColumn)}, ${id(ac.permsLevelColumn)}) values ($1, $2, $3)`, [groupId, viewSlug, nivel])
}

export async function apagarUsuario(c, auth, userId) {
  const link = auth.access?.link
  if (link?.kind === 'table') await c.query(`delete from ${id(link.table)} where ${id(link.userColumn)}::text = $1`, [userId])
  await c.query(`delete from ${id(auth.usersTable)} where ${id(auth.usersPk || 'id')}::text = $1`, [userId])
}

export async function apagarGrupo(c, auth, groupId) {
  const ac = auth.access
  await c.query(`delete from ${id(ac.permsTable)} where ${id(ac.permsRoleColumn)}::text = $1`, [groupId])
  if (ac.link?.kind === 'table') await c.query(`delete from ${id(ac.link.table)} where ${id(ac.link.roleColumn)}::text = $1`, [groupId])
  await c.query(`delete from ${id(ac.groupsTable)} where ${id(ac.groupsPk)}::text = $1`, [groupId])
}

/** Valor do usuário que uma regra por linha compara (e-mail, nome ou uma coluna da tabela de usuários). null = a regra não tem o dado dele. */
export async function valorDoUsuario(c, auth, userId, source, attr) {
  if (source === 'user.email') return (await c.query(`select ${id(auth.emailColumn)}::text as v from ${id(auth.usersTable)} where ${id(auth.usersPk || 'id')}::text = $1`, [userId])).rows[0]?.v ?? null
  if (source === 'user.name') return auth.nameColumn ? ((await c.query(`select ${id(auth.nameColumn)}::text as v from ${id(auth.usersTable)} where ${id(auth.usersPk || 'id')}::text = $1`, [userId])).rows[0]?.v ?? null) : null
  if (source === 'user.attr' && attr) return (await c.query(`select ${id(attr)}::text as v from ${id(auth.usersTable)} where ${id(auth.usersPk || 'id')}::text = $1`, [userId])).rows[0]?.v ?? null
  return null
}

/** Remove o que os testes de segurança criaram e ficou para trás: usuários e2e_seg_*, grupos E2E-Perm* (com permissões e vínculos). */
export async function limparSeguranca(c, auth) {
  if (!auth?.usersTable) return
  const usuarios = (await c.query(`select ${id(auth.usersPk || 'id')}::text as id from ${id(auth.usersTable)} where ${id(auth.emailColumn)} like $1`, [EMAIL_SEG]).catch(() => ({ rows: [] }))).rows
  for (const u of usuarios) await apagarUsuario(c, auth, u.id).catch(() => {})
  const ac = auth.access
  if (ac) {
    const grupos = (await c.query(`select ${id(ac.groupsPk)}::text as id from ${id(ac.groupsTable)} where ${id(ac.groupsNameColumn)}::text like $1`, [GRUPO_SEG]).catch(() => ({ rows: [] }))).rows
    for (const g of grupos) await apagarGrupo(c, auth, g.id).catch(() => {})
  }
}
