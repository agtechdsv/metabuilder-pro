import type { SupabaseClient } from '@supabase/supabase-js'
import { parseMetaBuilderJSON, type ParseOptions } from './parser'
import { generateNativeProject } from './emitter'
import type { BackendStack, DbType, JavaVersion } from './ast'
import { loadAccessAdminInput } from './accessAdminData'

/**
 * Motor único de geração do código fonte de UM projeto (usado pela IDE Local, pelo Ejetar e por qualquer rota que entregue o código):
 * carrega o projeto, aplica as opções (banco, login, gestão de acesso, backend, Java, idioma) e devolve o mapa de arquivos.
 * As rotas só decidem o formato da resposta (ZIP ou JSON).
 */

export interface ProjectSourceInput {
  projectId: string
  // banco
  dbStack?: DbType
  dbConnectionString?: string
  supabaseUrl?: string
  supabaseAnonKey?: string
  // login: sem valor, vale o que o projeto tem configurado
  authStrategy?: 'none' | 'legacy' | 'ldap' | 'managed' | string
  /** mapeamento escolhido na exportação para o login via banco (tabela, colunas e hash) */
  authConfig?: { legacy?: { usersTable?: string; emailColumn?: string; passwordColumn?: string; passwordHash?: string } } | null
  accessAdmin?: boolean
  // backend
  backendStack?: BackendStack | string
  javaVersion?: JavaVersion | number
  javaGroupId?: string
  javaArtifactId?: string
  javaPort?: number
  jwtEnabled?: boolean
  passwordHashAlgorithm?: string
  generateMigrations?: boolean
  migrationEngine?: string
  generateServiceTests?: boolean
  generateControllerTests?: boolean
  generateDockerfile?: boolean
  generateDockerCompose?: boolean
  generateEnvExample?: boolean
  generateOpenApi?: boolean
  generateReadme?: boolean
  targetLanguage?: 'pt' | 'en' | 'es' | string
}

export class ProjectSourceError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

const HASHES: Record<string, string> = { bcrypt: 'bcrypt', md5: 'md5', sha256: 'sha256', plain: 'plain', plaintext: 'plain' }

/** Nome do banco como a IDE e a modal escrevem → o que o gerador entende. */
export function normalizeDbStack(v: unknown): DbType | undefined {
  const s = String(v ?? '').toLowerCase()
  const m = s === 'postgresql' ? 'postgres' : s === 'mssql' ? 'sqlserver' : s === 'oracledb' ? 'oracle' : s
  return (['postgres', 'supabase', 'oracle', 'mysql', 'sqlserver'] as string[]).includes(m) ? (m as DbType) : undefined
}

const lang = (v: unknown): 'pt' | 'en' | 'es' | undefined => (v === 'pt' || v === 'en' || v === 'es' ? v : undefined)

export async function buildProjectSource(
  supabase: Pick<SupabaseClient, 'from'>,
  input: ProjectSourceInput,
): Promise<{ files: Map<string, string>; project: any }> {
  const { projectId } = input
  if (!projectId) throw new ProjectSourceError('ID do projeto obrigatório', 400)

  const { data: project, error: projError } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (projError || !project) throw new ProjectSourceError('Projeto não encontrado', 404)

  const [{ data: models }, { data: views }, { data: relations }, { data: authConfig }, { data: enumerations }] = await Promise.all([
    supabase.from('models').select('*, fields(*)').eq('project_id', projectId),
    supabase.from('ui_views').select('*, ui_components(*)').eq('project_id', projectId).eq('status', 'published'),
    supabase.from('relations').select('*').eq('project_id', projectId),
    supabase.from('project_auth_config').select('*').eq('project_id', projectId).maybeSingle(),
    supabase.from('project_enumerations').select('*').eq('project_id', projectId),
  ])

  // Sem telas publicadas, usa todas
  let finalViews: any[] | null = views
  if (!finalViews || finalViews.length === 0) {
    const { data: allViews } = await supabase.from('ui_views').select('*, ui_components(*)').eq('project_id', projectId)
    finalViews = allViews
  }
  const components = (finalViews || []).flatMap((v: any) => v.ui_components || [])

  // Login: o do projeto, ou o escolhido na exportação
  let authRaw: any = authConfig
    ? {
        auth_type: (authConfig as any).auth_type,
        table_name: (authConfig as any).db_table_name,
        email_column: (authConfig as any).db_email_column,
        password_column: (authConfig as any).db_password_column,
        hash_format: (authConfig as any).db_password_hash_type,
        table_access: (authConfig as any).ui_config?.table_access,
      }
    : undefined
  const strategy = String(input.authStrategy ?? '').toLowerCase()
  if (strategy === 'none') {
    authRaw = { ...(authRaw || {}), auth_type: 'none' }
  } else if (strategy === 'ldap') {
    authRaw = { ...(authRaw || {}), auth_type: 'ldap' }
  } else if (strategy === 'legacy') {
    const l = input.authConfig?.legacy
    authRaw = {
      ...(authRaw || {}),
      auth_type: 'database',
      ...(l?.usersTable ? { table_name: l.usersTable } : {}),
      ...(l?.emailColumn ? { email_column: l.emailColumn } : {}),
      ...(l?.passwordColumn ? { password_column: l.passwordColumn } : {}),
      ...(l?.passwordHash ? { hash_format: HASHES[String(l.passwordHash).toLowerCase()] || 'bcrypt' } : {}),
    }
  }

  const rawJson: any = {
    project,
    models: models || [],
    fields: (models || []).flatMap((m: any) => m.fields || []),
    views: finalViews || [],
    components,
    relations: relations || [],
    enumerations: enumerations || [],
    auth_config: authRaw,
  }

  // Gestão de acesso: leva os grupos, as permissões por tela e o grupo de cada usuário (o app exportado não acessa o Supabase do MetaBuilder)
  if (input.accessAdmin === true) {
    const access = await loadAccessAdminInput(supabase, projectId, authConfig as any)
    if (!access || rawJson.auth_config?.auth_type !== 'database') {
      throw new ProjectSourceError('A gestão de acesso só está disponível com o login "Via Banco de Dados Legado".', 400)
    }
    rawJson.access_admin = access
  }

  // sem banco escolhido, vale o do próprio projeto (Oracle, MySQL...) em vez de assumir PostgreSQL
  const dbStack = normalizeDbStack(input.dbStack) || normalizeDbStack((project as any).db_type) || 'postgres'
  const ast = parseMetaBuilderJSON(rawJson, dbStack, {
    ...toParseOptions(input),
    supabaseUrl: input.supabaseUrl || project.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: input.supabaseAnonKey || project.supabase_anon_key || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  return { files: generateNativeProject(ast), project }
}

/** Opções de geração (backend, Java, idioma) no formato do parser: a mesma conversão para projeto e para workspace. */
export function toParseOptions(input: Partial<ProjectSourceInput>): ParseOptions {
  const port = Number.isInteger(input.javaPort) && (input.javaPort as number) >= 1 && (input.javaPort as number) <= 65535 ? (input.javaPort as number) : 8080
  return {
    dbConnectionString: input.dbConnectionString,
    supabaseUrl: input.supabaseUrl,
    supabaseAnonKey: input.supabaseAnonKey,
    backendStack: (input.backendStack === 'java-spring' ? 'java-spring' : 'nodejs') as BackendStack,
    javaVersion: (input.javaVersion === 17 ? 17 : 21) as JavaVersion,
    javaGroupId: input.javaGroupId,
    javaArtifactId: input.javaArtifactId,
    javaPort: port,
    jwtEnabled: Boolean(input.jwtEnabled),
    passwordHashAlgorithm: input.passwordHashAlgorithm === 'sha256' ? 'sha256' : 'bcrypt',
    generateMigrations: Boolean(input.generateMigrations),
    migrationEngine: input.migrationEngine === 'liquibase' ? 'liquibase' : 'flyway',
    generateServiceTests: Boolean(input.generateServiceTests),
    generateControllerTests: Boolean(input.generateControllerTests),
    generateDockerfile: Boolean(input.generateDockerfile),
    generateDockerCompose: Boolean(input.generateDockerCompose),
    generateEnvExample: Boolean(input.generateEnvExample),
    generateOpenApi: input.generateOpenApi !== false,
    generateReadme: input.generateReadme !== false,
    targetLanguage: lang(input.targetLanguage),
  }
}
