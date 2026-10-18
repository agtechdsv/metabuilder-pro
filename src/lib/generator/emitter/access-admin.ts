import type { AppAST } from '../ast'
import { ACCESS_SLUGS, accessSql, accessStatements } from '../accessAdmin'
import { getAccessDictionary } from '../accessI18n'
import { SETUP_SCRIPT } from './access-setup-script'

/**
 * Gestão de acesso do app exportado (Node.js e frontend do Java Spring): permissões por tela (nenhum / leitura / escrita) e os
 * casos de uso de Usuários, Grupos de Acesso e Permissões de Telas.
 *
 * Tudo é montado em cima das ações de CRUD que o gerador já cria por tabela (get/create/update/delete), então funciona nos mesmos
 * bancos e também quando o backend é Java (as ações chamam a API REST). Os arquivos aqui só dependem de `@/app/actions/<modelo>`.
 */

const fileKey = (model: string) => model.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '')

/** Troca __CHAVE__ pelo valor (o código gerado usa aspas e "+", nunca template literal: sem escapes). */
function fill(src: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.split(`__${k}__`).join(v), src)
}

export function generateAccessAdmin(ast: AppAST, files: Map<string, string>): void {
  const a = ast.accessAdmin
  if (!a) return
  const dict = getAccessDictionary(ast.targetLanguage)
  // troca {{chave}} pelo texto do idioma de geração
  const tr = (src: string) => src.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => (dict as any)[k] ?? k)
  const linkImport = a.link.kind === 'table'
    ? `import { get${a.link.model}List, get${a.link.model}ByField, create${a.link.model}, delete${a.link.model}${ast.backendStack === 'java-spring' ? '' : `, delete${a.link.model}Where`} } from '@/app/actions/${fileKey(a.link.model)}'\n`
    : ''
  const vars = {
    SETUP: JSON.stringify({ ...a, nameCol: a.nameCol ?? null, seed: undefined }, null, 2),
    UM: a.usersModel, UF: fileKey(a.usersModel),
    GM: a.groups.model, GF: fileKey(a.groups.model),
    PM: a.perms.model, PF: fileKey(a.perms.model),
    LINK_IMPORT: linkImport,
    LINK_BY_FIELD: a.link.kind === 'table' ? `get${a.link.model}ByField` : 'null as any',
    LINK_LIST: a.link.kind === 'table' ? `get${a.link.model}List` : 'null as any',
    LINK_CREATE: a.link.kind === 'table' ? `create${a.link.model}` : 'null as any',
    LINK_DELETE: a.link.kind === 'table' ? `delete${a.link.model}` : 'null as any',
    // exclusão pelo par usuário + grupo (nunca só pelo código do grupo, que apagaria o vínculo de todos os usuários dele)
    LINK_DELETE_WHERE: a.link.kind === 'table' && ast.backendStack !== 'java-spring' ? `delete${a.link.model}Where` : 'null as any',
    HASH_IMPORT: a.hash === 'bcrypt' ? `import bcrypt from 'bcryptjs'\n` : (a.hash === 'md5' || a.hash === 'sha256') ? `import crypto from 'node:crypto'\n` : '',
    HASH_EXPR:
      a.hash === 'bcrypt' ? 'await bcrypt.hash(pw, 10)'
      : a.hash === 'md5' ? `crypto.createHash('md5').update(pw).digest('hex')`
      : a.hash === 'sha256' ? `crypto.createHash('sha256').update(pw).digest('hex')`
      : 'pw',
    SLUG_USERS: ACCESS_SLUGS.users, SLUG_GROUPS: ACCESS_SLUGS.groups, SLUG_PERMS: ACCESS_SLUGS.permissions,
    PROJECT: ast.projectName.replace(/[^\p{L}\p{N} _.-]/gu, ''),
  }

  files.set('lib/access-setup.ts', `// ARQUIVO GERADO pelo MetaBuilder — configuração da gestão de acesso (quem são os usuários, os grupos e as telas).\nexport const ACCESS_SETUP = ${vars.SETUP} as const\n`)
  files.set('lib/access-control.ts', fill(ACCESS_CONTROL, vars))
  files.set('lib/access-guard.ts', tr(ACCESS_GUARD))
  files.set('app/actions/access-admin.ts', tr(fill(ACCESS_ADMIN_ACTIONS, vars)))
  files.set(`app/(protected)/${ACCESS_SLUGS.users}/page.tsx`, fill(USERS_PAGE, vars))
  files.set('components/AccessDialog.tsx', ACCESS_DIALOG)
  files.set(`app/(protected)/${ACCESS_SLUGS.users}/UsersClient.tsx`, tr(USERS_CLIENT))
  files.set(`app/(protected)/${ACCESS_SLUGS.groups}/page.tsx`, fill(GROUPS_PAGE, vars))
  files.set(`app/(protected)/${ACCESS_SLUGS.groups}/GroupsClient.tsx`, tr(GROUPS_CLIENT))
  files.set(`app/(protected)/${ACCESS_SLUGS.permissions}/page.tsx`, fill(PERMS_PAGE, vars))
  files.set(`app/(protected)/${ACCESS_SLUGS.permissions}/PermissionsClient.tsx`, tr(PERMS_CLIENT))
  files.set('db/access-control.sql', accessSql(ast))
  // app Node: o comando  npm run db:setup  cria as tabelas pela conexão do .env.local (no Java, o script SQL é rodado no banco do backend)
  if (ast.backendStack !== 'java-spring') {
    files.set('db/access-control.json', JSON.stringify({ statements: accessStatements(ast), tables: [a.perms.table, ...(a.groups.synthetic ? [a.groups.table] : []), ...(a.link.kind === 'table' && a.link.synthetic ? [a.link.table] : [])] }, null, 2) + '\n')
    files.set('scripts/setup-access.mjs', SETUP_SCRIPT.split('__STACK__').join(ast.dbStack))
  }
}

/** Acrescenta o comando  npm run db:setup  ao package.json do app. */
export function addSetupScript(pkg: string): string {
  try {
    const p = JSON.parse(pkg)
    p.scripts = { ...(p.scripts || {}), 'db:setup': 'node scripts/setup-access.mjs' }
    return JSON.stringify(p, null, 2) + '\n'
  } catch {
    return pkg
  }
}



// Código que cada ação de gravação do app executa primeiro: recusa quem só tem leitura na(s) tela(s) da tabela.
export const WRITE_GUARD_IMPORT = `import { assertWriteAllowed } from '@/lib/access-guard'\n`

/** Faz create/update/delete do modelo recusarem usuários que só têm leitura. Serve a qualquer banco e ao frontend Java. */
export function applyWriteGuard(content: string, model: { name: string; dbTable: string }): string {
  let out = content
  for (const kind of ['create', 'update', 'delete'] as const) {
    const start = out.indexOf(`export async function ${kind}${model.name}(`)
    if (start < 0) continue
    const open = out.indexOf('{\n', start)
    if (open < 0) continue
    out = out.slice(0, open + 2) + `  await assertWriteAllowed(${JSON.stringify(model.dbTable)})\n` + out.slice(open + 2)
  }
  if (out === content) return content
  // o import vem logo depois do 'use server' (ou no topo)
  const m = out.match(/^(['"]use server['"]\n)/)
  return m ? m[1] + WRITE_GUARD_IMPORT + out.slice(m[1].length) : WRITE_GUARD_IMPORT + out
}

// ─────────────────────────────────────────────────────────────────────────────
// lib/access-guard.ts
// ─────────────────────────────────────────────────────────────────────────────
const ACCESS_GUARD = `// ARQUIVO GERADO pelo MetaBuilder — recusa gravações de quem só tem permissão de leitura nas telas da tabela.
// Vale no servidor (o navegador não consegue contornar): as ações de criar/editar/excluir chamam isto antes de gravar.
import { AsyncLocalStorage } from 'node:async_hooks'
import { headers } from 'next/headers'
import { getSessionUser } from '@/lib/session-server'
import { ACCESS_SETUP } from '@/lib/access-setup'

// um único armazenamento para o processo todo (o Next pode carregar este módulo em mais de um pacote)
const g = globalThis as any
const bypass: AsyncLocalStorage<boolean> = (g.__mbAccessBypass ||= new AsyncLocalStorage<boolean>())

/** As telas de gestão de acesso têm a própria permissão: dentro delas as gravações não passam pela regra das telas de cadastro. */
export function asAccessAdmin<T>(fn: () => Promise<T>): Promise<T> {
  return bypass.run(true, fn)
}

/** Tela (rota) de onde a gravação foi pedida: o navegador manda a página de origem junto da ação de servidor. */
async function originScreen(): Promise<string | null> {
  try {
    const ref = (await headers()).get('referer')
    if (!ref) return null
    const path = new URL(ref).pathname
    let best: { slug: string; path: string } | null = null
    for (const v of ACCESS_SETUP.views as ReadonlyArray<{ slug: string; path: string }>) {
      if (v.path === '/') continue
      if ((path === v.path || path.startsWith(v.path + '/')) && (!best || v.path.length > best.path.length)) best = v
    }
    return best ? best.slug : null
  } catch {
    return null
  }
}

export async function assertWriteAllowed(table: string): Promise<void> {
  if (bypass.getStore()) return
  const user = await getSessionUser()
  const acc = user?.acc
  if (!acc) return
  // 1) a tela em que o usuário está é só de leitura (ex.: Clientes), mesmo que outra tela dele grave na mesma tabela
  if (acc.ro.length > 0) {
    const screen = await originScreen()
    if (screen && acc.ro.includes(screen)) throw new Error('{{err_read_only_table}}')
  }
  // 2) nenhuma tela do grupo grava nesta tabela (vale também para pedidos feitos fora das telas)
  if (acc.wt.length === 0) return
  const t = String(table).toLowerCase().split('.').pop() as string
  if (acc.wt.includes(t)) throw new Error('{{err_read_only_table}}')
}
`

// ─────────────────────────────────────────────────────────────────────────────
// lib/access-control.ts — calcula o que o usuário pode ver/gravar (usado pelo login)
// ─────────────────────────────────────────────────────────────────────────────
const ACCESS_CONTROL = `// ARQUIVO GERADO pelo MetaBuilder — descobre o grupo do usuário e o nível de cada tela (nenhum, leitura ou escrita).
import { ACCESS_SETUP as S } from './access-setup'
import { get__PM__ByField } from '@/app/actions/__PF__'
import { get__GM__List } from '@/app/actions/__GF__'
__LINK_IMPORT__
export type AccessLevel = 'none' | 'read' | 'write'
/** no = telas bloqueadas · ro = telas só de leitura · wt = tabelas em que o usuário não pode gravar · gr = nomes dos grupos do usuário */
export interface AccessInfo { no: string[]; ro: string[]; wt: string[]; gr: string[] }

export function rowsOf(res: any): any[] {
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res.content)) return res.content
  return res ? [res] : []
}

/** Valor de uma coluna sem diferenciar maiúsculas (o Oracle devolve os nomes em caixa alta). */
export function pick(row: any, col: string): any {
  if (!row) return undefined
  if (col in row) return row[col]
  const key = Object.keys(row).find(k => k.toLowerCase() === col.toLowerCase())
  return key ? row[key] : undefined
}

const LINK_BY_FIELD: any = __LINK_BY_FIELD__

export async function roleIdsOf(user: any): Promise<string[]> {
  const L: any = S.link
  if (L.kind === 'column') {
    const v = pick(user, L.col)
    return v === undefined || v === null || v === '' ? [] : [String(v)]
  }
  const uid = pick(user, S.usersPk)
  if (uid === undefined || uid === null) return []
  const res = rowsOf(await LINK_BY_FIELD(L.userCol, uid))
  return res.map(r => pick(r, L.roleCol)).filter(v => v !== undefined && v !== null && v !== '').map(String)
}

const RANK: Record<string, number> = { none: 0, read: 1, write: 2 }

export async function loadAccess(user: any): Promise<AccessInfo> {
  const roleIds = await roleIdsOf(user)
  // nomes dos grupos do usuário: usados na exceção "por grupo" das regras de acesso por linha
  let gr: string[] = []
  if (roleIds.length > 0) {
    try {
      gr = rowsOf(await get__GM__List())
        .filter(r => roleIds.includes(String(pick(r, S.groups.pk))))
        .map(r => String(pick(r, S.groups.nameCol) ?? '').trim())
        .filter(Boolean)
    } catch { gr = [] }
  }
  const perRole: Array<Record<string, string>> = []
  for (const rid of roleIds) {
    const rows = rowsOf(await get__PM__ByField(S.perms.roleCol, rid))
    const m: Record<string, string> = {}
    for (const r of rows) m[String(pick(r, S.perms.viewCol))] = String(pick(r, S.perms.levelCol))
    perRole.push(m)
  }
  // sem grupo, sem acesso a nenhuma tela. Com mais de um grupo vale o maior nível. Tela sem linha: escrita (as de gestão de acesso: nenhum).
  const levelOf = (slug: string, denyByDefault: boolean): AccessLevel => {
    if (perRole.length === 0) return 'none'
    let best = 0
    for (const m of perRole) {
      const v = m[slug]
      const lvl = v === undefined ? (denyByDefault ? 'none' : 'write') : (v in RANK ? v : 'none')
      best = Math.max(best, RANK[lvl])
    }
    return (['none', 'read', 'write'] as const)[best]
  }
  const no: string[] = []
  const ro: string[] = []
  const seen = new Set<string>()
  const writable = new Set<string>()
  for (const v of S.views as ReadonlyArray<{ slug: string; table: string | null; denyByDefault?: boolean }>) {
    const lvl = levelOf(v.slug, !!v.denyByDefault)
    if (lvl === 'none') no.push(v.slug)
    else if (lvl === 'read') ro.push(v.slug)
    if (v.table) {
      const t = v.table.toLowerCase().split('.').pop() as string
      seen.add(t)
      if (lvl === 'write') writable.add(t)
    }
  }
  return { no, ro, wt: [...seen].filter(t => !writable.has(t)), gr }
}
`

// ─────────────────────────────────────────────────────────────────────────────
// app/actions/access-admin.ts — o que as 3 telas de gestão chamam
// ─────────────────────────────────────────────────────────────────────────────
const ACCESS_ADMIN_ACTIONS = `'use server'
// ARQUIVO GERADO pelo MetaBuilder — ações das telas Usuários, Grupos de Acesso e Permissões de Telas.
// Cada ação confere a permissão do usuário logado na tela correspondente antes de ler ou gravar.
import { getSessionUser } from '@/lib/session-server'
import { asAccessAdmin } from '@/lib/access-guard'
import { ACCESS_SETUP as S } from '@/lib/access-setup'
import { rowsOf, pick } from '@/lib/access-control'
import { get__UM__List, get__UM__ByField, create__UM__, update__UM__, delete__UM__ } from '@/app/actions/__UF__'
import { get__GM__List, create__GM__, update__GM__, delete__GM__ } from '@/app/actions/__GF__'
import { get__PM__List, get__PM__ByField, create__PM__, update__PM__, delete__PM__ } from '@/app/actions/__PF__'
__LINK_IMPORT__
__HASH_IMPORT__
const linkByField: any = __LINK_BY_FIELD__
const linkList: any = __LINK_LIST__
const linkCreate: any = __LINK_CREATE__
const linkDelete: any = __LINK_DELETE__
const linkDeleteWhere: any = __LINK_DELETE_WHERE__

type Need = 'read' | 'write'

async function need(slug: string, level: Need) {
  const user = await getSessionUser()
  if (!user) throw new Error('{{err_session_expired}}')
  const acc = user.acc
  if (!acc || acc.no.includes(slug)) throw new Error('{{err_no_access}}')
  if (level === 'write' && acc.ro.includes(slug)) throw new Error('{{err_read_only_screen}}')
}

const NAME_COL = S.nameCol as string | null
const str = (v: unknown) => (v === undefined || v === null ? '' : String(v))

export interface AccessUser { id: string; email: string; name: string; roleId: string }
export interface AccessRole { id: string; name: string }
export interface AccessMatrix {
  roles: AccessRole[]
  views: Array<{ slug: string; title: string; denyByDefault: boolean }>
  levels: Record<string, Record<string, 'none' | 'read' | 'write'>>
}

async function hashPassword(pw: string): Promise<string> {
  return __HASH_EXPR__
}

async function roleByUser(): Promise<Map<string, string>> {
  const L: any = S.link
  const map = new Map<string, string>()
  if (L.kind !== 'table') return map
  for (const r of rowsOf(await linkList())) {
    const uid = str(pick(r, L.userCol))
    if (uid && !map.has(uid)) map.set(uid, str(pick(r, L.roleCol)))
  }
  return map
}

export async function listRoles(): Promise<AccessRole[]> {
  await need('__SLUG_USERS__', 'read').catch(async () => need('__SLUG_GROUPS__', 'read')).catch(async () => need('__SLUG_PERMS__', 'read'))
  return rowsOf(await get__GM__List()).map(r => ({ id: str(pick(r, S.groups.pk)), name: str(pick(r, S.groups.nameCol)) })).filter(r => r.id)
}

export async function listUsers(): Promise<AccessUser[]> {
  await need('__SLUG_USERS__', 'read')
  const L: any = S.link
  const links = await roleByUser()
  return rowsOf(await get__UM__List()).map(r => {
    const id = str(pick(r, S.usersPk))
    return {
      id,
      email: str(pick(r, S.emailCol)),
      name: NAME_COL ? str(pick(r, NAME_COL)) : '',
      roleId: L.kind === 'column' ? str(pick(r, L.col)) : (links.get(id) || ''),
    }
  }).filter(u => u.id)
}

async function assignRole(userId: string, roleId: string) {
  const L: any = S.link
  if (L.kind === 'column') {
    await update__UM__(userId, { [L.col]: roleId || null })
    return
  }
  for (const r of rowsOf(await linkByField(L.userCol, userId))) {
    if (str(pick(r, L.userCol)) !== userId) continue
    if (linkDeleteWhere) {
      // só o vínculo DESTE usuário com o grupo (excluir pelo código do grupo apagaria o vínculo de todos os outros usuários dele)
      const res = await linkDeleteWhere({ [L.userCol]: userId, [L.roleCol]: str(pick(r, L.roleCol)) })
      if (res && res.success === false) throw new Error(res.error || 'Erro ao trocar o grupo.')
    } else if (L.pk !== L.userCol && L.pk !== L.roleCol) {
      await linkDelete(str(pick(r, L.pk)))   // a tabela de ligação tem um código próprio por linha
    } else {
      throw new Error('Não foi possível trocar o grupo com segurança: a tabela de ligação não tem código próprio por linha.')
    }
  }
  if (roleId) await linkCreate({ [L.userCol]: userId, [L.roleCol]: roleId })
}

export async function setUserRole(userId: string, roleId: string): Promise<void> {
  await need('__SLUG_USERS__', 'write')
  await asAccessAdmin(() => assignRole(userId, roleId))
}

export async function createUser(input: { email: string; name?: string; password: string; roleId?: string }): Promise<void> {
  await need('__SLUG_USERS__', 'write')
  const email = input.email.trim()
  if (!email || !input.password) throw new Error('{{err_email_password}}')
  await asAccessAdmin(async () => {
    const data: Record<string, any> = { [S.emailCol]: email, [S.passCol]: await hashPassword(input.password) }
    if (NAME_COL && input.name) data[NAME_COL] = input.name.trim()
    if ((S.link as any).kind === 'column' && input.roleId) data[(S.link as any).col] = input.roleId
    await create__UM__(data)
    if ((S.link as any).kind === 'table' && input.roleId) {
      const created = rowsOf(await get__UM__ByField(S.emailCol, email)).find(r => str(pick(r, S.emailCol)).toLowerCase() === email.toLowerCase())
      if (created) await assignRole(str(pick(created, S.usersPk)), input.roleId)
    }
  })
}

export async function updateUser(userId: string, input: { email: string; name?: string }): Promise<void> {
  await need('__SLUG_USERS__', 'write')
  const email = input.email.trim()
  if (!email) throw new Error('{{err_email}}')
  await asAccessAdmin(async () => {
    const data: Record<string, any> = { [S.emailCol]: email }
    if (NAME_COL) data[NAME_COL] = (input.name || '').trim() || null
    await update__UM__(userId, data)
  })
}

export async function resetUserPassword(userId: string, password: string): Promise<void> {
  await need('__SLUG_USERS__', 'write')
  if (!password) throw new Error('{{err_new_password}}')
  await asAccessAdmin(async () => { await update__UM__(userId, { [S.passCol]: await hashPassword(password) }) })
}

export async function deleteUser(userId: string): Promise<void> {
  await need('__SLUG_USERS__', 'write')
  await asAccessAdmin(async () => {
    if ((S.link as any).kind === 'table') await assignRole(userId, '')
    await delete__UM__(userId)
  })
}

export async function createRole(name: string): Promise<void> {
  await need('__SLUG_GROUPS__', 'write')
  const n = name.trim()
  if (!n) throw new Error('{{err_group_name}}')
  const data: Record<string, any> = { [S.groups.nameCol]: n }
  // grupos próprios do app usam um identificador texto; os do banco legado deixam o banco numerar
  if ((S.groups as any).synthetic) data[S.groups.pk] = globalThis.crypto.randomUUID()
  await asAccessAdmin(async () => { await create__GM__(data) })
}

export async function renameRole(id: string, name: string): Promise<void> {
  await need('__SLUG_GROUPS__', 'write')
  const n = name.trim()
  if (!n) throw new Error('{{err_group_name}}')
  await asAccessAdmin(async () => { await update__GM__(id, { [S.groups.nameCol]: n }) })
}

export async function deleteRole(id: string): Promise<void> {
  await need('__SLUG_GROUPS__', 'write')
  await asAccessAdmin(async () => {
    for (const r of rowsOf(await get__PM__ByField(S.perms.roleCol, id))) {
      if (str(pick(r, S.perms.roleCol)) === id) await delete__PM__(str(pick(r, S.perms.pk)))
    }
    const L: any = S.link
    if (L.kind === 'table') {
      for (const r of rowsOf(await linkByField(L.roleCol, id))) {
        if (str(pick(r, L.roleCol)) === id) await linkDelete(str(pick(r, L.pk)))
      }
    }
    await delete__GM__(id)
  })
}

export async function loadMatrix(): Promise<AccessMatrix> {
  await need('__SLUG_PERMS__', 'read')
  const roles = rowsOf(await get__GM__List()).map(r => ({ id: str(pick(r, S.groups.pk)), name: str(pick(r, S.groups.nameCol)) })).filter(r => r.id)
  const rows = rowsOf(await get__PM__List())
  const levels: AccessMatrix['levels'] = {}
  for (const role of roles) levels[role.id] = {}
  for (const r of rows) {
    const rid = str(pick(r, S.perms.roleCol))
    const lvl = str(pick(r, S.perms.levelCol))
    if (levels[rid] && (lvl === 'none' || lvl === 'read' || lvl === 'write')) levels[rid][str(pick(r, S.perms.viewCol))] = lvl
  }
  const views = (S.views as ReadonlyArray<{ slug: string; title: string; denyByDefault?: boolean }>).map(v => ({ slug: v.slug, title: v.title, denyByDefault: !!v.denyByDefault }))
  return { roles, views, levels }
}

/** Grava o nível de uma tela para um grupo. Vale no próximo login do usuário (o nível fica na sessão). */
export async function setPermission(roleId: string, slug: string, level: 'none' | 'read' | 'write'): Promise<void> {
  await need('__SLUG_PERMS__', 'write')
  const view = (S.views as ReadonlyArray<{ slug: string; denyByDefault?: boolean }>).find(v => v.slug === slug)
  if (!view) throw new Error('{{err_unknown_screen}}')
  if (!['none', 'read', 'write'].includes(level)) throw new Error('{{err_invalid_level}}')
  // sem linha = o padrão da tela (escrita; nas telas de gestão de acesso, nenhum)
  const isDefault = level === (view.denyByDefault ? 'none' : 'write')
  await asAccessAdmin(async () => {
    const rows = rowsOf(await get__PM__ByField(S.perms.roleCol, roleId)).filter(r => str(pick(r, S.perms.roleCol)) === roleId && str(pick(r, S.perms.viewCol)) === slug)
    if (isDefault) {
      for (const r of rows) await delete__PM__(str(pick(r, S.perms.pk)))
    } else if (rows.length > 0) {
      await update__PM__(str(pick(rows[0], S.perms.pk)), { [S.perms.levelCol]: level })
    } else {
      await create__PM__({ [S.perms.roleCol]: roleId, [S.perms.viewCol]: slug, [S.perms.levelCol]: level })
    }
  })
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Páginas (servidor) e componentes de tela (cliente)
// ─────────────────────────────────────────────────────────────────────────────
const pageShell = (slug: string, imports: string, load: string, render: string) => `import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/session-server'
${imports}

export const dynamic = 'force-dynamic'

export default async function Page() {
  const user = await getSessionUser()
  if (user?.acc?.no.includes('${slug}')) redirect('/')
  const canWrite = !user?.acc?.ro.includes('${slug}')
${load}
  return ${render}
}
`

const USERS_PAGE = pageShell(
  ACCESS_SLUGS.users,
  `import { listUsers, listRoles } from '@/app/actions/access-admin'\nimport { ACCESS_SETUP } from '@/lib/access-setup'\nimport UsersClient from './UsersClient'`,
  `  const [users, roles] = await Promise.all([listUsers(), listRoles()])`,
  `<UsersClient initialUsers={users} roles={roles} canWrite={canWrite} hasName={!!ACCESS_SETUP.nameCol} />`,
)
const GROUPS_PAGE = pageShell(
  ACCESS_SLUGS.groups,
  `import { listRoles } from '@/app/actions/access-admin'\nimport GroupsClient from './GroupsClient'`,
  `  const roles = await listRoles()`,
  `<GroupsClient initialRoles={roles} canWrite={canWrite} />`,
)
const PERMS_PAGE = pageShell(
  ACCESS_SLUGS.permissions,
  `import { loadMatrix } from '@/app/actions/access-admin'\nimport PermissionsClient from './PermissionsClient'`,
  `  const matrix = await loadMatrix()`,
  `<PermissionsClient initialMatrix={matrix} canWrite={canWrite} />`,
)

const CARD = 'bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-3xl'
const BTN = 'px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all active:scale-95 disabled:opacity-50'
const INPUT = 'w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm text-neutral-900 dark:text-white outline-none focus:border-indigo-500'

// Janela de diálogo das telas de gestão de acesso (no lugar dos prompt/confirm do navegador): mesmo visual do app, fecha com Esc.
const ACCESS_DIALOG = `'use client'
import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export const DIALOG_INPUT = 'w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm text-neutral-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all'
export const DIALOG_LABEL = 'block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5'
export const BTN_PRIMARY = 'px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'
export const BTN_DANGER = 'px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold tracking-wide transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'
export const BTN_GHOST = 'px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-bold tracking-wide transition-all disabled:opacity-50'

export function AccessDialog({ title, subtitle, icon, tone = 'indigo', busy = false, onClose, children, footer }: {
  title: string
  subtitle?: string
  icon?: ReactNode
  tone?: 'indigo' | 'red'
  busy?: boolean
  onClose: () => void
  children?: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const badge = tone === 'red' ? 'bg-red-500/10 text-red-500' : 'bg-indigo-500/10 text-indigo-500'
  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { if (!busy) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 px-6 pt-6">
          {icon && <div className={'w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center ' + badge}>{icon}</div>}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-xs text-neutral-500 mt-0.5 break-words">{subtitle}</p>}
          </div>
          <button type="button" disabled={busy} onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"><X className="w-4 h-4" /></button>
        </div>
        {children && <div className="px-6 py-5 space-y-4">{children}</div>}
        {footer && <div className="px-6 pb-6 pt-1 flex items-center justify-end gap-2.5">{footer}</div>}
      </div>
    </div>
  )
}
`

const USERS_CLIENT = `'use client'
import { useState, useTransition } from 'react'
import { UserPlus, UserCog, KeyRound, Trash2, Pencil } from 'lucide-react'
import { listUsers, setUserRole, createUser, updateUser, resetUserPassword, deleteUser, type AccessUser, type AccessRole } from '@/app/actions/access-admin'
import { AccessDialog, DIALOG_INPUT, DIALOG_LABEL, BTN_PRIMARY, BTN_DANGER, BTN_GHOST } from '@/components/AccessDialog'

type Dialog = null | { kind: 'create' } | { kind: 'edit'; user: AccessUser } | { kind: 'password'; user: AccessUser } | { kind: 'delete'; user: AccessUser }

export default function UsersClient({ initialUsers, roles, canWrite, hasName }: { initialUsers: AccessUser[]; roles: AccessRole[]; canWrite: boolean; hasName: boolean }) {
  const [users, setUsers] = useState(initialUsers)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [form, setForm] = useState({ email: '', name: '', password: '', roleId: '' })
  const [pw, setPw] = useState({ next: '', again: '' })

  const reload = async () => setUsers(await listUsers())
  const run = (fn: () => Promise<void>) => start(async () => {
    setError('')
    try { await fn(); await reload() } catch (e: any) { setError(e?.message || '{{generic_error}}') }
  })
  const open = (d: Dialog) => { setError(''); setDialog(d) }
  const close = () => { setError(''); setDialog(null) }
  const errorBox = error ? <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">{error}</div> : null

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">{{users_title}}</h1>
          <p className="text-sm text-neutral-500">{{users_subtitle}}</p>
        </div>
        {canWrite && (
          <button className={'${BTN} flex items-center gap-2'} onClick={() => { setForm({ email: '', name: '', password: '', roleId: '' }); open({ kind: 'create' }) }}><UserPlus className="w-4 h-4" /> {{create_user}}</button>
        )}
      </div>
      {!dialog && error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">{error}</div>}
      <div className="${CARD} overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-neutral-800 text-[10px] font-black uppercase tracking-widest text-neutral-400">
              <th className="px-6 py-4">{{col_user}}</th><th className="px-6 py-4">{{col_email}}</th><th className="px-6 py-4">{{col_group}}</th><th className="px-6 py-4 text-right">{{col_actions}}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {users.map(u => (
              <tr key={u.id}>
                <td className="px-6 py-4 text-sm font-bold text-neutral-900 dark:text-white">{u.name || u.email.split('@')[0]}</td>
                <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-300">{u.email}</td>
                <td className="px-6 py-4">
                  <select
                    disabled={!canWrite || pending}
                    value={u.roleId}
                    onChange={e => run(() => setUserRole(u.id, e.target.value))}
                    className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs font-semibold text-neutral-900 dark:text-white"
                  >
                    <option value="">{{no_group}}</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </td>
                <td className="px-6 py-4 text-right">
                  {canWrite && (
                    <div className="inline-flex gap-1">
                      <button title="{{edit}}" className="p-2 rounded-lg text-neutral-400 hover:text-indigo-600 hover:bg-indigo-500/10" onClick={() => { setForm({ email: u.email, name: u.name, password: '', roleId: u.roleId }); open({ kind: 'edit', user: u }) }}><Pencil className="w-4 h-4" /></button>
                      <button title="{{reset_password}}" className="p-2 rounded-lg text-neutral-400 hover:text-indigo-600 hover:bg-indigo-500/10" onClick={() => { setPw({ next: '', again: '' }); open({ kind: 'password', user: u }) }}><KeyRound className="w-4 h-4" /></button>
                      <button title="{{delete}}" className="p-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-500/10" onClick={() => open({ kind: 'delete', user: u })}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={4} className="px-6 py-10 text-center text-sm text-neutral-500">{{no_users}}</td></tr>}
          </tbody>
        </table>
      </div>

      {dialog?.kind === 'create' && (
        <AccessDialog title="{{create_user}}" icon={<UserPlus className="w-5 h-5" />} busy={pending} onClose={close}
          footer={<><button className={BTN_GHOST} disabled={pending} onClick={close}>{{cancel}}</button><button className={BTN_PRIMARY} disabled={pending || !form.email.trim() || !form.password} onClick={() => run(async () => { await createUser(form); close() })}>{{save}}</button></>}>
          {errorBox}
          {hasName && <div><label className={DIALOG_LABEL}>{{name_label}}</label><input className={DIALOG_INPUT} placeholder="{{name_optional}}" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>}
          <div><label className={DIALOG_LABEL}>{{email_label}}</label><input className={DIALOG_INPUT} type="email" autoFocus value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className={DIALOG_LABEL}>{{password_label}}</label><input className={DIALOG_INPUT} type="password" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
          <div><label className={DIALOG_LABEL}>{{group_label}}</label>
            <select className={DIALOG_INPUT} value={form.roleId} onChange={e => setForm({ ...form, roleId: e.target.value })}>
              <option value="">{{no_group}}</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </AccessDialog>
      )}

      {dialog?.kind === 'edit' && (
        <AccessDialog title="{{edit_user}}" subtitle={dialog.user.email} icon={<UserCog className="w-5 h-5" />} busy={pending} onClose={close}
          footer={<><button className={BTN_GHOST} disabled={pending} onClick={close}>{{cancel}}</button><button className={BTN_PRIMARY} disabled={pending || !form.email.trim()} onClick={() => run(async () => {
            const u = dialog.user
            await updateUser(u.id, { email: form.email, name: form.name })
            if (form.roleId !== u.roleId) await setUserRole(u.id, form.roleId)
            close()
          })}>{{save}}</button></>}>
          {errorBox}
          {hasName && <div><label className={DIALOG_LABEL}>{{name_label}}</label><input className={DIALOG_INPUT} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>}
          <div><label className={DIALOG_LABEL}>{{email_label}}</label><input className={DIALOG_INPUT} type="email" autoFocus value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className={DIALOG_LABEL}>{{group_label}}</label>
            <select className={DIALOG_INPUT} value={form.roleId} onChange={e => setForm({ ...form, roleId: e.target.value })}>
              <option value="">{{no_group}}</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </AccessDialog>
      )}

      {dialog?.kind === 'password' && (
        <AccessDialog title="{{reset_password_title}}" subtitle={dialog.user.email} icon={<KeyRound className="w-5 h-5" />} busy={pending} onClose={close}
          footer={<><button className={BTN_GHOST} disabled={pending} onClick={close}>{{cancel}}</button><button className={BTN_PRIMARY} disabled={pending || !pw.next || !pw.again} onClick={() => run(async () => {
            if (pw.next !== pw.again) throw new Error('{{err_password_mismatch}}')
            await resetUserPassword(dialog.user.id, pw.next)
            close()
          })}>{{save}}</button></>}>
          {errorBox}
          <div><label className={DIALOG_LABEL}>{{new_password_label}}</label><input className={DIALOG_INPUT} type="password" autoFocus autoComplete="new-password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} /></div>
          <div><label className={DIALOG_LABEL}>{{confirm_password_label}}</label><input className={DIALOG_INPUT} type="password" autoComplete="new-password" value={pw.again} onChange={e => setPw({ ...pw, again: e.target.value })} /></div>
          <p className="text-xs text-neutral-500">{{password_effect}}</p>
        </AccessDialog>
      )}

      {dialog?.kind === 'delete' && (
        <AccessDialog title="{{delete_user_title}}" icon={<Trash2 className="w-5 h-5" />} tone="red" busy={pending} onClose={close}
          footer={<><button className={BTN_GHOST} disabled={pending} onClick={close}>{{cancel}}</button><button className={BTN_DANGER} disabled={pending} onClick={() => run(async () => { await deleteUser(dialog.user.id); close() })}>{{delete}}</button></>}>
          {errorBox}
          <p className="text-sm text-neutral-700 dark:text-neutral-300">{{confirm_delete_user}} <strong className="text-neutral-900 dark:text-white">{dialog.user.email}</strong>?</p>
          <p className="text-xs text-neutral-500">{{irreversible}}</p>
        </AccessDialog>
      )}
    </div>
  )
}
`

const GROUPS_CLIENT = `'use client'
import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Shield } from 'lucide-react'
import { listRoles, createRole, renameRole, deleteRole, type AccessRole } from '@/app/actions/access-admin'
import { AccessDialog, DIALOG_INPUT, DIALOG_LABEL, BTN_PRIMARY, BTN_DANGER, BTN_GHOST } from '@/components/AccessDialog'

type Dialog = null | { kind: 'create' } | { kind: 'rename'; role: AccessRole } | { kind: 'delete'; role: AccessRole }

export default function GroupsClient({ initialRoles, canWrite }: { initialRoles: AccessRole[]; canWrite: boolean }) {
  const [roles, setRoles] = useState(initialRoles)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [name, setName] = useState('')
  const run = (fn: () => Promise<void>) => start(async () => {
    setError('')
    try { await fn(); setRoles(await listRoles()) } catch (e: any) { setError(e?.message || '{{generic_error}}') }
  })
  const open = (d: Dialog, initial = '') => { setError(''); setName(initial); setDialog(d) }
  const close = () => { setError(''); setDialog(null) }
  const errorBox = error ? <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">{error}</div> : null

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">{{groups_title}}</h1>
          <p className="text-sm text-neutral-500">{{groups_subtitle}}</p>
        </div>
        {canWrite && (
          <button className={'${BTN} flex items-center gap-2'} disabled={pending} onClick={() => open({ kind: 'create' })}><Plus className="w-4 h-4" /> {{create_group}}</button>
        )}
      </div>
      {!dialog && error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">{error}</div>}
      <div className="${CARD} overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-neutral-800 text-[10px] font-black uppercase tracking-widest text-neutral-400">
              <th className="px-6 py-4">{{col_id}}</th><th className="px-6 py-4">{{col_group_name}}</th><th className="px-6 py-4 text-right">{{col_actions}}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {roles.map(r => (
              <tr key={r.id}>
                <td className="px-6 py-4 text-[11px] font-mono text-neutral-400">{r.id}</td>
                <td className="px-6 py-4 text-sm font-bold text-neutral-900 dark:text-white">{r.name}</td>
                <td className="px-6 py-4 text-right">
                  {canWrite && (
                    <div className="inline-flex gap-1">
                      <button title="{{rename}}" className="p-2 rounded-lg text-neutral-400 hover:text-indigo-600 hover:bg-indigo-500/10" onClick={() => open({ kind: 'rename', role: r }, r.name)}><Pencil className="w-4 h-4" /></button>
                      <button title="{{delete}}" className="p-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-500/10" onClick={() => open({ kind: 'delete', role: r })}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {roles.length === 0 && <tr><td colSpan={3} className="px-6 py-10 text-center text-sm text-neutral-500">{{no_groups}}</td></tr>}
          </tbody>
        </table>
      </div>

      {(dialog?.kind === 'create' || dialog?.kind === 'rename') && (
        <AccessDialog title={dialog.kind === 'create' ? '{{new_group_title}}' : '{{rename_group_title}}'} icon={<Shield className="w-5 h-5" />} busy={pending} onClose={close}
          footer={<><button className={BTN_GHOST} disabled={pending} onClick={close}>{{cancel}}</button><button className={BTN_PRIMARY} disabled={pending || !name.trim() || (dialog.kind === 'rename' && name.trim() === dialog.role.name)} onClick={() => run(async () => {
            if (dialog.kind === 'create') await createRole(name)
            else await renameRole(dialog.role.id, name)
            close()
          })}>{{save}}</button></>}>
          {errorBox}
          <div><label className={DIALOG_LABEL}>{{group_name_label}}</label><input className={DIALOG_INPUT} autoFocus value={name} onChange={e => setName(e.target.value)} /></div>
        </AccessDialog>
      )}

      {dialog?.kind === 'delete' && (
        <AccessDialog title="{{delete_group_title}}" icon={<Trash2 className="w-5 h-5" />} tone="red" busy={pending} onClose={close}
          footer={<><button className={BTN_GHOST} disabled={pending} onClick={close}>{{cancel}}</button><button className={BTN_DANGER} disabled={pending} onClick={() => run(async () => { await deleteRole(dialog.role.id); close() })}>{{delete}}</button></>}>
          {errorBox}
          <p className="text-sm text-neutral-700 dark:text-neutral-300">{{confirm_delete_group}} <strong className="text-neutral-900 dark:text-white">{dialog.role.name}</strong>? {{confirm_delete_group_note}}</p>
          <p className="text-xs text-neutral-500">{{irreversible}}</p>
        </AccessDialog>
      )}
    </div>
  )
}
`

const PERMS_CLIENT = `'use client'
import { useState, useTransition } from 'react'
import { loadMatrix, setPermission, type AccessMatrix } from '@/app/actions/access-admin'

type Level = 'none' | 'read' | 'write'
const OPTIONS: Array<{ id: Level; label: string; on: string }> = [
  { id: 'none', label: '{{level_none}}', on: 'bg-neutral-500 text-white' },
  { id: 'read', label: '{{level_read}}', on: 'bg-amber-500 text-white' },
  { id: 'write', label: '{{level_write}}', on: 'bg-indigo-600 text-white' },
]

export default function PermissionsClient({ initialMatrix, canWrite }: { initialMatrix: AccessMatrix; canWrite: boolean }) {
  const [matrix, setMatrix] = useState(initialMatrix)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  const levelOf = (roleId: string, slug: string, denyByDefault: boolean): Level => matrix.levels[roleId]?.[slug] ?? (denyByDefault ? 'none' : 'write')
  const change = (roleId: string, slug: string, level: Level) => start(async () => {
    setError('')
    try { await setPermission(roleId, slug, level); setMatrix(await loadMatrix()) } catch (e: any) { setError(e?.message || '{{generic_error}}') }
  })

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">{{perms_title}}</h1>
        <p className="text-sm text-neutral-500">{{perms_subtitle}}</p>
      </div>
      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">{error}</div>}
      <div className="${CARD} overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-neutral-800 text-[10px] font-black uppercase tracking-widest text-neutral-400">
              <th className="px-6 py-4 min-w-[200px]">{{col_screen}}</th>
              {matrix.roles.map(r => <th key={r.id} className="px-6 py-4 text-center min-w-[200px]">{r.name}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {matrix.views.map(v => (
              <tr key={v.slug}>
                <td className="px-6 py-4"><p className="text-sm font-bold text-neutral-900 dark:text-white">{v.title}</p><p className="text-[10px] text-neutral-500">/{v.slug}</p></td>
                {matrix.roles.map(r => {
                  const level = levelOf(r.id, v.slug, v.denyByDefault)
                  return (
                    <td key={r.id} className="px-6 py-4 text-center">
                      <div className="inline-flex rounded-full bg-neutral-100 dark:bg-neutral-800 p-0.5" role="radiogroup">
                        {OPTIONS.map(o => (
                          <button
                            key={o.id}
                            type="button"
                            role="radio"
                            aria-checked={level === o.id}
                            disabled={!canWrite || pending}
                            onClick={() => level !== o.id && change(r.id, v.slug, o.id)}
                            className={'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ' + (level === o.id ? o.on : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300')}
                          >{o.label}</button>
                        ))}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
`
