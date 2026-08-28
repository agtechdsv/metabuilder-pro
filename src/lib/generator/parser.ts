import { AppAST, DbType, WorkspaceAST, WorkspaceProjectNode, ModelNode, RouteNode, ActionNode, FieldNode, UIComponentNode } from './ast'

/**
 * parser.ts
 *
 * Converte o JSON exportado do MetaBuilder para a AST do CleanCodeGenerator.
 */

export function parseMetaBuilderJSON(
  rawJson: any, 
  dbStack: DbType, 
  options?: { dbConnectionString?: string, supabaseUrl?: string, supabaseAnonKey?: string }
): AppAST {
  const toPascalCase = (str: string) => {
    return (str || '')
      .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase())
      .replace(/^[a-z]/, (m) => m.toUpperCase())
  }

  const models: ModelNode[] = []
  const routes: RouteNode[] = []
  const actions: ActionNode[] = []

  const rawModels = rawJson.models || []
  const rawViews = rawJson.views || rawJson.ui_views || []
  const rawFields = rawJson.fields || []
  const rawComponents = rawJson.components || rawJson.ui_components || []

  // 1. Build Models & Fields
  for (const rm of rawModels) {
    const mFields = rawFields.filter((f: any) => f.model_id === rm.id)
    
    const fields: FieldNode[] = mFields.map((f: any) => ({
      name: f.name || f.db_column_name,
      dbColumn: f.db_column_name,
      type: mapFieldType(f.data_type),
      isPrimary: f.is_primary_key || false,
      isRequired: f.is_required || false,
      relation: f.is_foreign_key ? {
        targetModel: f.foreign_key_target_model,
        foreignKey: f.foreign_key_column
      } : undefined
    }))

    models.push({
      id: rm.id,
      name: toPascalCase(rm.db_table_name),
      dbTable: rm.db_table_name,
      dbSchema: rm.db_schema_name || 'public',
      fields
    })
  }

  // 2. Build Routes from Views
  for (const rv of rawViews) {
    const vComps = rawComponents.filter((c: any) => c.view_id === rv.id)
    const rawRelations = rawJson.relations || []
    const viewRelations = rawRelations.filter((r: any) => r.source_model_id === rv.model_id)

    const components: UIComponentNode[] = vComps.map((c: any) => {
      const fieldDef = rawFields.find((f: any) => f.id === c.field_id)
      return {
        type: c.component_type || 'text',
        field: fieldDef ? fieldDef.db_column_name : c.field_id,
        label: c.label || c.name || fieldDef?.display_name || 'Campo',
        isVisible: c.is_visible !== false,
        config: c.config || {}
      }
    })

    routes.push({
      path: `/${rv.slug || rv.name.toLowerCase()}`,
      type: rv.layout_config?.default_view === 'card' ? 'detail' : 'list',
      modelId: rv.model_id,
      title: rv.name,
      layout: rv.layout_config?.default_view || 'list',
      layoutConfig: rv.layout_config,
      components,
      actions: [],
      relations: viewRelations.map((r: any) => ({
        modelId: r.target_model_id,
        type: r.relation_type,
        displayMode: r.display_mode || 'tab',
        sourceColumn: r.source_column || 'id',
        targetColumn: r.target_column
      }))
    })
  }

  // 3. Build Standard Actions for Models (CRUD)
  // O compilador sempre vai gerar as server actions base (Create, Update, Delete) para cada Model,
  // mesmo que não haja uma 'customAction' explícita no json.
  for (const m of models) {
    actions.push({ id: `create_${m.id}`, name: `create${m.name}`, modelId: m.id, type: 'insert', params: ['data'] })
    actions.push({ id: `update_${m.id}`, name: `update${m.name}`, modelId: m.id, type: 'update', params: ['id', 'data'] })
    actions.push({ id: `delete_${m.id}`, name: `delete${m.name}`, modelId: m.id, type: 'delete', params: ['id'] })
  }

  const authConfigNode = rawJson.auth_config ? {
    authType: rawJson.auth_config.auth_type ?? 'database',
    tableName: rawJson.auth_config.table_name || 'usuarios',
    emailColumn: rawJson.auth_config.email_column || 'email',
    passwordColumn: rawJson.auth_config.password_column || 'hash_senha',
    hashFormat: rawJson.auth_config.hash_format || 'bcrypt'
  } : undefined

  return {
    projectName: rawJson.project?.name || rawJson.name || 'MetabuilderExport',
    projectSlug: rawJson.project?.slug || rawJson.slug || 'app',
    dbStack,
    dbConnectionString: options?.dbConnectionString,
    supabaseUrl: options?.supabaseUrl,
    supabaseAnonKey: options?.supabaseAnonKey,
    authConfig: authConfigNode,
    models,
    routes,
    actions
  }
}

/**
 * parseWorkspaceJSON
 *
 * Monta uma WorkspaceAST completa a partir de um workspace e N projetos.
 * Cada projeto é convertido individualmente via parseMetaBuilderJSON.
 *
 * @param rawWorkspace  Linha da tabela `workspaces` do MetaBuilder
 * @param rawProjects   Array de projetos com seus modelos, views e campos já incluídos
 * @param dbStack       Banco de dados alvo
 * @param options       Credenciais de conexão
 */
export function parseWorkspaceJSON(
  rawWorkspace: any,
  rawProjects: any[],
  dbStack: DbType,
  options?: { dbConnectionString?: string; supabaseUrl?: string; supabaseAnonKey?: string }
): WorkspaceAST {
  const projects: WorkspaceProjectNode[] = rawProjects.map(p => ({
    slug: p.slug || p.id,
    name: p.display_name || p.name || p.slug,
    description: p.description || '',
    app: parseMetaBuilderJSON(p, dbStack, options)
  }))

  return {
    workspaceName: rawWorkspace.name || rawWorkspace.slug,
    workspaceSlug: rawWorkspace.slug,
    dbStack,
    dbConnectionString: options?.dbConnectionString,
    supabaseUrl: options?.supabaseUrl,
    supabaseAnonKey: options?.supabaseAnonKey,
    projects
  }
}

function mapFieldType(dbType: string): FieldNode['type'] {
  const t = (dbType || '').toLowerCase()
  if (t.includes('int') || t.includes('numeric') || t.includes('float')) return 'number'
  if (t.includes('bool')) return 'boolean'
  if (t.includes('date') || t.includes('time')) return 'date'
  if (t.includes('uuid')) return 'uuid'
  if (t.includes('json')) return 'json'
  return 'string'
}
