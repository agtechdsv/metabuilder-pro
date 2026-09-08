export function generateSchedulerBoardComponent(files: Map<string, string>) {
  files.set('components/DynamicScheduler.tsx', generateSchedulerCode())
}

function generateSchedulerCode(): string {
  return `'use client'

import React, { useState, useMemo } from 'react'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  MoreVertical,
  LayoutGrid,
  Layers,
  Sparkles,
  Trash2,
  Pencil,
  Minimize2,
  Maximize2,
  ZoomIn,
  RefreshCcw,
  Zap,
} from 'lucide-react'
import { DynamicIcon } from '@/app/components/DynamicIcon'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

export interface DynamicSchedulerProps {
  data: any[]
  fields?: any[]
  schedulerConfig?: {
    title_field?: string
    start_date_field?: string
    end_date_field?: string
    color_field?: string
    titleField?: string
    startDateField?: string
    endDateField?: string
    colorField?: string
  }
  onMove?: (recordId: string, newValue: any) => void
  onAdd?: (initialData?: any) => void
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => void
  dictionary?: any
  relationalOptions?: Record<string, any[]>
  customActions?: any[]
  onCustomAction?: (action: any, row?: any) => void
  kanbanCardFields?: string[]
  hasMore?: boolean
  totalRecords?: number
  onLoadMore?: () => void
}

function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined
  if (obj[path] !== undefined) return obj[path]
  return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj)
}

function extractValue(row: any, colName?: string, fields?: any[]): any {
  if (!row || !colName) return undefined
  if (row[colName] !== undefined && row[colName] !== null) return row[colName]
  const lower = colName.toLowerCase()
  for (const [k, v] of Object.entries(row)) {
    if (k.toLowerCase() === lower && v !== undefined && v !== null) return v
  }
  // Se for JSON de configuração (ex: { target_field_id: "..." })
  if (typeof colName === 'string' && colName.startsWith('{')) {
    try {
      const parsed = JSON.parse(colName)
      const targetId = parsed.target_field_id || parsed.relation_path?.[0]?.foreign_column_id
      if (targetId) {
        const val = extractValue(row, targetId, fields)
        if (val !== undefined && val !== null) return val
      }
    } catch (e) {}
  }
  if (fields) {
    const fDef = fields.find((f: any) =>
      f.id === colName ||
      f.dbColumn === colName ||
      f.db_column_name === colName ||
      f.label?.toLowerCase() === lower ||
      f.display_name?.toLowerCase() === lower
    )
    if (fDef) {
      const col = fDef.dbColumn || fDef.db_column_name
      if (col && row[col] !== undefined && row[col] !== null) return row[col]
      if (col) {
        const colLower = col.toLowerCase()
        for (const [k, v] of Object.entries(row)) {
          if (k.toLowerCase() === colLower && v !== undefined && v !== null) return v
        }
      }
    }
  }
  if (colName.includes('.')) {
    const parts = colName.split('.')
    let curr = row
    for (const p of parts) {
      if (!curr) break
      curr = curr[p] ?? curr[p.toLowerCase()]
    }
    if (curr !== undefined && curr !== null) return curr
    const last = parts[parts.length - 1]
    if (row[last] !== undefined && row[last] !== null) return row[last]
  }
  return undefined
}

function formatTitle(
  rawTitle: any,
  titleCol?: string,
  relationalOptions?: Record<string, any[]>,
  fields?: any[],
  row?: any
): string {
  let val = rawTitle
  if ((val === undefined || val === null || val === '') && row && fields) {
    const fallbackField = fields.find((f: any) => f.isTitle || f.isDisplay || f.config?.isTitle)
    if (fallbackField) {
      val = extractValue(row, fallbackField.dbColumn || fallbackField.id, fields)
    }
  }

  if (val === undefined || val === null || val === '') {
    return 'Sem Título'
  }

  if (typeof val === 'object') {
    if (val.label) return String(val.label)
    if (val.name) return String(val.name)
    const firstStr = Object.values(val).find(v => typeof v === 'string' && (v as string).trim())
    if (firstStr) return String(firstStr)
  }

  const str = String(val)

  if (relationalOptions) {
    const fDef = fields?.find((f: any) =>
      f.id === titleCol ||
      f.dbColumn === titleCol ||
      f.db_column_name === titleCol ||
      (f.dbColumn && titleCol && f.dbColumn.toLowerCase() === titleCol.toLowerCase())
    )

    const targetTable = fDef?.config?.relation?.targetTable 
      || fDef?.config?.component?.rel_table 
      || fDef?.config?.rel_table

    const candidateKeys = [
      titleCol,
      titleCol ? titleCol.toLowerCase() : undefined,
      fDef?.dbColumn,
      fDef?.db_column_name,
      fDef?.id,
      targetTable,
      targetTable ? targetTable.toLowerCase() : undefined,
    ].filter(Boolean) as string[]

    for (const key of candidateKeys) {
      const opts = relationalOptions[key]
      if (Array.isArray(opts)) {
        const matched = opts.find((o: any) => String(o.value) === str || String(o.id) === str)
        if (matched) return matched.label || matched.name || str
      }
    }

    if (fDef?.config?.options && Array.isArray(fDef.config.options)) {
      const matched = fDef.config.options.find((o: any) => String(o.value) === str || String(o.id) === str)
      if (matched) return matched.label || matched.name || str
    }

    for (const opts of Object.values(relationalOptions)) {
      if (Array.isArray(opts)) {
        const matched = opts.find((o: any) => String(o.value) === str || String(o.id) === str)
        if (matched) return matched.label || matched.name || str
      }
    }
  }

  return str
}

function parseEventDate(val: any): Date | null {
  if (!val) return null
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function getEventColors(colorName?: string) {
  const colors: Record<string, { bg: string; text: string; border: string; badge: string }> = {
    default: {
      bg: 'bg-indigo-50/70 hover:bg-indigo-100/80 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30',
      text: 'text-indigo-700 dark:text-indigo-300',
      border: 'border-indigo-100 dark:border-indigo-900/50',
      badge: 'bg-indigo-500',
    },
    danger: {
      bg: 'bg-rose-50/70 hover:bg-rose-100/80 dark:bg-rose-950/20 dark:hover:bg-rose-900/30',
      text: 'text-rose-700 dark:text-rose-300',
      border: 'border-rose-100 dark:border-rose-900/50',
      badge: 'bg-rose-500',
    },
    warning: {
      bg: 'bg-amber-50/70 hover:bg-amber-100/80 dark:bg-amber-950/20 dark:hover:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-100 dark:border-amber-900/50',
      badge: 'bg-amber-500',
    },
    success: {
      bg: 'bg-emerald-50/70 hover:bg-emerald-100/80 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-100 dark:border-emerald-900/50',
      badge: 'bg-emerald-500',
    },
    info: {
      bg: 'bg-sky-50/70 hover:bg-sky-100/80 dark:bg-sky-950/20 dark:hover:bg-sky-900/30',
      text: 'text-sky-700 dark:text-sky-300',
      border: 'border-sky-100 dark:border-sky-900/50',
      badge: 'bg-sky-500',
    },
  }
  const cleanKey = String(colorName || 'default').toLowerCase()
  if (cleanKey.includes('ativ') || cleanKey.includes('sim') || cleanKey.includes('green') || cleanKey.includes('entreg')) return colors.success
  if (cleanKey.includes('inativ') || cleanKey.includes('nao') || cleanKey.includes('red') || cleanKey.includes('cancel')) return colors.danger
  if (cleanKey.includes('pendent') || cleanKey.includes('yellow') || cleanKey.includes('espera')) return colors.warning
  if (cleanKey.includes('blue') || cleanKey.includes('andamento') || cleanKey.includes('rota')) return colors.info
  return colors[cleanKey] || colors.default
}

function getActionColorClasses(color?: string) {
  const normalized = color?.toLowerCase() || 'indigo'
  switch (normalized) {
    case 'emerald':
      return { text: 'text-emerald-600 dark:text-emerald-400', hover: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/30' }
    case 'amber':
      return { text: 'text-amber-600 dark:text-amber-400', hover: 'hover:bg-amber-100 dark:hover:bg-amber-900/30' }
    case 'red':
      return { text: 'text-red-600 dark:text-red-400', hover: 'hover:bg-red-100 dark:hover:bg-red-900/30' }
    case 'rose':
      return { text: 'text-rose-600 dark:text-rose-400', hover: 'hover:bg-rose-100 dark:hover:bg-rose-900/30' }
    case 'blue':
      return { text: 'text-blue-600 dark:text-blue-400', hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30' }
    default:
      return { text: 'text-indigo-600 dark:text-indigo-400', hover: 'hover:bg-indigo-100 dark:hover:bg-indigo-900/30' }
  }
}

export function DynamicScheduler({
  data = [],
  fields = [],
  schedulerConfig = {},
  onMove,
  onAdd,
  onView,
  onEdit,
  onDelete,
  dictionary = {},
  relationalOptions = {},
  customActions = [],
  onCustomAction,
  kanbanCardFields,
  hasMore,
  totalRecords,
  onLoadMore,
}: DynamicSchedulerProps) {
  const [currentView, setCurrentView] = useState<'month' | 'week' | 'day'>('month')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [scale, setScale] = useState(1.0)

  const scales = [
    { value: 0.8, icon: <Minimize2 className="w-3.5 h-3.5" />, label: 'Pequeno' },
    { value: 1.0, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: 'Normal' },
    { value: 1.2, icon: <Maximize2 className="w-3.5 h-3.5" />, label: 'Grande' },
    { value: 1.5, icon: <ZoomIn className="w-3.5 h-3.5" />, label: 'Extra Grande' },
  ]

  const titleCol = schedulerConfig.title_field || schedulerConfig.titleField || 'id'
  const startCol = schedulerConfig.start_date_field || schedulerConfig.startDateField || 'created_at'
  const endCol = schedulerConfig.end_date_field || schedulerConfig.endDateField
  const colorCol = schedulerConfig.color_field || schedulerConfig.colorField

  const events = useMemo(() => {
    return data.map((item, idx) => {
      const startRaw = extractValue(item, startCol, fields)
      const endRaw = endCol ? extractValue(item, endCol, fields) : null
      const start = parseEventDate(startRaw)
      const end = parseEventDate(endRaw) || start
      const rawTitle = extractValue(item, titleCol, fields)
      const rawColor = colorCol ? extractValue(item, colorCol, fields) : null

      return {
        raw: item,
        id: String(item.id || item.codigo || item._key || idx),
        title: formatTitle(rawTitle, titleCol, relationalOptions, fields, item),
        start,
        end,
        color: String(rawColor || 'default'),
      }
    }).filter(evt => evt.start !== null) as any[]
  }, [data, schedulerConfig, fields, relationalOptions, titleCol, startCol, endCol, colorCol])

  const navigate = (direction: 'prev' | 'next') => {
    const nextDate = new Date(currentDate)
    if (currentView === 'month') {
      nextDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1))
    } else if (currentView === 'week') {
      nextDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7))
    } else {
      nextDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1))
    }
    setCurrentDate(nextDate)
  }

  const jumpToToday = () => {
    setCurrentDate(new Date())
  }

  const monthData = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDayIndex = new Date(year, month, 1).getDay()
    const totalDays = new Date(year, month + 1, 0).getDate()
    const prevMonthDays = new Date(year, month, 0).getDate()

    const days: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = []

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i)
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: checkIfToday(d),
      })
    }

    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i)
      days.push({
        date: d,
        isCurrentMonth: true,
        isToday: checkIfToday(d),
      })
    }

    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: checkIfToday(d),
      })
    }

    return days
  }, [currentDate])

  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate)
    const day = startOfWeek.getDay()
    startOfWeek.setDate(startOfWeek.getDate() - day)

    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      days.push(d)
    }
    return days
  }, [currentDate])

  function checkIfToday(d: Date) {
    const today = new Date()
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    )
  }

  const getEventsForDay = (d: Date) => {
    return events.filter(evt => {
      const s = evt.start
      return (
        s.getDate() === d.getDate() &&
        s.getMonth() === d.getMonth() &&
        s.getFullYear() === d.getFullYear()
      )
    })
  }

  const handleDragStart = (e: React.DragEvent, eventId: string) => {
    e.dataTransfer.setData('text/plain', eventId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault()
    const eventId = e.dataTransfer.getData('text/plain')
    const foundEvent = events.find(evt => evt.id === eventId)

    if (foundEvent && onMove) {
      const originalHour = foundEvent.start.getHours()
      const originalMinutes = foundEvent.start.getMinutes()

      const newStartDate = new Date(targetDate)
      newStartDate.setHours(originalHour, originalMinutes, 0, 0)

      const updates: Record<string, any> = {
        [startCol]: newStartDate.toISOString(),
      }

      if (endCol && foundEvent.end) {
        const diffMs = foundEvent.end.getTime() - foundEvent.start.getTime()
        const newEndDate = new Date(newStartDate.getTime() + diffMs)
        updates[endCol] = newEndDate.toISOString()
      }

      onMove(eventId, updates)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const weekDayNames = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

  return (
    <div className="bg-white/80 dark:bg-neutral-900/40 backdrop-blur-xl border border-neutral-200/60 dark:border-neutral-800/60 rounded-[2.5rem] p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.03)] space-y-6">
      {/* Scheduler Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800/50 pb-5">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl shadow-sm border border-indigo-100/50 dark:border-indigo-900/30">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-neutral-900 dark:text-white capitalize">
              {monthNames[currentDate.getMonth()]} De {currentDate.getFullYear()}
            </h2>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 mt-0.5">
              <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" /> {currentView.toUpperCase()} VIEW MODE
            </p>
          </div>
        </div>

        {/* Navigation & Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-950 p-1 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-sm">
            <button
              type="button"
              onClick={() => navigate('prev')}
              className="p-1.5 hover:bg-white dark:hover:bg-neutral-900 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-all active:scale-90 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={jumpToToday}
              className="px-3 py-1 hover:bg-white dark:hover:bg-neutral-900 rounded-lg text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-300 transition-all active:scale-95 border border-transparent hover:border-neutral-200/30 cursor-pointer"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => navigate('next')}
              className="p-1.5 hover:bg-white dark:hover:bg-neutral-900 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-all active:scale-90 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-950 p-1 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-sm hidden md:flex">
            {scales.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => setScale(s.value)}
                title={s.label}
                className={cn(
                  "p-1.5 rounded-lg transition-all cursor-pointer",
                  scale === s.value
                    ? "bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                )}
              >
                {s.icon}
              </button>
            ))}
          </div>

          {/* View Toggle tabs */}
          <div className="flex p-1 bg-neutral-100 dark:bg-neutral-950 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-sm">
            {(['month', 'week', 'day'] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setCurrentView(v)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                  currentView === v
                    ? "bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                )}
              >
                {v === 'month' ? 'Mês' : v === 'week' ? 'Semana' : 'Dia'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Calendar Views */}
      <div className="min-h-[500px]" style={{ zoom: scale }}>
        <AnimatePresence mode="wait">
          {currentView === 'month' && (
            <motion.div
              key="month"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-1"
            >
              {/* Weekday labels */}
              <div className="grid grid-cols-7 gap-2 pb-2">
                {weekDayNames.map(d => (
                  <div key={d} className="text-center py-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                    {d}
                  </div>
                ))}
              </div>

              {/* Month Grid */}
              <div className="grid grid-cols-7 gap-2.5 bg-neutral-50/40 dark:bg-neutral-950/20 rounded-3xl p-1.5 border border-neutral-100 dark:border-neutral-900/30">
                {monthData.map(({ date, isCurrentMonth, isToday }, idx) => {
                  const dayEvents = getEventsForDay(date)
                  return (
                    <div
                      key={\`month-cell-\${idx}\`}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, date)}
                      className={cn(
                        "min-h-[110px] bg-white dark:bg-neutral-900 border rounded-2xl p-2.5 flex flex-col justify-between transition-all group/cell relative overflow-hidden",
                        isCurrentMonth
                          ? "border-neutral-200/60 dark:border-neutral-800/60"
                          : "border-neutral-100 dark:border-neutral-900/20 opacity-40 bg-neutral-50/30 dark:bg-neutral-950/5",
                        isToday && "ring-2 ring-indigo-500/30 border-indigo-500 bg-indigo-50/15 dark:bg-indigo-950/10",
                        "hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-800/80 cursor-default"
                      )}
                    >
                      {/* Day Number Header */}
                      <div className="flex justify-between items-center mb-1">
                        <span className={cn(
                          "text-[11px] font-black w-6 h-6 rounded-full flex items-center justify-center transition-all",
                          isToday
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 rotate-6"
                            : "text-neutral-500 dark:text-neutral-400 group-hover/cell:text-neutral-900 dark:group-hover/cell:text-white"
                        )}>
                          {date.getDate()}
                        </span>

                        {onAdd && (
                          <button
                            type="button"
                            onClick={() => onAdd({ [startCol]: date.toISOString() })}
                            className="opacity-0 group-hover/cell:opacity-100 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 transition-all text-neutral-400 cursor-pointer"
                            title="Adicionar evento neste dia"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Event Chips List */}
                      <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[75px] custom-scrollbar pr-0.5">
                        {dayEvents.map(evt => {
                          const col = getEventColors(evt.color)
                          return (
                            <div
                              key={evt.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, evt.id)}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (onEdit) onEdit(evt.raw)
                                else if (onView) onView(evt.raw)
                              }}
                              className={cn(
                                "group/evt text-[9px] font-bold py-1 px-2 border rounded-lg flex items-center justify-between transition-all cursor-grab active:cursor-grabbing truncate shadow-sm",
                                col.bg,
                                col.text,
                                col.border
                              )}
                            >
                              <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", col.badge)} />
                                <span className="truncate">{evt.title}</span>
                              </div>

                              <div className="flex items-center gap-1 opacity-0 group-hover/evt:opacity-100 transition-opacity flex-shrink-0 ml-1">
                                {onEdit && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onEdit(evt.raw)
                                    }}
                                    className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded cursor-pointer"
                                    title="Editar"
                                  >
                                    <Pencil className="w-2.5 h-2.5 text-blue-500" />
                                  </button>
                                )}
                                {onDelete && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onDelete(evt.raw)
                                    }}
                                    className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded cursor-pointer"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-2.5 h-2.5 text-rose-500" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {currentView === 'week' && (
            <motion.div
              key="week"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid grid-cols-7 gap-3"
            >
              {weekDays.map((date, idx) => {
                const dayEvents = getEventsForDay(date)
                const isToday = checkIfToday(date)
                return (
                  <div
                    key={\`week-col-\${idx}\`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, date)}
                    className={cn(
                      "min-h-[400px] bg-neutral-50/30 dark:bg-neutral-900/10 border rounded-[2rem] p-3 flex flex-col gap-3 transition-all",
                      isToday
                        ? "border-indigo-500 ring-2 ring-indigo-500/10 bg-indigo-500/5"
                        : "border-neutral-200/50 dark:border-neutral-800/50",
                      "hover:shadow-lg hover:border-neutral-300 dark:hover:border-neutral-700"
                    )}
                  >
                    {/* Header */}
                    <div className="flex flex-col items-center py-2 border-b border-neutral-100 dark:border-neutral-800/50">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                        {weekDayNames[date.getDay()]}
                      </span>
                      <span className={cn(
                        "text-lg font-black w-9 h-9 rounded-2xl flex items-center justify-center mt-1 transition-all",
                        isToday
                          ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 rotate-3"
                          : "text-neutral-700 dark:text-neutral-300"
                      )}>
                        {date.getDate()}
                      </span>
                    </div>

                    {/* Event cards inside week view */}
                    <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar">
                      {dayEvents.map(evt => {
                        const col = getEventColors(evt.color)
                        return (
                          <div
                            key={evt.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, evt.id)}
                            onClick={() => {
                              if (onEdit) onEdit(evt.raw)
                              else if (onView) onView(evt.raw)
                            }}
                            className={cn(
                              "group/evt p-3 rounded-2xl border flex flex-col gap-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-all text-left relative",
                              col.bg,
                              col.text,
                              col.border
                            )}
                          >
                            <div className="flex items-center gap-1.5 pr-4">
                              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", col.badge)} />
                              <span className="text-[10px] font-black tracking-tight line-clamp-2 leading-snug">{evt.title}</span>
                            </div>

                            <div className="flex items-center gap-1 text-[8px] opacity-75 font-bold uppercase">
                              <Clock className="w-2.5 h-2.5" />
                              <span>
                                {evt.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/evt:opacity-100 transition-opacity">
                              {onEdit && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onEdit(evt.raw)
                                  }}
                                  className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-blue-500 cursor-pointer"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                              {onDelete && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onDelete(evt.raw)
                                  }}
                                  className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-rose-500 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}

                      {dayEvents.length === 0 && (
                        <div className="flex-1 flex items-center justify-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl h-24 mt-2">
                          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-300 dark:text-neutral-700">Livre</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </motion.div>
          )}

          {currentView === 'day' && (
            <motion.div
              key="day"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-3xl mx-auto border border-neutral-200/50 dark:border-neutral-800/50 rounded-[2rem] overflow-hidden bg-white dark:bg-neutral-950 shadow-md"
            >
              {/* Day Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{currentDate.getDate()}</span>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-neutral-800 dark:text-neutral-200">
                      {weekDayNames[currentDate.getDay()]}
                    </h3>
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-0.5">
                      {monthNames[currentDate.getMonth()]} De {currentDate.getFullYear()}
                    </p>
                  </div>
                </div>

                {onAdd && (
                  <button
                    type="button"
                    onClick={() => onAdd({ [startCol]: currentDate.toISOString() })}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agendar
                  </button>
                )}
              </div>

              {/* Day Hourly list */}
              <div className="divide-y divide-neutral-100 dark:divide-neutral-900 p-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                {getEventsForDay(currentDate).map(evt => {
                  const col = getEventColors(evt.color)
                  return (
                    <div
                      key={evt.id}
                      onClick={() => {
                        if (onEdit) onEdit(evt.raw)
                        else if (onView) onView(evt.raw)
                      }}
                      className="group/evt p-4 rounded-2xl flex items-center justify-between transition-all hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/40 dark:border-neutral-800 rounded-xl text-[10px] font-black text-neutral-500 uppercase">
                          <Clock className="w-3 h-3 text-indigo-500" />
                          <span>{evt.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full", col.badge)} />
                          <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{evt.title}</h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover/evt:opacity-100 transition-opacity">
                        {onEdit && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onEdit(evt.raw)
                            }}
                            className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-blue-500 cursor-pointer"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDelete(evt.raw)
                            }}
                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg text-rose-500 cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}

                {getEventsForDay(currentDate).length === 0 && (
                  <div className="py-12 text-center space-y-2">
                    <CalendarIcon className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-700 animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Nenhum evento agendado para hoje</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Botão de Batching / Paginação Dinâmica (Fiel à Web Produção) */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onLoadMore}
            className="px-6 py-2.5 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-900/50 text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-sm active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <RefreshCcw className="w-3.5 h-3.5 text-indigo-500" />
            Carregar mais {Math.min(50, (totalRecords || 0) - (data?.length || 0))} registros... ({data?.length || 0} de {totalRecords || 0})
          </button>
        </div>
      )}
    </div>
  )
}

export default DynamicScheduler
`
}
