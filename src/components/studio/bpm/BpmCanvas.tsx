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

import { useBpmMetadata } from './hooks/useBpmMetadata';
import { useBpmWorkflows } from './hooks/useBpmWorkflows';
import { useBpmCanvasNodes } from './hooks/useBpmCanvasNodes';
import { useBpmEmailActions } from './hooks/useBpmEmailActions';


import { FlowSidebar } from './FlowSidebar';
import { TriggerNode, ActionNode, ConditionNode, ResponseNode } from './nodes/CustomNodes';
import RichTextEditor from './RichTextEditor';
import { Save, Play, Wand2, X, ArrowLeft, Loader2, Plus, Trash2, Check, Edit2, Box, Minimize2, Maximize2, ZoomIn, LayoutGrid } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BpmNodePropertiesSidebar } from './BpmNodePropertiesSidebar';
import { BpmModals } from './modals/BpmModals';
import { Modal } from '@/components/ui/Modal';
import ButtonEdge from './edges/ButtonEdge';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { wrapEmailInTemplate, EmailTemplateType } from '@/utils/emailTemplates';
import { useI18n } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  response: ResponseNode,
};

const edgeTypes = {
  buttonedge: ButtonEdge,
};

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'trigger',
    data: {},
    position: { x: 250, y: 50 },
  },
];


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
  const { t } = useI18n();
  console.log("=== BPM CANVAS INITIAL VIEWS ===", JSON.stringify(initialViews, null, 2));
  const projectId = project?.id;

  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();
  
  const [cursorPos, setCursorPos] = useState<{ field: 'actionSubject' | 'actionBody' | 'webhookBody', start: number, end: number } | null>(null);
  
  const scales = [
    { value: 0.8, icon: <Minimize2 className="w-3.5 h-3.5" />, label: t('runtime.scale_small', 'Pequeno') },
    { value: 1.0, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: t('runtime.scale_normal', 'Normal') },
    { value: 1.2, icon: <Maximize2 className="w-3.5 h-3.5" />, label: t('runtime.scale_large', 'Grande') },
    { value: 1.5, icon: <ZoomIn className="w-3.5 h-3.5" />, label: t('runtime.scale_xl', 'Extra Grande') }
  ];

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const {
    localViews,
    setLocalViews,
    dbModels,
    setDbModels,
    dbFields,
    setDbFields,
    enums,
    setEnums,
    roles,
    setRoles
  } = useBpmMetadata({
    project,
    initialViews,
    initialModels
  });

  const {
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
  } = useBpmCanvasNodes({
    initialNodes,
    defaultAutoAlign,
    toast,
    t,
    reactFlowWrapper
  });

  const {
    workflows,
    setWorkflows,
    currentWorkflowId,
    setCurrentWorkflowId,
    isSaving,
    isPublishing,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    handleSave,
    handlePublish,
    handleRename,
    handleDelete,
    confirmDelete
  } = useBpmWorkflows({
    initialWorkflows,
    projectId,
    useCaseId,
    project,
    reactFlowInstance,
    setNodes,
    setEdges,
    fitView,
    initialNodes,
    toast,
    t
  });

  const {
    selectedGroupForModal,
    setSelectedGroupForModal,
    groupUsers,
    setGroupUsers,
    isLoadingGroupUsers,
    setIsLoadingGroupUsers,
    selectedUsersInModal,
    setSelectedUsersInModal,
    modalSearchTerm,
    setModalSearchTerm,
    editingEmailNode,
    setEditingEmailNode,
    tempEmailData,
    setTempEmailData,
    isPreviewEmailOpen,
    setIsPreviewEmailOpen,
    openGroupUsersModal
  } = useBpmEmailActions({
    project,
    initialModels,
    selectedNode,
    reactFlowInstance,
    toast,
    t
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-neutral-950">
      <div className="h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.back()}
            className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            title={t('bpm.canvas.back')}
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
              <option value="new">{t('bpm.canvas.create_new_flow')}</option>
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
                title={t('bpm.canvas.rename_flow')}
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button 
                onClick={handleDelete}
                className="flex items-center gap-2 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl text-xs font-bold transition-all"
                title={t('bpm.canvas.delete_flow')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}

          <button 
            onClick={handleSave}
            disabled={isSaving || isPublishing}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('bpm.canvas.save_draft')}
          </button>
          <button 
            onClick={handlePublish}
            disabled={isSaving || isPublishing || currentWorkflowId === 'new'}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {t('bpm.canvas.publish')}
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
                title={t('bpm.canvas.auto_align_title')}
                className="px-4 py-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-2xl border border-indigo-200 dark:border-indigo-900/50 shadow-xl flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all hover:scale-105 active:scale-95"
              >
                <Wand2 className="w-5 h-5" />
                {t('bpm.canvas.auto_align')}
              </button>
            </Panel>
            
            {/* Custom Zoom Controls */}
            <Panel position="bottom-center" className="mb-6 z-50">
              <div className="flex items-center bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xl">
                {scales.map(s => (
                  <button
                    key={s.value}
                    onClick={() => handleZoom(s.value)}
                    title={s.label}
                    className={cn(
                      "p-2 rounded-xl transition-all",
                      scale === s.value 
                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                        : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    )}
                  >
                    {s.icon}
                  </button>
                ))}
              </div>
            </Panel>
          </ReactFlow>
        </div>

        <BpmNodePropertiesSidebar
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={setSelectedNodeId}
          selectedNode={selectedNode}
          updateNodeData={updateNodeData}
          dbModels={dbModels}
          dbFields={dbFields}
          localViews={localViews}
          setLocalViews={setLocalViews}
          currentWorkflowId={currentWorkflowId}
          supabase={supabase}
          toast={toast}
          setCursorPos={setCursorPos}
          roles={roles}
          openGroupUsersModal={openGroupUsersModal}
          setEditingEmailNode={setEditingEmailNode}
          setTempEmailData={setTempEmailData}
          setIsPreviewEmailOpen={setIsPreviewEmailOpen}
          t={t}
          enums={enums}
        />
      </div>

      <BpmModals
        selectedGroupForModal={selectedGroupForModal}
        setSelectedGroupForModal={setSelectedGroupForModal}
        isLoadingGroupUsers={isLoadingGroupUsers}
        modalSearchTerm={modalSearchTerm}
        setModalSearchTerm={setModalSearchTerm}
        groupUsers={groupUsers}
        selectedUsersInModal={selectedUsersInModal}
        setSelectedUsersInModal={setSelectedUsersInModal}
        updateNodeData={updateNodeData}
        selectedNode={selectedNode}
        editingEmailNode={editingEmailNode}
        setEditingEmailNode={setEditingEmailNode}
        tempEmailData={tempEmailData}
        setTempEmailData={setTempEmailData}
        isPreviewEmailOpen={isPreviewEmailOpen}
        setIsPreviewEmailOpen={setIsPreviewEmailOpen}
        isDeleteModalOpen={isDeleteModalOpen}
        setIsDeleteModalOpen={setIsDeleteModalOpen}
        confirmDelete={confirmDelete}
        t={t}
        cursorPos={cursorPos}
        setCursorPos={setCursorPos}
        dbModels={dbModels}
        dbFields={dbFields}
      />
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