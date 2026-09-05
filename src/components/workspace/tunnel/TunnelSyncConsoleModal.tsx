'use client'

import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface TunnelSyncConsoleModalProps {
  isOpen: boolean
  syncStatus: 'idle' | 'running' | 'success' | 'error'
  syncLogs: string[]
  onClose: () => void
}

export function TunnelSyncConsoleModal({
  isOpen,
  syncStatus,
  syncLogs,
  onClose
}: TunnelSyncConsoleModalProps) {
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [syncLogs])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto transition-opacity"
        onClick={onClose}
      />
      <div className="pointer-events-auto w-full max-w-4xl max-h-[80vh] bg-[#0c0c0c] border border-neutral-800 rounded-[1.5rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 relative">
        <div className="p-5 border-b border-neutral-800 flex justify-between items-center bg-[#111]">
          <div className="flex items-center gap-3">
            <div
              className={`w-2 h-2 rounded-full ${
                syncStatus === 'running'
                  ? 'bg-indigo-500 animate-pulse'
                  : syncStatus === 'success'
                  ? 'bg-green-500'
                  : syncStatus === 'error'
                  ? 'bg-red-500'
                  : 'bg-neutral-500'
              }`}
            />
            <div>
              <h3 className="font-bold text-lg text-white">Console de Sincronização</h3>
              <p className="text-xs text-neutral-400 font-mono">cli-win.exe --action=sync</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={syncStatus === 'running'}
            className="p-2 hover:bg-neutral-800 rounded-xl transition-colors text-neutral-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-4 font-mono text-xs overflow-y-auto bg-[#0c0c0c] min-h-[300px]">
          {syncLogs.map((log, i) => (
            <div
              key={i}
              className={`mb-1 ${
                log.includes('ERROR') || log.includes('ERRO') || log.includes('FALHA')
                  ? 'text-red-400'
                  : log.includes('sucesso')
                  ? 'text-green-400'
                  : 'text-neutral-300'
              }`}
            >
              <span className="text-neutral-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
              {log}
            </div>
          ))}
          {syncStatus === 'running' && (
            <div className="text-indigo-400 animate-pulse mt-4">Processando...</div>
          )}
          <div ref={logsEndRef} />
        </div>

        {syncStatus !== 'running' && (
          <div
            className={`p-4 border-t border-neutral-800 flex justify-between items-center ${
              syncStatus === 'success' ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}
          >
            <div className="flex items-center gap-2">
              {syncStatus === 'success' ? (
                <span className="font-bold text-sm text-green-500">✓ Sincronização concluída com sucesso!</span>
              ) : (
                <span className="font-bold text-sm text-red-500">⚠ Falha na sincronização. Verifique os logs acima.</span>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl font-bold text-sm bg-white text-black hover:bg-neutral-200 transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
