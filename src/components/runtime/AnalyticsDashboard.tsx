'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts'
import { 
  TrendingUp, Users, DollarSign, Activity, Loader2, 
  AlertCircle, ChevronDown, Plus, Pencil, Trash2, Maximize2 
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Widget {
  id: string
  title: string
  type: 'kpi' | 'bar' | 'pie' | 'line'
  model_id: string
  model_name?: string
  field: string
  calc: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX'
  group_by?: string
  width: 'full' | 'half' | 'third'
  joins?: any[]
}

interface AnalyticsDashboardProps {
  config: {
    widgets: Widget[]
    allow_runtime_edit: boolean
  }
  project: any
  joins?: any[]
  filters?: Record<string, string>
  onEditWidget?: (widget: Widget) => void
  onAddWidget?: () => void
  onDeleteWidget?: (id: string) => void
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4']

export default function AnalyticsDashboard({ config, project, joins = [], filters = {}, onEditWidget, onAddWidget, onDeleteWidget }: AnalyticsDashboardProps) {
  const [data, setData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const supabase = createClient()

  useEffect(() => {
    config.widgets.forEach(widget => {
      fetchWidgetData(widget)
    })
  }, [config.widgets, filters])

  const fetchWidgetData = async (widget: Widget) => {
    setLoading(prev => ({ ...prev, [widget.id]: true }))
    setErrors(prev => ({ ...prev, [widget.id]: '' }))

    try {
      // --- NORMALIZAÇÃO E BUSCA DE MODELO ---
      const model = project.models?.find((m: any) => String(m.id) === String(widget.model_id))
      if (!model) {
        setData(prev => ({ ...prev, [widget.id]: [] }))
        setErrors(prev => ({ ...prev, [widget.id]: `Tabela fonte não encontrada (ID: ${widget.model_id})` }))
        setLoading(prev => ({ ...prev, [widget.id]: false }))
        return
      }

      const tableName = model.db_table_name
      
      // Busca metadados do campo de valor
      const fieldMeta = model.fields?.find((f: any) => String(f.id) === String(widget.field))
      const fieldName = fieldMeta?.db_column_name || '*'
      
      // --- SUPER RESOLUÇÃO DE CAMPOS (CONSOLIDADA) ---
      let groupByFieldMeta = null
      let groupByTableName = tableName
      let resolvedGroupByPath = null

      const allModels = Array.isArray(project.models) ? project.models : Object.values(project.models || {})

      // Try to parse table.column format if present
      let targetTableName = tableName
      let targetFieldName = widget.group_by
      if (widget.group_by?.includes('.') && !widget.group_by.includes('-')) {
        const parts = widget.group_by.split('.')
        targetTableName = parts[0]
        targetFieldName = parts[1]
      }

      for (const m of (allModels as any[])) {
        // If we are looking for a specific table.column, only check that table
        if (widget.group_by?.includes('.') && m.db_table_name !== targetTableName) continue

        const rawFields = m.fields || m.model_fields || []
        const fields = Array.isArray(rawFields) ? rawFields : Object.values(rawFields || {})
        const found = fields.find((f: any) => 
          String(f.id) === String(widget.group_by) || 
          f.db_column_name === targetFieldName ||
          f.name === targetFieldName
        )
        if (found) {
          groupByFieldMeta = found
          groupByTableName = m.db_table_name
          resolvedGroupByPath = m.db_table_name === tableName ? found.db_column_name : `${m.db_table_name}.${found.db_column_name}`
          break
        }
      }

      if (!resolvedGroupByPath && widget.group_by && !widget.group_by.includes('-')) {
        resolvedGroupByPath = widget.group_by
      }

      const groupByPath = resolvedGroupByPath

      // --- APLICAÇÃO DE FILTROS GLOBAIS (UNIVERSAL SYNC) ---
      const applyFiltersToQuery = (q: any, activeJoins: any[]) => {
        let currentQuery = q
        const safeTables = [tableName, ...activeJoins.map(j => j.from === tableName ? j.to : j.from)]
        
        Object.entries(filters).forEach(([key, val]) => {
          if (!val) return
          
          let filterTable = tableName
          let filterCol = key
          
          if (key.includes('.')) {
            const parts = key.split('.')
            filterTable = parts[0]
            filterCol = parts[1]
          }
          
          // Só aplica o filtro se a tabela estiver no escopo do widget
          if (safeTables.includes(filterTable)) {
             // Se for a tabela primária, usa o nome simples. Se for JOIN, usa o path completo.
             const filterPath = filterTable === tableName ? filterCol : `${filterTable}.${filterCol}`
             currentQuery = currentQuery.ilike(filterPath, `%${val}%`)
          }
        })
        return currentQuery
      }

      // Combine local widget joins with global dashboard joins
      const combinedJoins = [...(widget.joins || []), ...(joins || [])]
      const activeJoins = combinedJoins.filter((j: any) => j.from === tableName || j.to === tableName)

      // Lógica de KPI (Métricas Simples)
      if (widget.type === 'kpi') {
        let query = supabase.from(tableName).select(fieldName, { count: 'exact', head: true })
        query = applyFiltersToQuery(query, activeJoins)

        if (widget.calc !== 'COUNT') {
          let dataQuery = supabase.from(tableName).select(fieldName).limit(1000)
          dataQuery = applyFiltersToQuery(dataQuery, activeJoins)
          
          const { data: records, error } = await dataQuery
          if (error) throw error
          const values = records.map(r => Number(r[fieldName])).filter(v => !isNaN(v))
          let result = 0
          if (widget.calc === 'SUM') result = values.reduce((a, b) => a + b, 0)
          if (widget.calc === 'AVG') result = values.reduce((a, b) => a + b, 0) / (values.length || 1)
          if (widget.calc === 'MIN') result = Math.min(...values)
          if (widget.calc === 'MAX') result = Math.max(...values)
          setData(prev => ({ ...prev, [widget.id]: result }))
        } else {
          const { count, error } = await query
          if (error) throw error
          setData(prev => ({ ...prev, [widget.id]: count }))
        }
        setLoading(prev => ({ ...prev, [widget.id]: false }))
        return
      }

      // Validação de Gráficos
      if (!groupByPath) {
        let totalFieldsCount = 0
        allModels.forEach((m: any) => {
          const rf = m.fields || m.model_fields || []
          totalFieldsCount += (Array.isArray(rf) ? rf : Object.values(rf || {})).length
        })
        setData(prev => ({ ...prev, [widget.id]: [] }))
        setErrors(prev => ({ 
          ...prev, 
          [widget.id]: `Campo não encontrado. (Vimos ${allModels.length} modelos e ${totalFieldsCount} campos).` 
        }))
        setLoading(prev => ({ ...prev, [widget.id]: false }))
        return
      }

      // Construir string de SELECT incluindo JOINS se necessário
      let selectStr = `${fieldName === '*' ? '*' : fieldName}`
        
      activeJoins.forEach((j: any) => {
        // Add the "other" side of the join (not the primary table)
        const otherTable = j.from === tableName ? j.to : j.from
        if (otherTable && otherTable !== tableName) {
          selectStr += `, ${otherTable}(*)`
        }
      })

        const { data: records, error } = await applyFiltersToQuery(
          supabase.from(tableName).select(selectStr).limit(1000),
          activeJoins
        )

        if (error) throw error

        const grouped = records.reduce((acc: any, curr: any) => {
          // Resolver o valor da chave de agrupamento (pode estar aninhado se for JOIN)
          let key = 'N/A'
          if (groupByTableName === tableName) {
            key = curr[groupByPath!] || 'N/A'
          } else {
            // Supabase returns FK-joined data as nested objects: curr.tableName.column
            const colName = groupByFieldMeta?.db_column_name || (groupByPath?.split('.')[1] ?? groupByPath!)
            key = curr[groupByTableName]?.[colName] || 'N/A'
          }

          if (!acc[key]) acc[key] = { name: key, value: 0, count: 0 }
          
          const val = fieldName === '*' ? 1 : Number(curr[fieldName])
          if (widget.calc === 'SUM') acc[key].value += val
          else if (widget.calc === 'COUNT') acc[key].value += 1
          else if (widget.calc === 'AVG') {
             acc[key].value += val
             acc[key].count += 1
          }
          return acc
        }, {})

        let chartData = Object.values(grouped).map((item: any) => ({
          name: item.name,
          value: widget.calc === 'AVG' ? (item.value / item.count) : item.value
        }))

        chartData.sort((a, b) => b.value - a.value)
        setData(prev => ({ ...prev, [widget.id]: chartData }))
      } catch (err: any) {
        console.error(`Error fetching widget ${widget.id}:`, err)
        setErrors(prev => ({ ...prev, [widget.id]: err.message }))
      } finally {
        setLoading(prev => ({ ...prev, [widget.id]: false }))
      }
    }

  const renderWidgetContent = (widget: Widget) => {
    if (loading[widget.id]) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600 opacity-20" />
        </div>
      )
    }

    if (errors[widget.id]) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-red-400 p-4 text-center">
          <AlertCircle className="w-5 h-5" />
          <p className="text-[10px] font-bold uppercase tracking-widest">{errors[widget.id]}</p>
          <p className="text-[8px] opacity-50 font-mono">Path: {widget.group_by}</p>
        </div>
      )
    }

    const val = data[widget.id]

    if (widget.type === 'kpi') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter">
            {typeof val === 'number' ? (val % 1 !== 0 ? val.toFixed(2) : val.toLocaleString()) : '0'}
          </div>
          <div className="mt-2 flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest">
            <TrendingUp className="w-3 h-3" />
            Live Data
          </div>
        </div>
      )
    }

    if (widget.type === 'bar') {
      return (
        <div className="w-full h-[250px] mt-4">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={val || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#888888' }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#888888' }} 
              />
              <Tooltip 
                cursor={{ fill: '#88888811' }}
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  borderRadius: '12px', 
                  border: 'none', 
                  boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)',
                  fontSize: '10px',
                  fontWeight: 900
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {(val || []).map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )
    }

    if (widget.type === 'pie') {
      return (
        <div className="w-full h-[250px] mt-4">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={val || []}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {(val || []).map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  borderRadius: '12px', 
                  border: 'none', 
                  boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)',
                  fontSize: '10px',
                  fontWeight: 900
                }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )
    }

    if (widget.type === 'line') {
      return (
        <div className="w-full h-[250px] mt-4">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={val || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#888888' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#888888' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  borderRadius: '12px', 
                  border: 'none', 
                  boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)',
                  fontSize: '10px',
                  fontWeight: 900
                }}
              />
              <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )
    }

    return null
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-12 gap-6">
        {config.widgets.map((widget) => {
          const widthClass = widget.width === 'full' ? 'col-span-12' : widget.width === 'half' ? 'col-span-12 lg:col-span-6' : 'col-span-12 lg:col-span-4'
          
          return (
            <div 
              key={widget.id} 
              className={cn(
                "group bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-6 flex flex-col min-h-[300px] transition-all hover:shadow-2xl hover:shadow-indigo-500/5 hover:-translate-y-1 relative overflow-hidden",
                widthClass
              )}
            >
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                    {widget.type === 'kpi' ? <Activity className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400">{widget.title}</h3>
                    <p className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] mt-0.5">
                      {widget.calc} ({project.models?.find((m: any) => String(m.id) === String(widget.model_id))?.display_name || 'Table'})
                      {widget.group_by && (
                        <span className="ml-2 text-neutral-300">
                          | {widget.group_by.includes('-') ? 'ID Detectado' : `SQL: ${widget.group_by}`}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {config.allow_runtime_edit && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => onEditWidget?.(widget)} className="p-2 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDeleteWidget?.(widget.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {renderWidgetContent(widget)}

              {/* Decorative Background Glow */}
              <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-indigo-500/5 blur-[80px] rounded-full group-hover:bg-indigo-500/10 transition-all"></div>
            </div>
          )
        })}

        {config.allow_runtime_edit && (
          <button 
            onClick={onAddWidget}
            className="col-span-12 lg:col-span-4 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2rem] flex flex-col items-center justify-center gap-4 text-neutral-400 hover:text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all group min-h-[300px]"
          >
            <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xl shadow-neutral-500/5">
              <Plus className="w-8 h-8" />
            </div>
            <div className="text-center">
              <span className="text-xs font-black uppercase tracking-widest block">Adicionar Indicador</span>
              <span className="text-[10px] font-medium opacity-60">Personalize seu dashboard agora</span>
            </div>
          </button>
        )}
      </div>
    </div>
  )
}
