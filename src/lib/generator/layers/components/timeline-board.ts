export function generateTimelineBoardComponent(files: Map<string, string>) {
  files.set('components/TimelineBoard.tsx', generateTimelineBoardCode())
}

function generateTimelineBoardCode(): string {
  return `'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Clock,
  Edit2,
  Eye,
  Trash2,
  Tag,
  Settings2,
  RefreshCcw,
  Minimize2,
  Maximize2,
  ZoomIn,
  LayoutGrid,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DeleteButton } from '@/components/ui/delete-button'

const COLORS = [
  '#0ea5e9', // Cyan
  '#2563eb', // Blue
  '#7c3aed', // Purple
  '#d946ef', // Magenta
]

export interface TimelineConfig {
  dateField: string
  titleField: string
  descField?: string
  iconField?: string
  layoutStyle?: 'cards' | 'infographic'
  layoutDirection?: 'horizontal' | 'vertical'
  layoutMode?: 'alternating' | 'same_side'
  timelineOrderHorizontal?: 'asc' | 'desc'
  timelineOrderVertical?: 'asc' | 'desc'
  animated?: boolean
  cardScale?: number
}

export interface TimelineBoardProps {
  data: any[]
  timelineConfig: TimelineConfig
  relationalOptions?: Record<string, Array<{ value: string; label: string }>>
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (id: string) => Promise<void> | void
  onRefresh?: () => void
  onLoadMore?: () => void
  hasMore?: boolean
  totalRecords?: number
  visibleCount?: number
  customActions?: any[]
  onCustomAction?: (action: any, row?: any) => void
}

export function TimelineBoard({
  data,
  timelineConfig,
  relationalOptions = {},
  onView,
  onEdit,
  onDelete,
  onRefresh,
  onLoadMore,
  hasMore = false,
  totalRecords = 0,
  visibleCount = 50,
  customActions = [],
  onCustomAction,
}: TimelineBoardProps) {
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>(
    timelineConfig.layoutDirection || 'horizontal'
  )
  const [mode, setMode] = useState<'alternating' | 'same_side'>(
    timelineConfig.layoutMode || 'alternating'
  )
  const [style, setStyle] = useState<'cards' | 'infographic'>(
    timelineConfig.layoutStyle || 'infographic'
  )
  const [animated, setAnimated] = useState<boolean>(
    timelineConfig.animated !== false
  )
  const [scale, setScale] = useState<number>(
    timelineConfig.cardScale ?? 1.0
  )
  const [animationTrigger, setAnimationTrigger] = useState<number>(0)

  useEffect(() => {
    if (timelineConfig.layoutDirection) setDirection(timelineConfig.layoutDirection)
    if (timelineConfig.layoutMode) setMode(timelineConfig.layoutMode)
    if (timelineConfig.layoutStyle) setStyle(timelineConfig.layoutStyle)
    if (timelineConfig.animated !== undefined) setAnimated(timelineConfig.animated !== false)
    if (timelineConfig.cardScale !== undefined) setScale(timelineConfig.cardScale)
  }, [timelineConfig])

  const scales = [
    { value: 0.8, icon: <Minimize2 className="w-3.5 h-3.5" />, label: 'Pequeno' },
    { value: 1.0, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: 'Normal' },
    { value: 1.2, icon: <Maximize2 className="w-3.5 h-3.5" />, label: 'Grande' },
    { value: 1.5, icon: <ZoomIn className="w-3.5 h-3.5" />, label: 'Extra Grande' },
  ]

  // Ordenação selecionada no Studio com suporte dinâmico à direção (Horizontal / Vertical)
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return []
    const dateCol = timelineConfig.dateField
    if (!dateCol) return data

    const currentOrder = direction === 'horizontal'
      ? (timelineConfig.timelineOrderHorizontal || 'asc')
      : (timelineConfig.timelineOrderVertical || 'asc')

    return [...data].sort((a, b) => {
      const valA = a[dateCol]
      const valB = b[dateCol]
      if (!valA && !valB) return 0
      if (!valA) return 1
      if (!valB) return -1
      const timeA = new Date(valA).getTime()
      const timeB = new Date(valB).getTime()
      if (isNaN(timeA) || isNaN(timeB)) {
        return currentOrder === 'desc'
          ? String(valB).localeCompare(String(valA))
          : String(valA).localeCompare(String(valB))
      }
      return currentOrder === 'desc' ? timeB - timeA : timeA - timeB
    })
  }, [data, timelineConfig, direction])

  const resolveFieldValue = (row: any, colName?: string) => {
    if (!colName || !row) return ''
    const val = row[colName]
    if (val !== null && val !== undefined && val !== '') {
      const opts = relationalOptions[colName]
      if (opts && Array.isArray(opts)) {
        const match = opts.find(o => String(o.value) === String(val))
        if (match) return match.label
      }
      return String(val)
    }

    // Se o valor direto estiver vazio na linha (ex: colName é 'nome_empresa' mas na row está 'cliente_id')
    // busca pela FK correspondente ou na coleção de relationalOptions
    for (const [optKey, opts] of Object.entries(relationalOptions)) {
      if (row[optKey] !== undefined && row[optKey] !== null) {
        const match = opts.find(o => String(o.value) === String(row[optKey]))
        if (match && match.label) {
          const lowerCol = colName.toLowerCase()
          const lowerKey = optKey.toLowerCase().replace('_id', '')
          if (lowerKey.includes(lowerCol) || lowerCol.includes(lowerKey)) {
            return match.label
          }
        }
      }
    }

    return ''
  }

  const formatDate = (rawDate: any) => {
    if (!rawDate) return ''
    try {
      const d = new Date(rawDate)
      if (isNaN(d.getTime())) return String(rawDate)
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year = d.getFullYear()
      return \`\${day}/\${month}/\${year}\`
    } catch {
      return String(rawDate)
    }
  }

  const renderCardContent = (
    item: any,
    title: string,
    desc: string,
    iconStatus: string,
    rawDate: any,
    alignRight: boolean = false
  ) => {
    const primaryKey = item.id || item.ID || item._id
    return (
      <div
        className={cn(
          "bg-white dark:bg-neutral-900/80 backdrop-blur-sm border border-neutral-200 dark:border-neutral-800 shadow-xl shadow-neutral-200/20 dark:shadow-none hover:border-indigo-500/30 hover:shadow-indigo-500/10 transition-all w-full",
          alignRight ? "text-right" : "text-left"
        )}
        style={{ padding: \`\${scale * 18}px\`, borderRadius: \`\${scale * 16}px\` }}
      >
        <div className={cn("flex flex-wrap items-center gap-2 mb-2", alignRight ? "justify-end" : "justify-start")}>
          <span
            className="font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center gap-1.5"
            style={{ fontSize: \`\${scale * 9}px\`, padding: \`\${scale * 4}px \${scale * 8}px\` }}
          >
            <Clock style={{ width: \`\${scale * 12}px\`, height: \`\${scale * 12}px\` }} />
            {formatDate(rawDate)}
          </span>
          {iconStatus && (
            <span
              className="font-black uppercase tracking-widest text-neutral-500 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center gap-1.5 truncate"
              style={{ fontSize: \`\${scale * 9}px\`, padding: \`\${scale * 4}px \${scale * 8}px\`, maxWidth: \`\${scale * 120}px\` }}
            >
              <Tag style={{ width: \`\${scale * 12}px\`, height: \`\${scale * 12}px\` }} />
              {iconStatus}
            </span>
          )}
        </div>

        <h3
          className="font-bold text-neutral-900 dark:text-white leading-tight"
          style={{ fontSize: \`\${scale * 15}px\`, marginBottom: \`\${scale * 6}px\` }}
        >
          {title}
        </h3>

        {desc && (
          <p
            className="text-neutral-500 dark:text-neutral-400 line-clamp-3 leading-relaxed"
            style={{ fontSize: \`\${scale * 12}px\`, marginBottom: \`\${scale * 12}px\` }}
          >
            {desc}
          </p>
        )}

        <div
          className={cn("flex items-center gap-2 border-t border-neutral-100 dark:border-neutral-800/50", alignRight ? "justify-end" : "justify-start")}
          style={{ marginTop: \`\${scale * 12}px\`, paddingTop: \`\${scale * 12}px\` }}
        >
          {onView && (
            <button
              onClick={() => onView(item)}
              className="bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-lg transition-all shadow-sm"
              style={{ padding: \`\${scale * 6}px\` }}
              title="Visualizar"
            >
              <Eye style={{ width: \`\${scale * 14}px\`, height: \`\${scale * 14}px\` }} />
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(item)}
              className="bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 rounded-lg transition-all shadow-sm"
              style={{ padding: \`\${scale * 6}px\` }}
              title="Editar"
            >
              <Edit2 style={{ width: \`\${scale * 14}px\`, height: \`\${scale * 14}px\` }} />
            </button>
          )}
          {onDelete && primaryKey && (
            <DeleteButton
              id={String(primaryKey)}
              onDelete={onDelete}
              iconOnly
              className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
            />
          )}
        </div>
      </div>
    )
  }

  const renderInfographicContent = (
    item: any,
    title: string,
    desc: string,
    iconStatus: string,
    rawDate: any,
    alignRight: boolean = false,
    isHorizontal: boolean = false,
    isEven: boolean = false,
    itemColor: string = COLORS[0]
  ) => {
    const primaryKey = item.id || item.ID || item._id
    const dateStr = formatDate(rawDate)

    const dateEl = (
      <div
        key="date"
        className="font-bold tracking-wider mb-0.5 opacity-90 drop-shadow-sm transition-colors duration-300"
        style={{ color: itemColor, fontSize: \`\${scale * 12}px\` }}
      >
        {dateStr}
      </div>
    )

    const statusEl = iconStatus && (
      <span
        key="status"
        className="font-black uppercase tracking-widest text-neutral-500 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center gap-1.5 truncate"
        style={{ fontSize: \`\${scale * 9}px\`, padding: \`\${scale * 2}px \${scale * 8}px\` }}
      >
        <Tag style={{ width: \`\${scale * 12}px\`, height: \`\${scale * 12}px\` }} />
        {iconStatus}
      </span>
    )

    const titleEl = (
      <h3
        key="title"
        className="font-bold text-neutral-900 dark:text-white leading-tight"
        style={{ fontSize: \`\${scale * 15}px\`, maxWidth: \`\${scale * 250}px\` }}
      >
        {title}
      </h3>
    )

    const descEl = desc && (
      <p
        key="desc"
        className="text-neutral-500 dark:text-neutral-400 line-clamp-3 leading-relaxed"
        style={{ fontSize: \`\${scale * 12}px\`, maxWidth: \`\${scale * 250}px\` }}
      >
        {desc}
      </p>
    )

    const actionsEl = (
      <div
        key="actions"
        className={cn(
          "flex items-center gap-2 mt-2",
          isHorizontal ? "justify-center" : (alignRight ? "justify-end" : "justify-start")
        )}
      >
        {onView && (
          <button
            onClick={() => onView(item)}
            className="transition-colors p-1"
            style={{ color: \`\${itemColor}cc\` }}
            onMouseEnter={(e) => e.currentTarget.style.color = itemColor}
            onMouseLeave={(e) => e.currentTarget.style.color = \`\${itemColor}cc\`}
            title="Visualizar"
          >
            <Eye style={{ width: \`\${scale * 16}px\`, height: \`\${scale * 16}px\` }} />
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(item)}
            className="transition-colors p-1"
            style={{ color: \`\${itemColor}cc\` }}
            onMouseEnter={(e) => e.currentTarget.style.color = itemColor}
            onMouseLeave={(e) => e.currentTarget.style.color = \`\${itemColor}cc\`}
            title="Editar"
          >
            <Edit2 style={{ width: \`\${scale * 16}px\`, height: \`\${scale * 16}px\` }} />
          </button>
        )}
        {onDelete && primaryKey && (
          <DeleteButton
            id={String(primaryKey)}
            onDelete={onDelete}
            iconOnly
            className="p-1 text-red-400 hover:text-red-600 transition-colors"
          />
        )}
      </div>
    )

    let elementsOrder = [dateEl, statusEl, titleEl, descEl, actionsEl]
    if (isHorizontal && mode === 'alternating' && isEven) {
      elementsOrder = [actionsEl, descEl, titleEl, statusEl, dateEl]
    }

    return (
      <div
        className={cn(
          "w-full bg-transparent flex flex-col gap-1.5",
          isHorizontal ? "items-center text-center px-2" : (alignRight ? "items-end text-right" : "items-start text-left")
        )}
      >
        {elementsOrder}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 w-full h-full">
      {/* Barra de Controles de Estilo e Comportamento fiel à Web Produção */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <Settings2 className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">
            Estilo e Comportamento
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-neutral-500 uppercase">Direção:</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'horizontal' | 'vertical')}
              className="bg-transparent text-indigo-600 outline-none cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 p-1 rounded transition-colors text-xs font-bold focus:outline-none"
            >
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-neutral-500 uppercase">Animação:</label>
            <select
              value={animated ? 'true' : 'false'}
              onChange={(e) => {
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
              onChange={(e) => {
                setMode(e.target.value as 'alternating' | 'same_side')
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
              onChange={(e) => {
                setStyle(e.target.value as 'cards' | 'infographic')
                setAnimationTrigger(prev => prev + 1)
              }}
              className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none"
            >
              <option value="infographic">Info</option>
              <option value="cards">Cards</option>
            </select>
          </div>

          <div className="flex items-center gap-1 ml-2 sm:ml-4 border-l border-neutral-200 dark:border-neutral-800 pl-4 sm:pl-6">
            <div className="flex items-center bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800">
              {scales.map((s) => (
                <button
                  key={s.value}
                  type="button"
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
                type="button"
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

      {/* Canvas Principal da Timeline */}
      <div 
        key={\`timeline-canvas-\${animationTrigger}-\${animated ? 'anim' : 'static'}-\${direction}-\${mode}-\${style}\`}
        className="w-full bg-neutral-50/50 dark:bg-neutral-950/50 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm relative overflow-hidden"
      >
        {direction === 'horizontal' ? (
          <div className="relative w-full overflow-x-auto custom-scrollbar py-12 px-6">
            <div
              className={cn(
                "relative min-w-max flex gap-8 px-8",
                mode === 'alternating' ? "items-center" : "items-start pb-8"
              )}
              style={{ minHeight: mode === 'alternating' ? '450px' : (style === 'infographic' ? '320px' : '380px') }}
            >
              {/* Linha horizontal principal */}
              {sortedData.length > 1 && (
                <motion.div
                  initial={animated ? { scaleX: 0 } : false}
                  animate={animated ? { scaleX: 1 } : false}
                  transition={{ duration: Math.min(sortedData.length * 0.3 + 0.4, 3), ease: "easeOut" }}
                  className={cn(
                    "absolute h-[3px] bg-[#6366f1] -translate-y-1/2 rounded-full origin-left",
                    mode === 'alternating' ? "top-1/2" : "top-[60px]"
                  )}
                  style={{ left: \`\${scale * 175}px\`, right: \`\${scale * 175}px\` }}
                />
              )}

              {sortedData.map((item, index) => {
                const isEven = index % 2 === 0
                const primaryKey = item.id || item.ID || item._id || index
                const rawDate = item[timelineConfig.dateField]
                const title = resolveFieldValue(item, timelineConfig.titleField) || 'Sem Título'
                const desc = resolveFieldValue(item, timelineConfig.descField)
                const iconStatus = resolveFieldValue(item, timelineConfig.iconField)
                const itemColor = COLORS[index % COLORS.length]

                return (
                  <div
                    key={\`timeline-h-\${primaryKey}-\${index}\`}
                    className={cn(
                      "relative flex flex-col group",
                      mode === 'alternating' ? "h-[450px]" : "h-auto"
                    )}
                    style={{ width: \`\${scale * 350}px\` }}
                  >
                    {/* Nó Central na Linha */}
                    <motion.div
                      initial={animated ? { scale: 0, opacity: 0 } : false}
                      animate={animated ? { scale: 1, opacity: 1 } : false}
                      whileHover={{ backgroundColor: itemColor, transition: { duration: 0.1 } }}
                      transition={{ delay: animated ? Math.min(index * 0.2 + 0.2, 2) : 0, duration: 0.2 }}
                      className={cn(
                        "absolute w-4 h-4 bg-white dark:bg-neutral-900 border-4 rounded-full transition-colors duration-200 z-10 -translate-y-1/2 left-1/2 -translate-x-1/2",
                        mode === 'alternating' ? "top-1/2" : "top-[60px]"
                      )}
                      style={{
                        borderColor: itemColor,
                        boxShadow: \`0 0 15px \${itemColor}66\`,
                      }}
                    />

                    {/* Conteúdo (Topo / Base no Zig-Zag) */}
                    <motion.div
                      initial={animated ? { y: 20, opacity: 0 } : false}
                      animate={animated ? { y: 0, opacity: 1 } : false}
                      transition={{ delay: animated ? Math.min(index * 0.2 + 0.3, 2.2) : 0, duration: 0.4 }}
                      className={cn(
                        "w-full flex relative",
                        mode === 'alternating'
                          ? isEven
                            ? "h-1/2 justify-end flex-col"
                            : "h-1/2 mt-auto justify-start flex-col"
                          : "flex-col justify-start"
                      )}
                      style={{
                        marginTop: mode === 'alternating' ? undefined : '60px',
                        paddingBottom:
                          mode === 'alternating' && isEven
                            ? style === 'infographic'
                              ? '54px'
                              : '32px'
                            : undefined,
                        paddingTop:
                          (mode === 'alternating' && !isEven) || mode === 'same_side'
                            ? style === 'infographic'
                              ? '54px'
                              : '32px'
                            : undefined,
                      }}
                    >
                      {style === 'infographic' && (
                        <div
                          className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-0"
                          style={{
                            top: mode === 'alternating' ? (isEven ? 'auto' : '0') : '0',
                            bottom: mode === 'alternating' ? (isEven ? '0' : 'auto') : 'auto',
                            marginTop: mode === 'alternating' ? (isEven ? '0' : '-60px') : '-60px',
                            marginBottom: mode === 'alternating' ? (isEven ? '-60px' : '0') : '0',
                            width: '64px',
                            height: '120px',
                          }}
                        >
                          <svg
                            width="64"
                            height="120"
                            viewBox="0 0 64 120"
                            className="fill-none"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect
                              x="20"
                              y="57"
                              width="24"
                              height="6"
                              className="fill-white dark:fill-neutral-950 stroke-none"
                            />
                            <motion.path
                              initial={animated ? { pathLength: 0, opacity: 0 } : false}
                              animate={animated ? { pathLength: 1, opacity: 1 } : false}
                              transition={{
                                delay: animated ? Math.min(index * 0.2 + 0.2, 2) : 0,
                                duration: 0.5,
                                ease: "easeOut",
                              }}
                              stroke="#6366f1"
                              d={
                                mode === 'alternating'
                                  ? isEven
                                    ? "M 0 60 L 22 60 A 10 10 0 0 1 32 50 L 32 18"
                                    : "M 0 60 L 22 60 A 10 10 0 0 0 32 70 L 32 102"
                                  : "M 0 60 L 22 60 A 10 10 0 0 0 32 70 L 32 102"
                              }
                            />
                            {index < sortedData.length - 1 && (
                              <motion.path
                                initial={animated ? { pathLength: 0, opacity: 0 } : false}
                                animate={animated ? { pathLength: 1, opacity: 1 } : false}
                                transition={{
                                  delay: animated ? Math.min(index * 0.2 + 0.4, 2.2) : 0,
                                  duration: 0.5,
                                  ease: "easeOut",
                                }}
                                stroke="#6366f1"
                                d={
                                  mode === 'alternating'
                                    ? isEven
                                      ? "M 32 70 A 10 10 0 0 0 42 60 L 64 60"
                                      : "M 32 50 A 10 10 0 0 1 42 60 L 64 60"
                                    : "M 32 50 A 10 10 0 0 1 42 60 L 64 60"
                                }
                              />
                            )}
                            <circle cx="32" cy="60" r="4.5" fill={itemColor} stroke="none" />
                            {mode === 'alternating' ? (
                              isEven ? (
                                <circle cx="32" cy="18" r="4.5" fill={itemColor} stroke="none" />
                              ) : (
                                <circle cx="32" cy="102" r="4.5" fill={itemColor} stroke="none" />
                              )
                            ) : (
                              <circle cx="32" cy="102" r="4.5" fill={itemColor} stroke="none" />
                            )}
                          </svg>
                        </div>
                      )}

                      <div className="relative z-10 w-full">
                        {style === 'infographic'
                          ? renderInfographicContent(
                              item,
                              title,
                              desc,
                              iconStatus,
                              rawDate,
                              false,
                              true,
                              isEven,
                              itemColor
                            )
                          : renderCardContent(item, title, desc, iconStatus, rawDate, false)}
                      </div>
                    </motion.div>
                  </div>
                )
              })}

              {sortedData.length === 0 && (
                <div className="text-center py-20 w-full">
                  <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-neutral-300 dark:text-neutral-600" />
                  </div>
                  <h3 className="text-lg font-bold text-neutral-400 dark:text-neutral-500">
                    Nenhum registro encontrado
                  </h3>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Direção Vertical */
          <div className={cn("relative mx-auto py-12 px-6", style === 'infographic' ? "max-w-4xl" : "max-w-5xl")}>
            {/* Linha vertical principal */}
            <motion.div
              initial={animated ? { scaleY: 0 } : false}
              animate={animated ? { scaleY: 1 } : false}
              transition={{ duration: Math.min(sortedData.length * 0.3 + 0.4, 3), ease: "easeOut" }}
              className={cn(
                "absolute top-0 bottom-0 w-[3px] bg-[#6366f1] -translate-x-1/2 rounded-full origin-top",
                mode === 'same_side' ? "left-8" : "left-8 md:left-1/2"
              )}
            />

            <div className="space-y-12">
              {sortedData.map((item, index) => {
                const isEven = index % 2 === 0
                const primaryKey = item.id || item.ID || item._id || index
                const rawDate = item[timelineConfig.dateField]
                const title = resolveFieldValue(item, timelineConfig.titleField) || 'Sem Título'
                const desc = resolveFieldValue(item, timelineConfig.descField)
                const iconStatus = resolveFieldValue(item, timelineConfig.iconField)
                const itemColor = COLORS[index % COLORS.length]

                return (
                  <div
                    key={\`timeline-v-\${primaryKey}-\${index}\`}
                    className="relative flex items-start justify-between md:justify-normal w-full group"
                  >
                    {/* Nó na Linha Vertical */}
                    <motion.div
                      initial={animated ? { scale: 0, opacity: 0 } : false}
                      animate={animated ? { scale: 1, opacity: 1 } : false}
                      whileHover={{ backgroundColor: itemColor }}
                      transition={{ delay: animated ? Math.min(index * 0.2 + 0.2, 2) : 0, duration: 0.2 }}
                      className={cn(
                        "absolute w-4 h-4 bg-white dark:bg-neutral-900 border-4 rounded-full transition-colors duration-200 z-10 -translate-x-1/2 mt-4",
                        mode === 'same_side' ? "left-8" : "left-8 md:left-1/2"
                      )}
                      style={{
                        borderColor: itemColor,
                        boxShadow: \`0 0 15px \${itemColor}66\`,
                      }}
                    />

                    {/* Conteúdo Desktop Alternado */}
                    {mode === 'alternating' && (
                      <motion.div
                        initial={animated ? { x: isEven ? -20 : 20, opacity: 0 } : false}
                        animate={animated ? { x: 0, opacity: 1 } : false}
                        transition={{ delay: animated ? Math.min(index * 0.2 + 0.3, 2.2) : 0, duration: 0.4 }}
                        className={cn(
                          "hidden md:flex w-full relative",
                          isEven
                            ? "w-[calc(50%-2rem)] mr-auto justify-end pr-6"
                            : "w-[calc(50%-2rem)] ml-auto justify-start pl-6"
                        )}
                      >
                        <div className="relative z-10 w-full" style={{ maxWidth: \`\${scale * 450}px\` }}>
                          {style === 'infographic'
                            ? renderInfographicContent(
                                item,
                                title,
                                desc,
                                iconStatus,
                                rawDate,
                                isEven,
                                false,
                                isEven,
                                itemColor
                              )
                            : renderCardContent(item, title, desc, iconStatus, rawDate, isEven)}
                        </div>
                      </motion.div>
                    )}

                    {/* Conteúdo Mobile (ou Same Side no Desktop) */}
                    <motion.div
                      initial={animated ? { x: 20, opacity: 0 } : false}
                      animate={animated ? { x: 0, opacity: 1 } : false}
                      transition={{ delay: animated ? Math.min(index * 0.2 + 0.3, 2.2) : 0, duration: 0.4 }}
                      className={cn("flex w-full relative pl-16 pr-4", mode === 'same_side' ? "" : "md:hidden")}
                    >
                      <div className="relative z-10 w-full" style={{ maxWidth: \`\${scale * 450}px\` }}>
                        {style === 'infographic'
                          ? renderInfographicContent(
                              item,
                              title,
                              desc,
                              iconStatus,
                              rawDate,
                              false,
                              false,
                              false,
                              itemColor
                            )
                          : renderCardContent(item, title, desc, iconStatus, rawDate, false)}
                      </div>
                    </motion.div>
                  </div>
                )
              })}

              {sortedData.length === 0 && (
                <div className="text-center py-20">
                  <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-neutral-300 dark:text-neutral-600" />
                  </div>
                  <h3 className="text-lg font-bold text-neutral-400 dark:text-neutral-500">
                    Nenhum registro encontrado
                  </h3>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Barra de Paginação / Carregar Mais idêntica à Web Produção */}
        {hasMore && onLoadMore && (
          <div className="flex justify-center pb-8 pt-4">
            <button
              type="button"
              onClick={onLoadMore}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-md hover:shadow-lg hover:border-indigo-500/30 text-xs font-black tracking-widest text-indigo-600 dark:text-indigo-400 uppercase transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              CARREGAR MAIS {visibleCount} REGISTROS... ({Math.min(sortedData.length, totalRecords)} DE {totalRecords})
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
`
}
