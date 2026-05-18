'use client'

import { useState, useMemo } from 'react'
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
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface DynamicSchedulerProps {
  data: any[]
  fields: any[]
  schedulerConfig: {
    title_field?: string
    start_date_field?: string
    end_date_field?: string
    color_field?: string
  }
  onMove: (recordId: string, newValue: any) => void
  onAdd?: (initialData?: any) => void
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => void
  dictionary?: any
}

export default function DynamicScheduler({
  data,
  fields,
  schedulerConfig,
  onMove,
  onAdd,
  onView,
  onEdit,
  onDelete,
  dictionary = {}
}: DynamicSchedulerProps) {
  const [currentView, setCurrentView] = useState<'month' | 'week' | 'day'>('month')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())

  // Mapeia colunas do banco com base no schedulerConfig
  const titleCol = fields.find(f => f.id === schedulerConfig.title_field)?.db_column_name || 'title'
  const startCol = fields.find(f => f.id === schedulerConfig.start_date_field)?.db_column_name || 'start_date'
  const endCol = fields.find(f => f.id === schedulerConfig.end_date_field)?.db_column_name || 'end_date'
  const colorCol = fields.find(f => f.id === schedulerConfig.color_field)?.db_column_name || 'color'

  // Auxiliar para pegar valores aninhados (em caso de joins)
  const getNestedValue = (obj: any, path: string) => {
    if (!path) return undefined
    return path.split('.').reduce((acc, part) => acc && acc[part], obj)
  }

  // Parse de datas com segurança
  const parseEventDate = (dateVal: any): Date | null => {
    if (!dateVal) return null
    const d = new Date(dateVal)
    return isNaN(d.getTime()) ? null : d
  }

  // Eventos formatados para o calendário
  const events = useMemo(() => {
    return data.map(item => {
      const start = parseEventDate(getNestedValue(item, startCol))
      const end = parseEventDate(getNestedValue(item, endCol)) || start
      return {
        raw: item,
        id: String(item._key || item.id || item.ID),
        title: String(getNestedValue(item, titleCol) || 'Sem Título'),
        start,
        end,
        color: String(getNestedValue(item, colorCol) || 'default')
      }
    }).filter(evt => evt.start !== null) as any[]
  }, [data, titleCol, startCol, endCol, colorCol])

  // Navegação do calendário
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

  // Auxiliares de Datas para renderização do Mês
  const monthData = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDayIndex = new Date(year, month, 1).getDay()
    const totalDays = new Date(year, month + 1, 0).getDate()
    const prevMonthDays = new Date(year, month, 0).getDate()

    const days: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = []

    // Dias do mês anterior para completar a primeira semana
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i)
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: checkIfToday(d)
      })
    }

    // Dias do mês atual
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i)
      days.push({
        date: d,
        isCurrentMonth: true,
        isToday: checkIfToday(d)
      })
    }

    // Dias do próximo mês para fechar a grade (múltiplo de 7)
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: checkIfToday(d)
      })
    }

    return days
  }, [currentDate])

  // Auxiliares de Datas para a Semana
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate)
    const day = startOfWeek.getDay()
    // Ajusta para o domingo da semana atual
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
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
  }

  // Filtra eventos de um dia específico
  const getEventsForDay = (d: Date) => {
    return events.filter(evt => {
      const s = evt.start
      return s.getDate() === d.getDate() &&
        s.getMonth() === d.getMonth() &&
        s.getFullYear() === d.getFullYear()
    })
  }

  // Estilos de cor dos cards dos eventos com paleta tailandesa/vibrante
  const getEventColors = (colorName: string) => {
    const colors: Record<string, { bg: string; text: string; border: string; badge: string }> = {
      default: { 
        bg: 'bg-indigo-50/70 hover:bg-indigo-100/80 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30',
        text: 'text-indigo-700 dark:text-indigo-300',
        border: 'border-indigo-100 dark:border-indigo-900/50',
        badge: 'bg-indigo-500'
      },
      danger: { 
        bg: 'bg-rose-50/70 hover:bg-rose-100/80 dark:bg-rose-950/20 dark:hover:bg-rose-900/30',
        text: 'text-rose-700 dark:text-rose-300',
        border: 'border-rose-100 dark:border-rose-900/50',
        badge: 'bg-rose-500'
      },
      warning: { 
        bg: 'bg-amber-50/70 hover:bg-amber-100/80 dark:bg-amber-950/20 dark:hover:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-100 dark:border-amber-900/50',
        badge: 'bg-amber-500'
      },
      success: { 
        bg: 'bg-emerald-50/70 hover:bg-emerald-100/80 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-100 dark:border-emerald-900/50',
        badge: 'bg-emerald-500'
      },
      info: { 
        bg: 'bg-sky-50/70 hover:bg-sky-100/80 dark:bg-sky-950/20 dark:hover:bg-sky-900/30',
        text: 'text-sky-700 dark:text-sky-300',
        border: 'border-sky-100 dark:border-sky-900/50',
        badge: 'bg-sky-500'
      }
    }
    const cleanKey = String(colorName).toLowerCase()
    if (cleanKey.includes('ativ') || cleanKey.includes('sim') || cleanKey.includes('green')) return colors.success
    if (cleanKey.includes('inativ') || cleanKey.includes('nao') || cleanKey.includes('red')) return colors.danger
    if (cleanKey.includes('pendent') || cleanKey.includes('yellow')) return colors.warning
    if (cleanKey.includes('blue') || cleanKey.includes('andamento')) return colors.info

    return colors[cleanKey] || colors.default
  }

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, eventId: string) => {
    e.dataTransfer.setData('text/plain', eventId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault()
    const eventId = e.dataTransfer.getData('text/plain')
    const foundEvent = events.find(evt => evt.id === eventId)
    
    if (foundEvent) {
      // Cria uma nova data combinando o targetDate com a hora original do evento
      const originalHour = foundEvent.start.getHours()
      const originalMinutes = foundEvent.start.getMinutes()
      
      const newStartDate = new Date(targetDate)
      newStartDate.setHours(originalHour, originalMinutes, 0, 0)

      // Se houver campo de data de fim, ajusta a data final proporcionalmente
      const updates: Record<string, any> = {
        [startCol]: newStartDate.toISOString()
      }

      if (schedulerConfig.end_date_field && foundEvent.end) {
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

  const formatMonthName = (date: Date) => {
    return date.toLocaleDateString(dictionary.locale || 'pt-BR', { month: 'long', year: 'numeric' })
  }

  const weekDayNames = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

  return (
    <div className="bg-white/60 dark:bg-neutral-900/30 backdrop-blur-xl border border-neutral-200/50 dark:border-neutral-800/50 rounded-[2.5rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.03)] space-y-6">
      {/* Scheduler Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800/50 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl shadow-sm border border-indigo-100/50 dark:border-indigo-900/30">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black tracking-tight text-neutral-900 dark:text-white capitalize">
              {formatMonthName(currentDate)}
            </h2>
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-0.5">
              <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" /> {currentView} view mode
            </p>
          </div>
        </div>

        {/* Navigation & Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-950 p-1 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-sm">
            <button 
              onClick={() => navigate('prev')}
              className="p-1.5 hover:bg-white dark:hover:bg-neutral-900 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-all active:scale-90"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={jumpToToday}
              className="px-3 py-1 hover:bg-white dark:hover:bg-neutral-900 rounded-lg text-[9px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-300 transition-all active:scale-95 border border-transparent hover:border-neutral-200/30"
            >
              Hoje
            </button>
            <button 
              onClick={() => navigate('next')}
              className="p-1.5 hover:bg-white dark:hover:bg-neutral-900 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-all active:scale-90"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* View Toggle tabs */}
          <div className="flex p-1 bg-neutral-100 dark:bg-neutral-950 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-sm">
            {(['month', 'week', 'day'] as const).map(v => (
              <button
                key={v}
                onClick={() => setCurrentView(v)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
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
      <div className="min-h-[500px]">
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
              <div className="grid grid-cols-7 gap-1 pb-2">
                {weekDayNames.map(d => (
                  <div key={d} className="text-center py-2 text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400">
                    {d}
                  </div>
                ))}
              </div>

              {/* Month Grid */}
              <div className="grid grid-cols-7 gap-2 bg-neutral-50/20 dark:bg-neutral-950/10 rounded-3xl p-1 border border-neutral-100 dark:border-neutral-900/30">
                {monthData.map(({ date, isCurrentMonth, isToday }, idx) => {
                  const dayEvents = getEventsForDay(date)
                  return (
                    <div
                      key={`month-cell-${idx}`}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, date)}
                      className={cn(
                        "min-h-[110px] bg-white dark:bg-neutral-900 border rounded-2xl p-2.5 flex flex-col justify-between transition-all group/cell relative overflow-hidden",
                        isCurrentMonth 
                          ? "border-neutral-200/50 dark:border-neutral-800/50" 
                          : "border-neutral-100 dark:border-neutral-900/20 opacity-40 bg-neutral-50/30 dark:bg-neutral-950/5",
                        isToday && "ring-2 ring-indigo-500/20 border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/5",
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
                        
                        {/* Plus button to quickly create event */}
                        <button 
                          onClick={() => onAdd?.({ [startCol]: date.toISOString() })}
                          className="opacity-0 group-hover/cell:opacity-100 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 transition-all text-neutral-400"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
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
                                onEdit?.(evt.raw)
                              }}
                              className={cn(
                                "text-[9px] font-bold py-1 px-2 border rounded-lg flex items-center gap-1.5 transition-all cursor-grab active:cursor-grabbing truncate shadow-sm",
                                col.bg,
                                col.text,
                                col.border
                              )}
                            >
                              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", col.badge)}></span>
                              <span className="truncate">{evt.title}</span>
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
                    key={`week-col-${idx}`}
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
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400">
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
                    <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto custom-scrollbar">
                      {dayEvents.map(evt => {
                        const col = getEventColors(evt.color)
                        return (
                          <div
                            key={evt.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, evt.id)}
                            onClick={() => onEdit?.(evt.raw)}
                            className={cn(
                              "p-3 rounded-2xl border flex flex-col gap-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-all text-left",
                              col.bg,
                              col.text,
                              col.border
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={cn("w-2 h-2 rounded-full", col.badge)}></span>
                              <span className="text-[10px] font-black tracking-tight line-clamp-2 leading-snug">{evt.title}</span>
                            </div>
                            
                            <div className="flex items-center gap-1 text-[8px] opacity-75 font-bold uppercase">
                              <Clock className="w-2.5 h-2.5" />
                              <span>
                                {evt.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        )
                      })}

                      {dayEvents.length === 0 && (
                        <div className="flex-1 flex items-center justify-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl h-24 mt-2">
                          <p className="text-[8px] font-black uppercase tracking-widest text-neutral-300 dark:text-neutral-700">Livre</p>
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
                    <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mt-0.5">
                      {currentDate.toLocaleDateString(dictionary.locale || 'pt-BR', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => onAdd?.({ [startCol]: currentDate.toISOString() })}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95"
                >
                  <Plus className="w-3 h-3" /> Agendar
                </button>
              </div>

              {/* Day Hourly list */}
              <div className="divide-y divide-neutral-100 dark:divide-neutral-900 p-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                {getEventsForDay(currentDate).map(evt => {
                  const col = getEventColors(evt.color)
                  return (
                    <div 
                      key={evt.id}
                      onClick={() => onEdit?.(evt.raw)}
                      className={cn(
                        "group/evt p-4 rounded-2xl flex items-center justify-between transition-all hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/40 dark:border-neutral-800 rounded-xl text-[9px] font-black text-neutral-500 uppercase">
                          <Clock className="w-3 h-3 text-indigo-500" />
                          <span>{evt.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full", col.badge)}></span>
                          <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 leading-tight">{evt.title}</h4>
                        </div>
                      </div>

                      <button className="opacity-0 group-hover/evt:opacity-100 p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg text-neutral-400">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
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
    </div>
  )
}
