'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { ChevronLeft, ChevronRight, X, Save, CopyCheck } from 'lucide-react'
import { useI18n } from '@/i18n'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

export interface IDEEditorAreaProps {
  openFiles: string[]
  activeFile: string | null
  setActiveFile: (path: string) => void
  activeFileRef: React.MutableRefObject<string | null>
  tabsContainerRef: React.RefObject<HTMLDivElement | null>
  isDirty: (path: string) => boolean
  handleCloseFile: (e: React.MouseEvent, path: string) => void
  setTabContextMenu: (val: { x: number; y: number; path: string } | null) => void
  target: { slug: string } | null
  handleSaveFile: (content: string, path?: string) => Promise<void>
  handleSaveAll: () => Promise<void>
  fileContents: Record<string, string>
  setFileContents: React.Dispatch<React.SetStateAction<Record<string, string>>>
  isSyncing: boolean
  ideLoadingState: { isLoading: boolean; message: string }
  monacoRef: React.MutableRefObject<any>
  handleMonacoBeforeMount: (monaco: any) => void
}

export function IDEEditorArea({
  openFiles,
  activeFile,
  setActiveFile,
  activeFileRef,
  tabsContainerRef,
  isDirty,
  handleCloseFile,
  setTabContextMenu,
  target,
  handleSaveFile,
  handleSaveAll,
  fileContents,
  setFileContents,
  isSyncing,
  ideLoadingState,
  monacoRef,
  handleMonacoBeforeMount
}: IDEEditorAreaProps) {
  const { t } = useI18n()

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Tabs Header */}
      <div className="h-10 bg-[#1e1e1e] border-b border-neutral-800 flex items-center text-sm text-neutral-400 flex-shrink-0 w-full relative">
        <div className="flex-1 flex items-center h-full overflow-hidden relative group/tabs">
          {openFiles.length > 0 && (
            <div className="absolute left-0 top-0 bottom-0 flex items-center bg-gradient-to-r from-[#1e1e1e] via-[#1e1e1e] to-transparent z-10 w-8">
              <button
                onClick={() => {
                  if (tabsContainerRef.current) {
                    tabsContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' })
                  }
                }}
                className="p-1 text-neutral-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          <div
            ref={tabsContainerRef}
            className="flex-1 h-full flex items-center overflow-x-auto whitespace-nowrap scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {openFiles.length === 0 && (
              <span className="px-4 opacity-50">
                {t('workspace_components.ide_local.no_file_selected', 'Nenhum arquivo selecionado')}
              </span>
            )}
            {openFiles.map(path => {
              const isActive = path === activeFile
              return (
                <div
                  key={path}
                  onClick={() => {
                    setActiveFile(path)
                    activeFileRef.current = path
                  }}
                  onMouseUp={(e) => {
                    if (e.button === 1) handleCloseFile(e, path)
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setTabContextMenu({ x: e.clientX, y: e.clientY, path })
                  }}
                  className={`h-full flex items-center px-4 border-r border-neutral-800 cursor-pointer select-none transition-colors group/tab ${
                    isActive
                      ? 'bg-[#252526] text-white border-t-2 border-t-indigo-500'
                      : 'bg-[#2d2d2d] hover:bg-[#252526]'
                  }`}
                >
                  <span
                    className={`mr-2 truncate max-w-[200px] ${isDirty(path) ? 'italic text-amber-200' : ''}`}
                    title={path.replace(`AGTech/MetaBuilderPRO/${target?.slug}/`, '')}
                  >
                    {path.split('/').pop()}
                  </span>
                  {isDirty(path) && (
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-2 flex-shrink-0" title="Unsaved changes" />
                  )}
                  <button
                    onClick={(e) => handleCloseFile(e, path)}
                    className={`p-0.5 rounded transition-colors ${
                      isActive
                        ? 'text-neutral-400 hover:bg-neutral-700 hover:text-white'
                        : 'opacity-0 group-hover/tab:opacity-100 text-neutral-500 hover:bg-neutral-700 hover:text-white'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>

          {openFiles.length > 0 && (
            <div className="absolute right-0 top-0 bottom-0 flex items-center bg-gradient-to-l from-[#1e1e1e] via-[#1e1e1e] to-transparent z-10 w-8 justify-end">
              <button
                onClick={() => {
                  if (tabsContainerRef.current) {
                    tabsContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' })
                  }
                }}
                className="p-1 text-neutral-400 hover:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {openFiles.length > 0 && (
          <div className="flex items-center gap-1 px-2 border-l border-neutral-800 h-full flex-shrink-0 bg-[#1e1e1e]">
            <button
              onClick={() => activeFile && handleSaveFile(fileContents[activeFile], activeFile)}
              disabled={!activeFile || !isDirty(activeFile)}
              title={t('workspace_components.ide_local.save', 'Salvar (Ctrl+S)')}
              className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors disabled:opacity-30"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={handleSaveAll}
              disabled={!openFiles.some(isDirty)}
              title={t('workspace_components.ide_local.save_all', 'Salvar Todos')}
              className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors disabled:opacity-30"
            >
              <CopyCheck className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Editor Content Body */}
      <div className="flex-1 min-h-0 relative">
        {isSyncing ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-4">
            <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <span className="text-sm font-medium animate-pulse text-indigo-400">
              {t('workspace_components.ide_local.syncing_cloud', 'Sincronizando arquivos com a nuvem...')}
            </span>
          </div>
        ) : ideLoadingState.isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-4">
            <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <span className="text-sm font-medium animate-pulse text-indigo-400">{ideLoadingState.message}</span>
          </div>
        ) : activeFile ? (
          <MonacoEditor
            language={
              activeFile.endsWith('.tsx') || activeFile.endsWith('.ts')
                ? 'typescript'
                : activeFile.endsWith('.json')
                ? 'json'
                : 'javascript'
            }
            theme="vs-dark"
            beforeMount={handleMonacoBeforeMount}
            path={activeFile}
            defaultValue={fileContents[activeFile] || ''}
            onChange={(val) => {
              if (activeFile) {
                setFileContents(prev => ({ ...prev, [activeFile]: val || '' }))
              }
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: 'on',
              padding: { top: 16 }
            }}
            onMount={(editor, monaco) => {
              monacoRef.current = monaco
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                handleSaveFile(editor.getValue(), activeFileRef.current || undefined)
              })
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-neutral-600">
            {t('workspace_components.ide_local.select_file_hint', 'Selecione um arquivo na árvore ao lado')}
          </div>
        )}
      </div>
    </div>
  )
}
