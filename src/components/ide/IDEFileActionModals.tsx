'use client'

import React from 'react'
import {
  Trash2, Undo2, FilePlus, FolderPlus, ClipboardPaste,
  Pencil, Copy, Scissors, Folder, Loader2, CheckCircle2
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { homeDir } from '@tauri-apps/api/path'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n'
import { FileNode } from '@/contexts/ide/useIDEFileSystem'

export interface IDEFileActionModalsProps {
  ctxMenu: { x: number; y: number; node: FileNode } | null
  setCtxMenu: (val: { x: number; y: number; node: FileNode } | null) => void
  selectedPaths: Set<string>
  getNodesFromPaths: (paths: string[]) => FileNode[]
  clipboard: { nodes: FileNode[]; op: 'copy' | 'cut' } | null
  setClipboard: (val: { nodes: FileNode[]; op: 'copy' | 'cut' } | null) => void
  handleRestoreFromTrash: (nodes: FileNode[]) => void
  handleCopyPasteNode: (dest: FileNode) => Promise<void>
  deleteConfirm: { mode: 'trash' | 'permanent' | 'empty'; nodes?: FileNode[] } | null
  setDeleteConfirm: (val: { mode: 'trash' | 'permanent' | 'empty'; nodes?: FileNode[] } | null) => void
  handleDeleteNode: (nodes: FileNode[]) => Promise<void>
  handlePermanentDelete: (nodes: FileNode[]) => void
  handleEmptyTrash: () => void
  fileActionModal: { type: 'rename' | 'new-file' | 'new-folder' | 'copy' | 'move'; node?: FileNode; destPath?: string } | null
  setFileActionModal: (val: any) => void
  fileActionInput: string
  setFileActionInput: (val: string) => void
  fileActionLoading: boolean
  handleRenameNode: (node: FileNode, newName: string) => Promise<void>
  handleNewItem: (parentNode: FileNode, name: string, isDir: boolean) => Promise<void>
  unsavedFilesPrompt: { pathsToClose: string[]; dirtyPaths: string[] } | null
  setUnsavedFilesPrompt: (val: { pathsToClose: string[]; dirtyPaths: string[] } | null) => void
  executeCloseFiles: (paths: string[]) => void
  handleSaveFile: (content: string, path?: string) => Promise<void>
  fileContents: Record<string, string>
  tabContextMenu: { x: number; y: number; path: string } | null
  setTabContextMenu: (val: { x: number; y: number; path: string } | null) => void
  openFiles: string[]
  isDirty: (path: string) => boolean
  requestCloseFiles: (paths: string[]) => void
}

export function IDEFileActionModals({
  ctxMenu,
  setCtxMenu,
  selectedPaths,
  getNodesFromPaths,
  clipboard,
  setClipboard,
  handleRestoreFromTrash,
  handleCopyPasteNode,
  deleteConfirm,
  setDeleteConfirm,
  handleDeleteNode,
  handlePermanentDelete,
  handleEmptyTrash,
  fileActionModal,
  setFileActionModal,
  fileActionInput,
  setFileActionInput,
  fileActionLoading,
  handleRenameNode,
  handleNewItem,
  unsavedFilesPrompt,
  setUnsavedFilesPrompt,
  executeCloseFiles,
  handleSaveFile,
  fileContents,
  tabContextMenu,
  setTabContextMenu,
  openFiles,
  isDirty,
  requestCloseFiles
}: IDEFileActionModalsProps) {
  const { t } = useI18n()
  const { toast } = useToast()

  return (
    <>
      {/* Unsaved Files Prompt */}
      {unsavedFilesPrompt && (
        <div className="fixed inset-0 z-[100001] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-neutral-800 rounded-xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-white mb-2">Salvar alterações?</h3>
            <p className="text-sm text-neutral-400 mb-6">
              Você tem {unsavedFilesPrompt.dirtyPaths.length} arquivo(s) com alterações não salvas. Deseja salvar antes de fechar?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setUnsavedFilesPrompt(null)}
                className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  executeCloseFiles(unsavedFilesPrompt.pathsToClose)
                  setUnsavedFilesPrompt(null)
                }}
                className="px-4 py-2 text-sm bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors"
              >
                Descartar
              </button>
              <button
                onClick={async () => {
                  for (const p of unsavedFilesPrompt.dirtyPaths) {
                    await handleSaveFile(fileContents[p], p)
                  }
                  executeCloseFiles(unsavedFilesPrompt.pathsToClose)
                  setUnsavedFilesPrompt(null)
                }}
                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Context Menu */}
      {tabContextMenu && (
        <div
          className="fixed inset-0 z-[100000]"
          onClick={() => setTabContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault()
            setTabContextMenu(null)
          }}
        >
          <div
            className="absolute bg-[#1e1e1e] border border-neutral-700 rounded-lg shadow-2xl py-1 min-w-[160px] overflow-hidden"
            style={{ top: tabContextMenu.y, left: tabContextMenu.x }}
            onClick={e => e.stopPropagation()}
          >
            <button
              className="flex items-center w-full px-4 py-2 hover:bg-neutral-700/60 text-neutral-200 transition-colors text-sm text-left"
              onClick={() => {
                requestCloseFiles([tabContextMenu.path])
                setTabContextMenu(null)
              }}
            >
              Fechar
            </button>
            <button
              className="flex items-center w-full px-4 py-2 hover:bg-neutral-700/60 text-neutral-200 transition-colors text-sm text-left"
              onClick={() => {
                requestCloseFiles(openFiles)
                setTabContextMenu(null)
              }}
            >
              Fechar Todos
            </button>
            <button
              className="flex items-center w-full px-4 py-2 hover:bg-neutral-700/60 text-neutral-200 transition-colors text-sm text-left"
              onClick={() => {
                const savedFiles = openFiles.filter(p => !isDirty(p))
                requestCloseFiles(savedFiles)
                setTabContextMenu(null)
              }}
            >
              Fechar Salvos
            </button>
            <div className="border-t border-neutral-700 my-1" />
            <button
              className="flex items-center w-full px-4 py-2 hover:bg-neutral-700/60 text-neutral-200 transition-colors text-sm text-left"
              onClick={() => {
                const idx = openFiles.indexOf(tabContextMenu.path)
                requestCloseFiles(openFiles.slice(idx + 1))
                setTabContextMenu(null)
              }}
            >
              Fechar Todos à Direita
            </button>
            <button
              className="flex items-center w-full px-4 py-2 hover:bg-neutral-700/60 text-neutral-200 transition-colors text-sm text-left"
              onClick={() => {
                const idx = openFiles.indexOf(tabContextMenu.path)
                requestCloseFiles(openFiles.slice(0, idx))
                setTabContextMenu(null)
              }}
            >
              Fechar Todos à Esquerda
            </button>
            <button
              className="flex items-center w-full px-4 py-2 hover:bg-neutral-700/60 text-neutral-200 transition-colors text-sm text-left"
              onClick={() => {
                requestCloseFiles(openFiles.filter(p => p !== tabContextMenu.path))
                setTabContextMenu(null)
              }}
            >
              Fechar Outros
            </button>
          </div>
        </div>
      )}

      {/* Explorer File Context Menu */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-[100000]" onClick={() => setCtxMenu(null)} />
          <div
            className="fixed z-[100001] bg-[#1e1e1e] border border-neutral-700 rounded-xl shadow-2xl py-1.5 w-52 text-sm"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            {(() => {
              const selectedArray = Array.from(selectedPaths)
              const selectedNodes = getNodesFromPaths(selectedArray)

              const isTrashRoot = ctxMenu.node.name === '.trash' && ctxMenu.node.isDirectory
              const isInTrash = ctxMenu.node.path.includes('/.trash/')

              if (isTrashRoot) {
                return (
                  <button
                    className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-red-900/40 text-red-400 transition-colors"
                    onClick={() => {
                      setDeleteConfirm({ mode: 'empty' })
                      setCtxMenu(null)
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {t('workspace_components.ide_local.empty_trash', 'Esvaziar Lixeira')}
                  </button>
                )
              }

              if (isInTrash) {
                return (
                  <>
                    <button
                      className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-emerald-900/40 text-emerald-400 transition-colors"
                      onClick={() => {
                        handleRestoreFromTrash(selectedNodes)
                        setCtxMenu(null)
                      }}
                    >
                      <Undo2 className="w-3.5 h-3.5" /> {t('workspace_components.ide_local.restore', 'Recuperar')}{' '}
                      {selectedNodes.length > 1 ? `(${selectedNodes.length})` : ''}
                    </button>
                    <div className="border-t border-neutral-700 my-1" />
                    <button
                      className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-red-900/40 text-red-400 transition-colors"
                      onClick={() => {
                        setDeleteConfirm({ mode: 'permanent', nodes: selectedNodes })
                        setCtxMenu(null)
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {t('workspace_components.ide_local.delete_permanent', 'Excluir Permanentemente')}
                    </button>
                  </>
                )
              }

              return (
                <>
                  {ctxMenu.node.isDirectory && selectedNodes.length <= 1 && (
                    <>
                      <button
                        className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-neutral-700/60 text-neutral-200 transition-colors"
                        onClick={() => {
                          setFileActionModal({ type: 'new-file', node: ctxMenu.node })
                          setFileActionInput('')
                          setCtxMenu(null)
                        }}
                      >
                        <FilePlus className="w-3.5 h-3.5 text-blue-400" /> {t('workspace_components.ide_local.new_file', 'Novo Arquivo')}
                      </button>
                      <button
                        className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-neutral-700/60 text-neutral-200 transition-colors"
                        onClick={() => {
                          setFileActionModal({ type: 'new-folder', node: ctxMenu.node })
                          setFileActionInput('')
                          setCtxMenu(null)
                        }}
                      >
                        <FolderPlus className="w-3.5 h-3.5 text-yellow-400" /> {t('workspace_components.ide_local.new_folder', 'Nova Pasta')}
                      </button>
                      {clipboard && (
                        <button
                          className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-indigo-700/40 text-indigo-300 transition-colors"
                          onClick={() => {
                            handleCopyPasteNode(ctxMenu.node)
                            setCtxMenu(null)
                          }}
                        >
                          <ClipboardPaste className="w-3.5 h-3.5" /> {t('workspace_components.ide_local.paste_here', 'Colar aqui')}{' '}
                          {clipboard.nodes.length > 1 ? `(${clipboard.nodes.length})` : ''}
                        </button>
                      )}
                      <div className="border-t border-neutral-700 my-1" />
                    </>
                  )}
                  {selectedNodes.length <= 1 && (
                    <button
                      className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-neutral-700/60 text-neutral-200 transition-colors"
                      onClick={() => {
                        setFileActionModal({ type: 'rename', node: ctxMenu.node })
                        setFileActionInput(ctxMenu.node.name)
                        setCtxMenu(null)
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5 text-emerald-400" /> {t('workspace_components.ide_local.rename', 'Renomear')}
                    </button>
                  )}
                  <button
                    className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-neutral-700/60 text-neutral-200 transition-colors"
                    onClick={() => {
                      setClipboard({ nodes: selectedNodes, op: 'copy' })
                      setCtxMenu(null)
                    }}
                  >
                    <Copy className="w-3.5 h-3.5 text-sky-400" /> {t('workspace_components.ide_local.copy', 'Copiar')}{' '}
                    {selectedNodes.length > 1 ? `(${selectedNodes.length})` : ''}
                  </button>
                  <button
                    className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-neutral-700/60 text-neutral-200 transition-colors"
                    onClick={() => {
                      setClipboard({ nodes: selectedNodes, op: 'cut' })
                      setCtxMenu(null)
                    }}
                  >
                    <Scissors className="w-3.5 h-3.5 text-orange-400" /> {t('workspace_components.ide_local.cut', 'Recortar')}{' '}
                    {selectedNodes.length > 1 ? `(${selectedNodes.length})` : ''}
                  </button>
                  <div className="border-t border-neutral-700 my-1" />
                  <button
                    className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-neutral-700/60 text-neutral-200 transition-colors"
                    onClick={async () => {
                      try {
                        const home = await homeDir()
                        const targetPath = ctxMenu.node.isDirectory
                          ? ctxMenu.node.path
                          : ctxMenu.node.path.substring(0, ctxMenu.node.path.lastIndexOf('/'))
                        const absolutePath = `${home.replace(/\\/g, '/')}/${targetPath}`
                        await invoke('open_in_explorer', { path: absolutePath })
                        setCtxMenu(null)
                      } catch (e: any) {
                        toast('Erro ao abrir no explorer: ' + (e?.message || String(e)), 'error')
                      }
                    }}
                  >
                    <Folder className="w-3.5 h-3.5 text-blue-400" /> {t('workspace_components.ide_local.open_explorer', 'Abrir no Explorer')}
                  </button>
                  <button
                    className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-red-900/40 text-red-400 transition-colors"
                    onClick={() => {
                      setDeleteConfirm({ mode: 'trash', nodes: selectedNodes })
                      setCtxMenu(null)
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {t('workspace_components.ide_local.delete', 'Deletar')}{' '}
                    {selectedNodes.length > 1 ? `(${selectedNodes.length} itens)` : ctxMenu.node.isDirectory ? 'Pasta' : 'Arquivo'}
                  </button>
                </>
              )
            })()}
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 outline-none"
          tabIndex={0}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (deleteConfirm.mode === 'trash' && deleteConfirm.nodes) handleDeleteNode(deleteConfirm.nodes)
              if (deleteConfirm.mode === 'permanent' && deleteConfirm.nodes) handlePermanentDelete(deleteConfirm.nodes)
              if (deleteConfirm.mode === 'empty') handleEmptyTrash()
              setDeleteConfirm(null)
            }
            if (e.key === 'Escape') {
              setDeleteConfirm(null)
            }
          }}
        >
          <div className="bg-[#1e1e1e] border border-neutral-800 rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 rounded-full bg-red-900/20 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              {deleteConfirm.mode === 'empty'
                ? t('workspace_components.ide_local.empty_trash', 'Esvaziar Lixeira')
                : t('workspace_components.ide_local.confirm_delete_title', 'Confirmar Exclusão')}
            </h3>

            {deleteConfirm.mode === 'empty' ? (
              <p className="text-sm text-neutral-400 mb-4">
                Você está prestes a deletar todos os itens da lixeira permanentemente. Esta ação não pode ser desfeita.
              </p>
            ) : (
              <>
                <p className="text-sm text-neutral-400 mb-1">
                  Você está prestes a {deleteConfirm.mode === 'permanent' ? 'deletar permanentemente:' : 'deletar:'}
                </p>
                {deleteConfirm.nodes && deleteConfirm.nodes.length === 1 ? (
                  <p className="text-sm font-mono text-red-300 bg-red-900/10 rounded px-3 py-1.5 mb-3 break-all">
                    {deleteConfirm.nodes[0].name}
                  </p>
                ) : (
                  <p className="text-sm font-mono text-red-300 bg-red-900/10 rounded px-3 py-1.5 mb-3 break-all">
                    {deleteConfirm.nodes?.length} itens selecionados
                  </p>
                )}

                {deleteConfirm.mode === 'trash' && deleteConfirm.nodes?.some(n => n.isDirectory) && (
                  <p className="text-xs text-amber-400 bg-amber-900/20 rounded px-3 py-2 mb-4">
                    ⚠️ Todos os arquivos, subpastas e seu conteúdo serão movidos para a Lixeira.
                  </p>
                )}

                {deleteConfirm.mode === 'permanent' && (
                  <p className="text-xs text-red-400 bg-red-900/20 rounded px-3 py-2 mb-4">
                    ⚠️ Os itens serão removidos permanentemente. Esta ação não pode ser desfeita.
                  </p>
                )}
              </>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={fileActionLoading}
                className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                {t('workspace_components.ide_local.cancel', 'Cancelar')}
              </button>
              <button
                onClick={() => {
                  if (deleteConfirm.mode === 'trash' && deleteConfirm.nodes) handleDeleteNode(deleteConfirm.nodes)
                  if (deleteConfirm.mode === 'permanent' && deleteConfirm.nodes) handlePermanentDelete(deleteConfirm.nodes)
                  if (deleteConfirm.mode === 'empty') handleEmptyTrash()
                  setDeleteConfirm(null)
                }}
                disabled={fileActionLoading}
                className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-all disabled:opacity-50"
              >
                {fileActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleteConfirm.mode === 'empty' ? 'Esvaziar' : 'Deletar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename / New File / New Folder Modal */}
      {fileActionModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-neutral-800 rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              {fileActionModal.type === 'rename' && t('workspace_components.ide_local.rename', 'Renomear')}
              {fileActionModal.type === 'new-file' && t('workspace_components.ide_local.new_file', 'Novo Arquivo')}
              {fileActionModal.type === 'new-folder' && t('workspace_components.ide_local.new_folder', 'Nova Pasta')}
            </h3>
            <p className="text-xs text-neutral-500 mb-2">
              {fileActionModal.type === 'rename' && `Renomear "${fileActionModal.node?.name}"`}
              {fileActionModal.type === 'new-file' && `Criar dentro de "${fileActionModal.node?.name}"`}
              {fileActionModal.type === 'new-folder' && `Criar dentro de "${fileActionModal.node?.name}"`}
            </p>
            <input
              autoFocus
              type="text"
              value={fileActionInput}
              onChange={e => setFileActionInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (fileActionModal.type === 'rename' && fileActionModal.node) {
                    handleRenameNode(fileActionModal.node, fileActionInput)
                  }
                  if ((fileActionModal.type === 'new-file' || fileActionModal.type === 'new-folder') && fileActionModal.node) {
                    handleNewItem(fileActionModal.node, fileActionInput, fileActionModal.type === 'new-folder')
                  }
                }
                if (e.key === 'Escape') setFileActionModal(null)
              }}
              placeholder={
                fileActionModal.type === 'rename'
                  ? 'Novo nome...'
                  : fileActionModal.type === 'new-file'
                  ? 'nome-do-arquivo.ts'
                  : 'nome-da-pasta'
              }
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setFileActionModal(null)}
                className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                {t('workspace_components.ide_local.cancel', 'Cancelar')}
              </button>
              <button
                onClick={() => {
                  if (fileActionModal.type === 'rename' && fileActionModal.node) {
                    handleRenameNode(fileActionModal.node, fileActionInput)
                  }
                  if ((fileActionModal.type === 'new-file' || fileActionModal.type === 'new-folder') && fileActionModal.node) {
                    handleNewItem(fileActionModal.node, fileActionInput, fileActionModal.type === 'new-folder')
                  }
                }}
                disabled={!fileActionInput.trim() || fileActionLoading}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-all disabled:opacity-50"
              >
                {fileActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {fileActionModal.type === 'rename' ? t('workspace_components.ide_local.rename', 'Renomear') : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
