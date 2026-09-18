'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { ChevronLeft, ChevronRight, X, Save, CopyCheck } from 'lucide-react'
import { useI18n } from '@/i18n'
import { getLanguageFromPath } from './ideUtils'

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
  /** Lista plana de todos os caminhos de arquivo na árvore */
  allFilePaths: string[]
  /** Função que abre/carrega um arquivo do disco (ctrl+click navegação) */
  handleSelectFile: (path: string) => Promise<void>
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
  handleMonacoBeforeMount,
  allFilePaths,
  handleSelectFile,
}: IDEEditorAreaProps) {
  const { t } = useI18n()
  const fileContentsRef = React.useRef(fileContents)
  const allFilePathsRef = React.useRef(allFilePaths)
  const editorInstanceRef = React.useRef<any>(null)
  const jumpToMethodRef = React.useRef<{ path: string, method: string } | null>(null)

  React.useEffect(() => {
    fileContentsRef.current = fileContents
  }, [fileContents])
  React.useEffect(() => {
    allFilePathsRef.current = allFilePaths
  }, [allFilePaths])

  React.useEffect(() => {
    if (activeFile && jumpToMethodRef.current && jumpToMethodRef.current.path === activeFile) {
      const targetMethod = jumpToMethodRef.current.method
      jumpToMethodRef.current = null
      
      const editor = editorInstanceRef.current
      if (editor) {
         setTimeout(() => {
           const model = editor.getModel()
           if (model) {
             const text = model.getValue()
             const regex = new RegExp(`\\b${targetMethod}\\b`)
             const match = text.match(regex)
             if (match && match.index !== undefined) {
                const pos = model.getPositionAt(match.index)
                editor.revealLineInCenter(pos.lineNumber)
                editor.setPosition(pos)
                editor.focus()
             }
           }
         }, 100)
      }
    }
  }, [activeFile, fileContents])

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <style>{`
        .monaco-editor.ide-ctrl-hover .view-lines,
        .monaco-editor.ide-ctrl-hover .view-lines span {
          cursor: pointer !important;
        }
      `}</style>
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
            language={getLanguageFromPath(activeFile)}
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
              padding: { top: 16 },
              quickSuggestions: {
                other: true,
                comments: false,
                strings: false
              },
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnEnter: 'on',
              tabCompletion: 'on'
            }}
            onMount={(editor, monaco) => {
              monacoRef.current = monaco
              editorInstanceRef.current = editor
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                handleSaveFile(editor.getValue(), activeFileRef.current || undefined)
              })
              
              // Ctrl+Click — Navega para o arquivo da classe clicada (como no Eclipse)
              editor.onMouseDown((e) => {
                if (!(e.event.ctrlKey || e.event.metaKey)) return
                const position = e.target.position
                if (!position) return

                const model = editor.getModel()
                if (!model) return
                
                const word = model.getWordAtPosition(position)
                if (!word?.word) return

                let targetClassName = word.word
                let targetMethod: string | null = null

                // Detectar se é chamada de método (ex: service.findAll)
                const lineContent = model.getLineContent(position.lineNumber)
                const textBefore = lineContent.substring(0, word.startColumn - 1)
                const matchMethod = textBefore.match(/(\w+)\s*\.$/)
                
                if (matchMethod) {
                  const objectName = matchMethod[1]
                  targetMethod = word.word
                  
                  // Tentar inferir o tipo da variável no arquivo atual (ex: ClientesService service;)
                  const fullText = model.getValue()
                  const typeRegex = new RegExp(`\\b(\\w+)\\s+${objectName}\\b`)
                  const typeMatch = fullText.match(typeRegex)
                  if (typeMatch && typeMatch[1]) {
                    targetClassName = typeMatch[1]
                  } else {
                    targetClassName = objectName // fallback caso seja estático
                  }
                } else {
                  // Se não é método, checar se é uma variável/objeto local clicado no corpo
                  const fullText = model.getValue()
                  const localRegex = new RegExp(`\\b(\\w+)\\s+${targetClassName}\\b`)
                  const localMatch = fullText.match(localRegex)
                  
                  if (localMatch && localMatch.index !== undefined) {
                    const pos = model.getPositionAt(localMatch.index)
                    // Se não estiver clicando na própria declaração, pula para ela
                    if (pos.lineNumber !== position.lineNumber) {
                      editorInstanceRef.current.revealLineInCenter(pos.lineNumber)
                      editorInstanceRef.current.setPosition(pos)
                      editorInstanceRef.current.focus()
                      return
                    }
                  }
                }

                // Extensoes candidatas — Java, TS e TSX
                const candidates = [`/${targetClassName}.java`, `/${targetClassName}.ts`, `/${targetClassName}.tsx`]

                // 1º tenta nos arquivos já carregados em memória
                const loadedPath = Object.keys(fileContentsRef.current).find(f =>
                  candidates.some(c => f.endsWith(c))
                )
                // 2º busca em toda a árvore de arquivos do projeto
                const treeMatch = allFilePathsRef.current.find(f =>
                  candidates.some(c => f.endsWith(c))
                )
                
                const foundPath = loadedPath || treeMatch

                if (foundPath) {
                  if (targetMethod) {
                    jumpToMethodRef.current = { path: foundPath, method: targetMethod }
                  }

                  if (Object.keys(fileContentsRef.current).includes(foundPath)) {
                    setActiveFile(foundPath)
                    activeFileRef.current = foundPath
                    
                    // Se já for o arquivo ativo, o useEffect não roda por change do activeFile, então força aqui
                    if (targetMethod) {
                      setTimeout(() => {
                         const currentModel = editorInstanceRef.current?.getModel()
                         if (currentModel) {
                           const match = currentModel.getValue().match(new RegExp(`\\b${targetMethod}\\b`))
                           if (match && match.index !== undefined) {
                              const pos = currentModel.getPositionAt(match.index)
                              editorInstanceRef.current.revealLineInCenter(pos.lineNumber)
                              editorInstanceRef.current.setPosition(pos)
                              editorInstanceRef.current.focus()
                           }
                         }
                      }, 50)
                    }
                  } else {
                    // Abre e carrega do disco
                    handleSelectFile(foundPath)
                  }
                }
              })

              // Efeito "mãozinha" (pointer) no Ctrl+Hover
              editor.onMouseMove((e) => {
                const domNode = editor.getDomNode()
                if (!domNode) return

                let isHoveringLink = false

                if ((e.event.ctrlKey || e.event.metaKey) && e.target.position) {
                  const model = editor.getModel()
                  if (!model) return
                  const word = model.getWordAtPosition(e.target.position)
                  
                  if (word && word.word) {
                    let targetClassName = word.word
                    const lineContent = model.getLineContent(e.target.position.lineNumber)
                    const textBefore = lineContent.substring(0, word.startColumn - 1)
                    const matchMethod = textBefore.match(/(\w+)\s*\.$/)
                    
                    let foundLocal = false

                    if (matchMethod) {
                      const objectName = matchMethod[1]
                      const fullText = model.getValue()
                      const typeRegex = new RegExp(`\\b(\\w+)\\s+${objectName}\\b`)
                      const typeMatch = fullText.match(typeRegex)
                      if (typeMatch && typeMatch[1]) targetClassName = typeMatch[1]
                      else targetClassName = objectName
                    } else {
                      // Hover em variável/objeto local
                      const fullText = model.getValue()
                      const localRegex = new RegExp(`\\b(\\w+)\\s+${targetClassName}\\b`)
                      const localMatch = fullText.match(localRegex)
                      if (localMatch && localMatch.index !== undefined) {
                        const pos = model.getPositionAt(localMatch.index)
                        if (pos.lineNumber !== e.target.position.lineNumber) {
                          isHoveringLink = true
                          foundLocal = true
                        }
                      }
                    }

                    if (!foundLocal) {
                      const candidates = [`/${targetClassName}.java`, `/${targetClassName}.ts`, `/${targetClassName}.tsx`]
                      
                      const exists = 
                        Object.keys(fileContentsRef.current).some(f => candidates.some(c => f.endsWith(c))) ||
                        allFilePathsRef.current.some(f => candidates.some(c => f.endsWith(c)))

                      if (exists) {
                        isHoveringLink = true
                      }
                    }
                  }
                }
                
                if (isHoveringLink) {
                  domNode.classList.add('ide-ctrl-hover')
                } else {
                  domNode.classList.remove('ide-ctrl-hover')
                }
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
