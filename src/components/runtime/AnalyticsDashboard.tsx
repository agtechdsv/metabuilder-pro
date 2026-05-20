'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts'
import { 
  TrendingUp, Users, DollarSign, Activity, Loader2, 
  AlertCircle, ChevronDown, Plus, Pencil, Trash2, Maximize2, Minimize2, Gauge,
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

interface Widget {
  id: string
  title: string
  type: 'kpi' | 'bar' | 'pie' | 'line' | 'gauge'
  model_id: string
  model_name?: string
  field: string
  field_id?: string
  calc: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX'
  group_by?: string
  width: 'full' | 'half' | 'third' | 'quarter'
  joins?: any[]
  gauge_min?: number
  gauge_max?: number
  gauge_target?: number
  gauge_start?: number
  gauge_end?: number
  use_formula?: boolean
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
}

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
  isTunnelReady
}: AnalyticsDashboardProps) {
  const [data, setData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [expandedGaugeId, setExpandedGaugeId] = useState<string | null>(null)
  const [expandedWidgetId, setExpandedWidgetId] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [localWidgets, setLocalWidgets] = useState(config.widgets || [])

  // Sincroniza widgets locais quando a config mudar (ex: após load inicial)
  useEffect(() => {
    if (config.widgets) {
      console.log(`[BI DEBUG] Atualizando localWidgets com ${config.widgets.length} itens da config.`)
      setLocalWidgets(config.widgets)
    }
  }, [config.widgets])
  
  const supabase = createClient()
  const { t } = useI18n()

  // Mapeia IDs de widgets para evitar loops de refresh infinitos
  const lastQueryIds = useRef<Record<string, string>>({})

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
    
    console.log(`[BI DEBUG] Configurando listener no canal mestre compartilhado.`)

    const handleSqlResult = (payload: any) => {
      const qId = payload.payload?.queryId
      if (!qId) return

      const widgetId = Object.keys(lastQueryIds.current).find(id => lastQueryIds.current[id] === qId)
      if (!widgetId) return

      const widget = widgetsRef.current.find(w => w.id === widgetId)
      if (!widget) return

      if (payload.payload.success) {
        const records = payload.payload.data
        const model = (project as any).models?.find((m: any) => String(m.id) === String(widget.model_id))
        const tableName = model?.db_table_name || widget.model_id
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
    if (!isTunnelReady || localWidgets.length === 0) return

    const handler = setTimeout(() => {
      console.log(`[BI DEBUG] ✅ Filtros/widgets mudaram, disparando fetches debotados para ${localWidgets.length} widgets.`)
      localWidgets.forEach(widget => {
        fetchWidgetData(widget)
      })
    }, 400) // Debounce de 400ms para evitar chamadas excessivas durante a digitação

    return () => clearTimeout(handler)
  }, [isTunnelReady, localWidgets, filters])

  const fetchWidgetData = async (widget: Widget) => {
    if (!tunnelChannel || !isTunnelReady) {
      console.warn(`[BI DEBUG] Busca de widget ignorada: canal do túnel não está pronto ainda.`)
      return
    }

    console.log(`[BI DEBUG] Iniciando busca para widget: "${widget.title}" (ID: ${widget.id})`)
    const queryId = crypto.randomUUID()
    const topicName = `tunnel:${project.id}`
    
    // Registra este queryId como o último enviado por este widget
    lastQueryIds.current[widget.id] = queryId

    setLoading(prev => ({ ...prev, [widget.id]: true }))
    setErrors(prev => ({ ...prev, [widget.id]: '' }))

    const model = (project as any).models?.find((m: any) => String(m.id) === String(widget.model_id))
    const tableName = model?.db_table_name || (typeof widget.model_id === 'string' && !widget.model_id.includes('-') ? widget.model_id : null)

    if (!tableName) {
      setErrors(prev => ({ ...prev, [widget.id]: 'Tabela não encontrada' }))
      setLoading(prev => ({ ...prev, [widget.id]: false }))
      return
    }

    const isFormula = (widget as any).use_formula || (widget.field?.includes('*') || widget.field?.includes('+') || widget.field?.includes('/') || widget.field?.includes('-'))
    
    // Build SQL
    let selectStr = '*'
    if (!isFormula && widget.field !== '*') {
      const fieldMeta = model?.fields?.find((f: any) => String(f.id) === String(widget.field))
      selectStr = fieldMeta?.db_column_name || widget.field || '*'
    }

    if (widget.group_by && !selectStr.includes(widget.group_by)) {
        const allModels = Array.isArray(project.models) ? project.models : Object.values(project.models || {})
        let groupCol = widget.group_by
        const parts = widget.group_by.split('.')
        const targetTableName = parts.length > 1 ? parts[0] : tableName
        const targetFieldName = parts.length > 1 ? parts[1] : widget.group_by

        for (const m of (allModels as any[])) {
          if (m.db_table_name === targetTableName) {
            const fields = Array.isArray(m.fields) ? m.fields : Object.values(m.fields || {})
            const found = fields.find((f: any) => String(f.id) === String(targetFieldName) || f.db_column_name === targetFieldName || f.name === targetFieldName)
            if (found) groupCol = found.db_column_name
            break
          }
        }
        if (!selectStr.includes(groupCol)) selectStr += `, ${groupCol}`
    }

    // Build JOINs
    const combinedJoins = [...(widget.joins || []), ...(joins || [])]
    const seenTables = new Set<string>()
    const activeJoins = combinedJoins.filter((j: any) => {
      const isRelated = j.from === tableName || j.to === tableName
      if (!isRelated) return false
      const otherTable = j.from === tableName ? j.to : j.from
      if (seenTables.has(otherTable)) return false
      seenTables.add(otherTable)
      return true
    })

    let joinSql = ''
    activeJoins.forEach((j: any) => {
      const fromModel = (project as any).models?.find((m: any) => String(m.id) === String(j.from))
      const toModel = (project as any).models?.find((m: any) => String(m.id) === String(j.to))
      const fromTable = fromModel?.db_table_name
      const toTable = toModel?.db_table_name
      const fromField = fromModel?.fields?.find((f: any) => String(f.id) === String(j.local_field))?.db_column_name || j.local_field
      const toField = toModel?.fields?.find((f: any) => String(f.id) === String(j.foreign_field))?.db_column_name || j.foreign_field
      const otherTable = fromTable === tableName ? toTable : fromTable
      const joinOnFrom = fromTable === tableName ? fromField : toField
      const joinOnTo = fromTable === tableName ? toField : fromField
      joinSql += ` LEFT JOIN "${otherTable}" ON "${tableName}"."${joinOnFrom}" = "${otherTable}"."${joinOnTo}"`
    })

    // Build Filters
    let whereClause = '1=1'
    Object.entries(filters).forEach(([key, val]) => {
      if (!val) return
      const filterTable = key.includes('.') ? key.split('.')[0] : tableName
      const filterCol = key.includes('.') ? key.split('.')[1] : key
      whereClause += ` AND "${filterTable}"."${filterCol}" ILIKE '%${String(val).replace(/'/g, "''")}%'`
    })

    const sql = `SELECT "${tableName}".${selectStr} FROM "${tableName}"${joinSql} WHERE ${whereClause} LIMIT 1000`
    
    console.log(`[BI DEBUG] Solicitando dados para widget via Túnel:`, sql)

    // Pequeno delay para garantir que o canal esteja pronto
    setTimeout(() => {
      if (!tunnelChannel || !isTunnelReady) return
      
      tunnelChannel.send({
        type: 'broadcast',
        event: 'sql_query',
        payload: {
          queryId,
          action: 'select',
          sql,
          table: tableName,
          filters, // Envia filtros para que o CLI aplique a cláusula WHERE
          token: project?.secret_token || 'test-token',
          projectId: project.id
        }
      })
    }, 500)
  }

  const processWidgetData = (widget: Widget, records: any[], isFormula: boolean, formula: string, tableName: string) => {
    const model = (project as any).models?.find((m: any) => String(m.id) === String(widget.model_id))
    
    // Identifica o nome da coluna para cálculo
    let fieldName = '*'
    if (!isFormula) {
      const fieldMeta = model?.fields?.find((f: any) => String(f.id) === String(widget.field))
      fieldName = fieldMeta?.db_column_name || widget.field || '*'
    }

    if (!widget.group_by && (widget.type === 'kpi' || widget.type === 'gauge')) {
      const values = records.map((r, idx) => {
        if (isFormula) {
          try {
            const calcFn = new Function('r', `with(r) { try { return ${formula}; } catch(e) { return 0; } }`)
            const result = Number(calcFn(r))
            return isNaN(result) ? 0 : result
          } catch (e) { return 0 }
        }
        
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
        return Number(rawVal)
      }).filter(v => !isNaN(v))

      let result = 0
      if (widget.calc === 'SUM') result = values.reduce((a, b) => a + b, 0)
      if (widget.calc === 'AVG') result = values.reduce((a, b) => a + b, 0) / (values.length || 1)
      if (widget.calc === 'MIN') result = Math.min(...values)
      if (widget.calc === 'MAX') result = Math.max(...values)
      
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
      const targetTableName = parts.length > 1 ? parts[0] : tableName
      const targetFieldName = parts.length > 1 ? parts[1] : widget.group_by

      for (const m of (allModels as any[])) {
        if (m.db_table_name === targetTableName) {
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
    }

    const groupByPath = resolvedGroupByPath || widget.group_by
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
      key = String(rawKey || 'N/A')
      
      if (!acc[key]) acc[key] = { name: key, value: 0, count: 0 }
      
      let val = 0
      if (isFormula) {
        try {
          const calcFn = new Function('r', `with(r) { try { return ${formula}; } catch(e) { return 0; } }`)
          val = Number(calcFn(curr))
        } catch (e) { val = 0 }
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
        val = fieldName === '*' ? 1 : Number(rawVal)
      }

      if (widget.calc === 'SUM') acc[key].value += (Number(val) || 0)
      else if (widget.calc === 'COUNT') acc[key].value += 1
      else if (widget.calc === 'AVG') { acc[key].value += (Number(val) || 0); acc[key].count += 1 }
      
      return acc
    }, {})

    const finalData = Object.values(grouped).map((item: any) => ({
      name: String(item.name),
      value: widget.calc === 'AVG' ? item.value / (item.count || 1) : item.value
    }))

    setData(prev => ({ ...prev, [widget.id]: finalData }))
  }

  const renderGauge = (val: number, widget: Widget, size: 'normal' | 'mini' = 'normal', title?: string, isExpanded?: boolean) => {
    const min = widget.gauge_min ?? 0
    const target = widget.gauge_target ?? 70
    const scaleStart = widget.gauge_start ?? 0
    const scaleEnd = widget.gauge_end ?? 100
    const rawVal = typeof val === 'number' ? val : 0
    const percentage = Math.min(Math.max(((rawVal - scaleStart) / (scaleEnd - scaleStart)) * 100, 0), 100)
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
              {rawVal % 1 !== 0 ? rawVal.toFixed(1) : rawVal.toLocaleString()}
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
    
    const fontSize = isExpanded ? 'text-8xl' : 
                   size === 'mini' ? 'text-2xl' :
                   width === 'quarter' ? 'text-3xl' :
                   width === 'third' ? 'text-5xl' :
                   width === 'half' ? 'text-7xl' :
                   'text-9xl'

    const padding = (size === 'normal' || isExpanded) ? (width === 'quarter' ? 'p-4' : 'p-8') : "p-4 text-center"
    const rawVal = typeof val === 'number' ? val : 0
    const formattedVal = rawVal % 1 !== 0 ? rawVal.toFixed(1) : rawVal.toLocaleString()
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
    const ChartComp = widget.type === 'bar' ? BarChart : widget.type === 'line' ? LineChart : PieChart

    return (
      <div className="w-full mt-4" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {widget.type === 'bar' ? (
            <BarChart data={val || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#888888' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#888888' }} />
              <Tooltip cursor={{ fill: '#88888811' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          ) : widget.type === 'line' ? (
            <LineChart data={val || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#888888' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#888888' }} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
              <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          ) : (
            <PieChart>
              <Pie data={val || []} innerRadius={height * 0.25} outerRadius={height * 0.35} paddingAngle={5} dataKey="value">
                {(val || []).map((_: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 900 }} />
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
              <h3 className="text-xs font-black uppercase tracking-widest text-neutral-900 dark:text-white">{widget.title}</h3>
              <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-tighter opacity-70">{widget.calc} ({widget.field_id || 'Toda Tabela'})</p>
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
      </div>

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
          <div className="grid grid-cols-12 gap-8">
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
