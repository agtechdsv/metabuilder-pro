const fs = require('fs');
const file = 'c:/AgTech/Apps/metabuilder-pro/src/contexts/IDESyncContext.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add modalMode state
content = content.replace(
  /const \[isCommitModalOpen, setIsCommitModalOpen\] = useState\(false\)/,
  \const [isCommitModalOpen, setIsCommitModalOpen] = useState(false)
    const [modalMode, setModalMode] = useState<'commit' | 'merge'>('commit')\
);

// 2. Modify handleOpenCommitModal signature and modalMode
content = content.replace(
  /const handleOpenCommitModal = async \(\) => \{([\s\S]*?)setIsCommitModalOpen\(true\);/m,
  \const handleOpenCommitModal = async (mode: 'commit' | 'merge' = 'commit') => {
      if (!syncManager) return;
      setIsCommitLoading(true);
      try {
        const files = await syncManager.getChangedFiles();
        if (files.length === 0) {
          toast(mode === 'commit' ? 'Nenhuma alteração local pendente.' : 'Nenhuma alteração para o merge.', 'info');
          return;
        }
        
        setChangedFiles(files);
        const allPaths = new Set(files.map(f => f.filepath));
        setSelectedCommitFiles(allPaths);
        
        // Auto-select the first file for the diff view
        if (files.length > 0) {
          const firstFile = files[0].filepath;
          setDiffActiveFile(firstFile);
          const originalContent = await syncManager.getFileHeadContent(firstFile);
          setDiffOriginalContent(originalContent);
          
          let localContent = '';
          const fullPath = target ? \\\AGTech/MetaBuilderPRO/\/\\\\ : firstFile;
          if (fileContents[fullPath] !== undefined) {
            localContent = fileContents[fullPath];
          } else {
            localContent = await syncManager.getFileLocalContent(firstFile);
          }
          setDiffLocalContent(localContent);
        }
        
        setModalMode(mode);
        setIsCommitModalOpen(true);\
);

// 3. Update handleConfirmSync to close modal and refresh tree
content = content.replace(
  /const handleConfirmSync = async \(\) => \{([\s\S]*?)toast\('Sincronizaçǜo Efetivada', 'success'\)/,
  \const handleConfirmSync = async () => {
      if (!syncManager) return
      setIsCommitting(true)
      try {
        await syncManager.confirmSync()
        setSandboxMode(false)
        setIsCommitModalOpen(false)
        await loadFileTree()
        toast('Sincronização Efetivada', 'success')\
);
// replace also the Finally block of handleConfirmSync to set isCommitting to false instead of isConfirming? Wait, handleConfirmSync uses setIsConfirming. Let's let it be. But we use isCommitting for the modal button disable state. Let's just set both.
content = content.replace(
  /setIsConfirming\(false\)/,
  \setIsConfirming(false)
        setIsCommitting(false)\
);

// 4. Update the sidebar button
content = content.replace(
  /onClick=\{handleConfirmSync\}/,
  \onClick={() => handleOpenCommitModal('merge')}\
);

// 5. Update the Modal JSX
content = content.replace(
  /<h2 className="text-xl font-bold text-white">\{t\('ide_commit_local\.title', 'Realizar Commit'\)\}<\/h2>/,
  \<h2 className="text-xl font-bold text-white">{modalMode === 'commit' ? t('ide_commit_local.title', 'Realizar Commit') : 'Revisar e Confirmar Merge'}</h2>\
);

content = content.replace(
  /\{modalMode === 'commit' \? t\('ide_commit_local\.title', 'Realizar Commit'\) : 'Revisar e Confirmar Merge'\}/,
  \{modalMode === 'commit' ? t('ide_commit_local.title', 'Realizar Commit') : 'Revisar e Confirmar Merge'}\
);

// Hide commit message in merge mode
content = content.replace(
  /<div className="p-4 border-b border-neutral-800 shrink-0">([\s\S]*?)<\/textarea>\s*<\/div>/,
  \<div className="p-4 border-b border-neutral-800 shrink-0">
                      {modalMode === 'commit' ? (
                        <>
                          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2">{t('ide_commit_local.commit_message', 'Mensagem do Commit')}</span>
                          <textarea 
                            value={commitMessage}
                            onChange={e => setCommitMessage(e.target.value)}
                            placeholder={t('ide_commit_local.commit_message_placeholder', 'Ex. Atualização de variáveis de ambiente...')}
                            className="w-full bg-[#1e1e1e] border border-neutral-700 rounded-lg p-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-indigo-500/50 resize-none h-[100px]"
                          ></textarea>
                        </>
                      ) : (
                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 text-sm text-indigo-200">
                          Revise as alterações geradas pelo Studio antes de efetivar o merge na sua branch local. Você pode reverter arquivos inteiros ou descartar trechos usando o visualizador de Diff.
                        </div>
                      )}
                    </div>\
);

// Update confirm button in modal
content = content.replace(
  /<button\s*onClick=\{handleCommitAdvanced\}\s*disabled=\{isCommitting \|\| selectedCommitFiles\.size === 0\}\s*className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500\/20"\s*>\s*\{isCommitting \? <Loader2 className="w-4 h-4 animate-spin" \/> : <CheckCircle2 className="w-4 h-4" \/>\}\s*\{t\('ide_commit_local\.confirm_commit', 'Confirmar Commit'\)\} \(\{selectedCommitFiles\.size\}\)\s*<\/button>/,
  \<button
                      onClick={modalMode === 'commit' ? handleCommitAdvanced : handleConfirmSync}
                      disabled={isCommitting || (modalMode === 'commit' && selectedCommitFiles.size === 0)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                    >
                      {isCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {modalMode === 'commit' ? \\ (\)\ : 'Efetivar Merge'}
                    </button>\
);

fs.writeFileSync(file, content);
