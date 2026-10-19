// Usuários, grupos e permissões de teste no banco de teste, para QUALQUER projeto e para os dois bancos (Postgres e Oracle): tabelas e colunas vêm da configuração
// de login do manifesto (auth); o adaptador (banco.mjs) cuida das diferenças de SQL. Usado pela ferramenta de banco (db-tool.mjs) e pelos testes de segurança.
// Só mexe no que cria: usuários e2e_* , grupos E2E-Perm* e as linhas deles.
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'

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

/** Valor SQL para uma coluna obrigatória que o teste não conhece: o mínimo que a faz aceitar a linha. */
function valorPadrao(d, col, ehChave, rotulo) {
  const t = col.data_type
  if (ehChave && /char|text/.test(t)) return q(`e2e-${crypto.randomBytes(6).toString('hex')}`)
  if (t === 'boolean') return 'true'
  if (t === 'uuid') return 'gen_random_uuid()'
  if (/timestamp|date|time/.test(t)) return d.agora
  if (/int|numeric|decimal|real|double|number|float/.test(t)) return '0'
  if (/json/.test(t)) return "'{}'"
  return q(rotulo)
}

/** Coluna de "ativo" do usuário: boolean no Postgres, texto 'true' no Oracle. */
const ehAtivo = (d, col) => ['ativo', 'active', 'enabled'].includes(col.column_name) && (col.data_type === 'boolean' || (d.dialect === 'oracle' && /char/.test(col.data_type)))

/** Insere uma linha informando só o que se sabe (`dados`: coluna → valor) e completando as colunas obrigatórias sem valor padrão. Devolve a chave primária (texto). */
async function inserir(d, tabela, pk, dados, rotulo) {
  const cols = await d.colunas(tabela)
  if (cols.length === 0) throw new Error(`A tabela "${tabela}" não existe no banco de teste.`)
  const nomes = [], exprs = [], params = []
  const usadas = new Set(Object.keys(dados).map(c => c.toLowerCase()))
  for (const [col, v] of Object.entries(dados)) { nomes.push(d.ident(col)); exprs.push(`$${params.push(v)}`) }
  for (const col of cols) {
    if (usadas.has(col.column_name)) continue
    const ativo = ehAtivo(d, col)
    const obrigatoria = col.is_nullable === 'NO' && col.column_default == null
    if (!ativo && !obrigatoria) continue
    nomes.push(d.ident(col.column_name)); exprs.push(ativo ? d.verdadeiro : valorPadrao(d, col, col.column_name === pk.toLowerCase(), rotulo))
  }
  return d.inserir(d.ident(tabela), pk, nomes, exprs, params)
}

const usuarioPor = async (d, auth, email) => (await d.query(`select ${d.ident(auth.usersPk || 'id')}::text as id from ${d.ident(auth.usersTable)} where ${d.ident(auth.emailColumn)} = $1`, [email]))[0]?.id

/** Cria o usuário (ou renova a senha do que já existe). Devolve { id, criado }. */
export async function upsertUsuario(d, auth, { email, nome, senha }) {
  const hash = hashSenha(auth.hash, senha)
  const pkU = auth.usersPk || 'id'
  let uid = await usuarioPor(d, auth, email)
  if (uid) {
    const cols = await d.colunas(auth.usersTable)
    const sets = [`${d.ident(auth.passwordColumn)} = $1`]
    for (const col of cols) if (ehAtivo(d, col)) sets.push(`${d.ident(col.column_name)} = ${d.verdadeiro}`)
    await d.query(`update ${d.ident(auth.usersTable)} set ${sets.join(', ')} where ${d.ident(pkU)}::text = $2`, [hash, uid])
    return { id: uid, criado: false }
  }
  const dados = { [auth.emailColumn]: email, [auth.passwordColumn]: hash }
  if (auth.nameColumn) dados[auth.nameColumn] = nome
  uid = await inserir(d, auth.usersTable, pkU, dados, nome)
  return { id: uid || await usuarioPor(d, auth, email), criado: true }
}

/** Coloca o usuário no grupo: linha na tabela de vínculo, ou a coluna do grupo na própria tabela de usuários (só se estiver vazia). */
export async function colocarNoGrupo(d, auth, userId, groupId) {
  const link = auth.access?.link
  if (link?.kind === 'table') {
    const ja = (await d.query(`select 1 as x from ${d.ident(link.table)} where ${d.ident(link.userColumn)}::text = $1 and ${d.ident(link.roleColumn)}::text = $2`, [userId, groupId])).length > 0
    if (!ja) await d.query(`insert into ${d.ident(link.table)} (${d.ident(link.userColumn)}, ${d.ident(link.roleColumn)}) values ($1, $2)`, [userId, groupId])
  } else if (link?.kind === 'column') {
    await d.query(`update ${d.ident(auth.usersTable)} set ${d.ident(link.column)} = $1 where ${d.ident(auth.usersPk || 'id')}::text = $2 and ${d.ident(link.column)} is null`, [groupId, userId])
  }
}

/** Grupo de administração do projeto (o primeiro cujo nome tem "admin"), ou null. */
export async function grupoAdmin(d, auth) {
  const ac = auth.access
  if (!ac) return null
  const grupos = await d.query(`select ${d.ident(ac.groupsPk)}::text as id, ${d.ident(ac.groupsNameColumn)}::text as nome from ${d.ident(ac.groupsTable)}`).catch(() => [])
  return grupos.find(g => /admin/i.test(g.nome)) ?? null
}

/** Cria um grupo temporário (nome E2E-Perm...). Devolve o id dele. */
export async function criarGrupo(d, auth, nome) {
  const ac = auth.access
  return inserir(d, ac.groupsTable, ac.groupsPk, { [ac.groupsNameColumn]: nome }, nome)
}

/** Define o nível de acesso (none, read, write) do grupo numa tela. */
export async function definirNivel(d, auth, groupId, viewSlug, nivel) {
  const ac = auth.access
  await d.query(`delete from ${d.ident(ac.permsTable)} where ${d.ident(ac.permsRoleColumn)}::text = $1 and ${d.ident(ac.permsViewColumn)} = $2`, [groupId, viewSlug])
  await d.query(`insert into ${d.ident(ac.permsTable)} (${d.ident(ac.permsRoleColumn)}, ${d.ident(ac.permsViewColumn)}, ${d.ident(ac.permsLevelColumn)}) values ($1, $2, $3)`, [groupId, viewSlug, nivel])
}

export async function apagarUsuario(d, auth, userId) {
  const link = auth.access?.link
  if (link?.kind === 'table') await d.query(`delete from ${d.ident(link.table)} where ${d.ident(link.userColumn)}::text = $1`, [userId])
  await d.query(`delete from ${d.ident(auth.usersTable)} where ${d.ident(auth.usersPk || 'id')}::text = $1`, [userId])
}

export async function apagarGrupo(d, auth, groupId) {
  const ac = auth.access
  await d.query(`delete from ${d.ident(ac.permsTable)} where ${d.ident(ac.permsRoleColumn)}::text = $1`, [groupId])
  if (ac.link?.kind === 'table') await d.query(`delete from ${d.ident(ac.link.table)} where ${d.ident(ac.link.roleColumn)}::text = $1`, [groupId])
  await d.query(`delete from ${d.ident(ac.groupsTable)} where ${d.ident(ac.groupsPk)}::text = $1`, [groupId])
}

/** Valor do usuário que uma regra por linha compara (e-mail, nome ou uma coluna da tabela de usuários). null = a regra não tem o dado dele. */
export async function valorDoUsuario(d, auth, userId, source, attr) {
  const coluna = source === 'user.email' ? auth.emailColumn : source === 'user.name' ? auth.nameColumn : source === 'user.attr' ? attr : null
  if (!coluna) return null
  return (await d.query(`select ${d.ident(coluna)}::text as v from ${d.ident(auth.usersTable)} where ${d.ident(auth.usersPk || 'id')}::text = $1`, [userId]))[0]?.v ?? null
}

/** Remove o que os testes de segurança criaram e ficou para trás: usuários e2e_seg_*, grupos E2E-Perm* (com permissões e vínculos). */
export async function limparSeguranca(d, auth) {
  if (!auth?.usersTable) return
  const usuarios = await d.query(`select ${d.ident(auth.usersPk || 'id')}::text as id from ${d.ident(auth.usersTable)} where ${d.ident(auth.emailColumn)} like $1`, [EMAIL_SEG]).catch(() => [])
  for (const u of usuarios) await apagarUsuario(d, auth, u.id).catch(() => {})
  const ac = auth.access
  if (ac) {
    const grupos = await d.query(`select ${d.ident(ac.groupsPk)}::text as id from ${d.ident(ac.groupsTable)} where ${d.ident(ac.groupsNameColumn)}::text like $1`, [GRUPO_SEG]).catch(() => [])
    for (const g of grupos) await apagarGrupo(d, auth, g.id).catch(() => {})
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Conferências das telas de gestão de acesso (só leem, exceto apagar o que o próprio teste criou)
// ---------------------------------------------------------------------------------------------------------------------

export const usuarioPorEmail = (d, auth, email) => usuarioPor(d, auth, email)

/** Id do grupo do usuário (vínculo em tabela ou coluna do próprio usuário); null = sem grupo. */
export async function grupoDoUsuario(d, auth, userId) {
  const link = auth.access?.link
  if (link?.kind === 'table') return (await d.query(`select ${d.ident(link.roleColumn)}::text as g from ${d.ident(link.table)} where ${d.ident(link.userColumn)}::text = $1`, [userId]))[0]?.g ?? null
  if (link?.kind === 'column') return (await d.query(`select ${d.ident(link.column)}::text as g from ${d.ident(auth.usersTable)} where ${d.ident(auth.usersPk || 'id')}::text = $1`, [userId]))[0]?.g ?? null
  return null
}

/** Os grupos do projeto: [{ id, nome }]. */
export async function listarGrupos(d, auth) {
  const ac = auth.access
  return d.query(`select ${d.ident(ac.groupsPk)}::text as id, ${d.ident(ac.groupsNameColumn)}::text as nome from ${d.ident(ac.groupsTable)}`)
}

/** Usuários de verdade (fora os temporários e o robô do motor), para conferir a lista da tela. */
export async function usuariosReais(d, auth, limite = 5) {
  const todos = await d.query(`select ${d.ident(auth.usersPk || 'id')}::text as id, ${d.ident(auth.emailColumn)}::text as email from ${d.ident(auth.usersTable)}`)
  return todos.filter(u => !/^e2e_(seg_|motor)/i.test(String(u.email))).slice(0, limite)
}

/** Resumo do vínculo usuário-grupo de TODOS os usuários que não são temporários: não pode mudar quando se troca o grupo de um usuário ou se exclui um. */
export async function vinculosDeOutros(d, auth) {
  const link = auth.access?.link
  let rows = []
  if (link?.kind === 'table') {
    rows = await d.query(`select ${d.ident('u')}.${d.ident(auth.emailColumn)}::text as email, l.${d.ident(link.roleColumn)}::text as g from ${d.ident(link.table)} l join ${d.ident(auth.usersTable)} u on u.${d.ident(auth.usersPk || 'id')} = l.${d.ident(link.userColumn)}`)
  } else if (link?.kind === 'column') {
    rows = await d.query(`select ${d.ident(auth.emailColumn)}::text as email, ${d.ident(link.column)}::text as g from ${d.ident(auth.usersTable)}`)
  }
  return JSON.stringify(rows.filter(r => !/^e2e_seg_/i.test(String(r.email))).map(r => `${r.email}|${r.g}`).sort())
}

export async function lerHashDoUsuario(d, auth, userId) {
  return (await d.query(`select ${d.ident(auth.passwordColumn)}::text as h from ${d.ident(auth.usersTable)} where ${d.ident(auth.usersPk || 'id')}::text = $1`, [userId]))[0]?.h ?? null
}

/** A senha confere com o hash gravado (no formato do projeto)? */
export function confereSenha(formato, senha, hash) {
  const f = String(formato || 'bcrypt').toLowerCase()
  return f === 'bcrypt' ? bcrypt.compareSync(senha, String(hash)) : hashSenha(f, senha) === hash
}

/** Nível gravado do grupo numa tela (none, read, write); null = sem linha (a tela segue o padrão). */
export async function nivelDoGrupo(d, auth, groupId, viewSlug) {
  const ac = auth.access
  return (await d.query(`select ${d.ident(ac.permsLevelColumn)}::text as n from ${d.ident(ac.permsTable)} where ${d.ident(ac.permsRoleColumn)}::text = $1 and ${d.ident(ac.permsViewColumn)} = $2`, [groupId, viewSlug]))[0]?.n ?? null
}
