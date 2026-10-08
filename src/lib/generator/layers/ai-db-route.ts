import type { AppAST } from '../ast'

/**
 * Rota /api/ai-db do app exportado: ponte entre os componentes de IA e o banco relacional local.
 *
 * Antes qualquer usuário logado lia e gravava QUALQUER tabela (inclusive a de login, com os hashes das senhas), e o operador
 * do filtro ia direto para o SQL (injeção). Agora:
 *   - só tabelas do projeto (e nunca a tabela de login);
 *   - operadores de uma lista fixa; colunas só com letras, números e _;
 *   - UPDATE e DELETE exigem filtro (sem ele, apagariam a tabela inteira);
 *   - as permissões da tabela e as regras de acesso por linha valem (app/actions/access), como nas actions.
 * O código gerado evita crases e ${} para não precisar de escapes.
 */
export function generateAiDbRoute(ast: AppAST): string {
  const authTable = (ast.authConfig?.tableName || '').split('.').pop()?.toLowerCase()
  const allowed = ast.models
    .map(m => (m.dbTable || m.name).split('.').pop() as string)
    .filter(t => t && t.toLowerCase() !== authTable)
    .map(t => t.toLowerCase())

  return `import { NextResponse } from 'next/server'
import { query } from '@/app/actions/db'
import { secureSelect, secureCustom, secureWrite } from '@/app/actions/access'

// Tabelas que esta rota pode tocar: as do projeto, nunca a de login
const ALLOWED_TABLES = new Set<string>(${JSON.stringify(allowed)})

// Operadores aceitos nos filtros (o que vier fora desta lista é recusado)
const OPS: Record<string, string> = {
  '=': '=', '!=': '<>', '<>': '<>', '>': '>', '>=': '>=', '<': '<', '<=': '<=',
  like: 'LIKE', ilike: 'ILIKE', in: 'ANY',
}

const ident = (v: unknown) => String(v ?? '').replace(/[^a-zA-Z0-9_]/g, '')
const rowsOf = (r: any): any[] => r?.rows || (Array.isArray(r) ? r : [])
const runRead = async (q: string) => rowsOf(await query(q))

function fail(message: string, status = 400) {
  return NextResponse.json({ data: null, error: message }, { status })
}

/** Condição SQL de um filtro validado (IN vira = ANY($n) com a lista como parâmetro). */
function cond(f: { col: string; op: string; val: any }, params: any[]): string {
  params.push(f.val)
  return f.op === 'ANY' ? f.col + ' = ANY($' + params.length + ')' : f.col + ' ' + f.op + ' $' + params.length
}

/** Filtros validados: coluna só com letras/números/_ e operador da lista. null = algum filtro inválido. */
function cleanFilters(filters: any[], alias = ''): Array<{ col: string; op: string; val: any }> | null {
  const out: Array<{ col: string; op: string; val: any }> = []
  for (const f of filters || []) {
    const col = ident(f?.col)
    if (!col || col === 'project_id') continue
    const op = OPS[String(f?.op ?? '=').toLowerCase()]
    if (!op) return null
    out.push({ col: alias + '"' + col + '"', op, val: f.val })
  }
  return out
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { table, action, selectCols = '*', filters = [], orders = [], isSingle, limitCount, mutationPayload } = body

    if (!table) return fail('Table name is required')
    const cleanTable = ident(table)
    if (!ALLOWED_TABLES.has(cleanTable.toLowerCase())) return fail('Tabela não permitida: ' + cleanTable, 403)

    // ── SELECT ─────────────────────────────────────────────────────────
    if (action === 'select') {
      const isProdutos = cleanTable.toLowerCase() === 'produtos'
      const hasCatJoin = String(selectCols).includes('categorias_produtos')
      const alias = isProdutos && hasCatJoin ? 'p.' : ''
      const valid = cleanFilters(filters, alias)
      if (!valid) return fail('Operador de filtro não permitido')

      const params: any[] = []
      let sql = isProdutos && hasCatJoin
        ? 'SELECT p.*, c.nome AS categoria_nome FROM "' + cleanTable + '" p LEFT JOIN "categorias_produtos" c ON p.categoria_id = c.id'
        : 'SELECT * FROM "' + cleanTable + '"'
      if (valid.length > 0) {
        sql += ' WHERE ' + valid.map(f => cond(f, params)).join(' AND ')
      }
      if (Array.isArray(orders) && orders.length > 0) {
        sql += ' ORDER BY ' + orders.map((o: any) => alias + '"' + ident(o?.col) + '" ' + (o?.asc ? 'ASC' : 'DESC')).join(', ')
      }
      const lim = Number(limitCount)
      if (isSingle) sql += ' LIMIT 1'
      else if (Number.isInteger(lim) && lim > 0) sql += ' LIMIT ' + Math.min(lim, 100000)

      let rows = rowsOf(await query(await secureSelect(sql), params))
      if (isProdutos) {
        rows = rows.map((r: any) => ({
          ...r,
          preco_unitario: Number(r.preco_unitario ?? r.preco_base ?? 0),
          preco_base: Number(r.preco_base ?? r.preco_unitario ?? 0),
          quantidade: Number(r.quantidade ?? r.estoque_atual ?? 0),
          estoque_atual: Number(r.estoque_atual ?? r.quantidade ?? 0),
          categorias_produtos: r.categoria_nome ? { nome: r.categoria_nome } : (r.categorias_produtos || null),
        }))
      }
      return NextResponse.json({ data: isSingle ? (rows[0] || null) : rows, error: null })
    }

    // colunas que existem de verdade na tabela (descarta o que a IA inventou)
    const realColumns = async (): Promise<string[]> => {
      try {
        const rows = rowsOf(await query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', [cleanTable.toLowerCase()]))
        return rows.map((r: any) => String(r.column_name).toLowerCase())
      } catch { return [] }
    }
    const adaptProdutos = (payload: Record<string, any>, realCols: string[]) => {
      if (cleanTable.toLowerCase() !== 'produtos' || realCols.length === 0) return
      if (!realCols.includes('preco_unitario') && realCols.includes('preco_base') && payload.preco_unitario !== undefined) { payload.preco_base = payload.preco_unitario; delete payload.preco_unitario }
      if (!realCols.includes('quantidade') && realCols.includes('estoque_atual') && payload.quantidade !== undefined) { payload.estoque_atual = payload.quantidade; delete payload.quantidade }
    }

    // ── INSERT ─────────────────────────────────────────────────────────
    if (action === 'insert') {
      const payload: Record<string, any> = Array.isArray(mutationPayload) ? { ...mutationPayload[0] } : { ...mutationPayload }
      delete payload.project_id
      const realCols = await realColumns()
      adaptProdutos(payload, realCols)
      const keys = Object.keys(payload).filter(k => ident(k) === k && (realCols.length === 0 || realCols.includes(k.toLowerCase())))
      if (keys.length === 0) return fail('Nenhum dado válido para inserção')

      // permissão da tabela e valores gravados dentro da regra de acesso
      const checked = (await secureWrite({ action: 'insert', table: cleanTable, data: Object.fromEntries(keys.map(k => [k, payload[k]])), query: runRead })) || {}
      const cols = Object.keys(checked)
      const sql = 'INSERT INTO "' + cleanTable + '" (' + cols.map(k => '"' + k + '"').join(', ') + ') VALUES (' + cols.map((_, i) => '$' + (i + 1)).join(', ') + ') RETURNING *'
      const inserted = rowsOf(await query(sql, cols.map(k => checked[k])))[0] || payload
      return NextResponse.json({ data: isSingle ? inserted : [inserted], error: null })
    }

    // ── UPDATE ─────────────────────────────────────────────────────────
    if (action === 'update') {
      const payload: Record<string, any> = { ...mutationPayload }
      delete payload.project_id
      const realCols = await realColumns()
      adaptProdutos(payload, realCols)
      const keys = Object.keys(payload).filter(k => ident(k) === k && (realCols.length === 0 || realCols.includes(k.toLowerCase())))
      if (keys.length === 0) return fail('Nenhum campo para atualizar')
      const valid = cleanFilters(filters)
      if (!valid) return fail('Operador de filtro não permitido')
      if (valid.length === 0) return fail('Atualização sem filtro não é permitida')

      // permissão da tabela e valores gravados dentro da regra de acesso (a linha atingida é conferida pelo WHERE abaixo)
      await secureWrite({ action: 'update', table: cleanTable, data: Object.fromEntries(keys.map(k => [k, payload[k]])), checkRows: false, query: runRead })
      const params: any[] = keys.map(k => payload[k])
      let sql = 'UPDATE "' + cleanTable + '" SET ' + keys.map((k, i) => '"' + k + '" = $' + (i + 1)).join(', ')
      sql += ' WHERE ' + valid.map(f => cond(f, params)).join(' AND ')
      sql += ' RETURNING *'
      const updated = rowsOf(await query(await secureCustom(sql), params))
      return NextResponse.json({ data: isSingle ? (updated[0] || null) : updated, error: null })
    }

    // ── DELETE ─────────────────────────────────────────────────────────
    if (action === 'delete') {
      const valid = cleanFilters(filters)
      if (!valid) return fail('Operador de filtro não permitido')
      if (valid.length === 0) return fail('Exclusão sem filtro não é permitida')
      const params: any[] = []
      const sql = 'DELETE FROM "' + cleanTable + '" WHERE ' + valid.map(f => cond(f, params)).join(' AND ')
      await query(await secureCustom(sql), params)
      return NextResponse.json({ data: null, error: null })
    }

    return fail('Ação não suportada: ' + action)
  } catch (err: any) {
    console.error('[ai-db] Erro:', err)
    return NextResponse.json({ data: null, error: err.message || 'Erro no banco' }, { status: 500 })
  }
}
`
}
