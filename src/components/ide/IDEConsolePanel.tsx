'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Package, Play, Square, AppWindow, Trash2, X, Coffee, BookOpen, Database, Code2, Copy, Check } from 'lucide-react'
import { useI18n } from '@/i18n'
import { ConsoleLog, isDatabaseLog, stripAnsiCodes } from '@/contexts/ide/useIDEConsole'
import { Modal } from '@/components/ui/Modal'
import { parseDbLogLine, formatSql, SqlHighlight, ParameterBindHighlight } from '@/utils/sqlFormatter'

export interface IDEConsolePanelProps {
  showConsole: boolean
  setShowConsole: React.Dispatch<React.SetStateAction<boolean>>
  consoleHeight: number
  isResizingConsole: React.MutableRefObject<boolean>
  // Node.js
  handleInstall: () => Promise<void>
  isInstalling: boolean
  devProcess: any
  isSyncing: boolean
  handleStart: () => Promise<void>
  handleStop: () => Promise<void>
  isStoppingServer: boolean
  handleOpenBrowser: () => Promise<void>
  // Spring Boot (opcionais — ausentes = modo Node.js puro)
  isJavaSpringProject?: boolean
  springProcess?: any
  isStartingSpring?: boolean
  isStoppingSpring?: boolean
  handleStartSpring?: () => Promise<void>
  handleStopSpring?: () => Promise<void>
  handleOpenSpringSwagger?: () => Promise<void>
  springPort?: number
  // Console
  clearConsole: () => void
  consoleLogs: ConsoleLog[]
  consoleEndRef: React.RefObject<HTMLDivElement | null>
  isDetailedConsole?: boolean
  setIsDetailedConsole?: React.Dispatch<React.SetStateAction<boolean>> | ((val: boolean) => void)
  // Prompt Node
  nodePromptResolver: { resolve: (val: boolean) => void } | null
  setNodePromptResolver: React.Dispatch<React.SetStateAction<{ resolve: (val: boolean) => void } | null>>
  // Prompt Java
  javaPromptResolver: { resolve: (val: boolean) => void } | null
  setJavaPromptResolver: React.Dispatch<React.SetStateAction<{ resolve: (val: boolean) => void } | null>>
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copiar SQL"
      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-800/90 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-100 text-[10px] transition-all shrink-0 ml-2"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      <span>{copied ? 'Copiado!' : 'Copiar'}</span>
    </button>
  )
}

export function IDEConsolePanel({
  showConsole,
  setShowConsole,
  consoleHeight,
  isResizingConsole,
  handleInstall,
  isInstalling,
  devProcess,
  isSyncing,
  handleStart,
  handleStop,
  isStoppingServer,
  handleOpenBrowser,
  isJavaSpringProject = false,
  springProcess,
  isStartingSpring,
  isStoppingSpring,
  handleStartSpring,
  handleStopSpring,
  handleOpenSpringSwagger,
  springPort = 8080,
  clearConsole,
  consoleLogs,
  consoleEndRef,
  isDetailedConsole,
  setIsDetailedConsole,
  nodePromptResolver,
  setNodePromptResolver,
  javaPromptResolver,
  setJavaPromptResolver,
}: IDEConsolePanelProps) {
  const { t } = useI18n()

  const [localDetailed, setLocalDetailed] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ide_console_detailed') === 'true'
    }
    return false
  })

  const [isFormatSql, setIsFormatSql] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ide_console_format_sql')
      return stored === null ? true : stored === 'true'
    }
    return true
  })

  const setFormatSql = (val: boolean) => {
    setIsFormatSql(val)
    if (typeof window !== 'undefined') {
      localStorage.setItem('ide_console_format_sql', String(val))
    }
  }

  const isDetailed = isDetailedConsole !== undefined ? isDetailedConsole : localDetailed
  const setDetailed = (val: boolean) => {
    if (setIsDetailedConsole) {
      setIsDetailedConsole(val)
    } else {
      setLocalDetailed(val)
      if (typeof window !== 'undefined') {
        localStorage.setItem('ide_console_detailed', String(val))
      }
    }
  }

  const visibleLogs = isDetailed
    ? consoleLogs
    : consoleLogs.filter(log => !log.isDb && !isDatabaseLog(log.text))

  return (
    <>
      {/* Drag Handle */}
      {showConsole && (
        <div
          className="h-1 cursor-row-resize hover:bg-indigo-500/50 transition-colors shrink-0 z-10"
          onMouseDown={() => {
            isResizingConsole.current = true
            document.body.style.cursor = 'row-resize'
            document.body.style.userSelect = 'none'
          }}
        />
      )}

      {/* Console Panel */}
      <AnimatePresence>
        {showConsole && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: consoleHeight, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="border-t border-neutral-800 bg-[#0d0d0d] flex flex-col overflow-hidden shrink-0"
          >
            {/* Console toolbar */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-800 shrink-0 bg-[#141414]">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mr-1.5">
                  Console
                </span>

                {/* ── Toggle Resumido / Detalhado (DB) ── */}
                <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded p-0.5 mr-2">
                  <button
                    type="button"
                    onClick={() => setDetailed(false)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                      !isDetailed
                        ? 'bg-neutral-800 text-neutral-200 shadow-sm border border-neutral-700/60 font-semibold'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                    title="Console Resumido: oculta queries SQL e conexões internas do banco de dados"
                  >
                    Resumido
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailed(true)}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                      isDetailed
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 font-semibold'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                    title="Console Detalhado: exibe queries SQL, parâmetros e eventos de conexão do banco de dados"
                  >
                    <Database className={`w-3 h-3 ${isDetailed ? 'text-cyan-300' : 'text-neutral-500'}`} />
                    <span>Detalhado</span>
                    {isDetailed && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    )}
                  </button>
                </div>

                {/* ── Toggle Sem Formato / Com Formato (visível em modo Detalhado) ── */}
                {isDetailed && (
                  <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded p-0.5 mr-2 animate-in fade-in duration-200">
                    <button
                      type="button"
                      onClick={() => setFormatSql(false)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                        !isFormatSql
                          ? 'bg-neutral-800 text-neutral-200 shadow-sm border border-neutral-700/60 font-semibold'
                          : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                      title="Sem Formato: exibe as queries SQL em linha única contínua"
                    >
                      Sem Formato
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormatSql(true)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                        isFormatSql
                          ? 'bg-fuchsia-700 text-white shadow-sm shadow-fuchsia-500/20 font-semibold'
                          : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                      title="Com Formato: indenta colunas e quebra linhas de cláusulas SQL (SELECT, FROM, WHERE, etc.)"
                    >
                      <Code2 className={`w-3 h-3 ${isFormatSql ? 'text-fuchsia-200' : 'text-neutral-500'}`} />
                      <span>Com Formato</span>
                    </button>
                  </div>
                )}

                {/* ── Node.js controls (sempre visíveis se não for java-spring) ── */}
                {!isJavaSpringProject && (
                  <>
                    {/* Build */}
                    <button
                      onClick={handleInstall}
                      disabled={isInstalling || !!devProcess || isSyncing}
                      title="Build (npm install)"
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400"
                    >
                      {isInstalling ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Package className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">Build</span>
                    </button>

                    {/* Start / Stop Next.js */}
                    {!devProcess ? (
                      <button
                        onClick={handleStart}
                        disabled={isInstalling || isSyncing}
                        title="Start (npm run dev)"
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 hover:bg-neutral-800 text-neutral-400 hover:text-green-400"
                      >
                        <Play className="w-3.5 h-3.5 text-green-400" />
                        <span className="hidden sm:inline">Start</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleStop}
                        disabled={isStoppingServer}
                        title={t('ide.tooltip.stop_server', 'Stop servidor')}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 hover:bg-neutral-800 text-neutral-400 hover:text-red-400"
                      >
                        {isStoppingServer ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />
                        )}
                        <span className="hidden sm:inline">
                          {isStoppingServer
                            ? t('workspace_components.ide_local.stopping', 'Parando...')
                            : t('workspace_components.ide_local.stop', 'Stop')}
                        </span>
                      </button>
                    )}

                    {/* Open Browser */}
                    <button
                      onClick={handleOpenBrowser}
                      disabled={!devProcess}
                      title={t('ide.tooltip.open_browser', 'Abrir no Browser')}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 hover:bg-neutral-800 text-neutral-400 hover:text-indigo-400"
                    >
                      <AppWindow className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Browser</span>
                    </button>
                  </>
                )}

                {/* ── Spring Boot controls ── */}
                {isJavaSpringProject && (
                  <>
                    {/* Separador visual */}
                    <span className="w-px h-4 bg-neutral-700 mx-1" />
                    <span className="text-[10px] text-amber-500/70 font-semibold flex items-center gap-1">
                      <Coffee className="w-3 h-3" /> Spring Boot :{springPort}
                    </span>

                    {/* Start / Stop Spring Boot */}
                    {!springProcess ? (
                      <button
                        onClick={handleStartSpring}
                        disabled={!!isStartingSpring || isSyncing}
                        title="Start Spring Boot (mvn spring-boot:run)"
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400"
                      >
                        {isStartingSpring ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span className="hidden sm:inline">
                          {isStartingSpring ? 'Iniciando...' : 'Start Spring Boot'}
                        </span>
                      </button>
                    ) : (
                      <button
                        onClick={handleStopSpring}
                        disabled={!!isStoppingSpring}
                        title="Stop Spring Boot"
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 hover:bg-neutral-800 text-neutral-400 hover:text-red-400"
                      >
                        {isStoppingSpring ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />
                        )}
                        <span className="hidden sm:inline">
                          {isStoppingSpring ? 'Parando...' : 'Stop Spring Boot'}
                        </span>
                      </button>
                    )}

                    {/* Swagger UI */}
                    <button
                      onClick={handleOpenSpringSwagger}
                      disabled={!springProcess}
                      title={`Abrir Swagger UI (localhost:${springPort})`}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Swagger</span>
                    </button>

                    {/* Frontend Node.js (também presente no modo dual) */}
                    <span className="w-px h-4 bg-neutral-700 mx-1" />
                    <span className="text-[10px] text-green-500/70 font-semibold">Next.js :3000</span>

                    {/* Build frontend */}
                    <button
                      onClick={handleInstall}
                      disabled={isInstalling || !!devProcess || isSyncing}
                      title="npm install (frontend)"
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400"
                    >
                      {isInstalling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">Build</span>
                    </button>

                    {!devProcess ? (
                      <button
                        onClick={handleStart}
                        disabled={isInstalling || isSyncing}
                        title="Start Next.js frontend"
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 hover:bg-neutral-800 text-neutral-400 hover:text-green-400"
                      >
                        <Play className="w-3.5 h-3.5 text-green-400" />
                        <span className="hidden sm:inline">Start NextJs</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleStop}
                        disabled={isStoppingServer}
                        title="Stop Next.js frontend"
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 hover:bg-neutral-800 text-neutral-400 hover:text-red-400"
                      >
                        {isStoppingServer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />}
                        <span className="hidden sm:inline">Stop NextJs</span>
                      </button>
                    )}

                    <button
                      onClick={handleOpenBrowser}
                      disabled={!devProcess}
                      title="Abrir frontend no browser"
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 hover:bg-neutral-800 text-neutral-400 hover:text-indigo-400"
                    >
                      <AppWindow className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Browser</span>
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Clear */}
                <button
                  onClick={clearConsole}
                  title="Limpar Console"
                  className="flex items-center justify-center w-6 h-6 rounded hover:bg-neutral-800 text-neutral-500 hover:text-white transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {/* Close */}
                <button
                  onClick={() => setShowConsole(false)}
                  title="Fechar Console"
                  className="flex items-center justify-center w-6 h-6 rounded hover:bg-neutral-800 text-neutral-500 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Log lines */}
            <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed space-y-0.5">
              {visibleLogs.length === 0 && (
                <span className="text-neutral-600">
                  {consoleLogs.length > 0 && !isDetailed
                    ? 'Logs de banco de dados ocultados pelo modo Resumido. Clique em Detalhado para exibir.'
                    : t('ide.console.ready', 'Console pronto. Use os ícones acima para iniciar.')}
                </span>
              )}
              {visibleLogs.map((log, i) => {
                const cleanText = stripAnsiCodes(log.text)
                const isDb = log.isDb || isDatabaseLog(log.text)
                const parsed = isDb ? parseDbLogLine(cleanText) : null

                return (
                  <div
                    key={i}
                    className={`group flex items-start gap-2 py-1 px-1.5 rounded transition-colors ${
                      isDb
                        ? 'bg-cyan-950/25 border-l-2 border-cyan-500/70 text-cyan-200 my-0.5'
                        : log.type === 'error'
                          ? 'text-red-400 py-0.5'
                          : log.type === 'warn'
                            ? 'text-yellow-400 py-0.5'
                            : log.type === 'info'
                              ? 'text-cyan-400 py-0.5'
                              : 'text-neutral-300 py-0.5'
                    }`}
                  >
                    <span className="text-neutral-600 shrink-0 select-none text-[10px] pt-0.5">{log.ts}</span>
                    {isDb && (
                      <span className="inline-flex items-center gap-1 px-1 py-0.2 rounded text-[9px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/50 shrink-0 select-none mt-0.5">
                        <Database className="w-2.5 h-2.5" />
                        DB
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      {isDb && parsed && parsed.header ? (
                        <>
                          {/* Linha 1: Cabeçalho com dois pontos colado à esquerda */}
                          <div className="flex items-center justify-between text-neutral-400 font-mono text-[10.5px] select-text">
                            <span className="break-all">{parsed.header}</span>
                            {parsed.isQuery && (
                              <CopyButton text={isFormatSql ? formatSql(parsed.content) : parsed.content} />
                            )}
                          </div>

                          {/* Linha 2: ENTER antes da query ou parameter */}
                          <div className="mt-1 select-text">
                            {parsed.isQuery ? (
                              <div
                                className={
                                  isFormatSql
                                    ? 'overflow-x-auto py-1.5 pl-2.5 pr-2 bg-neutral-950/60 rounded border border-cyan-900/30 text-xs'
                                    : 'break-all whitespace-pre-wrap pl-1 text-xs'
                                }
                              >
                                <SqlHighlight
                                  sql={isFormatSql ? formatSql(parsed.content) : parsed.content}
                                />
                              </div>
                            ) : parsed.isParameterBind ? (
                              <div className="pl-1">
                                <ParameterBindHighlight text={parsed.content} />
                              </div>
                            ) : (
                              <div className="font-mono text-[11px] text-cyan-200/90 pl-1 break-all whitespace-pre-wrap">
                                {parsed.content}
                              </div>
                            )}
                          </div>
                        </>
                      ) : isDb && parsed && parsed.isQuery ? (
                        <div className="select-text">
                          <div className="flex items-center justify-end mb-1">
                            <CopyButton text={isFormatSql ? formatSql(parsed.content) : parsed.content} />
                          </div>
                          <div
                            className={
                              isFormatSql
                                ? 'overflow-x-auto py-1.5 pl-2.5 pr-2 bg-neutral-950/60 rounded border border-cyan-900/30 text-xs'
                                : 'break-all whitespace-pre-wrap text-xs'
                            }
                          >
                            <SqlHighlight
                              sql={isFormatSql ? formatSql(parsed.content) : parsed.content}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="break-all whitespace-pre-wrap select-text">{cleanText}</span>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={consoleEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Node.js Portable Prompt */}
      <Modal
        isOpen={!!nodePromptResolver}
        onClose={() => {
          nodePromptResolver?.resolve(false)
          setNodePromptResolver(null)
        }}
        title="MetaBuilder Pro"
        size="md"
      >
        <div className="flex flex-col gap-4 text-sm text-neutral-600 dark:text-neutral-300">
          <p>O Node.js (v20+) é necessário para rodar o frontend.</p>
          <p>Deseja que o MetaBuilder baixe e configure uma versão portátil do Node automaticamente? (Aprox. 30MB)</p>
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => {
                nodePromptResolver?.resolve(false)
                setNodePromptResolver(null)
              }}
              className="px-4 py-2 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700 font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                nodePromptResolver?.resolve(true)
                setNodePromptResolver(null)
              }}
              className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 font-medium transition-colors shadow-sm"
            >
              Baixar e Instalar
            </button>
          </div>
        </div>
      </Modal>

      {/* Java 21 Portable Prompt */}
      <Modal
        isOpen={!!javaPromptResolver}
        onClose={() => {
          javaPromptResolver?.resolve(false)
          setJavaPromptResolver(null)
        }}
        title="MetaBuilder Pro"
        size="md"
      >
        <div className="flex flex-col gap-4 text-sm text-neutral-600 dark:text-neutral-300">
          <p>O Java 21 é necessário para rodar o backend.</p>
          <p>Deseja que o MetaBuilder baixe e configure uma versão portátil do Java automaticamente? (Aprox. 190MB)</p>
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => {
                javaPromptResolver?.resolve(false)
                setJavaPromptResolver(null)
              }}
              className="px-4 py-2 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700 font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                javaPromptResolver?.resolve(true)
                setJavaPromptResolver(null)
              }}
              className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 font-medium transition-colors shadow-sm"
            >
              Baixar e Instalar
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
