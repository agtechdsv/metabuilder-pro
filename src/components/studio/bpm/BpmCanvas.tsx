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
import { Save, Play, Wand2, X, ArrowLeft, Loader2, Plus, Trash2, Check, Edit2, Box } from 'lucide-react';
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
  project?: any;
  useCaseId?: string;
  initialWorkflows?: any[];
  initialModels?: any[];
  initialViews?: any[];
}

function BpmCanvasContent({ 
  title = 'Aprovação de Pedidos', 
  defaultAutoAlign = false, 
  project, 
  useCaseId,
  initialWorkflows = [],
  initialModels = [],
  initialViews = []
}: BpmCanvasProps) {
  console.log("=== BPM CANVAS INITIAL VIEWS ===", JSON.stringify(initialViews, null, 2));
  const projectId = project?.id;
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const supabase = createClient();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const { fitView } = useReactFlow();
  const [localViews, setLocalViews] = useState(initialViews);
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
  const [roles, setRoles] = useState<any[]>([]);
  const [cursorPos, setCursorPos] = useState<{ field: 'actionSubject' | 'actionBody' | 'webhookBody', start: number, end: number } | null>(null);
  
  // Modal states
  const [selectedGroupForModal, setSelectedGroupForModal] = useState<{ id: string, name: string } | null>(null);
  const [groupUsers, setGroupUsers] = useState<any[]>([]);
  const [isLoadingGroupUsers, setIsLoadingGroupUsers] = useState(false);
  const [selectedUsersInModal, setSelectedUsersInModal] = useState<string[] | 'all'>('all');
  const [modalSearchTerm, setModalSearchTerm] = useState('');

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
  }, [projectId, supabase]);

  // Buscar Roles
  useEffect(() => {
    let unmounted = false;
    if (!project) return;
    const fetchRoles = async () => {
      const authConfig = project.auth_config || {};
      if (authConfig.sync_legacy_groups && authConfig.db_groups_table) {
        try {
          const currentModel = initialModels.find(m => m.db_table_name === authConfig.db_groups_table);
          const schemaName = currentModel?.db_schema_name || 'public';
          
          const tunnelQuery = () => new Promise<any>((resolve, reject) => {
            const channelName = `tunnel:${project.id}`;
            const queryId = crypto.randomUUID();
            let isFinished = false;
            const channel = supabase.channel(channelName);
            
            const cleanup = () => {
              if (isFinished) return;
              isFinished = true;
              try { supabase.removeChannel(channel) } catch(e){}
            };

            channel.on('broadcast', { event: `query_result_${queryId}` }, (response: any) => {
              cleanup();
              if (response.payload?.success) {
                resolve(response.payload.data);
              } else {
                reject(new Error(response.payload?.error || 'Erro'));
              }
            });

            setTimeout(() => {
              if (unmounted || isFinished) return;
              
              const sendQuery = async () => {
                await channel.send({
                  type: 'broadcast', event: 'sql_query',
                  payload: { action: 'select', table: authConfig.db_groups_table, schemaName, limit: 100, offset: 0, queryId, token: project.secret_token }
                });
              };

              if (channel.state === 'joined') {
                sendQuery();
              } else {
                channel.subscribe(async (status) => {
                  if (unmounted || isFinished) return;
                  if (status === 'SUBSCRIBED') {
                    await sendQuery();
                  }
                });
              }
            }, 200);

            setTimeout(() => {
              if (!isFinished) {
                cleanup();
                if (!unmounted) reject(new Error('Timeout'));
              }
            }, 6000);
          });

          const data = await tunnelQuery();
          if (unmounted) return;
          const pkField = currentModel?.fields?.find((f: any) => f.is_primary_key)?.db_column_name || 'id';
          const nameField = authConfig.db_groups_name_column || 'name';
          const mappedRoles = data.map((r: any) => ({
            id: r[pkField]?.toString() || crypto.randomUUID(),
            name: r[nameField] || 'Grupo'
          }));
          setRoles(mappedRoles);
        } catch(err) {
          if (!unmounted) console.error(err);
        }
      } else {
        const { data: dbRoles } = await supabase.from('project_roles').select('*').eq('project_id', project.id);
        if (dbRoles && !unmounted) setRoles(dbRoles);
      }
    };
    fetchRoles();
    return () => { unmounted = true; };
  }, [project, initialModels, supabase]);

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

  const openGroupUsersModal = async (grupo: { id: string, name: string }) => {
    setSelectedGroupForModal(grupo);
    setIsLoadingGroupUsers(true);
    setGroupUsers([]);
    setModalSearchTerm('');
    
    const currentGroupsUsers = selectedNode?.data?.emailGroupsUsers || {};
    const currentSelection = currentGroupsUsers[grupo.name];
    setSelectedUsersInModal(currentSelection || 'all');

    try {
      const authConfig = project?.auth_config || {};
      const currentModel = initialModels.find(m => m.db_table_name === authConfig.db_table_name);
      const pkField = currentModel?.fields?.find((f: any) => f.is_primary_key)?.db_column_name || 'id';
      const emailField = authConfig.db_email_column || 'email';
      const nameField = authConfig.db_name_column || 'name';

      if (authConfig.sync_legacy_groups && authConfig.db_table_name) {
        let sql = '';
        if (authConfig.db_user_groups_type === 'n_to_n') {
          const urTable = authConfig.db_user_roles_table;
          const userCol = authConfig.db_user_roles_user_id_column;
          const roleCol = authConfig.db_user_roles_role_id_column;
          sql = `SELECT u.* FROM "${authConfig.db_table_name}" u INNER JOIN "${urTable}" ur ON CAST(u."${pkField}" AS text) = CAST(ur."${userCol}" AS text) WHERE CAST(ur."${roleCol}" AS text) = '${grupo.id}'`;
        } else {
          const roleCol = authConfig.db_user_role_column;
          sql = `SELECT * FROM "${authConfig.db_table_name}" WHERE CAST("${roleCol}" AS text) = '${grupo.id}'`;
        }

        const schemaName = currentModel?.db_schema_name || 'public';

        const tunnelQuery = () => new Promise<any>((resolve, reject) => {
          const channelName = `tunnel:${project!.id}`;
          const queryId = crypto.randomUUID();
          let isFinished = false;
          const channel = supabase.channel(channelName);
          const cleanup = () => { if (isFinished) return; isFinished = true; try { supabase.removeChannel(channel) } catch(e){} };
          channel.on('broadcast', { event: `query_result_${queryId}` }, (response: any) => {
            cleanup();
            if (response.payload?.success) { resolve(response.payload.data); } else { reject(new Error(response.payload?.error || 'Erro')); }
          });
          setTimeout(() => {
            if (isFinished) return;
            const sendQ = async () => {
              await channel.send({ type: 'broadcast', event: 'sql_query', payload: { action: 'select', schemaName, query: sql, limit: 1000, offset: 0, queryId, token: project!.secret_token } });
            };
            if (channel.state === 'joined') { sendQ(); } else {
              channel.subscribe(async (status) => { if (isFinished) return; if (status === 'SUBSCRIBED') await sendQ(); });
            }
          }, 200);
          setTimeout(() => { if (!isFinished) { cleanup(); reject(new Error('Timeout')); } }, 6000);
        });
        
        const data = await tunnelQuery();
        setGroupUsers(data.map((u: any) => ({
          id: u[pkField]?.toString(),
          name: u[nameField] || u[emailField] || 'Usuário',
          email: u[emailField] || ''
        })));
      } else {
        const { data: dbUsers } = await supabase.from('project_users').select('*').eq('project_id', project!.id);
        const { data: dbUserRoles } = await supabase.from('project_user_roles').select('*').eq('project_id', project!.id).eq('role_id', grupo.id);
        const userIds = dbUserRoles?.map(ur => ur.user_id) || [];
        const filteredUsers = (dbUsers || []).filter(u => userIds.includes(u.id));
        
        setGroupUsers(filteredUsers.map(u => ({
          id: u.id,
          name: u.name || u.email || 'Usuário',
          email: u.email
        })));
      }
    } catch (err) {
      console.error(err);
      toast('Erro ao buscar usuários do grupo', 'error');
    } finally {
      setIsLoadingGroupUsers(false);
    }
  };

  const handleAutoAlign = useCallback(() => {
    const layouted = getLayoutedElements(nodes, edges);
    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);
    setTimeout(() => fitView({ padding: 0.2, duration: 800, maxZoom: 1.5 }), 50);
  }, [nodes, edges, setNodes, setEdges, fitView]);

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
        data: {},
      };
      
      toast(`Nó ${type} solto no canvas!`, 'success');

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
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
        
        setWorkflows(prev => prev.map(w => w.id === currentWorkflowId ? { ...w, flow_data: flow } : w));
      }
    } catch (err: any) {
      console.error(err);
      toast('Erro ao salvar o fluxo.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRename = async () => {
    const wf = workflows.find(w => w.id === currentWorkflowId);
    if (!wf) return;
    
    const newName = window.prompt("Nome do fluxo:", wf.name);
    if (!newName || newName === wf.name) return;

    try {
      const { error } = await supabase
        .from('bpm_workflows')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', currentWorkflowId);

      if (error) throw error;
      
      toast('Fluxo renomeado!', 'success');
      setWorkflows(prev => prev.map(w => w.id === currentWorkflowId ? { ...w, name: newName } : w));
    } catch (err: any) {
      console.error(err);
      toast('Erro ao renomear.', 'error');
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

  const renderActionFilters = () => {
    if (!selectedNode || !selectedNode.data?.actionModelId) return null;
    const actionFilters = (selectedNode.data.actionFilters as any[]) || [];
    
    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-3 shadow-sm mt-4">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-red-100 dark:border-red-900/50">
          <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest">Filtros (Quais registros?)</span>
          <button
            onClick={() => {
              updateNodeData(selectedNode.id, { 
                actionFilters: [...actionFilters, { field: '', operator: '==', value: '' }]
              });
            }}
            className="text-[9px] bg-red-500 text-white px-2 py-1 rounded font-bold uppercase tracking-widest hover:bg-red-600 transition-colors"
          >
            + Filtro
          </button>
        </div>

        {actionFilters.length === 0 && (
          <div className="text-[9px] text-red-400 text-center py-2 italic font-semibold">
            CUIDADO: Nenhum filtro definido. Isso afetará TODOS os registros.
          </div>
        )}

        <div className="space-y-3">
          {actionFilters.map((filt: any, index: number) => (
            <div key={index} className="relative group/filt border border-red-100 dark:border-red-900/30 rounded p-2 bg-white dark:bg-neutral-950">
              <button
                onClick={() => {
                  const newFilters = [...actionFilters];
                  newFilters.splice(index, 1);
                  updateNodeData(selectedNode.id, { actionFilters: newFilters });
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/filt:opacity-100 transition-opacity shadow z-10"
                title="Remover filtro"
              >
                <X className="w-3 h-3" />
              </button>
              
              <div className="grid grid-cols-[1fr_auto] gap-2 mb-2">
                <select 
                  value={filt.field || ''} 
                  onChange={(e) => {
                    const newFilters = [...actionFilters];
                    newFilters[index].field = e.target.value;
                    updateNodeData(selectedNode.id, { actionFilters: newFilters });
                  }}
                  className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-[10px] focus:ring-1 focus:ring-red-500"
                >
                  <option value="">Campo...</option>
                  {dbFields.filter(f => f.model_id === selectedNode.data?.actionModelId).map(f => (
                    <option key={f.id} value={f.db_column_name || f.name}>{f.display_name || f.db_column_name || f.name}</option>
                  ))}
                </select>

                <select 
                  value={filt.operator || '=='} 
                  onChange={(e) => {
                    const newFilters = [...actionFilters];
                    newFilters[index].operator = e.target.value;
                    updateNodeData(selectedNode.id, { actionFilters: newFilters });
                  }}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-[10px] focus:ring-1 focus:ring-red-500 w-[60px]"
                >
                  <option value="==">==</option>
                  <option value="!=">!=</option>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                </select>
              </div>

              <div className="flex gap-1">
                <input 
                  type="text" 
                  placeholder="Ex: {{trigger.id}} ou valor fixo"
                  value={filt.value || ''} 
                  onChange={(e) => {
                    const newFilters = [...actionFilters];
                    newFilters[index].value = e.target.value;
                    updateNodeData(selectedNode.id, { actionFilters: newFilters });
                  }}
                  className="flex-1 min-w-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-[10px] focus:ring-1 focus:ring-red-500"
                />
                <select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const newFilters = [...actionFilters];
                    newFilters[index].value = (newFilters[index].value || '') + `{{${e.target.value}}}`;
                    updateNodeData(selectedNode.id, { actionFilters: newFilters });
                    e.target.value = '';
                  }}
                  className="w-8 shrink-0 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-transparent rounded px-1 py-1 focus:ring-1 focus:ring-red-500 cursor-pointer text-[10px] appearance-none"
                  style={{ backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%23ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}
                  title="Inserir Variável"
                >
                  <option value="" className="text-neutral-900 dark:text-neutral-100">+ Var</option>
                  {[...dbModels].map(m => {
                    const fields = dbFields.filter(f => f.model_id === m.id);
                    if (fields.length === 0) return null;
                    return (
                      <optgroup key={m.id} label={m.display_name || m.db_table_name || m.name} className="text-left text-indigo-600 dark:text-indigo-400 normal-case tracking-normal text-sm font-bold bg-neutral-50 dark:bg-neutral-900">
                        {fields.map(f => (
                          <option key={f.id} value={`${m.db_table_name || m.name}.${f.db_column_name || f.name}`} className="text-left text-neutral-900 dark:text-neutral-100 normal-case tracking-normal text-sm font-normal">
                            {f.display_name || f.db_column_name || f.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-neutral-950">
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
              className="bg-transparent border-none outline-none text-xs font-bold text-neutral-700 dark:text-neutral-300 px-3 py-1.5 cursor-pointer min-w-[200px] max-w-[400px] truncate"
            >
              <option value="new">--- Criar Novo Fluxo ---</option>
              {workflows.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {currentWorkflowId !== 'new' && (
            <>
              <button 
                onClick={handleRename}
                className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 rounded-xl text-xs font-bold transition-all"
                title="Renomear Fluxo"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button 
                onClick={handleDelete}
                className="flex items-center gap-2 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl text-xs font-bold transition-all"
                title="Excluir Fluxo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
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

        <div className={`w-96 h-full bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 transition-all duration-300 absolute right-0 top-0 z-40 flex flex-col shadow-2xl ${selectedNodeId ? 'translate-x-0' : 'translate-x-full'}`}>
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
                          { id: 'manual', label: 'Ação Customizada (Botão da Interface)' },
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

                    {triggerTypes.includes('manual') && (() => {
                      const useCasesWithActions = localViews
                        .map(v => ({
                          ...v,
                          layout_config: typeof v.layout_config === 'string' ? JSON.parse(v.layout_config) : (v.layout_config || {})
                        }))
                        .filter(v => v.layout_config?.custom_actions && Array.isArray(v.layout_config.custom_actions) && v.layout_config.custom_actions.length > 0)
                        .map(v => ({
                          id: v.id,
                          name: v.name,
                          actions: v.layout_config.custom_actions.map((act: any) => {
                            const activeContexts: string[] = act.contexts
                              ? (Array.isArray(act.contexts) ? act.contexts : [act.contexts])
                              : (act.context ? [act.context] : ['row']);
                            
                            const contextLabels = activeContexts.map(c => {
                              if (c === 'row') return 'Ação de Linha';
                              if (c === 'bulk') return 'Ação Global';
                              if (c === 'master_top') return 'Global (Mestre)';
                              if (c === 'detail_top') return 'Global (Detalhe)';
                              if (c === 'detail_row') return 'Linha (Detalhe)';
                              if (c === 'form') return 'Formulário';
                              return c;
                            }).join(', ');

                            return {
                              id: act.id || act.label,
                              name: act.label || 'Ação Sem Nome',
                              context: contextLabels || 'Ação Global',
                              icon: act.icon || 'Zap',
                              color: act.color || 'indigo',
                              linked_workflows: act.linked_bpm_workflows || []
                            }
                          })
                        }));

                      const toggleCustomAction = async (viewId: string, actId: string) => {
                        if (!currentWorkflowId || currentWorkflowId === 'new') {
                          toast('Salve o fluxo primeiro antes de vincular botões.', 'error');
                          return;
                        }

                        // Encontra a view e ação
                        const viewIndex = localViews.findIndex(v => v.id === viewId);
                        if (viewIndex === -1) return;
                        const view = localViews[viewIndex];
                        const layoutConfig = typeof view.layout_config === 'string' ? JSON.parse(view.layout_config) : (view.layout_config || {});
                        const customActions = layoutConfig.custom_actions || [];
                        const actionIndex = customActions.findIndex((a: any) => (a.id || a.label) === actId);
                        if (actionIndex === -1) return;

                        const action = customActions[actionIndex];
                        const linkedWorkflows = action.linked_bpm_workflows || [];
                        const isLinked = linkedWorkflows.includes(currentWorkflowId);
                        
                        const newLinkedWorkflows = isLinked
                          ? linkedWorkflows.filter((id: string) => id !== currentWorkflowId)
                          : [...linkedWorkflows, currentWorkflowId];

                        // Atualiza objeto em memória otimisticamente
                        const newActions = [...customActions];
                        newActions[actionIndex] = { ...action, linked_bpm_workflows: newLinkedWorkflows };
                        const newLayoutConfig = { ...layoutConfig, custom_actions: newActions };
                        
                        const newLocalViews = [...localViews];
                        newLocalViews[viewIndex] = { ...view, layout_config: newLayoutConfig };
                        setLocalViews(newLocalViews);

                        // Salva no banco de dados
                        try {
                          const { error } = await supabase
                            .from('ui_views')
                            .update({ layout_config: newLayoutConfig })
                            .eq('id', viewId);
                          
                          if (error) throw error;
                          toast(isLinked ? 'Botão desvinculado do fluxo!' : 'Botão vinculado ao fluxo!', 'success');
                        } catch (err: any) {
                          // Rollback visual em caso de erro
                          setLocalViews(localViews);
                          toast('Erro ao vincular botão: ' + err.message, 'error');
                        }
                      };

                      return (
                      <div className="space-y-4 pt-4 border-t border-emerald-500/20 mt-4">
                        <h5 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Ações Customizadas Acionadoras</h5>
                        <p className="text-[9px] text-neutral-500 leading-relaxed mb-4">
                          Selecione quais botões da interface (criados no Studio) irão disparar este fluxo ao serem clicados.
                        </p>
                        
                        <div className="space-y-3">
                          {useCasesWithActions.length === 0 && (
                            <div className="text-center py-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg border border-neutral-100 dark:border-neutral-800">
                              <p className="text-[10px] text-neutral-500">Nenhuma ação customizada encontrada nos Casos de Uso deste projeto.</p>
                            </div>
                          )}

                          {useCasesWithActions.map(uc => (
                            <div key={uc.id} className="bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-2 border border-neutral-100 dark:border-neutral-800">
                              <h6 className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-2 px-1 flex items-center gap-1">
                                <Box className="w-3 h-3" /> {uc.name}
                              </h6>
                              <div className="space-y-1">
                                {uc.actions.map(act => {
                                  const isChecked = act.linked_workflows.includes(currentWorkflowId || '');
                                  return (
                                    <label key={act.id} className="flex items-center gap-3 p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md cursor-pointer transition-colors group/action">
                                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 ${isChecked ? "bg-emerald-500 border-emerald-500 text-white" : "border-neutral-300 dark:border-neutral-600 group-hover/action:border-emerald-400"}`}>
                                        {isChecked && <Check className="w-3 h-3" />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 truncate leading-none mb-1">{act.name}</p>
                                        <p className="text-[9px] text-neutral-400 truncate uppercase tracking-widest leading-none">{act.context}</p>
                                      </div>
                                      
                                      <input 
                                        type="checkbox" 
                                        className="hidden"
                                        checked={isChecked}
                                        onChange={() => toggleCustomAction(uc.id, act.id)}
                                      />

                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      )
                    })()}

                    {triggerTypes.includes('scheduled') && (() => {
                      const rawSchedules = selectedNode.data?.triggerSchedules as any[];
                      // Fallback para quem já tinha configurado antes (retrocompatibilidade) ou novo
                      const schedules = rawSchedules || [{
                        id: 'default_1',
                        type: (selectedNode.data?.triggerScheduleType as string) || 'recurring',
                        days: (selectedNode.data?.triggerScheduleDays as string[]) || [],
                        time: (selectedNode.data?.triggerScheduleTime as string) || '',
                        dateTime: (selectedNode.data?.triggerScheduleDateTime as string) || ''
                      }];

                      const updateSchedule = (id: string, newProps: any) => {
                        const newSchedules = schedules.map(s => s.id === id ? { ...s, ...newProps } : s);
                        updateNodeData(selectedNode.id, { triggerSchedules: newSchedules });
                      };

                      const removeSchedule = (id: string) => {
                        const newSchedules = schedules.filter(s => s.id !== id);
                        updateNodeData(selectedNode.id, { triggerSchedules: newSchedules.length > 0 ? newSchedules : schedules }); // Previne remover o último se quiser
                      };

                      const addSchedule = () => {
                        updateNodeData(selectedNode.id, { 
                          triggerSchedules: [...schedules, { id: Math.random().toString(), type: 'recurring', days: [], time: '', dateTime: '' }] 
                        });
                      };

                      return (
                      <div className="space-y-4 pt-4 border-t border-emerald-500/20 mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Configuração de Agendamento</h5>
                          <button
                            onClick={addSchedule}
                            className="text-[9px] bg-emerald-500 text-white px-2 py-1 rounded font-bold uppercase tracking-widest hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-500/30"
                          >
                            + Agendamento
                          </button>
                        </div>

                        <div className="space-y-3">
                          {schedules.map((sched, index) => (
                            <div key={sched.id} className="relative group/sched border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3 bg-white dark:bg-neutral-950 shadow-sm">
                              {schedules.length > 1 && (
                                <button
                                  onClick={() => removeSchedule(sched.id)}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/sched:opacity-100 transition-opacity shadow z-10"
                                  title="Remover Agendamento"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}

                              <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg mb-3">
                                <button
                                  onClick={() => updateSchedule(sched.id, { type: 'recurring' })}
                                  className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-colors ${sched.type === 'recurring' ? 'bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                                >
                                  Recorrente
                                </button>
                                <button
                                  onClick={() => updateSchedule(sched.id, { type: 'once' })}
                                  className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-colors ${sched.type === 'once' ? 'bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                                >
                                  Apenas uma Vez
                                </button>
                              </div>

                              <div className="mb-3">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Dias da Semana</label>
                                <div className="flex flex-wrap gap-2">
                                  {[
                                    { val: '0', label: 'Dom' },
                                    { val: '1', label: 'Seg' },
                                    { val: '2', label: 'Ter' },
                                    { val: '3', label: 'Qua' },
                                    { val: '4', label: 'Qui' },
                                    { val: '5', label: 'Sex' },
                                    { val: '6', label: 'Sáb' },
                                  ].map(day => {
                                    const isSelected = sched.days.includes(day.val);
                                    return (
                                      <button
                                        key={day.val}
                                        onClick={() => {
                                          const newDays = isSelected 
                                            ? sched.days.filter((d: string) => d !== day.val)
                                            : [...sched.days, day.val];
                                          updateSchedule(sched.id, { days: newDays });
                                        }}
                                        className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${isSelected ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-emerald-400 hover:text-emerald-500'}`}
                                      >
                                        {day.label}
                                      </button>
                                    )
                                  })}
                                </div>
                                {sched.days.length === 0 && (
                                  <p className="text-[9px] text-neutral-400 mt-2 italic">* Executa todos os dias.</p>
                                )}
                              </div>

                              <div className="mb-2">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Horário (HH:mm)</label>
                                <input 
                                  type="time" 
                                  value={sched.time} 
                                  onChange={(e) => updateSchedule(sched.id, { time: e.target.value })}
                                  className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                                />
                              </div>

                              {sched.type === 'once' && (
                                <div className="pt-3 mt-3 border-t border-emerald-100 dark:border-emerald-900/30">
                                  <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-1">Ou defina Data e Hora Específica</label>
                                  <input 
                                    type="datetime-local" 
                                    value={sched.dateTime} 
                                    onChange={(e) => updateSchedule(sched.id, { dateTime: e.target.value })}
                                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      )
                    })()}
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
                        <option value="webhook">Webhook (Chamada de API)</option>
                      </select>
                    </div>

                    {['insert', 'update', 'delete'].includes(selectedNode.data?.actionType as string) && (() => {
                      const actionFields = (selectedNode.data?.actionFields as any[]) || [];
                      const actionFilters = (selectedNode.data?.actionFilters as any[]) || [];

                      return (
                      <div className="space-y-4 pt-4 border-t border-indigo-500/20">
                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Tabela Alvo</label>
                          <select 
                            value={(selectedNode.data?.actionModelId as string) || ''} 
                            onChange={(e) => updateNodeData(selectedNode.id, { actionModelId: e.target.value, actionFields: [], actionFilters: [] })}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">Selecione uma tabela...</option>
                            {dbModels.map(m => (
                              <option key={m.id} value={m.id}>{m.display_name || m.db_table_name || m.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Múltiplos Campos para Insert / Update */}
                        {['insert', 'update'].includes(selectedNode.data?.actionType as string) && !!selectedNode.data?.actionModelId && (
                          <div className="bg-white dark:bg-neutral-900 border border-indigo-200 dark:border-indigo-900 rounded-xl p-3 shadow-sm mt-4">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                              <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Campos para {selectedNode.data?.actionType === 'insert' ? 'Inserir' : 'Atualizar'}</span>
                              <button
                                onClick={() => {
                                  updateNodeData(selectedNode.id, { 
                                    actionFields: [...actionFields, { field: '', value: '', useEnum: false, enumId: '' }]
                                  });
                                }}
                                className="text-[9px] bg-indigo-500 text-white px-2 py-1 rounded font-bold uppercase tracking-widest hover:bg-indigo-600 transition-colors"
                              >
                                + Campo
                              </button>
                            </div>

                            {actionFields.length === 0 && (
                              <div className="text-[9px] text-neutral-400 text-center py-2 italic">
                                Nenhum campo definido.
                              </div>
                            )}

                            <div className="space-y-3">
                              {actionFields.map((fld: any, index: number) => (
                                <div key={index} className="relative group/field border border-neutral-100 dark:border-neutral-800 rounded p-2 bg-neutral-50 dark:bg-neutral-950">
                                  <button
                                    onClick={() => {
                                      const newFields = [...actionFields];
                                      newFields.splice(index, 1);
                                      updateNodeData(selectedNode.id, { actionFields: newFields });
                                    }}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/field:opacity-100 transition-opacity shadow"
                                    title="Remover campo"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                  
                                  <div className="grid grid-cols-1 gap-2 mb-2">
                                    <select 
                                      value={fld.field || ''} 
                                      onChange={(e) => {
                                        const newFields = [...actionFields];
                                        newFields[index].field = e.target.value;
                                        updateNodeData(selectedNode.id, { actionFields: newFields });
                                      }}
                                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-[10px] focus:ring-1 focus:ring-indigo-500"
                                    >
                                      <option value="">Selecione o campo...</option>
                                      {dbFields.filter(f => f.model_id === selectedNode.data?.actionModelId).map(f => (
                                        <option key={f.id} value={f.db_column_name || f.name}>{f.display_name || f.db_column_name || f.name}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[9px] text-neutral-400">Usar Enum?</span>
                                    <input 
                                      type="checkbox" 
                                      checked={!!fld.useEnum}
                                      onChange={(e) => {
                                        const newFields = [...actionFields];
                                        newFields[index].useEnum = e.target.checked;
                                        updateNodeData(selectedNode.id, { actionFields: newFields });
                                      }}
                                      className="rounded w-3 h-3 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-indigo-500 focus:ring-indigo-500" 
                                    />
                                  </div>

                                  {fld.useEnum ? (
                                    <div className="space-y-2">
                                      <select 
                                        value={fld.enumId || ''}
                                        onChange={(e) => {
                                          const newFields = [...actionFields];
                                          newFields[index].enumId = e.target.value;
                                          newFields[index].value = '';
                                          updateNodeData(selectedNode.id, { actionFields: newFields });
                                        }}
                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-[10px] focus:ring-1 focus:ring-indigo-500"
                                      >
                                        <option value="">Enum...</option>
                                        {enums.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
                                      </select>
                                      
                                      {!!fld.enumId && (
                                        <select 
                                          value={fld.value || ''}
                                          onChange={(e) => {
                                            const newFields = [...actionFields];
                                            newFields[index].value = e.target.value;
                                            updateNodeData(selectedNode.id, { actionFields: newFields });
                                          }}
                                          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-[10px] focus:ring-1 focus:ring-indigo-500"
                                        >
                                          <option value="">Valor...</option>
                                          {enums.find(e => e.id === fld.enumId)?.values?.map((v: any) => (
                                            <option key={v.value} value={v.value}>{v.description ? `${String(v.value)} - ${String(v.description)}` : String(v.value)}</option>
                                          ))}
                                        </select>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex gap-1">
                                      <input 
                                        type="text" 
                                        placeholder="Ex: {{trigger.id}} ou fixo"
                                        value={fld.value || ''} 
                                        onChange={(e) => {
                                          const newFields = [...actionFields];
                                          newFields[index].value = e.target.value;
                                          updateNodeData(selectedNode.id, { actionFields: newFields });
                                        }}
                                        className="flex-1 min-w-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-[10px] focus:ring-1 focus:ring-indigo-500"
                                      />
                                      <select
                                        value=""
                                        onChange={(e) => {
                                          if (!e.target.value) return;
                                          const newFields = [...actionFields];
                                          newFields[index].value = (newFields[index].value || '') + `{{${e.target.value}}}`;
                                          updateNodeData(selectedNode.id, { actionFields: newFields });
                                          e.target.value = '';
                                        }}
                                        className="w-8 shrink-0 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-transparent rounded px-1 py-1 focus:ring-1 focus:ring-indigo-500 cursor-pointer text-[10px] appearance-none"
                                        style={{ backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%236366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}
                                        title="Inserir Variável"
                                      >
                                        <option value="" className="text-neutral-900 dark:text-neutral-100">+ Var</option>
                                        {[...dbModels].map(m => {
                                          const fields = dbFields.filter(f => f.model_id === m.id);
                                          if (fields.length === 0) return null;
                                          return (
                                            <optgroup key={m.id} label={m.display_name || m.db_table_name || m.name} className="text-left text-indigo-600 dark:text-indigo-400 normal-case tracking-normal text-sm font-bold bg-neutral-50 dark:bg-neutral-900">
                                              {fields.map(f => (
                                                <option key={f.id} value={`${m.db_table_name || m.name}.${f.db_column_name || f.name}`} className="text-left text-neutral-900 dark:text-neutral-100 normal-case tracking-normal text-sm font-normal">
                                                  {f.display_name || f.db_column_name || f.name}
                                                </option>
                                              ))}
                                            </optgroup>
                                          );
                                        })}
                                      </select>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Filtros ONDE (WHERE) para Update / Delete */}
                        {['update', 'delete'].includes(selectedNode.data?.actionType as string) && !!selectedNode.data?.actionModelId && renderActionFilters()}
                      </div>
                      )
                    })()}

                    {selectedNode.data?.actionType === 'email' && (
                      <div className="space-y-4 pt-4 border-t border-indigo-500/20">
                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Destinatários</label>
                          <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
                            <button
                              onClick={() => updateNodeData(selectedNode.id, { emailRecipientType: 'system' })}
                              className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-colors ${(!selectedNode.data?.emailRecipientType || selectedNode.data?.emailRecipientType === 'system') ? 'bg-white dark:bg-neutral-700 text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                            >
                              Grupos / Usuários
                            </button>
                            <button
                              onClick={() => updateNodeData(selectedNode.id, { emailRecipientType: 'table' })}
                              className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-colors ${selectedNode.data?.emailRecipientType === 'table' ? 'bg-white dark:bg-neutral-700 text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                            >
                              Tabela Dinâmica
                            </button>
                          </div>
                        </div>

                        {(!selectedNode.data?.emailRecipientType || selectedNode.data?.emailRecipientType === 'system') && (
                          <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-3 space-y-3">
                            <div>
                              <label className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-1">Enviar para Grupos de Acesso</label>
                              <div className="text-[10px] text-neutral-500 mb-2 leading-tight">Selecione os grupos de acesso. O e-mail será enviado a todos os usuários pertencentes a eles.</div>
                              <div className="flex flex-wrap gap-2">
                                {roles.length > 0 ? roles.map(grupo => {
                                  const currentGroupsUsers = selectedNode.data?.emailGroupsUsers || {};
                                  const selection = currentGroupsUsers[grupo.name];
                                  const isSelected = !!selection;
                                  
                                  let statusText = '';
                                  if (isSelected) {
                                    statusText = selection === 'all' ? '(Todos)' : `(${selection.length} sel.)`;
                                  }

                                  return (
                                    <button
                                      key={grupo.id}
                                      onClick={() => openGroupUsersModal(grupo)}
                                      className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border flex items-center gap-1 ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20' : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-indigo-300'}`}
                                    >
                                      {grupo.name}
                                      {statusText && <span className={isSelected ? 'text-indigo-200 font-normal' : 'text-neutral-400 font-normal'}>{statusText}</span>}
                                    </button>
                                  );
                                }) : <span className="text-[10px] text-neutral-400">Nenhum grupo encontrado</span>}
                              </div>
                            </div>
                            
                            <div>
                              <label className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-1 mt-4">E-mails/IDs de Usuários Específicos</label>
                              <input 
                                type="text"
                                placeholder="Ex: admin@empresa.com, {{trigger.user_id}}"
                                value={(selectedNode.data?.emailSpecificUsers as string) || ''}
                                onChange={(e) => updateNodeData(selectedNode.id, { emailSpecificUsers: e.target.value })}
                                className="w-full bg-white dark:bg-neutral-900 border border-indigo-200 dark:border-indigo-900/50 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        )}

                        {selectedNode.data?.emailRecipientType === 'table' && (
                          <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800/50 rounded-xl p-3 space-y-3">
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
                            <div className="text-[10px] text-neutral-500 italic">
                              Dica: Defina Filtros (abaixo) para não enviar e-mails a todos os registros.
                            </div>
                            {renderActionFilters()}
                          </div>
                        )}

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

                    {selectedNode.data?.actionType === 'webhook' && (
                      <div className="space-y-4 pt-4 border-t border-indigo-500/20">
                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Método HTTP</label>
                          <select 
                            value={(selectedNode.data?.webhookMethod as string) || 'POST'} 
                            onChange={(e) => updateNodeData(selectedNode.id, { webhookMethod: e.target.value })}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 font-mono"
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                            <option value="DELETE">DELETE</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">URL da API</label>
                          <input 
                            type="text" 
                            placeholder="https://api.exemplo.com/v1/..."
                            value={(selectedNode.data?.webhookUrl as string) || ''} 
                            onChange={(e) => updateNodeData(selectedNode.id, { webhookUrl: e.target.value })}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1 flex items-center justify-between">
                            <span>Headers (JSON Opcional)</span>
                          </label>
                          <textarea 
                            rows={3}
                            placeholder={'{\n  "Authorization": "Bearer token"\n}'}
                            value={(selectedNode.data?.webhookHeaders as string) || ''} 
                            onChange={(e) => updateNodeData(selectedNode.id, { webhookHeaders: e.target.value })}
                            className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 resize-none font-mono text-[10px]"
                          />
                        </div>

                        {['POST', 'PUT', 'PATCH'].includes((selectedNode.data?.webhookMethod as string) || 'POST') && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-0">Body (JSON)</label>
                              <select 
                                value=""
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (!val) return;
                                  const currentText = (selectedNode.data?.webhookBody as string) || '';
                                  let newText = currentText + `{{${val}}}`;
                                  if (cursorPos && cursorPos.field === 'webhookBody') {
                                    newText = currentText.substring(0, cursorPos.start) + `{{${val}}}` + currentText.substring(cursorPos.end);
                                  }
                                  updateNodeData(selectedNode.id, { webhookBody: newText });
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
                              rows={6}
                              placeholder={'{\n  "cliente_id": "{{orders.customer_id}}"\n}'}
                              value={(selectedNode.data?.webhookBody as string) || ''} 
                              onChange={(e) => updateNodeData(selectedNode.id, { webhookBody: e.target.value })}
                              onBlur={(e) => setCursorPos({ field: 'webhookBody', start: e.target.selectionStart || 0, end: e.target.selectionEnd || 0 })}
                              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 resize-none font-mono text-[10px]"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Modal de Seleção de Usuários por Grupo */}
      <Modal
        isOpen={!!selectedGroupForModal}
        onClose={() => setSelectedGroupForModal(null)}
        title={`Usuários: ${selectedGroupForModal?.name}`}
        description="Selecione quais usuários deste grupo receberão o e-mail."
        size="md"
        zIndex={200}
      >
        <div className="space-y-4">
          {isLoadingGroupUsers ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-sm text-neutral-500">Buscando usuários...</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                <input
                  type="checkbox"
                  checked={selectedUsersInModal === 'all'}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUsersInModal('all');
                    } else {
                      setSelectedUsersInModal([]);
                    }
                  }}
                  className="w-4 h-4 text-indigo-600 rounded border-neutral-300 focus:ring-indigo-600"
                />
                <span className="text-sm font-bold text-neutral-900 dark:text-white">Enviar para Todos</span>
              </label>

              {groupUsers.length > 0 && (
                <div className="pt-2 pb-1 border-t border-neutral-100 dark:border-neutral-800">
                  <input
                    type="text"
                    placeholder="Buscar usuário por nome ou e-mail..."
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}

              {groupUsers.length > 0 ? (
                <div className="pt-2 space-y-2">
                  {groupUsers.filter(u => u.name?.toLowerCase().includes(modalSearchTerm.toLowerCase()) || u.email?.toLowerCase().includes(modalSearchTerm.toLowerCase())).map(u => {
                    const isChecked = selectedUsersInModal === 'all' || (Array.isArray(selectedUsersInModal) && selectedUsersInModal.includes(u.id));
                    return (
                      <label key={u.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${isChecked && selectedUsersInModal !== 'all' ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={selectedUsersInModal === 'all'}
                          onChange={(e) => {
                            if (selectedUsersInModal === 'all') return;
                            const current = Array.isArray(selectedUsersInModal) ? selectedUsersInModal : [];
                            if (e.target.checked) {
                              setSelectedUsersInModal([...current, u.id]);
                            } else {
                              setSelectedUsersInModal(current.filter(id => id !== u.id));
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 rounded border-neutral-300 focus:ring-indigo-600 disabled:opacity-50"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-neutral-900 dark:text-white">{u.name}</span>
                          {u.email && <span className="text-xs text-neutral-500">{u.email}</span>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-neutral-500 border border-dashed rounded-xl border-neutral-200 dark:border-neutral-800">
                  Nenhum usuário encontrado neste grupo.
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-neutral-100 dark:border-neutral-800 mt-4">
            <button
              onClick={() => {
                if (selectedNode && selectedGroupForModal) {
                  const currentGroupsUsers = { ...(selectedNode.data?.emailGroupsUsers || {}) };
                  delete currentGroupsUsers[selectedGroupForModal.name];
                  updateNodeData(selectedNode.id, { emailGroupsUsers: currentGroupsUsers });
                  setSelectedGroupForModal(null);
                }
              }}
              className="text-sm text-red-600 hover:text-red-700 font-medium px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Remover Grupo
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedGroupForModal(null)}
                className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (selectedNode && selectedGroupForModal) {
                    const currentGroupsUsers = { ...(selectedNode.data?.emailGroupsUsers || {}) };
                    currentGroupsUsers[selectedGroupForModal.name] = selectedUsersInModal;
                    updateNodeData(selectedNode.id, { emailGroupsUsers: currentGroupsUsers });
                    setSelectedGroupForModal(null);
                  }
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      </Modal>

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
