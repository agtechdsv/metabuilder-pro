'use client'

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { X, Trash2, Copy, Calendar, RefreshCw } from 'lucide-react'
import { isTauri } from '@/utils/tauriUtils'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import { translateTunnelLog } from '@/utils/tunnelLogTranslator'

interface TunnelLogConsoleModalProps {
  isOpen: boolean
  onClose: () => void
  isWindow?: boolean
}

export type LogType = 'tunnel' | 'sync'

interface LogItem {
  id: string
  time?: string
  level?: string
  text: string
  isSeparator?: boolean
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return String(str).replace(/\x1B\[[0-9;]*[mGKHF]/g, '')
}

function getTodayStr(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function parseLogLine(raw: string, defaultTime?: string): LogItem {
  const clean = stripAnsi(raw)

  // Separator lines like ================= or ----------------
  if (/^={10,}|^-{10,}$/.test(clean.trim())) {
    return {
      id: Math.random().toString(36).substring(2, 9),
      text: clean,
      isSeparator: true,
    }
  }

  // Matches [16:49:15(UTC-03:00)] [LOG] text
  // or [16:49:15] [LOG] text
  // or [16:49:15] text
  const matchWithTime = clean.match(/^\[(\d{2}:\d{2}:\d{2})(?:\([^\)]+\))?\]\s*(?:\[([A-Z0-9_\-]+)\]\s*)?(.*)$/)
  if (matchWithTime) {
    return {
      id: Math.random().toString(36).substring(2, 9),
      time: matchWithTime[1],
      level: matchWithTime[2],
      text: matchWithTime[3] || '',
    }
  }

  // If starts with [LEVEL] text without time
  const matchLevelOnly = clean.match(/^\[([A-Z0-9_\-]+)\]\s*(.*)$/)
  if (
    matchLevelOnly &&
    ['LOG', 'ERR', 'WRN', 'CRIT', 'ERROR', 'WARN', 'SYNC', 'DEBUG', 'BPM', 'BPM-DEBUG', 'EXEC', 'SQL', 'INFO', 'SYSTEM'].includes(
      matchLevelOnly[1]
    )
  ) {
    return {
      id: Math.random().toString(36).substring(2, 9),
      time: defaultTime,
      level: matchLevelOnly[1],
      text: matchLevelOnly[2] || '',
    }
  }

  return {
    id: Math.random().toString(36).substring(2, 9),
    time: defaultTime,
    text: clean,
  }
}

export function TunnelLogConsoleModal({ isOpen, onClose, isWindow = false }: TunnelLogConsoleModalProps) {
  const todayStr = useMemo(() => getTodayStr(), [])
  const [logType, setLogType] = useState<LogType>('tunnel')
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const { t, language } = useI18n()

  const isToday = selectedDate === todayStr
  const isLive = isToday && logType === 'tunnel'

  // Scroll para o fim quando chegam novos logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  const loadLogs = useCallback(async () => {
    if (!isOpen) return
    setIsLoading(true)

    if (isTauri()) {
      try {
        const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
        const { readTextFile, exists } = await import('@tauri-apps/plugin-fs')
        const dir = await appLocalDataDir()

        // Nome do arquivo padrão: ${logType}-${selectedDate}.log
        const primaryFileName = `${logType}-${selectedDate}.log`
        const primaryPath = await join(dir, 'logs', primaryFileName)

        let fileContent = ''
        let found = false

        if (await exists(primaryPath)) {
          fileContent = await readTextFile(primaryPath)
          found = true
        } else if (logType === 'tunnel' && selectedDate === todayStr) {
          // Fallback para tunnel.log caso tunnel-YYYY-MM-DD ainda não tenha sido criado
          const fallbackPath = await join(dir, 'logs', 'tunnel.log')
          if (await exists(fallbackPath)) {
            fileContent = await readTextFile(fallbackPath)
            found = true
          }
        }

        if (found) {
          const rawLines = fileContent.split('\n').filter((l) => l.trim().length > 0)
          const parsed = rawLines.map((line) => parseLogLine(line))
          setLogs(parsed)
        } else {
          setLogs([
            {
              id: 'empty-file',
              time: new Date().toLocaleTimeString(),
              text: t(
                'tunnel_log.no_logs_date',
                `Nenhum arquivo de log encontrado para ${
                  logType === 'tunnel' ? t('tunnel_log.type_tunnel', 'Túnel') : t('tunnel_log.type_sync', 'Sincronização')
                } na data ${selectedDate}.`
              ),
            },
          ])
        }
      } catch (err: any) {
        console.warn('Falha ao ler arquivo de log:', err)
        setLogs([
          {
            id: 'err-file',
            time: new Date().toLocaleTimeString(),
            level: 'ERR',
            text: `${t('tunnel_log.error_read_file', '[ERRO] Falha ao ler o arquivo de log do túnel local.')} (${
              err.message || err
            })`,
          },
        ])
      }
    } else {
      setLogs([
        {
          id: 'desktop-only',
          time: new Date().toLocaleTimeString(),
          text: t('tunnel_log.desktop_only', '[SYSTEM] Visualização de logs só está disponível no ambiente Desktop (IDE).'),
        },
      ])
    }

    setIsLoading(false)
  }, [isOpen, logType, selectedDate, todayStr, t])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  // Escuta logs em tempo real quando estiver visualizando a data atual
  useEffect(() => {
    if (!isOpen || !isTauri()) return

    let unlistenTunnel: (() => void) | undefined
    let unlistenSync: (() => void) | undefined

    const setupListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')

        // Escuta logs do túnel em tempo real
        if (logType === 'tunnel' && isToday) {
          unlistenTunnel = await listen<string>('tunnel-log', (event) => {
            const nowTime = new Date().toLocaleTimeString()
            const parsed = parseLogLine(event.payload, nowTime)
            setLogs((prev) => [...prev, parsed])
          })
        }

        // Escuta logs de sync em tempo real
        if (logType === 'sync' && isToday) {
          unlistenSync = await listen<string>('sync-log', (event) => {
            if (event.payload.includes('Node.js 18 and below are deprecated')) return
            const nowTime = new Date().toLocaleTimeString()
            const parsed = parseLogLine(event.payload, nowTime)
            setLogs((prev) => [...prev, parsed])
          })
        }
      } catch (err) {
        console.error('Falha ao registrar escuta de logs:', err)
      }
    }

    setupListener()

    return () => {
      if (unlistenTunnel) unlistenTunnel()
      if (unlistenSync) unlistenSync()
    }
  }, [isOpen, logType, isToday])

  const handleClearLogs = async () => {
    if (isTauri()) {
      try {
        const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
        const { writeTextFile, exists } = await import('@tauri-apps/plugin-fs')

        const dir = await appLocalDataDir()
        const primaryFileName = `${logType}-${selectedDate}.log`
        const primaryPath = await join(dir, 'logs', primaryFileName)

        if (await exists(primaryPath)) {
          await writeTextFile(primaryPath, '')
        }
        if (logType === 'tunnel' && isToday) {
          const fallbackPath = await join(dir, 'logs', 'tunnel.log')
          if (await exists(fallbackPath)) {
            await writeTextFile(fallbackPath, '')
          }
        }

        setLogs([])
        toast(t('tunnel_log.clear_success', 'Logs limpos com sucesso.'), 'success')
      } catch (error) {
        console.error(t('tunnel_log.error_clear_console', 'Erro ao limpar logs:'), error)
        toast(t('tunnel_log.error_clear_file', 'Erro ao limpar arquivo de log.'), 'error')
      }
    }
  }

  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null)
  const lastCopiedTextRef = useRef<string>('')

  // Reseta a referência de texto copiado quando a seleção for limpa
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        lastCopiedTextRef.current = ''
      }
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [])

  const handleCopyAll = () => {
    if (logs.length > 0) {
      const translatedLines = logs.map((l) => {
        if (l.isSeparator) return l.text
        const trans = translateTunnelLog(l.text, language)
        const timePart = l.time ? `[${l.time}] ` : ''
        const levelPart = l.level ? `[${l.level}] ` : ''
        return `${timePart}${levelPart}${trans}`
      })
      navigator.clipboard.writeText(translatedLines.join('\n'))
      toast(t('tunnel_log.copied_all', 'Todos os logs copiados!'), 'success')
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    const startPos = mouseDownPosRef.current
    mouseDownPosRef.current = null

    const dx = startPos ? Math.abs(e.clientX - startPos.x) : 0
    const dy = startPos ? Math.abs(e.clientY - startPos.y) : 0
    const isDrag = dx >= 5 || dy >= 5
    const isMultiClick = e.detail >= 2

    if (!isDrag && !isMultiClick) {
      lastCopiedTextRef.current = ''
      return
    }

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) {
      lastCopiedTextRef.current = ''
      return
    }

    const selectedText = selection.toString().trim()
    if (selectedText.length > 0 && selectedText !== lastCopiedTextRef.current) {
      lastCopiedTextRef.current = selectedText
      navigator.clipboard.writeText(selectedText)
      toast(t('tunnel_log.copied_selection', 'Seleção copiada!'), 'success')
    }
  }

  if (!isOpen) return null

  return (
    <div
      className={
        isWindow
          ? 'w-full h-screen bg-[#0c0c0c] flex flex-col text-white'
          : 'fixed inset-0 z-[200] pointer-events-none flex items-center justify-center'
      }
    >
      {!isWindow && (
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto transition-opacity"
          onClick={onClose}
        />
      )}
      <div
        className={
          isWindow
            ? 'w-full h-full flex flex-col relative'
            : 'pointer-events-auto w-full max-w-4xl max-h-[85vh] bg-[#0c0c0c] border border-neutral-800 rounded-[1.5rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 relative'
        }
      >
        {/* Header com Controles: Título, Toggle (Tunnel/Sync), Date Picker e Ações */}
        <div className="p-4 border-b border-neutral-800 flex flex-wrap gap-3 justify-between items-center bg-[#111]">
          {/* Lado Esquerdo: Indicador + Título + Subtítulo */}
          <div className="flex items-center gap-3">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isLive ? 'bg-green-500 animate-pulse' : 'bg-neutral-500'
              }`}
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base md:text-lg text-white">
                  {t('tunnel_log.title', 'Console do Túnel (Logs)')}
                </h3>
                {isLive ? (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    {t('tunnel_log.live', 'Tempo Real')}
                  </span>
                ) : (
                  <span className="text-[11px] font-mono text-neutral-400 bg-neutral-800/80 border border-neutral-700/50 px-2 py-0.5 rounded-full">
                    {logType}-{selectedDate}.log
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 font-mono">
                cli-win.exe --action={logType}
              </p>
            </div>
          </div>

          {/* Centro: Toggle Túnel / Sync + Seletor de Data */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Toggle Túnel / Sincronização */}
            <div className="flex items-center bg-neutral-900 border border-neutral-800 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setLogType('tunnel')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  logType === 'tunnel'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {t('tunnel_log.type_tunnel', 'Túnel')}
              </button>
              <button
                type="button"
                onClick={() => setLogType('sync')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  logType === 'sync'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {t('tunnel_log.type_sync', 'Sincronização')}
              </button>
            </div>

            {/* Date Picker */}
            <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 px-2.5 py-1 rounded-xl">
              <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                max={todayStr}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value)
                  }
                }}
                className="bg-transparent text-neutral-200 text-xs font-mono focus:outline-none cursor-pointer [color-scheme:dark]"
                title={t('tunnel_log.select_date', 'Data')}
              />
              {!isToday && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className="ml-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors"
                  title={t('tunnel_log.today_tooltip', 'Voltar para hoje (tempo real)')}
                >
                  {t('tunnel_log.today_btn', 'Hoje')}
                </button>
              )}
            </div>

            {/* Recarregar */}
            <button
              type="button"
              onClick={() => loadLogs()}
              className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800"
              title={t('tunnel_log.reload', 'Recarregar')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Lado Direito: Ações (Copiar, Limpar, Fechar) */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAll}
              className="text-gray-400 hover:text-white transition-colors flex items-center justify-center p-2 rounded-xl bg-gray-800/50 hover:bg-gray-700/50"
              title={t('tunnel_log.copy_all_button', 'Copiar Tudo')}
            >
              <Copy className="w-4 h-4" />
            </button>

            <button
              onClick={handleClearLogs}
              className="text-gray-400 hover:text-white transition-colors flex items-center justify-center p-2 rounded-xl bg-gray-800/50 hover:bg-gray-700/50"
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
              className="text-gray-400 hover:text-white transition-colors flex items-center justify-center p-2 rounded-xl hover:bg-red-500/20 hover:text-red-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corpo do Console com Timestamps no estilo da sincronização */}
        <div
          className="flex-1 p-4 font-mono text-xs overflow-y-auto bg-[#0c0c0c] min-h-[300px] select-text"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        >
          {isLoading ? (
            <div className="text-neutral-400 animate-pulse">{t('tunnel_log.loading', 'Carregando logs...')}</div>
          ) : logs.length === 0 ? (
            <div className="text-neutral-500">{t('tunnel_log.empty', 'Nenhum log registrado.')}</div>
          ) : (
            logs.map((item) => {
              if (item.isSeparator) {
                return (
                  <div key={item.id} className="text-neutral-600 select-none my-1 overflow-hidden truncate">
                    {item.text}
                  </div>
                )
              }

              const translated = translateTunnelLog(item.text, language)
              const isError =
                item.level === 'ERR' ||
                item.level === 'CRIT' ||
                item.level === 'ERROR' ||
                translated.includes('ERROR') ||
                translated.includes('ERRO') ||
                translated.includes('FALHA') ||
                translated.includes('FAILED') ||
                translated.includes('FAIL') ||
                translated.includes('FALLO')
              const isSuccess =
                translated.includes('sucesso') ||
                translated.includes('successfully') ||
                translated.includes('éxito') ||
                translated.includes('✓') ||
                translated.includes('✅')
              const isWarningOrDebug =
                item.level === 'WRN' ||
                item.level === 'WARN' ||
                item.level === 'DEBUG' ||
                item.level === 'BPM-DEBUG' ||
                translated.includes('DEBUG') ||
                translated.includes('AVISO') ||
                translated.includes('WARNING') ||
                translated.includes('ADVERTENCIA')

              const colorClass = isError
                ? 'text-red-400'
                : isSuccess
                ? 'text-green-400'
                : isWarningOrDebug
                ? 'text-yellow-400'
                : item.level === 'SQL'
                ? 'text-neutral-500'
                : 'text-neutral-300'

              return (
                <div key={item.id} className={`mb-1 leading-relaxed ${colorClass}`}>
                  {item.time && (
                    <span className="text-neutral-600 mr-2 select-none font-mono">
                      [{item.time}]
                    </span>
                  )}
                  {item.level && !['LOG'].includes(item.level) && (
                    <span className={`font-bold mr-1.5 select-none ${
                       item.level === 'EXEC' && translated.toUpperCase().includes('SELECT') ? 'text-cyan-400' :
                       item.level === 'EXEC' && translated.toUpperCase().includes('INSERT') ? 'text-green-400' :
                       item.level === 'EXEC' && translated.toUpperCase().includes('UPDATE') ? 'text-fuchsia-400' :
                       item.level === 'EXEC' && translated.toUpperCase().includes('DELETE') ? 'text-red-400' :
                       item.level === 'SQL' ? 'text-cyan-600' :
                       'text-neutral-500'
                    }`}>
                      [{item.level}]
                    </span>
                  )}
                  <span>{translated}</span>
                </div>
              )
            })
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  )
}
