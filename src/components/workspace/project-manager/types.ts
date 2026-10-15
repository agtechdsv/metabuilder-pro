export interface Project {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  is_active: boolean
  sync_status?: string | null
  workspace_id: string
  models?: { count: number }[]
  can_create?: boolean
  can_edit?: boolean
  can_deactivate?: boolean
  can_delete?: boolean
  theme_config?: any
}

/** O que o projeto já tem configurado: o modal de exportação abre com isso marcado (o usuário ainda pode trocar). */
export interface ExportDefaults {
  dataMode?: 'tunnel' | 'supabase' | 'postgres' | 'oracle' | 'mysql' | 'sqlserver'
  authStrategy?: 'managed' | 'legacy' | 'ldap' | 'none'
  legacyDriver?: 'supabase' | 'postgres'
  authTable?: string
  authEmailColumn?: string
  authPasswordColumn?: string
  authHash?: string
  /** vindos da tela Ejetar & Sincronizar (a modal de ejetar abre com o que o dev já escolheu lá) */
  backendStack?: 'nodejs' | 'java-spring'
  javaGroupId?: string
  javaPort?: number
  javaOptions?: { jwt: boolean; migrations: boolean; tests: boolean; docker: boolean; env: boolean; swagger: boolean; readme: boolean }
  accessAdmin?: boolean
  /** conexão do projeto no metabuilder.config.json local (só no desktop) */
  dbConnection?: { user: string; password: string; host: string; port: string; database: string }
}

export interface DownloadModalState {
  open: boolean
  /** 'processing' = gravando os arquivos e instalando as dependências (a modal fica travada até acabar) */
  phase: 'selecting' | 'downloading' | 'processing' | 'done' | 'error'
  fileName: string
  progress: number
  savedPath: string
  savedDir: string
  projectId?: string
  authConfig?: any
  defaults?: ExportDefaults
  /** as tabelas de acesso já existiam no banco: quantas permissões havia (mantidas sem alteração) */
  accessTablesExisted?: number
  /** exportou a gestão de acesso e as tabelas de acesso ainda não foram criadas no banco */
  accessSetupNote?: boolean
  /** o que está sendo feito na fase 'processing' */
  statusMessage?: string
  /** motivo da falha, mostrado no próprio modal na fase 'error' */
  errorMessage?: string
}
