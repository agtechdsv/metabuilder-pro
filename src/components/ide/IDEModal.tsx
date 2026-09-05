'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LocalSyncManager } from '@/utils/localSyncManager'
import { useIDEFileSystem } from '@/contexts/ide/useIDEFileSystem'
import { useIDEFileOperations } from '@/contexts/ide/useIDEFileOperations'
import { useIDETabs } from '@/contexts/ide/useIDETabs'
import { useIDEGit } from '@/contexts/ide/useIDEGit'
import { useIDEServer } from '@/contexts/ide/useIDEServer'
import { useIDEConsole } from '@/contexts/ide/useIDEConsole'
import { IDEHeader } from './IDEHeader'
import { IDEFileExplorer } from './IDEFileExplorer'
import { IDEEditorArea } from './IDEEditorArea'
import { IDEConsolePanel } from './IDEConsolePanel'
import { IDEMinimizedBar } from './IDEMinimizedBar'
import { IDECommitModal } from './IDECommitModal'
import { IDEGitModals } from './IDEGitModals'
import { IDEFileActionModals } from './IDEFileActionModals'
import { IDEGitSettingsModal } from './IDEGitSettingsModal'
import { NativeExportModal } from './NativeExportModal'

export interface IDEModalProps {
  isOpen: boolean
  isMinimized: boolean
  setIsMinimized: (val: boolean) => void
  closeIDE: () => void
  target: { type: 'project' | 'workspace'; id: string; name: string; slug: string } | null
  syncManager: LocalSyncManager | null
  showSidebar: boolean
  setShowSidebar: React.Dispatch<React.SetStateAction<boolean>>
  showNativeExport: boolean
  setShowNativeExport: (val: boolean) => void
  consoleHeight: number
  ideLoadingState: { isLoading: boolean; message: string }
  isResizingExplorer: React.MutableRefObject<boolean>
  isResizingConsole: React.MutableRefObject<boolean>
  tabsContainerRef: React.RefObject<HTMLDivElement | null>
  monacoRef: React.MutableRefObject<any>
  handleMonacoBeforeMount: (monaco: any) => void
  handleResetProjectToCleanState: () => Promise<void>
  fs: ReturnType<typeof useIDEFileSystem>
  fileOps: ReturnType<typeof useIDEFileOperations>
  tabs: ReturnType<typeof useIDETabs>
  git: ReturnType<typeof useIDEGit>
  server: ReturnType<typeof useIDEServer>
  consoleState: ReturnType<typeof useIDEConsole>
}

export function IDEModal({
  isOpen,
  isMinimized,
  setIsMinimized,
  closeIDE,
  target,
  syncManager,
  showSidebar,
  setShowSidebar,
  showNativeExport,
  setShowNativeExport,
  consoleHeight,
  ideLoadingState,
  isResizingExplorer,
  isResizingConsole,
  tabsContainerRef,
  monacoRef,
  handleMonacoBeforeMount,
  handleResetProjectToCleanState,
  fs,
  fileOps,
  tabs,
  git,
  server,
  consoleState
}: IDEModalProps) {
  if (!isOpen || !target) {
    return (
      <IDEMinimizedBar
        isMinimized={isMinimized}
        target={target}
        setIsMinimized={setIsMinimized}
        closeIDE={closeIDE}
      />
    )
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{
            opacity: isMinimized ? 0 : 1,
            y: isMinimized ? '20%' : 0,
            scale: isMinimized ? 0.95 : 1
          }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className={`fixed inset-0 z-[99998] flex flex-col bg-[#1e1e1e] ${
            isMinimized ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
        >
          {/* Header */}
          <IDEHeader
            target={target}
            sandboxMode={git.sandboxMode}
            setShowDiscardConfirm={git.setShowDiscardConfirm}
            isDiscarding={git.isDiscarding}
            isConfirming={git.isConfirming}
            handleOpenCommitModal={git.handleOpenCommitModal}
            handleSyncFromWeb={git.handleSyncFromWeb}
            isSyncing={git.isSyncing}
            selectedBranch={git.selectedBranch}
            handleBranchChange={git.handleBranchChange}
            branches={git.branches}
            isCommitLoading={git.isCommitLoading}
            isCommitting={git.isCommitting}
            handlePushToRemote={git.handlePushToRemote}
            isPushing={git.isPushing}
            handlePullFromRemote={git.handlePullFromRemote}
            isPulling={git.isPulling}
            handleShowLogs={git.handleShowLogs}
            setShowGitSettings={git.setShowGitSettings}
            setShowNativeExport={setShowNativeExport}
            showConsole={consoleState.showConsole}
            setShowConsole={consoleState.setShowConsole}
            showSidebar={showSidebar}
            setShowSidebar={setShowSidebar}
            setIsMinimized={setIsMinimized}
            closeIDE={closeIDE}
          />

          {/* Main Content: Explorer + Editor */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">
            <div className="flex flex-1 min-h-0">
              <IDEFileExplorer
                showSidebar={showSidebar}
                explorerWidth={fs.explorerWidth}
                explorerActiveTab={fs.explorerActiveTab}
                setExplorerActiveTab={fs.setExplorerActiveTab}
                fileTree={fs.fileTree}
                selectedPaths={fs.selectedPaths}
                expandedFolders={fs.expandedFolders}
                clipboard={fs.clipboard}
                undoStack={fs.undoStack}
                handleUndo={fs.handleUndo}
                expandAll={fileOps.expandAll}
                collapseAll={fileOps.collapseAll}
                toggleFolder={fs.toggleFolder}
                handleSelection={fs.handleSelection}
                handleSelectFile={tabs.handleSelectFile}
                handleCopyPasteNode={fileOps.handleCopyPasteNode}
                setDeleteConfirm={fs.setDeleteConfirm}
                setCtxMenu={fs.setCtxMenu}
                isResizingExplorer={isResizingExplorer}
              />

              <IDEEditorArea
                openFiles={tabs.openFiles}
                activeFile={tabs.activeFile}
                setActiveFile={tabs.setActiveFile}
                activeFileRef={tabs.activeFileRef}
                tabsContainerRef={tabsContainerRef}
                isDirty={tabs.isDirty}
                handleCloseFile={tabs.handleCloseFile}
                setTabContextMenu={tabs.setTabContextMenu}
                target={target}
                handleSaveFile={tabs.handleSaveFile}
                handleSaveAll={tabs.handleSaveAll}
                fileContents={tabs.fileContents}
                setFileContents={tabs.setFileContents}
                isSyncing={git.isSyncing}
                ideLoadingState={ideLoadingState}
                monacoRef={monacoRef}
                handleMonacoBeforeMount={handleMonacoBeforeMount}
              />
            </div>

            {/* Console Bottom Panel */}
            <IDEConsolePanel
              showConsole={consoleState.showConsole}
              setShowConsole={consoleState.setShowConsole}
              consoleHeight={consoleHeight}
              isResizingConsole={isResizingConsole}
              handleInstall={server.handleInstall}
              isInstalling={server.isInstalling}
              devProcess={server.devProcess}
              isSyncing={git.isSyncing}
              handleStart={server.handleStart}
              handleStop={server.handleStop}
              isStoppingServer={server.isStoppingServer}
              handleOpenBrowser={server.handleOpenBrowser}
              clearConsole={consoleState.clearConsole}
              consoleLogs={consoleState.consoleLogs}
              consoleEndRef={consoleState.consoleEndRef}
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Floating Restore Button when minimized */}
      <IDEMinimizedBar
        isMinimized={isMinimized}
        target={target}
        setIsMinimized={setIsMinimized}
        closeIDE={closeIDE}
      />

      {/* Advanced Commit Modal */}
      <IDECommitModal
        isOpen={git.isCommitModalOpen}
        onClose={() => git.setIsCommitModalOpen(false)}
        modalMode={git.modalMode}
        changedFiles={git.changedFiles}
        setChangedFiles={git.setChangedFiles}
        selectedCommitFiles={git.selectedCommitFiles}
        setSelectedCommitFiles={git.setSelectedCommitFiles}
        isCommitLoading={git.isCommitLoading}
        setIsCommitLoading={git.setIsCommitLoading}
        syncManager={syncManager}
        target={target}
        fileContents={tabs.fileContents}
        setFileContents={tabs.setFileContents}
        setOriginalFileContents={tabs.setOriginalFileContents}
        loadFileTree={fs.loadFileTree}
        handleConfirmSync={git.handleConfirmSync}
        diffActiveFile={tabs.diffActiveFile}
        setDiffActiveFile={tabs.setDiffActiveFile}
        diffOriginalContent={tabs.diffOriginalContent}
        setDiffOriginalContent={tabs.setDiffOriginalContent}
        diffLocalContent={tabs.diffLocalContent}
        setDiffLocalContent={tabs.setDiffLocalContent}
        monacoRef={monacoRef}
      />

      {/* Git Log, Discard, Revert, New Branch Modals */}
      <IDEGitModals
        isOpen={isOpen}
        isLogModalOpen={git.isLogModalOpen}
        setIsLogModalOpen={git.setIsLogModalOpen}
        gitLogs={git.gitLogs}
        branches={git.branches}
        selectedBranch={git.selectedBranch}
        handleBranchChange={git.handleBranchChange}
        setRevertConfirmOid={git.setRevertConfirmOid}
        showDiscardConfirm={git.showDiscardConfirm}
        setShowDiscardConfirm={git.setShowDiscardConfirm}
        isDiscarding={git.isDiscarding}
        handleAbortSync={git.handleAbortSync}
        revertConfirmOid={git.revertConfirmOid}
        isReverting={git.isReverting}
        handleRevertCommit={git.handleRevertCommit}
        showNewBranchModal={git.showNewBranchModal}
        setShowNewBranchModal={git.setShowNewBranchModal}
        newBranchName={git.newBranchName}
        setNewBranchName={git.setNewBranchName}
        isCreatingBranch={git.isCreatingBranch}
        handleCreateBranchSubmit={git.handleCreateBranchSubmit}
      />

      {/* File Action Modals */}
      <IDEFileActionModals
        ctxMenu={fs.ctxMenu}
        setCtxMenu={fs.setCtxMenu}
        selectedPaths={fs.selectedPaths}
        getNodesFromPaths={fs.getNodesFromPaths}
        clipboard={fs.clipboard}
        setClipboard={fs.setClipboard}
        handleRestoreFromTrash={fs.handleRestoreFromTrash}
        handleCopyPasteNode={fileOps.handleCopyPasteNode}
        deleteConfirm={fs.deleteConfirm}
        setDeleteConfirm={fs.setDeleteConfirm}
        handleDeleteNode={fileOps.handleDeleteNode}
        handlePermanentDelete={fs.handlePermanentDelete}
        handleEmptyTrash={fs.handleEmptyTrash}
        fileActionModal={fs.fileActionModal}
        setFileActionModal={fs.setFileActionModal}
        fileActionInput={fs.fileActionInput}
        setFileActionInput={fs.setFileActionInput}
        fileActionLoading={fs.fileActionLoading}
        handleRenameNode={fileOps.handleRenameNode}
        handleNewItem={fileOps.handleNewItem}
        unsavedFilesPrompt={tabs.unsavedFilesPrompt}
        setUnsavedFilesPrompt={tabs.setUnsavedFilesPrompt}
        executeCloseFiles={tabs.executeCloseFiles}
        handleSaveFile={tabs.handleSaveFile}
        fileContents={tabs.fileContents}
        tabContextMenu={tabs.tabContextMenu}
        setTabContextMenu={tabs.setTabContextMenu}
        openFiles={tabs.openFiles}
        isDirty={tabs.isDirty}
        requestCloseFiles={tabs.requestCloseFiles}
      />

      {/* Git Settings Modal */}
      <IDEGitSettingsModal
        isOpen={git.showGitSettings}
        onClose={() => git.setShowGitSettings(false)}
        projectSlug={target?.slug || ''}
        onResetProject={handleResetProjectToCleanState}
      />

      {/* Native Export Modal */}
      <NativeExportModal
        isOpen={showNativeExport}
        onClose={() => setShowNativeExport(false)}
        projectSlug={target?.slug || ''}
        projectId={target?.id || ''}
      />
    </>
  )
}
