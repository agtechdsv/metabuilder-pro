import type { AppAST, DbType } from '../ast'
import { ACCESS_RUNTIME_FILES } from '../biRuntimeFiles.generated'
import { isTableClosed, type RowPolicy, type TableAccessConfig } from '../../rowPolicy/policy'
import { auditAttrColumn } from '../../rowPolicy/audit'

// ─────────────────────────────────────────────────────────────────────────────
// Acesso a dados por tabela no app exportado (permissões de criar/editar/excluir e regras por linha do usuário final).
//
// No MetaBuilder quem aplica isso é o Agente CLI; o app exportado fala direto com o banco, então aplica aqui, no servidor,
// com os MESMOS módulos (lib/rowPolicy/*, o mesmo sqlPolicy.js do Agente). O usuário vem da sessão assinada (mb_session),
// nunca do navegador. Sem política numa tabela, todos veem todas as linhas (como antes).
//
// Regras por linha precisam reescrever o SQL entre aspas duplas ("tabela"): valem para PostgreSQL e Oracle. Para os outros
// bancos (e para o backend Java) o app NÃO pode ser exportado com política, em vez de sair sem ela: falha fechada.
// ─────────────────────────────────────────────────────────────────────────────

/** Bancos em que a regra por linha pode ser aplicada no SQL do app exportado. */
const ROW_POLICY_STACKS: DbType[] = ['postgres', 'oracle']

/** Bancos em que o app Node fala SQL direto (os que passam pelas actions de banco). */
export function hasSqlActions(ast: AppAST): boolean {
  return ast.backendStack !== 'java-spring' && ast.dbStack !== 'supabase'
}

// tabelas que o app precisa proteger no SQL: com regra por linha, ou fechadas pelo modo "bloquear por padrão"
const policyTables = (ast: AppAST) => ast.models.filter(m => (m.rowPolicy && m.rowPolicy.rules.length > 0) || isTableClosed(ast.authConfig?.tableAccess, m.dbTable)).map(m => m.dbTable)

/**
 * Recusa exportar um app cujas tabelas têm regra por linha num banco/backend em que ela não seria aplicada (o app sairia
 * sem a proteção que o desenvolvedor configurou).
 */
export function assertPolicySupported(ast: AppAST): void {
  const tables = policyTables(ast)
  if (tables.length === 0) return
  // o login do app exportado lê a tabela de usuários ANTES de existir sessão: com regra por linha nela, ninguém entraria
  // (fechá-la pelo modo "bloquear por padrão" não impede o login: ele não passa por essas funções)
  const authTable = (ast.authConfig?.tableName || '').split('.').pop()?.toLowerCase()
  const ruleTables = ast.models.filter(m => m.rowPolicy && m.rowPolicy.rules.length > 0).map(m => m.dbTable)
  if (authTable && ruleTables.some(t => t.split('.').pop()?.toLowerCase() === authTable)) {
    throw new Error(`A tabela de login (${authTable}) tem regra de acesso por linha, o que impediria o login no app exportado (ele lê essa tabela antes de existir sessão). Remova a regra dessa tabela para exportar.`)
  }
  if (ast.backendStack === 'java-spring') {
    throw new Error(`Acesso por linha ou bloqueio por padrão (tabelas: ${tables.join(', ')}) ainda não é aplicado no backend Java Spring. Remova a regra/o bloqueio ou exporte o app Node.js (PostgreSQL ou Oracle).`)
  }
  if (!ROW_POLICY_STACKS.includes(ast.dbStack)) {
    throw new Error(`Acesso por linha ou bloqueio por padrão (tabelas: ${tables.join(', ')}) só é aplicado no app exportado com PostgreSQL ou Oracle; o banco escolhido é ${ast.dbStack}. Remova a regra/o bloqueio ou exporte com PostgreSQL/Oracle.`)
  }
}

/** Colunas do cadastro do usuário que as regras pedem (o login as grava na sessão assinada). */
export function policyAttrColumns(policy: RowPolicy | null | undefined): string[] {
  const cols = new Set<string>()
  for (const r of policy?.rules || []) {
    if (r.source === 'user.attr' && r.attr) cols.add(r.attr)
    if (r.bypass?.source === 'user.attr' && r.bypass.attr) cols.add(r.bypass.attr)
  }
  return [...cols]
}

export function modelPolicyAttrColumns(ast: AppAST): string[] {
  // também a coluna do cadastro que a auditoria grava em criado_por/atualizado_por (normalmente o id do usuário)
  return ast.models.flatMap(m => [...policyAttrColumns(m.rowPolicy), ...(m.audit && auditAttrColumn(m.audit.by) ? [auditAttrColumn(m.audit.by) as string] : [])])
}

/** Configuração embutida no app: uma entrada por tabela (a fonte da verdade vem do projeto, sem credenciais). */
export function tableAccessConfigs(ast: AppAST): TableAccessConfig[] {
  return ast.models.map(m => ({
    table: m.dbTable,
    canCreate: m.canCreate !== false,
    canUpdate: m.canUpdate !== false,
    canDelete: m.canDelete !== false,
    policy: m.rowPolicy && m.rowPolicy.rules.length > 0 ? m.rowPolicy : null,
    audit: m.audit ?? null,
    closed: isTableClosed(ast.authConfig?.tableAccess, m.dbTable),
  }))
}

const ACCESS_SOURCE = `// ARQUIVO GERADO pelo MetaBuilder — acesso a dados por tabela (permissões e regras por linha do usuário final).
// Usa o usuário da sessão assinada (mb_session): nada que o navegador mande decide acesso.
import { getSessionUser } from '@/lib/session-server'
import { resolveAccess, type AccessPayload } from '@/lib/rowPolicy/policy'
import { applyToSelect, guardCustom, enforceWrite, flagAllowed } from '@/lib/rowPolicy/sqlPolicy'
import { TABLE_ACCESS, ACCESS_DB } from './access-registry'

const MESSAGES = {
  create: 'Esta tabela não permite criar registros.',
  update: 'Esta tabela não permite editar registros.',
  delete: 'Esta tabela não permite excluir registros.',
} as const

/** Permissões e regras por linha que valem para quem está logado (sem sessão: tabelas com regra ficam negadas). */
export async function currentAccess(): Promise<AccessPayload> {
  const u = await getSessionUser()
  return resolveAccess(TABLE_ACCESS, u ? { email: u.email, name: u.name ?? null, attrs: u.attrs ?? {} } : null)
}

/** Aplica as regras por linha das tabelas citadas num SELECT (cada tabela com regra vira uma subconsulta filtrada). */
export async function secureSelect(sql: string): Promise<string> {
  return applyToSelect(sql, await currentAccess(), { dbType: ACCESS_DB })
}

/** SQL de dados livre (UPDATE/DELETE/SELECT): confere as permissões das tabelas e aplica as regras por linha no WHERE. */
export async function secureCustom(sql: string): Promise<string> {
  return guardCustom(sql, await currentAccess(), { dbType: ACCESS_DB })
}

/** A tabela permite esta operação? (as caixas de "Permitir criação/edição/exclusão" de Dados & Schemas) */
export async function assertCan(table: string, kind: 'create' | 'update' | 'delete'): Promise<void> {
  if (!flagAllowed(await currentAccess(), table, kind)) throw new Error(MESSAGES[kind])
}

/**
 * Gravação estruturada de usuário final: confere a permissão da tabela, os valores gravados e as linhas atingidas.
 * Devolve os dados a gravar (no insert, completa a coluna da regra quando faltou).
 */
export async function secureWrite(args: {
  action: 'insert' | 'update' | 'delete'
  table: string
  data?: Record<string, any>
  idColumn?: string
  idValue?: any
  /** executa um SELECT e devolve as linhas */
  query: (sql: string) => Promise<any[]>
  /** false = não confere as linhas atingidas (quem chama garante pelo WHERE, ex.: secureCustom) */
  checkRows?: boolean
}): Promise<Record<string, any> | undefined> {
  return enforceWrite({ access: await currentAccess(), dbType: ACCESS_DB, ...args })
}
`

/** Gera as peças do acesso a dados por tabela (módulos compartilhados, configuração e a ponte com a sessão). */
export function generateAccessLayer(ast: AppAST, files: Map<string, string>) {
  assertPolicySupported(ast)
  if (!hasSqlActions(ast)) return

  for (const [path, content] of Object.entries(ACCESS_RUNTIME_FILES)) files.set(path, content)

  files.set('app/actions/access-registry.ts', `// ARQUIVO GERADO pelo MetaBuilder — permissões e regras por linha de cada tabela (sem credenciais).
import type { TableAccessConfig } from '@/lib/rowPolicy/policy'

export const ACCESS_DB = ${JSON.stringify(ast.dbStack)}
export const TABLE_ACCESS: TableAccessConfig[] = ${JSON.stringify(tableAccessConfigs(ast), null, 2)}
`)
  files.set('app/actions/access.ts', ACCESS_SOURCE)
}
