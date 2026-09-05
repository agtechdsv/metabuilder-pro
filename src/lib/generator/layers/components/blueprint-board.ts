export function generateBlueprintBoardComponent(files: Map<string, string>) {
  files.set('components/BlueprintBoard.tsx', generateBlueprintBoardCode())
}

function generateBlueprintBoardCode(): string {
  return `'use client'

import React, { useMemo, useState, useEffect, useCallback, memo } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
  Edge,
  Node,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import {
  Eye,
  Pencil,
  Trash2,
  Search,
  Zap,
  Activity,
  ArrowRight,
  ArrowDown,
  Sparkles,
  Maximize2,
  Circle,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DynamicIcon } from '@/app/components/DynamicIcon'

export interface BlueprintConfig {
  title_field?: string
  titleField?: string
  predecessor_field?: string
  predecessorField?: string
  desc_field?: string
  descField?: string
  status_field?: string
  statusField?: string
  scale?: number
  direction?: 'TB' | 'LR' | 'BT' | 'RL'
  animated_edges?: boolean
  animatedEdges?: boolean
}

export interface BlueprintBoardProps {
  data: any[]
  fields?: any[]
  blueprintConfig?: BlueprintConfig
  relationalOptions?: Record<string, Array<{ value: string; label: string }>>
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => Promise<void> | void
  customActions?: any[]
  onCustomAction?: (action: any, row: any) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Node Component
// ─────────────────────────────────────────────────────────────────────────────

const BlueprintNode = memo(({ data, selected }: NodeProps) => {
  const {
    title,
    desc,
    status,
    onView,
    onEdit,
    onDelete,
    customActions = [],
    onCustomAction,
    raw,
    direction = 'TB',
  } = data as any

  const isHoriz = direction === 'LR' || direction === 'RL'
  const targetPos = isHoriz ? Position.Left : Position.Top
  const sourcePos = isHoriz ? Position.Right : Position.Bottom

  // Status badge styling
  let statusBg = 'bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700'
  let StatusIcon = Circle

  const st = String(status || '').toLowerCase()
  if (st.includes('concl') || st.includes('done') || st.includes('final') || st.includes('sucess')) {
    statusBg = 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
    StatusIcon = CheckCircle2
  } else if (st.includes('andamento') || st.includes('prog') || st.includes('exec') || st.includes('wait')) {
    statusBg = 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
    StatusIcon = Clock
  } else if (st.includes('canc') || st.includes('bloq') || st.includes('erro') || st.includes('fail')) {
    statusBg = 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800'
    StatusIcon = AlertCircle
  } else if (status) {
    statusBg = 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800'
    StatusIcon = Circle
  }

  return (
    <div
      className={cn(
        "relative group w-72 bg-white dark:bg-neutral-900 border rounded-2xl shadow-sm transition-all overflow-hidden",
        selected
          ? "border-indigo-600 ring-2 ring-indigo-500/20 shadow-md"
          : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-md"
      )}
    >
      <Handle
        type="target"
        position={targetPos}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-neutral-900 !rounded-full transition-transform hover:!scale-125"
      />

      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate" title={title}>
              {title}
            </h4>
          </div>

          {status && (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold shrink-0 uppercase tracking-wider",
                statusBg
              )}
            >
              <StatusIcon className="w-2.5 h-2.5" />
              <span>{status}</span>
            </span>
          )}
        </div>

        {desc && (
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
            {desc}
          </p>
        )}

        <div className="flex items-center justify-end gap-1 pt-2 border-t border-neutral-100 dark:border-neutral-800/60">
          {onView && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onView(raw)
              }}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-indigo-600 transition-colors cursor-pointer"
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
                onEdit(raw)
              }}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-blue-600 transition-colors cursor-pointer"
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
                onDelete(raw)
              }}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-red-600 transition-colors cursor-pointer"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {customActions.map((action: any) => (
            <button
              key={action.id}
              type="button"
              title={action.label}
              onClick={(e) => {
                e.stopPropagation()
                onCustomAction?.(action, raw)
              }}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              {action.icon ? <DynamicIcon icon={action.icon} size={14} /> : <Zap className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>

      <Handle
        type="source"
        position={sourcePos}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-neutral-900 !rounded-full transition-transform hover:!scale-125"
      />
    </div>
  )
})
BlueprintNode.displayName = 'BlueprintNode'

const nodeTypes = {
  blueprintNode: BlueprintNode,
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner Canvas with ReactFlow Provider
// ─────────────────────────────────────────────────────────────────────────────

function BlueprintFlowContent({
  data,
  blueprintConfig = {},
  relationalOptions = {},
  onView,
  onEdit,
  onDelete,
  customActions,
  onCustomAction,
  searchTerm,
  selectedId,
  setSelectedId,
}: BlueprintBoardProps & {
  searchTerm: string
  selectedId: string | null
  setSelectedId: (id: string | null) => void
}) {
  const { fitView, setCenter } = useReactFlow()

  const titleCol = blueprintConfig.titleField || blueprintConfig.title_field || 'nome'
  const predCol = blueprintConfig.predecessorField || blueprintConfig.predecessor_field || 'predecessor_id'
  const descCol = blueprintConfig.descField || blueprintConfig.desc_field
  const statusCol = blueprintConfig.statusField || blueprintConfig.status_field

  const initialDir = blueprintConfig.direction || 'TB'
  const [direction, setDirection] = useState<'TB' | 'LR' | 'BT' | 'RL'>(initialDir)
  const [animatedEdges, setAnimatedEdges] = useState(
    blueprintConfig.animatedEdges !== false && blueprintConfig.animated_edges !== false
  )

  const nodeWidth = 288
  const nodeHeight = 110

  // Calcula o layout hierárquico com Dagre
  const getLayoutedElements = useCallback(
    (nodes: Node[], edges: Edge[], dir: string) => {
      const g = new dagre.graphlib.Graph()
      g.setDefaultEdgeLabel(() => ({}))
      g.setGraph({
        rankdir: dir,
        ranksep: 90,
        nodesep: 50,
      })

      nodes.forEach(n => {
        g.setNode(n.id, { width: nodeWidth, height: nodeHeight })
      })

      edges.forEach(e => {
        g.setEdge(e.source, e.target)
      })

      dagre.layout(g)

      const layoutedNodes = nodes.map(n => {
        const nodeWithPosition = g.node(n.id)
        return {
          ...n,
          position: {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
          },
          data: {
            ...n.data,
            direction: dir,
          },
        }
      })

      return { nodes: layoutedNodes, edges }
    },
    [nodeWidth, nodeHeight]
  )

  // Mapeia data para Nodes e Edges
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!data || data.length === 0) return { initialNodes: [], initialEdges: [] }

    const rawNodes: Node[] = []
    const rawEdges: Edge[] = []

    data.forEach((row, index) => {
      const id = String(row.id ?? index)
      const rawTitle = row[titleCol] ?? row[titleCol.replace(/_/g, '.')] ?? row.nome ?? row.titulo ?? ('Nó #' + id)
      let title = String(rawTitle || '')
      if (relationalOptions[titleCol]) {
        const opt = relationalOptions[titleCol].find((o: any) => o.value === String(rawTitle))
        if (opt) title = opt.label
      }

      let desc = ''
      if (descCol) {
        const rawDesc = row[descCol] ?? row[descCol.replace(/_/g, '.')]
        desc = String(rawDesc || '')
        if (relationalOptions[descCol]) {
          const opt = relationalOptions[descCol].find((o: any) => o.value === String(rawDesc))
          if (opt) desc = opt.label
        }
      }

      let status = ''
      if (statusCol) {
        const rawStatus = row[statusCol] ?? row[statusCol.replace(/_/g, '.')]
        status = String(rawStatus || '')
        if (relationalOptions[statusCol]) {
          const opt = relationalOptions[statusCol].find((o: any) => o.value === String(rawStatus))
          if (opt) status = opt.label
        }
      }

      rawNodes.push({
        id,
        type: 'blueprintNode',
        position: { x: 0, y: 0 },
        data: {
          title,
          desc,
          status,
          raw: row,
          onView,
          onEdit,
          onDelete,
          customActions,
          onCustomAction,
          direction,
        },
      })

      // Extrai predecessor
      const rawPred = row[predCol] ?? row[predCol.replace(/_/g, '.')]
      if (rawPred !== undefined && rawPred !== null && rawPred !== '') {
        const predecessors = String(rawPred)
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)

        predecessors.forEach((pId, pIdx) => {
          if (pId !== id) {
            rawEdges.push({
              id: 'edge-' + pId + '-' + id + '-' + pIdx,
              source: pId,
              target: id,
              animated: animatedEdges,
              style: { stroke: '#6366f1', strokeWidth: 2 },
            })
          }
        })
      }
    })

    const layouted = getLayoutedElements(rawNodes, rawEdges, direction)
    return { initialNodes: layouted.nodes, initialEdges: layouted.edges }
  }, [
    data,
    titleCol,
    predCol,
    descCol,
    statusCol,
    relationalOptions,
    direction,
    animatedEdges,
    getLayoutedElements,
    onView,
    onEdit,
    onDelete,
    customActions,
    onCustomAction,
  ])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 400 })
    }, 50)
  }, [initialNodes, initialEdges, fitView, setNodes, setEdges])

  const handleToggleDirection = () => {
    const nextDir = direction === 'TB' ? 'LR' : 'TB'
    setDirection(nextDir)
  }

  const handleRelayout = () => {
    const layouted = getLayoutedElements(nodes, edges, direction)
    setNodes(layouted.nodes)
    fitView({ padding: 0.2, duration: 600 })
  }

  // Centraliza o nó selecionado na lista lateral
  useEffect(() => {
    if (selectedId) {
      const node = nodes.find(n => n.id === selectedId)
      if (node) {
        setCenter(node.position.x + nodeWidth / 2, node.position.y + nodeHeight / 2, {
          zoom: 1.2,
          duration: 800,
        })
      }
    }
  }, [selectedId, nodes, setCenter, nodeWidth, nodeHeight])

  return (
    <div className="flex-1 relative w-full h-full">
      {/* TOOLBAR FLUTUANTE DE CONTROLE DO FLUXOGRAMA */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-lg">
        <button
          type="button"
          onClick={handleToggleDirection}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
          title="Alternar Orientação (Vertical / Horizontal)"
        >
          {direction === 'TB' ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          <span>{direction === 'TB' ? 'Vertical' : 'Horizontal'}</span>
        </button>

        <button
          type="button"
          onClick={() => setAnimatedEdges(prev => !prev)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer",
            animatedEdges
              ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
          )}
          title="Alternar Arestas Animadas"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Linhas Animadas</span>
        </button>

        <button
          type="button"
          onClick={handleRelayout}
          className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
          title="Reorganizar Layout Automático"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        onNodeClick={(_, node) => setSelectedId(node.id)}
      >
        <Background gap={16} size={1} />
        <Controls position="bottom-right" className="!bg-white dark:!bg-neutral-900 !border !border-neutral-200 dark:!border-neutral-800 !rounded-xl !shadow-md" />
      </ReactFlow>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main BlueprintBoard Component Export
// ─────────────────────────────────────────────────────────────────────────────

export function BlueprintBoard(props: BlueprintBoardProps) {
  const { data = [], blueprintConfig = {} } = props
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const titleCol = blueprintConfig.titleField || blueprintConfig.title_field || 'nome'
  const descCol = blueprintConfig.descField || blueprintConfig.desc_field

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return data
    const q = searchTerm.toLowerCase().trim()
    return data.filter(r => {
      const title = String(r[titleCol] ?? r.nome ?? r.titulo ?? '').toLowerCase()
      const desc = descCol ? String(r[descCol] ?? '').toLowerCase() : ''
      return title.includes(q) || desc.includes(q)
    })
  }, [data, searchTerm, titleCol, descCol])

  return (
    <div className="w-full flex flex-col bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
      {/* TOOLBAR PRINCIPAL */}
      <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-50/50 dark:bg-neutral-900/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
            <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-neutral-900 dark:text-white">Fluxograma &amp; Processos</h3>
            <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-widest">
              {data.length} {data.length === 1 ? 'etapa mapeada' : 'etapas mapeadas'}
            </p>
          </div>
        </div>

        {/* Busca Rápida */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar etapa no fluxograma..."
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-neutral-400"
          />
        </div>
      </div>

      <div className="flex relative w-full h-[650px] overflow-hidden">
        {/* SIDEBAR - LISTA DE ETAPAS */}
        <div className="w-72 flex-shrink-0 border-r border-neutral-200 dark:border-neutral-800 z-10 bg-white dark:bg-[#0a0a0a] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/30 dark:bg-neutral-900/10">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Etapas ({filteredItems.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/50">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">
                Nenhuma etapa encontrada.
              </div>
            ) : (
              filteredItems.map(row => {
                const id = String(row.id)
                const isSelected = selectedId === id
                const title = row[titleCol] ?? row.nome ?? row.titulo ?? ('Etapa #' + id)
                const desc = descCol ? row[descCol] : null

                return (
                  <div
                    key={id}
                    onClick={() => setSelectedId(id)}
                    className={cn(
                      "p-3.5 transition-all cursor-pointer group hover:bg-neutral-50 dark:hover:bg-neutral-900/40",
                      isSelected && "bg-indigo-50/50 dark:bg-indigo-950/20 border-l-4 border-indigo-600"
                    )}
                  >
                    <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 line-clamp-1">
                      {title}
                    </h4>
                    {desc && (
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">
                        {desc}
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* CANVAS REACT FLOW COM PROVIDER */}
        <ReactFlowProvider>
          <BlueprintFlowContent
            {...props}
            searchTerm={searchTerm}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
          />
        </ReactFlowProvider>
      </div>
    </div>
  )
}

export default BlueprintBoard
`
}
