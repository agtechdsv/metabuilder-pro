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
  components: UIComponentNode[]
  actions: string[] // IDs de ActionNodes associados
  relations: {
    modelId: string
    type: '1:N' | 'N:1' | 'N:N'
    displayMode: 'inline' | 'tab' | 'modal'
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

export interface AppAST {
  projectName: string
  dbStack: DbType
  dbConnectionString?: string
  supabaseUrl?: string
  supabaseAnonKey?: string
  models: ModelNode[]
  routes: RouteNode[]
  actions: ActionNode[]
}
