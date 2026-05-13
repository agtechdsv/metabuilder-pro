"use client"

import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  ArrowLeft,
  Maximize2
} from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'

interface DynamicMindMapProps {
  data: any[]
  fields: any[]
  centralFieldId?: string
  primaryKeyName: string
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => void
  dictionary?: any
}

// Componente interno para Tooltip Estilizada (Multi-Tema)
const Tooltip = ({ children, text }: { children: React.ReactNode, text: string }) => {
  const [show, setShow] = useState(false)
  return (
    <div className="relative flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 5, scale: 0.95 }}
            className="absolute right-full mr-3 px-3 py-1.5 bg-white/90 dark:bg-slate-900/90 border border-neutral-200 dark:border-white/10 rounded-lg backdrop-blur-xl shadow-2xl pointer-events-none whitespace-nowrap z-[100]"
          >
            <span className="text-[10px] font-bold text-neutral-800 dark:text-white uppercase tracking-wider">{text}</span>
            <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 rotate-45 bg-white dark:bg-slate-900 border-r border-t border-neutral-200 dark:border-white/10" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function DynamicMindMap({
  data,
  fields,
  centralFieldId,
  primaryKeyName,
  onView,
  onEdit,
  onDelete,
  dictionary = {}
}: DynamicMindMapProps) {
  const { t } = useI18n()
  const [zoom, setZoom] = useState(1)
  const [currentPath, setCurrentPath] = useState<number[]>([])
  const controls = useAnimation()

  // Sincronizar posição e escala
  useEffect(() => {
    controls.start({ 
      x: 0, 
      y: 0, 
      scale: zoom, 
      transition: { type: "spring", stiffness: 120, damping: 25 } 
    })
  }, [currentPath, zoom, controls])

  // 1. Processamento da Árvore
  const treeData = useMemo(() => {
    if (!data || data.length === 0 || !fields || fields.length === 0) return []
    let hierarchyFields = fields.filter(f => !f.hidden)
    const centralField = fields.find(f => f.id === centralFieldId)
    if (centralField) {
      hierarchyFields = [centralField, ...hierarchyFields.filter(f => f.id !== centralFieldId)]
    }

    const getValue = (item: any, field: any) => {
      if (!item || !field) return undefined
      const colName = field.db_column_name
      if (colName.includes('.')) {
        const parts = colName.split('.')
        let current = item
        for (const part of parts) {
          if (current && typeof current === 'object' && part in current) current = current[part]
          else { current = undefined; break; }
        }
        if (current !== undefined) return current
      }
      if (item[colName] !== undefined) return item[colName]
      const simpleName = colName.includes('.') ? colName.split('.').pop() : colName
      if (simpleName && item[simpleName] !== undefined) return item[simpleName]
      return undefined
    }

    const buildTree = (items: any[], level: number): any[] => {
      if (level >= hierarchyFields.length) return []
      const currentField = hierarchyFields[level]
      const groups = new Map<string, any[]>()
      items.forEach(item => {
        const val = getValue(item, currentField)
        const keyStr = val !== undefined && val !== null && val !== '' ? String(val) : 'Unassigned'
        if (!groups.has(keyStr)) groups.set(keyStr, [])
        groups.get(keyStr)!.push(item)
      })
      return Array.from(groups.entries()).map(([name, groupItems], idx) => ({
        id: `lvl${level}-${idx}-${name}`,
        name,
        count: groupItems.length,
        level,
        field: currentField,
        rawData: groupItems[0],
        children: buildTree(groupItems, level + 1)
      }))
    }
    return buildTree(data, 0)
  }, [data, fields, centralFieldId])

  const currentNode = useMemo(() => {
    let current = { children: treeData } as any
    for (const index of currentPath) {
      if (current.children && current.children[index]) current = current.children[index]
    }
    return current
  }, [treeData, currentPath])

  const handleNodeClick = (index: number) => {
    if (currentNode.children[index]?.children?.length > 0) {
      setCurrentPath([...currentPath, index])
    }
  }

  const handleGoBack = () => {
    if (currentPath.length > 0) setCurrentPath(currentPath.slice(0, -1))
  }

  const handleReset = () => {
    setZoom(1)
    setCurrentPath([])
    controls.start({ x: 0, y: 0, scale: 1, transition: { type: "spring", stiffness: 150, damping: 22 } })
  }

  const handleCenterView = () => {
    setZoom(1)
    controls.start({ x: 0, y: 0, scale: 1, transition: { type: "spring", stiffness: 150, damping: 22 } })
  }

  const renderValue = (field: any, val: any) => {
    if (val === null || val === undefined) return '-'
    if (typeof val === 'boolean') return val ? 'Yes' : 'No'
    if (field?.data_type === 'uuid' && dictionary?.[val]) return dictionary[val]
    return String(val)
  }

  if (treeData.length === 0) {
    return (
      <div className="py-20 text-center text-neutral-500 bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem]">
        {t('runtime.no_results')}
      </div>
    )
  }

  return (
    <div className="relative w-full h-[750px] bg-slate-50 dark:bg-neutral-950 rounded-[3rem] overflow-hidden border border-neutral-200 dark:border-white/5 shadow-2xl group select-none transition-colors duration-500">
      {/* Background Decorativo Adaptativo */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.05),transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.15),transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] dark:opacity-10 mix-blend-soft-light pointer-events-none" />
      
      {/* Canvas Pannable */}
      <motion.div 
        className="relative w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
        drag
        dragConstraints={{ left: -1200, right: 1200, top: -1200, bottom: 1200 }}
        dragElastic={0.15}
        dragMomentum={true}
        animate={controls}
      >
        {/* Camada de Conexões */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
          <AnimatePresence>
            {currentNode.children?.map((child: any, idx: number) => {
              const total = currentNode.children.length
              const angle = (idx / total) * 360 - 90
              const radius = 260
              
              return (
                <motion.div
                  key={`conn-${child.id}`}
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: radius }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.8, delay: idx * 0.05 }}
                  style={{
                    position: 'absolute',
                    height: '2px',
                    transformOrigin: '0% 50%',
                    rotate: `${angle}deg`,
                    left: '50%',
                    top: '50%',
                    zIndex: 5
                  }}
                >
                  <svg width="100%" height="20" style={{ overflow: 'visible', position: 'absolute', top: -10 }}>
                    <path
                      d={`M 0 10 L ${radius} 10`}
                      className="stroke-indigo-500/30 dark:stroke-indigo-400/40"
                      strokeWidth="2"
                      strokeDasharray="4 6"
                    />
                  </svg>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {/* Camada de Nós */}
        <div className="relative z-20 flex items-center justify-center w-full h-full">
          {/* Nó Central */}
          <motion.div
            key={`center-${currentNode.id}`}
            layoutId="centerNode"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="z-30 relative w-56 h-56 rounded-full bg-white/80 dark:bg-slate-900/60 border-2 border-indigo-500/20 dark:border-indigo-500/40 backdrop-blur-[40px] flex flex-col items-center justify-center p-8 text-center shadow-[0_0_80px_rgba(79,70,229,0.1)] dark:shadow-[0_0_80px_rgba(79,70,229,0.25)]"
          >
            <span className="text-[10px] uppercase font-black tracking-[0.4em] text-indigo-500 dark:text-indigo-400 mb-2 opacity-70">
              {currentNode.field?.display_name || 'Core'}
            </span>
            <h3 className="text-2xl font-black text-neutral-900 dark:text-white leading-tight break-words max-w-full">
              {renderValue(currentNode.field, currentNode.name)}
            </h3>
            <div className="mt-4 px-4 py-1.5 bg-indigo-500/10 rounded-full border border-indigo-500/20">
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-200 uppercase tracking-widest">{currentNode.count} records</span>
            </div>
          </motion.div>

          {/* Orbitais */}
          <AnimatePresence>
            {currentNode.children?.map((child: any, idx: number) => {
              const total = currentNode.children.length
              const angleRad = ((idx / total) * Math.PI * 2) - (Math.PI / 2)
              const radius = 260
              const x = Math.cos(angleRad) * radius
              const y = Math.sin(angleRad) * radius
              const hasChildren = child.children?.length > 0

              return (
                <motion.div
                  key={`child-${child.id}`}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                  animate={{ x, y, opacity: 1, scale: 1 }}
                  exit={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                  whileHover={{ scale: 1.05, zIndex: 40 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20, delay: idx * 0.05 }}
                  className={cn(
                    "absolute z-20 w-48 p-5 rounded-[2rem] border transition-all cursor-pointer overflow-hidden backdrop-blur-xl shadow-xl",
                    hasChildren 
                      ? "bg-white/90 dark:bg-slate-900/80 border-neutral-200 dark:border-white/10 hover:border-indigo-500/60" 
                      : "bg-white/40 dark:bg-slate-900/40 border-neutral-200 dark:border-white/5 opacity-90 hover:opacity-100"
                  )}
                  onClick={() => handleNodeClick(idx)}
                >
                  <div className="flex flex-col gap-2 relative">
                    <span 
                      style={{
                        fontFamily: (child.field?.config?.grid_config || child.field?.config)?.label?.font,
                        fontSize: (child.field?.config?.grid_config || child.field?.config)?.label?.size || '8px',
                        color: (child.field?.config?.grid_config || child.field?.config)?.label?.color,
                      }}
                      className={cn(
                        "text-[8px] uppercase font-black tracking-[0.2em]",
                        !(child.field?.config?.grid_config || child.field?.config)?.label?.color && "text-neutral-400 dark:text-neutral-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400"
                      )}
                    >
                      {(child.field?.config?.grid_config || child.field?.config)?.label?.text || child.field?.display_name || 'Level'}
                    </span>
                    <h4 
                      style={{
                        fontFamily: (child.field?.config?.grid_config || child.field?.config)?.content?.font,
                        fontSize: (child.field?.config?.grid_config || child.field?.config)?.content?.size || '12px',
                        color: (child.field?.config?.grid_config || child.field?.config)?.content?.color,
                      }}
                      className={cn(
                        "text-xs font-bold leading-tight",
                        !(child.field?.config?.grid_config || child.field?.config)?.content?.color && "text-neutral-800 dark:text-neutral-100"
                      )}
                    >
                      {renderValue(child.field, child.name)}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-[1.5px] bg-neutral-200 dark:bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500/40 w-2/3" />
                      </div>
                      <span className="text-[9px] font-black text-neutral-400 dark:text-neutral-500">{child.count}</span>
                    </div>
                  </div>
                  {hasChildren && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <ChevronRight className="w-3.5 h-3.5 text-indigo-500/60" />
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Toolbar Superior */}
      <div className="absolute top-8 left-8 z-50 flex items-center gap-4">
        {currentPath.length > 0 && (
          <Tooltip text="Voltar Nível">
            <button onClick={handleGoBack} className="p-4 bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-3xl transition-all active:scale-95 shadow-xl pointer-events-auto group">
              <ArrowLeft className="w-5 h-5 text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white" />
            </button>
          </Tooltip>
        )}
        <div className="px-6 py-4 bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-3xl shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] font-black text-neutral-700 dark:text-white uppercase tracking-[0.3em] opacity-80">
              {currentPath.length === 0 ? 'Workspace' : currentNode.field?.display_name || 'Level'}
            </span>
          </div>
        </div>
      </div>

      {/* Controles Laterais */}
      <div className="absolute top-8 right-8 z-50 flex flex-col gap-2">
        <Tooltip text="Aumentar Zoom">
          <button onClick={() => setZoom(z => Math.min(z + 0.2, 2))} className="p-3 bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-3xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all pointer-events-auto shadow-xl"><ZoomIn className="w-5 h-5" /></button>
        </Tooltip>
        <Tooltip text="Diminuir Zoom">
          <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))} className="p-3 bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-3xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all pointer-events-auto shadow-xl"><ZoomOut className="w-5 h-5" /></button>
        </Tooltip>
        <div className="w-full h-px bg-neutral-200 dark:bg-white/5 my-1" />
        <Tooltip text="Resetar Tudo">
          <button onClick={handleReset} className="p-3 bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-3xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all pointer-events-auto shadow-xl"><RotateCcw className="w-5 h-5" /></button>
        </Tooltip>
        <Tooltip text="Centralizar Vista">
          <button onClick={handleCenterView} className="p-3 bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-3xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all pointer-events-auto shadow-xl"><Maximize2 className="w-5 h-5" /></button>
        </Tooltip>
      </div>

      {/* Barra de Status Inferior */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-8 py-3 bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-full backdrop-blur-3xl flex items-center gap-6 shadow-2xl z-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[9px] font-black text-neutral-600 dark:text-white uppercase tracking-[0.3em] opacity-60">Nexo Engine Active</span>
        </div>
        <div className="w-px h-3 bg-neutral-200 dark:bg-white/10" />
        <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{currentNode.children?.length || 0} Orbitals</span>
      </div>
    </div>
  )
}
