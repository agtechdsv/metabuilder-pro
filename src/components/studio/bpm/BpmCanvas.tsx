'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Connection,
  Edge,
  Node,
  ReactFlowInstance,
  MiniMap,
  Panel,
  useReactFlow,
  useOnSelectionChange
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

import { FlowSidebar } from './FlowSidebar';
import { TriggerNode, ActionNode, ConditionNode } from './nodes/CustomNodes';
import { Save, Play, Wand2, X, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ButtonEdge from './edges/ButtonEdge';

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
};

const edgeTypes = {
  buttonedge: ButtonEdge,
};

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'trigger',
    data: { label: 'Novo Registro', description: 'Quando criado' },
    position: { x: 250, y: 50 },
  },
];

let id = 0;
const getId = () => `dndnode_${id++}`;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
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

interface BpmCanvasProps {
  title?: string;
  defaultAutoAlign?: boolean;
}

function BpmCanvasContent({ title = 'Aprovação de Pedidos', defaultAutoAlign = false }: BpmCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const { fitView } = useReactFlow();
  const router = useRouter();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useOnSelectionChange({
    onChange: ({ nodes }) => {
      setSelectedNodeId(nodes.length === 1 ? nodes[0].id : null);
    },
  });

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const handleAutoAlign = useCallback(() => {
    const layouted = getLayoutedElements(nodes, edges);
    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);
    setTimeout(() => fitView({ padding: 0.2, duration: 800, maxZoom: 1.5 }), 50);
  }, [nodes, edges, setNodes, setEdges, fitView]);

  // Optionally auto-align on first load if setting is true
  useEffect(() => {
    if (defaultAutoAlign && nodes.length > 1) {
      handleAutoAlign();
    }
  }, [defaultAutoAlign]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ 
      ...params, 
      type: 'buttonedge',
      animated: true,
      style: { strokeWidth: 2, stroke: params.sourceHandle === 'false' ? '#ef4444' : (params.sourceHandle === 'true' ? '#10b981' : '#6366f1') }
    } as any, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowInstance || !reactFlowWrapper.current) return;

      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/reactflow-label');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: { 
          label: label, 
          description: type === 'condition' ? 'If / Else' : 'Executar',
          // Default condition properties
          conditionField: '',
          conditionOperator: '==',
          conditionValue: ''
        },
      };

      setNodes((nds) => {
        const newNodes = nds.concat(newNode);
        if (defaultAutoAlign) {
          // Atrasamos o auto align para garantir que o react flow atualizou
          setTimeout(handleAutoAlign, 10);
        }
        return newNodes;
      });
    },
    [reactFlowInstance, setNodes, defaultAutoAlign, handleAutoAlign]
  );

  const handleSave = () => {
    if (reactFlowInstance) {
      const flow = reactFlowInstance.toObject();
      console.log('Flow Saved:', flow);
      alert('Fluxo salvo com sucesso! Confira o console.');
    }
  };

  const updateNodeData = (id: string, newData: any) => {
    setNodes(nds => nds.map(node => {
      if (node.id === id) {
        return { ...node, data: { ...node.data, ...newData } };
      }
      return node;
    }));
  };

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-neutral-950">
      {/* Top Bar */}
      <div className="h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.back()}
            className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            title="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
            <Play className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-black dark:text-white uppercase tracking-wider">{title}</h1>
            <p className="text-[10px] text-neutral-500">BPM Workflow Builder</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/20"
          >
            <Save className="w-4 h-4" />
            Salvar Fluxo
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
        <FlowSidebar />
        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: 'buttonedge' }}
            deleteKeyCode={['Backspace', 'Delete']}
            fitView
            fitViewOptions={{ maxZoom: 1.5 }}
            className="bg-neutral-50 dark:bg-[#0a0a0a]"
            minZoom={0.1}
            maxZoom={4}
          >
            <Controls 
              className="bg-white dark:bg-neutral-900 border-none shadow-xl rounded-2xl overflow-hidden flex flex-col gap-1 p-1 m-4" 
              style={{ bottom: 40 }}
              showInteractive={false} 
              fitViewOptions={{ maxZoom: 1.5 }}
            />
            <MiniMap 
              className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl m-4 overflow-hidden" 
              style={{ bottom: 40 }}
              maskColor="rgba(0, 0, 0, 0.1)"
              nodeColor={(node) => {
                if (node.type === 'trigger') return '#10b981';
                if (node.type === 'condition') return '#f59e0b';
                return '#6366f1';
              }}
            />
            <Background gap={16} size={1} color="#818cf8" className="opacity-20" />
            <Panel position="top-right" className="m-4 z-50">
              <button
                onClick={handleAutoAlign}
                title="Reorganizar e Alinhar Tudo"
                className="px-4 py-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-2xl border border-indigo-200 dark:border-indigo-900/50 shadow-xl flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all hover:scale-105 active:scale-95"
              >
                <Wand2 className="w-5 h-5" />
                Auto Align
              </button>
            </Panel>
          </ReactFlow>
        </div>

        {/* Right Sidebar Properties */}
        <div className={`w-80 h-full bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 transition-all duration-300 absolute right-0 top-0 z-40 flex flex-col shadow-2xl ${selectedNode ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
            <h3 className="font-bold text-sm tracking-tight text-neutral-900 dark:text-white">Propriedades do Nó</h3>
            <button onClick={() => setSelectedNodeId(null)} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {selectedNode && (
              <>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Rótulo</label>
                  <input 
                    type="text" 
                    value={(selectedNode.data?.label as string) || ''} 
                    onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {selectedNode.type === 'condition' && (
                  <div className="space-y-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                    <h4 className="text-xs font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest flex items-center gap-2">
                      Lógica If / Else
                    </h4>
                    
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Campo</label>
                      <input 
                        type="text" 
                        placeholder="Ex: status_pedido"
                        value={(selectedNode.data?.conditionField as string) || ''} 
                        onChange={(e) => updateNodeData(selectedNode.id, { conditionField: e.target.value })}
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Operador</label>
                      <select 
                        value={(selectedNode.data?.conditionOperator as string) || '=='} 
                        onChange={(e) => updateNodeData(selectedNode.id, { conditionOperator: e.target.value })}
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="==">Igual a (==)</option>
                        <option value="!=">Diferente de (!=)</option>
                        <option value=">">Maior que (&gt;)</option>
                        <option value="<">Menor que (&lt;)</option>
                        <option value="contains">Contém</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Valor</label>
                      <input 
                        type="text" 
                        placeholder="Ex: aprovado"
                        value={(selectedNode.data?.conditionValue as string) || ''} 
                        onChange={(e) => updateNodeData(selectedNode.id, { conditionValue: e.target.value })}
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                )}
                
                {selectedNode.type === 'action' && (
                  <div className="space-y-4">
                    <p className="text-xs text-neutral-400">Configurações específicas de ações (como e-mail, update DB) estarão disponíveis em breve.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BpmCanvas(props: BpmCanvasProps) {
  return (
    <ReactFlowProvider>
      <BpmCanvasContent {...props} />
    </ReactFlowProvider>
  );
}
