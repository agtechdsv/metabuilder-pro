const fs = require('fs');

const file = 'src/components/studio/bpm/BpmCanvas.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const imports = `import { BpmNodePropertiesSidebar } from './BpmNodePropertiesSidebar';
import { BpmModals } from './modals/BpmModals';`;

// Add imports
lines.splice(34, 0, imports);

// Remove `renderActionFilters` which is between lines 203 to 322.
// Find exact boundaries again just to be safe:
const renderActionStart = lines.findIndex(l => l.includes('const renderActionFilters = () => {'));
const renderActionEnd = lines.findIndex((l, i) => i > renderActionStart && l.includes('  return (')) - 1; // return ( is line 324

if (renderActionStart !== -1 && renderActionEnd !== -1) {
  lines.splice(renderActionStart, renderActionEnd - renderActionStart + 1);
}

// Sidebar Wrapper replacement
const sidebarStart = lines.findIndex(l => l.includes('className={`w-96 h-full bg-white dark:bg-neutral-900 border-l'));
const sidebarEnd = lines.findIndex((l, i) => i > sidebarStart && l === '      </div>' && lines[i+1] === '      ' && lines[i+2].includes('Modal de Seleção de Usuários'));

if (sidebarStart !== -1 && sidebarEnd !== -1) {
  const sidebarUsage = `        <BpmNodePropertiesSidebar
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
        />`;
  lines.splice(sidebarStart, sidebarEnd - sidebarStart + 1, sidebarUsage);
}

// Modals replacement
const modalsStart = lines.findIndex(l => l.includes('{/* Modal de Seleção de Usuários por Grupo */}'));
const modalsEnd = lines.length - 3; // until the end just before final </div>

if (modalsStart !== -1) {
  const modalsUsage = `      <BpmModals
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
      />`;
  lines.splice(modalsStart, modalsEnd - modalsStart + 1, modalsUsage);
}

fs.writeFileSync(file, lines.join('\n'));
console.log('BpmCanvas updated successfully.');
