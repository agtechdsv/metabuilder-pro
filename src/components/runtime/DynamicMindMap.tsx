"use client"

import React, { useEffect } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { ChevronRight, Loader2, Eye, Edit, Trash2 } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'
import DynamicIcon from './DynamicIcon'
import { useMindMapData, MindMapNode, UseMindMapDataProps } from './mindmap/useMindMapData'
import { MindMapControls } from './mindmap/MindMapControls'

// Componente interno para Tooltip Estilizada
const Tooltip = ({ children, text }: { children: React.ReactNode, text: string }) => {
  const [show, setShow] = React.useState(false)
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

interface DynamicMindMapProps extends UseMindMapDataProps {
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onEditLevel?: (levelIndex: number, row: any) => void
  onDelete?: (row: any) => void
  dictionary?: any
  customActions?: any[]
  onCustomAction?: (action: any, rowData?: any) => Promise<void>
}

export default function DynamicMindMap(props: DynamicMindMapProps) {
  const { t } = useI18n()
  const { dictionary, onView, onEdit, onEditLevel, onDelete, customActions, onCustomAction, mindmapLevels } = props
  const [zoom, setZoom] = React.useState(1)
  const controls = useAnimation()
  
  const {
    treeData,
    currentNode,
    currentPath,
    loadingPath,
    handleNodeClick,
    handleGoBack,
    isRelational,
    relationalTree
  } = useMindMapData(props)

  // Sincronizar posição e escala
  useEffect(() => {
    controls.start({ 
      x: 0, 
      y: 0, 
      scale: zoom, 
      transition: { type: "spring", stiffness: 120, damping: 25 } 
    })
  }, [currentPath, zoom, controls])

  const handleReset = () => {
    setZoom(1)
    handleGoBack() // Reset path could be implemented in hook, but we just trigger back logic or center
    controls.start({ x: 0, y: 0, scale: 1, transition: { type: "spring", stiffness: 150, damping: 22 } })
  }

  const handleCenterView = () => {
    setZoom(1)
    controls.start({ x: 0, y: 0, scale: 1, transition: { type: "spring", stiffness: 150, damping: 22 } })
  }

  const renderValue = (field: any, val: any) => {
    if (!field) return String(val)
    if (val === null || val === undefined) return '-'
    if (typeof val === 'boolean') return val ? 'Yes' : 'No'
    if (field?.data_type === 'uuid' && dictionary?.[val]) return dictionary[val]
    return String(val)
  }

  if (!treeData || treeData.length === 0) {
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
            {currentNode.children?.map((child: MindMapNode, idx: number) => {
              const total = currentNode.children!.length
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
              {isRelational ? (currentPath.length === 0 ? 'Workspace' : `${t('runtime.level', 'Nível')} ${currentNode.level + 1}`) : (currentNode.field?.display_name || 'Core')}
            </span>
            <h3 className="text-2xl font-black text-neutral-900 dark:text-white leading-tight break-words max-w-full">
              {renderValue(currentNode.field, currentNode.name)}
            </h3>
            {currentNode.desc && (
              <p className="text-[10px] text-neutral-500 mt-2">{currentNode.desc}</p>
            )}
            <div className="mt-4 px-4 py-1.5 bg-indigo-500/10 rounded-full border border-indigo-500/20">
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-200 uppercase tracking-widest">{currentNode.count || currentNode.children?.length || 0} records</span>
            </div>
          </motion.div>

          {/* Orbitais */}
          <AnimatePresence>
            {currentNode.children?.map((child: MindMapNode, idx: number) => {
              const total = currentNode.children!.length
              const angleRad = ((idx / total) * Math.PI * 2) - (Math.PI / 2)
              const radius = 260
              const x = Math.cos(angleRad) * radius
              const y = Math.sin(angleRad) * radius
              const hasChildren = child.children === undefined || child.children.length > 0
              const isLoading = loadingPath === [...currentPath, idx].join('-')

              return (
                <motion.div
                  key={`child-${child.id}`}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                  animate={{ x, y, opacity: 1, scale: 1 }}
                  exit={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                  whileHover={{ scale: 1.05, zIndex: 40 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20, delay: idx * 0.05 }}
                  className={cn(
                    "absolute z-20 w-48 p-5 rounded-[2rem] border transition-all cursor-pointer overflow-hidden backdrop-blur-xl shadow-xl group/node",
                    hasChildren 
                      ? "bg-white/90 dark:bg-slate-900/80 border-neutral-200 dark:border-white/10 hover:border-indigo-500/60" 
                      : "bg-white/40 dark:bg-slate-900/40 border-neutral-200 dark:border-white/5 opacity-90 hover:opacity-100"
                  )}
                  onClick={() => handleNodeClick(idx)}
                >
                  <div className="flex flex-col gap-2 relative">
                    <span 
                      style={!isRelational ? {
                        fontFamily: (child.field?.config?.grid_config || child.field?.config)?.label?.font,
                        fontSize: (child.field?.config?.grid_config || child.field?.config)?.label?.size || '8px',
                        color: (child.field?.config?.grid_config || child.field?.config)?.label?.color,
                      } : {}}
                      className={cn(
                        "text-[8px] uppercase font-black tracking-[0.2em]",
                        (!isRelational && !(child.field?.config?.grid_config || child.field?.config)?.label?.color) && "text-neutral-400 dark:text-neutral-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400",
                        isRelational && "text-indigo-500 dark:text-indigo-400"
                      )}
                    >
                      {isRelational ? `${t('runtime.level', 'Nível')} ${child.level + 1}` : ((child.field?.config?.grid_config || child.field?.config)?.label?.text || child.field?.display_name || 'Level')}
                    </span>
                    <h4 
                      style={!isRelational ? {
                        fontFamily: (child.field?.config?.grid_config || child.field?.config)?.content?.font,
                        fontSize: (child.field?.config?.grid_config || child.field?.config)?.content?.size || '12px',
                        color: (child.field?.config?.grid_config || child.field?.config)?.content?.color,
                      } : {}}
                      className={cn(
                        "text-xs font-bold leading-tight",
                        (!isRelational && !(child.field?.config?.grid_config || child.field?.config)?.content?.color) && "text-neutral-800 dark:text-neutral-100",
                        isRelational && "text-neutral-800 dark:text-neutral-100"
                      )}
                    >
                      {renderValue(child.field, child.name)}
                    </h4>
                    {child.desc && (
                      <p className="text-[10px] text-neutral-500 truncate leading-tight">{child.desc}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-[1.5px] bg-neutral-200 dark:bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500/40 w-2/3" />
                      </div>
                      <span className="text-[9px] font-black text-neutral-400 dark:text-neutral-500">{child.children === undefined ? '?' : child.count || child.children.length}</span>
                    </div>
                  </div>
                  
                  {/* Hover Actions */}
                  {child.rawData && (
                    <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover/node:opacity-100 transition-opacity bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-1 rounded-lg border border-neutral-200 dark:border-white/10 shadow-sm z-50">
                      {onView && (
                        <Tooltip text={t('actions.view', 'Visualizar')}>
                          <button onClick={(e) => { e.stopPropagation(); onView({ ...child.rawData, __model_name: child.field?.model_name || child.rawData?.__model_name }) }} className="p-1 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-md transition-colors"><Eye className="w-3 h-3 text-neutral-500 hover:text-indigo-500" /></button>
                        </Tooltip>
                      )}
                      {(onEditLevel && mindmapLevels && mindmapLevels[child.level]?.edit_usecase_slug) ? (
                        <Tooltip text={t('actions.edit', 'Editar')}>
                          <button onClick={(e) => { e.stopPropagation(); onEditLevel(child.level, { ...child.rawData, __model_name: child.field?.model_name || child.rawData?.__model_name }) }} className="p-1 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-md transition-colors"><Edit className="w-3 h-3 text-neutral-500 hover:text-indigo-500" /></button>
                        </Tooltip>
                      ) : onEdit ? (
                        <Tooltip text={t('actions.edit', 'Editar')}>
                          <button onClick={(e) => { e.stopPropagation(); onEdit({ ...child.rawData, __model_name: child.field?.model_name || child.rawData?.__model_name }) }} className="p-1 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-md transition-colors"><Edit className="w-3 h-3 text-neutral-500 hover:text-indigo-500" /></button>
                        </Tooltip>
                      ) : null}
                      {onDelete && (
                        <Tooltip text={t('actions.delete', 'Excluir')}>
                          <button onClick={(e) => { e.stopPropagation(); onDelete({ ...child.rawData, __model_name: child.field?.model_name || child.rawData?.__model_name }) }} className="p-1 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-md transition-colors"><Trash2 className="w-3 h-3 text-neutral-500 hover:text-red-500" /></button>
                        </Tooltip>
                      )}
                      {customActions?.filter((action: any) => {
                        if (!isRelational) return true
                        const levelStr = String(child.level + 1)
                        return action.placements?.some((p: any) => p.location === `mindmap:level:${levelStr}`)
                      }).map((action: any, i: number) => {
                        const handleClick = (e: React.MouseEvent) => {
                          e.stopPropagation()
                          const ancestors: { level: number; rawData: any }[] = []
                          if (isRelational && currentPath.length > 0) {
                            let cursor: any = { children: relationalTree }
                            for (let pi = 0; pi < currentPath.length; pi++) {
                              cursor = cursor.children?.[currentPath[pi]]
                              if (cursor && cursor.rawData) {
                                ancestors.push({ level: cursor.level + 1, rawData: cursor.rawData })
                              }
                            }
                          }
                          onCustomAction?.(action, {
                            ...child.rawData,
                            __mindmap_level__: child.level + 1,
                            __mindmap_ancestors__: ancestors
                          })
                        }
                        return (
                          <Tooltip key={i} text={action.label || 'Ação Customizada'}>
                             <button onClick={handleClick} className="p-1 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-md transition-colors">
                               <DynamicIcon icon={action.icon || 'Zap'} className="w-3 h-3 text-neutral-500 hover:text-amber-500" />
                             </button>
                          </Tooltip>
                        )
                      })}
                    </div>
                  )}
                  {hasChildren && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-indigo-500/60" />
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Controles e UI extraídos */}
      <MindMapControls 
        currentPath={currentPath}
        currentNode={currentNode}
        isRelational={!!isRelational}
        setZoom={setZoom}
        handleGoBack={handleGoBack}
        handleReset={handleReset}
        handleCenterView={handleCenterView}
      />
    </div>
  )
}
