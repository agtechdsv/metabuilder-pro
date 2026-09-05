'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Network, Trash2, Undo, UnfoldVertical, FoldVertical,
  ChevronDown, ChevronRight, Folder, FileCode2, ClipboardPaste, MoreVertical
} from 'lucide-react'
import { useI18n } from '@/i18n'
import { FileNode } from '@/contexts/ide/useIDEFileSystem'

export interface IDEFileExplorerProps {
  showSidebar: boolean
  explorerWidth: number
  explorerActiveTab: 'explorer' | 'trash'
  setExplorerActiveTab: (tab: 'explorer' | 'trash') => void
  fileTree: FileNode[]
  selectedPaths: Set<string>
  expandedFolders: Set<string>
  clipboard: { nodes: FileNode[]; op: 'copy' | 'cut' } | null
  undoStack: any[]
  handleUndo: () => void
  expandAll: () => void
  collapseAll: () => void
  toggleFolder: (path: string, modifier?: 'ctrl' | 'shift') => void
  handleSelection: (path: string) => void
  handleSelectFile: (path: string, modifier?: 'ctrl' | 'shift') => void
  handleCopyPasteNode: (dest: FileNode) => Promise<void>
  setDeleteConfirm: (val: any) => void
  setCtxMenu: (val: any) => void
  isResizingExplorer: React.MutableRefObject<boolean>
}

export function IDEFileExplorer({
  showSidebar,
  explorerWidth,
  explorerActiveTab,
  setExplorerActiveTab,
  fileTree,
  selectedPaths,
  expandedFolders,
  clipboard,
  undoStack,
  handleUndo,
  expandAll,
  collapseAll,
  toggleFolder,
  handleSelection,
  handleSelectFile,
  handleCopyPasteNode,
  setDeleteConfirm,
  setCtxMenu,
  isResizingExplorer
}: IDEFileExplorerProps) {
  const { t } = useI18n()

  const renderTree = (nodes: FileNode[], depth: number = 0): React.ReactNode => {
    let visibleNodes = nodes
    if (depth === 0) {
      if (explorerActiveTab === 'explorer') {
        visibleNodes = nodes.filter(n => n.name !== '.trash')
      } else {
        const trashNode = nodes.find(n => n.name === '.trash')
        visibleNodes = trashNode?.children || []
      }
    }

    return visibleNodes.map(node => {
      const isSelected = selectedPaths.has(node.path)
      const isTrashNode = node.name === '.trash'
      const displayNodeName = isTrashNode ? '🗑️ Lixeira' : node.name
      return (
        <div key={node.path} className={depth === 0 ? '' : 'ml-4'}>
          {node.isDirectory ? (
            <div>
              <div
                className={`group flex items-center gap-1.5 py-1 px-2 hover:bg-neutral-800/50 cursor-pointer rounded text-neutral-300 text-sm ${
                  clipboard?.nodes.find(n => n.path === node.path) && clipboard.op === 'cut' ? 'opacity-50' : ''
                } ${isSelected ? 'bg-indigo-600/20 text-indigo-400' : ''}`}
                onClick={(e) => toggleFolder(node.path, e.ctrlKey ? 'ctrl' : e.shiftKey ? 'shift' : undefined)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  if (!selectedPaths.has(node.path)) {
                    handleSelection(node.path)
                  }
                  setCtxMenu({ x: e.clientX, y: e.clientY, node })
                }}
              >
                {expandedFolders.has(node.path) ? (
                  <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                {!isTrashNode && <Folder className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                <span className={`truncate flex-1 ${isTrashNode ? 'text-red-400 font-bold' : ''}`}>
                  {displayNodeName}
                </span>
                {clipboard && !isTrashNode && (
                  <button
                    className="opacity-0 group-hover:opacity-100 ml-auto p-0.5 rounded hover:bg-indigo-600/30 text-indigo-400 flex-shrink-0"
                    title="Colar aqui"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCopyPasteNode(node)
                    }}
                  >
                    <ClipboardPaste className="w-3 h-3" />
                  </button>
                )}
                <button
                  className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded hover:bg-neutral-700"
                  title="Mais ações"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!selectedPaths.has(node.path)) handleSelection(node.path)
                    setCtxMenu({
                      x: e.currentTarget.getBoundingClientRect().right,
                      y: e.currentTarget.getBoundingClientRect().bottom,
                      node
                    })
                  }}
                >
                  <MoreVertical className="w-3 h-3 text-neutral-500" />
                </button>
              </div>
              {expandedFolders.has(node.path) && node.children && (
                <div>{renderTree(node.children, depth + 1)}</div>
              )}
            </div>
          ) : (
            <div
              className={`group flex items-center gap-1.5 py-1 px-2 ml-4 cursor-pointer rounded text-sm ${
                isSelected ? 'bg-indigo-600/20 text-indigo-400' : 'text-neutral-400 hover:bg-neutral-800/50'
              } ${clipboard?.nodes.find(n => n.path === node.path) && clipboard.op === 'cut' ? 'opacity-50' : ''}`}
              onClick={(e) => handleSelectFile(node.path, e.ctrlKey ? 'ctrl' : e.shiftKey ? 'shift' : undefined)}
              onContextMenu={(e) => {
                e.preventDefault()
                if (!selectedPaths.has(node.path)) handleSelection(node.path)
                setCtxMenu({ x: e.clientX, y: e.clientY, node })
              }}
            >
              <FileCode2 className="w-3.5 h-3.5 opacity-70 flex-shrink-0" />
              <span className="truncate flex-1">{node.name}</span>
              <button
                className="opacity-0 group-hover:opacity-100 ml-auto p-0.5 rounded hover:bg-neutral-700 flex-shrink-0"
                title="Mais ações"
                onClick={(e) => {
                  e.stopPropagation()
                  if (!selectedPaths.has(node.path)) handleSelection(node.path)
                  setCtxMenu({
                    x: e.currentTarget.getBoundingClientRect().right,
                    y: e.currentTarget.getBoundingClientRect().bottom,
                    node
                  })
                }}
              >
                <MoreVertical className="w-3 h-3 text-neutral-500" />
              </button>
            </div>
          )}
        </div>
      )
    })
  }

  return (
    <>
      <AnimatePresence initial={false}>
        {showSidebar && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: explorerWidth, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="border-r border-neutral-800 bg-[#181818] overflow-y-auto overflow-x-hidden shrink-0 flex flex-col"
          >
            {/* Explorer Header / Tabs */}
            <div className="flex items-center justify-between border-b border-neutral-800/60 shrink-0">
              <div className="flex items-center h-full">
                <button
                  onClick={() => setExplorerActiveTab('explorer')}
                  className={`px-2.5 py-1.5 h-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 border-r border-neutral-800/60 transition-colors ${
                    explorerActiveTab === 'explorer'
                      ? 'text-indigo-400 bg-neutral-800/30'
                      : 'text-neutral-500 hover:bg-neutral-800/20'
                  }`}
                >
                  <Network className="w-3 h-3" /> {t('workspace_components.ide_local.explorer', 'Explorer')}
                </button>
                <button
                  onClick={() => setExplorerActiveTab('trash')}
                  className={`px-2.5 py-1.5 h-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 border-r border-neutral-800/60 transition-colors ${
                    explorerActiveTab === 'trash'
                      ? 'text-red-400 bg-red-900/10'
                      : 'text-neutral-500 hover:bg-neutral-800/20'
                  }`}
                >
                  <Trash2 className="w-3 h-3" /> {t('workspace_components.ide_local.trash', 'Lixeira')}
                </button>
              </div>
              <div className="flex items-center gap-0.5 px-2">
                {explorerActiveTab === 'trash' &&
                  (fileTree.find(n => n.name === '.trash')?.children?.length || 0) > 0 && (
                    <button
                      onClick={() => setDeleteConfirm({ mode: 'empty' })}
                      title={t('workspace_components.ide_local.empty_trash', 'Esvaziar Lixeira')}
                      className="flex items-center justify-center w-5 h-5 rounded hover:bg-red-900/40 text-red-400 hover:text-red-300 transition-colors mr-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                {undoStack.length > 0 && (
                  <button
                    onClick={handleUndo}
                    title={t('workspace_components.ide_local.undo_tooltip', 'Desfazer (Ctrl+Z)')}
                    className="flex items-center justify-center w-5 h-5 rounded hover:bg-neutral-700 text-indigo-400 hover:text-indigo-300 transition-colors mr-1"
                  >
                    <Undo className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={expandAll}
                  title={t('workspace_components.ide_local.expand_all', 'Expandir tudo')}
                  className="flex items-center justify-center w-5 h-5 rounded hover:bg-neutral-700 text-neutral-500 hover:text-neutral-200 transition-colors"
                >
                  <UnfoldVertical className="w-3 h-3" />
                </button>
                <button
                  onClick={collapseAll}
                  title={t('workspace_components.ide_local.collapse_all', 'Retrair tudo')}
                  className="flex items-center justify-center w-5 h-5 rounded hover:bg-neutral-700 text-neutral-500 hover:text-neutral-200 transition-colors"
                >
                  <FoldVertical className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-1 select-none">
              {renderTree(fileTree)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Horizontal Drag Handle (Explorer vs Editor) */}
      {showSidebar && (
        <div
          className="w-1 cursor-col-resize hover:bg-indigo-500/50 transition-colors shrink-0 z-10"
          onMouseDown={() => {
            isResizingExplorer.current = true
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
          }}
        />
      )}
    </>
  )
}
