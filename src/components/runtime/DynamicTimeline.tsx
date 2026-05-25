'use client'

import React from 'react'
import { Calendar, Clock, Edit2, Eye, Trash2, Tag, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { format } from 'date-fns'
import { ptBR, es, enUS } from 'date-fns/locale'
import { motion } from 'framer-motion'

interface DynamicTimelineProps {
  data: any[]
  fields: any[]
  timelineConfig: {
    date_field: string
    title_field: string
    desc_field?: string
    icon_field?: string
    layout_direction?: 'vertical' | 'horizontal'
    layout_mode?: 'alternating' | 'same_side'
    animated?: boolean
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

  const direction = timelineConfig.layout_direction || 'vertical'
  const mode = timelineConfig.layout_mode || 'alternating'
  // O Wizard mostra 'true' por padrão se não for definido. Então assumimos true se não for explicitamente false.
  const animated = timelineConfig.animated !== false

  // Ordenar dados
  // Vertical e Horizontal: mais antigo primeiro (ascending)
  // Para que a linha do tempo seja lida na ordem cronológica (Cima -> Baixo ou Esquerda -> Direita)
  const sortedData = [...data].sort((a, b) => {
    const dateA = new Date(a[dateField])
    const dateB = new Date(b[dateField])
    return dateA.getTime() - dateB.getTime() // Mais antigo primeiro (Cronológico)
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


  const renderCardContent = (item: any, title: any, desc: any, iconStatus: any, rawDate: any, alignRight: boolean = false) => (
    <div className={cn("bg-white dark:bg-neutral-900/80 backdrop-blur-sm p-4 md:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xl shadow-neutral-200/20 dark:shadow-none hover:border-indigo-500/30 hover:shadow-indigo-500/10 transition-all w-full", alignRight ? "text-right" : "text-left")}>
      <div className={cn("flex flex-wrap items-center gap-2 mb-2", alignRight ? "justify-end" : "justify-start")}>
        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-full flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          {formatDate(rawDate)}
        </span>
        {iconStatus && (
          <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-full flex items-center gap-1.5 truncate max-w-[120px]">
            <Tag className="w-3 h-3" />
            {String(iconStatus)}
          </span>
        )}
      </div>
      
      <h3 className="text-sm md:text-base font-bold text-neutral-900 dark:text-white mb-1.5 leading-tight">
        {String(title)}
      </h3>
      
      {desc && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-3 mb-3 leading-relaxed">
          {String(desc)}
        </p>
      )}

      <div className={cn("flex items-center gap-2 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/50", alignRight ? "justify-end" : "justify-start")}>
        {onView && (
          <button onClick={() => onView(item)} className="p-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-lg transition-all shadow-sm">
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
        {onEdit && (
          <button onClick={() => onEdit(item)} className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 rounded-lg transition-all shadow-sm">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
        {onDelete && (
          <button onClick={() => onDelete(item)} className="p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 rounded-lg transition-all shadow-sm">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )

  if (direction === 'horizontal') {
    return (
      <div className="relative w-full overflow-x-auto custom-scrollbar py-8 px-4">
        <div className="relative min-w-max flex items-center gap-8 px-4" style={{ minHeight: mode === 'alternating' ? '450px' : '300px' }}>
          {/* Linha horizontal principal */}
          <motion.div 
            initial={animated ? { scaleX: 0 } : false}
            animate={animated ? { scaleX: 1 } : false}
            transition={{ duration: sortedData.length * 0.4 + 0.5, ease: "linear" }}
            className={cn("absolute left-4 right-4 h-1 bg-gradient-to-r from-indigo-500/20 via-indigo-500/10 to-transparent -translate-y-1/2 rounded-full origin-left",
              mode === 'alternating' ? "top-1/2" : "top-[24px]"
            )} 
          />

          {sortedData.map((item, index) => {
            const isEven = index % 2 === 0
            const primaryKey = item._key || item.id || item.ID || index
            
            const rawDate = item[dateField]
            const title = item[titleField] || 'Sem Título'
            const desc = descField ? item[descField] : null
            const iconStatus = iconField ? item[iconField] : null

            return (
              <div key={`timeline-item-${primaryKey}`} className={cn("relative flex flex-col w-[300px] md:w-[350px] group", mode === 'alternating' ? "h-[450px]" : "h-full pt-[40px]")}>
                {/* Node */}
                <motion.div 
                  initial={animated ? { scale: 0, opacity: 0 } : false}
                  animate={animated ? { scale: 1, opacity: 1 } : false}
                  transition={{ delay: animated ? index * 0.4 + 0.4 : 0, duration: 0.3, type: "spring" }}
                  className={cn("absolute left-1/2 w-4 h-4 bg-white dark:bg-neutral-900 border-4 border-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.4)] -translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform z-10",
                    mode === 'alternating' ? "top-1/2" : "top-[24px]"
                  )} 
                />

                {/* Content */}
                <motion.div 
                  initial={animated ? { y: 20, opacity: 0 } : false}
                  animate={animated ? { y: 0, opacity: 1 } : false}
                  transition={{ delay: animated ? index * 0.4 + 0.5 : 0, duration: 0.4 }}
                  className={cn("w-full flex", mode === 'alternating' ? (isEven ? "h-1/2 justify-end flex-col pb-8" : "h-1/2 mt-auto justify-start flex-col pt-8") : "mt-8")}
                >
                  {renderCardContent(item, title, desc, iconStatus, rawDate, false)}
                </motion.div>
              </div>
            )
          })}
          
          {sortedData.length === 0 && (
            <div className="text-center py-20 w-full absolute left-0 right-0">
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

  // VERTICAL
  return (
    <div className="relative max-w-4xl mx-auto py-8">
      {/* Linha vertical principal */}
      <motion.div 
        initial={animated ? { scaleY: 0 } : false}
        animate={animated ? { scaleY: 1 } : false}
        transition={{ duration: sortedData.length * 0.4 + 0.5, ease: "linear" }}
        className={cn("absolute top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500/20 via-indigo-500/10 to-transparent -translate-x-1/2 rounded-full origin-top",
          mode === 'same_side' ? "left-8" : "left-8 md:left-1/2"
        )} 
      />

      <div className="space-y-12">
        {sortedData.map((item, index) => {
          const isEven = index % 2 === 0
          const primaryKey = item._key || item.id || item.ID || index
          
          const rawDate = item[dateField]
          const title = item[titleField] || 'Sem Título'
          const desc = descField ? item[descField] : null
          const iconStatus = iconField ? item[iconField] : null

          return (
            <div key={`timeline-item-${primaryKey}`} className="relative flex items-start justify-between md:justify-normal w-full group">
              
              {/* Círculo do Nó (Node) */}
              <motion.div 
                initial={animated ? { scale: 0, opacity: 0 } : false}
                animate={animated ? { scale: 1, opacity: 1 } : false}
                transition={{ delay: animated ? index * 0.4 + 0.4 : 0, duration: 0.3, type: "spring" }}
                className={cn("absolute w-4 h-4 bg-white dark:bg-neutral-900 border-4 border-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.4)] -translate-x-1/2 group-hover:scale-150 transition-transform z-10 mt-8",
                  mode === 'same_side' ? "left-8" : "left-8 md:left-1/2"
                )} 
              />

              {/* Lado Esquerdo/Direito Alternado (Apenas se mode for alternating) */}
              {mode === 'alternating' && (
                <motion.div 
                  initial={animated ? { x: isEven ? 20 : -20, opacity: 0 } : false}
                  animate={animated ? { x: 0, opacity: 1 } : false}
                  transition={{ delay: animated ? index * 0.4 + 0.5 : 0, duration: 0.4 }}
                  className={cn("hidden md:flex w-1/2", isEven ? "pr-12 justify-end" : "pl-12 justify-start ml-auto")}
                >
                  {renderCardContent(item, title, desc, iconStatus, rawDate, isEven)}
                </motion.div>
              )}

              {/* Layout Mobile (ou Same Side no Desktop) */}
              <motion.div 
                initial={animated ? { x: 20, opacity: 0 } : false}
                animate={animated ? { x: 0, opacity: 1 } : false}
                transition={{ delay: animated ? index * 0.4 + 0.5 : 0, duration: 0.4 }}
                className={cn("flex w-full pl-16 pr-4", mode === 'same_side' ? "" : "md:hidden")}
              >
                {renderCardContent(item, title, desc, iconStatus, rawDate, false)}
              </motion.div>

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
