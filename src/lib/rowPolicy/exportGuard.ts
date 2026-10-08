import type { AccessContext } from '@/lib/tunnel/tableAccess'

/**
 * Exportação de dados pelo usuário final: o servidor monta o SQL a partir de nomes que vieram do navegador (tabela,
 * colunas, junções, tabelas do grafo). Para usuário final, tudo isso é conferido antes: só tabelas do projeto, só colunas
 * no formato que a tela gera (nunca uma expressão), e nada da tabela de login que seja senha ou token.
 */
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/
/** `coluna`, `tabela.coluna AS "tabela.coluna"` ou `NULL AS "campo_virtual"`: o que ExportControls gera. */
const COLUMN_FORMS = /^(?:NULL AS "[A-Za-z0-9_.]+"|([A-Za-z_][A-Za-z0-9_]*)(?:\.([A-Za-z_][A-Za-z0-9_]*))?(?: AS "[A-Za-z0-9_.]+")?)$/
const SENSITIVE_COLUMN = /(senha|password|passwd|pwd|hash|secret|totp|mfa|token)/i
const MAX_COLUMNS = 300

const clean = (v: unknown) => String(v ?? '').replace(/[^a-zA-Z0-9_]/g, '')

export function exportProblem(
  body: { modelName?: unknown; columnsList?: unknown; joins?: unknown; exportGraph?: unknown; dictionary?: unknown; projectRelations?: unknown },
  ctx: AccessContext,
): string | null {
  const auth = ctx.authTable ? ctx.authTable.toLowerCase() : undefined
  const allowed = (t: string) => ctx.allowedTables.has(t.toLowerCase())
  const allowedJoin = (t: string) => allowed(t) || t.toLowerCase() === auth

  const model = String(body.modelName ?? '')
  if (!IDENT.test(model) || !allowed(model) || model.toLowerCase() === auth) return `tabela não permitida: ${clean(model)}`

  if (!Array.isArray(body.columnsList) || body.columnsList.length === 0 || body.columnsList.length > MAX_COLUMNS) return 'lista de colunas inválida'
  for (const c of body.columnsList) {
    const m = typeof c === 'string' ? c.match(COLUMN_FORMS) : null
    if (!m) return 'coluna fora do formato permitido'
    const table = m[2] ? m[1] : undefined
    const column = m[2] ?? m[1]
    if (table && !allowedJoin(table)) return `tabela não permitida: ${table}`
    const fromAuth = (table ? table.toLowerCase() : model.toLowerCase()) === auth
    if (column && fromAuth && SENSITIVE_COLUMN.test(column)) return `coluna não permitida: ${column}`
  }

  if (body.joins !== undefined && !Array.isArray(body.joins)) return 'junções inválidas'
  for (const j of (body.joins as any[]) || []) {
    for (const t of [j?.table ?? j?.from, j?.toTable ?? j?.to]) {
      if (t !== undefined && !allowedJoin(clean(t))) return `tabela não permitida: ${clean(t)}`
    }
  }

  // grafo (detalhes aninhados): o Agente lê "SELECT * FROM <tabela do dicionário>", então cada uma precisa ser do projeto
  if (body.exportGraph) {
    const dict = body.dictionary && typeof body.dictionary === 'object' ? Object.values(body.dictionary as Record<string, unknown>) : []
    for (const t of dict) if (!IDENT.test(String(t)) || !allowed(String(t)) || String(t).toLowerCase() === auth) return `tabela não permitida: ${clean(t)}`
    for (const r of (Array.isArray(body.projectRelations) ? body.projectRelations : []) as any[]) {
      if (r?.foreign_key !== undefined && !IDENT.test(String(r.foreign_key))) return 'relação inválida'
    }
  }
  return null
}
