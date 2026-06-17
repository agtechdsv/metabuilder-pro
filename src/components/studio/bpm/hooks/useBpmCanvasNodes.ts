import { useState, useCallback, useEffect } from 'react'
import {
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowInstance,
  useReactFlow,
  useOnSelectionChange
} from '@xyflow/react'
import dagre from 'dagre'

export const getId = () => `dndnode_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 250;
  const nodeHeight = 80;

  dagreGraph.setGraph({ rankdir: direction, ranksep: 80, nodesep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return {
    nodes: nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - nodeWidth / 2,
          y: nodeWithPosition.y - nodeHeight / 2,
        },
      };
    }),
    edges,
  };
};

interface UseBpmCanvasNodesProps {
  initialNodes: Node[]
  defaultAutoAlign?: boolean
  toast: (msg: string, type: 'success' | 'error' | 'info') => void
  t: (key: string, fallback?: string) => string
  reactFlowWrapper: React.RefObject<HTMLDivElement | null>
}

export function useBpmCanvasNodes({
  initialNodes,
  defaultAutoAlign = false,
  toast,
  t,
  reactFlowWrapper
}: UseBpmCanvasNodesProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
  const { fitView, zoomTo } = useReactFlow()
  
  const [scale, setScale] = useState(1.0)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const handleZoom = (val: number) => {
    setScale(val)
    zoomTo(val, { duration: 300 })
  }

  useOnSelectionChange({
    onChange: ({ nodes }) => {
      setSelectedNodeId(nodes.length === 1 ? nodes[0].id : null)
    },
  })

  const selectedNode = nodes.find(n => n.id === selectedNodeId)

  const handleAutoAlign = useCallback(() => {
    const layouted = getLayoutedElements(nodes, edges)
    setNodes([...layouted.nodes])
    setEdges([...layouted.edges])
    setTimeout(() => fitView({ padding: 0.2, duration: 800, maxZoom: 1.5 }), 50)
  }, [nodes, edges, setNodes, setEdges, fitView])

  useEffect(() => {
    if (defaultAutoAlign && nodes.length > 1) {
      handleAutoAlign()
    }
  }, [defaultAutoAlign]) // Remove handleAutoAlign from deps to avoid loop

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ 
      ...params, 
      type: 'buttonedge',
      animated: true,
      style: { strokeWidth: 2, stroke: params.sourceHandle === 'false' ? '#ef4444' : (params.sourceHandle === 'true' ? '#10b981' : '#6366f1') }
    } as any, eds)),
    [setEdges]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      if (!reactFlowInstance || !reactFlowWrapper.current) return

      const type = event.dataTransfer.getData('application/reactflow')
      if (typeof type === 'undefined' || !type) {
        return
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: {},
      }
      
      toast(t('bpm.canvas.toasts.node_dropped', 'Nó {type} solto no canvas!').replace('{type}', type), 'success')

      setNodes((nds) => nds.concat(newNode))
    },
    [reactFlowInstance, setNodes, reactFlowWrapper, t, toast]
  )

  const updateNodeData = (id: string, newData: any) => {
    setNodes(nds => nds.map(node => {
      if (node.id === id) {
        return { ...node, data: { ...node.data, ...newData } }
      }
      return node
    }))
  }

  return {
    nodes,
    setNodes,
    onNodesChange,
    edges,
    setEdges,
    onEdgesChange,
    reactFlowInstance,
    setReactFlowInstance,
    fitView,
    scale,
    handleZoom,
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    handleAutoAlign,
    onConnect,
    onDragOver,
    onDrop,
    updateNodeData
  }
}
