export function generateGanttBoardComponent(files: Map<string, string>) {
  files.set('components/GanttBoard.tsx', generateGanttBoardCode())
}

function generateGanttBoardCode(): string {
  return `'use client'

import React, { useMemo, useRef, useState } from 'react'
import {
  Edit2,
  Eye,
  Trash2,
  CalendarDays,
  Clock,
  LayoutList,
  Minimize2,
  Maximize2,
  ZoomIn,
  LayoutGrid,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  format,
  differenceInDays,
  addDays,
  startOfDay,
  isSameDay,
  isWeekend,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import { DynamicIcon } from '@/app/components/DynamicIcon'

export interface GanttConfig {
  title_field?: string
  titleField?: string
  start_date_field?: string
  startDateField?: string
  end_date_field?: string
  endDateField?: string
  progress_field?: string
  progressField?: string
}

export interface GanttBoardProps {
  data: any[]
  fields?: any[]
  ganttConfig?: GanttConfig
  relationalOptions?: Record<string, Array<{ value: string; label: string }>>
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => Promise<void> | void
  customActions?: any[]
  onCustomAction?: (action: any, row: any) => void
}

export function GanttBoard({
  data = [],
  fields = [],
  ganttConfig = {},
  relationalOptions = {},
  onView,
  onEdit,
  onDelete,
  customActions = [],
  onCustomAction,
}: GanttBoardProps) {
  const getActionColorClasses = (color?: string) => {
    const normalized = color?.toLowerCase() || 'indigo'
    switch (normalized) {
      case 'emerald':
        return {
          text: 'text-emerald-600 dark:text-emerald-400',
          bg: 'bg-emerald-50 dark:bg-emerald-950/30',
          border: 'border-emerald-200 dark:border-emerald-800/50',
          hover: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-300',
        }
      case 'amber':
        return {
          text: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-50 dark:bg-amber-950/30',
          border: 'border-amber-200 dark:border-amber-800/50',
          hover: 'hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-300',
        }
      case 'red':
        return {
          text: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-50 dark:bg-red-950/30',
          border: 'border-red-200 dark:border-red-800/50',
          hover: 'hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300',
        }
      case 'rose':
        return {
          text: 'text-rose-600 dark:text-rose-400',
          bg: 'bg-rose-50 dark:bg-rose-950/30',
          border: 'border-rose-200 dark:border-rose-800/50',
          hover: 'hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-700 dark:hover:text-rose-300',
        }
      case 'fuchsia':
        return {
          text: 'text-fuchsia-600 dark:text-fuchsia-400',
          bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/30',
          border: 'border-fuchsia-200 dark:border-fuchsia-800/50',
          hover: 'hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/30 hover:text-fuchsia-700 dark:hover:text-fuchsia-300',
        }
      case 'sky':
        return {
          text: 'text-sky-600 dark:text-sky-400',
          bg: 'bg-sky-50 dark:bg-sky-950/30',
          border: 'border-sky-200 dark:border-sky-800/50',
          hover: 'hover:bg-sky-100 dark:hover:bg-sky-900/30 hover:text-sky-700 dark:hover:text-sky-300',
        }
      case 'violet':
        return {
          text: 'text-violet-600 dark:text-violet-400',
          bg: 'bg-violet-50 dark:bg-violet-950/30',
          border: 'border-violet-200 dark:border-violet-800/50',
          hover: 'hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-700 dark:hover:text-violet-300',
        }
      case 'neutral':
        return {
          text: 'text-neutral-600 dark:text-neutral-400',
          bg: 'bg-neutral-100 dark:bg-neutral-800/50',
          border: 'border-neutral-200 dark:border-neutral-700/50',
          hover: 'hover:bg-neutral-200 dark:hover:bg-neutral-700/50 hover:text-neutral-800 dark:hover:text-neutral-200',
        }
      case 'indigo':
      default:
        return {
          text: 'text-indigo-600 dark:text-indigo-400',
          bg: 'bg-indigo-50 dark:bg-indigo-950/30',
          border: 'border-indigo-200 dark:border-indigo-800/50',
          hover: 'hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300',
        }
    }
  }

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1.0)
  const scales = [
    { value: 0.8, icon: <Minimize2 className="w-3.5 h-3.5" />, label: 'Pequeno' },
    { value: 1.0, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: 'Normal' },
    { value: 1.2, icon: <Maximize2 className="w-3.5 h-3.5" />, label: 'Grande' },
    { value: 1.5, icon: <ZoomIn className="w-3.5 h-3.5" />, label: 'Extra Grande' },
  ]

  // Layout Constants
  const HEADER_HEIGHT = 60
  const ROW_HEIGHT = 56
  const DAY_WIDTH = 40 * scale
  const SIDEBAR_WIDTH = 280

  const titleCol = ganttConfig.titleField || ganttConfig.title_field || 'title'
  const startCol = ganttConfig.startDateField || ganttConfig.start_date_field || 'start_date'
  const endCol = ganttConfig.endDateField || ganttConfig.end_date_field || 'end_date'
  const progressCol = ganttConfig.progressField || ganttConfig.progress_field

  // 1. Mapeamento de tarefas
  const tasks = useMemo(() => {
    if (!data || data.length === 0) return []

    return data.map((row, index) => {
      const rawTitle = row[titleCol] ?? row[titleCol.replace(/_/g, '.')] ?? row.nome ?? row.descricao ?? row.title ?? ''
      let title = String(rawTitle || '')
      if (relationalOptions[titleCol]) {
        const found = relationalOptions[titleCol].find((opt: any) => opt.value === String(rawTitle))
        if (found) title = found.label
      }
      if (!title) title = 'Tarefa #' + (row.id ?? index + 1)

      const rawStart = row[startCol] ?? row[startCol.replace(/_/g, '.')] ?? row.created_at
      const rawEnd = row[endCol] ?? row[endCol.replace(/_/g, '.')] ?? rawStart

      const startDate = rawStart ? startOfDay(new Date(rawStart)) : null
      let endDate = rawEnd ? startOfDay(new Date(rawEnd)) : null

      if (startDate && endDate && endDate < startDate) {
        endDate = startDate
      }

      const rawProgress = progressCol ? (row[progressCol] ?? row[progressCol.replace(/_/g, '.')]) : null
      const progress = rawProgress !== null && rawProgress !== undefined ? Number(rawProgress) || 0 : null

      return {
        id: row.id ?? index,
        raw: row,
        title,
        startDate,
        endDate: endDate || startDate,
        progress,
        colorClass: 'bg-indigo-500',
      }
    }).filter(t => t.startDate && !isNaN(t.startDate.getTime()) && t.endDate && !isNaN(t.endDate.getTime()))
      .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime())
  }, [data, titleCol, startCol, endCol, progressCol, relationalOptions])

  // 2. Limites da linha do tempo
  const timelineBounds = useMemo(() => {
    if (tasks.length === 0) {
      const today = startOfDay(new Date())
      return { start: today, end: addDays(today, 30), totalDays: 30 }
    }

    let minDate = tasks[0].startDate!
    let maxDate = tasks[0].endDate!

    tasks.forEach(t => {
      if (t.startDate! < minDate) minDate = t.startDate!
      if (t.endDate! > maxDate) maxDate = t.endDate!
    })

    const paddedStart = addDays(minDate, -7)
    const paddedEnd = addDays(maxDate, 14)
    const totalDays = differenceInDays(paddedEnd, paddedStart) + 1

    return { start: paddedStart, end: paddedEnd, totalDays }
  }, [tasks])

  // 3. Cabeçalho da Linha do Tempo (Meses e Dias)
  const timelineHeader = useMemo(() => {
    const days = eachDayOfInterval({ start: timelineBounds.start, end: timelineBounds.end })
    const months: { date: Date; daysCount: number; label: string }[] = []
    let currentMonth: Date | null = null
    let daysInMonth = 0

    days.forEach(day => {
      const monthStart = startOfMonth(day)
      if (!currentMonth || currentMonth.getTime() !== monthStart.getTime()) {
        if (currentMonth) {
          months.push({
            date: currentMonth,
            daysCount: daysInMonth,
            label: format(currentMonth, 'MMMM yyyy', { locale: ptBR }),
          })
        }
        currentMonth = monthStart
        daysInMonth = 1
      } else {
        daysInMonth++
      }
    })

    if (currentMonth) {
      months.push({
        date: currentMonth,
        daysCount: daysInMonth,
        label: format(currentMonth, 'MMMM yyyy', { locale: ptBR }),
      })
    }

    return { days, months }
  }, [timelineBounds])

  if (tasks.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center">
          <CalendarDays className="w-8 h-8 text-neutral-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Nenhum dado para o Cronograma</h3>
          <p className="text-xs text-neutral-500 mt-1">
            Verifique as configurações de data ou adicione registros com intervalo válido.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
      {/* TOOLBAR */}
      <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800/50 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
            <LayoutList className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-neutral-900 dark:text-white">Cronograma do Projeto</h3>
            <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-widest">{tasks.length} Tarefas Mapeadas</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (scrollContainerRef.current) {
                const todayIndex = timelineHeader.days.findIndex(d => isSameDay(d, new Date()))
                if (todayIndex > -1) {
                  scrollContainerRef.current.scrollTo({
                    left: (todayIndex * DAY_WIDTH) - (scrollContainerRef.current.clientWidth / 2),
                    behavior: 'smooth',
                  })
                }
              }
            }}
            className="px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
          >
            Hoje
          </button>
          <div className="flex items-center bg-white dark:bg-neutral-800 p-1 rounded-xl border border-neutral-200 dark:border-neutral-700">
            {scales.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => setScale(s.value)}
                title={s.label}
                className={cn(
                  "p-1.5 rounded-lg transition-all cursor-pointer",
                  scale === s.value
                    ? "bg-neutral-100 dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                )}
              >
                {s.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex relative w-full h-[600px] overflow-hidden">
        {/* SIDEBAR - TASKS LIST */}
        <div
          className="flex-shrink-0 border-r border-neutral-200 dark:border-neutral-800 z-10 bg-white dark:bg-[#0a0a0a] shadow-[4px_0_12px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_12px_rgba(0,0,0,0.2)]"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {/* Sidebar Header */}
          <div
            className="border-b border-neutral-200 dark:border-neutral-800 px-4 flex items-center"
            style={{ height: HEADER_HEIGHT }}
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Título da Tarefa</span>
          </div>

          {/* Sidebar Rows */}
          <div className="overflow-y-auto no-scrollbar" style={{ height: \`calc(100% - \${HEADER_HEIGHT}px)\` }}>
            {tasks.map((task, i) => (
              <div
                key={\`sidebar-row-\${task.id}\`}
                className="group border-b border-neutral-100 dark:border-neutral-800/50 px-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition-colors cursor-pointer"
                style={{ height: ROW_HEIGHT }}
                onClick={() => onView && onView(task.raw)}
              >
                <div className="flex-1 min-w-0 pr-4">
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate">{task.title}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-medium text-neutral-400">
                      {format(task.startDate!, 'dd MMM', { locale: ptBR })} - {format(task.endDate!, 'dd MMM', { locale: ptBR })}
                    </span>
                    {task.progress !== null && (
                      <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
                        {Math.round(task.progress)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity" onClick={e => e.stopPropagation()}>
                  {onView && (
                    <button
                      type="button"
                      onClick={() => onView(task.raw)}
                      className="p-1.5 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors cursor-pointer"
                      title="Visualizar"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(task.raw)}
                      className="p-1.5 text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(task.raw)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {customActions.map(action => {
                    const colors = getActionColorClasses(action.color)
                    return (
                      <button
                        key={action.id}
                        type="button"
                        title={action.label}
                        onClick={() => onCustomAction?.(action, task.raw)}
                        className={cn(
                          "p-1.5 rounded-md transition-all active:scale-90 cursor-pointer",
                          colors.text,
                          colors.hover
                        )}
                      >
                        {action.icon ? <DynamicIcon icon={action.icon} size={14} /> : <Zap className="w-3.5 h-3.5" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TIMELINE CANVAS */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto relative custom-scrollbar bg-[#fafafa] dark:bg-[#0c0c0c]"
        >
          <div style={{ width: timelineBounds.totalDays * DAY_WIDTH, minHeight: '100%' }}>
            {/* Timeline Header (Months & Days) */}
            <div
              className="sticky top-0 z-20 bg-[#fafafa] dark:bg-[#0c0c0c] border-b border-neutral-200 dark:border-neutral-800"
              style={{ height: HEADER_HEIGHT }}
            >
              {/* Months Row */}
              <div className="flex border-b border-neutral-100 dark:border-neutral-800/50" style={{ height: 24 }}>
                {timelineHeader.months.map((month, i) => (
                  <div
                    key={\`month-\${i}\`}
                    className="flex items-center px-3 border-r border-neutral-100 dark:border-neutral-800/50"
                    style={{ width: month.daysCount * DAY_WIDTH }}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 dark:text-neutral-400 capitalize">
                      {month.label}
                    </span>
                  </div>
                ))}
              </div>
              {/* Days Row */}
              <div className="flex" style={{ height: HEADER_HEIGHT - 24 }}>
                {timelineHeader.days.map((day, i) => {
                  const isWknd = isWeekend(day)
                  const isToday = isSameDay(day, new Date())
                  return (
                    <div
                      key={\`day-header-\${i}\`}
                      className={cn(
                        "flex flex-col items-center justify-center border-r border-neutral-100 dark:border-neutral-800/50 relative",
                        isWknd && "bg-neutral-100/50 dark:bg-neutral-900/30"
                      )}
                      style={{ width: DAY_WIDTH }}
                    >
                      {isToday && (
                        <div className="absolute top-0 w-full h-0.5 bg-indigo-500" />
                      )}
                      <span className={cn(
                        "text-[9px] font-bold uppercase",
                        isToday ? "text-indigo-600 dark:text-indigo-400" : "text-neutral-400"
                      )}>
                        {format(day, 'E', { locale: ptBR }).charAt(0)}
                      </span>
                      <span className={cn(
                        "text-xs font-black",
                        isToday ? "text-indigo-600 dark:text-indigo-400" : (isWknd ? "text-neutral-400" : "text-neutral-700 dark:text-neutral-300")
                      )}>
                        {format(day, 'dd')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Grid Background Lines & Today Line */}
            <div className="absolute top-[60px] bottom-0 left-0 right-0 pointer-events-none flex">
              {timelineHeader.days.map((day, i) => {
                const isWknd = isWeekend(day)
                const isToday = isSameDay(day, new Date())
                return (
                  <div
                    key={\`grid-\${i}\`}
                    className={cn(
                      "border-r border-neutral-100 dark:border-neutral-800/30",
                      isWknd && "bg-neutral-100/30 dark:bg-neutral-900/20"
                    )}
                    style={{ width: DAY_WIDTH, height: '100%' }}
                  >
                    {isToday && (
                      <div className="w-[1px] h-full bg-indigo-500/50 mx-auto relative z-0">
                        <div className="absolute top-0 -left-1 w-2 h-2 rounded-full bg-indigo-500" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Timeline Rows (Task Bars) */}
            <div className="relative z-10" style={{ paddingBottom: 40 }}>
              {tasks.map((task, rowIndex) => {
                const startOffsetDays = differenceInDays(task.startDate!, timelineBounds.start)
                const durationDays = differenceInDays(task.endDate!, task.startDate!) + 1

                const leftPx = startOffsetDays * DAY_WIDTH
                const widthPx = durationDays * DAY_WIDTH

                return (
                  <div
                    key={\`timeline-row-\${task.id}\`}
                    className="relative border-b border-transparent group hover:bg-neutral-100/30 dark:hover:bg-neutral-800/30 transition-colors"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Task Bar */}
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: widthPx }}
                      transition={{ duration: 0.5, delay: rowIndex * 0.04 }}
                      className="absolute top-1/2 -translate-y-1/2 h-8 rounded-lg shadow-sm flex items-center group/bar overflow-hidden cursor-pointer"
                      style={{
                        left: leftPx,
                        minWidth: Math.max(widthPx, 8),
                      }}
                      onClick={() => onView && onView(task.raw)}
                    >
                      {/* Bar Background */}
                      <div className={cn("absolute inset-0 opacity-20", task.colorClass)} />

                      {/* Border outline */}
                      <div className="absolute inset-0 border rounded-lg opacity-40 border-indigo-600 dark:border-indigo-400" />

                      {/* Progress Fill */}
                      {task.progress !== null && (
                        <div
                          className={cn("absolute left-0 top-0 bottom-0 opacity-40 transition-all", task.colorClass)}
                          style={{ width: \`\${Math.max(0, Math.min(100, task.progress))}%\` }}
                        />
                      )}

                      {/* Task Title inside bar (if fits) */}
                      <span className="relative z-10 text-[10px] font-black text-indigo-900 dark:text-indigo-100 px-3 truncate drop-shadow-sm">
                        {widthPx > 90 ? task.title : ''}
                      </span>
                    </motion.div>

                    {/* Task Title outside bar (if too small) */}
                    {widthPx <= 90 && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 text-[10px] font-bold text-neutral-600 dark:text-neutral-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ left: leftPx + widthPx + 8 }}
                      >
                        {task.title}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GanttBoard
`
}
