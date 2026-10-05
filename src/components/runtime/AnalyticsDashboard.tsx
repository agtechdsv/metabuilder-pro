'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { getPkColumn, warnInferredReference } from '@/lib/schemaResolver'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area, LabelList
} from 'recharts'
import { 
  TrendingUp, Users, DollarSign, Activity, Loader2, 
  AlertCircle, ChevronDown, Plus, Pencil, Trash2, Maximize2, Minimize2, ZoomIn, LayoutGrid, Gauge,
  GripVertical, MousePointer2, Save, Search, BarChart3
} from 'lucide-react'
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'
import { resolveRelations, resolveAllJoins, buildJoinSql, extractTableNames } from '@/lib/relationPathFinder'

interface Widget {
  id: string
  title: string
  type: 'kpi' | 'bar' | 'pie' | 'line' | 'gauge' | 'area'
  model_id: string
  model_name?: string
  field: string
  field_id?: string
  calc: 'COUNT' | 'COUNT_DISTINCT' | 'SUM' | 'AVG' | 'MIN' | 'MAX'
  group_by?: string
  width: 'full' | 'half' | 'third' | 'quarter'
  joins?: any[]
  gauge_min?: number
  gauge_max?: number
  gauge_target?: number
  gauge_start?: number
  gauge_end?: number
  use_formula?: boolean
  date_granularity?: string
  sort_by?: string
  limit_top_n?: number
  // aparência
  format?: string
  decimals?: number
  currency?: string
  color?: string
  show_labels?: boolean
  highlight_max?: boolean
  orientation?: 'vertical' | 'horizontal'
  stacked?: boolean
  // Fase 2
  /** filtros do widget, com operador (campo = "coluna" ou "tabela.coluna") */
  conditions?: { field: string; op: string; value?: string; value2?: string }[]
  /** segunda dimensão (série) para barras/linhas/área */
  series_by?: string
  /** métrica derivada: valor = (calc/field) ÷ (divide_by.calc/divide_by.field) */
  divide_by?: { calc: string; field?: string }
  /** campo de data que recebe o filtro de período do painel */
  period_field?: string
  /** de onde vem o período do widget: barra do painel (padrão), período fixo ou seletor próprio no card */
  period_mode?: 'panel' | 'fixed' | 'own'
  period_fixed?: string
}

interface AnalyticsDashboardProps {
  config: {
    widgets: Widget[]
    allow_runtime_edit?: boolean
  }
  project: any
  joins?: any[]
  filters?: Record<string, string>
  onEditWidget?: (widget: Widget) => void
  onAddWidget?: () => void
  onDeleteWidget?: (id: string) => void
  onSaveLayout?: (newWidgets: Widget[]) => void
  tunnelChannel?: any
  isTunnelReady?: boolean
  projectRelations?: any[]
}

import { compileFormula, parseFormulaAst } from '@/lib/bi/safeFormula'
import { formatBiValue, biPrimaryColor } from '@/lib/bi/format'
import { biFieldKind } from '@/lib/bi/columnKind'
import { PERIOD_PRESETS, resolvePeriod, formatPeriodDay, type PeriodRange } from '@/lib/bi/period'
import { buildAggregateQuery, filterConditionSql, type BiCondition, type BiColKind, type BiConditionOp } from '@/lib/bi/queryBuilder'

const BI_ROW_LIMIT = 1000
const BI_MAX_GROUPS = 2000
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4']

export default function AnalyticsDashboard({ 
  config, 
  project, 
  joins = [], 
  filters = {}, 
  onEditWidget, 
  onAddWidget, 
  onDeleteWidget,
  onSaveLayout,
  tunnelChannel,
  isTunnelReady,
  projectRelations = []
}: AnalyticsDashboardProps) {
  const [data, setData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  // widgets cuja consulta atingiu o limite de linhas: os totais podem estar incompletos
  const [truncated, setTruncated] = useState<Record<string, boolean>>({})
  // dados em colunas por série (2ª dimensão): { rows: [{ name, <serie>: valor }], keys: [serie...] }
  const [seriesData, setSeriesData] = useState<Record<string, { rows: any[]; keys: string[] }>>({})
  // período do painel: aplicado aos widgets que têm "campo de data do período"
  const [period, setPeriod] = useState<{ preset: string; from: string; to: string }>({ preset: 'all', from: '', to: '' })
  const [expandedGaugeId, setExpandedGaugeId] = useState<string | null>(null)
  const [expandedWidgetId, setExpandedWidgetId] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [localWidgets, setLocalWidgets] = useState(config.widgets || [])

  // Sincroniza widgets locais quando a config mudar (ex: após load inicial)
  useEffect(() => {
    if (config.widgets) {
      setLocalWidgets(config.widgets)
    }
  }, [config.widgets])
  
  const { t, language } = useI18n()

  const [scale, setScale] = useState(1.0)
  const scales = [
    { value: 0.8, icon: <Minimize2 className="w-3.5 h-3.5" />, label: t('runtime.scale_small', 'Pequeno') },
    { value: 1.0, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: t('runtime.scale_normal', 'Normal') },
    { value: 1.2, icon: <Maximize2 className="w-3.5 h-3.5" />, label: t('runtime.scale_large', 'Grande') },
    { value: 1.5, icon: <ZoomIn className="w-3.5 h-3.5" />, label: t('runtime.scale_xl', 'Extra Grande') }
  ]

  // Tooltips do recharts usam estilo inline: acompanham o tema escuro por estado
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const read = () => setIsDark(document.documentElement.classList.contains('dark'))
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const periodRange = useMemo(() => resolvePeriod(period.preset, { from: period.from, to: period.to }), [period])
  // seletor próprio dos widgets em modo "own": { widgetId: { preset, from, to } }
  const [ownPeriods, setOwnPeriods] = useState<Record<string, { preset: string; from: string; to: string }>>({})
  // período efetivo de um widget: da barra do painel, fixo ou do seletor do próprio card
  const widgetPeriod = (w: Widget): PeriodRange | null => {
    if (!w.period_field) return null
    const mode = w.period_mode || 'panel'
    if (mode === 'fixed') return resolvePeriod(w.period_fixed || 'month')
    if (mode === 'own') {
      const o = ownPeriods[w.id]
      return o ? resolvePeriod(o.preset, { from: o.from, to: o.to }) : null
    }
    return periodRange
  }
  const nextDay = (d: string) => {
    const [y, m, dd] = d.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10)
  }
  // a barra do painel só vale para widgets em modo "segue o painel"
  const followsPanel = (w: Widget) => !!w.period_field && (w.period_mode || 'panel') === 'panel'
  const hasPeriodWidgets = localWidgets.some(followsPanel)
  const periodWidgetCount = localWidgets.filter(followsPanel).length
  const fmtDay = formatPeriodDay

  const biLocale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR'
  const fmt = (val: any, widget: Widget, axis = false) =>
    formatBiValue(val, { format: widget.format, decimals: widget.decimals, currency: widget.currency, locale: biLocale }, axis)
  const tooltipStyle = {
    borderRadius: '12px',
    border: 'none',
    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
    background: isDark ? '#18181b' : '#ffffff',
    color: isDark ? '#fafafa' : '#171717',
  }

  const formatNumber = (val: any) => {
    if (val === null || val === undefined) return ''
    const num = Number(val)
    if (isNaN(num)) return String(val)
    const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR'
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(num)
  }

  // Mapeia IDs de widgets para evitar loops de refresh infinitos
  const lastQueryIds = useRef<Record<string, string>>({})
  // assinatura (config + filtros + período) da última busca de cada widget: evita recarregar o que não mudou
  const fetchedSig = useRef<Record<string, string>>({})
  // 'agg' = SQL já agregado no banco; 'raw' = linhas cruas agregadas aqui (caminho antigo, usado como reserva)
  const queryModes = useRef<Record<string, 'agg' | 'raw'>>({})
  // sempre aponta para a versão mais recente de fetchWidgetData (o listener do canal guarda uma versão antiga)
  const fetchWidgetDataRef = useRef<((widget: Widget, opts?: { legacy?: boolean; reason?: string }) => Promise<void>) | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setLocalWidgets((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  // Refs para evitar re-subscrições desnecessárias
  const widgetsRef = useRef<Widget[]>([])
  useEffect(() => {
    widgetsRef.current = localWidgets
  }, [localWidgets])

  // Listener centralizado (SQL_RESULT) usando o canal do PAI
  useEffect(() => {
    if (!tunnelChannel || !isTunnelReady) return
    

    const handleSqlResult = (payload: any) => {
      const qId = payload.payload?.queryId
      if (!qId) return

      const widgetId = Object.keys(lastQueryIds.current).find(id => lastQueryIds.current[id] === qId)
      if (!widgetId) return

      const widget = widgetsRef.current.find(w => w.id === widgetId)
      if (!widget) return

      const queryMode = queryModes.current[qId]
      delete queryModes.current[qId]
      if (queryMode === 'agg') {
        if (payload.payload.success) {
          processAggRows(widget, payload.payload.data)
        } else {
          // o SQL agregado falhou (dialeto, tipo de coluna...): refaz pelo caminho antigo, com linhas cruas
          console.warn('[BI] consulta agregada falhou, usando o caminho alternativo:', payload.payload.error)
          fetchWidgetDataRef.current?.(widget, { legacy: true, reason: payload.payload.error })
          return
        }
        setLoading(prev => ({ ...prev, [widget.id]: false }))
        return
      }

      if (payload.payload.success) {
        const records = payload.payload.data
        setTruncated(prev => ({ ...prev, [widget.id]: Array.isArray(records) && records.length >= BI_ROW_LIMIT }))
        const model = (project as any).models?.find((m: any) => String(m.id) === String(widget.model_id))
        const tableName = model?.db_table_name || (typeof widget.model_id === 'string' && widget.model_id !== 'undefined' && !widget.model_id.includes('-') ? widget.model_id : null)
        const isFormula = (widget as any).use_formula || (widget.field?.includes('*') || widget.field?.includes('+') || widget.field?.includes('/') || widget.field?.includes('-'))
        const formula = widget.field || '*'
        
        processWidgetData(widget, records, isFormula, formula, tableName)
      } else {
        setErrors(prev => ({ ...prev, [widget.id]: payload.payload.error || 'Erro ao buscar dados' }))
      }
      setLoading(prev => ({ ...prev, [widget.id]: false }))
    }

    tunnelChannel.on('broadcast', { event: 'sql_result' }, handleSqlResult)

    return () => {
      const bindings = tunnelChannel.bindings?.broadcast
      if (Array.isArray(bindings)) {
        const binding = bindings.find((b: any) => b.callback === handleSqlResult)
        if (binding) {
          if (tunnelChannel.channelAdapter) {
            tunnelChannel.channelAdapter.off('broadcast', binding.ref)
          }
          tunnelChannel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleSqlResult)
        }
      }
    }

    // O pai cuida da subscrição, nós só ouvimos.
  }, [tunnelChannel, isTunnelReady])

  useEffect(() => {
    if (!isTunnelReady) { fetchedSig.current = {}; return }
    if (localWidgets.length === 0) return

    const handler = setTimeout(() => {
      localWidgets.forEach(widget => {
        // Só busca de novo o que mudou para este widget: configuração, filtros da tela e (se ele usa) o período.
        // Antes, trocar o período recarregava todos os widgets do painel.
        const sig = JSON.stringify({ w: widget, f: filters, p: widgetPeriod(widget) })
        if (fetchedSig.current[widget.id] === sig) return
        fetchedSig.current[widget.id] = sig
        fetchWidgetData(widget)
      })
    }, 400) // Debounce de 400ms para evitar chamadas excessivas durante a digitação

    return () => clearTimeout(handler)
  }, [isTunnelReady, localWidgets, filters, periodRange, ownPeriods])

  const fetchWidgetData = async (widget: Widget, opts: { legacy?: boolean; reason?: string } = {}) => {
    if (!tunnelChannel || !isTunnelReady) {
      return
    }

    const queryId = crypto.randomUUID()
    const topicName = `tunnel:${project.id}`
    
    // Registra este queryId como o último enviado por este widget
    lastQueryIds.current[widget.id] = queryId

    setLoading(prev => ({ ...prev, [widget.id]: true }))
    setErrors(prev => ({ ...prev, [widget.id]: '' }))

    const model = (project as any).models?.find((m: any) => String(m.id) === String(widget.model_id))
    const tableName = model?.db_table_name || (typeof widget.model_id === 'string' && widget.model_id !== 'undefined' && !widget.model_id.includes('-') ? widget.model_id : null)
    // Resolve o schema real da tabela a partir dos models do projeto
    const schemaName = model?.db_schema_name || (project as any)?.slug || 'public'

    if (!tableName) {
      setErrors(prev => ({ ...prev, [widget.id]: 'Tabela não encontrada' }))
      setLoading(prev => ({ ...prev, [widget.id]: false }))
      return
    }

    // Todo campo do widget é "TABELA.COLUNA": sem o nome da tabela, uma coluna repetida (STATUS, NOME...) poderia vir de qualquer tabela
    {
      const isF = (widget as any).use_formula
      const unqualified: string[] = []
      const check = (label: string, v?: string) => { if (v && !String(v).includes('.')) unqualified.push(`${label} ("${v}")`) }
      check('Agrupar por', widget.group_by)
      if (!isF && widget.field && widget.field !== '*') check('Campo do valor', widget.field)
      check('Segmentar por', widget.series_by)
      check('Divisor', widget.divide_by?.field)
      check('Campo do período', widget.period_field)
      ;(widget.conditions || []).forEach((c, i) => check(`Filtro ${i + 1}`, c.field))
      if (isF && widget.field) {
        const ast = parseFormulaAst(String(widget.field))
        const walk = (n: any): boolean => !n ? false : n.t === 'field' ? !n.table : n.t === 'neg' ? walk(n.a) : n.t === 'bin' ? walk(n.a) || walk(n.b) : n.t === 'fn' ? n.args.some(walk) : false
        if (walk(ast)) unqualified.push('Fórmula')
      }
      if (unqualified.length > 0) {
        setErrors(prev => ({ ...prev, [widget.id]: `Reabra o widget e selecione novamente (sem a tabela do campo): ${unqualified.join(', ')}` }))
        setLoading(prev => ({ ...prev, [widget.id]: false }))
        return
      }
    }

    const isFormula = (widget as any).use_formula || (widget.field?.includes('*') || widget.field?.includes('+') || widget.field?.includes('/') || widget.field?.includes('-'))

    // Build SQL
    let selectStr = '*'
    if (!isFormula && widget.field !== '*') {
      const fieldMeta = model?.fields?.find((f: any) => String(f.id) === String(widget.field))
      selectStr = fieldMeta?.db_column_name || widget.field || '*'
    } else if (isFormula && widget.field) {
      const formulaStr = String(widget.field)
      const matches = formulaStr.match(/[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?/g) || []
      const keywords = ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'TRUE', 'FALSE']
      const cols = matches.filter(m => !keywords.includes(m.toUpperCase()) && isNaN(Number(m)))
      if (cols.length > 0) {
        selectStr = [...new Set(cols)].join(', ')
      }
    }

    let groupCol = widget.group_by
    if (widget.group_by && !selectStr.includes(widget.group_by)) {
        const allModels = Array.isArray(project.models) ? project.models : Object.values(project.models || {})
        const parts = widget.group_by.split('.')
        const targetTableName = parts.length > 1 ? parts[0] : null
        const targetFieldName = parts.length > 1 ? parts[1] : widget.group_by

        for (const m of (allModels as any[])) {
          if (targetTableName && m.db_table_name !== targetTableName) continue
          const fields = Array.isArray(m.fields) ? m.fields : Object.values(m.fields || {})
          const found = fields.find((f: any) => String(f.id) === String(targetFieldName) || f.db_column_name === targetFieldName || f.name === targetFieldName)
          if (found) {
            groupCol = `${m.db_table_name}.${found.db_column_name}`
            break
          }
        }
        if (typeof groupCol === 'string' && !selectStr.includes(groupCol)) {
          if (selectStr === '*') selectStr = groupCol
          else selectStr += `, ${groupCol}`
        }
    }

    // Build JOINs using the Santo Graal BFS path-finder
    // Collect all table names referenced by the widget (group_by, field, manual joins)
    const allModels = Array.isArray(project.models) ? project.models : Object.values(project.models || {})
    const resolvedRelations = resolveRelations(projectRelations, allModels as any[])

    // Tables referenced in the query (group_by may reference a foreign table)
    const referencedTables: string[] = []
    
    // Adicionamos as tabelas necessárias pelo Agrupamento resolvido
    if (typeof groupCol === 'string' && groupCol.includes('.')) {
      referencedTables.push(groupCol.split('.')[0])
    }

    if (widget.field && typeof widget.field === 'string') {
      const matches = widget.field.match(/[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+/g)
      if (matches) {
        matches.forEach(m => referencedTables.push(m.split('.')[0]))
      } else if (widget.field.includes('.')) {
        referencedTables.push(widget.field.split('.')[0])
      }
    }
    // Also respect manually configured widget joins (legacy support)
    const legacyJoins = [...(widget.joins || []), ...(joins || [])]
    legacyJoins.forEach((j: any) => {
      const fromModel = (allModels as any[]).find((m: any) => String(m.id) === String(j.from) || m.db_table_name === j.from)
      const toModel = (allModels as any[]).find((m: any) => String(m.id) === String(j.to) || m.db_table_name === j.to)
      if (fromModel?.db_table_name) referencedTables.push(fromModel.db_table_name)
      if (toModel?.db_table_name) referencedTables.push(toModel.db_table_name)
    })

    // Monta os JOINs para um conjunto de tabelas. Chamada duas vezes: com tudo (caminho de linhas cruas, como antes)
    // e só com as tabelas que o widget usa (SQL agregado, para não multiplicar linhas).
    const resolveJoinSql = (referenced: string[], legacy: any[]) => {
    let joinSql = ''
    const joinedTables = new Set<string>([tableName])

    if (resolvedRelations.length > 0 && referenced.length > 0) {
      // Use Santo Graal BFS
      const uniqueReferenced = [...new Set(referenced.filter(t => t !== tableName))]
      const steps = resolveAllJoins(resolvedRelations, tableName, uniqueReferenced)
      joinSql += buildJoinSql(steps)
      steps.forEach(s => { joinedTables.add(s.fromTable); joinedTables.add(s.toTable) })
    }
    
    // Always process legacy just in case
    if (legacy.length > 0) {
      const processJoins = () => {
        let added = false
        legacy.forEach((j: any) => {
          const fromModel = (allModels as any[]).find((m: any) => String(m.id) === String(j.from) || m.db_table_name === j.from)
          const toModel = (allModels as any[]).find((m: any) => String(m.id) === String(j.to) || m.db_table_name === j.to)
          const fromTable = fromModel?.db_table_name || j.from || j.table
          const toTable = toModel?.db_table_name || j.to || j.toTable
          const fromField = fromModel?.fields?.find((f: any) => String(f.id) === String(j.local_field || j.local || j.localKey))?.db_column_name || j.local_field || j.local || j.localKey || getPkColumn(allModels as any[], fromTable) || 'id'
          const toField = toModel?.fields?.find((f: any) => String(f.id) === String(j.foreign_field || j.foreignKey))?.db_column_name || j.foreign_field || j.foreignKey || getPkColumn(allModels as any[], toTable) || 'id'
          if (!fromTable || !toTable) return
          if (joinedTables.has(fromTable) && joinedTables.has(toTable)) return
          if (!joinedTables.has(fromTable) && !joinedTables.has(toTable)) return
          const newTable = joinedTables.has(fromTable) ? toTable : fromTable
          joinSql += ` LEFT JOIN "${newTable}" ON "${fromTable}"."${fromField}" = "${toTable}"."${toField}"`
          joinedTables.add(newTable)
          added = true
        })
        return added
      }
      let iterations = 0
      while (processJoins() && iterations < 10) { iterations++ }
    }

    // Heuristic Auto-Join: If a referenced table is STILL missing, scan models for a foreign key
    const missingTables = referenced.filter(t => !joinedTables.has(t) && t !== tableName)
    missingTables.forEach(refTable => {
       const joinedList = Array.from(joinedTables)
       for (const jt of joinedList) {
          const jtModel = (allModels as any[]).find(m => m.db_table_name === jt)
          if (jtModel) {
             const fields = Array.isArray(jtModel.fields) ? jtModel.fields : Object.values(jtModel.fields || {})
             const isRel = (f: any) => (f.type === 'relation' && (f.relation?.table === refTable || f.relation_table === refTable)) || (!!f.foreign_key_table && String(f.foreign_key_table).toLowerCase() === String(refTable).toLowerCase())
             const isRelByName = (f: any) => f.db_column_name === `${refTable}_id` || f.db_column_name === `${refTable.replace(/s$/, '')}_id`
             const relField = fields.find(isRel) || (() => { const g = fields.find(isRelByName); if (g) warnInferredReference(g.db_column_name, refTable); return g })()
             if (relField) {
                const localCol = relField.db_column_name || 'id'
                const foreignCol = relField.relation?.foreign_field || relField.relation_key || relField.foreign_key_column || getPkColumn(allModels as any[], refTable) || 'id'
                joinSql += ` LEFT JOIN "${refTable}" ON "${jt}"."${localCol}" = "${refTable}"."${foreignCol}"`
                joinedTables.add(refTable)
                break;
             }
          }
          const refModel = (allModels as any[]).find(m => m.db_table_name === refTable)
          if (refModel) {
             const fields = Array.isArray(refModel.fields) ? refModel.fields : Object.values(refModel.fields || {})
             const isRelReverse = (f: any) => (f.type === 'relation' && (f.relation?.table === jt || f.relation_table === jt)) || (!!f.foreign_key_table && String(f.foreign_key_table).toLowerCase() === String(jt).toLowerCase())
             const isRelReverseByName = (f: any) => f.db_column_name === `${jt}_id` || f.db_column_name === `${jt.replace(/s$/, '')}_id`
             const relField = fields.find(isRelReverse) || (() => { const g = fields.find(isRelReverseByName); if (g) warnInferredReference(g.db_column_name, jt); return g })()
             if (relField) {
                const localCol = relField.db_column_name || 'id'
                const foreignCol = relField.relation?.foreign_field || relField.relation_key || relField.foreign_key_column || getPkColumn(allModels as any[], jt) || 'id'
                joinSql += ` LEFT JOIN "${refTable}" ON "${refTable}"."${localCol}" = "${jt}"."${foreignCol}"`
                joinedTables.add(refTable)
                break;
             }
          }
       }
    })

    return { joinSql, joinedTables }
    }
    const { joinSql, joinedTables } = resolveJoinSql(referencedTables, legacyJoins)

    // Final safety net: Remove any columns from selectStr that belong to unjoined tables to prevent crashes
    if (selectStr !== '*') {
      selectStr = selectStr.split(',').filter(s => {
        const col = s.trim()
        if (col === '*') return true
        if (col.includes('.')) {
          const t = col.split('.')[0]
          return joinedTables.has(t) || t === tableName
        }
        return true
      }).join(', ')
    }

    const dbType = (project?.db_type || 'postgres').toLowerCase()
    const dialect: 'postgres' | 'oracle' | null = dbType === 'oracle' ? 'oracle' : (dbType === 'postgres' || dbType === 'postgresql') ? 'postgres' : null

    // Filtros da tela: só entram os que apontam para uma coluna do próprio widget (tabela principal ou com JOIN).
    // Antes todo filtro virava "tabela.coluna ILIKE" e quebrava o SQL quando a coluna não existia ali.
    const columnExists = (table: string, column: string) => {
      const m = (allModels as any[]).find(x => x.db_table_name === table)
      const fs = Array.isArray(m?.fields) ? m.fields : Object.values(m?.fields || {})
      return (fs as any[]).some(f => String(f.db_column_name).toLowerCase() === column.toLowerCase())
    }
    const candidateFilters: { col: { table: string; column: string }; value: string }[] = []
    Object.entries(filters).forEach(([key, val]) => {
      if (!val) return
      // o nome da coluna entra no SQL entre aspas: só identificadores simples (tabela.coluna) são aceitos
      if (!/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(key)) return
      const filterTable = key.includes('.') ? key.split('.')[0] : tableName
      const filterCol = key.includes('.') ? key.split('.')[1] : key
      if (!columnExists(filterTable, filterCol)) return
      candidateFilters.push({ col: { table: filterTable, column: filterCol }, value: String(val) })
    })
    const validFilters = candidateFilters.filter(f => joinedTables.has(f.col.table))

    const sendQuery = (sql: string, mode: 'agg' | 'raw', limit: number) => {
      queryModes.current[queryId] = mode
      // Pequeno delay para garantir que o canal esteja pronto
      setTimeout(() => {
        if (!tunnelChannel || !isTunnelReady) return

        tunnelChannel.send({
          type: 'broadcast',
          event: 'sql_query',
          payload: {
            queryId,
            action: 'select',
            query: sql, // ← 'query' é o campo lido pelo CLI
            sql,        // ← mantido por compatibilidade
            schemaName, // ← campo obrigatório: identifica o schema para o CLI não ignorar
            table: tableName,
            limit,      // ← o CLI só reconhece o limite se vier aqui ou como LIMIT/FETCH NEXT no SQL
            // 'filters' não é enviado: o WHERE já está no SQL e o CLI o acrescentaria de novo depois do LIMIT
            token: project?.secret_token || 'test-token',
            projectId: project.id
          }
        })
      }, 500)
    }

    // Tabelas que o widget realmente usa (grupo, valor, fórmula e filtros) → JOINs mínimos
    const resolveRef = (s: string) => s.includes('.') ? { table: s.split('.')[0], column: s.split('.')[1] } : { table: tableName, column: s }
    const rawField = widget.field && widget.field !== '*' ? String(widget.field) : ''
    const aggFormula = rawField && ((widget as any).use_formula || /[*+/()]/.test(rawField)) ? rawField : null
    let fieldRef: { table: string; column: string } | null = null
    if (rawField && !aggFormula) {
      const fieldMeta = model?.fields?.find((f: any) => String(f.id) === rawField)
      fieldRef = resolveRef(fieldMeta?.db_column_name || rawField)
    }
    const groupRef = typeof groupCol === 'string' && groupCol ? resolveRef(groupCol) : null
    const usedTables = new Set<string>([fieldRef?.table, groupRef?.table].filter(Boolean) as string[])
    if (aggFormula) for (const m of aggFormula.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\.[A-Za-z_][A-Za-z0-9_]*/g)) usedTables.add(m[1])

    // Fase 2: filtros do widget (com operador), período do painel, série, métrica derivada
    const colKind = (table: string, column: string): BiColKind => {
      const m = (allModels as any[]).find(x => x.db_table_name === table)
      const fs = Array.isArray(m?.fields) ? m.fields : Object.values(m?.fields || {})
      const f = (fs as any[]).find(x => String(x.db_column_name).toLowerCase() === column.toLowerCase())
      return biFieldKind(f)
    }
    const conditions: BiCondition[] = []
    ;(widget.conditions || []).forEach(c => {
      if (!c?.field || !c.op) return
      const noValue = c.op === 'is_null' || c.op === 'not_null'
      if (!noValue && (c.value === undefined || c.value === '')) return
      if (c.op === 'between' && (c.value2 === undefined || c.value2 === '')) return
      const ref = resolveRef(String(c.field))
      conditions.push({ col: ref, op: c.op as BiConditionOp, kind: colKind(ref.table, ref.column), value: c.value, value2: c.value2 })
    })
    const wPeriod = widgetPeriod(widget)
    if (widget.period_field && wPeriod) {
      const ref = resolveRef(widget.period_field)
      conditions.push({ col: ref, op: 'gte', kind: 'date', value: wPeriod.from })
      conditions.push({ col: ref, op: 'lt', kind: 'date', value: nextDay(wPeriod.to) })
    }
    const seriesRef = widget.series_by && widget.group_by && ['bar', 'line', 'area'].includes(widget.type) ? resolveRef(widget.series_by) : null
    const divideBy = widget.divide_by?.calc
      ? { calc: widget.divide_by.calc, field: widget.divide_by.field ? resolveRef(widget.divide_by.field) : null }
      : null
    conditions.forEach(c => usedTables.add(c.col.table))
    if (seriesRef) usedTables.add(seriesRef.table)
    if (divideBy?.field) usedTables.add(divideBy.field.table)
    // recursos que só o SQL agregado entrega (o caminho de linhas cruas não os implementa)
    const needsAgg = conditions.length > 0 || !!seriesRef || !!divideBy || widget.calc === 'COUNT_DISTINCT' ||
      widget.date_granularity === 'week' || widget.date_granularity === 'quarter'
    let buildReason = ''

    // JOINs mínimos: só as tabelas que o widget usa (grupo, valor e filtros). Os JOINs do caso de uso inteiro
    // (entregas, projetos, tarefas...) repetiam cada pedido e inflavam SUM/AVG.
    const filterTables = candidateFilters.map(f => f.col.table)
    const minimal = resolveJoinSql([...usedTables, ...filterTables].filter(t => t !== tableName), widget.joins || [])
    const aggFilters = candidateFilters.filter(f => minimal.joinedTables.has(f.col.table))

    const minimalOk = [...usedTables].every(t => minimal.joinedTables.has(t))

    // 1) Caminho novo: o banco agrega (GROUP BY / SUM / COUNT) e devolve só as linhas do gráfico
    if (dialect && !opts.legacy) {
      if (minimalOk) {
        const built = buildAggregateQuery({
          dialect,
          mainTable: tableName,
          mainPk: getPkColumn(allModels as any[], tableName) || 'id',
          joinSql: minimal.joinSql,
          calc: widget.calc,
          formula: aggFormula,
          field: fieldRef,
          groupBy: groupRef,
          granularity: widget.date_granularity,
          sortBy: widget.sort_by,
          limitTopN: widget.limit_top_n,
          filters: aggFilters,
          conditions,
          series: seriesRef,
          divideBy,
          maxGroups: BI_MAX_GROUPS,
        })
        if (built.ok) {
          sendQuery(built.sql, 'agg', BI_MAX_GROUPS + 100)
          return
        }
        buildReason = built.reason
        console.warn('[BI] consulta agregada não aplicável, usando linhas cruas:', built.reason)
      } else {
        buildReason = 'tabela do indicador sem relação com as demais (verifique o caminho de relacionamento)'
      }
    }

    if (needsAgg) {
      const why = opts.reason ? `consulta falhou no banco: ${opts.reason}` : buildReason || 'este indicador exige banco PostgreSQL ou Oracle'
      setErrors(prev => ({ ...prev, [widget.id]: `Não foi possível calcular: ${why}` }))
      setLoading(prev => ({ ...prev, [widget.id]: false }))
      return
    }

    // 2) Caminho de reserva: busca linhas cruas (limitadas) e agrega no navegador
    // Mesmo no caminho de reserva, só junta o necessário quando possível (senão JOINs 1:N repetem as linhas)
    const rawJoinSql = minimalOk ? minimal.joinSql : joinSql
    const rawJoined = minimalOk ? minimal.joinedTables : joinedTables
    const rawFilters = minimalOk ? aggFilters : validFilters
    const whereClause = ['1=1', ...rawFilters.map(f => filterConditionSql(dialect ?? 'other', f))].join(' AND ')
    let sqlSelect = '*'
    if (selectStr !== '*') {
      sqlSelect = selectStr.split(',').filter(s => {
        const col = s.trim()
        return !col.includes('.') || rawJoined.has(col.split('.')[0]) || col.split('.')[0] === tableName
      }).map(s => {
        const col = s.trim()
        if (col === '*') return '*'
        if (col.includes('.')) {
          const p = col.split('.')
          return `"${p[0]}"."${p[1]}"`
        }
        return `"${tableName}"."${col}"`
      }).join(', ')
    }

    const limitSql = dbType === 'oracle' ? `OFFSET 0 ROWS FETCH NEXT ${BI_ROW_LIMIT} ROWS ONLY` : `LIMIT ${BI_ROW_LIMIT}`
    sendQuery(`SELECT ${sqlSelect} FROM "${tableName}"${rawJoinSql} WHERE ${whereClause} ${limitSql}`, 'raw', BI_ROW_LIMIT)
  }

  fetchWidgetDataRef.current = fetchWidgetData

  // Resultado do SQL agregado: já vem pronto como { bi_name, bi_value }
  const processAggRows = (widget: Widget, rows: any[]) => {
    const read = (r: any, k: string) => r?.[k] ?? r?.[k.toUpperCase()] ?? r?.[k.toLowerCase()]
    const toNumber = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

    if (!widget.group_by) {
      const value = toNumber(read(rows?.[0], 'bi_value'))
      const single = widget.type === 'kpi' || widget.type === 'gauge' ? value : [{ name: 'Total', value }]
      setData(prev => ({ ...prev, [widget.id]: single }))
      setTruncated(prev => ({ ...prev, [widget.id]: false }))
      return
    }

    const hasSeries = !!widget.series_by && ['bar', 'line', 'area'].includes(widget.type) && (rows || []).some((r: any) => read(r, 'bi_series') !== undefined)
    if (hasSeries) {
      const label = (v: any) => (v === null || v === undefined || v === '' ? 'N/A' : String(v))
      const byName = new Map<string, Record<string, number>>()
      const seriesTotals = new Map<string, number>()
      for (const r of rows || []) {
        const n = label(read(r, 'bi_name'))
        const sName = label(read(r, 'bi_series'))
        const v = toNumber(read(r, 'bi_value'))
        const cur = byName.get(n) || {}
        cur[sName] = (cur[sName] || 0) + v
        byName.set(n, cur)
        seriesTotals.set(sName, (seriesTotals.get(sName) || 0) + v)
      }
      // até 11 séries; o restante vira "Outros"
      const ordered = [...seriesTotals.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0])
      const keep = ordered.slice(0, 11)
      const others = ordered.slice(11)
      const keys = others.length ? [...keep, 'Outros'] : keep
      let table = [...byName.entries()].map(([name, vals]) => {
        const row: any = { name, value: 0 }
        for (const k of keep) { row[k] = vals[k] || 0 }
        if (others.length) row['Outros'] = others.reduce((a, k) => a + (vals[k] || 0), 0)
        row.value = keys.reduce((a, k) => a + (row[k] || 0), 0)
        return row
      })
      const mode = widget.sort_by || 'value_desc'
      if (mode === 'value_asc') table.sort((a, b) => a.value - b.value)
      else if (mode === 'label_asc') table.sort((a, b) => a.name.localeCompare(b.name))
      else if (mode === 'label_desc') table.sort((a, b) => b.name.localeCompare(a.name))
      else table.sort((a, b) => b.value - a.value)
      if (widget.limit_top_n && widget.limit_top_n > 0) table = table.slice(0, widget.limit_top_n)
      setSeriesData(prev => ({ ...prev, [widget.id]: { rows: table, keys } }))
      setData(prev => ({ ...prev, [widget.id]: table.map(r => ({ name: r.name, value: r.value })) }))
      setTruncated(prev => ({ ...prev, [widget.id]: (rows || []).length >= BI_MAX_GROUPS * 5 }))
      return
    }
    setSeriesData(prev => { if (!prev[widget.id]) return prev; const next = { ...prev }; delete next[widget.id]; return next })

    let finalData = (rows || []).map((r: any) => {
      const name = read(r, 'bi_name')
      return { name: name === null || name === undefined || name === '' ? 'N/A' : String(name), value: toNumber(read(r, 'bi_value')) }
    })

    const sortMode = widget.sort_by || 'value_desc'
    if (sortMode === 'value_asc') finalData.sort((a, b) => a.value - b.value)
    else if (sortMode === 'label_asc') finalData.sort((a, b) => a.name.localeCompare(b.name))
    else if (sortMode === 'label_desc') finalData.sort((a, b) => b.name.localeCompare(a.name))
    else finalData.sort((a, b) => b.value - a.value)
    if (widget.limit_top_n && widget.limit_top_n > 0) finalData = finalData.slice(0, widget.limit_top_n)

    setData(prev => ({ ...prev, [widget.id]: finalData }))
    // mais grupos do que o teto: o gráfico mostra só os maiores
    setTruncated(prev => ({ ...prev, [widget.id]: !widget.limit_top_n && (rows || []).length >= BI_MAX_GROUPS }))
  }

  const processWidgetData = (widget: Widget, records: any[], isFormula: boolean, formula: string, tableName: string) => {
    const model = (project as any).models?.find((m: any) => String(m.id) === String(widget.model_id))
    
    // Identifica o nome da coluna para cálculo
    let fieldName = '*'
    if (!isFormula) {
      const fieldMeta = model?.fields?.find((f: any) => String(f.id) === String(widget.field))
      fieldName = fieldMeta?.db_column_name || widget.field || '*'
      if (fieldName.includes('.')) fieldName = fieldName.split('.')[1]
    }

    const calcFormula = isFormula ? compileFormula(formula) : null

    if (!widget.group_by && (widget.type === 'kpi' || widget.type === 'gauge')) {
      // Bug fix: COUNT sem group_by deve simplesmente contar os registros retornados
      // Não tentar converter campos de texto para Number() pois resulta em NaN -> 0
      if (widget.calc === 'COUNT') {
        setData(prev => ({ ...prev, [widget.id]: records.length }))
        return
      }

      const values = records.map((r) => {
        if (calcFormula) return calcFormula(r)

        let rawVal = r[fieldName];
        if (rawVal === undefined) {
          const keys = Object.keys(r);
          const targetLow = fieldName.toLowerCase();
          const matchingKey = keys.find(k => k.toLowerCase() === targetLow);
          if (matchingKey) rawVal = r[matchingKey];
          else {
            const deepMatch = keys.find(k => k.toLowerCase().includes(targetLow));
            if (deepMatch) rawVal = r[deepMatch];
          }
        }
        // nulo/vazio fica de fora (NaN é filtrado abaixo): Number(null) = 0 puxaria a média para baixo
        if (rawVal === null || rawVal === undefined || rawVal === '') return NaN
        return Number(rawVal)
      }).filter(v => !isNaN(v))

      let result = 0
      if (widget.calc === 'SUM') result = values.reduce((a, b) => a + b, 0)
      if (widget.calc === 'AVG') result = values.reduce((a, b) => a + b, 0) / (values.length || 1)
      if (widget.calc === 'MIN') result = values.length > 0 ? Math.min(...values) : 0
      if (widget.calc === 'MAX') result = values.length > 0 ? Math.max(...values) : 0
      
      setData(prev => ({ ...prev, [widget.id]: result }))
      return
    }

    // Lógica de agrupamento (Charts ou Grouped KPIs)
    const allModels = Array.isArray(project.models) ? project.models : Object.values(project.models || {})
    let groupByFieldMeta = null
    let groupByTableName = tableName
    let resolvedGroupByPath = null

    if (widget.group_by) {
      const parts = widget.group_by.split('.')
      const targetTableName = parts.length > 1 ? parts[0] : null
      const targetFieldName = parts.length > 1 ? parts[1] : widget.group_by

      for (const m of (allModels as any[])) {
        if (targetTableName && m.db_table_name !== targetTableName) continue
        const fields = Array.isArray(m.fields) ? m.fields : Object.values(m.fields || {})
        const found = fields.find((f: any) => String(f.id) === String(targetFieldName) || f.db_column_name === targetFieldName || f.name === targetFieldName)
        if (found) {
          groupByFieldMeta = found
          groupByTableName = m.db_table_name
          resolvedGroupByPath = found.db_column_name
          break
        }
      }
    }

    let groupByPath = resolvedGroupByPath || widget.group_by
    if (groupByPath && groupByPath.includes('.')) {
      groupByPath = groupByPath.split('.')[1]
    }
    
    const grouped = records.reduce((acc: any, curr: any) => {
      let key = 'N/A'
      let rawKey = curr[groupByPath]
      
      if (rawKey === undefined) {
        const keys = Object.keys(curr)
        const targetLow = String(groupByPath).toLowerCase()
        const foundKey = keys.find(k => k.toLowerCase() === targetLow)
        if (foundKey) rawKey = curr[foundKey]
        else {
          const deepKey = keys.find(k => k.toLowerCase().includes(targetLow))
          if (deepKey) rawKey = curr[deepKey]
        }
      }

      if (rawKey && widget.date_granularity) {
         if (typeof rawKey === 'string' && rawKey.match(/^\d{4}-\d{2}-\d{2}/)) {
           const dateMatch = rawKey.match(/^(\d{4})-(\d{2})-(\d{2})/)
           if (dateMatch) {
              const [_, y, m, d] = dateMatch
              if (widget.date_granularity === 'month') rawKey = `${y}-${m}`
              else if (widget.date_granularity === 'year') rawKey = `${y}`
              else if (widget.date_granularity === 'day') rawKey = `${y}-${m}-${d}`
           }
         } else {
           const dObj = new Date(rawKey)
           if (!isNaN(dObj.getTime())) {
              const y = dObj.getFullYear()
              const m = dObj.getMonth() + 1
              const day = dObj.getDate()
              const mStr = m < 10 ? '0' + m : m
              const dStr = day < 10 ? '0' + day : day
              if (widget.date_granularity === 'month') rawKey = `${y}-${mStr}`
              else if (widget.date_granularity === 'year') rawKey = `${y}`
              else if (widget.date_granularity === 'day') rawKey = `${y}-${mStr}-${dStr}`
           }
         }
      }

      key = String(rawKey || 'N/A')
      
      if (!acc[key]) acc[key] = { name: key, value: 0, count: 0 }
      
      let val = 0
      let hasValue = true
      if (calcFormula) {
        val = calcFormula(curr)
      } else {
        let rawVal = curr[fieldName]
        if (rawVal === undefined) {
          const keys = Object.keys(curr)
          const targetLow = fieldName.toLowerCase()
          const matchingKey = keys.find(k => k.toLowerCase() === targetLow)
          if (matchingKey) rawVal = curr[matchingKey]
          else {
            const deepMatch = keys.find(k => k.toLowerCase().includes(targetLow))
            if (deepMatch) rawVal = curr[deepMatch]
          }
        }
        hasValue = fieldName === '*' || !(rawVal === null || rawVal === undefined || rawVal === '')
        val = fieldName === '*' ? 1 : Number(rawVal)
      }

      const num = Number(val)
      if (widget.calc === 'SUM') acc[key].value += (num || 0)
      else if (widget.calc === 'COUNT') acc[key].value += 1
      else if (hasValue && Number.isFinite(num)) {
        // AVG/MIN/MAX ignoram nulos; count guarda quantos valores válidos entraram
        if (widget.calc === 'AVG') acc[key].value += num
        else if (widget.calc === 'MIN') acc[key].value = acc[key].count === 0 ? num : Math.min(acc[key].value, num)
        else if (widget.calc === 'MAX') acc[key].value = acc[key].count === 0 ? num : Math.max(acc[key].value, num)
        acc[key].count += 1
      }
      
      return acc
    }, {})

    let finalData = Object.values(grouped).map((item: any) => ({
      name: String(item.name),
      value: widget.calc === 'AVG' ? (item.count ? item.value / item.count : 0) : item.value
    }))

    const sortMode = widget.sort_by || 'value_desc'
    if (sortMode === 'value_asc') finalData.sort((a, b) => a.value - b.value)
    else if (sortMode === 'label_asc') finalData.sort((a, b) => a.name.localeCompare(b.name))
    else if (sortMode === 'label_desc') finalData.sort((a, b) => b.name.localeCompare(a.name))
    else finalData.sort((a, b) => b.value - a.value)

    if (widget.limit_top_n && widget.limit_top_n > 0) {
      finalData = finalData.slice(0, widget.limit_top_n)
    }

    setData(prev => ({ ...prev, [widget.id]: finalData }))
  }

  const renderGauge = (val: number, widget: Widget, size: 'normal' | 'mini' = 'normal', title?: string, isExpanded?: boolean) => {
    const min = widget.gauge_min ?? 0
    const target = widget.gauge_target ?? 70
    const scaleStart = widget.gauge_start ?? 0
    const scaleEnd = widget.gauge_end ?? 100
    const rawVal = typeof val === 'number' ? val : 0
    const scaleSpan = scaleEnd - scaleStart
    const percentage = scaleSpan === 0 ? 0 : Math.min(Math.max(((rawVal - scaleStart) / scaleSpan) * 100, 0), 100)
    const radius = size === 'normal' || isExpanded ? 80 : 40
    const strokeWidth = size === 'normal' || isExpanded ? 16 : 10
    const circumference = Math.PI * radius
    const rotation = -90 + (percentage / 100) * 180
    const isBelowMin = rawVal < min
    const isInRange = rawVal >= min && rawVal < target
    const uniqueId = `${widget.id}-${title?.replace(/\s+/g, '-') || 'main'}`
    const gradientId = isBelowMin ? `grad-red-${uniqueId}` : isInRange ? `grad-amber-${uniqueId}` : `grad-green-${uniqueId}`
    const viewBox = size === 'normal' || isExpanded ? "0 0 200 200" : "0 0 100 100"
    const cx = size === 'normal' || isExpanded ? 100 : 50
    const cy = size === 'normal' || isExpanded ? 100 : 50

    return (
      <div className={cn("flex flex-col items-center justify-center transition-all duration-700", (size === 'normal' || isExpanded) ? "flex-1 p-8" : "p-2")}>
        {title && <span className={cn("font-black uppercase tracking-tight text-neutral-400 mb-2 truncate max-w-full text-center", (size === 'normal' || isExpanded) ? "text-sm" : "text-[8px]")}>{title}</span>}
        <div className={cn("relative overflow-hidden transition-all duration-700", (size === 'normal' || isExpanded) ? "w-64 h-[140px]" : "w-24 h-[60px]")}>
          <svg className={cn("transition-all duration-700", (size === 'normal' || isExpanded) ? "w-64 h-64" : "w-24 h-24")} viewBox={viewBox}>
            <defs>
              <linearGradient id={`grad-red-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#ef4444" /><stop offset="100%" stopColor="#991b1b" /></linearGradient>
              <linearGradient id={`grad-amber-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#92400e" /></linearGradient>
              <linearGradient id={`grad-green-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#064e3b" /></linearGradient>
            </defs>
            <circle cx={cx} cy={cy} r={radius} fill="none" strokeWidth={strokeWidth} strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={0} transform={`rotate(180 ${cx} ${cy})`} className="text-neutral-100 dark:text-neutral-800" />
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeDasharray={`${(percentage / 100) * circumference} 1000`} strokeDashoffset={0} strokeLinecap="round" transform={`rotate(180 ${cx} ${cy})`} className={cn("transition-all duration-1000 ease-out", isBelowMin ? "text-red-500" : isInRange ? "text-amber-500" : "text-emerald-500")} />
            <g transform={`rotate(${rotation} ${cx} ${cy})`} style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.3))' }}>
              <path d={`M ${cx - (size === 'normal' || isExpanded ? 4 : 2)} ${cy} L ${cx} ${cy - radius} L ${cx + (size === 'normal' || isExpanded ? 4 : 2)} ${cy} Z`} fill={`url(#${gradientId})`} className="transition-all duration-1000 ease-out" />
              <circle cx={cx} cy={cy} r={size === 'normal' || isExpanded ? 6 : 3} className="fill-neutral-900 dark:fill-white" />
            </g>
          </svg>
          <div className="absolute flex flex-col items-center justify-center pointer-events-none" style={{ top: (size === 'normal' || isExpanded) ? '40%' : '35%', left: '50%', transform: 'translateX(-50%)' }}>
            <span className={cn(
              "font-black tracking-tighter text-neutral-900 dark:text-white transition-all duration-700",
              isExpanded ? "text-7xl" : 
              size === 'mini' ? 'text-lg' :
              (widget.width === 'quarter') ? 'text-2xl' :
              (widget.width === 'third') ? 'text-4xl' :
              (widget.width === 'half') ? 'text-5xl' :
              'text-6xl'
            )}>
              {fmt(rawVal, widget)}
            </span>
          </div>
        </div>
        {(size === 'normal' || isExpanded) && (
          <div className="mt-8 flex gap-8 text-center">
            <div className="flex flex-col"><span className="text-[10px] font-black text-red-500 uppercase">Min</span><span className="font-bold">{min}</span></div>
            <div className="flex flex-col"><span className="text-[10px] font-black text-emerald-500 uppercase">Alvo</span><span className="font-bold">{target}</span></div>
            <div className="flex flex-col"><span className="text-[10px] font-black text-indigo-500 uppercase">Escala</span><span className="font-bold">{scaleStart}-{scaleEnd}</span></div>
          </div>
        )}
      </div>
    )
  }

  const renderKPI = (val: number, widget: Widget, size: 'normal' | 'mini' = 'normal', title?: string, isExpanded?: boolean) => {
    const width = widget.width || 'third'
    
    const baseFontSize = isExpanded ? 'text-8xl' :
                   size === 'mini' ? 'text-2xl' :
                   width === 'quarter' ? 'text-3xl' :
                   width === 'third' ? 'text-5xl' :
                   width === 'half' ? 'text-7xl' :
                   'text-9xl'
    const fontScale = ['text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl', 'text-7xl', 'text-8xl', 'text-9xl']
    const lenOfValue = fmt(typeof val === 'number' ? val : 0, widget).length
    const stepDown = lenOfValue > 15 ? 3 : lenOfValue > 11 ? 2 : lenOfValue > 8 ? 1 : 0
    const fontSize = size === 'mini' ? baseFontSize : fontScale[Math.max(0, fontScale.indexOf(baseFontSize) - stepDown)]

    const padding = (size === 'normal' || isExpanded) ? (width === 'quarter' ? 'p-4' : 'p-8') : "p-4 text-center"
    const rawVal = typeof val === 'number' ? val : 0
    const formattedVal = fmt(rawVal, widget)
    return (
      <div className={cn("flex flex-col items-center justify-center transition-all duration-700", padding)}>
        {title && <span className={cn("font-black uppercase tracking-tight text-neutral-400 mb-1 truncate max-w-full", (size === 'normal' || isExpanded) ? "text-sm" : "text-[10px]")}>{title}</span>}
        <span className={cn("font-black tracking-tighter text-neutral-900 dark:text-white transition-all", fontSize)}>{formattedVal}</span>
        {(size === 'normal' || isExpanded) && (
          <span className="text-xs font-black uppercase text-neutral-400 mt-2 tracking-widest">
            {widget.calc} {widget.field_id && widget.field_id !== '' ? `/ ${widget.field_id}` : ''}
          </span>
        )}
      </div>
    )
  }

  const renderWidgetContent = (widget: Widget, forceSize?: 'normal' | 'large') => {
    if (loading[widget.id]) return <div className="flex-1 flex items-center justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
    if (errors[widget.id]) return <div className="flex-1 flex flex-col items-center justify-center gap-2 text-red-400 p-4 text-center"><AlertCircle className="w-5 h-5" /><p className="text-[10px] font-bold uppercase tracking-widest">{errors[widget.id]}</p></div>
    
    const val = data[widget.id]
    if (val === undefined || val === null) return <div className="flex-1 flex items-center justify-center text-neutral-300 text-xs font-black uppercase">Sem dados</div>

    if (widget.type === 'kpi') {
      if (Array.isArray(val)) {
        return (
          <div className="grid grid-cols-3 gap-4 p-2 max-h-[300px] overflow-auto">
            {val.map((item: any, idx: number) => (
              <div key={idx} onClick={() => setExpandedGaugeId(`${widget.id}-${item.name}`)} className="bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-[1.5rem] border border-neutral-100 dark:border-neutral-800 hover:border-indigo-500/30 transition-all cursor-pointer group/mini relative">
                <div className="absolute top-3 right-3 opacity-0 group-hover/mini:opacity-100 transition-opacity"><Maximize2 className="w-3 h-3 text-neutral-400" /></div>
                {renderKPI(item.value, widget, 'mini', item.name)}
              </div>
            ))}
          </div>
        )
      }
      return renderKPI(val, widget, 'normal')
    }

    if (widget.type === 'gauge') {
      if (Array.isArray(val)) {
        return (
          <div className="grid grid-cols-3 gap-4 p-2 max-h-[300px] overflow-auto">
            {val.map((item: any, idx: number) => (
              <div key={idx} onClick={() => setExpandedGaugeId(`${widget.id}-${item.name}`)} className="bg-neutral-50 dark:bg-neutral-800/50 p-2 rounded-[1.5rem] border border-neutral-100 dark:border-neutral-800 hover:border-indigo-500/30 transition-all cursor-pointer group/mini relative">
                <div className="absolute top-3 right-3 opacity-0 group-hover/mini:opacity-100 transition-opacity"><Maximize2 className="w-3 h-3 text-neutral-400" /></div>
                {renderGauge(item.value, widget, 'mini', item.name)}
              </div>
            ))}
          </div>
        )
      }
      return renderGauge(val, widget, 'normal')
    }

    const height = forceSize === 'large' ? 450 : 250
    const sd = seriesData[widget.id]
    if (sd && sd.rows.length > 0 && ['bar', 'line', 'area'].includes(widget.type)) {
      const tickS = { fontSize: 10, fontWeight: 700, fill: '#888888' }
      const shortS = (v: any) => { const t = String(v); return t.length > 16 ? `${t.slice(0, 15)}…` : t }
      const axisFmt = (v: any) => fmt(v, widget, true)
      const horizontalS = widget.type === 'bar' && widget.orientation === 'horizontal'
      const stack = widget.stacked ? 'a' : undefined
      return (
        <div className="w-full mt-4 relative" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {widget.type === 'bar' ? (
              <BarChart data={sd.rows} layout={horizontalS ? 'vertical' : 'horizontal'} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={horizontalS} horizontal={!horizontalS} stroke="#88888822" />
                {horizontalS ? (
                  <>
                    <XAxis type="number" axisLine={false} tickLine={false} tick={tickS} tickFormatter={axisFmt} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={tickS} width={112} tickFormatter={shortS} />
                  </>
                ) : (
                  <>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tickS} tickFormatter={shortS} />
                    <YAxis axisLine={false} tickLine={false} tick={tickS} tickFormatter={axisFmt} />
                  </>
                )}
                <Tooltip cursor={{ fill: '#88888811' }} contentStyle={tooltipStyle} formatter={(v: any, n: any) => [fmt(v, widget), n]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800 }} />
                {sd.keys.map((k, i) => <Bar key={k} dataKey={k} stackId={stack} fill={COLORS[i % COLORS.length]} radius={stack ? undefined : (horizontalS ? [0, 4, 4, 0] : [4, 4, 0, 0])} />)}
              </BarChart>
            ) : widget.type === 'line' ? (
              <LineChart data={sd.rows} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tickS} tickFormatter={shortS} />
                <YAxis axisLine={false} tickLine={false} tick={tickS} tickFormatter={axisFmt} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [fmt(v, widget), n]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800 }} />
                {sd.keys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} />)}
              </LineChart>
            ) : (
              <AreaChart data={sd.rows} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tickS} tickFormatter={shortS} />
                <YAxis axisLine={false} tickLine={false} tick={tickS} tickFormatter={axisFmt} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [fmt(v, widget), n]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800 }} />
                {sd.keys.map((k, i) => <Area key={k} type="monotone" dataKey={k} stackId={stack} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.25} strokeWidth={2.5} />)}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )
    }
    const rows: any[] = Array.isArray(val) ? val : []
    if (rows.length === 0) return <div className="flex-1 flex items-center justify-center text-neutral-300 text-xs font-black uppercase">Sem dados</div>

    const primary = biPrimaryColor(widget.color)
    const tick = { fontSize: 10, fontWeight: 700, fill: '#888888' }
    const tooltipFormatter = (value: any) => [fmt(value, widget), widget.calc]
    const labelFormatter = (value: any) => fmt(value, widget, true)
    const maxValue = Math.max(...rows.map(r => Number(r.value) || 0))
    const barFill = (value: number) => widget.highlight_max && (Number(value) || 0) !== maxValue ? `${primary}66` : primary
    const horizontal = widget.type === 'bar' && widget.orientation === 'horizontal'
    const shortName = (v: any) => { const t = String(v); return t.length > 16 ? `${t.slice(0, 15)}…` : t }
    const total = rows.reduce((acc, r) => acc + (Number(r.value) || 0), 0)
    const gradId = `bi-grad-${widget.id}`

    return (
      <div className="w-full mt-4 relative" style={{ height }}>
        {widget.type === 'pie' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingBottom: 36 }}>
            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Total</span>
            <span className="text-xl font-black tracking-tighter text-neutral-900 dark:text-white">{fmt(total, widget, true)}</span>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          {widget.type === 'bar' ? (
            <BarChart data={rows} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: widget.show_labels ? 18 : 6, right: horizontal && widget.show_labels ? 56 : 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={horizontal} horizontal={!horizontal} stroke="#88888822" />
              {horizontal ? (
                <>
                  <XAxis type="number" axisLine={false} tickLine={false} tick={tick} tickFormatter={labelFormatter} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={tick} width={112} tickFormatter={shortName} />
                </>
              ) : (
                <>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tick} tickFormatter={shortName} />
                  <YAxis axisLine={false} tickLine={false} tick={tick} tickFormatter={labelFormatter} />
                </>
              )}
              <Tooltip cursor={{ fill: '#88888811' }} contentStyle={tooltipStyle} formatter={tooltipFormatter} />
              <Bar dataKey="value" radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}>
                {rows.map((r, i) => <Cell key={`bar-${i}`} fill={barFill(r.value)} />)}
                {widget.show_labels && <LabelList dataKey="value" position={horizontal ? 'right' : 'top'} formatter={labelFormatter} style={{ fontSize: 10, fontWeight: 800, fill: isDark ? '#e5e5e5' : '#404040' }} />}
              </Bar>
            </BarChart>
          ) : widget.type === 'line' ? (
            <LineChart data={rows} margin={{ top: widget.show_labels ? 22 : 6, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tick} tickFormatter={shortName} />
              <YAxis axisLine={false} tickLine={false} tick={tick} tickFormatter={labelFormatter} />
              <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} />
              <Line type="monotone" dataKey="value" stroke={primary} strokeWidth={3} dot={{ r: 4, fill: primary }} activeDot={{ r: 6 }}>
                {widget.show_labels && <LabelList dataKey="value" position="top" formatter={labelFormatter} style={{ fontSize: 10, fontWeight: 800, fill: isDark ? '#e5e5e5' : '#404040' }} />}
              </Line>
            </LineChart>
          ) : widget.type === 'area' ? (
            <AreaChart data={rows} margin={{ top: widget.show_labels ? 22 : 6, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={primary} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={primary} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tick} tickFormatter={shortName} />
              <YAxis axisLine={false} tickLine={false} tick={tick} tickFormatter={labelFormatter} />
              <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} />
              <Area type="monotone" dataKey="value" stroke={primary} strokeWidth={3} fill={`url(#${gradId})`}>
                {widget.show_labels && <LabelList dataKey="value" position="top" formatter={labelFormatter} style={{ fontSize: 10, fontWeight: 800, fill: isDark ? '#e5e5e5' : '#404040' }} />}
              </Area>
            </AreaChart>
          ) : (
            <PieChart>
              <Pie
                data={rows}
                innerRadius={height * 0.25}
                outerRadius={height * 0.35}
                paddingAngle={rows.length > 1 ? 4 : 0}
                dataKey="value"
                label={widget.show_labels ? ((e: any) => (total > 0 ? `${Math.round((Number(e.value) / total) * 100)}%` : '')) : false}
                labelLine={false}
              >
                {rows.map((_: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 900 }}
                formatter={(name: any, entry: any) => {
                  const v = Number(entry?.payload?.value) || 0
                  const pct = total > 0 ? ` (${Math.round((v / total) * 100)}%)` : ''
                  return `${shortName(name)} · ${fmt(v, widget, true)}${pct}`
                }}
              />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    )
  }

  const SortableWidget = ({ widget }: { widget: Widget }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id })
    const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 'auto', opacity: isDragging ? 0.5 : 1 }
    const widthClass = 
      widget.width === 'full' ? 'col-span-12' : 
      widget.width === 'half' ? 'col-span-12 md:col-span-6' : 
      widget.width === 'third' ? 'col-span-12 md:col-span-4' :
      widget.width === 'quarter' ? 'col-span-12 md:col-span-3' :
      'col-span-12 md:col-span-4'

    return (
      <div ref={setNodeRef} style={style} className={cn("group bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] p-6 flex flex-col min-h-[350px] transition-all hover:shadow-2xl hover:shadow-indigo-500/5 hover:-translate-y-1 relative overflow-hidden", widthClass)}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-all" />
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-3">
            {isEditMode ? (
              <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-neutral-400 hover:text-indigo-600 transition-colors"><GripVertical className="w-4 h-4" /></div>
            ) : (
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl text-indigo-600 dark:text-indigo-400">
                {widget.type === 'kpi' ? <Activity className="w-4 h-4" /> : widget.type === 'gauge' ? <Gauge className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
              </div>
            )}
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-neutral-900 dark:text-white">{widget.title || 'Sem título'}</h3>
              <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-tighter opacity-70">{widget.calc === 'COUNT_DISTINCT' ? 'CONTAGEM DISTINTA' : widget.calc}{widget.divide_by?.calc ? ` ÷ ${widget.divide_by.calc === 'COUNT_DISTINCT' ? 'CONTAGEM DISTINTA' : widget.divide_by.calc}` : ''} ({widget.use_formula ? 'fórmula' : (widget.field_id || 'Toda Tabela')})</p>
              {widget.period_field && (() => {
                const wp = widgetPeriod(widget)
                const mode = widget.period_mode || 'panel'
                const own = ownPeriods[widget.id] || { preset: 'all', from: '', to: '' }
                return (
                  <div className="flex flex-wrap items-center gap-1">
                    <p className="text-[8px] font-black text-indigo-500 uppercase tracking-tighter">
                      📅 {wp ? `${fmtDay(wp.from)} – ${fmtDay(wp.to)}` : 'Todo o período'}{mode === 'fixed' ? ' · fixo' : ''}
                    </p>
                    {mode === 'own' && (
                      <>
                        <select
                          value={own.preset}
                          onChange={e => setOwnPeriods(prev => ({ ...prev, [widget.id]: { ...own, preset: e.target.value } }))}
                          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md px-1 py-0.5 text-[9px] font-bold text-neutral-700 dark:text-neutral-200"
                        >
                          {PERIOD_PRESETS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                          <option value="custom">Personalizado</option>
                        </select>
                        {own.preset === 'custom' && (
                          <>
                            <input type="date" value={own.from} onChange={e => setOwnPeriods(prev => ({ ...prev, [widget.id]: { ...own, from: e.target.value } }))} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md px-1 py-0.5 text-[9px] font-bold text-neutral-700 dark:text-neutral-200" />
                            <input type="date" value={own.to} onChange={e => setOwnPeriods(prev => ({ ...prev, [widget.id]: { ...own, to: e.target.value } }))} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md px-1 py-0.5 text-[9px] font-bold text-neutral-700 dark:text-neutral-200" />
                          </>
                        )}
                      </>
                    )}
                  </div>
                )
              })()}
              {truncated[widget.id] && (
                <p className="text-[8px] font-black text-amber-600 uppercase tracking-tighter" title={`A consulta atingiu o limite de ${BI_ROW_LIMIT} linhas: os totais podem estar incompletos.`}>
                  ⚠ Limitado a {BI_ROW_LIMIT} linhas
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setExpandedWidgetId(widget.id)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-indigo-600 transition-all">
              <Search className="w-4 h-4" />
            </button>
            {isEditMode && onEditWidget && (
              <button onClick={() => onEditWidget(widget)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-indigo-600 transition-all">
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {isEditMode && onDeleteWidget && (
              <button onClick={() => onDeleteWidget(widget.id)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-red-500 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col relative z-10">{renderWidgetContent(widget)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700 relative">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-neutral-400">Indicadores de Desempenho</h2>
        <button 
          onClick={() => {
            if (isEditMode && onSaveLayout) {
              onSaveLayout(localWidgets)
            }
            setIsEditMode(!isEditMode)
          }} 
          className={cn("flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all", isEditMode ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/40 scale-105" : "bg-white dark:bg-neutral-900 text-neutral-500 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50")}
        >
          {isEditMode ? <Save className="w-3.5 h-3.5" /> : <MousePointer2 className="w-3.5 h-3.5" />}
          {isEditMode ? 'Salvar Layout' : 'Organizar Dashboard'}
        </button>
        <div className="flex items-center bg-white dark:bg-neutral-900 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800 ml-4 hidden md:flex">
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

      {hasPeriodWidgets && (
        <div className="flex flex-wrap items-center gap-2 px-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mr-1">Período</span>
          <span className="text-[9px] font-bold text-neutral-400 mr-2">
            afeta {periodWidgetCount} {periodWidgetCount === 1 ? 'indicador' : 'indicadores'} (marcados com 📅)
          </span>
          {[...PERIOD_PRESETS, { id: 'custom', label: 'Personalizado' }].map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => setPeriod(p => ({ ...p, preset: o.id }))}
              className={cn("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all", period.preset === o.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-neutral-900 text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-600')}
            >
              {o.label}
            </button>
          ))}
          {period.preset === 'custom' && (
            <>
              <input type="date" value={period.from} onChange={e => setPeriod(p => ({ ...p, from: e.target.value }))} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-[10px] font-bold text-neutral-900 dark:text-white" />
              <span className="text-[10px] text-neutral-400">até</span>
              <input type="date" value={period.to} onChange={e => setPeriod(p => ({ ...p, to: e.target.value }))} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-[10px] font-bold text-neutral-900 dark:text-white" />
            </>
          )}
        </div>
      )}

      {expandedGaugeId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-neutral-900 rounded-[3.5rem] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-12 relative max-w-2xl w-full flex flex-col items-center">
            <button onClick={() => setExpandedGaugeId(null)} className="absolute top-8 right-8 p-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-red-500 rounded-full transition-all"><Minimize2 className="w-5 h-5" /></button>
            {(() => {
              const [wId, ...nameParts] = expandedGaugeId.split('-')
              const iName = nameParts.join('-')
              const widget = localWidgets.find(w => w.id === wId)
              const val = data[wId]
              if (!widget || !Array.isArray(val)) return null
              const expandedItem = val.find(v => v.name === iName)
              return expandedItem ? (
                <div className="animate-in zoom-in-95 duration-500 w-full flex flex-col items-center">
                  <h3 className="text-xl font-black uppercase tracking-tight text-neutral-400 mb-2">{widget.title}</h3>
                  {widget.type === 'gauge' ? renderGauge(expandedItem.value, widget, 'normal', expandedItem.name, true) : renderKPI(expandedItem.value, widget, 'normal', expandedItem.name, true)}
                </div>
              ) : null
            })()}
          </div>
        </div>
      )}

      {expandedWidgetId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-neutral-900 rounded-[3.5rem] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-12 relative max-w-6xl w-full h-[85vh] flex flex-col">
            <button onClick={() => setExpandedWidgetId(null)} className="absolute top-10 right-10 p-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-red-500 rounded-full transition-all"><Minimize2 className="w-6 h-6" /></button>
            {(() => {
              const widget = localWidgets.find(w => w.id === expandedWidgetId)
              if (!widget) return null
              return (
                <div className="flex-1 flex flex-col p-10 overflow-hidden">
                  <div className="mb-10"><h2 className="text-4xl font-black text-neutral-900 dark:text-white uppercase tracking-tighter">{widget.title}</h2><p className="text-sm font-bold text-neutral-400 uppercase tracking-[0.2em] mt-1">{widget.calc} / {widget.field_id}</p></div>
                  <div className="flex-1 flex items-center justify-center overflow-auto">{renderWidgetContent(widget, 'large')}</div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={localWidgets.map(w => w.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-12 gap-8" style={{ zoom: scale }}>
            {localWidgets.map((widget) => <SortableWidget key={widget.id} widget={widget} />)}
            {config.allow_runtime_edit && onAddWidget && !isEditMode && (
              <button onClick={onAddWidget} className="col-span-12 lg:col-span-4 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-5 text-neutral-400 hover:text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all group min-h-[350px]">
                <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xl shadow-neutral-500/5"><Plus className="w-10 h-10" /></div>
                <div className="text-center"><span className="text-xs font-black uppercase tracking-widest block">Novo Indicador</span><span className="text-[10px] font-bold opacity-60">Expandir Dashbaord</span></div>
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
