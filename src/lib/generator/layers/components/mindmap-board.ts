export function generateMindMapBoardComponent(files: Map<string, string>) {
  files.set('components/MindMapBoard.tsx', generateMindMapBoardCode())
}

function generateMindMapBoardCode(): string {
  return `'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Eye,
  Pencil,
  Trash2,
  Search,
  Share2,
  ChevronRight,
  Layers,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MindMapLevel {
  modelId?: string
  modelTable?: string
  modelName?: string
  titleField: string
  descField?: string
  relationType?: 'direct' | 'indirect' | 'multilevel'
  foreignKey?: string
}

export interface MindmapConfig {
  centralFieldId?: string
  levels?: MindMapLevel[]
  hierarchyFields?: string[]
}

export interface MindMapNode {
  id: string
  name: string
  desc?: string
  count: number
  level: number
  field?: string
  rawData?: any
  children?: MindMapNode[]
}

export interface MindMapBoardProps {
  data: any[]
  fields?: any[]
  mindmapConfig?: MindmapConfig
  relationalOptions?: Record<string, Array<{ value: string; label: string }>>
  onFetchChildren?: (nextLevelIndex: number, parentNode: MindMapNode) => Promise<MindMapNode[]>
  onView?: (row: any, level?: number) => void
  onEdit?: (row: any, level?: number) => void
  onDelete?: (row: any, level?: number) => Promise<void> | void
}

export function MindMapBoard({
  data = [],
  fields = [],
  mindmapConfig = {},
  relationalOptions = {},
  onFetchChildren,
  onView,
  onEdit,
  onDelete,
}: MindMapBoardProps) {
  const [zoom, setZoom] = useState(1)
  const [currentPath, setCurrentPath] = useState<number[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingNodeId, setLoadingNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const controls = useAnimation()

  const isRelational = Boolean(mindmapConfig?.levels && mindmapConfig.levels.length > 1)
  const [relationalTree, setRelationalTree] = useState<MindMapNode[]>([])

  const updateNodeChildren = useCallback((nodes: MindMapNode[], targetId: string, newKids: MindMapNode[]): MindMapNode[] => {
    return nodes.map(n => {
      if (n.id === targetId) {
        return { ...n, children: newKids, count: newKids.length }
      }
      if (n.children && n.children.length > 0) {
        return { ...n, children: updateNodeChildren(n.children, targetId, newKids) }
      }
      return n
    })
  }, [])

  useEffect(() => {
    if (!isRelational || !data || data.length === 0) return
    const rootLvl = mindmapConfig.levels![0]
    const newNodes: MindMapNode[] = data.map((item, idx) => {
      const title = rootLvl.titleField ? item[rootLvl.titleField] : (item.nome || item.name || item.title || item.id)
      const desc = rootLvl.descField ? item[rootLvl.descField] : undefined
      const id = String(item.id ?? item.uuid ?? ('root-' + idx))
      return {
        id,
        name: String(title || 'Sem Título'),
        desc: desc ? String(desc) : undefined,
        count: 0,
        level: 0,
        rawData: item,
        children: undefined,
      }
    })

    setRelationalTree(prev => {
      if (prev.length === 0) return newNodes
      const prevMap = new Map(prev.map(n => [n.id, n]))
      return newNodes.map(n => {
        const old = prevMap.get(n.id)
        return old && old.children !== undefined ? { ...n, children: old.children, count: old.count } : n
      })
    })
  }, [data, isRelational, mindmapConfig.levels])

  const hierarchyFields = useMemo(() => {
    if (mindmapConfig.hierarchyFields && mindmapConfig.hierarchyFields.length > 0) {
      return mindmapConfig.hierarchyFields
    }
    const cols = fields
      .filter(f => !f.isPrimaryKey && !f.isVirtual && !f.isByoc)
      .map(f => f.dbColumn)
    return cols.length > 0 ? cols : ['nome', 'id']
  }, [mindmapConfig, fields])

  // Constrói árvore hierárquica por níveis / agrupamento (Modo Pivot)
  const pivotTree = useMemo(() => {
    if (!data || data.length === 0) return []

    // Helper para extrair valor amigável
    const getVal = (row: any, col: string): string => {
      const raw = row[col] ?? row[col.replace(/_/g, '.')] ?? ''
      if (relationalOptions[col]) {
        const opt = relationalOptions[col].find(o => o.value === String(raw))
        if (opt) return opt.label
      }
      return String(raw || '')
    }

    const buildTree = (items: any[], levelIdx: number): MindMapNode[] => {
      if (levelIdx >= hierarchyFields.length) return []
      const col = hierarchyFields[levelIdx]

      const groups = new Map<string, any[]>()
      items.forEach(item => {
        const val = getVal(item, col) || 'Não atribuído'
        if (!groups.has(val)) groups.set(val, [])
        groups.get(val)!.push(item)
      })

      return Array.from(groups.entries()).map(([name, groupItems], idx) => {
        const first = groupItems[0]
        const descCol = hierarchyFields[levelIdx + 1]
        const desc = descCol ? getVal(first, descCol) : undefined

        return {
          id: 'lvl' + levelIdx + '-' + idx + '-' + name,
          name,
          desc: desc && desc !== name ? desc : undefined,
          count: groupItems.length,
          level: levelIdx,
          field: col,
          rawData: first,
          children: buildTree(groupItems, levelIdx + 1),
        }
      })
    }

    return buildTree(data, 0)
  }, [data, hierarchyFields, relationalOptions])

  const rootTree = isRelational ? relationalTree : pivotTree

  // Nó raiz virtual que engloba a base completa
  const virtualRoot: MindMapNode = useMemo(() => ({
    id: 'root-core',
    name: 'Workspace',
    desc: data.length + (data.length === 1 ? ' registro' : ' registros'),
    count: data.length,
    level: -1,
    children: rootTree,
  }), [data.length, rootTree])

  // Nó ativo atualmente focalizado no centro
  const currentNode: MindMapNode = useMemo(() => {
    let node = virtualRoot
    for (const index of currentPath) {
      if (node.children && node.children[index]) {
        node = node.children[index]
      }
    }
    return node
  }, [virtualRoot, currentPath])

  // Breadcrumbs para navegação
  const breadcrumbTrail = useMemo(() => {
    const trail: Array<{ name: string; path: number[] }> = [{ name: 'Início', path: [] }]
    let node = virtualRoot
    const runningPath: number[] = []

    for (const idx of currentPath) {
      if (node.children && node.children[idx]) {
        runningPath.push(idx)
        node = node.children[idx]
        trail.push({ name: node.name, path: [...runningPath] })
      }
    }
    return trail
  }, [virtualRoot, currentPath])

  // Efeito para recentralizar com animação
  useEffect(() => {
    controls.start({
      x: 0,
      y: 0,
      scale: zoom,
      transition: { type: 'spring', stiffness: 120, damping: 25 },
    })
  }, [currentPath, zoom, controls])

  const handleDrillDown = (childIndex: number) => {
    setCurrentPath(prev => [...prev, childIndex])
  }

  const handleGoBack = () => {
    if (currentPath.length > 0) {
      setCurrentPath(prev => prev.slice(0, -1))
    }
  }

  const handleReset = () => {
    setZoom(1)
    setCurrentPath([])
    controls.start({ x: 0, y: 0, scale: 1, transition: { type: 'spring', stiffness: 150, damping: 22 } })
  }

  const handleCenter = () => {
    controls.start({ x: 0, y: 0, scale: zoom, transition: { type: 'spring', stiffness: 150, damping: 22 } })
  }

  // Filtragem na busca
  const filteredChildren = useMemo(() => {
    const children = currentNode.children || []
    if (!searchTerm.trim()) return children
    const q = searchTerm.toLowerCase().trim()
    return children.filter(c => c.name.toLowerCase().includes(q) || (c.desc && c.desc.toLowerCase().includes(q)))
  }, [currentNode, searchTerm])

  return (
    <div className="w-full flex flex-col bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
      {/* TOOLBAR PRINCIPAL */}
      <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-50/50 dark:bg-neutral-900/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
            <Share2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-neutral-900 dark:text-white">Mapa Mental &amp; Hierarquias</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              {breadcrumbTrail.map((crumb, i) => (
                <React.Fragment key={crumb.name + '-' + i}>
                  {i > 0 && <ChevronRight className="w-3 h-3 text-neutral-400" />}
                  <button
                    type="button"
                    onClick={() => setCurrentPath(crumb.path)}
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer",
                      i === breadcrumbTrail.length - 1
                        ? "text-purple-600 dark:text-purple-400"
                        : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    )}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* CONTROLES E BUSCA */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Filtrar nós orbitais..."
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all placeholder:text-neutral-400"
            />
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-neutral-900 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setZoom(prev => Math.min(prev + 0.15, 2))}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(prev => Math.max(prev - 0.15, 0.4))}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleCenter}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
              title="Centralizar Visualização"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
              title="Resetar Posição"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* CANVAS RADIAL INTERATIVO */}
      <div className="relative w-full h-[700px] overflow-hidden bg-slate-50/50 dark:bg-neutral-950">
        {/* Background Decorativo Radial */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.06),transparent_70%)] pointer-events-none" />

        {/* Botão Voltar Flutuante */}
        {currentPath.length > 0 && (
          <button
            type="button"
            onClick={handleGoBack}
            className="absolute top-6 left-6 z-30 flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 shadow-xl text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:text-purple-600 dark:hover:text-purple-400 hover:scale-105 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Nível Anterior</span>
          </button>
        )}

        {/* Canvas Pannable com Framer Motion */}
        <motion.div
          className="relative w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
          drag
          dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }}
          dragElastic={0.15}
          dragMomentum={true}
          animate={controls}
        >
          {/* Linhas Conectoras Radiais */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
            <AnimatePresence>
              {filteredChildren.map((child, idx) => {
                const total = filteredChildren.length
                const angle = (idx / total) * 360 - 90
                const radius = 260

                return (
                  <motion.div
                    key={'conn-' + child.id}
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: radius }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.5, delay: idx * 0.03 }}
                    style={{
                      position: 'absolute',
                      height: '2px',
                      transformOrigin: '0% 50%',
                      transform: 'rotate(' + angle + 'deg)',
                      left: '50%',
                      top: '50%',
                      zIndex: 5,
                    }}
                  >
                    <svg width="100%" height="20" style={{ overflow: 'visible', position: 'absolute', top: -10 }}>
                      <line
                        x1="0"
                        y1="10"
                        x2={radius}
                        y2="10"
                        className="stroke-purple-400/40 dark:stroke-purple-500/40"
                        strokeWidth="2"
                        strokeDasharray="4 6"
                      />
                    </svg>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>

          {/* Nós da Árvore */}
          <div className="relative z-20 flex items-center justify-center w-full h-full">
            {/* NÓ CENTRAL (CORE) */}
            <motion.div
              key={'center-' + currentNode.id}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 140, damping: 20 }}
              className="z-30 relative w-60 h-60 rounded-full bg-white/95 dark:bg-neutral-900/90 border-2 border-purple-500/30 dark:border-purple-500/40 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center shadow-2xl shadow-purple-500/10"
            >
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-[9px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-2">
                <Layers className="w-3 h-3" />
                <span>{currentNode.level === -1 ? 'Visão Geral' : ('Nível ' + (currentNode.level + 1))}</span>
              </div>

              <h3 className="text-base font-black text-neutral-900 dark:text-white leading-snug line-clamp-2 max-w-full">
                {currentNode.name}
              </h3>

              {currentNode.desc && (
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                  {currentNode.desc}
                </p>
              )}

              <div className="mt-3 px-3 py-1 bg-purple-500/10 rounded-full border border-purple-500/20">
                <span className="text-[10px] font-black text-purple-600 dark:text-purple-300 uppercase tracking-widest">
                  {currentNode.count || currentNode.children?.length || 0} {(currentNode.count || currentNode.children?.length || 0) === 1 ? 'item' : 'itens'}
                </span>
              </div>

              {currentNode.rawData && (onView || onEdit || onDelete) && (
                <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  {onView && (
                    <button
                      type="button"
                      onClick={() => onView(currentNode.rawData, currentNode.level)}
                      className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-purple-600 transition-colors cursor-pointer"
                      title="Visualizar Detalhes"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(currentNode.rawData, currentNode.level)}
                      className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-blue-600 transition-colors cursor-pointer"
                      title="Editar Registro"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(currentNode.rawData, currentNode.level)}
                      className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-red-600 transition-colors cursor-pointer"
                      title="Excluir Registro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </motion.div>

            {/* NÓS ORBITAIS */}
            <AnimatePresence>
              {filteredChildren.map((child, idx) => {
                const total = filteredChildren.length
                const angle = (idx / total) * 360 - 90
                const rad = (angle * Math.PI) / 180
                const radius = 260
                const x = Math.cos(rad) * radius
                const y = Math.sin(rad) * radius

                const hasKids = child.children === undefined || (child.children && child.children.length > 0)
                const isLoadingThis = loadingNodeId === child.id
                const isHovered = hoveredNodeId === child.id

                return (
                  <motion.div
                    key={'node-' + child.id}
                    initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                    animate={{ scale: 1, opacity: 1, x, y }}
                    exit={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                    whileHover={{ scale: 1.05, zIndex: 100 }}
                    transition={{
                      type: 'spring',
                      stiffness: 120,
                      damping: 18,
                      delay: idx * 0.04,
                    }}
                    style={{
                      position: 'absolute',
                      zIndex: isHovered ? 100 : 20,
                    }}
                    onMouseEnter={() => setHoveredNodeId(child.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onClick={async () => {
                      if (child.children === undefined && onFetchChildren) {
                        setLoadingNodeId(child.id)
                        try {
                          const subItems = await onFetchChildren(child.level + 1, child)
                          const newKids = subItems || []
                          child.children = newKids
                          child.count = newKids.length
                          setRelationalTree(prev => updateNodeChildren(prev, child.id, newKids))
                          if (newKids.length > 0) {
                            const originalIndex = (currentNode.children || []).findIndex(c => c.id === child.id)
                            if (originalIndex !== -1) handleDrillDown(originalIndex)
                          }
                        } catch (err) {
                          console.error('Erro ao buscar subníveis:', err)
                          child.children = []
                          setRelationalTree(prev => updateNodeChildren(prev, child.id, []))
                        } finally {
                          setLoadingNodeId(null)
                        }
                        return
                      }

                      if (child.children && child.children.length > 0) {
                        const originalIndex = (currentNode.children || []).findIndex(c => c.id === child.id)
                        if (originalIndex !== -1) handleDrillDown(originalIndex)
                      }
                    }}
                    className={cn(
                      "group/node absolute w-48 p-4 rounded-[1.75rem] border transition-all cursor-pointer select-none backdrop-blur-xl shadow-lg",
                      isHovered && "z-50 shadow-2xl ring-2 ring-purple-500/40",
                      hasKids
                        ? "bg-white/95 dark:bg-neutral-900/90 border-purple-200 dark:border-purple-800/80 hover:border-purple-500"
                        : "bg-white/90 dark:bg-neutral-900/80 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                    )}
                  >
                    <div className="flex flex-col gap-1 relative">
                      {child.level !== undefined && (
                        <span className="text-[8px] font-black tracking-widest text-purple-600 dark:text-purple-400 uppercase">
                          Nível {child.level + 1}
                        </span>
                      )}
                      <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate" title={child.name}>
                        {child.name}
                      </h4>
                      {child.desc && (
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                          {child.desc}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-[1.5px] bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500/40 w-2/3" />
                        </div>
                        <span className="text-[9px] font-black text-neutral-400 dark:text-neutral-500">
                          {child.children === undefined ? '?' : child.count ?? child.children?.length ?? 0}
                        </span>
                      </div>
                    </div>

                    {/* Hover Actions (Floating pill in top-right, aligned with Web Production) */}
                    {child.rawData && (
                      <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover/node:opacity-100 transition-opacity bg-white/95 dark:bg-neutral-800/95 backdrop-blur-md p-1 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-md z-50">
                        {onView && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onView(child.rawData, child.level)
                            }}
                            className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-purple-600 transition-colors cursor-pointer"
                            title="Visualizar"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onEdit(child.rawData, child.level)
                            }}
                            className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-blue-600 transition-colors cursor-pointer"
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
                              onDelete(child.rawData, child.level)
                            }}
                            className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-red-600 transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {hasKids && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        {isLoadingThis ? (
                          <Loader2 className="w-3.5 h-3.5 text-purple-500 animate-spin" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-purple-500/50 group-hover/node:translate-x-0.5 transition-transform" />
                        )}
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Barra de Status Inferior idêntica à Web Produção */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-2.5 bg-white/70 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 rounded-full backdrop-blur-xl flex items-center gap-4 shadow-xl z-30 transition-colors pointer-events-none select-none">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-black text-neutral-600 dark:text-neutral-300 uppercase tracking-[0.25em] opacity-80">Nexo Engine Active</span>
          </div>
          <div className="w-px h-3 bg-neutral-200 dark:bg-neutral-700" />
          <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">{currentNode.children?.length || 0} Orbitals</span>
        </div>
      </div>
    </div>
  )
}

export default MindMapBoard
`
}
