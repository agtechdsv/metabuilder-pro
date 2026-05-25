'use client'

import React from 'react'
import { Calendar, Clock, Edit2, Eye, Trash2, Tag, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { format } from 'date-fns'
import { ptBR, es, enUS } from 'date-fns/locale'

interface DynamicTimelineProps {
  data: any[]
  fields: any[]
  timelineConfig: {
    date_field: string
    title_field: string
    desc_field?: string
    icon_field?: string
  }
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => void
  dictionary?: any
}

export default function DynamicTimeline({
  data,
  fields,
  timelineConfig,
  onView,
  onEdit,
  onDelete,
  dictionary
}: DynamicTimelineProps) {
  const { t, language } = useI18n()

  const dateLocale = language === 'pt' ? ptBR : language === 'es' ? es : enUS

  if (!timelineConfig?.date_field || !timelineConfig?.title_field) {
    return (
      <div className="flex items-center justify-center p-12 text-neutral-400 bg-neutral-50 dark:bg-neutral-900/30 rounded-3xl border border-neutral-200 dark:border-neutral-800">
        Configuração da Linha do Tempo incompleta.
      </div>
    )
  }

  // Obter chaves limpas (sem o prefixo da tabela, caso exista)
  const getDateFieldKey = (id: string) => {
    const field = fields.find(f => f.id === id)
    return field?.db_column_name || id
  }

  const dateField = getDateFieldKey(timelineConfig.date_field)
  const titleField = getDateFieldKey(timelineConfig.title_field)
  const descField = timelineConfig.desc_field ? getDateFieldKey(timelineConfig.desc_field) : null
  const iconField = timelineConfig.icon_field ? getDateFieldKey(timelineConfig.icon_field) : null

  // Ordenar dados por data (mais recente primeiro, ou mais antigo primeiro? Geralmente timeline é mais recente primeiro)
  const sortedData = [...data].sort((a, b) => {
    const dateA = new Date(a[dateField])
    const dateB = new Date(b[dateField])
    return dateB.getTime() - dateA.getTime()
  })

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      return format(date, "d 'de' MMMM, yyyy • HH:mm", { locale: dateLocale })
    } catch (e) {
      return dateStr
    }
  }

  return (
    <div className="relative max-w-4xl mx-auto py-8">
      {/* Linha vertical principal */}
      <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500/20 via-indigo-500/10 to-transparent -translate-x-1/2 rounded-full" />

      <div className="space-y-12">
        {sortedData.map((item, index) => {
          const isEven = index % 2 === 0
          const primaryKey = item._key || item.id || item.ID || index
          
          const rawDate = item[dateField]
          const title = item[titleField] || 'Sem Título'
          const desc = descField ? item[descField] : null
          const iconStatus = iconField ? item[iconField] : null

          return (
            <div key={`timeline-item-${primaryKey}`} className="relative flex items-center justify-between md:justify-normal w-full group">
              
              {/* Círculo do Nó (Node) */}
              <div className="absolute left-8 md:left-1/2 w-4 h-4 bg-white dark:bg-neutral-900 border-4 border-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.4)] -translate-x-1/2 group-hover:scale-150 transition-transform z-10" />

              {/* Lado Esquerdo (Vazio ou Card) */}
              <div className={cn("hidden md:flex w-1/2", isEven ? "pr-12 justify-end" : "pl-12 justify-start order-2")}>
                {/* Aqui renderizamos o conteúdo nos desktops */}
                <div className={cn(
                  "bg-white dark:bg-neutral-900/80 backdrop-blur-sm p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-xl shadow-neutral-200/20 dark:shadow-none hover:border-indigo-500/30 hover:shadow-indigo-500/10 transition-all max-w-[400px] w-full",
                  isEven ? "text-right" : "text-left"
                )}>
                  <div className={cn("flex items-center gap-2 mb-3", isEven ? "justify-end" : "justify-start")}>
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {formatDate(rawDate)}
                    </span>
                    {iconStatus && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-3 py-1 rounded-full flex items-center gap-1.5 truncate max-w-[120px]">
                        <Tag className="w-3 h-3" />
                        {String(iconStatus)}
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white mb-2 leading-tight">
                    {String(title)}
                  </h3>
                  
                  {desc && (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-3 mb-4 leading-relaxed">
                      {String(desc)}
                    </p>
                  )}

                  <div className={cn("flex items-center gap-2 mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800/50", isEven ? "justify-end" : "justify-start")}>
                    {onView && (
                      <button onClick={() => onView(item)} className="p-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-xl transition-all shadow-sm">
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    {onEdit && (
                      <button onClick={() => onEdit(item)} className="p-2 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 rounded-xl transition-all shadow-sm">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {onDelete && (
                      <button onClick={() => onDelete(item)} className="p-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 rounded-xl transition-all shadow-sm">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Layout Mobile (Sempre à direita da linha) */}
              <div className="md:hidden flex w-full pl-16 pr-4">
                <div className="bg-white dark:bg-neutral-900/80 backdrop-blur-sm p-5 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-xl shadow-neutral-200/20 dark:shadow-none w-full relative">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {formatDate(rawDate)}
                    </span>
                    {iconStatus && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-3 py-1 rounded-full flex items-center gap-1.5 truncate max-w-[120px]">
                        <Tag className="w-3 h-3" />
                        {String(iconStatus)}
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-base font-extrabold text-neutral-900 dark:text-white mb-2 leading-tight">
                    {String(title)}
                  </h3>
                  
                  {desc && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-3 mb-4 leading-relaxed">
                      {String(desc)}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800/50">
                    {onView && (
                      <button onClick={() => onView(item)} className="p-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-xl transition-all shadow-sm">
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    {onEdit && (
                      <button onClick={() => onEdit(item)} className="p-2 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 rounded-xl transition-all shadow-sm">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {onDelete && (
                      <button onClick={() => onDelete(item)} className="p-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 rounded-xl transition-all shadow-sm">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )
        })}
        {sortedData.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-neutral-300 dark:text-neutral-600" />
            </div>
            <h3 className="text-lg font-bold text-neutral-400 dark:text-neutral-500">Nenhum registro encontrado</h3>
          </div>
        )}
      </div>
    </div>
  )
}
