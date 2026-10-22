import { ACCESS_SLUGS } from '../generator/accessAdmin'
import { getAccessDictionary, type AccessDictionary } from '../generator/accessI18n'
import type { AppAST, ModelNode, ResolvedField, RouteNode, RelationTab } from '../generator/ast'
import { MANIFEST_VERSION, type ManifestAuth, type ManifestDetail, type ManifestField, type ManifestView, type TestManifest } from './manifestTypes'

export * from './manifestTypes'

/**
 * Manifesto de testes: tudo o que o dev configurou em cada caso de uso (campos de cada zona, máscaras, obrigatórios, botões, abas...), no formato
 * que o motor de testes consome. Sai do mesmo AST que a exportação usa (lib/generator/projectSource → loadProjectAst), então descreve exatamente o que
 * o app exportado deve ter. Os testes são gerados a partir dele: um caso de uso novo ou alterado no Studio muda o manifesto, e os testes o acompanham.
 */

/** Campo Autocomplete do Studio: a mesma leitura que o gerador faz (tabela, colunas, mínimo de caracteres, texto de busca). */
function manifestAutocomplete(f: ResolvedField): ManifestField['autocomplete'] {
  if (f.isPrimaryKey) return undefined
  const c: any = f.config || {}
  const comp = c.form_config?.component || c.component || {}
  const tipo = String(comp.type || c.type || '').toLowerCase()
  if (!['autocomplete', 'autocomplete (busca dinâmica)', 'autocomplete (busca dinamica)'].includes(tipo)) return undefined
  const rel = c.relation || {}
  const tabela = String(comp.rel_table || rel.targetTable || c.rel_table || (String(f.dbColumn || '').endsWith('_id') ? String(f.dbColumn).slice(0, -3) + 's' : ''))
  const label = String(comp.rel_label || rel.displayColumn || c.rel_label || '')
  if (!tabela || !label) return undefined
  return {
    table: tabela.split('.').pop() || '', labelColumn: label, valueColumn: String(comp.rel_value || rel.valueColumn || c.rel_value || 'id'),
    minChars: Number(comp.min_chars ?? 2) || 2, ...(comp.search_placeholder ? { placeholder: String(comp.search_placeholder) } : {}),
  }
}

const pick = (c: any, ...keys: string[]) => { for (const k of keys) if (c?.[k] !== undefined && c?.[k] !== null && c?.[k] !== '') return c[k]; return undefined }

export function manifestField(f: ResolvedField): ManifestField {
  const c: any = f.config || {}
  const mask = pick(c, 'mask') ?? pick(c.content, 'mask')
  const options = Array.isArray(c.options) && c.options.length > 0
    ? c.options.map((o: any) => ({ value: String(o.value ?? o), label: String(o.label ?? o.value ?? o) }))
    : undefined
  const bruto = c.formulaTokens ?? c.formula_tokens ?? c.content?.formula_tokens
  const tokens = (Array.isArray(bruto) ? bruto : []).filter((t: any) => t && typeof t.type === 'string').map((t: any) => ({ type: t.type, value: String(t.value ?? ''), ...(t.label ? { label: String(t.label) } : {}) }))
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
    ...(tokens.length > 0 ? { formula: tokens } : {}),
    ...(options ? { options } : {}),
    ...(c.relation?.targetTable && c.relation?.displayColumn ? { relation: { table: String(c.relation.targetTable).split('.').pop() || '', valueColumn: String(c.relation.valueColumn || 'id'), displayColumn: String(c.relation.displayColumn) } } : {}),
    ...(manifestAutocomplete(f) ? { autocomplete: manifestAutocomplete(f) } : {}),
  }
}

const detail = (t: RelationTab): ManifestDetail => ({
  table: t.relatedTable,
  ...(((t.gridFields || []).concat(t.formFields || [])).find(f => f.isPrimaryKey) ? { primaryKey: ((t.gridFields || []).concat(t.formFields || [])).find(f => f.isPrimaryKey)!.dbColumn } : {}),
  label: t.label,
  foreignKey: t.foreignKey,
  displayMode: t.displayMode,
  fields: (t.formFields?.length ? t.formFields : t.gridFields).map(manifestField),
  subDetails: (t.subDetails || []).map((s: any) => ({
    table: String(s.relatedTable ?? ''),
    ...((((s.formFields?.length ? s.formFields : s.gridFields) || []).find((f: any) => f.isPrimaryKey)) ? { primaryKey: String((((s.formFields?.length ? s.formFields : s.gridFields) || []).find((f: any) => f.isPrimaryKey)).dbColumn) } : {}),
    label: String(s.label ?? s.relatedModelName ?? ''),
    foreignKey: String(s.foreignKey ?? ''),
    fields: ((s.formFields?.length ? s.formFields : s.gridFields) || []).map(manifestField),
  })),
})

export function manifestView(r: RouteNode, model?: ModelNode): ManifestView {
  const raw: any = r.rawLayoutConfig || {}
  return {
    slug: r.viewSlug,
    path: r.path,
    title: r.title,
    logicType: String(r.logicType),
    table: r.modelTable,
    primaryKey: r.primaryKey,
    ...(r.logicType === 'blueprint' ? { blueprintPredecessorColumn: r.blueprintConfig?.predecessorField || 'predecessor_id' } : {}),
    ...(r.logicType === 'kanban' ? { kanbanGroupColumn: r.kanbanGroupField || 'status' } : {}),
    displayType: r.displayType,
    actionInterface: r.actionInterfaceType || raw.action_interface_type || 'page',
    tablePerms: { create: model?.canCreate !== false, update: model?.canUpdate !== false, delete: model?.canDelete !== false },
    ...(model?.rowPolicy?.rules?.length ? { rowPolicy: model.rowPolicy.rules.map(rule => ({
      column: rule.column, op: rule.op, source: rule.source, ...(rule.attr ? { attr: rule.attr } : {}), ...(rule.related ? { related: { table: rule.related.table, key: rule.related.key, column: rule.related.column } } : {}),
      ...(rule.bypass ? { bypass: { source: String(rule.bypass.source), ...(rule.bypass.attr ? { attr: rule.bypass.attr } : {}), values: rule.bypass.values.map(String) } } : {}),
    })) } : {}),
    filter: r.filterFields.map(manifestField),
    grid: r.gridFields.map(manifestField),
    form: r.formFields.map(manifestField),
    buttons: (r.buttons || []).map(b => ({ id: b.id, label: b.label, actionType: b.actionType, ...(b.placement ? { placement: b.placement } : {}) })),
    exportFormats: Array.isArray(raw.export_formats) ? raw.export_formats.map(String) : [],
    details: (r.relationTabs || []).map(detail),
  }
}

/** Manifesto de um projeto (ou só dos casos de uso pedidos, pelo slug). Telas do sistema (login, downloads, gestão de acesso) não entram. */
const LABEL_KEYS: Array<keyof AccessDictionary> = [
  'users_title', 'groups_title', 'perms_title', 'create_user', 'create_group', 'save', 'reset_password', 'delete', 'rename', 'name_optional',
  'level_none', 'level_read', 'level_write', 'col_email', 'col_group',
]
/** Os textos das telas de gestão de acesso nos três idiomas de geração (sem repetir): o idioma do app exportado não precisa ser conhecido. */
function accessLabels(): Record<string, string[]> {
  const dicts = ['pt', 'en', 'es'].map(l => getAccessDictionary(l))
  return Object.fromEntries(LABEL_KEYS.map(k => [k, [...new Set(dicts.map(d => String(d[k])))]]))
}

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
        permsTable: a.perms.table, permsRoleColumn: a.perms.roleCol, permsViewColumn: a.perms.viewCol, permsLevelColumn: a.perms.levelCol,
        screens: {
          users: { slug: ACCESS_SLUGS.users, path: `/${ACCESS_SLUGS.users}` },
          groups: { slug: ACCESS_SLUGS.groups, path: `/${ACCESS_SLUGS.groups}` },
          permissions: { slug: ACCESS_SLUGS.permissions, path: `/${ACCESS_SLUGS.permissions}` },
        },
        labels: accessLabels(),
      },
    }
  }
  return { type, usersTable: c?.tableName, emailColumn: c?.emailColumn, passwordColumn: c?.passwordColumn, hash: (c?.hashFormat || 'bcrypt').toLowerCase() }
}

/** Slug do caso de uso sintético da gestão de acesso (não existe no Studio: o app exportado o ganha quando a opção está ligada). */
export const GESTAO_ACESSO_SLUG = '__gestao_acesso'

function gestaoDeAcesso(): ManifestView {
  return {
    slug: GESTAO_ACESSO_SLUG, path: `/${ACCESS_SLUGS.users}`, title: 'Gestão de acesso', logicType: 'gestao_acesso', table: '', primaryKey: 'id', displayType: 'list',
    actionInterface: 'page', filter: [], grid: [], form: [], buttons: [], exportFormats: [], details: [],
  }
}

export function buildTestManifest(ast: AppAST, opts: { viewSlugs?: string[]; now?: Date } = {}): TestManifest {
  const only = opts.viewSlugs && opts.viewSlugs.length > 0 ? new Set(opts.viewSlugs) : null
  return {
    version: MANIFEST_VERSION,
    generatedAt: (opts.now ?? new Date()).toISOString(),
    project: { id: ast.projectId ?? '', name: ast.projectName ?? '', slug: ast.projectSlug ?? '' },
    dbStack: ast.dbStack,
    auth: manifestAuth(ast),
    views: [
      ...ast.routes.filter(r => !only || only.has(r.viewSlug)).map(r => manifestView(r, ast.models.find(m => String(m.dbTable).split('.').pop() === String(r.modelTable).split('.').pop()))),
      ...(ast.accessAdmin && (!only || only.has(GESTAO_ACESSO_SLUG)) ? [gestaoDeAcesso()] : []),
    ],
  }
}
