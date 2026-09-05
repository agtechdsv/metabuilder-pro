'use client'

import React, { useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2, CheckCircle2, X, Undo2, Plus, Pencil, Trash2,
  ChevronUp, ChevronDown, FileCode2
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n'
import { handleMonacoBeforeMount } from './ideUtils'

const MonacoDiffEditor = dynamic(
  () => import('@monaco-editor/react').then(mod => mod.DiffEditor),
  { ssr: false }
)

export interface IDECommitModalProps {
  isOpen: boolean
  onClose: () => void
  modalMode: 'commit' | 'merge'
  changedFiles: any[]
  setChangedFiles: React.Dispatch<React.SetStateAction<any[]>>
  selectedCommitFiles: Set<string>
  setSelectedCommitFiles: React.Dispatch<React.SetStateAction<Set<string>>>
  isCommitLoading: boolean
  setIsCommitLoading: (loading: boolean) => void
  syncManager: any
  target: { slug: string; id: string; name: string } | null
  fileContents: Record<string, string>
  setFileContents: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setOriginalFileContents: React.Dispatch<React.SetStateAction<Record<string, string>>>
  loadFileTree: () => Promise<void>
  handleConfirmSync: () => Promise<void>
  diffActiveFile: string | null
  setDiffActiveFile: React.Dispatch<React.SetStateAction<string | null>>
  diffOriginalContent: string
  setDiffOriginalContent: React.Dispatch<React.SetStateAction<string>>
  diffLocalContent: string
  setDiffLocalContent: React.Dispatch<React.SetStateAction<string>>
  monacoRef: React.MutableRefObject<any>
}

export function IDECommitModal({
  isOpen,
  onClose,
  modalMode,
  changedFiles,
  setChangedFiles,
  selectedCommitFiles,
  setSelectedCommitFiles,
  isCommitLoading,
  setIsCommitLoading,
  syncManager,
  target,
  fileContents,
  setFileContents,
  setOriginalFileContents,
  loadFileTree,
  handleConfirmSync,
  diffActiveFile,
  setDiffActiveFile,
  diffOriginalContent,
  setDiffOriginalContent,
  diffLocalContent,
  setDiffLocalContent,
  monacoRef
}: IDECommitModalProps) {
  const { t } = useI18n()
  const { toast } = useToast()

  const [commitMessage, setCommitMessage] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [revertLocalConfirm, setRevertLocalConfirm] = useState<string[] | null>(null)
  const [commitMenu, setCommitMenu] = useState<{ x: number; y: number } | null>(null)
  const [selectedListFiles, setSelectedListFiles] = useState<Set<string>>(new Set())

  const lastSelectedFileRef = useRef<string | null>(null)
  const diffRequestRef = useRef<string | null>(null)
  const diffSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const diffEditorRef = useRef<any>(null)

  const handleSelectDiffFile = async (filepath: string) => {
    if (!syncManager) return
    setDiffActiveFile(filepath)
    diffRequestRef.current = filepath

    try {
      const targetRef = modalMode === 'merge' ? 'local' : 'HEAD'
      const originalContent = await syncManager.getFileHeadContent(filepath, targetRef)
      if (diffRequestRef.current !== filepath) return
      setDiffOriginalContent(originalContent)

      let localContent = ''
      const fullPath = target ? `AGTech/MetaBuilderPRO/${target.slug}/${filepath}` : filepath
      if (fileContents[fullPath] !== undefined) {
        localContent = fileContents[fullPath]
      } else {
        localContent = await syncManager.getFileLocalContent(filepath)
      }

      if (diffRequestRef.current !== filepath) return
      setDiffLocalContent(localContent)
    } catch (err) {
      if (diffRequestRef.current !== filepath) return
      setDiffOriginalContent('')
      setDiffLocalContent('')
    }
  }

  const handleRevertFile = () => {
    setRevertLocalConfirm(Array.from(selectedListFiles))
    setCommitMenu(null)
  }

  const handleNextDiff = () => {
    if (!diffEditorRef.current) return
    const changes = diffEditorRef.current.getLineChanges()
    if (!changes || changes.length === 0) return

    const modifiedEditor = diffEditorRef.current.getModifiedEditor()
    const currentLine = modifiedEditor.getPosition()?.lineNumber || 1

    const nextChange = changes.find((c: any) => c.modifiedStartLineNumber > currentLine)

    if (nextChange) {
      modifiedEditor.setPosition({ lineNumber: nextChange.modifiedStartLineNumber, column: 1 })
      modifiedEditor.revealLineInCenter(nextChange.modifiedStartLineNumber)
    } else {
      modifiedEditor.setPosition({ lineNumber: changes[0].modifiedStartLineNumber, column: 1 })
      modifiedEditor.revealLineInCenter(changes[0].modifiedStartLineNumber)
    }
  }

  const handlePrevDiff = () => {
    if (!diffEditorRef.current) return
    const changes = diffEditorRef.current.getLineChanges()
    if (!changes || changes.length === 0) return

    const modifiedEditor = diffEditorRef.current.getModifiedEditor()
    const currentLine = modifiedEditor.getPosition()?.lineNumber || 1

    const prevChange = [...changes].reverse().find((c: any) => c.modifiedStartLineNumber < currentLine)

    if (prevChange) {
      modifiedEditor.setPosition({ lineNumber: prevChange.modifiedStartLineNumber, column: 1 })
      modifiedEditor.revealLineInCenter(prevChange.modifiedStartLineNumber)
    } else {
      const last = changes[changes.length - 1]
      modifiedEditor.setPosition({ lineNumber: last.modifiedStartLineNumber, column: 1 })
      modifiedEditor.revealLineInCenter(last.modifiedStartLineNumber)
    }
  }

  const confirmRevertFile = async () => {
    if (!syncManager || !revertLocalConfirm || revertLocalConfirm.length === 0) return
    const filepaths = revertLocalConfirm

    setIsCommitLoading(true)
    try {
      const targetRef = modalMode === 'merge' ? 'local' : 'HEAD'

      for (const filepath of filepaths) {
        await syncManager.revertFile(filepath, targetRef)

        setSelectedCommitFiles(prev => {
          const next = new Set(prev)
          next.delete(filepath)
          return next
        })

        const originalContent = await syncManager.getFileHeadContent(filepath, targetRef)
        const fullPath = target ? `AGTech/MetaBuilderPRO/${target.slug}/${filepath}` : filepath
        if (fileContents[fullPath] !== undefined) {
          setFileContents(prev => ({ ...prev, [fullPath]: originalContent }))
          setOriginalFileContents(prev => ({ ...prev, [fullPath]: originalContent }))
          if (monacoRef.current) {
            const models = monacoRef.current.editor.getModels()
            for (const m of models) {
              if (m.uri.toString().toLowerCase().includes(fullPath.toLowerCase())) {
                m.setValue(originalContent)
              }
            }
          }
        }

        setDiffActiveFile(curr => {
          if (curr === filepath) {
            setDiffOriginalContent('')
            setDiffLocalContent('')
            return null
          }
          return curr
        })
      }

      const newFiles = modalMode === 'commit'
        ? await syncManager.getChangedFiles()
        : await syncManager.getMergeDiffFiles()

      setChangedFiles(newFiles)
      setSelectedListFiles(new Set())
      lastSelectedFileRef.current = null
      toast(t('ide_commit_local.revert_success', 'Arquivo(s) revertido(s) com sucesso.'), 'success')
      await loadFileTree()
    } catch (err: any) {
      toast(`${t('ide_commit_local.revert_error', 'Erro ao reverter:')} ${err.message}`, 'error')
    } finally {
      setIsCommitLoading(false)
      setRevertLocalConfirm(null)
    }
  }

  const handleCommitAdvanced = async () => {
    if (!syncManager || !target) return
    if (!commitMessage.trim()) {
      toast('Digite uma mensagem de commit', 'error')
      return
    }
    if (selectedCommitFiles.size === 0) {
      toast('Selecione pelo menos um arquivo para commitar', 'error')
      return
    }

    setIsCommitting(true)
    try {
      const filesToCommit = Array.from(selectedCommitFiles)
      await syncManager.commitSelected(commitMessage, filesToCommit)
      toast('Commit realizado com sucesso!', 'success')
      onClose()
      setCommitMessage('')
      setDiffActiveFile(null)
      setDiffOriginalContent('')

      await loadFileTree()

      setOriginalFileContents(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(path => {
          const relPath = target ? path.replace(`AGTech/MetaBuilderPRO/${target.slug}/`, '') : path
          if (fileContents[path] !== undefined && selectedCommitFiles.has(relPath)) {
            next[path] = fileContents[path]
          }
        })
        return next
      })
    } catch (err: any) {
      toast(`Erro ao commitar: ${err.message}`, 'error')
    } finally {
      setIsCommitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
        >
          {revertLocalConfirm && (
            <div className="fixed inset-0 z-[100001] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#1e1e1e] border border-neutral-800 rounded-xl shadow-2xl p-6 max-w-sm w-full">
                <h3 className="text-lg font-bold text-white mb-2">
                  {t('ide_commit_local.revert_confirm_title', 'Confirmar Reversão')}
                </h3>
                <p className="text-sm text-neutral-400 mb-6">
                  {t('ide_commit_local.revert_confirm_desc', 'Tem certeza que deseja reverter as modificações no arquivo {filepath}?').replace(
                    '{filepath}',
                    revertLocalConfirm.length > 1 ? `${revertLocalConfirm.length} arquivos` : revertLocalConfirm[0]
                  )}
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setRevertLocalConfirm(null)}
                    className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
                    disabled={isCommitLoading}
                  >
                    {t('ide_commit_local.cancel', 'Cancelar')}
                  </button>
                  <button
                    onClick={confirmRevertFile}
                    className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center gap-2"
                    disabled={isCommitLoading}
                  >
                    {isCommitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {t('ide_commit_local.revert', 'Reverter Arquivo(s)')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {commitMenu && (
            <div
              className="fixed inset-0 z-[100000]"
              onClick={() => setCommitMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault()
                setCommitMenu(null)
              }}
            >
              <div
                className="absolute bg-[#1e1e1e] border border-neutral-700 rounded-lg shadow-2xl py-1 min-w-[160px] overflow-hidden"
                style={{ top: commitMenu.y, left: commitMenu.x }}
                onClick={e => e.stopPropagation()}
              >
                <button
                  className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-neutral-700/60 text-neutral-200 transition-colors text-sm text-left"
                  onClick={() => handleRevertFile()}
                >
                  <Undo2 className="w-3.5 h-3.5 text-blue-400" />
                  {t('ide_commit_local.revert', 'Reverter')} {selectedListFiles.size > 1 ? `(${selectedListFiles.size})` : ''}
                </button>
              </div>
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-[#0f0f0f] border border-neutral-800 rounded-xl shadow-2xl relative overflow-hidden w-[90vw] h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-indigo-500" />

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 shrink-0">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h2 className="text-xl font-bold text-white">
                  {modalMode === 'commit'
                    ? t('ide_commit_local.title', 'Realizar Commit')
                    : t('ide_commit_local.review_and_confirm_merge', 'Revisar e Confirmar Merge')}
                </h2>
              </div>
              <button
                onClick={onClose}
                disabled={isCommitting}
                className="text-neutral-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body - Split Pane */}
            <div className="flex-1 flex min-h-0">
              {/* Left Sidebar */}
              <div className="w-[350px] shrink-0 border-r border-neutral-800 flex flex-col bg-[#141414]">
                {/* Commit Message */}
                <div className="p-4 border-b border-neutral-800 shrink-0">
                  {modalMode === 'commit' ? (
                    <>
                      <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
                        {t('ide_commit_local.commit_message', 'Mensagem do Commit')}
                      </span>
                      <textarea
                        value={commitMessage}
                        onChange={e => setCommitMessage(e.target.value)}
                        placeholder={t(
                          'ide_commit_local.commit_message_placeholder',
                          'Ex. Atualização de variáveis de ambiente...'
                        )}
                        className="w-full bg-[#1e1e1e] border border-neutral-700 rounded-lg p-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-indigo-500/50 resize-none h-[100px]"
                      ></textarea>
                    </>
                  ) : (
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 text-sm text-indigo-200">
                      {t(
                        'ide_commit_local.merge_review_desc',
                        'Revise as alterações geradas pelo Studio antes de efetivar o merge na sua branch local. Você pode reverter arquivos inteiros ou descartar trechos usando o visualizador de Diff ao lado.'
                      )}
                    </div>
                  )}
                </div>

                {/* File List */}
                <div className="flex-1 overflow-y-auto p-2">
                  <div className="flex items-center justify-between px-2 mb-2">
                    <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      {t('ide_commit_local.changed_files', 'Arquivos Alterados')} ({changedFiles.length})
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedCommitFiles(new Set(changedFiles.map(f => f.filepath)))}
                        className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-1 rounded"
                      >
                        {t('ide_commit_local.all', 'All')}
                      </button>
                      <button
                        onClick={() => setSelectedCommitFiles(new Set())}
                        className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-1 rounded"
                      >
                        {t('ide_commit_local.none', 'None')}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {changedFiles.map(file => (
                      <div
                        key={file.filepath}
                        onClick={(e) => {
                          const newSet = new Set(selectedListFiles)
                          if (e.ctrlKey || e.metaKey) {
                            if (newSet.has(file.filepath)) newSet.delete(file.filepath)
                            else newSet.add(file.filepath)
                            setSelectedListFiles(newSet)
                            lastSelectedFileRef.current = file.filepath
                          } else if (e.shiftKey && lastSelectedFileRef.current) {
                            const files = changedFiles.map(f => f.filepath)
                            const startIdx = files.indexOf(lastSelectedFileRef.current)
                            const endIdx = files.indexOf(file.filepath)
                            const minIdx = Math.min(startIdx, endIdx)
                            const maxIdx = Math.max(startIdx, endIdx)
                            for (let i = minIdx; i <= maxIdx; i++) {
                              newSet.add(files[i])
                            }
                            setSelectedListFiles(newSet)
                          } else {
                            setSelectedListFiles(new Set([file.filepath]))
                            lastSelectedFileRef.current = file.filepath
                            handleSelectDiffFile(file.filepath)
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (!selectedListFiles.has(file.filepath)) {
                            setSelectedListFiles(new Set([file.filepath]))
                          }
                          setCommitMenu({ x: e.clientX, y: e.clientY })
                        }}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedListFiles.has(file.filepath)
                            ? 'bg-indigo-500/20 border border-indigo-500/30'
                            : 'hover:bg-neutral-800/50 border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCommitFiles.has(file.filepath)}
                          onChange={(e) => {
                            e.stopPropagation()
                            const newSet = new Set(selectedCommitFiles)
                            if (e.target.checked) newSet.add(file.filepath)
                            else newSet.delete(file.filepath)
                            setSelectedCommitFiles(newSet)
                          }}
                          className="w-4 h-4 rounded border-neutral-700 text-emerald-500 focus:ring-emerald-500/20 bg-neutral-900 cursor-pointer"
                        />
                        <div className="flex items-center justify-center w-5 h-5 rounded bg-neutral-800 shrink-0">
                          {file.status === 'added' && <Plus className="w-3 h-3 text-emerald-500" />}
                          {file.status === 'modified' && <Pencil className="w-3 h-3 text-amber-500" />}
                          {file.status === 'deleted' && <Trash2 className="w-3 h-3 text-red-500" />}
                        </div>
                        <span className="text-sm text-neutral-300 truncate select-none">
                          {file.filepath}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Content - Diff Editor */}
              <div className="flex-1 bg-[#1e1e1e] flex flex-col min-w-0">
                {diffActiveFile ? (
                  <>
                    <div className="p-3 border-b border-neutral-800 bg-[#181818] shrink-0 flex items-center justify-between">
                      <span className="text-sm font-medium text-neutral-300">
                        {diffActiveFile}
                      </span>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 border border-neutral-800 rounded bg-neutral-900/50 p-0.5">
                          <button
                            onClick={handlePrevDiff}
                            className="p-1 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                            title={t('ide_commit_local.prev_diff', 'Alteração Anterior')}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleNextDiff}
                            className="p-1 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                            title={t('ide_commit_local.next_diff', 'Próxima Alteração')}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                        <span className="text-xs text-neutral-500">
                          {t('ide_commit_local.head_vs_local', 'Original (HEAD) ↔ Local')}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 relative">
                      <MonacoDiffEditor
                        original={diffOriginalContent}
                        modified={diffLocalContent}
                        language={
                          diffActiveFile.split('.').pop() === 'tsx' || diffActiveFile.split('.').pop() === 'ts'
                            ? 'typescript'
                            : diffActiveFile.split('.').pop() === 'css'
                            ? 'css'
                            : 'javascript'
                        }
                        theme="vs-dark"
                        beforeMount={handleMonacoBeforeMount}
                        options={{
                          readOnly: false,
                          originalEditable: false,
                          renderSideBySide: true,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
                          fontSize: 13,
                          padding: { top: 16 }
                        }}
                        onMount={(editor, monaco) => {
                          monacoRef.current = monaco
                          diffEditorRef.current = editor
                          const modifiedEditor = editor.getModifiedEditor()
                          modifiedEditor.onDidChangeModelContent((e: any) => {
                            if (e.isFlush) return
                            const val = modifiedEditor.getValue()
                            const currentFile = diffRequestRef.current
                            if (currentFile) {
                              if (diffSaveTimeoutRef.current) clearTimeout(diffSaveTimeoutRef.current)
                              diffSaveTimeoutRef.current = setTimeout(async () => {
                                try {
                                  await syncManager?.saveFileLocalContent(currentFile, val)
                                  const fullPath = target
                                    ? `AGTech/MetaBuilderPRO/${target.slug}/${currentFile}`
                                    : currentFile
                                  setFileContents(prev => {
                                    if (prev[fullPath] !== undefined) {
                                      return { ...prev, [fullPath]: val }
                                    }
                                    return prev
                                  })
                                } catch (err) {
                                  console.error('Error saving partial revert:', err)
                                }
                              }, 500)
                            }
                          })
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-neutral-500">
                    <FileCode2 className="w-16 h-16 mb-4 opacity-20" />
                    <p>{t('ide_commit_local.select_file', 'Selecione um arquivo para ver as alterações')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Controls */}
            <div className="p-4 border-t border-neutral-800 flex justify-end gap-3 shrink-0 bg-[#0f0f0f]">
              <button
                onClick={onClose}
                disabled={isCommitting}
                className="px-4 py-2 bg-transparent hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {t('ide_commit_local.cancel', 'Cancelar')}
              </button>
              <button
                onClick={modalMode === 'commit' ? handleCommitAdvanced : handleConfirmSync}
                disabled={isCommitting || (modalMode === 'commit' && selectedCommitFiles.size === 0)}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {modalMode === 'commit'
                      ? t('ide_commit_local.committing', 'Commitando...')
                      : t('ide_commit_local.processing', 'Processando...')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {modalMode === 'commit'
                      ? `${t('ide_commit_local.confirm_commit', 'Confirmar Commit')} (${selectedCommitFiles.size})`
                      : t('ide_commit_local.apply_merge', 'Efetivar Merge')}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
