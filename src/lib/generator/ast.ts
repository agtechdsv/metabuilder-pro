/**
 * ast.ts
 *
 * Define a Árvore de Sintaxe Abstrata (AST) para o CleanCodeGenerator.
 * Esta estrutura converte o formato MetaBuilder (JSON relacional)
 * em uma representação agnóstica de código, focada em Next.js (App Router).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core Types
// ─────────────────────────────────────────────────────────────────────────────

export type DbType = 'postgres' | 'supabase' | 'oracle' | 'mysql' | 'sqlserver'

export interface FieldNode {
  name: string
  dbColumn: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'uuid' | 'json' | 'relation'
  isPrimary: boolean
  isRequired: boolean
  relation?: {
    targetModel: string
    foreignKey: string
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AST Nodes
// ─────────────────────────────────────────────────────────────────────────────

export interface ModelNode {
  id: string
  name: string // ex: 'Usuarios'
  dbTable: string // ex: 'users'
  dbSchema: string // ex: 'public'
  fields: FieldNode[]
}

export interface UIComponentNode {
  type: 'text' | 'number' | 'select' | 'date' | 'boolean' | 'relation'
  field: string
  label: string
  isVisible: boolean
  config?: any
}

export interface RouteNode {
  path: string // ex: '/usuarios'
  type: 'list' | 'detail' | 'form'
  modelId: string
  title: string
  layout: 'list' | 'card' | 'grid'
  layoutConfig?: any // JSON raw from ui_views.layout_config
  components: UIComponentNode[]
  actions: string[] // IDs de ActionNodes associados
  relations: {
    modelId: string
    type: '1:N' | 'N:1' | 'N:N'
    displayMode: 'inline' | 'tab' | 'modal'
    sourceColumn: string
    targetColumn: string
  }[]
}

export interface ActionNode {
  id: string
  name: string // ex: 'CreateUser'
  modelId: string
  type: 'insert' | 'update' | 'delete' | 'custom'
  params: string[]
  body?: string // Código customizado (se houver)
}

export interface AuthConfig {
  authType: string // 'legacy_db' | 'managed' | 'ldap' | 'none'
  tableName?: string
  emailColumn?: string
  passwordColumn?: string
  hashFormat?: string // 'bcrypt' | 'md5' | 'plain'
}

export interface AppAST {
  projectName: string
  projectSlug: string // ex: 'crm' — usado como sub-rota no workspace
  dbStack: DbType
  dbConnectionString?: string
  supabaseUrl?: string
  supabaseAnonKey?: string
  authConfig?: AuthConfig
  models: ModelNode[]
  routes: RouteNode[]
  actions: ActionNode[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace AST (multi-projeto)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Representa um projeto dentro de um export de Workspace.
 * Cada projeto vira uma sub-rota do app Next.js gerado.
 */
export interface WorkspaceProjectNode {
  slug: string        // ex: 'crm'  → acessado em /{workspace}/{crm}
  name: string        // ex: 'CRM Completo'
  description?: string
  app: AppAST         // AST completa do projeto
}

/**
 * AST raiz de um export de Workspace.
 * Gera um único projeto Next.js com portal de entrada + N projetos como sub-rotas.
 *
 * @v2 authScope: 'per-project' | 'workspace'
 *   Futuramente o dev poderá escolher se o login será compartilhado
 *   em nível de workspace ou individual por projeto.
 */
export interface WorkspaceAST {
  workspaceName: string   // ex: 'AGTech Projetos'
  workspaceSlug: string   // ex: 'agtechtrade'
  dbStack: DbType
  dbConnectionString?: string
  supabaseUrl?: string
  supabaseAnonKey?: string
  projects: WorkspaceProjectNode[]
}
