import React from "react";
import { X } from "lucide-react";
import { TriggerPropertiesPanel } from "./panels/TriggerPropertiesPanel";
import { ActionPropertiesPanel } from "./panels/ActionPropertiesPanel";
import { ConditionPropertiesPanel } from "./panels/ConditionPropertiesPanel";
import { ResponsePropertiesPanel } from "./panels/ResponsePropertiesPanel";

export function BpmNodePropertiesSidebar(props: any) {
  const {
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    updateNodeData,
    dbModels,
    dbFields,
    localViews,
    setLocalViews,
    currentWorkflowId,
    supabase,
    toast,
    setCursorPos,
    roles,
    openGroupUsersModal,
    setEditingEmailNode,
    setTempEmailData,
    setIsPreviewEmailOpen,
    renderActionFilters,
    t,
    enums
  } = props;

  return (
    <div className={`w-96 h-full bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 transition-all duration-300 absolute right-0 top-0 z-40 flex flex-col shadow-2xl ${selectedNodeId ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
        <h3 className="font-bold text-sm tracking-tight text-neutral-900 dark:text-white">{t('bpm.canvas.node_properties')}</h3>
        <button onClick={() => setSelectedNodeId(null)} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {selectedNode && (
          <>
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">{t('bpm.canvas.label_optional')}</label>
              <input 
                type="text" 
                placeholder={t('bpm.canvas.leave_blank_auto')}
                value={(selectedNode.data?.label as string) || ''} 
                onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {selectedNode.type === 'trigger' && (
              <TriggerPropertiesPanel
                selectedNode={selectedNode}
                updateNodeData={updateNodeData}
                dbModels={dbModels}
                dbFields={dbFields}
                localViews={localViews}
                setLocalViews={setLocalViews}
                currentWorkflowId={currentWorkflowId}
                supabase={supabase}
                toast={toast}
                t={t}
                enums={enums}
              />
            )}

            {selectedNode.type === 'condition' && (
              <ConditionPropertiesPanel
                selectedNode={selectedNode}
                updateNodeData={updateNodeData}
                dbModels={dbModels}
                dbFields={dbFields}
                t={t}
              />
            )}

            {selectedNode.type === 'action' && (
              <ActionPropertiesPanel
                selectedNode={selectedNode}
                updateNodeData={updateNodeData}
                dbModels={dbModels}
                dbFields={dbFields}
                setCursorPos={setCursorPos}
                roles={roles}
                openGroupUsersModal={openGroupUsersModal}
                setEditingEmailNode={setEditingEmailNode}
                setTempEmailData={setTempEmailData}
                cursorPos={props.cursorPos}
                setIsPreviewEmailOpen={setIsPreviewEmailOpen}
                renderActionFilters={renderActionFilters}
                t={t}
                enums={enums}
              />
            )}

            {selectedNode.type === 'response' && (
              <ResponsePropertiesPanel
                selectedNode={selectedNode}
                updateNodeData={updateNodeData}
                t={t}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
