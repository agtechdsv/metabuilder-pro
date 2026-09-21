'use client'

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { X, Trash2, Copy, Calendar, RefreshCw, Lock, Unlock, ArrowDownToLine } from 'lucide-react'
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

  let time = defaultTime
  let rest = clean

  // 1. Check for timestamp: [HH:MM:SS] or [HH:MM:SS(UTC±HH:MM)]
  const matchWithTime = clean.match(/^\[(\d{2}:\d{2}:\d{2})(?:\([^\)]+\))?\]\s*(.*)$/)
  if (matchWithTime) {
    time = matchWithTime[1]
    rest = matchWithTime[2] || ''
  }

  // 2. Unwrap outer file logger wrapper if present: [LOG], [ERR], or [WRN]
  let outerLevel: string | undefined
  const wrapperMatch = rest.match(/^\[(LOG|ERR|WRN)\]\s*(.*)$/)
  if (wrapperMatch) {
    outerLevel = wrapperMatch[1]
    rest = wrapperMatch[2] || ''
  }

  // 3. Match inner tag [ LEVEL ] or [LEVEL]
  const tagMatch = rest.match(/^\[\s*([^\]]+)\s*\]\s*(.*)$/)
  if (tagMatch) {
    const candidate = tagMatch[1].trim()
    const candidateUpper = candidate.toUpperCase()
    const knownLevels = [
      'LOG', 'ERR', 'WRN', 'CRIT', 'ERROR', 'WARN', 'AVISO', 'SYNC',
      'DEBUG', 'BPM', 'BPM-DEBUG', 'EXEC', 'SQL', 'SQL FAILED', 'OK',
      'INFO', 'SYSTEM', 'CLI', 'DBeaver SQL', 'FALHA', 'BUILD'
    ]
    if (knownLevels.some((k) => k.toUpperCase() === candidateUpper)) {
      return {
        id: Math.random().toString(36).substring(2, 9),
        time,
        level: candidate,
        text: tagMatch[2] || '',
      }
    }
  }

  if (outerLevel && outerLevel !== 'LOG') {
    return {
      id: Math.random().toString(36).substring(2, 9),
      time,
      level: outerLevel === 'ERR' ? 'ERROR' : 'WARN',
      text: rest,
    }
  }

  return {
    id: Math.random().toString(36).substring(2, 9),
    time,
    level: undefined,
    text: rest,
  }
}

export function TunnelLogConsoleModal({ isOpen, onClose, isWindow = false }: TunnelLogConsoleModalProps) {
  const todayStr = useMemo(() => getTodayStr(), [])
  const [logType, setLogType] = useState<LogType>('tunnel')
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isScrollLocked, setIsScrollLocked] = useState(false)
  const userExplicitLockRef = useRef(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const { t, language } = useI18n()

  const isToday = selectedDate === todayStr
  const isLive = isToday && logType === 'tunnel'

  // Scroll para o fim quando chegam novos logs (respeitando o Scroll Lock)
  useEffect(() => {
    if (!isScrollLocked && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, isScrollLocked])

  const toggleScrollLock = () => {
    setIsScrollLocked((prev) => {
      const next = !prev
      userExplicitLockRef.current = next
      if (!next && logsEndRef.current) {
        logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
      }
      return next
    })
  }

  const scrollToBottom = () => {
    userExplicitLockRef.current = false
    setIsScrollLocked(false)
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Se o desenvolvedor rolar para cima, ativa o Scroll Lock automaticamente para não interromper a leitura
    if (e.deltaY < 0 && !isScrollLocked) {
      setIsScrollLocked(true)
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 40
    // Se o desenvolvedor rolou de volta até o final e o travamento não foi fixado explicitamente pelo botão, reativa auto-scroll
    if (isAtBottom && isScrollLocked && !userExplicitLockRef.current) {
      setIsScrollLocked(false)
    }
  }

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
            if (event.payload.includes('Node.js 18 and below are deprecated')) return
            if (event.payload.includes('ExperimentalWarning: The Fetch API')) return
            if (event.payload.includes('cli --trace-warnings')) return

            const nowTime = new Date().toLocaleTimeString()
            const parsed = parseLogLine(event.payload, nowTime)
            setLogs((prev) => [...prev, parsed])
          })
        }

        // Escuta logs de sync em tempo real
        if (logType === 'sync' && isToday) {
          unlistenSync = await listen<string>('sync-log', (event) => {
            if (event.payload.includes('Node.js 18 and below are deprecated')) return
            if (event.payload.includes('ExperimentalWarning: The Fetch API')) return
            if (event.payload.includes('cli --trace-warnings')) return

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
        const levelPart = l.level && !['LOG'].includes(l.level)
          ? (l.level.length <= 4 ? `[ ${l.level} ] ` : `[${l.level}] `)
          : ''
        let body = trans
        if (l.level) {
          const dupRegex = new RegExp(`^\\s*\\[\\s*${l.level.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*\\]\\s*`, 'i')
          body = body.replace(dupRegex, '')
        }
        return `${timePart}${levelPart}${body}`
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

            {/* Scroll Lock */}
            <button
              type="button"
              onClick={toggleScrollLock}
              className={`transition-all p-1.5 rounded-lg border flex items-center gap-1.5 text-xs ${
                isScrollLocked
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 font-semibold shadow-sm shadow-amber-500/10 hover:bg-amber-500/30'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
              title={
                isScrollLocked
                  ? t('tunnel_log.scroll_lock_active', 'Scroll Lock Ativo (Auto-rolagem pausada — clique para destravar)')
                  : t('tunnel_log.scroll_lock_inactive', 'Scroll Lock Inativo (Auto-rolagem ativa — clique para travar)')
              }
            >
              {isScrollLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-[11px] hidden sm:inline">{t('tunnel_log.scroll_locked_badge', 'Scroll Travado')}</span>
                </>
              ) : (
                <Unlock className="w-3.5 h-3.5 shrink-0" />
              )}
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
          onWheel={handleWheel}
          onScroll={handleScroll}
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

              // Strip redundant tag from beginning of displayText if already extracted into item.level
              let displayText = translated
              if (item.level) {
                const dupRegex = new RegExp(`^\\s*\\[\\s*${item.level.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*\\]\\s*`, 'i')
                displayText = displayText.replace(dupRegex, '')
              }

              const fullCheckText = `${item.level || ''} ${item.text} ${displayText}`.toUpperCase()

              // 1. Error check (highest priority)
              const isError =
                item.level === 'ERR' ||
                item.level === 'CRIT' ||
                item.level === 'ERROR' ||
                item.level === 'SQL FAILED' ||
                item.level === 'FALHA' ||
                fullCheckText.includes('ERROR') ||
                fullCheckText.includes('ERRO') ||
                fullCheckText.includes('FALHA') ||
                fullCheckText.includes('FAILED') ||
                fullCheckText.includes('FAIL') ||
                fullCheckText.includes('FALLO') ||
                fullCheckText.includes('ORA-') ||
                fullCheckText.includes('EXCEPTION')

              // 2. Specific debug / warning (keep debug traces distinctly yellow)
              const isDebugOrWarning =
                !isError &&
                (item.level === 'WRN' ||
                 item.level === 'WARN' ||
                 item.level === 'AVISO' ||
                 item.level === 'DEBUG' ||
                 item.level === 'BPM-DEBUG' ||
                 fullCheckText.includes('DEBUG') ||
                 fullCheckText.includes('AVISO') ||
                 fullCheckText.includes('WARNING') ||
                 fullCheckText.includes('ADVERTENCIA'))

              // 3. SQL operations (INSERT, DELETE, UPDATE, SELECT)
              const isSqlContext =
                item.level === 'EXEC' ||
                item.level === 'SQL' ||
                item.level === 'OK' ||
                fullCheckText.includes('EXEC') ||
                fullCheckText.includes('SQL')

              const isInsert =
                !isError &&
                !isDebugOrWarning &&
                (isSqlContext || fullCheckText.includes('INSERT')) &&
                (fullCheckText.includes('INSERT') ||
                 fullCheckText.includes('LINHA CRIADA') ||
                 fullCheckText.includes('LINHAS CRIADAS') ||
                 fullCheckText.includes('ROW CREATED') ||
                 fullCheckText.includes('ROWS CREATED'))

              const isDelete =
                !isError &&
                !isDebugOrWarning &&
                (isSqlContext || fullCheckText.includes('DELETE')) &&
                (fullCheckText.includes('DELETE') ||
                 fullCheckText.includes('LINHA REMOVIDA') ||
                 fullCheckText.includes('LINHAS REMOVIDAS') ||
                 fullCheckText.includes('ROW DELETED') ||
                 fullCheckText.includes('ROWS DELETED'))

              const isUpdate =
                !isError &&
                !isDebugOrWarning &&
                !isInsert &&
                !isDelete &&
                (isSqlContext || fullCheckText.includes('UPDATE')) &&
                (fullCheckText.includes('UPDATE') ||
                 fullCheckText.includes('LINHA ATUALIZADA') ||
                 fullCheckText.includes('LINHAS ATUALIZADAS') ||
                 fullCheckText.includes('ROW UPDATED') ||
                 fullCheckText.includes('ROWS UPDATED'))

              const isSelect =
                !isError &&
                !isDebugOrWarning &&
                !isInsert &&
                !isDelete &&
                !isUpdate &&
                (isSqlContext || fullCheckText.includes('SELECT')) &&
                (fullCheckText.includes('SELECT') ||
                 fullCheckText.includes('RETORNOU') ||
                 fullCheckText.includes('RETURNED') ||
                 fullCheckText.includes('COUNT') ||
                 fullCheckText.includes('GET_USERS') ||
                 fullCheckText.includes('BUSCANDO USUÁRIO') ||
                 fullCheckText.includes('BUSCANDO USUARIOS'))

              // 4. Generic Success (for non-SQL statements)
              const isSuccess =
                !isError &&
                !isDebugOrWarning &&
                !isInsert &&
                !isDelete &&
                !isUpdate &&
                !isSelect &&
                (item.level === 'OK' ||
                 fullCheckText.includes('SUCESSO') ||
                 fullCheckText.includes('SUCCESSFULLY') ||
                 fullCheckText.includes('ÉXITO') ||
                 fullCheckText.includes('✓') ||
                 fullCheckText.includes('✅'))

              // Determine tag badge color & line text color
              let tagBadgeColor = 'text-neutral-500 font-bold'
              let lineColor = 'text-neutral-300'

              if (isError) {
                tagBadgeColor = 'text-red-500 font-bold'
                lineColor = 'text-red-400 font-medium'
              } else if (isDebugOrWarning) {
                tagBadgeColor = 'text-yellow-400 font-bold'
                lineColor = 'text-yellow-400'
              } else if (isInsert) {
                tagBadgeColor = 'text-green-400 font-bold'
                lineColor = 'text-green-400'
              } else if (isDelete) {
                tagBadgeColor = 'text-red-500 font-black'
                lineColor = 'text-red-400 font-semibold'
              } else if (isUpdate) {
                tagBadgeColor = 'text-fuchsia-400 font-bold'
                lineColor = 'text-fuchsia-400'
              } else if (isSelect) {
                tagBadgeColor = 'text-cyan-400 font-bold'
                lineColor = 'text-cyan-400'
              } else if (isSuccess) {
                tagBadgeColor = 'text-emerald-400 font-bold'
                lineColor = 'text-emerald-400'
              } else if (item.level === 'EXEC') {
                tagBadgeColor = 'text-amber-400 font-bold'
                lineColor = 'text-neutral-200'
              } else if (item.level === 'SQL') {
                tagBadgeColor = 'text-neutral-400 font-bold'
                lineColor = 'text-neutral-400'
              } else if (item.level === 'SYNC') {
                tagBadgeColor = 'text-blue-400 font-bold'
                lineColor = 'text-neutral-300'
              }

              return (
                <div key={item.id} className={`mb-1 leading-relaxed ${lineColor}`}>
                  {item.time && (
                    <span className="text-neutral-600 mr-2 select-none font-mono">
                      [{item.time}]
                    </span>
                  )}
                  {item.level && !['LOG'].includes(item.level) && (
                    <span className={`font-mono mr-1.5 select-none ${tagBadgeColor}`}>
                      {item.level.length <= 4 ? `[ ${item.level} ]` : `[${item.level}]`}
                    </span>
                  )}
                  <span>{displayText}</span>
                </div>
              )
            })
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Botão Flutuante de Rolar para o Fim quando Scroll Lock estiver ativo */}
        {isScrollLocked && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-4 right-6 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xl shadow-black/70 border border-indigo-400/30 transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-2 hover:scale-105 active:scale-95"
            title={t('tunnel_log.scroll_to_bottom', 'Rolar para o fim')}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>{t('tunnel_log.scroll_to_bottom', 'Rolar para o fim')}</span>
          </button>
        )}
      </div>
    </div>
  )
}
