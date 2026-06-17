const fs = require('fs');
const path = require('path');

const panelsDir = 'src/components/studio/bpm/panels';
if (!fs.existsSync(panelsDir)) {
  fs.mkdirSync(panelsDir, { recursive: true });
}
const modalsDir = 'src/components/studio/bpm/modals';
if (!fs.existsSync(modalsDir)) {
  fs.mkdirSync(modalsDir, { recursive: true });
}

const lines = fs.readFileSync('src/components/studio/bpm/BpmCanvas.tsx', 'utf8').split('\n');

const triggerCode = lines.slice(489, 874).join('\n'); // 489 to 873
fs.writeFileSync(path.join(panelsDir, 'TriggerPropertiesPanel.tsx'), 
`import React from "react";
import { Check, Box, X } from "lucide-react";

export function TriggerPropertiesPanel(props: any) {
  const { selectedNode, updateNodeData, dbModels, dbFields, localViews, setLocalViews, currentWorkflowId, supabase, toast, t } = props;
  return (
    <>
${triggerCode}
    </>
  );
}
`);

const conditionCode = lines.slice(875, 1116).join('\n'); // 875 to 1115
fs.writeFileSync(path.join(panelsDir, 'ConditionPropertiesPanel.tsx'), 
`import React from "react";
import { Plus, Trash2, X } from "lucide-react";

export function ConditionPropertiesPanel(props: any) {
  const { selectedNode, updateNodeData, dbModels, dbFields, t } = props;
  return (
    <>
${conditionCode}
    </>
  );
}
`);

const actionCode = lines.slice(1117, 1552).join('\n'); // 1117 to 1551
fs.writeFileSync(path.join(panelsDir, 'ActionPropertiesPanel.tsx'), 
`import React from "react";
import { Check, Info, Loader2, X } from "lucide-react";
import RichTextEditor from "../RichTextEditor";

export function ActionPropertiesPanel(props: any) {
  const { selectedNode, updateNodeData, dbModels, dbFields, setCursorPos, roles, openGroupUsersModal, setEditingEmailNode, setTempEmailData, setIsPreviewEmailOpen, renderActionFilters, t } = props;
  return (
    <>
${actionCode}
    </>
  );
}
`);

const modalsCode = lines.slice(1559, 1877).join('\n');
fs.writeFileSync(path.join(modalsDir, 'BpmModals.tsx'), 
`import React from "react";
import { Loader2, Search, Users, X, Info } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export function BpmModals(props: any) {
  const {
    selectedGroupForModal,
    setSelectedGroupForModal,
    isLoadingGroupUsers,
    modalSearchTerm,
    setModalSearchTerm,
    groupUsers,
    selectedUsersInModal,
    setSelectedUsersInModal,
    updateNodeData,
    selectedNode,
    editingEmailNode,
    setEditingEmailNode,
    tempEmailData,
    setTempEmailData,
    isPreviewEmailOpen,
    setIsPreviewEmailOpen,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    confirmDelete,
    t
  } = props;

  return (
    <>
${modalsCode}
    </>
  );
}
`);

console.log('Files created successfully.');
