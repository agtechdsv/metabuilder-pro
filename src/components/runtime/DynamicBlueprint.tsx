'use client'

import React, { useMemo, useCallback, memo, useState, useEffect } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Panel,
  Handle,
  Position,
  NodeProps,
  Edge,
  Connection,
  addEdge,
  Node,
  getSmoothStepPath,
  EdgeProps,
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { MoreVertical, CheckCircle2, Circle, AlertCircle, PlayCircle, Eye, Pencil, Trash2, Settings2, Wand2, RefreshCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'

interface DynamicBlueprintProps {
  data: any[]
  fields: any[]
  blueprintConfig: {
    title_field: string
    desc_field?: string
    status_field?: string
    predecessor_field: string
  }
  onView: (row: any) => void
  onEdit: (row: any) => void
  onDelete: (row: any) => void
  dictionary?: any
  onMove?: (recordId: string, updates: any) => void
  onRefresh?: () => void
}
const BlueprintNode = memo(({ data, selected }: NodeProps) => {
  const { title, description, status, onView, onEdit, onDelete, rawData, scale = 1, direction = 'TB' } = data as any

  let statusColor = 'bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700'
  let StatusIcon = Circle

  if (status) {
    const s = String(status).toLowerCase()
    if (s.includes('concluído') || s.includes('done') || s.includes('aprovado') || s.includes('finalizado')) {
      statusColor = 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50'
      StatusIcon = CheckCircle2
    } else if (s.includes('andamento') || s.includes('progress') || s.includes('execução') || s.includes('execucao')) {
      statusColor = 'bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800/50'
      StatusIcon = PlayCircle
    } else if (s.includes('atrasado') || s.includes('erro') || s.includes('reprovado') || s.includes('cancelado')) {
      statusColor = 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50'
      StatusIcon = AlertCircle
    }
  }

  const isHorizontal = direction === 'LR'
  const isAnimated = (data as any).animated
  const depth = Number((data as any).depth || 0)
  const animationDelay = depth * 0.5 // 0.5s por nível

  return (
    <div 
      className={cn(
        "bg-white dark:bg-neutral-900 border-2 rounded-xl shadow-sm flex flex-col justify-center items-center transition-all group relative",
        selected ? "border-indigo-500 shadow-md ring-2 ring-indigo-500/20" : "border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-indigo-400"
      )}
      style={{
        width: 280 * scale,
        minHeight: 80 * scale,
        padding: `${16 * scale}px`,
        animation: isAnimated ? `blueprintFadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards ${animationDelay}s` : 'none',
        opacity: isAnimated ? 0 : 1
      }}
    >
      <Handle type="target" position={isHorizontal ? Position.Left : Position.Top} className="w-3 h-3 bg-indigo-500" />
      <Handle type="source" position={isHorizontal ? Position.Right : Position.Bottom} className="w-3 h-3 bg-indigo-500" />
      
      {status && (
        <div 
          className={cn("absolute flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-neutral-800 border rounded-full shadow-sm", statusColor)}
          style={{ 
            top: isHorizontal ? 'auto' : `-${12 * scale}px`,
            left: isHorizontal ? `-${12 * scale}px` : '50%',
            bottom: isHorizontal ? `-${12 * scale}px` : 'auto',
            transform: isHorizontal ? 'translateY(50%)' : 'translateX(-50%)',
            fontSize: `${10 * scale}px`
          }}
        >
          <StatusIcon style={{ width: `${12 * scale}px`, height: `${12 * scale}px` }} />
          <span className="font-bold tracking-wide uppercase">{status}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center items-center w-full mt-2">
        <h4 className="font-bold text-neutral-900 dark:text-white text-center leading-tight line-clamp-2" style={{ fontSize: `${14 * scale}px` }}>{title || 'Sem título'}</h4>
        {description && (
          <p className="text-neutral-500 dark:text-neutral-400 text-center line-clamp-2 mt-1" style={{ fontSize: `${12 * scale}px` }}>
            {description}
          </p>
        )}
      </div>

      {/* Ações */}
      <div 
        className="absolute top-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl flex flex-col overflow-hidden z-10"
        style={{ 
          right: `-${12 * scale}px`,
          transform: `translate(100%, -50%) scale(${Math.max(0.75, scale * 0.85)})`,
          transformOrigin: 'left center'
        }}
      >
        <button onClick={(e) => { e.stopPropagation(); onView?.(rawData); }} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-indigo-500" title="Visualizar"><Eye className="w-4 h-4" /></button>
        <div className="h-px bg-neutral-200 dark:bg-neutral-800" />
        <button onClick={(e) => { e.stopPropagation(); onEdit?.(rawData); }} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-indigo-500" title="Editar"><Pencil className="w-4 h-4" /></button>
        <div className="h-px bg-neutral-200 dark:bg-neutral-800" />
        <button onClick={(e) => { e.stopPropagation(); onDelete?.(rawData); }} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-neutral-400 hover:text-red-500" title="Excluir"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  )
})
BlueprintNode.displayName = 'BlueprintNode'

// ==========================================
// Custom Edge (Aresta com botão de Excluir)
// ==========================================
const DeletableEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const isAnimated = data?.animated
  const depth = data?.depth || 0
  // Edge aparece um pouco depois do nó de origem, mas antes do nó de destino
  const animationDelay = (depth - 1) * 0.5 + 0.3

  return (
    <g
      style={{
        animation: isAnimated ? `blueprintFadeIn 0.8s ease-out forwards ${animationDelay}s` : 'none',
        opacity: isAnimated ? 0 : 1
      }}
    >
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{ 
          ...style, 
          stroke: selected ? '#ef4444' : '#6366f1', 
          strokeWidth: selected ? 3 : 2,
          transition: 'stroke 0.2s, stroke-width 0.2s'
        }} 
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button
            className="w-5 h-5 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full text-xs shadow-md transition-all hover:scale-125 opacity-0 group-hover:opacity-100"
            style={{ opacity: selected ? 1 : undefined }}
            onClick={(event) => {
              event.stopPropagation()
              data?.onDeleteEdge?.()
            }}
            title="Remover conexão"
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </g>
  )
}

const nodeTypes = {
  blueprintNode: BlueprintNode
}

const edgeTypes = {
  deletable: DeletableEdge
}

function DynamicBlueprintContent({
  data,
  fields,
  blueprintConfig,
  onView,
  onEdit,
  onDelete,
  onMove,
  onRefresh,
  dictionary
}: DynamicBlueprintProps) {
  const { toast } = useToast()
  const { fitView } = useReactFlow()
  const { 
    title_field, 
    desc_field, 
    status_field, 
    predecessor_field
  } = blueprintConfig || {}

  const [scale, setScale] = useState(blueprintConfig?.scale ?? 1)
  const [direction, setDirection] = useState(blueprintConfig?.direction || 'TB')
  const [animatedEdges, setAnimatedEdges] = useState(blueprintConfig?.animated_edges !== false)

  useEffect(() => {
    setScale(blueprintConfig?.scale ?? 1)
    setDirection(blueprintConfig?.direction || 'TB')
    setAnimatedEdges(blueprintConfig?.animated_edges !== false)
  }, [blueprintConfig])

  const currentWidth = 280 * scale
  const currentHeight = 80 * scale

  const getCol = useCallback((fieldId?: string) => {
    if (!fieldId) return null
    const f = fields.find(f => f.id === fieldId)
    return f ? (f.db_column_name.split('.').pop() || f.db_column_name) : null
  }, [fields])

  const pkCol = useMemo(() => {
    const pk = fields.find(f => f.is_primary_key)
    return pk ? (pk.db_column_name.split('.').pop() || pk.db_column_name) : 'id'
  }, [fields])

  const titleCol = getCol(title_field)
  const descCol = getCol(desc_field)
  const statusCol = getCol(status_field)
  const predCol = getCol(predecessor_field)

  const getLayoutedElements = (nodes: Node[], edges: Edge[], dir = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))
    dagreGraph.setGraph({ rankdir: dir, ranksep: 100 * scale, nodesep: 60 * scale })

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: currentWidth, height: currentHeight })
    })

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target)
    })

    dagre.layout(dagreGraph)

    const isHoriz = dir === 'LR'

    const newNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id)
      return {
        ...node,
        targetPosition: isHoriz ? Position.Left : Position.Top,
        sourcePosition: isHoriz ? Position.Right : Position.Bottom,
        position: {
          x: nodeWithPosition.x - currentWidth / 2,
          y: nodeWithPosition.y - currentHeight / 2
        }
      }
    })

    return { nodes: newNodes, edges }
  }

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!data || data.length === 0 || !titleCol || !predCol) {
      return { initialNodes: [], initialEdges: [] }
    }

    const nodes: Node[] = []
    const edges: Edge[] = []

    // Calcula profundidade de cada nó para animação em cascata
    const depths: Record<string, number> = {}
    const getDepth = (id: string, visited = new Set<string>()): number => {
      if (depths[id] !== undefined) return depths[id]
      if (visited.has(id)) return 0 // fallback de ciclo
      visited.add(id)
      
      const row = data.find((r: any) => String(r[pkCol] || r.id) === id)
      if (!row) {
        depths[id] = 0
        return 0
      }

      const parentId = String(row[predCol])
      if (!parentId || parentId === 'undefined' || parentId === 'null' || parentId === id) {
        depths[id] = 0
      } else {
        depths[id] = getDepth(parentId, visited) + 1
      }
      return depths[id]
    }

    data.forEach(row => {
      const id = String(row[pkCol] || row['id'] || row['ID'])
      const predecessorId = row[predCol]
      const depth = getDepth(id)

      nodes.push({
        id,
        type: 'blueprintNode',
        data: {
          title: row[titleCol],
          description: descCol ? row[descCol] : '',
          status: statusCol ? row[statusCol] : '',
          rawData: row,
          onView,
          onEdit,
          onDelete,
          scale,
          direction,
          animated: animatedEdges,
          depth
        },
        position: { x: 0, y: 0 }
      })

      if (predecessorId) {
        const preds = String(predecessorId).split(',').map(s => s.trim()).filter(Boolean)
        preds.forEach(pid => {
          edges.push({
            id: `e${pid}-${id}`,
            source: pid,
            target: id,
            type: 'deletable',
            animated: animatedEdges,
            data: {
              depth,
              animated: animatedEdges,
              onDeleteEdge: () => {
                if (predCol) {
                  onMove?.(id, { [predCol]: null })
                }
              }
            }
          })
        })
      }
    })

    const layouted = getLayoutedElements(nodes, edges, direction)
    return { initialNodes: layouted.nodes, initialEdges: layouted.edges }
  }, [data, titleCol, descCol, statusCol, predCol, pkCol, onView, onEdit, onDelete, scale, direction, animatedEdges])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  React.useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) {
      // Proteção Anti-Ciclo: Impede que o Target já seja um ancestral do Source
      const checkForCycle = (startNodeId: string, targetNodeId: string, visited = new Set<string>()): boolean => {
        if (startNodeId === targetNodeId) return true
        if (visited.has(startNodeId)) return false
        visited.add(startNodeId)

        const outEdges = edges.filter(e => e.source === startNodeId)
        for (const e of outEdges) {
          if (checkForCycle(e.target, targetNodeId, visited)) return true
        }
        return false
      }

      if (checkForCycle(connection.target, connection.source)) {
        toast('Operação recusada: Isso criaria uma dependência circular.', 'error')
        return
      }

      setEdges((eds) => addEdge({ 
        ...connection, 
        type: 'deletable', 
        animated: animatedEdges,
        data: {
          onDeleteEdge: () => {
            if (predCol) {
              onMove?.(connection.target, { [predCol]: null })
            }
          }
        }
      }, eds))
      
      const targetNode = nodes.find(n => n.id === connection.target)
      const targetData = targetNode?.data?.rawData

      if (targetData && predCol) {
        onMove?.(connection.target, { [predCol]: connection.source })
      } else {
        toast('Conexão ignorada: Dados do alvo ausentes.', 'error')
      }
    }
  }, [setEdges, nodes, edges, predCol, onMove, toast])

  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    deletedEdges.forEach(edge => {
      if (predCol) {
        // Envia null para limpar a chave estrangeira (remover a relação pai-filho)
        onMove?.(edge.target, { [predCol]: null })
      }
    })
  }, [predCol, onMove])

  const handleAutoAlign = useCallback(() => {
    const layouted = getLayoutedElements(nodes, edges, direction)
    setNodes([...layouted.nodes])
    setEdges([...layouted.edges])
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 800 })
    }, 50)
  }, [nodes, edges, setNodes, setEdges, fitView, direction])

  if (!titleCol || !predCol) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 p-8 text-center">
        <Activity className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mb-4" />
        <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Configure o Fluxograma</h3>
        <p className="text-sm text-neutral-500 max-w-md">
          Para visualizar os dados neste formato, vá até o Studio e mapeie os campos obrigatórios (Título e Predecessora) na aba Layout.
        </p>
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
              onChange={e => setDirection(e.target.value)}
              className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none"
            >
              <option value="TB">Vertical</option>
              <option value="LR">Horizontal</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-neutral-500 uppercase">Animação:</label>
            <select 
              value={animatedEdges ? 'true' : 'false'} 
              onChange={e => setAnimatedEdges(e.target.value === 'true')}
              className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none"
            >
              <option value="true">Ligada</option>
              <option value="false">Desligada</option>
            </select>
          </div>

          <div className="flex items-center gap-3 ml-2 sm:ml-4 border-l border-neutral-200 dark:border-neutral-800 pl-4 sm:pl-6">
            <span className="text-[10px] font-bold text-neutral-500 uppercase">Escala:</span>
            <input 
              type="range" min="0.6" max="1.4" step="0.1" 
              value={scale} 
              onChange={e => setScale(Number(e.target.value))}
              className="w-20 sm:w-24 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
            />
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">{scale.toFixed(1)}x</span>
          </div>

          {onRefresh && (
            <div className="flex items-center ml-2 sm:ml-4 border-l border-neutral-200 dark:border-neutral-800 pl-4 sm:pl-6">
              <button 
                onClick={onRefresh}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400 transition-colors"
                title="Atualizar Dados"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="w-full h-[750px] rounded-[2rem] border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#0a0a0a] overflow-hidden shadow-sm relative">
      <style>{`
        @keyframes blueprintFadeInUp {
          0% { opacity: 0; transform: translateY(-20px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes blueprintFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={1.5}
        attributionPosition="bottom-right"
        className="dark:bg-[#0a0a0a]"
      >
        <Background gap={24} size={2} color="#818cf8" className="opacity-20" />
        <Controls 
          className="bg-white dark:bg-neutral-900 border-none shadow-xl shadow-black/5 rounded-2xl overflow-hidden flex flex-col gap-1 p-1"
          showInteractive={false}
        />
        <Panel position="top-left" className="m-6">
          <div className="px-4 py-2 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              {nodes.length} Nós • {edges.length} Conexões
            </span>
          </div>
        </Panel>
        <Panel position="top-right" className="m-6">
          <button
            onClick={handleAutoAlign}
            title="Reorganizar e Alinhar Tudo"
            className="px-4 py-2 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md rounded-2xl border border-indigo-200 dark:border-indigo-900/50 shadow-sm flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
          >
            <Wand2 className="w-4 h-4" />
            Auto Align
          </button>
        </Panel>
      </ReactFlow>
    </div>
    </div>
  )
}

export default function DynamicBlueprint(props: DynamicBlueprintProps) {
  return (
    <ReactFlowProvider>
      <DynamicBlueprintContent {...props} />
    </ReactFlowProvider>
  )
}
