import { RouteNode, AppAST, AnalyticsWidget } from '../../ast'

// ─────────────────────────────────────────────────────────────────────────────
// Analytics / Dashboard BI Page Generator (Server-Side Aggregation)
// ─────────────────────────────────────────────────────────────────────────────

export function generateAnalyticsPage(route: RouteNode, ast: AppAST): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const widgets = route.analyticsConfig?.widgets || []

  // 1. Identifica todos os modelos necessários para os widgets e joins
  const referencedTables = new Set<string>()

  // Tabelas referenciadas nas expressões dos widgets
  widgets.forEach(w => {
    if (w.modelId && w.modelId !== route.modelId) {
      const m = ast.models.find(mod => mod.id === w.modelId)
      if (m) referencedTables.add(m.dbTable.toLowerCase())
    }
    if (w.field && typeof w.field === 'string') {
      const matches = w.field.match(/[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+/g)
      if (matches) {
        matches.forEach(match => referencedTables.add(match.split('.')[0].toLowerCase()))
      }
    }
    if (w.groupBy && typeof w.groupBy === 'string' && w.groupBy.includes('.')) {
      referencedTables.add(w.groupBy.split('.')[0].toLowerCase())
    }
  })

  // Tabelas nos joins declarados no layout_config
  const rawJoins: Array<{ from: string; to: string; localKey?: string; foreignKey?: string }> =
    route.rawLayoutConfig?.joins || []

  rawJoins.forEach(j => {
    if (j.from) referencedTables.add(j.from.toLowerCase())
    if (j.to) referencedTables.add(j.to.toLowerCase())
  })

  // Remove a tabela mestre da lista de lookups adicionais
  referencedTables.delete(route.modelTable.toLowerCase())

  // Mapeia tabela -> ModelNode
  const relatedModels: Array<{ table: string; modelName: string }> = []
  for (const tbl of Array.from(referencedTables)) {
    const found = ast.models.find(m => m.dbTable.toLowerCase() === tbl)
    if (found) {
      relatedModels.push({ table: tbl, modelName: found.name })
    }
  }

  // Gera imports das actions
  const relatedImports = relatedModels
    .map(rm => `import { get${rm.modelName}List } from '@/app/actions/${rm.modelName.toLowerCase()}'`)
    .join('\n')

  // Gera destructuring do Promise.all para fetch paralelo
  const allFetchNames = [
    `masterRawData`,
    ...relatedModels.map(rm => `${rm.table.replace(/[^a-zA-Z0-9_]/g, '_')}Data`),
  ]

  // Campo de data declarado explicitamente no analytics_config (fallback: heurística)
  const dateFilterField = route.analyticsConfig?.dateFilterField ?? null

  // Master fetch: injeta opts de pushdown quando dateFilterField está declarado.
  // As tabelas relacionadas (lookups) nunca recebem filtro — são pequenas por natureza.
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

  // Filtro de data:
  //  - dateFilterField declarado → DB já filtrou via pushdown → filteredRows = denormalizedRows (sem custo JS)
  //  - sem dateFilterField       → heurística JS por nome de coluna como fallback
  const filteredRowsCode = dateFilterField
    ? `  // Filtro de data aplicado no banco via pushdown — sem re-filtro JS necessário.\n  const filteredRows = denormalizedRows`
    : `  // Sem dateFilterField declarado: aplica heurística JS como fallback.\n  // NOTA DE ESCALA: declare analytics_config.dateFilterField para pushdown automático no banco.\n  const filteredRows = denormalizedRows.filter(row => {\n    if (!startDate && !endDate) return true\n    const dateKey = Object.keys(row).find(k => {\n      const kl = k.toLowerCase()\n      return (kl.includes('data') || kl.includes('date') || kl.includes('created')) &&\n        !isNaN(new Date(row[k]).getTime())\n    }) ?? null\n    if (!dateKey) return true\n    const rowDate = new Date(row[dateKey]).getTime()\n    if (isNaN(rowDate)) return true\n    if (startDate && rowDate < new Date(startDate).getTime()) return false\n    if (endDate && rowDate > new Date(endDate + 'T23:59:59').getTime()) return false\n    return true\n  })`

  const widgetsJson = JSON.stringify(widgets, null, 2)
  const joinsJson = JSON.stringify(rawJoins, null, 2)

  return `import type { Metadata } from 'next'
import { get${mn}List } from '@/app/actions/${mnLower}'
${relatedImports}
import { AnalyticsClient } from './AnalyticsClient'

export const metadata: Metadata = { title: '${route.title || 'Dashboard Analítico'}' }

// Configuração estática dos widgets
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
    if (kLow === target || kLow === shortTarget) return v
    if (kLow.endsWith('.' + shortTarget)) return v
  }
  return undefined
}

/**
 * Avalia uma expressão matemática simples de forma segura.
 * ATENÇÃO: new Function é usado aqui intencionalmente após sanitize estrito.
 * Nunca passe input não-sanitizado para esta função.
 */
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
      if (!key) continue
      const val = Number(row[key]) || 0
      const escaped = key.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&')
      expr = expr.replace(new RegExp(escaped, 'gi'), String(val))
    }

    for (const key of sortedKeys) {
      const short = key.includes('.') ? key.split('.').pop()! : key
      if (!short) continue
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
  if (!joins || joins.length === 0) {
    return masterData.map(r => ({ ...r }))
  }

  // Identifica relações 1:N (tabelas filhas como itens_pedido)
  const oneToManyJoins = joins.filter(j => {
    const childTable = j.to.toLowerCase()
    const parentTable = j.from.toLowerCase()
    const childFk = (j.foreignKey || '').toLowerCase()
    return childFk.includes(parentTable) || childFk.endsWith('_id')
  })

  // Identifica relações N:1 (lookups como funcionarios, clientes)
  const manyToOneJoins = joins.filter(j => !oneToManyJoins.includes(j))

  const results: any[] = []

  for (const masterRow of masterData) {
    const baseRow: Record<string, any> = { ...masterRow }

    // Prefixar colunas com o nome da tabela principal
    for (const [k, v] of Object.entries(masterRow)) {
      baseRow[\`\${masterTable}.\${k}\`] = v
    }

    // Resolver lookups N:1 (ex: pedido -> funcionario, cliente)
    for (const j of manyToOneJoins) {
      const lookupTbl = (j.from.toLowerCase() === masterTable ? j.to : j.from).toLowerCase()
      const lookupData = tablesData[lookupTbl] || []
      const localKey = j.localKey || 'id'
      const fk = j.foreignKey || \`\${lookupTbl}_id\`

      const localVal = masterRow[fk] ?? masterRow[localKey]
      const match = lookupData.find(item => String(item.id ?? item[localKey]) === String(localVal))
      if (match) {
        for (const [k, v] of Object.entries(match)) {
          baseRow[\`\${lookupTbl}.\${k}\`] = v
          if (baseRow[k] === undefined) baseRow[k] = v
        }
      }
    }

    // Resolver 1:N (ex: pedido -> itens_pedido)
    let hasOneToMany = false
    for (const j of oneToManyJoins) {
      const childTbl = j.to.toLowerCase()
      const childData = tablesData[childTbl] || []
      const childFk = j.foreignKey || \`\${masterTable}_id\`
      const masterPk = j.localKey || 'id'
      const masterPkVal = masterRow[masterPk] ?? masterRow.id

      const childItems = childData.filter(item => String(item[childFk]) === String(masterPkVal))
      if (childItems.length > 0) {
        hasOneToMany = true
        for (const childItem of childItems) {
          const flatRow = { ...baseRow, ...childItem }
          for (const [k, v] of Object.entries(childItem)) {
            flatRow[\`\${childTbl}.\${k}\`] = v
          }
          results.push(flatRow)
        }
      }
    }

    if (!hasOneToMany) {
      results.push(baseRow)
    }
  }

  return results.length > 0 ? results : masterData
}

function calculateWidgetData(widget: AnalyticsWidget, rows: Record<string, any>[]): number | Array<{ name: string; value: number }> {
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
  const groupBy = widget.groupBy || ''
  const groups: Record<string, { value: number; count: number }> = {}

  for (const row of rows) {
    const rawGroupVal = getRowField(row, groupBy)
    const groupKey = widget.dateGranularity
      ? formatDateGranularity(rawGroupVal, widget.dateGranularity)
      : String(rawGroupVal ?? 'N/A')

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

// ─────────────────────────────────────────────────────────────────────────────
// Page Server Component
// ─────────────────────────────────────────────────────────────────────────────

export default async function ${mn}AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const params = await searchParams
  const startDate = params?.start_date
  const endDate = params?.end_date

  // Busca paralela dos dados no banco via Server Actions (Promise.all evita sequencialidade)
${parallelFetch}

  const tablesData: Record<string, any[]> = {
    '${route.modelTable.toLowerCase()}': masterRawData || [],
${tablesDataEntries}
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
    aggregatedData[widget.id] = calculateWidgetData(widget, filteredRows)
  }

  return (
    <AnalyticsClient
      title="${route.title || 'Dashboard'}"
      icon="${route.icon || 'BarChart3'}"
      widgets={WIDGETS as any}
      aggregatedData={aggregatedData}
      startDate={startDate}
      endDate={endDate}
      totalRowsAnalyzed={filteredRows.length}
    />
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
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
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
  Calendar,
  Filter,
  RotateCcw,
  Maximize2,
  Minimize2,
  Database,
  ArrowUpRight,
} from 'lucide-react'
import { DynamicIcon } from '@/app/components/DynamicIcon'

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
  startDate?: string
  endDate?: string
  totalRowsAnalyzed: number
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

export function AnalyticsClient({
  title,
  icon = 'BarChart3',
  widgets,
  aggregatedData,
  startDate = '',
  endDate = '',
  totalRowsAnalyzed,
}: AnalyticsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [mounted, setMounted] = useState(false)
  const [localStartDate, setLocalStartDate] = useState(startDate)
  const [localEndDate, setLocalEndDate] = useState(endDate)
  const [expandedWidgetId, setExpandedWidgetId] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const applyDateFilter = (start?: string, end?: string) => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : '')
    if (start) params.set('start_date', start)
    else params.delete('start_date')

    if (end) params.set('end_date', end)
    else params.delete('end_date')

    router.push(pathname + '?' + params.toString())
  }

  const clearFilters = () => {
    setLocalStartDate('')
    setLocalEndDate('')
    router.push(pathname)
  }

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
    const height = isExpanded ? 400 : 250

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
                innerRadius={height * 0.22}
                outerRadius={height * 0.35}
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
    return 'col-span-12 sm:col-span-6 lg:col-span-4' // 'third' padrão
  }

  if (!mounted) {
    return (
      <div className="p-6 sm:p-10 max-w-[1600px] mx-auto space-y-8 animate-pulse">
        <div className="h-12 bg-neutral-200 dark:bg-neutral-800 rounded-2xl w-1/3" />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-6 h-64 bg-neutral-100 dark:bg-neutral-800/40 rounded-[2.5rem]" />
          <div className="col-span-12 lg:col-span-6 h-64 bg-neutral-100 dark:bg-neutral-800/40 rounded-[2.5rem]" />
        </div>
      </div>
    )
  }

  const expandedWidget = widgets.find(w => w.id === expandedWidgetId)

  return (
    <div className="p-6 sm:p-10 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header com Título e Barra de Filtros */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20 shrink-0">
            <DynamicIcon icon={icon} size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
              {title}
            </h1>
            <p className="text-xs font-bold text-neutral-400 mt-0.5 flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-indigo-500" />
              {totalRowsAnalyzed} registros analisados via Server-Side Aggregation
            </p>
          </div>
        </div>

        {/* Filtros de Data Globais */}
        <div className="flex flex-wrap items-center gap-3 bg-neutral-50 dark:bg-neutral-900/60 p-2.5 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-neutral-400 ml-1" />
            <input
              type="date"
              value={localStartDate}
              onChange={e => setLocalStartDate(e.target.value)}
              className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-1.5 text-xs font-bold text-neutral-900 dark:text-white outline-none focus:border-indigo-500 shadow-sm"
              placeholder="Data Inicial"
            />
            <span className="text-neutral-400 text-xs font-bold">até</span>
            <input
              type="date"
              value={localEndDate}
              onChange={e => setLocalEndDate(e.target.value)}
              className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-1.5 text-xs font-bold text-neutral-900 dark:text-white outline-none focus:border-indigo-500 shadow-sm"
              placeholder="Data Final"
            />
          </div>

          <button
            onClick={() => applyDateFilter(localStartDate, localEndDate)}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/20 active:scale-95 flex items-center gap-1.5"
          >
            <Filter className="w-3.5 h-3.5" />
            Filtrar
          </button>

          {(startDate || endDate) && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 bg-white dark:bg-neutral-800 hover:bg-neutral-100 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1"
              title="Limpar Filtros"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Grid de Widgets */}
      {widgets.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] shadow-sm">
          <BarChart3 className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <h3 className="text-sm font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
            Nenhum indicador configurado
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            Configure widgets no Studio para visualizar gráficos e métricas neste dashboard.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
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
                className={\`\${colSpan} bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] p-6 flex flex-col justify-between shadow-sm hover:shadow-xl hover:border-indigo-500/30 transition-all group relative overflow-hidden\`}
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
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100"
                    title="Expandir"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 flex flex-col justify-center relative z-10">
                  {renderChartContent(w)}
                </div>
              </div>
            )
          })}
        </div>
      )}

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
