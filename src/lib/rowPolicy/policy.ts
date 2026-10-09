/**
 * Acesso a dados do usuário final por TABELA (permissões de criar/editar/excluir e acesso por linha).
 *
 * O desenvolvedor configura em Dados & Schemas, em cada tabela. O servidor resolve a política para quem está logado
 * (sessão assinada), e o resultado (`access`) vai dentro do comando assinado ao Agente CLI, que a aplica no SQL
 * (cli/sqlPolicy.js). Este arquivo é puro: lê a configuração salva, limpa e resolve para um usuário.
 *
 * Sem regra numa tabela, todos veem todas as linhas dela (como antes): a política é opcional e por tabela.
 */
import { viewerValue, type BiViewer, type RlsBypass, type RlsSource } from '../bi/access'
import type { AuditColumns, EffectiveAudit } from './audit'

export type PolicyOp = 'eq' | 'in' | 'related'

export interface RowPolicyRule {
  id: string
  /** coluna DESTA tabela que limita as linhas */
  column: string
  /** 'eq' = igual ao valor do usuário; 'in' = o valor do usuário é uma lista separada por vírgulas;
   *  'related' = a coluna aponta para uma linha de outra tabela cuja coluna `related.column` é igual ao valor do usuário */
  op: PolicyOp
  source: RlsSource
  attr?: string
  related?: { table: string; key: string; column: string }
  /** quem tiver um destes valores não sofre a regra (ex.: perfil "admin") */
  bypass?: RlsBypass
}

export interface RowPolicy { rules: RowPolicyRule[] }

/** O que vai dentro do comando assinado (formato lido por cli/sqlPolicy.js). */
export interface AccessCond { column: string; op: PolicyOp; values: string[]; related?: { table: string; key: string; column: string } }
export interface AccessPolicy { table: string; deny?: true; conds: AccessCond[] }
export interface AccessFlags { create?: boolean; update?: boolean; delete?: boolean }
/** Auditoria de uma tabela: as colunas e o valor do usuário que vai nas colunas `*_por` (null = sem o dado: ficam vazias). */
export type AccessAudit = AuditColumns & { actor?: string | null }
export interface AccessPayload { policies: AccessPolicy[]; flags: Record<string, AccessFlags>; audit?: Record<string, AccessAudit> }

/** O que a configuração salva de cada tabela do projeto contém. */
export interface TableAccessConfig {
  table: string
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  policy: RowPolicy | null
  /** auditoria da tabela (já resolvida: configurada ou reconhecida pelo nome); null = sem auditoria */
  audit?: EffectiveAudit | null
  /** projeto em modo "bloquear por padrão" e esta tabela NÃO foi liberada: o usuário final não acessa nada dela */
  closed?: boolean
}

/** Modo do projeto para tabelas sem liberação explícita (guardado em project_auth_config.ui_config.table_access). */
export interface TableAccessMode { closed: boolean; open: string[] }

/** Limpa o que veio do banco/da tela. Sem nada salvo, o projeto segue como sempre foi: tabelas abertas. */
export function cleanTableAccessMode(raw: unknown): TableAccessMode {
  const r = raw && typeof raw === 'object' ? (raw as any) : {}
  const open = Array.isArray(r.open) ? r.open.map((t: unknown) => text(t, 100).toLowerCase()).filter((t: string) => IDENT.test(t)).slice(0, 500) : []
  return { closed: r.closed === true, open: [...new Set<string>(open)] }
}

/** A tabela está fechada para o usuário final neste modo? */
export const isTableClosed = (mode: TableAccessMode | null | undefined, table: string): boolean =>
  !!mode?.closed && !mode.open.includes(String(table).split('.').pop()!.toLowerCase())

const SOURCES: RlsSource[] = ['user.email', 'user.name', 'user.attr']
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/
const MAX_RULES = 10
const MAX_BYPASS_VALUES = 50
const MAX_LIST_VALUES = 100

const text = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const ident = (v: unknown): string => { const s = text(v, 100); return IDENT.test(s) ? s : '' }

/** Limpa a política vinda do banco/da tela (descarta o que está incompleto ou com nome inválido). */
export function cleanRowPolicy(raw: unknown): RowPolicy | null {
  const list = raw && typeof raw === 'object' ? (raw as any).rules : null
  if (!Array.isArray(list)) return null
  const rules: RowPolicyRule[] = []
  for (const r of list.slice(0, MAX_RULES)) {
    if (!r || typeof r !== 'object') continue
    const column = ident((r as any).column)
    const source = (r as any).source as RlsSource
    if (!column || !SOURCES.includes(source)) continue
    const attr = text((r as any).attr)
    if (source === 'user.attr' && !attr) continue
    const op: PolicyOp = (r as any).op === 'in' ? 'in' : (r as any).op === 'related' ? 'related' : 'eq'
    const rule: RowPolicyRule = { id: text((r as any).id, 60) || `rp_${rules.length + 1}`, column, op, source, ...(source === 'user.attr' ? { attr } : {}) }
    if (op === 'related') {
      const rel = (r as any).related
      const table = ident(rel?.table), key = ident(rel?.key), col = ident(rel?.column)
      if (!table || !key || !col) continue
      rule.related = { table, key, column: col }
    }
    const b = (r as any).bypass
    if (b && typeof b === 'object' && SOURCES.includes(b.source) && Array.isArray(b.values)) {
      const values = b.values.map((v: unknown) => text(v)).filter(Boolean).slice(0, MAX_BYPASS_VALUES)
      const bAttr = text(b.attr)
      if (values.length > 0 && (b.source !== 'user.attr' || bAttr)) rule.bypass = { source: b.source, ...(b.source === 'user.attr' ? { attr: bAttr } : {}), values }
    }
    rules.push(rule)
  }
  return rules.length ? { rules } : null
}

const bypassed = (rule: RowPolicyRule, viewer: BiViewer | null): boolean => {
  if (!rule.bypass) return false
  const v = viewerValue(viewer, rule.bypass.source, rule.bypass.attr)
  return v !== null && rule.bypass.values.some(x => x.toLowerCase() === v.toLowerCase())
}

/**
 * Resolve as tabelas do projeto para UM usuário: quais restrições valem para ele.
 * Falha fechada: sem usuário, ou sem o dado que a regra exige, a tabela fica negada (nenhuma linha).
 * Só entram no resultado as tabelas que têm algo a impor (o resto não precisa ir no comando).
 */
export function resolveAccess(configs: TableAccessConfig[], viewer: BiViewer | null): AccessPayload {
  const policies: AccessPolicy[] = []
  const flags: Record<string, AccessFlags> = {}
  const audit: Record<string, AccessAudit> = {}

  for (const c of configs) {
    const table = c.table.toLowerCase()
    if (c.audit) {
      const actor = viewerValue(viewer, c.audit.by.source, c.audit.by.attr)
      audit[table] = { ...c.audit.columns, actor }
    }
    // "bloquear por padrão": tabela não liberada fica negada por inteiro (nenhuma linha, nenhuma gravação), seja qual for a regra
    if (c.closed) { policies.push({ table, deny: true, conds: [] }); continue }
    if (!c.canCreate || !c.canUpdate || !c.canDelete) {
      flags[table] = {
        ...(c.canCreate ? {} : { create: false }),
        ...(c.canUpdate ? {} : { update: false }),
        ...(c.canDelete ? {} : { delete: false }),
      }
    }
    if (!c.policy || c.policy.rules.length === 0) continue

    const conds: AccessCond[] = []
    let denied = false
    for (const rule of c.policy.rules) {
      if (bypassed(rule, viewer)) continue
      const value = viewerValue(viewer, rule.source, rule.attr)
      if (value === null) { denied = true; break }
      let values = [value]
      if (rule.op === 'in') {
        values = value.split(',').map(v => v.trim()).filter(Boolean).slice(0, MAX_LIST_VALUES)
        if (values.length === 0) { denied = true; break }
      }
      conds.push({ column: rule.column, op: rule.op, values, ...(rule.op === 'related' ? { related: rule.related } : {}) })
    }
    if (denied) policies.push({ table, deny: true, conds: [] })
    else if (conds.length > 0) policies.push({ table, conds })
  }
  return { policies, flags, ...(Object.keys(audit).length ? { audit } : {}) }
}
