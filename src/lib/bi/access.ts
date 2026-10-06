/**
 * Acesso por linha (RLS) do painel de BI.
 *
 * O desenvolvedor cadastra regras do tipo "só mostre as linhas em que PEDIDOS.VENDEDOR_ID = valor do usuário logado".
 * Cada regra vira uma condição comum do widget (o planejador cuida de JOINs, tipos e escape), então vale para o
 * indicador, o drill, "ver registros" e o filtro cruzado sem código especial.
 *
 * Falha fechada: sem usuário, sem o atributo que a regra pede ou numa tabela sem relação com a coluna da regra, o
 * widget NÃO mostra dados (nunca cai em "mostrar tudo").
 */
import type { BiWidgetCondition } from './widget'

export type RlsSource = 'user.email' | 'user.name' | 'user.attr'

export interface RlsBypass {
  source: RlsSource
  /** coluna da tabela de usuários (quando source = 'user.attr') */
  attr?: string
  /** quem tiver um destes valores não sofre a regra (ex.: perfil "admin") */
  values: string[]
}

export interface RlsRule {
  id: string
  /** coluna que limita as linhas ("tabela.coluna") */
  field: string
  /** 'eq' = igual ao valor do usuário; 'in' = o valor do usuário é uma lista separada por vírgulas */
  op: 'eq' | 'in'
  source: RlsSource
  attr?: string
  bypass?: RlsBypass
}

/** Quem está vendo o painel (vem da sessão; nunca do navegador no app exportado). */
export interface BiViewer {
  email?: string | null
  name?: string | null
  attrs?: Record<string, unknown> | null
}

export type AccessDenied =
  | { code: 'no_viewer' }
  | { code: 'missing_value'; detail: string }

export interface AccessResult {
  conditions: BiWidgetCondition[]
  denied?: AccessDenied
}

const SOURCES: RlsSource[] = ['user.email', 'user.name', 'user.attr']
const MAX_RULES = 20
const MAX_BYPASS_VALUES = 50

const text = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Valor do usuário para uma fonte; null quando não existe ou está vazio. */
export function viewerValue(viewer: BiViewer | null | undefined, source: RlsSource, attr?: string): string | null {
  if (!viewer) return null
  let raw: unknown
  if (source === 'user.email') raw = viewer.email
  else if (source === 'user.name') raw = viewer.name
  else if (attr && viewer.attrs) {
    const key = Object.keys(viewer.attrs).find(k => k.toLowerCase() === attr.toLowerCase())
    raw = key ? viewer.attrs[key] : undefined
  }
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  return s === '' ? null : s
}

/** Limpa as regras vindas de uma configuração salva (descarta o que está incompleto). */
export function cleanRlsRules(raw: unknown): RlsRule[] {
  if (!Array.isArray(raw)) return []
  const out: RlsRule[] = []
  for (const r of raw.slice(0, MAX_RULES)) {
    if (!r || typeof r !== 'object') continue
    const field = text((r as any).field)
    const source = (r as any).source as RlsSource
    if (!field || !SOURCES.includes(source)) continue
    const attr = text((r as any).attr)
    if (source === 'user.attr' && !attr) continue
    const rule: RlsRule = {
      id: text((r as any).id, 60) || `rls_${out.length + 1}`,
      field,
      op: (r as any).op === 'in' ? 'in' : 'eq',
      source,
      ...(source === 'user.attr' ? { attr } : {}),
    }
    const b = (r as any).bypass
    if (b && typeof b === 'object' && SOURCES.includes(b.source) && Array.isArray(b.values)) {
      const values = b.values.map((v: unknown) => text(v)).filter(Boolean).slice(0, MAX_BYPASS_VALUES)
      const bAttr = text(b.attr)
      if (values.length > 0 && (b.source !== 'user.attr' || bAttr)) {
        rule.bypass = { source: b.source, ...(b.source === 'user.attr' ? { attr: bAttr } : {}), values }
      }
    }
    out.push(rule)
  }
  return out
}

/** O usuário está na lista de exceção da regra? (compara sem diferenciar maiúsculas) */
function bypassed(rule: RlsRule, viewer: BiViewer | null | undefined): boolean {
  if (!rule.bypass) return false
  const v = viewerValue(viewer, rule.bypass.source, rule.bypass.attr)
  return v !== null && rule.bypass.values.some(x => x.toLowerCase() === v.toLowerCase())
}

/** Condições que as regras impõem a este usuário (ou o motivo de negar o acesso). */
export function rlsAccess(rules: RlsRule[] | undefined, viewer: BiViewer | null | undefined): AccessResult {
  const list = rules || []
  if (list.length === 0) return { conditions: [] }
  const conditions: BiWidgetCondition[] = []
  for (const rule of list) {
    // quem tem exceção na regra não sofre o filtro dela (e não precisa de atributo nenhum)
    if (bypassed(rule, viewer)) continue
    if (!viewer) return { conditions: [], denied: { code: 'no_viewer' } }
    const value = viewerValue(viewer, rule.source, rule.attr)
    if (value === null) {
      return { conditions: [], denied: { code: 'missing_value', detail: rule.source === 'user.attr' ? rule.attr || '' : rule.source.replace('user.', '') } }
    }
    conditions.push({ field: rule.field, op: rule.op, value })
  }
  return { conditions }
}

/** Soma as condições do acesso às do widget. */
export function withAccess<W extends { conditions?: BiWidgetCondition[] }>(widget: W, access: AccessResult): W {
  return access.conditions.length ? { ...widget, conditions: [...(widget.conditions || []), ...access.conditions] } : widget
}

/** Colunas da tabela de usuários que as regras consultam (o login as guarda na sessão). */
export function rlsAttrColumns(rules: RlsRule[] | undefined): string[] {
  const cols = new Set<string>()
  for (const r of rules || []) {
    if (r.source === 'user.attr' && r.attr) cols.add(r.attr)
    if (r.bypass?.source === 'user.attr' && r.bypass.attr) cols.add(r.bypass.attr)
  }
  return [...cols]
}
