/**
 * Campos calculados (virtuais) dos casos de uso para a ação "Consultar dados" do BPM.
 *
 * No caso de uso, um campo virtual guarda a fórmula em tokens (`content.formula_tokens`): ex.: "Total Item" = quantidade × preco_unitario
 * (da tabela de itens) e "Total Pedido" = SOMA(Total Item). O motor do CLI não interpreta fórmula livre: o Studio COMPILA o campo para
 * uma especificação pequena e validada (QueryVirtualField), guardada no nó, e o motor a transforma em subconsulta SQL.
 *
 * Suportado: aritmética (+ - * / e parênteses) sobre colunas e números; uma agregação (SOMA, MÉDIA, MÁXIMO, MÍNIMO, CONTAR) sobre colunas da
 * tabela FILHA ligada à tabela principal por uma relação do caso de uso (joins); referência a outro campo virtual (expandido).
 * Não suportado (o campo simplesmente não é oferecido): SE, ARREDONDAR, ABS e outras funções, mais de uma tabela filha na mesma fórmula,
 * relação que não consta nos joins.
 */

export type VToken = { t: 'col' | 'op' | 'num'; v: string }

export interface QueryVirtualField {
  key: string
  label: string
  /** agregação sobre a tabela filha; null = fórmula linha a linha da própria tabela principal */
  fn: 'sum' | 'avg' | 'min' | 'max' | 'count' | null
  childTable?: string
  /** coluna da tabela filha que aponta para a principal */
  fk?: string
  /** coluna da tabela principal referenciada (normalmente id) */
  localKey?: string
  expr: VToken[]
}

export interface UseCaseJoin { from: string; to: string; localKey: string; foreignKey: string }

const FUNCTIONS: Record<string, QueryVirtualField['fn']> = {
  SOMA: 'sum', MEDIA: 'avg', MÉDIA: 'avg', MAXIMO: 'max', MÁXIMO: 'max', MINIMO: 'min', MÍNIMO: 'min', COUNT: 'count', CONTAR: 'count',
}
const OPERATORS = new Set(['+', '-', '*', '/', '(', ')'])
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/
const NUMBER = /^\d+(\.\d+)?$/

type Meta = { label?: { text?: string }; content?: { formula_tokens?: any[] }; virtual_model_id?: string }

const tokensOf = (meta: Meta | undefined): any[] => (Array.isArray(meta?.content?.formula_tokens) ? (meta!.content!.formula_tokens as any[]) : [])

function balanced(tokens: VToken[]): boolean {
  let depth = 0
  for (const t of tokens) {
    if (t.t === 'op' && t.v === '(') depth++
    if (t.t === 'op' && t.v === ')' && --depth < 0) return false
  }
  return depth === 0
}

interface Ctx {
  metaByKey: Record<string, Meta>
  /** id do modelo → nome da tabela */
  tableOfModel: (id: string | undefined) => string | undefined
}

/** Tokens de uma fórmula linha a linha: colunas, números, operadores e referências a outros virtuais (expandidas). null se não suportada. */
function rowTokens(raw: any[], ctx: Ctx, tables: Set<string>, depth = 0): VToken[] | null {
  if (depth > 5) return null
  const out: VToken[] = []
  for (const tk of raw) {
    const value = String(tk?.value ?? '')
    if (tk?.type === 'function') return null
    if (tk?.type === 'operator') {
      if (!OPERATORS.has(value)) return null
      out.push({ t: 'op', v: value })
    } else if (tk?.type === 'field') {
      const dot = value.indexOf('.')
      if (dot <= 0) return null
      const table = value.slice(0, dot)
      const col = value.slice(dot + 1)
      if (!IDENT.test(table) || !IDENT.test(col)) return null
      if (col.startsWith('virt_')) {
        const meta = ctx.metaByKey[col]
        if (!meta) return null
        const inner = rowTokens(tokensOf(meta), ctx, tables, depth + 1)
        if (!inner || inner.length === 0) return null
        out.push({ t: 'op', v: '(' }, ...inner, { t: 'op', v: ')' })
      } else {
        tables.add(table)
        out.push({ t: 'col', v: col })
      }
    } else if (NUMBER.test(value)) {
      out.push({ t: 'num', v: value })
    } else {
      return null
    }
  }
  return out
}

/** Compila um campo virtual. null se a fórmula não for suportada ou a relação não existir. */
export function compileVirtualField(key: string, ctx: Ctx, mainTable: string, joins: UseCaseJoin[]): QueryVirtualField | null {
  const meta = ctx.metaByKey[key]
  const raw = tokensOf(meta)
  if (!meta || raw.length === 0) return null
  const label = meta.label?.text || key

  const fn = raw[0]?.type === 'function' ? FUNCTIONS[String(raw[0].value).toUpperCase()] : undefined
  if (raw[0]?.type === 'function') {
    // FUNC ( ... ) e mais nada
    if (!fn || String(raw[1]?.value) !== '(' || String(raw[raw.length - 1]?.value) !== ')') return null
    const tables = new Set<string>()
    const expr = rowTokens(raw.slice(2, -1), ctx, tables)
    if (!expr || expr.length === 0 || !balanced(expr) || tables.size !== 1) return null
    const child = [...tables][0]
    if (child === mainTable) return null
    const join = joins.find((j) => j.from === mainTable && j.to === child)
    if (!join || !IDENT.test(join.foreignKey) || !IDENT.test(join.localKey)) return null
    return { key, label, fn, childTable: child, fk: join.foreignKey, localKey: join.localKey, expr }
  }

  const tables = new Set<string>()
  const expr = rowTokens(raw, ctx, tables)
  if (!expr || expr.length === 0 || !balanced(expr)) return null
  if ([...tables].some((t) => t !== mainTable)) return null
  return { key, label, fn: null, expr }
}

/**
 * Campos virtuais suportados de uma tabela, achados nos casos de uso do projeto (views com `fields_metadata`).
 * `views`: linhas de ui_views (layout_config como objeto ou texto). `models`: { id, db_table_name }.
 */
export function virtualFieldsForTable(
  views: Array<{ layout_config?: any }>,
  models: Array<{ id: string; db_table_name?: string; name?: string }>,
  modelId: string,
): QueryVirtualField[] {
  const tableOfModel = (id?: string) => {
    const m = models.find((x) => x.id === id)
    return m ? (m.db_table_name || m.name) : undefined
  }
  const mainTable = tableOfModel(modelId)
  if (!mainTable) return []

  const metaByKey: Record<string, Meta> = {}
  const joins: UseCaseJoin[] = []
  for (const v of views || []) {
    let cfg: any = v?.layout_config
    if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg) } catch { cfg = null } }
    if (!cfg || typeof cfg !== 'object') continue
    for (const [k, meta] of Object.entries<any>(cfg.fields_metadata || {})) {
      if (/^virt_[A-Za-z0-9]+$/.test(k) && meta?.virtual_model_id && !metaByKey[k]) metaByKey[k] = meta
    }
    for (const j of Array.isArray(cfg.joins) ? cfg.joins : []) {
      if (j?.from && j?.to && j?.localKey && j?.foreignKey && !joins.some((x) => x.from === j.from && x.to === j.to && x.foreignKey === j.foreignKey)) {
        joins.push({ from: String(j.from), to: String(j.to), localKey: String(j.localKey), foreignKey: String(j.foreignKey) })
      }
    }
  }

  const ctx: Ctx = { metaByKey, tableOfModel }
  const out: QueryVirtualField[] = []
  for (const [key, meta] of Object.entries(metaByKey)) {
    if (meta.virtual_model_id !== modelId) continue
    const compiled = compileVirtualField(key, ctx, mainTable, joins)
    if (compiled) out.push(compiled)
  }
  return out
}
