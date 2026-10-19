import type { AppAST, ResolvedField, RouteNode, RelationTab } from '../generator/ast'
import { MANIFEST_VERSION, type ManifestAuth, type ManifestDetail, type ManifestField, type ManifestView, type TestManifest } from './manifestTypes'

export * from './manifestTypes'

/**
 * Manifesto de testes: tudo o que o dev configurou em cada caso de uso (campos de cada zona, máscaras, obrigatórios, botões, abas...), no formato
 * que o motor de testes consome. Sai do mesmo AST que a exportação usa (lib/generator/projectSource → loadProjectAst), então descreve exatamente o que
 * o app exportado deve ter. Os testes são gerados a partir dele: um caso de uso novo ou alterado no Studio muda o manifesto, e os testes o acompanham.
 */

const pick = (c: any, ...keys: string[]) => { for (const k of keys) if (c?.[k] !== undefined && c?.[k] !== null && c?.[k] !== '') return c[k]; return undefined }

export function manifestField(f: ResolvedField): ManifestField {
  const c: any = f.config || {}
  const mask = pick(c, 'mask') ?? pick(c.content, 'mask')
  const options = Array.isArray(c.options) && c.options.length > 0
    ? c.options.map((o: any) => ({ value: String(o.value ?? o), label: String(o.label ?? o.value ?? o) }))
    : undefined
  return {
    column: f.dbColumn,
    label: f.label,
    dataType: f.dataType,
    ...(pick(c.component, 'type') ? { componentType: String(c.component.type) } : {}),
    ...(typeof mask === 'string' && mask ? { mask } : {}),
    required: Boolean(c.required || f.notNull),
    readOnly: Boolean(c.readOnly || c.readonly || c.content?.readOnly || c.content?.readonly),
    isPrimaryKey: Boolean(f.isPrimaryKey),
    hasFormula: Array.isArray(c.formulaTokens) ? c.formulaTokens.length > 0 : Array.isArray(c.formula_tokens) ? c.formula_tokens.length > 0 : false,
    ...(options ? { options } : {}),
  }
}

const detail = (t: RelationTab): ManifestDetail => ({
  table: t.relatedTable,
  label: t.label,
  foreignKey: t.foreignKey,
  displayMode: t.displayMode,
  fields: (t.formFields?.length ? t.formFields : t.gridFields).map(manifestField),
  subDetails: (t.subDetails || []).map((s: any) => ({
    table: String(s.relatedTable ?? ''),
    label: String(s.label ?? s.relatedModelName ?? ''),
    foreignKey: String(s.foreignKey ?? ''),
    fields: ((s.formFields?.length ? s.formFields : s.gridFields) || []).map(manifestField),
  })),
})

export function manifestView(r: RouteNode): ManifestView {
  const raw: any = r.rawLayoutConfig || {}
  return {
    slug: r.viewSlug,
    path: r.path,
    title: r.title,
    logicType: String(r.logicType),
    table: r.modelTable,
    primaryKey: r.primaryKey,
    displayType: r.displayType,
    actionInterface: r.actionInterfaceType || raw.action_interface_type || 'page',
    filter: r.filterFields.map(manifestField),
    grid: r.gridFields.map(manifestField),
    form: r.formFields.map(manifestField),
    buttons: (r.buttons || []).map(b => ({ id: b.id, label: b.label, actionType: b.actionType, ...(b.placement ? { placement: b.placement } : {}) })),
    exportFormats: Array.isArray(raw.export_formats) ? raw.export_formats.map(String) : [],
    details: (r.relationTabs || []).map(detail),
  }
}

/** Manifesto de um projeto (ou só dos casos de uso pedidos, pelo slug). Telas do sistema (login, downloads, gestão de acesso) não entram. */
/** Configuração de login do projeto (a mesma que o gerador usa), no formato do manifesto. */
export function manifestAuth(ast: AppAST): ManifestAuth {
  const c = ast.authConfig
  const a = ast.accessAdmin
  const type = c?.authType || 'none'
  if (a) {
    return {
      type, usersTable: a.usersTable, usersPk: a.usersPk, emailColumn: a.emailCol, passwordColumn: a.passCol, nameColumn: a.nameCol, hash: a.hash,
      access: {
        groupsTable: a.groups.table, groupsPk: a.groups.pk, groupsNameColumn: a.groups.nameCol,
        link: a.link.kind === 'column' ? { kind: 'column', column: a.link.col } : { kind: 'table', table: a.link.table, userColumn: a.link.userCol, roleColumn: a.link.roleCol },
        permsTable: a.perms.table,
      },
    }
  }
  return { type, usersTable: c?.tableName, emailColumn: c?.emailColumn, passwordColumn: c?.passwordColumn, hash: (c?.hashFormat || 'bcrypt').toLowerCase() }
}

export function buildTestManifest(ast: AppAST, opts: { viewSlugs?: string[]; now?: Date } = {}): TestManifest {
  const only = opts.viewSlugs && opts.viewSlugs.length > 0 ? new Set(opts.viewSlugs) : null
  return {
    version: MANIFEST_VERSION,
    generatedAt: (opts.now ?? new Date()).toISOString(),
    project: { id: ast.projectId ?? '', name: ast.projectName ?? '', slug: ast.projectSlug ?? '' },
    dbStack: ast.dbStack,
    auth: manifestAuth(ast),
    views: ast.routes.filter(r => !only || only.has(r.viewSlug)).map(manifestView),
  }
}
