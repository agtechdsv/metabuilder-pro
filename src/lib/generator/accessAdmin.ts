import type { AccessAdminConfig, AppAST, DbType, FieldNode, ModelNode, NavigationItem, RouteNode } from './ast'
import { accessLevelOf, type AccessLevel } from '../viewAccess'
import { getAccessDictionary } from './accessI18n'

/**
 * Gestão de acesso no app exportado: monta a configuração (quem são os usuários, os grupos, como um se liga ao outro, onde ficam
 * as permissões) a partir do que o projeto tem no MetaBuilder, e declara as tabelas auxiliares que o app precisa
 * (permissões e, quando o projeto não usa os grupos do banco legado, grupos e vínculo usuário-grupo).
 */

export const ACCESS_SLUGS = {
  users: 'acesso-usuarios',
  groups: 'acesso-grupos',
  permissions: 'acesso-permissoes',
} as const

const ADMIN_NAME = /admin/i

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()
const bare = (t: unknown) => norm(t).split('.').pop() || ''

/** Tabelas auxiliares seguem a caixa do banco: o Oracle guarda nomes não citados em maiúsculas, os demais em minúsculas. */
const caseFor = (db: DbType, name: string) => (db === 'oracle' ? name.toUpperCase() : name.toLowerCase())

function syntheticModel(db: DbType, name: string, table: string, cols: Array<{ col: string; type: string; pk?: boolean }>): ModelNode {
  const fields: FieldNode[] = cols.map(c => ({
    id: `${table}.${c.col}`,
    name: c.col,
    dbColumn: caseFor(db, c.col),
    type: c.type === 'integer' ? 'number' : 'string',
    dataType: c.type,
    isPrimary: !!c.pk,
    isRequired: !!c.pk,
    isVisibleInList: true,
    isVisibleInForm: true,
    isSearchable: true,
    isSortable: true,
    config: {},
  }))
  return {
    id: `mb-access-${table}`,
    name,
    dbTable: caseFor(db, table),
    dbSchema: 'public',
    fields,
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    rowPolicy: null,
    audit: null,
  }
}

export interface AccessAdminBuild {
  config: AccessAdminConfig
  /** tabelas auxiliares a acrescentar aos modelos do app (geram ações e, no Java, entidades e controladores) */
  models: ModelNode[]
  /** pasta "Gestão de Acesso" a acrescentar ao menu */
  navigation: NavigationItem
}

export function buildAccessAdmin(args: {
  raw: any
  dbStack: DbType
  models: ModelNode[]
  routes: RouteNode[]
  rawViews: any[]
  authConfig: { tableName?: string; emailColumn?: string; passwordColumn?: string; hashFormat?: string } | undefined
  /** idioma de geração (pt, en, es) dos nomes das telas e do menu */
  lang?: string
}): AccessAdminBuild {
  const { raw, dbStack, models, routes, rawViews, authConfig } = args
  const tt = getAccessDictionary(args.lang)
  const ui = (raw?.ui || {}) as Record<string, any>
  const findModel = (table: unknown) => models.find(m => bare(m.dbTable) === bare(table) || norm(m.name) === norm(table))
  const pkOf = (m: ModelNode) => m.fields.find(f => f.isPrimary)?.dbColumn || 'id'
  const colOf = (m: ModelNode, wanted: unknown) => m.fields.find(f => norm(f.dbColumn) === norm(wanted))?.dbColumn || String(wanted || '')

  // Usuários: a tabela do login
  const usersModel = findModel(authConfig?.tableName)
  if (!usersModel) {
    throw new Error(`A gestão de acesso precisa da tabela de usuários (${authConfig?.tableName || 'não definida'}) entre as tabelas do projeto. Ative o login "Via Banco de Dados" apontando para uma tabela do projeto, ou desligue a gestão de acesso.`)
  }

  const synthetic: ModelNode[] = []

  // Grupos: os do banco legado (quando o projeto os sincroniza) ou uma tabela própria do app
  let groups: AccessAdminConfig['groups']
  const legacyGroups = ui.sync_legacy_groups === true && ui.db_groups_table ? findModel(ui.db_groups_table) : undefined
  if (legacyGroups) {
    groups = { model: legacyGroups.name, table: legacyGroups.dbTable, pk: pkOf(legacyGroups), nameCol: colOf(legacyGroups, ui.db_groups_name_column || 'name'), synthetic: false }
  } else {
    const m = syntheticModel(dbStack, 'MbRoles', 'mb_roles', [{ col: 'id', type: 'varchar', pk: true }, { col: 'name', type: 'varchar' }])
    synthetic.push(m)
    groups = { model: m.name, table: m.dbTable, pk: m.fields[0].dbColumn, nameCol: m.fields[1].dbColumn, synthetic: true }
  }

  // Vínculo usuário-grupo
  let link: AccessAdminConfig['link']
  if (legacyGroups && ui.db_user_groups_type !== 'n_to_n' && ui.db_user_role_column) {
    link = { kind: 'column', col: colOf(usersModel, ui.db_user_role_column) }
  } else if (legacyGroups && ui.db_user_groups_type === 'n_to_n' && findModel(ui.db_user_roles_table)) {
    const lm = findModel(ui.db_user_roles_table)!
    link = { kind: 'table', model: lm.name, table: lm.dbTable, pk: pkOf(lm), userCol: colOf(lm, ui.db_user_roles_user_id_column), roleCol: colOf(lm, ui.db_user_roles_role_id_column), synthetic: false }
  } else {
    const lm = syntheticModel(dbStack, 'MbUserRoles', 'mb_user_roles', [{ col: 'id', type: 'integer', pk: true }, { col: 'user_id', type: 'varchar' }, { col: 'role_id', type: 'varchar' }])
    synthetic.push(lm)
    link = { kind: 'table', model: lm.name, table: lm.dbTable, pk: lm.fields[0].dbColumn, userCol: lm.fields[1].dbColumn, roleCol: lm.fields[2].dbColumn, synthetic: true }
  }

  // Permissões por tela (sempre numa tabela do app: no MetaBuilder elas ficam no Supabase, que o app exportado não acessa)
  const pm = syntheticModel(dbStack, 'MbRolePermissions', 'mb_role_permissions', [
    { col: 'id', type: 'integer', pk: true },
    { col: 'role_id', type: 'varchar' },
    { col: 'view_slug', type: 'varchar' },
    { col: 'access_level', type: 'varchar' },
  ])
  synthetic.push(pm)

  // Telas controladas por permissão
  const views: AccessAdminConfig['views'] = [
    ...routes.filter(r => r.path && r.viewSlug).map(r => ({ slug: r.viewSlug, title: r.title, path: r.path, table: r.modelTable || null })),
    { slug: ACCESS_SLUGS.users, title: tt.users_title, path: `/${ACCESS_SLUGS.users}`, table: null, denyByDefault: true },
    { slug: ACCESS_SLUGS.groups, title: tt.groups_title, path: `/${ACCESS_SLUGS.groups}`, table: null, denyByDefault: true },
    { slug: ACCESS_SLUGS.permissions, title: tt.perms_title, path: `/${ACCESS_SLUGS.permissions}`, table: null, denyByDefault: true },
  ]

  // Dados atuais do MetaBuilder para o script SQL
  const rawRoles: Array<{ id: string; name: string }> = (Array.isArray(raw?.roles) ? raw.roles : []).map((r: any) => ({ id: String(r.id), name: String(r.name ?? '') }))
  const slugOfView = new Map<string, string>(rawViews.map((v: any) => [String(v.id), String(v.slug)]))
  const permissions: AccessAdminConfig['seed']['permissions'] = []
  for (const p of Array.isArray(raw?.permissions) ? raw.permissions : []) {
    const slug = slugOfView.get(String(p.view_id))
    if (!slug) continue
    const v = views.find(x => x.slug === slug)
    if (!v) continue
    const level: AccessLevel = accessLevelOf(p, { defaultDeny: slug === 'automations' })
    if (level === 'write') continue // é o padrão das telas normais: sem linha
    permissions.push({ roleId: String(p.role_id), viewSlug: slug, level })
  }
  // As telas de gestão de acesso nascem fechadas: libera para os grupos de administração (ou para todos, se nenhum tiver "admin" no nome)
  const admins = rawRoles.filter(r => ADMIN_NAME.test(r.name))
  const grantees = admins.length > 0 ? admins : rawRoles
  for (const r of grantees) for (const slug of Object.values(ACCESS_SLUGS)) permissions.push({ roleId: r.id, viewSlug: slug, level: 'write' })

  const userRoles = link.kind === 'table' && link.synthetic
    ? (Array.isArray(raw?.userRoles) ? raw.userRoles : []).map((u: any) => ({ userId: String(u.external_user_id), roleId: String(u.role_id) }))
    : []

  const config: AccessAdminConfig = {
    usersModel: usersModel.name,
    usersTable: usersModel.dbTable,
    usersPk: pkOf(usersModel),
    emailCol: colOf(usersModel, authConfig?.emailColumn || 'email'),
    passCol: colOf(usersModel, authConfig?.passwordColumn || 'hash_senha'),
    nameCol: ui.db_display_name_column ? colOf(usersModel, ui.db_display_name_column) : undefined,
    hash: String(authConfig?.hashFormat || 'bcrypt').toLowerCase(),
    groups,
    link,
    perms: { model: pm.name, table: pm.dbTable, pk: pm.fields[0].dbColumn, roleCol: pm.fields[1].dbColumn, viewCol: pm.fields[2].dbColumn, levelCol: pm.fields[3].dbColumn },
    views,
    seed: { roles: groups.synthetic ? rawRoles : [], permissions, userRoles },
  }

  const navigation: NavigationItem = {
    id: 'acesso',
    label: tt.menu_folder,
    icon: 'ShieldCheck',
    type: 'folder',
    children: [
      { id: ACCESS_SLUGS.users, label: tt.users_title, icon: 'Users', type: 'view', target: ACCESS_SLUGS.users },
      { id: ACCESS_SLUGS.groups, label: tt.groups_title, icon: 'Shield', type: 'view', target: ACCESS_SLUGS.groups },
      { id: ACCESS_SLUGS.permissions, label: tt.perms_title, icon: 'KeyRound', type: 'view', target: ACCESS_SLUGS.permissions },
    ],
  }

  return { config, models: synthetic, navigation }
}

// ─────────────────────────────────────────────────────────────────────────────
// Script SQL das tabelas de acesso (criação + dados atuais do MetaBuilder)
// ─────────────────────────────────────────────────────────────────────────────

const q = (v: string) => `'${String(v).replace(/'/g, "''")}'`

export function accessSql(ast: AppAST): string {
  const a = ast.accessAdmin
  if (!a) return ''
  const db = ast.dbStack
  const out: string[] = [
    `-- ARQUIVO GERADO pelo MetaBuilder — tabelas de acesso do app (permissões de telas${a.groups.synthetic ? ', grupos e vínculo usuário-grupo' : ''}).`,
    `-- Rode este script UMA vez no banco do app antes de subir a aplicação (${db}).`,
    '',
  ]
  const idCol = (name: string) =>
    db === 'oracle' ? `${name} NUMBER GENERATED BY DEFAULT ON NULL AS IDENTITY PRIMARY KEY`
    : db === 'mysql' ? `${name} INT AUTO_INCREMENT PRIMARY KEY`
    : db === 'sqlserver' ? `${name} INT IDENTITY(1,1) PRIMARY KEY`
    : `${name} SERIAL PRIMARY KEY`
  const text = (n: number) => (db === 'oracle' ? `VARCHAR2(${n})` : `VARCHAR(${n})`)
  const create = (table: string, body: string) =>
    db === 'sqlserver' ? `IF OBJECT_ID('${table}', 'U') IS NULL\nCREATE TABLE ${table} (\n${body}\n);`
    : db === 'oracle' ? `CREATE TABLE ${table} (\n${body}\n);`
    : `CREATE TABLE IF NOT EXISTS ${table} (\n${body}\n);`

  const P = a.perms
  out.push(create(P.table, `  ${idCol(P.pk)},\n  ${P.roleCol} ${text(64)} NOT NULL,\n  ${P.viewCol} ${text(200)} NOT NULL,\n  ${P.levelCol} ${text(10)} NOT NULL`))
  if (a.groups.synthetic) out.push(create(a.groups.table, `  ${a.groups.pk} ${text(64)} PRIMARY KEY,\n  ${a.groups.nameCol} ${text(200)} NOT NULL`))
  if (a.link.kind === 'table' && a.link.synthetic) {
    out.push(create(a.link.table, `  ${idCol(a.link.pk)},\n  ${a.link.userCol} ${text(128)} NOT NULL,\n  ${a.link.roleCol} ${text(64)} NOT NULL`))
  }
  out.push('')

  if (a.seed.roles.length) {
    out.push('-- grupos atuais do projeto')
    for (const r of a.seed.roles) out.push(`INSERT INTO ${a.groups.table} (${a.groups.pk}, ${a.groups.nameCol}) VALUES (${q(r.id)}, ${q(r.name)});`)
    out.push('')
  }
  if (a.seed.permissions.length) {
    out.push('-- permissões atuais (telas sem linha = escrita; as telas de gestão de acesso só entram com linha)')
    for (const p of a.seed.permissions) out.push(`INSERT INTO ${P.table} (${P.roleCol}, ${P.viewCol}, ${P.levelCol}) VALUES (${q(p.roleId)}, ${q(p.viewSlug)}, ${q(p.level)});`)
    out.push('')
  }
  if (a.link.kind === 'table' && a.link.synthetic && a.seed.userRoles.length) {
    out.push('-- grupo de cada usuário')
    for (const u of a.seed.userRoles) out.push(`INSERT INTO ${a.link.table} (${a.link.userCol}, ${a.link.roleCol}) VALUES (${q(u.userId)}, ${q(u.roleId)});`)
    out.push('')
  }
  if (db === 'oracle') out.push('COMMIT;')
  return out.join('\n') + '\n'
}
