import { RouteNode, AppAST, AnalyticsWidget } from '../../ast'
import { renderGridCellValue } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Analytics / Dashboard BI Page Generator (Server-Side Aggregation)
// ─────────────────────────────────────────────────────────────────────────────

export function generateAnalyticsPage(route: RouteNode, ast: AppAST): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const widgets = route.analyticsConfig?.widgets || []
  const primaryKey = route.primaryKey || 'id'
  const hasCreate = route.buttons.some(b => b.actionType === 'create') || route.buttons.length === 0

  const resolveModel = (tableOrId: string) => {
    if (!tableOrId) return undefined
    const clean = tableOrId.toLowerCase().trim()
    return ast.models.find(m =>
      m.id.toLowerCase() === clean ||
      m.dbTable.toLowerCase() === clean ||
      m.name.toLowerCase() === clean
    )
  }

  const getFieldRelTable = (f: any): string | null => {
    if (f.config?.component?.options_type === 'enumeration' || f.config?.options_type === 'enumeration') {
      return null
    }
    const raw = f.config?.relation?.targetTable || f.config?.component?.rel_table || f.config?.rel_table
    if (raw) {
      const m = resolveModel(raw)
      if (m) return m.dbTable.toLowerCase()
      if (!raw.includes('-') && raw.length < 50) return raw.toLowerCase()
      return null
    }
    if (f.dbColumn && f.dbColumn.endsWith('_id') && !f.isPrimaryKey) {
      const base = f.dbColumn.slice(0, -3)
      const tbl = base.endsWith('s') ? base : `${base}s`
      return tbl.toLowerCase()
    }
    return null
  }

  // 1. Identifica todos os modelos necessários para os widgets, joins e grid/filtros
  const referencedTables = new Set<string>()

  // Tabelas referenciadas nas expressões dos widgets
  widgets.forEach(w => {
    if (w.modelId && w.modelId !== route.modelId) {
      const m = resolveModel(w.modelId)
      if (m) referencedTables.add(m.dbTable.toLowerCase())
    }
    if (w.field && typeof w.field === 'string') {
      const matches = w.field.match(/[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+/g)
      if (matches) {
        matches.forEach(match => {
          const t = match.split('.')[0].toLowerCase()
          const m = resolveModel(t)
          if (m) referencedTables.add(m.dbTable.toLowerCase())
          else if (!t.includes('-') && t.length < 50) referencedTables.add(t)
        })
      }
    }
    if (w.groupBy && typeof w.groupBy === 'string') {
      if (w.groupBy.includes('.')) {
        const t = w.groupBy.split('.')[0].toLowerCase()
        const m = resolveModel(t)
        if (m) referencedTables.add(m.dbTable.toLowerCase())
        else if (!t.includes('-') && t.length < 50) referencedTables.add(t)
      } else if (w.groupBy.endsWith('_id')) {
        const base = w.groupBy.slice(0, -3)
        const tbl = base.endsWith('s') ? base : `${base}s`
        referencedTables.add(tbl.toLowerCase())
      }
    }
  })

  // Tabelas nos joins declarados no layout_config (normalizados)
  const rawJoins: Array<{ from: string; to: string; localKey?: string; foreignKey?: string }> =
    route.rawLayoutConfig?.joins || []

  const normalizedJoins = rawJoins.map(j => {
    const fromModel = resolveModel(j.from)
    const toModel = resolveModel(j.to)
    const fromTable = fromModel ? fromModel.dbTable.toLowerCase() : (j.from || '').toLowerCase()
    const toTable = toModel ? toModel.dbTable.toLowerCase() : (j.to || '').toLowerCase()
    return {
      from: fromTable,
      localKey: j.localKey || 'id',
      to: toTable,
      foreignKey: j.foreignKey || `${fromTable}_id`,
    }
  }).filter(j => !j.from.includes('-') && !j.to.includes('-') && j.from && j.to)

  normalizedJoins.forEach(j => {
    if (j.from) referencedTables.add(j.from)
    if (j.to) referencedTables.add(j.to)
  })

  // Tabelas relacionais necessárias para as colunas da grid e filtros
  const allListFields = [...(route.filterFields || []), ...(route.gridFields || [])]
  allListFields.forEach(f => {
    const targetTable = getFieldRelTable(f)
    if (targetTable) referencedTables.add(targetTable)
  })

  // Remove a tabela mestre da lista de lookups adicionais
  referencedTables.delete(route.modelTable.toLowerCase())

  // Mapeia tabela -> ModelNode (APENAS modelos que realmente existem no AST!)
  const relatedModels: Array<{ table: string; modelName: string }> = []
  for (const tbl of Array.from(referencedTables)) {
    const found = resolveModel(tbl)
    if (found) {
      relatedModels.push({ table: found.dbTable.toLowerCase(), modelName: found.name })
    }
  }

  // Gera imports das actions (apenas para modelos válidos no AST)
  const relatedImports = relatedModels
    .map(rm => `import { get${rm.modelName}List } from '@/app/actions/${rm.table}'`)
    .join('\n')

  // Gera destructuring do Promise.all para fetch paralelo
  const allFetchNames = [
    `masterRawData`,
    ...relatedModels.map(rm => `${rm.table.replace(/[^a-zA-Z0-9_]/g, '_')}Data`),
  ]

  // Campo de data declarado explicitamente no analytics_config (fallback: heurística)
  const dateFilterField = route.analyticsConfig?.dateFilterField ?? null

  const masterFetchCall = dateFilterField
    ? `get${mn}List({ dateField: '${dateFilterField}', startDate, endDate, limit: 50_000 }).catch(() => [])`
    : `get${mn}List().catch(() => [])`

  const allFetchCalls = [
    masterFetchCall,
    ...relatedModels.map(rm => `get${rm.modelName}List().catch(() => [])`),
  ]
  const parallelFetch = `  const [${allFetchNames.join(', ')}] = await Promise.all([\n    ${allFetchCalls.join(',\n    ')}\n  ])`

  const tablesDataEntries = relatedModels
    .map(rm => `    '${rm.table}': ${rm.table.replace(/[^a-zA-Z0-9_]/g, '_')}Data || [],`)
    .join('\n')

  // Gera mapa de relationalOptions para os campos de lookup da grid e filtros
  const buildOptionsCode: string[] = []
  allListFields.forEach(f => {
    const isEnum = f.config?.component?.options_type === 'enumeration' || f.config?.options_type === 'enumeration'
    if (isEnum || (f.config?.options && Array.isArray(f.config.options) && f.config.options.length > 0)) {
      if (f.config?.options && Array.isArray(f.config.options) && f.config.options.length > 0) {
        buildOptionsCode.push(`    '${f.dbColumn}': ${JSON.stringify(f.config.options)},`)
      }
      return
    }

    const targetTable = getFieldRelTable(f)
    if (targetTable && referencedTables.has(targetTable) && relatedModels.some(rm => rm.table === targetTable)) {
      const t = targetTable
      const varName = `${t.replace(/[^a-zA-Z0-9_]/g, '_')}Data`
      const relLabel = f.config?.component?.rel_label || f.config?.relation?.displayColumn || f.config?.rel_label
      const relValue = f.config?.component?.rel_value || f.config?.relation?.valueColumn || f.config?.rel_value || 'id'
      const labelExpr = relLabel
        ? `r[${JSON.stringify(relLabel)}] ?? r[${JSON.stringify(relLabel.toLowerCase())}] ?? r.nome ?? r.name ?? r.razao_social ?? r.titulo ?? r.descricao ?? r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
        : `r.nome ?? r.name ?? r.razao_social ?? r.titulo ?? r.descricao ?? r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
      const valueExpr = `r[${JSON.stringify(relValue)}] ?? r[${JSON.stringify(relValue.toLowerCase())}] ?? r.id ?? Object.values(r)[0] ?? ''`
      buildOptionsCode.push(`    '${f.dbColumn}': (${varName} || []).map((r: any) => ({ value: String(${valueExpr}), label: String(${labelExpr}) })),`)
    }
  })

  // Cabeçalhos da tabela com ordenação
  const thCells = route.gridFields
    .filter(f => !f.hidden)
    .map(f => {
      const col = f.dbColumn
      return `                    <th
                      key="${col}"
                      className="px-6 py-4 text-[10px] font-black text-neutral-400 dark:text-neutral-500 tracking-[0.15em] whitespace-nowrap cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors group/th"
                    >
                      <Link
                        href={makeQuery({ sort_by: '${col}', sort_order: sortBy === '${col}' && sortOrder === 'asc' ? 'desc' : 'asc' })}
                        className="flex items-center gap-2"
                      >
                        <span>${f.label.toUpperCase()}</span>
                        <div className={"transition-opacity " + (sortBy === '${col}' ? 'opacity-100' : 'opacity-0 group-hover/th:opacity-100')}>
                          {sortBy === '${col}' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
                          )}
                        </div>
                      </Link>
                    </th>`
    })
    .join('\n')

  // Células da tabela
  const tdCells = route.gridFields
    .filter(f => !f.hidden)
    .map(f => `                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400 whitespace-nowrap">\n                        ${renderGridCellValue(f, 'item', 'relationalOptions')}\n                      </td>`)
    .join('\n')

  // Filtros da view
  const filterFields = route.filterFields.length > 0 ? route.filterFields : []
  const filterInputs = filterFields.map(f => {
    const col = f.dbColumn.replace('.', '_')
    const gridSpan = f.config?.gridSpan || f.config?.component?.gridSpan || 3
    const colSpanClass = `col-span-12 md:col-span-${Math.min(12, gridSpan || 3)}`

    const isEnum = f.config?.component?.options_type === 'enumeration' || f.config?.options_type === 'enumeration'
    const targetTable = getFieldRelTable(f)
    const isRelational = !isEnum && !!(targetTable && referencedTables.has(targetTable) && relatedModels.some(rm => rm.table === targetTable))

    let options = f.config?.options
    if ((!options || options.length === 0) && (f.dbColumn.toLowerCase().includes('status') || f.label.toLowerCase().includes('status'))) {
      options = [
        { label: 'Novo', value: 'Novo' },
        { label: 'Contactado', value: 'Contactado' },
        { label: 'Em Negociação', value: 'Em Negociação' },
        { label: 'Fechado Ganho', value: 'Fechado Ganho' },
        { label: 'Perdido', value: 'Perdido' }
      ]
    }

    if (isRelational) {
      return `
                <div className="flex flex-col gap-1.5 ${colSpanClass}">
                  <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">${f.label}</label>
                  <select
                    name="${col}_filter"
                    defaultValue={params?.['${col}_filter'] || ''}
                    className="w-full h-[42px] px-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm"
                  >
                    <option value="">Todos</option>
                    {(relationalOptions?.['${f.dbColumn}'] || []).map((opt: any, i: number) => (
                      <option key={i} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>`
    }

    if (options && options.length > 0) {
      const optsCode = JSON.stringify(options)
      return `
                <div className="flex flex-col gap-1.5 ${colSpanClass}">
                  <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">${f.label}</label>
                  <select
                    name="${col}_filter"
                    defaultValue={params?.['${col}_filter'] || ''}
                    className="w-full h-[42px] px-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm"
                  >
                    <option value="">Todos</option>
                    {(${optsCode} as Array<{value: string; label: string}>).map((opt, i) => (
                      <option key={i} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>`
    }

    return `
                <div className="flex flex-col gap-1.5 ${colSpanClass}">
                  <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">${f.label}</label>
                  <div className="relative group">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type="text"
                      name="${col}_filter"
                      placeholder="Filtrar por ${f.label.toLowerCase()}..."
                      defaultValue={params?.['${col}_filter'] || ''}
                      className="w-full h-[42px] pl-9 pr-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm"
                    />
                  </div>
                </div>`
  }).join('\n')

  // Header custom actions & buttons
  const headerButtonsHtml = route.buttons.filter(b => b.placement === 'header').map(b => {
    if (b.actionType === 'create') {
      return `          <Link href="${route.path}/new" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
            <Plus className="w-4 h-4" /> ${b.label}
          </Link>`
    }
    if (b.actionType === 'custom') {
      const actionConfig = {
        id: b.id,
        label: b.label,
        icon: b.icon || 'Zap',
        style: b.style,
        triggerType: b.triggerType,
        usecaseSlug: b.usecaseSlug,
        usecaseOpenMode: b.usecaseOpenMode || 'modal',
        usecaseModalSize: b.usecaseModalSize || 'full',
        usecaseModalWidth: b.usecaseModalWidth,
        usecaseModalHeight: b.usecaseModalHeight,
        usecaseSelectedFields: b.usecaseSelectedFields || [],
        usecaseParams: b.usecaseParams || '',
        linkTarget: b.linkTarget || '',
      }
      return `          <CustomActionButton action={${JSON.stringify(actionConfig)}} variant="header" />`
    }
    return `          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95">
            ${b.label}
          </button>`
  }).join('\n') || (hasCreate ? `          <Link href="${route.path}/new" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
            <Plus className="w-4 h-4" /> Novo Registro
          </Link>` : '')

  // Filtro de data server-side
  const filteredRowsCode = dateFilterField
    ? `  // Filtro de data aplicado no banco via pushdown\n  const filteredRows = denormalizedRows`
    : `  // Filtro de data via query parameters\n  const filteredRows = denormalizedRows.filter(row => {\n    if (!startDate && !endDate) return true\n    const dateKey = Object.keys(row).find(k => {\n      const kl = k.toLowerCase()\n      return (kl.includes('data') || kl.includes('date') || kl.includes('created')) &&\n        !isNaN(new Date(row[k]).getTime())\n    }) ?? null\n    if (!dateKey) return true\n    const rowDate = new Date(row[dateKey]).getTime()\n    if (isNaN(rowDate)) return true\n    if (startDate && rowDate < new Date(startDate).getTime()) return false\n    if (endDate && rowDate > new Date(endDate + 'T23:59:59').getTime()) return false\n    return true\n  })`

  const widgetsJson = JSON.stringify(widgets, null, 2)
  const joinsJson = JSON.stringify(normalizedJoins, null, 2)
  const defaultItemsPerPage = route.rawLayoutConfig?.items_per_page || 50

  return `import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { get${mn}List, delete${mn} } from '@/app/actions/${mnLower}'
${relatedImports ? `${relatedImports}\n` : ''}import { Plus, Pencil, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, RotateCcw, Loader2 } from 'lucide-react'
import { DynamicIcon } from '@/app/components/DynamicIcon'
import { DeleteButton } from '@/components/ui/delete-button'
import { CustomActionButton } from '@/components/ui/custom-action-button'
import { LimitSelector } from '@/components/ui/limit-selector'
import { AnalyticsClient } from './AnalyticsClient'

export const metadata: Metadata = { title: '${route.title || 'Dashboard Analítico'}' }

// Configuração estática dos widgets e joins
const WIDGETS = ${widgetsJson} as const
const JOINS = ${joinsJson} as const

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de Resolução e Agregação Server-Side (JS)
// ─────────────────────────────────────────────────────────────────────────────

function getRowField(row: Record<string, any>, colName: string): any {
  if (!row || !colName) return undefined
  if (row[colName] !== undefined) return row[colName]

  const target = colName.toLowerCase()
  const shortTarget = target.includes('.') ? target.split('.').pop()! : target

  for (const [k, v] of Object.entries(row)) {
    const kLow = k.toLowerCase()
    if (kLow === target) return v
    if (kLow === shortTarget) return v
    if (kLow.endsWith('.' + shortTarget)) return v
  }
  return undefined
}

function findRowDisplayValue(item: Record<string, any>): string {
  if (!item) return ''
  const candidates = ['nome', 'name', 'razao_social', 'razaosocial', 'descricao', 'description', 'titulo', 'title', 'label', 'display_label']
  for (const c of candidates) {
    const key = Object.keys(item).find(k => k.toLowerCase() === c)
    if (key && item[key] != null && item[key] !== '') return String(item[key])
  }
  for (const [k, v] of Object.entries(item)) {
    const kl = k.toLowerCase()
    if (!kl.includes('id') && !kl.includes('created') && !kl.includes('updated') && typeof v === 'string' && v.trim() !== '') {
      return v
    }
  }
  return String(Object.values(item)[1] ?? Object.values(item)[0] ?? '')
}

function safeEvalMath(expr: string): number {
  const sanitized = expr.replace(/[^0-9+\\-*/(). ]/g, '')
  if (!sanitized) return 0
  try {
    const result = new Function('"use strict"; return (' + sanitized + ')')()
    const num = Number(result)
    return isNaN(num) ? 0 : num
  } catch {
    return 0
  }
}

function evaluateRowValue(fieldExpr: string, row: Record<string, any>, isFormula?: boolean): number {
  if (!fieldExpr || fieldExpr === '*') return 1

  if (!isFormula && !fieldExpr.includes('*') && !fieldExpr.includes('+') && !fieldExpr.includes('/') && !fieldExpr.includes('-')) {
    const val = getRowField(row, fieldExpr)
    const num = Number(val)
    return isNaN(num) ? 0 : num
  }

  try {
    const rowKeys = Object.keys(row)
    let expr = fieldExpr
    const sortedKeys = [...rowKeys].sort((a, b) => b.length - a.length)

    for (const key of sortedKeys) {
      if (!key || key.includes('__label')) continue
      const val = Number(row[key]) || 0
      const escaped = key.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&')
      expr = expr.replace(new RegExp(escaped, 'gi'), String(val))
    }

    for (const key of sortedKeys) {
      const short = key.includes('.') ? key.split('.').pop()! : key
      if (!short || short.includes('__label')) continue
      const val = Number(row[key]) || 0
      const escaped = short.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&')
      expr = expr.replace(new RegExp('\\\\b' + escaped + '\\\\b', 'gi'), String(val))
    }

    return safeEvalMath(expr)
  } catch {
    return 0
  }
}

function formatDateGranularity(rawVal: any, granularity?: string): string {
  if (!rawVal) return 'N/A'
  if (!granularity) {
    if (rawVal instanceof Date) return rawVal.toLocaleDateString('pt-BR')
    return String(rawVal)
  }

  const str = String(rawVal)
  const match = str.match(/^(\\d{4})[-/](\\d{2})[-/](\\d{2})/)
  if (match) {
    const [_, y, m, d] = match
    if (granularity === 'year') return y
    if (granularity === 'month') return \`\${y}-\${m}\`
    if (granularity === 'day') return \`\${y}-\${m}-\${d}\`
  }

  const d = new Date(rawVal)
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    if (granularity === 'year') return String(y)
    if (granularity === 'month') return \`\${y}-\${m}\`
    if (granularity === 'day') return \`\${y}-\${m}-\${day}\`
  }

  return String(rawVal)
}

function buildDenormalizedRows(
  masterTable: string,
  masterData: any[],
  joins: typeof JOINS,
  tablesData: Record<string, any[]>
): any[] {
  if (!masterData || masterData.length === 0) return []

  const masterTbl = masterTable.toLowerCase()

  let currentRows: any[] = masterData.map(masterRow => {
    const base: Record<string, any> = { ...masterRow }
    for (const [k, v] of Object.entries(masterRow)) {
      base[\`\${masterTbl}.\${k.toLowerCase()}\`] = v
    }
    return base
  })

  if (!joins || joins.length === 0) {
    return currentRows
  }

  const joinedTables = new Set<string>([masterTbl])
  const pendingJoins = [...joins]
  let madeProgress = true
  let iterations = 0

  while (madeProgress && pendingJoins.length > 0 && iterations < 20) {
    iterations++
    madeProgress = false

    for (let i = 0; i < pendingJoins.length; i++) {
      const j = pendingJoins[i]
      const fromTbl = (j.from || '').toLowerCase()
      const toTbl = (j.to || '').toLowerCase()

      let sourceTbl = ''
      let targetTbl = ''
      let sourceCol = ''
      let targetCol = ''

      if (joinedTables.has(fromTbl) && !joinedTables.has(toTbl)) {
        sourceTbl = fromTbl
        targetTbl = toTbl
        sourceCol = j.localKey || 'id'
        targetCol = j.foreignKey || \`\${fromTbl}_id\`
      } else if (joinedTables.has(toTbl) && !joinedTables.has(fromTbl)) {
        sourceTbl = toTbl
        targetTbl = fromTbl
        sourceCol = j.foreignKey || \`\${fromTbl}_id\`
        targetCol = j.localKey || 'id'
      }

      if (!sourceTbl || !targetTbl) continue

      const targetData = tablesData[targetTbl] || []
      const nextRows: any[] = []

      for (const row of currentRows) {
        const val = row[\`\${sourceTbl}.\${sourceCol.toLowerCase()}\`] ?? row[sourceCol] ?? row[sourceCol.toLowerCase()]

        const matches = val != null
          ? targetData.filter(item => {
              const itemVal = item[targetCol] ?? item[targetCol.toLowerCase()] ?? item.id
              return String(itemVal) === String(val)
            })
          : []

        if (matches.length === 0) {
          nextRows.push(row)
        } else if (matches.length === 1) {
          const match = matches[0]
          const enriched = { ...row }
          const displayVal = findRowDisplayValue(match)

          for (const [k, v] of Object.entries(match)) {
            const kl = k.toLowerCase()
            enriched[\`\${targetTbl}.\${kl}\`] = v
            if (enriched[k] === undefined) enriched[k] = v
          }
          if (displayVal) {
            enriched[\`\${targetTbl}__label\`] = displayVal
            enriched[\`\${sourceCol}__label\`] = displayVal
            enriched[\`\${sourceTbl}.\${sourceCol}__label\`] = displayVal
          }
          nextRows.push(enriched)
        } else {
          // 1:N (ex: pedido -> itens_pedido)
          for (const match of matches) {
            const enriched = { ...row }
            const displayVal = findRowDisplayValue(match)

            for (const [k, v] of Object.entries(match)) {
              const kl = k.toLowerCase()
              enriched[\`\${targetTbl}.\${kl}\`] = v
              enriched[k] = v
            }
            if (displayVal) {
              enriched[\`\${targetTbl}__label\`] = displayVal
              enriched[\`\${sourceCol}__label\`] = displayVal
              enriched[\`\${sourceTbl}.\${sourceCol}__label\`] = displayVal
            }
            nextRows.push(enriched)
          }
        }
      }

      currentRows = nextRows
      joinedTables.add(targetTbl)
      pendingJoins.splice(i, 1)
      madeProgress = true
      break
    }
  }

  return currentRows
}

function calculateWidgetData(
  widget: AnalyticsWidget,
  rows: Record<string, any>[],
  tablesData?: Record<string, any[]>
): number | Array<{ name: string; value: number }> {
  const isKpiOrGauge = widget.type === 'kpi' || widget.type === 'gauge'
  const isFormula = !!widget.useFormula || (widget.field && /[+*\\/-]/.test(widget.field))

  // KPI ou Gauge sem agrupamento (valor escalar único)
  if (isKpiOrGauge && !widget.groupBy) {
    if (widget.calc === 'COUNT') {
      return rows.length
    }
    const values = rows.map(r => evaluateRowValue(widget.field, r, isFormula)).filter(v => !isNaN(v))
    if (values.length === 0) return 0
    if (widget.calc === 'SUM') return values.reduce((a, b) => a + b, 0)
    if (widget.calc === 'AVG') return values.reduce((a, b) => a + b, 0) / (values.length || 1)
    if (widget.calc === 'MIN') return Math.min(...values)
    if (widget.calc === 'MAX') return Math.max(...values)
    return values.reduce((a, b) => a + b, 0)
  }

  // Gráficos (Bar, Line, Pie) ou KPIs/Gauges agrupados
  const groupBy = (widget.groupBy || '').trim()
  const groups: Record<string, { value: number; count: number }> = {}

  for (const row of rows) {
    let groupKey = 'N/A'

    if (groupBy) {
      const parts = groupBy.split('.')
      const colName = parts.length > 1 ? parts[1] : groupBy
      const tblName = parts.length > 1 ? parts[0].toLowerCase() : ''

      let rawGroupVal = getRowField(row, groupBy)

      if (rawGroupVal === undefined && colName) {
        rawGroupVal = getRowField(row, colName)
      }

      const labelKeyCandidates = [
        \`\${groupBy}__label\`,
        \`\${colName}__label\`,
        tblName ? \`\${tblName}__label\` : '',
        colName.endsWith('_id') ? \`\${colName.slice(0, -3)}__label\` : '',
        \`id_\${colName}__label\`
      ].filter(Boolean)

      for (const lk of labelKeyCandidates) {
        if (row[lk] != null && row[lk] !== '') {
          rawGroupVal = row[lk]
          break
        }
      }

      if (rawGroupVal != null && typeof rawGroupVal === 'string' && tablesData) {
        const isUuidOrId = /^[0-9a-fA-F-]{8,}$/.test(rawGroupVal) || /^\\d+$/.test(rawGroupVal)
        if (isUuidOrId) {
          const targetTable = tblName || (colName.endsWith('_id') ? (colName.slice(0, -3).endsWith('s') ? colName.slice(0, -3) : colName.slice(0, -3) + 's') : '')
          if (targetTable && tablesData[targetTable]) {
            const match = tablesData[targetTable].find(item => String(item.id) === String(rawGroupVal))
            if (match) {
              const disp = findRowDisplayValue(match)
              if (disp) rawGroupVal = disp
            }
          }
        }
      }

      if (rawGroupVal != null) {
        groupKey = widget.dateGranularity
          ? formatDateGranularity(rawGroupVal, widget.dateGranularity)
          : String(rawGroupVal)
      }
    }

    if (!groups[groupKey]) {
      groups[groupKey] = { value: 0, count: 0 }
    }

    const val = evaluateRowValue(widget.field, row, isFormula)
    if (widget.calc === 'COUNT') {
      groups[groupKey].value += 1
      groups[groupKey].count += 1
    } else if (widget.calc === 'SUM') {
      groups[groupKey].value += val
      groups[groupKey].count += 1
    } else if (widget.calc === 'AVG') {
      groups[groupKey].value += val
      groups[groupKey].count += 1
    } else if (widget.calc === 'MIN') {
      groups[groupKey].value = groups[groupKey].count === 0 ? val : Math.min(groups[groupKey].value, val)
      groups[groupKey].count += 1
    } else if (widget.calc === 'MAX') {
      groups[groupKey].value = groups[groupKey].count === 0 ? val : Math.max(groups[groupKey].value, val)
      groups[groupKey].count += 1
    } else {
      groups[groupKey].value += val
      groups[groupKey].count += 1
    }
  }

  let result = Object.entries(groups).map(([name, g]) => ({
    name,
    value: widget.calc === 'AVG' ? (g.value / (g.count || 1)) : g.value
  }))

  const sortMode = widget.sortBy || 'value_desc'
  if (sortMode === 'value_asc') result.sort((a, b) => a.value - b.value)
  else if (sortMode === 'label_asc') result.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  else if (sortMode === 'label_desc') result.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }))
  else result.sort((a, b) => b.value - a.value)

  if (widget.limitTopN && widget.limitTopN > 0) {
    result = result.slice(0, widget.limitTopN)
  }

  return result
}

function AnalyticsLoading() {
  return (
    <div className="py-20 flex flex-col items-center justify-center gap-4 text-neutral-400 bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem]">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      <div className="text-center">
        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-200">Conectando ao banco...</h3>
        <p className="text-sm">Buscando dados no Direct Access...</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics Content Component (Async Server Component)
// ─────────────────────────────────────────────────────────────────────────────

async function ${mn}AnalyticsContent({
  params,
}: {
  params: { [key: string]: string | undefined }
}) {
  const startDate = params?.start_date
  const endDate = params?.end_date
  const sortBy = params?.sort_by
  const sortOrder = params?.sort_order || 'asc'
  const page = Math.max(1, parseInt(params?.page || '1', 10) || 1)
  const limit = Math.max(1, parseInt(params?.limit || '${defaultItemsPerPage}', 10) || ${defaultItemsPerPage})

  // Busca paralela de todos os dados no banco
${parallelFetch}

  const tablesData: Record<string, any[]> = {
    '${route.modelTable.toLowerCase()}': masterRawData || [],
${tablesDataEntries}
  }

  const relationalOptions: Record<string, Array<{ value: string; label: string }>> = {
${buildOptionsCode.join('\n')}
  }

  // Junta dados das tabelas em memória (Server-Side Join)
  const denormalizedRows = buildDenormalizedRows(
    '${route.modelTable.toLowerCase()}',
    masterRawData || [],
    JOINS,
    tablesData
  )

${filteredRowsCode}

  // Agregação de cada widget no Servidor
  const aggregatedData: Record<string, any> = {}
  for (const widget of WIDGETS) {
    aggregatedData[widget.id] = calculateWidgetData(widget, filteredRows, tablesData)
  }

  // Filtros da Grid de Registros
  const filteredGridData = (masterRawData || []).filter((item: any) => {
${filterFields.map(f => {
  const col = f.dbColumn.replace('.', '_')
  const rawCol = f.dbColumn
  return `    const val_${col} = params?.['${col}_filter']
    if (val_${col}) {
      const itemVal = String(item['${rawCol}'] ?? item['${col}'] ?? '').toLowerCase()
      if (!itemVal.includes(String(val_${col}).toLowerCase())) return false
    }`
}).join('\n')}
    return true
  })

  if (sortBy) {
    filteredGridData.sort((a: any, b: any) => {
      const rawCol = sortBy.replace('.', '_')
      const valA = a[sortBy] ?? a[rawCol] ?? ''
      const valB = b[sortBy] ?? b[rawCol] ?? ''
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA
      }
      return sortOrder === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA))
    })
  }

  const totalRows = filteredGridData.length
  const totalPages = Math.ceil(totalRows / limit) || 1
  const paginatedData = filteredGridData.slice((page - 1) * limit, page * limit)

  const makeQuery = (newParams: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams()
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') q.set(k, String(v))
      }
    }
    for (const [k, v] of Object.entries(newParams)) {
      if (v === undefined || v === '') q.delete(k)
      else q.set(k, String(v))
    }
    const str = q.toString()
    return str ? ('?' + str) : ''
  }

  return (
    <>
      {/* Seção BI / Analytics Client */}
      <AnalyticsClient
        title="${route.title || 'Dashboard'}"
        icon="${route.icon || 'BarChart3'}"
        widgets={WIDGETS as any}
        aggregatedData={aggregatedData}
      />

      {/* Grid de Registros e Filtros (quando houver gridFields configurados) */}
      {${route.gridFields.length > 0} && (
        <div className="space-y-6 pt-4">
          {/* Filtros da View */}
          {${filterFields.length > 0} && (
            <form method="GET" className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
              <div className="flex flex-col sm:flex-row items-end gap-4">
                <div className="flex-1 grid grid-cols-12 gap-4 w-full">
${filterInputs}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="h-[42px] px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2 active:scale-95"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    Filtrar
                  </button>
                  <Link
                    href="${route.path}"
                    className="h-[42px] px-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-xl font-bold text-xs transition-all flex items-center justify-center shadow-sm"
                    title="Limpar Filtros"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </form>
          )}

          {/* Tabela de Registros */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                    <th className="w-12 px-6 py-4">
                      <input type="checkbox" className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500" />
                    </th>
${thCells}
                    <th className="px-6 py-4 text-[10px] font-black text-neutral-400 dark:text-neutral-500 tracking-[0.15em] whitespace-nowrap text-right">
                      AÇÕES
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={${route.gridFields.length + 2}} className="px-6 py-12 text-center text-sm text-neutral-400">
                        Nenhum registro encontrado.
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors">
                        <td className="w-12 px-6 py-4">
                          <input type="checkbox" className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500" />
                        </td>
${tdCells}
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={\`${route.path}/\${item['${primaryKey}']}\`}
                              className="p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-all"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Link>
                            <DeleteButton
                              recordName={String(item['${primaryKey}'] ?? '')}
                              onDelete={async () => {
                                'use server'
                                await delete${mn}(item['${primaryKey}'])
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação da Tabela */}
            <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                  Exibir
                </span>
                <LimitSelector currentLimit={limit} />
                <span className="text-xs font-bold text-neutral-400">
                  | Total: {totalRows}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Link
                  href={makeQuery({ page: Math.max(1, page - 1) })}
                  className={"p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 transition-all " + (page <= 1 ? 'opacity-30 pointer-events-none' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800')}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Link>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = i + 1
                  const isActive = p === page
                  return (
                    <Link
                      key={p}
                      href={makeQuery({ page: p })}
                      className={"w-8 h-8 flex items-center justify-center rounded-xl text-xs font-black transition-all " + (isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800')}
                    >
                      {p}
                    </Link>
                  )
                })}
                <Link
                  href={makeQuery({ page: Math.min(totalPages, page + 1) })}
                  className={"p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 transition-all " + (page >= totalPages ? 'opacity-30 pointer-events-none' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800')}
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default async function ${mn}AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const params = await searchParams

  return (
    <div className="p-6 sm:p-10 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Cabeçalho da View (Fiel à Web Produção) */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20 shrink-0">
            <DynamicIcon icon="${route.icon || 'LayoutDashboard'}" size={24} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
              ${route.title}
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mt-0.5">
              SISTEMA METABUILDER
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
${headerButtonsHtml}
        </div>
      </div>

      <Suspense
        key={JSON.stringify(params)}
        fallback={<AnalyticsLoading />}
      >
        <${mn}AnalyticsContent params={params} />
      </Suspense>
    </div>
  )
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics Client Component Generator
// ─────────────────────────────────────────────────────────────────────────────

export function generateAnalyticsClient(route: RouteNode, ast: AppAST): string {
  return `'use client'

import React, { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Activity,
  Gauge as GaugeIcon,
  Search,
  Plus,
  Minimize2,
  Maximize2,
  MousePointer2,
  LayoutGrid,
  ZoomIn,
} from 'lucide-react'

interface AnalyticsWidget {
  id: string
  title: string
  type: 'kpi' | 'bar' | 'pie' | 'line' | 'gauge' | string
  modelId: string
  field: string
  calc: string
  groupBy?: string
  width?: 'full' | 'half' | 'third' | 'quarter' | string
  dateGranularity?: string
  sortBy?: string
  limitTopN?: number
  gaugeMin?: number
  gaugeMax?: number
  gaugeTarget?: number
  gaugeStart?: number
  gaugeEnd?: number
  useFormula?: boolean
  color?: string
}

interface AnalyticsClientProps {
  title: string
  icon?: string
  widgets: AnalyticsWidget[]
  aggregatedData: Record<string, any>
}

const PALETTE = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
]

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}

export function AnalyticsClient({
  title,
  icon = 'BarChart3',
  widgets,
  aggregatedData,
}: AnalyticsClientProps) {
  const [mounted, setMounted] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [expandedWidgetId, setExpandedWidgetId] = useState<string | null>(null)
  const [scale, setScale] = useState(1.0)

  useEffect(() => {
    setMounted(true)
  }, [])

  const scales = [
    { value: 0.8, icon: <Minimize2 className="w-3.5 h-3.5" />, label: 'Pequeno' },
    { value: 1.0, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: 'Normal' },
    { value: 1.2, icon: <Maximize2 className="w-3.5 h-3.5" />, label: 'Grande' },
    { value: 1.5, icon: <ZoomIn className="w-3.5 h-3.5" />, label: 'Extra Grande' },
  ]

  const formatNumber = (val: any) => {
    const num = Number(val)
    if (isNaN(num)) return String(val ?? '-')
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(num)
  }

  const formatCurrency = (val: any) => {
    const num = Number(val)
    if (isNaN(num)) return String(val ?? '-')
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(num)
  }

  // ── Renderizador de Gauge Radial ──
  const renderGauge = (val: number, widget: AnalyticsWidget, isExpanded = false) => {
    const min = widget.gaugeMin ?? 0
    const target = widget.gaugeTarget ?? 70
    const scaleStart = widget.gaugeStart ?? 0
    const scaleEnd = widget.gaugeEnd ?? 100
    const rawVal = typeof val === 'number' ? val : 0
    const percentage = Math.min(Math.max(((rawVal - scaleStart) / (scaleEnd - scaleStart)) * 100, 0), 100)
    const radius = isExpanded ? 90 : 60
    const strokeWidth = isExpanded ? 16 : 10
    const circumference = Math.PI * radius
    const rotation = -90 + (percentage / 100) * 180
    const isBelowMin = rawVal < min
    const isInRange = rawVal >= min && rawVal < target
    const uniqueId = \`gauge-\${widget.id}\`
    const viewBox = isExpanded ? '0 0 240 140' : '0 0 160 100'
    const cx = isExpanded ? 120 : 80
    const cy = isExpanded ? 110 : 80

    return (
      <div className="flex flex-col items-center justify-center p-4">
        <div className="relative overflow-hidden" style={{ width: isExpanded ? 240 : 160, height: isExpanded ? 130 : 90 }}>
          <svg viewBox={viewBox} className="w-full h-full">
            <defs>
              <linearGradient id={\`grad-red-\${uniqueId}\`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#991b1b" />
              </linearGradient>
              <linearGradient id={\`grad-amber-\${uniqueId}\`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>
              <linearGradient id={\`grad-green-\${uniqueId}\`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#064e3b" />
              </linearGradient>
            </defs>
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              strokeWidth={strokeWidth}
              strokeDasharray={\`\${circumference} \${circumference}\`}
              strokeDashoffset={0}
              transform={\`rotate(180 \${cx} \${cy})\`}
              className="text-neutral-100 dark:text-neutral-800 stroke-current"
            />
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeDasharray={\`\${(percentage / 100) * circumference} 1000\`}
              strokeDashoffset={0}
              strokeLinecap="round"
              transform={\`rotate(180 \${cx} \${cy})\`}
              className={\`transition-all duration-1000 ease-out \${
                isBelowMin ? 'text-red-500' : isInRange ? 'text-amber-500' : 'text-emerald-500'
              }\`}
            />
            <g transform={\`rotate(\${rotation} \${cx} \${cy})\`} style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.3))' }}>
              <path
                d={\`M \${cx - (isExpanded ? 4 : 2)} \${cy} L \${cx} \${cy - radius} L \${cx + (isExpanded ? 4 : 2)} \${cy} Z\`}
                fill={isBelowMin ? \`url(#grad-red-\${uniqueId})\` : isInRange ? \`url(#grad-amber-\${uniqueId})\` : \`url(#grad-green-\${uniqueId})\`}
                className="transition-all duration-1000 ease-out"
              />
              <circle cx={cx} cy={cy} r={isExpanded ? 6 : 4} className="fill-neutral-900 dark:fill-white" />
            </g>
          </svg>
          <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none" style={{ top: isExpanded ? '55%' : '45%' }}>
            <span className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white">
              {formatNumber(rawVal)}
            </span>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between w-full max-w-[200px] text-[10px] font-bold text-neutral-400">
          <span>Min: {min}</span>
          <span className="text-emerald-500 font-black">Alvo: {target}</span>
          <span>Max: {scaleEnd}</span>
        </div>
      </div>
    )
  }

  // ── Renderizador de KPI ──
  const renderKpi = (val: any, widget: AnalyticsWidget, isExpanded = false) => {
    if (Array.isArray(val)) {
      return (
        <div className="grid grid-cols-2 gap-3 p-2 max-h-[280px] overflow-y-auto custom-scrollbar">
          {val.map((item, idx) => (
            <div key={idx} className="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-2xl border border-neutral-100 dark:border-neutral-800">
              <span className="text-[10px] font-black uppercase text-neutral-400 block truncate">{item.name}</span>
              <span className="text-xl font-black text-neutral-900 dark:text-white mt-1 block">
                {typeof item.value === 'number' && widget.field?.toLowerCase().includes('preco') ? formatCurrency(item.value) : formatNumber(item.value)}
              </span>
            </div>
          ))}
        </div>
      )
    }

    const num = Number(val)
    const formatted = !isNaN(num) && widget.field?.toLowerCase().includes('preco') ? formatCurrency(num) : formatNumber(num)

    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <span className={\`font-black tracking-tight text-neutral-900 dark:text-white transition-all \${
          isExpanded ? 'text-7xl' : 'text-5xl sm:text-6xl'
        }\`}>
          {formatted}
        </span>
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-black tracking-wider uppercase">
          <Activity className="w-3 h-3" />
          {widget.calc} {widget.field ? \`/ \${widget.field.split('.').pop()}\` : ''}
        </div>
      </div>
    )
  }

  // ── Renderizador de Gráficos (Bar, Line, Pie) ──
  const renderChartContent = (widget: AnalyticsWidget, isExpanded = false) => {
    const data = aggregatedData[widget.id]
    if (data === undefined || data === null) {
      return <div className="flex-1 flex items-center justify-center text-xs font-bold text-neutral-400">Sem dados disponíveis</div>
    }

    if (widget.type === 'kpi') return renderKpi(data, widget, isExpanded)
    if (widget.type === 'gauge') return renderGauge(data, widget, isExpanded)

    const chartData = Array.isArray(data) ? data : []
    const height = isExpanded ? 400 : 220

    if (chartData.length === 0) {
      return <div className="flex-1 flex items-center justify-center text-xs font-bold text-neutral-400">Nenhum registro para o período</div>
    }

    return (
      <div className="w-full mt-2" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {widget.type === 'bar' ? (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#888888' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#888888' }} tickFormatter={formatNumber} />
              <Tooltip
                cursor={{ fill: '#88888810' }}
                contentStyle={{ borderRadius: '1rem', border: '1px solid #ffffff20', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', backgroundColor: '#18181b', color: '#fff' }}
                formatter={(value: any) => [formatNumber(value), widget.calc]}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
            </BarChart>
          ) : widget.type === 'line' ? (
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#888888' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#888888' }} tickFormatter={formatNumber} />
              <Tooltip
                contentStyle={{ borderRadius: '1rem', border: '1px solid #ffffff20', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', backgroundColor: '#18181b', color: '#fff' }}
                formatter={(value: any) => [formatNumber(value), widget.calc]}
              />
              <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
            </LineChart>
          ) : (
            <PieChart>
              <Pie
                data={chartData}
                innerRadius={height * 0.24}
                outerRadius={height * 0.36}
                paddingAngle={4}
                dataKey="value"
              >
                {chartData.map((_, index) => (
                  <Cell key={\`cell-\${index}\`} fill={PALETTE[index % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: '1rem', border: '1px solid #ffffff20', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', backgroundColor: '#18181b', color: '#fff' }}
                formatter={(value: any) => [formatNumber(value), widget.calc]}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    )
  }

  const getColSpanClass = (width?: string) => {
    if (width === 'full') return 'col-span-12'
    if (width === 'half') return 'col-span-12 lg:col-span-6'
    if (width === 'quarter') return 'col-span-12 sm:col-span-6 lg:col-span-3'
    return 'col-span-12 sm:col-span-6 lg:col-span-4'
  }

  if (!mounted) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded-xl w-48" />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-4 h-64 bg-neutral-100 dark:bg-neutral-800/40 rounded-[2.5rem]" />
          <div className="col-span-12 lg:col-span-4 h-64 bg-neutral-100 dark:bg-neutral-800/40 rounded-[2.5rem]" />
          <div className="col-span-12 lg:col-span-4 h-64 bg-neutral-100 dark:bg-neutral-800/40 rounded-[2.5rem]" />
        </div>
      </div>
    )
  }

  const expandedWidget = widgets.find(w => w.id === expandedWidgetId)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Subheader da Seção de Indicadores de Desempenho (Fiel à Web Produção) */}
      <div className="flex justify-between items-center px-2">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-neutral-400">
          Indicadores de Desempenho
        </h2>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
              isEditMode
                ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/40 scale-105"
                : "bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 shadow-sm active:scale-95"
            )}
          >
            <MousePointer2 className="w-3.5 h-3.5" />
            {isEditMode ? 'Salvar Layout' : 'Organizar Dashboard'}
          </button>

          <div className="flex items-center bg-white dark:bg-neutral-900 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800 hidden md:flex">
            {scales.map(s => (
              <button
                key={s.value}
                onClick={() => setScale(s.value)}
                title={s.label}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  scale === s.value
                    ? "bg-neutral-100 dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                )}
              >
                {s.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de Widgets */}
      <div className="grid grid-cols-12 gap-6" style={{ zoom: scale }}>
        {widgets.map(w => {
          const colSpan = getColSpanClass(w.width)
          const iconType =
            w.type === 'kpi' ? <Activity className="w-4 h-4 text-indigo-500" /> :
            w.type === 'gauge' ? <GaugeIcon className="w-4 h-4 text-cyan-500" /> :
            w.type === 'line' ? <TrendingUp className="w-4 h-4 text-amber-500" /> :
            w.type === 'pie' ? <PieChartIcon className="w-4 h-4 text-pink-500" /> :
            <BarChart3 className="w-4 h-4 text-indigo-500" />

          return (
            <div
              key={w.id}
              className={cn(
                colSpan,
                "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] p-6 flex flex-col justify-between shadow-sm hover:shadow-xl hover:border-indigo-500/30 transition-all group relative overflow-hidden min-h-[340px]"
              )}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none group-hover:bg-indigo-500/10 transition-all" />

              <div className="flex items-center justify-between mb-2 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-2xl">
                    {iconType}
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white">
                      {w.title}
                    </h3>
                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-tight">
                      {w.calc} {w.field ? \`(\${w.field.split('.').pop()})\` : ''}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setExpandedWidgetId(w.id)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-indigo-600 transition-all"
                  title="Expandir"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 flex flex-col justify-center relative z-10">
                {renderChartContent(w)}
              </div>
            </div>
          )
        })}

        {/* Card Novo Indicador (Fiel à Web Produção) */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-4 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] flex flex-col items-center justify-center p-8 text-neutral-400 hover:text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-all min-h-[340px] cursor-pointer group">
          <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-md shadow-neutral-500/5">
            <Plus className="w-6 h-6" />
          </div>
          <div className="text-center">
            <span className="text-xs font-black uppercase tracking-widest block text-neutral-600 dark:text-neutral-300 group-hover:text-indigo-600 transition-colors">
              Novo Indicador
            </span>
            <span className="text-[10px] font-bold text-neutral-400 mt-0.5 block">
              Expandir Dashboard
            </span>
          </div>
        </div>
      </div>

      {/* Modal de Widget Expandido */}
      {expandedWidget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[3rem] p-8 max-w-4xl w-full shadow-2xl relative">
            <button
              onClick={() => setExpandedWidgetId(null)}
              className="absolute top-6 right-6 p-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 rounded-2xl transition-all"
            >
              <Minimize2 className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <h2 className="text-lg font-black uppercase tracking-wider text-neutral-900 dark:text-white">
                {expandedWidget.title}
              </h2>
              <p className="text-xs font-bold text-neutral-400 uppercase">
                {expandedWidget.calc} — {expandedWidget.field || 'Tabela Geral'}
              </p>
            </div>

            <div className="min-h-[400px] flex items-center justify-center">
              {renderChartContent(expandedWidget, true)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
`
}
