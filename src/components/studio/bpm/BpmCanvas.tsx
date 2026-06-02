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
import { Save, Play, Wand2, X, ArrowLeft, Loader2, Plus, Trash2, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import ButtonEdge from './edges/ButtonEdge';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/components/ui/Toast';

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

const getId = () => `dndnode_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

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
  projectId?: string;
  useCaseId?: string;
  initialWorkflows?: any[];
  initialModels?: any[];
}

function BpmCanvasContent({ 
  title = 'Aprovação de Pedidos', 
  defaultAutoAlign = false, 
  projectId, 
  useCaseId,
  initialWorkflows = [],
  initialModels = []
}: BpmCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const supabase = createClient();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const { fitView } = useReactFlow();
  const router = useRouter();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Workflow DB State
  const [workflows, setWorkflows] = useState<any[]>(initialWorkflows);
  const [dbModels, setDbModels] = useState<any[]>(initialModels);
  const [dbFields, setDbFields] = useState<any[]>(() => initialModels.flatMap(m => m.fields || []));
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string>('new');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [enums, setEnums] = useState<any[]>([]);
  const [cursorPos, setCursorPos] = useState<{ field: 'actionSubject' | 'actionBody', start: number, end: number } | null>(null);

  // Buscar enumerations
  useEffect(() => {
    if (!projectId) return;
    const fetchEnums = async () => {
      const { data } = await supabase
        .from('project_enumerations')
        .select('*')
        .eq('project_id', projectId);
      if (data) setEnums(data);
    };
    fetchEnums();
  }, [projectId]);

  // Handle changing workflow in dropdown
  useEffect(() => {
    if (currentWorkflowId === 'new') {
      setNodes(initialNodes);
      setEdges([]);
      setTimeout(() => fitView({ padding: 0.2, duration: 800, maxZoom: 1.5 }), 50);
      return;
    }

    const flow = workflows.find(w => w.id === currentWorkflowId);
    if (flow && flow.flow_data) {
      const { nodes: savedNodes = [], edges: savedEdges = [] } = flow.flow_data;
      setNodes(savedNodes.length > 0 ? savedNodes : initialNodes);
      setEdges(savedEdges);
      setTimeout(() => fitView({ padding: 0.2, duration: 800, maxZoom: 1.5 }), 50);
    }
  }, [currentWorkflowId, workflows]);

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

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: {}, // Inicialmente vazio, o drawer preencherá tudo
      };
      
      toast(`Nó ${type} solto no canvas!`, 'success');

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, defaultAutoAlign, handleAutoAlign]
  );

  const handleSave = async () => {
    if (!reactFlowInstance || !projectId || !useCaseId) return;

    setIsSaving(true);
    const flow = reactFlowInstance.toObject();
    
    try {
      if (currentWorkflowId === 'new') {
        const name = prompt('Qual o nome deste novo fluxo?', 'Novo Fluxo');
        if (!name) {
          setIsSaving(false);
          return;
        }

        const { data, error } = await supabase
          .from('bpm_workflows')
          .insert({
            project_id: projectId,
            name: name,
            use_case_id: useCaseId,
            flow_data: flow,
            is_active: true
          })
          .select()
          .single();

        if (error) throw error;
        
        toast('Fluxo criado com sucesso!', 'success');
        setWorkflows(prev => [data, ...prev]);
        setCurrentWorkflowId(data.id);
      } else {
        const { error } = await supabase
          .from('bpm_workflows')
          .update({
            flow_data: flow,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentWorkflowId);

        if (error) throw error;
        toast('Fluxo atualizado com sucesso!', 'success');
        
        // Update local state
        setWorkflows(prev => prev.map(w => w.id === currentWorkflowId ? { ...w, flow_data: flow } : w));
      }
    } catch (err: any) {
      console.error(err);
      toast('Erro ao salvar o fluxo.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    setIsDeleteModalOpen(false);
    
    try {
      const { error } = await supabase
        .from('bpm_workflows')
        .delete()
        .eq('id', currentWorkflowId);
        
      if (error) throw error;
      
      toast('Fluxo excluído com sucesso!', 'success');
      setWorkflows(prev => prev.filter(w => w.id !== currentWorkflowId));
      setCurrentWorkflowId('new');
    } catch (err: any) {
      console.error(err);
      toast('Erro ao excluir o fluxo.', 'error');
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
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1">
            <select
              value={currentWorkflowId}
              onChange={(e) => setCurrentWorkflowId(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-bold text-neutral-700 dark:text-neutral-300 px-3 py-1.5 cursor-pointer max-w-[200px]"
            >
              <option value="new">--- Criar Novo Fluxo ---</option>
              {workflows.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {currentWorkflowId !== 'new' && (
            <button 
              onClick={handleDelete}
              className="flex items-center gap-2 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl text-xs font-bold transition-all"
              title="Excluir Fluxo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Fluxo
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
        <FlowSidebar />
        <div className="flex-1 h-full relative" ref={reactFlowWrapper} onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
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
        <div className={`w-96 h-full bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 transition-all duration-300 absolute right-0 top-0 z-40 flex flex-col shadow-2xl ${selectedNode ? 'translate-x-0' : 'translate-x-full'}`}>
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
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Rótulo (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="Deixe em branco para auto"
                    value={(selectedNode.data?.label as string) || ''} 
                    onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {selectedNode.type === 'trigger' && (() => {
                  const triggerTypes = (selectedNode.data?.triggerType as string[]) || (selectedNode.data?.triggerType ? [selectedNode.data?.triggerType as string] : []);
                  const requiresModel = triggerTypes.some(t => ['insert', 'update', 'delete'].includes(t));
                  const hasUpdate = triggerTypes.includes('update');

                  return (
                  <div className="space-y-4 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                    <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                      Configuração do Gatilho
                    </h4>
                    
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Eventos (Pode selecionar mais de um)</label>
                      <div className="space-y-2">
                        {[
                          { id: 'insert', label: 'Ao Inserir Registro' },
                          { id: 'update', label: 'Ao Atualizar Registro' },
                          { id: 'delete', label: 'Ao Excluir Registro' },
                          { id: 'manual', label: 'Ação Manual (Botão na Grid)' },
                          { id: 'scheduled', label: 'Agendado (Cron Job)' }
                        ].map(evt => {
                          const isChecked = triggerTypes.includes(evt.id);
                          return (
                            <label key={evt.id} className="flex items-center gap-2 cursor-pointer group">
                              <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${isChecked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-neutral-300 dark:border-neutral-700 group-hover:border-emerald-500'}`}>
                                {isChecked && <Check className="w-3 h-3" />}
                              </div>
                              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">{evt.label}</span>
                              <input 
                                type="checkbox"
                                className="hidden"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    updateNodeData(selectedNode.id, { triggerType: [...triggerTypes, evt.id] });
                                  } else {
                                    updateNodeData(selectedNode.id, { triggerType: triggerTypes.filter(t => t !== evt.id) });
                                  }
                                }}
                              />
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    {requiresModel && (
                      <div>
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Tabela Alvo</label>
                        <select 
                          value={(selectedNode.data?.triggerModelId as string) || ''} 
                          onChange={(e) => updateNodeData(selectedNode.id, { triggerModelId: e.target.value, triggerField: '' })}
                          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="">Selecione a tabela...</option>
                          {dbModels.map(m => (
                            <option key={m.id} value={m.id}>{m.display_name || m.db_table_name || m.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {hasUpdate && (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-0">Restringir a um Campo?</label>
                            <input 
                              type="checkbox" 
                              checked={!!selectedNode.data?.triggerSpecificField}
                              onChange={(e) => updateNodeData(selectedNode.id, { triggerSpecificField: e.target.checked })}
                              className="rounded bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-emerald-500 focus:ring-emerald-500" 
                            />
                          </div>
                        </div>

                        {selectedNode.data?.triggerSpecificField && (
                          <div className="space-y-4 pt-2 border-t border-emerald-500/20 mt-4">
                            <div>
                              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Qual Campo?</label>
                              <select 
                                value={(selectedNode.data?.triggerField as string) || ''} 
                                onChange={(e) => updateNodeData(selectedNode.id, { triggerField: e.target.value })}
                                disabled={!selectedNode.data?.triggerModelId}
                                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                              >
                                <option value="">Selecione o campo...</option>
                                {dbFields
                                  .filter(f => f.model_id === selectedNode.data?.triggerModelId)
                                  .map(f => (
                                    <option key={f.id} value={f.db_column_name || f.name}>{f.display_name || f.db_column_name || f.name}</option>
                                  ))}
                              </select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">De (Opcional)</label>
                                <input 
                                  type="text" 
                                  placeholder="Qualquer"
                                  value={(selectedNode.data?.triggerFromValue as string) || ''} 
                                  onChange={(e) => updateNodeData(selectedNode.id, { triggerFromValue: e.target.value })}
                                  className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Para (Opcional)</label>
                                <input 
                                  type="text" 
                                  placeholder="Qualquer"
                                  value={(selectedNode.data?.triggerToValue as string) || ''} 
                                  onChange={(e) => updateNodeData(selectedNode.id, { triggerToValue: e.target.value })}
                                  className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )})()}

                {selectedNode.type === 'condition' && (() => {
                  const groups = (selectedNode.data?.conditionGroups as any[]) || [];
                  
                  return (
                  <div className="space-y-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest flex items-center gap-2">
                        Lógica If / Else
                      </h4>
                      <button
                        onClick={() => {
                          const newGroupId = `g_${Math.random().toString(36).substr(2, 9)}`;
                          updateNodeData(selectedNode.id, { 
                            conditionGroups: [...groups, { id: newGroupId, groupLogic: 'AND', logic: 'AND', rules: [] }]
                          });
                        }}
                        className="text-[9px] bg-amber-500 text-white px-2 py-1 rounded font-bold uppercase tracking-widest hover:bg-amber-600 transition-colors"
                      >
                        + Grupo
                      </button>
                    </div>

                    {groups.length === 0 && (
                      <div className="text-[10px] text-neutral-500 text-center py-6 border border-dashed border-amber-500/30 rounded-xl">
                        Nenhuma condição definida.<br/>Clique em <strong>+ GRUPO</strong> para começar.
                      </div>
                    )}

                    <div className="space-y-4">
                      {groups.map((group, gIndex) => (
                        <div key={group.id} className="relative">
                          {gIndex > 0 && (
                            <div className="flex justify-center -my-3 relative z-10">
                              <select
                                value={group.groupLogic}
                                onChange={(e) => {
                                  const newGroups = [...groups];
                                  newGroups[gIndex].groupLogic = e.target.value;
                                  updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                }}
                                className="bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-[9px] font-bold uppercase rounded px-2 py-0.5 border border-amber-300 dark:border-amber-700 focus:ring-0 cursor-pointer"
                              >
                                <option value="AND">E (AND)</option>
                                <option value="OR">OU (OR)</option>
                              </select>
                            </div>
                          )}

                          <div className="bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-900 rounded-xl p-3 shadow-sm">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Regras devem ser:</span>
                                <select
                                  value={group.logic}
                                  onChange={(e) => {
                                    const newGroups = [...groups];
                                    newGroups[gIndex].logic = e.target.value;
                                    updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                  }}
                                  className="bg-transparent border-none text-[10px] font-black text-amber-600 dark:text-amber-500 p-0 pr-4 focus:ring-0 cursor-pointer"
                                >
                                  <option value="AND">Todas (AND)</option>
                                  <option value="OR">Qualquer (OR)</option>
                                </select>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    const newGroups = [...groups];
                                    newGroups[gIndex].rules.push({ id: `r_${Math.random().toString(36).substr(2, 9)}`, modelId: '', field: '', operator: '==', value: '' });
                                    updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                  }}
                                  className="text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 p-1.5 rounded transition-colors"
                                  title="Adicionar Regra"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    const newGroups = groups.filter((_, i) => i !== gIndex);
                                    updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                  }}
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 p-1.5 rounded transition-colors"
                                  title="Excluir Grupo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-3">
                              {(!group.rules || group.rules.length === 0) && (
                                <div className="text-[10px] text-neutral-400 text-center py-2">
                                  Nenhuma regra neste grupo.
                                </div>
                              )}
                              
                              {group.rules?.map((rule: any, rIndex: number) => (
                                <div key={rule.id} className="relative">
                                  {rIndex > 0 && (
                                    <div className="absolute -top-2.5 left-3 text-[8px] font-bold text-amber-500 bg-white dark:bg-neutral-900 px-1 z-10">
                                      {group.logic === 'AND' ? 'E' : 'OU'}
                                    </div>
                                  )}
                                  <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg p-2 pt-3 space-y-2 relative group/rule">
                                    
                                    <button
                                      onClick={() => {
                                        const newGroups = [...groups];
                                        newGroups[gIndex].rules = newGroups[gIndex].rules.filter((_: any, i: number) => i !== rIndex);
                                        updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                      }}
                                      className="absolute top-1 right-1 text-neutral-400 hover:text-red-500 opacity-0 group-hover/rule:opacity-100 transition-opacity p-0.5"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>

                                    <div className="grid grid-cols-2 gap-2">
                                      <select 
                                        value={rule.modelId} 
                                        onChange={(e) => {
                                          const newGroups = [...groups];
                                          newGroups[gIndex].rules[rIndex].modelId = e.target.value;
                                          newGroups[gIndex].rules[rIndex].field = '';
                                          updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                        }}
                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1.5 text-[10px] focus:ring-1 focus:ring-amber-500"
                                      >
                                        <option value="">Tabela...</option>
                                        {dbModels.map(m => <option key={m.id} value={m.id}>{m.display_name || m.db_table_name || m.name}</option>)}
                                      </select>

                                      <select 
                                        value={rule.field} 
                                        onChange={(e) => {
                                          const newGroups = [...groups];
                                          newGroups[gIndex].rules[rIndex].field = e.target.value;
                                          updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                        }}
                                        disabled={!rule.modelId}
                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1.5 text-[10px] focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
                                      >
                                        <option value="">Campo...</option>
                                        {dbFields.filter(f => f.model_id === rule.modelId).map(f => (
                                          <option key={f.id} value={f.db_column_name || f.name}>{f.display_name || f.db_column_name || f.name}</option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="grid grid-cols-[1fr_2fr] gap-2">
                                      <select 
                                        value={rule.operator || '=='} 
                                        onChange={(e) => {
                                          const newGroups = [...groups];
                                          newGroups[gIndex].rules[rIndex].operator = e.target.value;
                                          updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                        }}
                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1.5 text-[10px] focus:ring-1 focus:ring-amber-500"
                                      >
                                        <option value="==">== (Igual)</option>
                                        <option value="!=">!= (Dif)</option>
                                        <option value=">">&gt; (Maior)</option>
                                        <option value=">=">&gt;=</option>
                                        <option value="<">&lt; (Menor)</option>
                                        <option value="<=">&lt;=</option>
                                        <option value="contains">Contém</option>
                                      </select>

                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2 justify-end mb-1">
                                          <span className="text-[9px] text-neutral-400">Usar Enum?</span>
                                          <input 
                                            type="checkbox" 
                                            checked={!!rule.useEnum}
                                            onChange={(e) => {
                                              const newGroups = [...groups];
                                              newGroups[gIndex].rules[rIndex].useEnum = e.target.checked;
                                              updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                            }}
                                            className="rounded w-3 h-3 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-amber-500 focus:ring-amber-500" 
                                          />
                                        </div>

                                        {rule.useEnum ? (
                                          <div className="space-y-2">
                                            <select 
                                              value={rule.enumId || ''}
                                              onChange={(e) => {
                                                const newGroups = [...groups];
                                                newGroups[gIndex].rules[rIndex].enumId = e.target.value;
                                                newGroups[gIndex].rules[rIndex].value = '';
                                                updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                              }}
                                              className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1.5 text-[10px] focus:ring-1 focus:ring-amber-500"
                                            >
                                              <option value="">Selecione o Enum...</option>
                                              {enums.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
                                            </select>
                                            
                                            {!!rule.enumId && (
                                              <select 
                                                value={rule.value || ''}
                                                onChange={(e) => {
                                                  const newGroups = [...groups];
                                                  newGroups[gIndex].rules[rIndex].value = e.target.value;
                                                  updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                                }}
                                                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1.5 text-[10px] focus:ring-1 focus:ring-amber-500"
                                              >
                                                <option value="">Selecione o Valor...</option>
                                                {enums.find(e => e.id === rule.enumId)?.values?.map((v: any) => (
                                                  <option key={v.value} value={v.value}>{v.description ? `${String(v.value)} - ${String(v.description)}` : String(v.value)}</option>
                                                ))}
                                              </select>
                                            )}
                                          </div>
                                        ) : (
                                          <input 
                                            type="text" 
                                            placeholder="Valor..."
                                            value={rule.value || ''} 
                                            onChange={(e) => {
                                              const newGroups = [...groups];
                                              newGroups[gIndex].rules[rIndex].value = e.target.value;
                                              updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                            }}
                                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1.5 text-[10px] focus:ring-1 focus:ring-amber-500"
                                          />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )})()}
                
                {selectedNode.type === 'action' && (
                  <div className="space-y-4 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
                    <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                      Configuração da Ação
                    </h4>

                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Tipo de Ação</label>
                      <select 
                        value={(selectedNode.data?.actionType as string) || ''} 
                        onChange={(e) => updateNodeData(selectedNode.id, { actionType: e.target.value })}
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">Selecione a ação...</option>
                        <option value="insert">Inserir Registro</option>
                        <option value="update">Atualizar Registro</option>
                        <option value="delete">Excluir Registro</option>
                        <option value="email">Enviar E-mail</option>
                      </select>
                    </div>

                    {['insert', 'update', 'delete'].includes(selectedNode.data?.actionType as string) && (
                      <div className="space-y-4 pt-4 border-t border-indigo-500/20">
                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Tabela Alvo</label>
                          <select 
                            value={(selectedNode.data?.actionModelId as string) || ''} 
                            onChange={(e) => updateNodeData(selectedNode.id, { actionModelId: e.target.value, actionField: '' })}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">Selecione uma tabela...</option>
                            {dbModels.map(m => (
                              <option key={m.id} value={m.id}>{m.display_name || m.db_table_name || m.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {['insert', 'update'].includes(selectedNode.data?.actionType as string) && (
                      <div className="space-y-4 pt-2">
                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Campo a Alterar/Inserir</label>
                          <select 
                            value={(selectedNode.data?.actionField as string) || ''} 
                            onChange={(e) => updateNodeData(selectedNode.id, { actionField: e.target.value })}
                            disabled={!selectedNode.data?.actionModelId}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                          >
                            <option value="">Selecione um campo...</option>
                            {dbFields
                              .filter(f => f.model_id === selectedNode.data?.actionModelId)
                              .map(f => (
                                <option key={f.id} value={f.db_column_name || f.name}>{f.display_name || f.db_column_name || f.name}</option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-0">Valor</label>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-neutral-400">Usar Enum?</span>
                              <input 
                                type="checkbox" 
                                checked={!!selectedNode.data?.actionUseEnum}
                                onChange={(e) => updateNodeData(selectedNode.id, { actionUseEnum: e.target.checked })}
                                className="rounded bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-indigo-500 focus:ring-indigo-500" 
                              />
                            </div>
                          </div>

                          {selectedNode.data?.actionUseEnum ? (
                            <div className="space-y-2">
                                <select 
                                   value={(selectedNode.data?.actionEnumId as string) || ''}
                                   onChange={(e) => updateNodeData(selectedNode.id, { actionEnumId: e.target.value, actionValue: '' })}
                                   className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                                >
                                   <option value="">Selecione o Enum...</option>
                                   {enums.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
                                </select>
                                
                                {!!selectedNode.data?.actionEnumId && (
                                   <select 
                                     value={(selectedNode.data?.actionValue as string) || ''}
                                     onChange={(e) => updateNodeData(selectedNode.id, { actionValue: e.target.value })}
                                     className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                                   >
                                      <option value="">Selecione o Valor...</option>
                                      {enums.find(e => e.id === selectedNode.data?.actionEnumId)?.values?.map((v: any) => (
                                         <option key={v.value} value={v.value}>{v.description ? `${String(v.value)} - ${String(v.description)}` : String(v.value)}</option>
                                      ))}
                                   </select>
                                )}
                            </div>
                          ) : (
                            <input 
                              type="text" 
                              placeholder="Ex: aprovado ou {{trigger.id}}"
                              value={(selectedNode.data?.actionValue as string) || ''} 
                              onChange={(e) => updateNodeData(selectedNode.id, { actionValue: e.target.value })}
                              className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {selectedNode.data?.actionType === 'email' && (
                      <div className="space-y-4 pt-4 border-t border-indigo-500/20">
                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Tabela Alvo (Puxar e-mail de)</label>
                          <select 
                            value={(selectedNode.data?.actionModelId as string) || ''} 
                            onChange={(e) => updateNodeData(selectedNode.id, { actionModelId: e.target.value, actionEmailField: '' })}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">Selecione uma tabela...</option>
                            {dbModels.map(m => (
                              <option key={m.id} value={m.id}>{m.display_name || m.db_table_name || m.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Campo de E-mail</label>
                          <select 
                            value={(selectedNode.data?.actionEmailField as string) || ''} 
                            onChange={(e) => updateNodeData(selectedNode.id, { actionEmailField: e.target.value })}
                            disabled={!selectedNode.data?.actionModelId}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                          >
                            <option value="">Selecione o campo de e-mail...</option>
                            {dbFields
                              .filter(f => f.model_id === selectedNode.data?.actionModelId)
                              .map(f => (
                                <option key={f.id} value={f.db_column_name || f.name}>{f.display_name || f.db_column_name || f.name}</option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-0">Assunto</label>
                            <select 
                              value=""
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                const currentText = (selectedNode.data?.actionSubject as string) || '';
                                let newText = currentText + ` {{${val}}}`; // Default para o final
                                if (cursorPos && cursorPos.field === 'actionSubject') {
                                  newText = currentText.substring(0, cursorPos.start) + `{{${val}}}` + currentText.substring(cursorPos.end);
                                }
                                updateNodeData(selectedNode.id, { actionSubject: newText });
                                e.target.value = '';
                                setCursorPos(null);
                              }}
                              className="bg-transparent border-none text-[9px] text-indigo-500 font-bold uppercase tracking-widest cursor-pointer focus:ring-0 w-24 text-right p-0"
                            >
                              <option value="" className="text-left text-neutral-900 dark:text-neutral-100 normal-case tracking-normal text-sm font-normal">+ Variável</option>
                              {[...dbModels]
                                .sort((a, b) => {
                                  const nameA = a.display_name || a.db_table_name || a.name;
                                  const nameB = b.display_name || b.db_table_name || b.name;
                                  return nameA.localeCompare(nameB);
                                })
                                .map(m => {
                                  const tableName = m.display_name || m.db_table_name || m.name;
                                  const fields = dbFields.filter(f => f.model_id === m.id);
                                  if (fields.length === 0) return null;
                                  
                                  return (
                                    <optgroup key={m.id} label={tableName} className="text-left text-indigo-600 dark:text-indigo-400 normal-case tracking-normal text-sm font-bold bg-neutral-50 dark:bg-neutral-900">
                                      {[...fields]
                                        .sort((a, b) => {
                                          const nameA = a.display_name || a.db_column_name || a.name;
                                          const nameB = b.display_name || b.db_column_name || b.name;
                                          return nameA.localeCompare(nameB);
                                        })
                                        .map(f => (
                                          <option key={f.id} value={`${m.db_table_name || m.name}.${f.db_column_name || f.name}`} className="text-left text-neutral-900 dark:text-neutral-100 normal-case tracking-normal text-sm font-normal">
                                            {f.display_name || f.db_column_name || f.name}
                                          </option>
                                        ))}
                                    </optgroup>
                                  );
                                })
                              }
                            </select>
                          </div>
                          <input 
                            type="text" 
                            placeholder="Ex: Confirmação do Pedido {{orders.id}}"
                            value={(selectedNode.data?.actionSubject as string) || ''} 
                            onChange={(e) => updateNodeData(selectedNode.id, { actionSubject: e.target.value })}
                            onBlur={(e) => setCursorPos({ field: 'actionSubject', start: e.target.selectionStart || 0, end: e.target.selectionEnd || 0 })}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-0">Corpo (HTML/Texto)</label>
                            <select 
                              value=""
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                const currentText = (selectedNode.data?.actionBody as string) || '';
                                let newText = currentText + ` {{${val}}}`; // Default para o final
                                if (cursorPos && cursorPos.field === 'actionBody') {
                                  newText = currentText.substring(0, cursorPos.start) + `{{${val}}}` + currentText.substring(cursorPos.end);
                                }
                                updateNodeData(selectedNode.id, { actionBody: newText });
                                e.target.value = '';
                                setCursorPos(null);
                              }}
                              className="bg-transparent border-none text-[9px] text-indigo-500 font-bold uppercase tracking-widest cursor-pointer focus:ring-0 w-24 text-right p-0"
                            >
                              <option value="" className="text-left text-neutral-900 dark:text-neutral-100 normal-case tracking-normal text-sm font-normal">+ Variável</option>
                              {[...dbModels]
                                .sort((a, b) => {
                                  const nameA = a.display_name || a.db_table_name || a.name;
                                  const nameB = b.display_name || b.db_table_name || b.name;
                                  return nameA.localeCompare(nameB);
                                })
                                .map(m => {
                                  const tableName = m.display_name || m.db_table_name || m.name;
                                  const fields = dbFields.filter(f => f.model_id === m.id);
                                  if (fields.length === 0) return null;
                                  
                                  return (
                                    <optgroup key={m.id} label={tableName} className="text-left text-indigo-600 dark:text-indigo-400 normal-case tracking-normal text-sm font-bold bg-neutral-50 dark:bg-neutral-900">
                                      {[...fields]
                                        .sort((a, b) => {
                                          const nameA = a.display_name || a.db_column_name || a.name;
                                          const nameB = b.display_name || b.db_column_name || b.name;
                                          return nameA.localeCompare(nameB);
                                        })
                                        .map(f => (
                                          <option key={f.id} value={`${m.db_table_name || m.name}.${f.db_column_name || f.name}`} className="text-left text-neutral-900 dark:text-neutral-100 normal-case tracking-normal text-sm font-normal">
                                            {f.display_name || f.db_column_name || f.name}
                                          </option>
                                        ))}
                                    </optgroup>
                                  );
                                })
                              }
                            </select>
                          </div>
                          <textarea 
                            rows={4}
                            placeholder="Olá {{customers.nome}}, seu pedido foi recebido!"
                            value={(selectedNode.data?.actionBody as string) || ''} 
                            onChange={(e) => updateNodeData(selectedNode.id, { actionBody: e.target.value })}
                            onBlur={(e) => setCursorPos({ field: 'actionBody', start: e.target.selectionStart || 0, end: e.target.selectionEnd || 0 })}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 resize-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Modal de Exclusão */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Excluir Fluxo"
        description="Tem certeza que deseja excluir este fluxo?"
      >
        <div className="space-y-6">
          <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl flex gap-4 text-red-600 dark:text-red-400">
            <Trash2 className="w-5 h-5 shrink-0" />
            <div className="text-sm">
              <p className="font-bold mb-1">Atenção!</p>
              <p>Esta ação é irreversível e excluirá todo o conteúdo deste fluxo.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-xl font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors"
            >
              Sim, Excluir Fluxo
            </button>
          </div>
        </div>
      </Modal>
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
