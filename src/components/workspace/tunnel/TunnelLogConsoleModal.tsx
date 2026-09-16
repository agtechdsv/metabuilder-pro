'use client'

import React, { useEffect, useRef, useState } from 'react'
import { X, Trash2, Copy } from 'lucide-react'
import { isTauri } from '@/utils/tauriUtils'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'

interface TunnelLogConsoleModalProps {
  isOpen: boolean
  onClose: () => void
  isWindow?: boolean
}

export function TunnelLogConsoleModal({ isOpen, onClose, isWindow = false }: TunnelLogConsoleModalProps) {
  const [logs, setLogs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const { t } = useI18n()

  // Scroll para o fim quando chegam novos logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  useEffect(() => {
    let unlisten: (() => void) | undefined

    const initLogs = async () => {
      if (!isOpen) return
      setIsLoading(true)

      if (isTauri()) {
        try {
          const { listen } = await import('@tauri-apps/api/event')
          const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
          const { readTextFile, exists } = await import('@tauri-apps/plugin-fs')

          try {
            // Ler logs antigos do arquivo
            const dir = await appLocalDataDir()
            const logPath = await join(dir, 'logs', 'tunnel.log')
            
            if (await exists(logPath)) {
              const fileContent = await readTextFile(logPath)
              const lines = fileContent.split('\n').filter(l => l.trim() !== '')
              setLogs(lines)
            } else {
              setLogs([t('tunnel_log.not_found', '[SYSTEM] Arquivo de log não encontrado. O túnel pode não ter sido iniciado ainda.')])
            }
          } catch (fileErr: any) {
            console.error('Falha ao ler log inicial:', fileErr)
            setLogs([`${t('tunnel_log.error_read_file', '[ERRO] Falha ao ler o arquivo de log do túnel local.')} Detalhe: ${fileErr.message || fileErr}`])
          }

          // Escutar novos logs em tempo real
          unlisten = await listen<string>('tunnel-log', (event) => {
            setLogs((prev) => [...prev, event.payload])
          })
        } catch (error: any) {
          console.error(t('tunnel_log.error_read_console', 'Erro ao ler logs do túnel:'), error)
          setLogs([`${t('tunnel_log.error_read_file', '[ERRO] Falha ao iniciar escuta de logs.')} Detalhe: ${error.message || error}`])
        }
      } else {
        setLogs([t('tunnel_log.desktop_only', '[SYSTEM] Visualização de logs do túnel só está disponível no ambiente Desktop (IDE).')])
      }
      setIsLoading(false)
    }

    initLogs()

    return () => {
      if (unlisten) unlisten()
    }
  }, [isOpen])

  const handleClearLogs = async () => {
    if (isTauri()) {
      try {
        const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
        const { writeTextFile } = await import('@tauri-apps/plugin-fs')
        
        const dir = await appLocalDataDir()
        const logPath = await join(dir, 'logs', 'tunnel.log')
        
        await writeTextFile(logPath, '')
        setLogs([])
        toast(t('tunnel_log.clear_success', 'Logs limpos com sucesso.'), 'success')
      } catch (error) {
        console.error(t('tunnel_log.error_clear_console', 'Erro ao limpar logs:'), error)
        toast(t('tunnel_log.error_clear_file', 'Erro ao limpar arquivo de log.'), 'error')
      }
    }
  }

  const handleCopyAll = () => {
    if (logs.length > 0) {
      navigator.clipboard.writeText(logs.join('\n'))
      toast(t('tunnel_log.copied_all', 'Todos os logs copiados!'), 'success')
    }
  }

  const handleMouseUp = () => {
    const selectedText = window.getSelection()?.toString()
    if (selectedText && selectedText.trim().length > 0) {
      navigator.clipboard.writeText(selectedText)
      toast(t('tunnel_log.copied_selection', 'Seleção copiada!'), 'success')
    }
  }

  if (!isOpen) return null

  return (
    <div className={isWindow ? "w-full h-screen bg-[#0c0c0c] flex flex-col text-white" : "fixed inset-0 z-[200] pointer-events-none flex items-center justify-center"}>
      {!isWindow && (
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto transition-opacity"
          onClick={onClose}
        />
      )}
      <div className={isWindow ? "w-full h-full flex flex-col relative" : "pointer-events-auto w-full max-w-4xl max-h-[80vh] bg-[#0c0c0c] border border-neutral-800 rounded-[1.5rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 relative"}>
        <div className="p-5 border-b border-neutral-800 flex justify-between items-center bg-[#111]">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <div>
              <h3 className="font-bold text-lg text-white">{t('tunnel_log.title', 'Console do Túnel (Logs)')}</h3>
              <p className="text-xs text-neutral-400 font-mono">cli-win.exe --action=tunnel</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const selectedText = window.getSelection()?.toString()
                if (selectedText) {
                  await navigator.clipboard.writeText(selectedText)
                  toast("Seleção copiada para a área de transferência.", "success")
                } else {
                  toast("Selecione o texto que deseja copiar primeiro.", "info")
                }
              }}
              className="text-gray-400 hover:text-white transition-colors flex items-center justify-center p-1.5 rounded bg-gray-800/50 hover:bg-gray-700/50"
              title="Copiar Seleção"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            
            <button
              onClick={async () => {
                const allText = logs.join('\n')
                await navigator.clipboard.writeText(allText)
                toast("Todos os logs copiados para a área de transferência.", "success")
              }}
              className="text-gray-400 hover:text-white transition-colors flex items-center justify-center p-1.5 rounded bg-gray-800/50 hover:bg-gray-700/50"
              title="Copiar Tudo"
            >
              <Copy className="w-4 h-4" />
            </button>

            <button
              onClick={handleClearLogs}
              className="text-gray-400 hover:text-white transition-colors flex items-center justify-center p-1.5 rounded bg-gray-800/50 hover:bg-gray-700/50"
              title={t('tunnel_log.clear_logs', 'Limpar Logs')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            
            <button
              onClick={async () => {
                if (isWindow && isTauri()) {
                  const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
                  getCurrentWebviewWindow().close()
                } else {
                  onClose()
                }
              }}
              className="text-gray-400 hover:text-white transition-colors flex items-center justify-center p-1.5 rounded hover:bg-red-500/20 hover:text-red-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div 
          className="flex-1 p-4 font-mono text-xs overflow-y-auto bg-[#0c0c0c] min-h-[300px] select-text"
          onMouseUp={handleMouseUp}
        >
          {
            isLoading ? (
              <div className="text-neutral-400 animate-pulse">{t('tunnel_log.loading', 'Carregando logs...')}</div>
            ) : logs.length === 0 ? (
              <div className="text-neutral-500">{t('tunnel_log.empty', 'Nenhum log registrado.')}</div>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={`mb-1 ${
                    log.includes('ERROR') || log.includes('ERRO') || log.includes('FALHA')
                      ? 'text-red-400'
                      : log.includes('sucesso') || log.includes('OK')
                      ? 'text-green-400'
                      : log.includes('DEBUG')
                      ? 'text-yellow-400'
                      : 'text-neutral-300'
                  }`}
                >
                  {log}
                </div>
              ))
            )
          }
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  )
}
