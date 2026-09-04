'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, Clock, Edit2, Eye, Trash2, Tag, FileText, Settings2, RefreshCcw, ArrowRight, ArrowDown, Minimize2, Maximize2, ZoomIn, LayoutGrid, Zap } from 'lucide-react'
import DynamicIcon from '@/components/runtime/DynamicIcon'
import { cn, getActionColorClasses } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { format, parseISO, isValid } from 'date-fns'
import { ptBR, es, enUS } from 'date-fns/locale'
import { formatFieldValue, getNestedValue } from '@/lib/formatters'
import { motion } from 'framer-motion'

const colors = [
  '#0ea5e9', // Cyan
  '#2563eb', // Blue
  '#7c3aed', // Purple
  '#d946ef', // Magenta
]

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
    layout_style?: 'cards' | 'infographic'
    card_scale?: number
  }
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => void
  onRefresh?: () => void
  dictionary?: any
  relationalOptions?: Record<string, any[]>
  customActions?: any[]
  onCustomAction?: (action: any, row?: any) => void
  onLoadMore?: () => void
  hasMore?: boolean
  totalRecords?: number
  direction?: 'horizontal' | 'vertical'
  onDirectionChange?: (dir: 'horizontal' | 'vertical') => void
}

export default function DynamicTimeline({
  data,
  fields,
  timelineConfig,
  onView,
  onEdit,
  onDelete,
  onRefresh,
  dictionary,
  relationalOptions = {},
  customActions = [],
  onCustomAction,
  onLoadMore,
  hasMore,
  totalRecords,
  direction = 'vertical',
  onDirectionChange
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

  const { resolveDynamicFieldDef, extractRawValue } = require('@/lib/field-resolver');

  const titleFieldObj = resolveDynamicFieldDef(timelineConfig.title_field, fields);
  const dateFieldObj = resolveDynamicFieldDef(timelineConfig.date_field, fields);
  const descFieldObj = timelineConfig.desc_field ? resolveDynamicFieldDef(timelineConfig.desc_field, fields) : null;
  const iconFieldObj = timelineConfig.icon_field ? resolveDynamicFieldDef(timelineConfig.icon_field, fields) : null;

  const [mode, setMode] = useState(timelineConfig.layout_mode || 'alternating')
  const [style, setStyle] = useState(timelineConfig.layout_style || 'cards')
  const [animated, setAnimated] = useState(timelineConfig.animated !== false)
  const [scale, setScale] = useState(timelineConfig.card_scale ?? 1.0)
  const [animationTrigger, setAnimationTrigger] = useState(0)

  const scales = [
    { value: 0.8, icon: <Minimize2 className="w-3.5 h-3.5" />, label: t('runtime.scale_small', 'Pequeno') },
    { value: 1.0, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: t('runtime.scale_normal', 'Normal') },
    { value: 1.2, icon: <Maximize2 className="w-3.5 h-3.5" />, label: t('runtime.scale_large', 'Grande') },
    { value: 1.5, icon: <ZoomIn className="w-3.5 h-3.5" />, label: t('runtime.scale_xl', 'Extra Grande') }
  ]

  useEffect(() => {
    setMode(timelineConfig.layout_mode || 'alternating')
    setStyle(timelineConfig.layout_style || 'cards')
    setAnimated(timelineConfig.animated !== false)
    setScale(timelineConfig.card_scale ?? 1.0)
  }, [timelineConfig])

  // Dados sem manipulação de ordenação para refletir o backend
  const sortedData = data

  // Timings da animação calculados de forma suave para qualquer quantidade de registros (1 a 50+)
  const animDuration = Math.min(sortedData.length * 0.08 + 0.3, 1.2)
  const getNodeDelay = (idx: number) => Math.min(idx * 0.04 + 0.08, 0.7)
  const getPath1Delay = (idx: number) => Math.min(idx * 0.04 + 0.12, 0.75)
  const getPath2Delay = (idx: number) => Math.min(idx * 0.04 + 0.16, 0.8)
  const getContentDelay = (idx: number) => Math.min(idx * 0.04 + 0.16, 0.8)

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
    <div 
      className={cn("bg-white dark:bg-neutral-900/80 backdrop-blur-sm border border-neutral-200 dark:border-neutral-800 shadow-xl shadow-neutral-200/20 dark:shadow-none hover:border-indigo-500/30 hover:shadow-indigo-500/10 transition-all w-full", alignRight ? "text-right" : "text-left")}
      style={{ padding: `${scale * 18}px`, borderRadius: `${scale * 16}px` }}
    >
      <div className={cn("flex flex-wrap items-center gap-2 mb-2", alignRight ? "justify-end" : "justify-start")}>
        <span 
          className="font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center gap-1.5"
          style={{ fontSize: `${scale * 9}px`, padding: `${scale * 4}px ${scale * 8}px` }}
        >
          <Clock style={{ width: `${scale * 12}px`, height: `${scale * 12}px` }} />
          {formatDate(rawDate)}
        </span>
        {iconStatus && (
          <span 
            className="font-black uppercase tracking-widest text-neutral-500 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center gap-1.5 truncate"
            style={{ fontSize: `${scale * 9}px`, padding: `${scale * 4}px ${scale * 8}px`, maxWidth: `${scale * 120}px` }}
          >
            <Tag style={{ width: `${scale * 12}px`, height: `${scale * 12}px` }} />
            {String(iconStatus)}
          </span>
        )}
      </div>
      
      <h3 
        className="font-bold text-neutral-900 dark:text-white leading-tight"
        style={{ fontSize: `${scale * 15}px`, marginBottom: `${scale * 6}px` }}
      >
        {String(title)}
      </h3>
      
      {desc && (
        <p 
          className="text-neutral-500 dark:text-neutral-400 line-clamp-3 leading-relaxed"
          style={{ fontSize: `${scale * 12}px`, marginBottom: `${scale * 12}px` }}
        >
          {String(desc)}
        </p>
      )}

      <div 
        className={cn("flex items-center gap-2 border-t border-neutral-100 dark:border-neutral-800/50", alignRight ? "justify-end" : "justify-start")}
        style={{ marginTop: `${scale * 12}px`, paddingTop: `${scale * 12}px` }}
      >
        {onView && (
          <button 
            onClick={() => onView(item)} 
            className="bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-lg transition-all shadow-sm"
            style={{ padding: `${scale * 6}px` }}
          >
            <Eye style={{ width: `${scale * 14}px`, height: `${scale * 14}px` }} />
          </button>
        )}
        {onEdit && (
          <button 
            onClick={() => onEdit(item)} 
            className="bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 rounded-lg transition-all shadow-sm"
            style={{ padding: `${scale * 6}px` }}
          >
            <Edit2 style={{ width: `${scale * 14}px`, height: `${scale * 14}px` }} />
          </button>
        )}
        {onDelete && (
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(item) }} 
            className="bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 rounded-lg transition-all shadow-sm"
            style={{ padding: `${scale * 6}px` }}
          >
            <Trash2 style={{ width: `${scale * 14}px`, height: `${scale * 14}px` }} />
          </button>
        )}
        {customActions.filter(a => (a.contexts ? (Array.isArray(a.contexts) ? a.contexts : [a.contexts]) : [a.context]).includes('row')).map(action => {
          const colors = getActionColorClasses(action.color)
          return (
            <button
              key={action.id}
              title={action.label}
              onClick={(e) => { e.stopPropagation(); onCustomAction?.(action, item) }}
              className={cn(
                "rounded-lg transition-all shadow-sm",
                colors.bg,
                colors.text,
                colors.hover
              )}
              style={{ padding: `${scale * 6}px` }}
            >
              {action.icon ? <DynamicIcon icon={action.icon} style={{ width: `${scale * 14}px`, height: `${scale * 14}px` }} /> : <Zap style={{ width: `${scale * 14}px`, height: `${scale * 14}px` }} />}
            </button>
          )
        })}
      </div>
    </div>
  )

  const renderInfographicContent = (
    item: any,
    title: any,
    desc: any,
    iconStatus: any,
    rawDate: any,
    alignRight: boolean = false,
    isHorizontal: boolean = false,
    isEven: boolean = false
  ) => {
    let dateStr = ''
    try {
       const d = new Date(rawDate)
       if (!isNaN(d.getTime())) dateStr = format(d, 'dd/MM/yyyy', { locale: dateLocale })
       else dateStr = String(rawDate)
    } catch(e) { dateStr = String(rawDate) }

    const idx = sortedData.findIndex(d => (d._key || d.id || d.ID) === (item._key || item.id || item.ID))
    const itemColor = colors[idx !== -1 ? idx % colors.length : 0]

    const dateEl = (
      <div 
        key="date"
        className="font-bold tracking-wider mb-0.5 opacity-90 drop-shadow-sm transition-colors duration-300" 
        style={{ color: itemColor, fontSize: `${scale * 12}px` }}
      >
        {dateStr}
      </div>
    )

    const statusEl = iconStatus && (
      <span 
        key="status" 
        className="font-black uppercase tracking-widest text-neutral-500 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center gap-1.5 truncate"
        style={{ fontSize: `${scale * 9}px`, padding: `${scale * 2}px ${scale * 8}px`, maxWidth: `${scale * 120}px` }}
      >
        <Tag style={{ width: `${scale * 12}px`, height: `${scale * 12}px` }} />
        {String(iconStatus)}
      </span>
    )

    const titleEl = (
      <h3 
        key="title" 
        className="font-bold text-neutral-900 dark:text-white leading-tight"
        style={{ fontSize: `${scale * 15}px`, maxWidth: `${scale * 250}px` }}
      >
        {String(title)}
      </h3>
    )

    const descEl = desc && (
      <p 
        key="desc" 
        className="text-neutral-500 dark:text-neutral-400 line-clamp-3 leading-relaxed"
        style={{ fontSize: `${scale * 12}px`, maxWidth: `${scale * 250}px` }}
      >
        {String(desc)}
      </p>
    )

    const actionsEl = (
      <div key="actions" className={cn("flex items-center gap-2 mt-2", isHorizontal ? "justify-center" : (alignRight ? "justify-end" : "justify-start"))}>
        {onView && (
          <button 
            onClick={() => onView(item)} 
            className="transition-colors p-1"
            style={{ color: `${itemColor}cc` }}
            onMouseEnter={(e) => e.currentTarget.style.color = itemColor}
            onMouseLeave={(e) => e.currentTarget.style.color = `${itemColor}cc`}
          >
            <Eye style={{ width: `${scale * 16}px`, height: `${scale * 16}px` }} />
          </button>
        )}
        {onEdit && (
          <button 
            onClick={() => onEdit(item)} 
            className="transition-colors p-1"
            style={{ color: `${itemColor}cc` }}
            onMouseEnter={(e) => e.currentTarget.style.color = itemColor}
            onMouseLeave={(e) => e.currentTarget.style.color = `${itemColor}cc`}
          >
            <Edit2 style={{ width: `${scale * 16}px`, height: `${scale * 16}px` }} />
          </button>
        )}
          {onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(item) }} className="text-red-400 hover:text-red-600 transition-colors p-1">
              <Trash2 style={{ width: `${scale * 16}px`, height: `${scale * 16}px` }} />
            </button>
          )}
          {customActions.filter(a => (a.contexts ? (Array.isArray(a.contexts) ? a.contexts : [a.contexts]) : [a.context]).includes('row')).map(action => {
            const colors = getActionColorClasses(action.color)
            return (
              <button
                key={action.id}
                title={action.label}
                onClick={(e) => { e.stopPropagation(); onCustomAction?.(action, item) }}
                className={cn("transition-colors p-1", colors.text, colors.hover)}
              >
                {action.icon ? <DynamicIcon icon={action.icon} style={{ width: `${scale * 16}px`, height: `${scale * 16}px` }} /> : <Zap style={{ width: `${scale * 16}px`, height: `${scale * 16}px` }} />}
              </button>
            )
          })}
        </div>
    )

    let elementsOrder = [dateEl, statusEl, titleEl, descEl, actionsEl]
    if (isHorizontal && mode === 'alternating' && isEven) {
      elementsOrder = [actionsEl, descEl, titleEl, statusEl, dateEl]
    }

    return (
      <div className={cn("w-full bg-transparent flex flex-col gap-1.5", 
        isHorizontal ? "items-center text-center px-2" : (alignRight ? "items-end text-right" : "items-start text-left")
      )}>
        {elementsOrder}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      {/* Barra de Controles de Estilo Local */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <Settings2 className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Estilo e Comportamento</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-neutral-500 uppercase">Direção:</label>
            <select 
              value={direction} 
              onChange={(e) => {
                if (onDirectionChange) onDirectionChange(e.target.value as 'horizontal' | 'vertical')
              }}
              className="bg-transparent text-indigo-600 outline-none cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 p-1 rounded transition-colors text-xs font-bold focus:outline-none"
            >
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-neutral-500 uppercase">Animação:</label>
            <select 
              value={animated ? 'true' : 'false'} 
              onChange={e => {
                setAnimated(e.target.value === 'true')
                setAnimationTrigger(prev => prev + 1)
              }}
              className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none"
            >
              <option value="true">Ligada</option>
              <option value="false">Desligada</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-neutral-500 uppercase">Modo:</label>
            <select 
              value={mode} 
              onChange={e => {
                setMode(e.target.value as any)
                setAnimationTrigger(prev => prev + 1)
              }}
              className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none"
            >
              <option value="alternating">Zig-Zag</option>
              <option value="same_side">Lateral</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-neutral-500 uppercase">Aparência:</label>
            <select 
              value={style} 
              onChange={e => {
                setStyle(e.target.value as any)
                setAnimationTrigger(prev => prev + 1)
              }}
              className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none"
            >
              <option value="cards">Cards</option>
              <option value="infographic">Info</option>
            </select>
          </div>

          <div className="flex items-center gap-1 ml-2 sm:ml-4 border-l border-neutral-200 dark:border-neutral-800 pl-4 sm:pl-6">
            <div className="flex items-center bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800">
              {scales.map(s => (
                <button
                  key={s.value}
                  onClick={() => setScale(s.value)}
                  title={s.label}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    scale === s.value 
                      ? "bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                      : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  )}
                >
                  {s.icon}
                </button>
              ))}
            </div>
          </div>

          {onRefresh && (
            <div className="flex items-center ml-2 sm:ml-4 border-l border-neutral-200 dark:border-neutral-800 pl-4 sm:pl-6">
              <button 
                onClick={() => {
                  setAnimationTrigger(prev => prev + 1)
                  onRefresh()
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400 transition-colors"
                title="Atualizar Dados"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div 
        key={`timeline-canvas-${animationTrigger}-${animated ? 'anim' : 'static'}-${direction}-${mode}-${style}`}
        className="w-full bg-neutral-50/50 dark:bg-neutral-950/50 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm relative overflow-hidden"
      >
        {direction === 'horizontal' ? (
          <div className="relative w-full overflow-x-auto custom-scrollbar py-8 px-4">
        <div 
          className={cn(
            "relative min-w-max flex gap-8 px-4", 
            mode === 'alternating' ? "items-center" : "items-start pb-8"
          )} 
          style={{ minHeight: mode === 'alternating' ? '450px' : (style === 'infographic' ? '320px' : '380px') }}
        >
          {/* Linha horizontal principal conectando perfeitamente do nó 0 ao nó N-1 */}
          {sortedData.length > 1 && (
            <motion.div 
              initial={animated ? { scaleX: 0, y: "-50%" } : { y: "-50%" }}
              animate={{ scaleX: 1, y: "-50%" }}
              transition={{ duration: animDuration, ease: "easeOut" }}
              className={cn("absolute h-[3px] bg-[#6366f1] rounded-full origin-left",
                mode === 'alternating' ? "top-1/2" : "top-[60px]"
              )} 
              style={{
                left: `calc(1rem + ${scale * 175}px)`,
                width: `${(sortedData.length - 1) * (scale * 350 + 32)}px`,
              }}
            />
          )}

          {sortedData.map((item, index) => {
            const isEven = index % 2 === 0
            const primaryKey = item._key || item.id || item.ID || index
            
            const rawDate = extractRawValue(timelineConfig.date_field, item, dateFieldObj)
            const titleValue = extractRawValue(timelineConfig.title_field, item, titleFieldObj)
            const title = formatFieldValue(titleValue, titleFieldObj, relationalOptions) || 'Sem Título'
            const descValue = timelineConfig.desc_field ? extractRawValue(timelineConfig.desc_field, item, descFieldObj) : null
            const desc = timelineConfig.desc_field ? formatFieldValue(descValue, descFieldObj, relationalOptions) : null
            const iconStatusValue = timelineConfig.icon_field ? extractRawValue(timelineConfig.icon_field, item, iconFieldObj) : null
            const iconStatus = timelineConfig.icon_field ? formatFieldValue(iconStatusValue, iconFieldObj, relationalOptions) : null
            const itemColor = colors[index % colors.length]
            const nextColor = index < sortedData.length - 1 ? colors[(index + 1) % colors.length] : 'transparent'

            return (
              <div 
                key={`timeline-item-${primaryKey}-${index}`} 
                className={cn(
                  "relative flex flex-col group", 
                  mode === 'alternating' ? "h-[450px]" : "h-auto"
                )}
                style={{ width: `${scale * 350}px` }}
              >
                <motion.div 
                  initial={animated ? { scale: 0, opacity: 0, x: "-50%", y: "-50%" } : { x: "-50%", y: "-50%" }}
                  animate={{ scale: 1, opacity: 1, x: "-50%", y: "-50%" }}
                  whileHover={{ backgroundColor: itemColor, transition: { duration: 0.1, delay: 0 } }}
                  whileTap={{ backgroundColor: itemColor, transition: { duration: 0.1, delay: 0 } }}
                  transition={{ delay: animated ? getNodeDelay(index) : 0, duration: 0.2 }}
                  className={cn("absolute w-4 h-4 bg-white dark:bg-neutral-900 border-4 rounded-full transition-colors duration-200 z-10 left-1/2",
                    mode === 'alternating' ? "top-1/2" : "top-[60px]"
                  )} 
                  style={{ 
                    borderColor: itemColor, 
                    boxShadow: `0 0 15px ${itemColor}66` 
                  }}
                />

                {/* Content */}
                <div 
                  className={cn("w-full flex relative", 
                    mode === 'alternating' 
                      ? (isEven ? "h-1/2 justify-end flex-col" : "h-1/2 mt-auto justify-start flex-col") 
                      : "flex-col justify-start"
                  )}
                  style={{
                    marginTop: mode === 'alternating' ? undefined : '60px',
                    paddingBottom: mode === 'alternating' && isEven ? (style === 'infographic' ? '54px' : '32px') : undefined,
                    paddingTop: (mode === 'alternating' && !isEven) || mode === 'same_side' ? (style === 'infographic' ? '54px' : '32px') : undefined,
                  }}
                >
                  {style === 'infographic' && (
                     <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-0" style={{ 
                        top: mode === 'alternating' ? (isEven ? 'auto' : '0') : '0',
                        bottom: mode === 'alternating' ? (isEven ? '0' : 'auto') : 'auto',
                        marginTop: mode === 'alternating' ? (isEven ? '0' : '-60px') : '-60px',
                        marginBottom: mode === 'alternating' ? (isEven ? '-60px' : '0') : '0',
                        width: '64px',
                        height: '120px'
                     }}>
                       <svg width="64" height="120" viewBox="0 0 64 120" className="fill-none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                         {/* Máscara para interromper a linha horizontal no vão da ponte */}
                         <rect x="20" y="57" width="24" height="6" className="fill-white dark:fill-neutral-950 stroke-none" />
                         
                         {/* Linha de entrada e ponte vertical */}
                         <motion.path 
                           initial={animated ? { pathLength: 0, opacity: 0 } : false}
                           animate={animated ? { pathLength: 1, opacity: 1 } : false}
                           transition={{ delay: animated ? getPath1Delay(index) : 0, duration: 0.4, ease: "easeOut" }}
                           stroke="#6366f1"
                           d={index === 0
                              ? (mode === 'alternating'
                                  ? (isEven
                                      ? "M 22 60 A 10 10 0 0 1 32 50 L 32 18"
                                      : "M 22 60 A 10 10 0 0 0 32 70 L 32 102")
                                  : "M 22 60 A 10 10 0 0 0 32 70 L 32 102")
                              : (mode === 'alternating' 
                                  ? (isEven 
                                      ? "M 0 60 L 22 60 A 10 10 0 0 1 32 50 L 32 18"
                                      : "M 0 60 L 22 60 A 10 10 0 0 0 32 70 L 32 102"
                                    ) 
                                  : "M 0 60 L 22 60 A 10 10 0 0 0 32 70 L 32 102")
                           }
                         />
                         
                         {/* Linha de saída contornando a bolinha */}
                         {index < sortedData.length - 1 && (
                           <motion.path 
                             initial={animated ? { pathLength: 0, opacity: 0 } : false}
                             animate={animated ? { pathLength: 1, opacity: 1 } : false}
                             transition={{ delay: animated ? getPath2Delay(index) : 0, duration: 0.4, ease: "easeOut" }}
                             stroke="#6366f1"
                             d={mode === 'alternating'
                                ? (isEven
                                    ? "M 32 70 A 10 10 0 0 0 42 60 L 64 60"
                                    : "M 32 50 A 10 10 0 0 1 42 60 L 64 60"
                                  )
                                : "M 32 50 A 10 10 0 0 1 42 60 L 64 60"
                             }
                           />
                         )}
                         
                         {/* Círculos dos nós */}
                         <circle cx="32" cy="60" r="4.5" fill={itemColor} stroke="none" />
                         {mode === 'alternating' ? (
                           isEven 
                             ? <circle cx="32" cy="18" r="4.5" fill={itemColor} stroke="none" />
                             : <circle cx="32" cy="102" r="4.5" fill={itemColor} stroke="none" />
                         ) : (
                           <circle cx="32" cy="102" r="4.5" fill={itemColor} stroke="none" />
                         )}
                       </svg>
                     </div>
                  )}
                  <motion.div 
                    initial={animated ? { y: isEven && mode === 'alternating' ? -15 : 15, opacity: 0 } : false}
                    animate={animated ? { y: 0, opacity: 1 } : false}
                    transition={{ delay: animated ? getContentDelay(index) : 0, duration: 0.4 }}
                    className="relative z-10 w-full"
                  >
                    {style === 'infographic' 
                      ? renderInfographicContent(item, title, desc, iconStatus, rawDate, false, true, isEven)
                      : renderCardContent(item, title, desc, iconStatus, rawDate, false)}
                  </motion.div>
                </div>
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
      ) : (
        <div className={cn("relative mx-auto py-8", style === 'infographic' ? "max-w-4xl" : "max-w-5xl")}>
      {/* Linha vertical principal */}
      <motion.div 
        initial={animated ? { scaleY: 0, x: "-50%" } : { x: "-50%" }}
        animate={{ scaleY: 1, x: "-50%" }}
        transition={{ duration: animDuration, ease: "easeOut" }}
        className={cn("absolute top-0 bottom-0 w-[3px] bg-[#6366f1] rounded-full origin-top",
          mode === 'same_side' ? "left-8" : "left-8 md:left-1/2"
        )} 
      />

      <div className="space-y-12">
        {sortedData.map((item, index) => {
          const isEven = index % 2 === 0
          const primaryKey = item._key || item.id || item.ID || index
          
          const rawDate = extractRawValue(timelineConfig.date_field, item, dateFieldObj)
          const titleValue = extractRawValue(timelineConfig.title_field, item, titleFieldObj)
          const title = formatFieldValue(titleValue, titleFieldObj, relationalOptions) || 'Sem Título'
          const descValue = timelineConfig.desc_field ? extractRawValue(timelineConfig.desc_field, item, descFieldObj) : null
          const desc = timelineConfig.desc_field ? formatFieldValue(descValue, descFieldObj, relationalOptions) : null
          const iconStatusValue = timelineConfig.icon_field ? extractRawValue(timelineConfig.icon_field, item, iconFieldObj) : null
          const iconStatus = timelineConfig.icon_field ? formatFieldValue(iconStatusValue, iconFieldObj, relationalOptions) : null
          const itemColor = colors[index % colors.length]
          const nextColor = index < sortedData.length - 1 ? colors[(index + 1) % colors.length] : 'transparent'

          return (
            <div key={`timeline-item-${primaryKey}-${index}`} className="relative flex items-start justify-between md:justify-normal w-full group">
              
              <motion.div 
                initial={animated ? { scale: 0, opacity: 0, x: "-50%", y: "-50%" } : { x: "-50%", y: "-50%" }}
                animate={{ scale: 1, opacity: 1, x: "-50%", y: "-50%" }}
                whileHover={{ backgroundColor: itemColor, transition: { duration: 0.1, delay: 0 } }}
                whileTap={{ backgroundColor: itemColor, transition: { duration: 0.1, delay: 0 } }}
                transition={{ delay: animated ? getNodeDelay(index) : 0, duration: 0.2 }}
                className={cn("absolute w-4 h-4 bg-white dark:bg-neutral-900 border-4 rounded-full transition-colors duration-200 z-10",
                  style === 'infographic' ? "top-[32px]" : "top-8",
                  mode === 'same_side' ? "left-8" : "left-8 md:left-1/2"
                )} 
                style={{ 
                  borderColor: itemColor, 
                  boxShadow: `0 0 15px ${itemColor}66` 
                }}
              />

              {/* Lado Esquerdo/Direito Alternado (Apenas se mode for alternating) */}
              {mode === 'alternating' && (
                <div 
                  className={cn("hidden md:flex w-1/2 relative", isEven ? "pr-12 justify-end" : "pl-12 justify-start ml-auto")}
                >
                  {style === 'infographic' && (
                    <div className="absolute pointer-events-none z-0" style={{
                      top: '0px',
                      right: isEven ? '-60px' : 'auto',
                      left: isEven ? 'auto' : '-60px',
                      width: '120px',
                      height: '64px'
                    }}>
                      <svg width="120" height="64" viewBox="0 0 120 64" className="fill-none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        {/* Máscara para interromper a linha vertical no vão da ponte */}
                        <rect x="57" y="20" width="6" height="24" className="fill-white dark:fill-neutral-950 stroke-none" />
                        
                        {/* Linha de entrada vertical e conector horizontal */}
                        <motion.path 
                          initial={animated ? { pathLength: 0, opacity: 0 } : false}
                          animate={animated ? { pathLength: 1, opacity: 1 } : false}
                          transition={{ delay: animated ? getPath1Delay(index) : 0, duration: 0.4, ease: "easeOut" }}
                          stroke="#6366f1"
                          d={isEven 
                              ? "M 60 0 L 60 22 A 10 10 0 0 0 50 32 L 18 32" // Ponte para a DIREITA (concava/curva esquerda), linha para a ESQUERDA
                              : "M 60 0 L 60 22 A 10 10 0 0 1 70 32 L 102 32" // Ponte para a ESQUERDA (curva direita), linha para a DIREITA
                          }
                        />

                        {/* Linha de saída contornando a bolinha */}
                        {index < sortedData.length - 1 && (
                          <motion.path 
                            initial={animated ? { pathLength: 0, opacity: 0 } : false}
                            animate={animated ? { pathLength: 1, opacity: 1 } : false}
                            transition={{ delay: animated ? getPath2Delay(index) : 0, duration: 0.4, ease: "easeOut" }}
                            stroke="#6366f1"
                            d={isEven
                              ? "M 70 32 A 10 10 0 0 1 60 42 L 60 64" // Do lado direito, curva para baixo
                              : "M 50 32 A 10 10 0 0 0 60 42 L 60 64" // Do lado esquerdo, curva para baixo
                            }
                          />
                        )}
                        
                        {/* Círculos dos nós */}
                        <circle cx="60" cy="32" r="4.5" fill={itemColor} stroke="none" />
                        <circle cx={isEven ? "18" : "102"} cy="32" r="4.5" fill={itemColor} stroke="none" />
                      </svg>
                    </div>
                  )}
                  <motion.div 
                    initial={animated ? { x: isEven ? -15 : 15, opacity: 0 } : false}
                    animate={animated ? { x: 0, opacity: 1 } : false}
                    transition={{ delay: animated ? getContentDelay(index) : 0, duration: 0.4 }}
                    className="relative z-10 w-full" 
                    style={{ maxWidth: `${scale * 450}px` }}
                  >
                    {style === 'infographic' 
                      ? renderInfographicContent(item, title, desc, iconStatus, rawDate, isEven, false)
                      : renderCardContent(item, title, desc, iconStatus, rawDate, isEven)}
                  </motion.div>
                </div>
              )}

              {/* Layout Mobile (ou Same Side no Desktop) */}
              <div 
                className={cn("flex w-full relative pl-16 pr-4", mode === 'same_side' ? "" : "md:hidden")}
              >
                {style === 'infographic' && (
                  <div className="absolute pointer-events-none z-0 left-[-28px]" style={{
                    top: '0px',
                    width: '120px',
                    height: '64px'
                  }}>
                    <svg width="120" height="64" viewBox="0 0 120 64" className="fill-none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      {/* Máscara para interromper a linha vertical no vão da ponte */}
                      <rect x="57" y="20" width="6" height="24" className="fill-white dark:fill-neutral-950 stroke-none" />
                      
                      {/* Linha de entrada vertical e conector horizontal */}
                      <motion.path 
                        initial={animated ? { pathLength: 0, opacity: 0 } : false}
                        animate={animated ? { pathLength: 1, opacity: 1 } : false}
                        transition={{ delay: animated ? getPath1Delay(index) : 0, duration: 0.4, ease: "easeOut" }}
                        stroke="#6366f1"
                        d="M 60 0 L 60 22 A 10 10 0 0 1 70 32 L 102 32"
                      />

                      {/* Linha de saída contornando a bolinha */}
                      {index < sortedData.length - 1 && (
                        <motion.path 
                          initial={animated ? { pathLength: 0, opacity: 0 } : false}
                          animate={animated ? { pathLength: 1, opacity: 1 } : false}
                          transition={{ delay: animated ? getPath2Delay(index) : 0, duration: 0.4, ease: "easeOut" }}
                          stroke="#6366f1"
                          d="M 50 32 A 10 10 0 0 0 60 42 L 60 64"
                        />
                      )}
                      
                      <circle cx="60" cy="32" r="4.5" fill={itemColor} stroke="none" />
                      <circle cx="102" cy="32" r="4.5" fill={itemColor} stroke="none" />
                    </svg>
                  </div>
                )}
                <motion.div 
                  initial={animated ? { x: 15, opacity: 0 } : false}
                  animate={animated ? { x: 0, opacity: 1 } : false}
                  transition={{ delay: animated ? getContentDelay(index) : 0, duration: 0.4 }}
                  className="relative z-10 w-full" 
                  style={{ maxWidth: `${scale * 450}px` }}
                >
                  {style === 'infographic' 
                    ? renderInfographicContent(item, title, desc, iconStatus, rawDate, false, false)
                    : renderCardContent(item, title, desc, iconStatus, rawDate, false)}
                </motion.div>
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
      )}
    </div>
  </div>
  )
}
