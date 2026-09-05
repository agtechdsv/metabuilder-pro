'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Package, Play, Square, AppWindow, Trash2, X } from 'lucide-react'
import { useI18n } from '@/i18n'
import { ConsoleLog } from '@/contexts/ide/useIDEConsole'

export interface IDEConsolePanelProps {
  showConsole: boolean
  setShowConsole: React.Dispatch<React.SetStateAction<boolean>>
  consoleHeight: number
  isResizingConsole: React.MutableRefObject<boolean>
  handleInstall: () => Promise<void>
  isInstalling: boolean
  devProcess: any
  isSyncing: boolean
  handleStart: () => Promise<void>
  handleStop: () => Promise<void>
  isStoppingServer: boolean
  handleOpenBrowser: () => Promise<void>
  clearConsole: () => void
  consoleLogs: ConsoleLog[]
  consoleEndRef: React.RefObject<HTMLDivElement | null>
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
  clearConsole,
  consoleLogs,
  consoleEndRef
}: IDEConsolePanelProps) {
  const { t } = useI18n()

  return (
    <>
      {/* Vertical Drag Handle (Editor vs Console) */}
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
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mr-2">
                  Console
                </span>

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

                {/* Start / Stop toggle */}
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
              {consoleLogs.length === 0 && (
                <span className="text-neutral-600">
                  {t('ide.console.ready', 'Console pronto. Use os ícones acima para iniciar.')}
                </span>
              )}
              {consoleLogs.map((log, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${
                    log.type === 'error'
                      ? 'text-red-400'
                      : log.type === 'warn'
                      ? 'text-yellow-400'
                      : log.type === 'info'
                      ? 'text-cyan-400'
                      : 'text-neutral-300'
                  }`}
                >
                  <span className="text-neutral-600 shrink-0">{log.ts}</span>
                  <span className="break-all whitespace-pre-wrap">{log.text}</span>
                </div>
              ))}
              <div ref={consoleEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
