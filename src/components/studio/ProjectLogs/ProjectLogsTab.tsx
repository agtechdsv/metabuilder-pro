'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  ScrollText, RefreshCw, Trash2, Save, ChevronDown, ChevronRight,
  AlertCircle, Search, Filter, Clock, Database, Zap, Settings,
  CheckCircle, XCircle, BarChart2, Play, Pause
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

const LOG_TYPES = ['SQL_SELECT', 'SQL_WRITE', 'SQL_ERROR', 'BPM', 'SYNC', 'TUNNEL']

const TYPE_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  SQL_SELECT: { label: 'Leitura',   color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',   icon: Database },
  SQL_WRITE:  { label: 'Escrita',   color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', icon: Database },
  SQL_ERROR:  { label: 'Erro SQL',  color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',     icon: AlertCircle },
  BPM:        { label: 'BPM',       color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', icon: Zap },
  SYNC:       { label: 'Sync',      color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',  icon: RefreshCw },
  TUNNEL:     { label: 'Túnel',     color: 'text-neutral-400', bg: 'bg-neutral-500/10 border-neutral-500/20', icon: Settings },
}

const RETENTION_OPTIONS = [1, 7, 15, 30, 60, 90]

interface ProjectLogsTabProps {
  project: any
  supabase?: any
}

export default function ProjectLogsTab({ project, supabase: supabaseProp }: ProjectLogsTabProps) {
  const supabase = supabaseProp || createClient()
  const { toast } = useToast()

  // ── Config State ─────────────────────────────────────────────────────────
  const [logConfig, setLogConfig] = useState<any>({
    enabled: false,
    types: ['SQL_ERROR'],
    retention_days: 7,
  })
  const [isSavingConfig, setIsSavingConfig] = useState(false)

  // ── Log Viewer State ─────────────────────────────────────────────────────
  const [logs, setLogs] = useState<any[]>([])
  const [totalLogs, setTotalLogs] = useState(0)
  const [stats, setStats] = useState<Record<string, number>>({})
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isClearConfirm, setIsClearConfirm] = useState(false)

  // ── Filters ──────────────────────────────────────────────────────────────
  const [filterType, setFilterType]   = useState('')
  const [filterTable, setFilterTable] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterFrom, setFilterFrom]   = useState('')
  const [filterTo, setFilterTo]       = useState('')
  
  const [logSource, setLogSource] = useState<'db' | 'file'>('db')
  const [fileDate, setFileDate] = useState(new Date().toISOString().slice(0, 10))
  const [page, setPage]               = useState(0)
  const PAGE_SIZE = 50

  // ── Tunnel Helper ─────────────────────────────────────────────────────────
  const executeTunnelQuery = useCallback(async (payload: any): Promise<any> => {
    if (!project) throw new Error('Projeto não definido')
    const channelName = `tunnel:${project.id}`
    const queryId = crypto.randomUUID()
    let finished = false
    const ch = supabase.channel(channelName)

    return new Promise((resolve, reject) => {
      ch.on('broadcast', { event: `query_result_${queryId}` }, (resp: any) => {
        if (finished) return
        finished = true
        try { supabase.removeChannel(ch) } catch (_) {}
        if (resp.payload?.success) resolve(resp.payload)
        else reject(new Error(resp.payload?.error || 'Erro desconhecido'))
      })

      ch.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await ch.send({
            type: 'broadcast', event: 'sql_query',
            payload: { ...payload, queryId, token: project.secret_token, schemaName: project.slug || 'public' }
          })
        }
      })

      setTimeout(() => {
        if (!finished) {
          finished = true
          try { supabase.removeChannel(ch) } catch (_) {}
          reject(new Error('CLI offline. Ligue o MetaBuilder CLI para ver os logs.'))
        }
      }, 8000)
    })
  }, [project, supabase])

  // ── Load Config ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!project) return
    const cfg = project.log_config
    if (cfg) setLogConfig(typeof cfg === 'string' ? JSON.parse(cfg) : cfg)
  }, [project])

  // ── Load Logs ─────────────────────────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    setIsLoadingLogs(true)
    try {
      const filters: any = { limit: PAGE_SIZE, offset: page * PAGE_SIZE }
      if (filterType)   filters.type       = filterType
      if (filterTable)  filters.table_name = filterTable
      if (filterSearch) filters.search     = filterSearch
      
      if (logSource === 'file') {
        filters.source = 'file'
        filters.date   = fileDate
      } else {
        if (filterFrom) filters.from = filterFrom
        if (filterTo)   filters.to   = filterTo
      }

      const resp = await executeTunnelQuery({ action: 'read_logs', filters })
      setLogs(resp.data || [])
      setTotalLogs(resp._total ?? resp.data?.length ?? 0)
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setIsLoadingLogs(false)
    }
  }, [executeTunnelQuery, filterType, filterTable, filterSearch, filterFrom, filterTo, page, toast])

  // ── Load Stats ────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const resp = await executeTunnelQuery({ action: 'get_log_stats' })
      if (resp.data?.[0]) setStats(resp.data[0])
    } catch (_) {}
  }, [executeTunnelQuery])

  // ── Auto Refresh ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(() => { loadLogs(); loadStats() }, 5000)
    } else {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current) }
  }, [autoRefresh, loadLogs, loadStats])

  // ── Load Logs on Filter Change ────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      loadLogs()
      loadStats()
    }, 300)
    return () => clearTimeout(timer)
  }, [filterType, filterTable, filterSearch, filterFrom, filterTo, logSource, fileDate, page, loadLogs, loadStats])

  // ── Save Config ───────────────────────────────────────────────────────────
  const saveConfig = async () => {
    setIsSavingConfig(true)
    try {
      const { error } = await supabase
        .from('projects')
        .update({ log_config: logConfig })
        .eq('id', project.id)
      if (error) throw error
      
      // Envia comando para o CLI sincronizar em tempo real pelo túnel
      try {
        await executeTunnelQuery({ action: 'sync_log_config' })
        toast('Configurações de log salvas e aplicadas em tempo real!', 'success')
      } catch (tErr) {
        toast('Configurações de log salvas! (O CLI está offline, reinicie-o para aplicar).', 'success')
      }
    } catch (err: any) {
      toast('Erro ao salvar: ' + err.message, 'error')
    } finally {
      setIsSavingConfig(false)
    }
  }

  const toggleType = (type: string) => {
    setLogConfig((prev: any) => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter((t: string) => t !== type)
        : [...prev.types, type]
    }))
  }

  // ── Clear Logs ────────────────────────────────────────────────────────────
  const clearLogs = async () => {
    try {
      await executeTunnelQuery({ action: 'clear_logs' })
      setLogs([])
      setTotalLogs(0)
      setStats({})
      setIsClearConfirm(false)
      toast('Logs limpos com sucesso.', 'success')
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  const totalPages = Math.ceil(totalLogs / PAGE_SIZE)

  return (
    <div className="flex gap-6 h-full min-h-[600px]">

      {/* ── LEFT: Config Panel ──────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 space-y-4">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-5">

          {/* Header */}
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10">
              <ScrollText className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Configurações de Log</p>
              <p className="text-[10px] text-neutral-400">Por projeto</p>
            </div>
          </div>

          {/* Enable Toggle */}
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">Ativar Logs</p>
                <p className="text-[10px] text-neutral-400">Habilita ou desabilita o sistema de log</p>
              </div>
              <button
                onClick={() => setLogConfig((p: any) => ({ ...p, enabled: !p.enabled }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${logConfig.enabled ? 'bg-indigo-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${logConfig.enabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            
            {logConfig.enabled && (
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700 flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={logConfig.log_to_db !== false}
                    onChange={(e) => setLogConfig((p: any) => ({ ...p, log_to_db: e.target.checked }))}
                    className="rounded text-indigo-500 focus:ring-indigo-500 bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700" />
                  <span className="text-xs text-neutral-600 dark:text-neutral-300">Gravar no Banco (Dashboard)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={logConfig.log_to_file !== false}
                    onChange={(e) => setLogConfig((p: any) => ({ ...p, log_to_file: e.target.checked }))}
                    className="rounded text-indigo-500 focus:ring-indigo-500 bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700" />
                  <span className="text-xs text-neutral-600 dark:text-neutral-300">Gravar em Arquivo (logs/tunnel-...)</span>
                </label>
              </div>
            )}
          </div>

          {/* Log Types */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Tipos de Log</p>
            {LOG_TYPES.map(type => {
              const meta = TYPE_META[type]
              const Icon = meta.icon
              const active = logConfig.types?.includes(type)
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                    active ? meta.bg + ' border-opacity-50' : 'border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${active ? meta.color : 'text-neutral-400'}`} />
                  <span className={`text-xs font-medium ${active ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-500'}`}>
                    {meta.label}
                  </span>
                  {active && <CheckCircle className={`w-3 h-3 ml-auto ${meta.color}`} />}
                </button>
              )
            })}
          </div>

          {/* Retention */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Retenção</p>
            <div className="grid grid-cols-3 gap-1.5">
              {RETENTION_OPTIONS.map(days => (
                <button
                  key={days}
                  onClick={() => setLogConfig((p: any) => ({ ...p, retention_days: days }))}
                  className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    logConfig.retention_days === days
                      ? 'bg-indigo-500 text-white border-indigo-500'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:border-indigo-300'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={saveConfig}
            disabled={isSavingConfig}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {isSavingConfig ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>

        {/* Stats Card */}
        {Object.keys(stats).length > 0 && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-500" />
              <p className="text-xs font-bold text-neutral-700 dark:text-neutral-200">Resumo da Sessão</p>
            </div>
            {Object.entries(stats).map(([type, count]) => {
              const meta = TYPE_META[type] || { label: type, color: 'text-neutral-400', bg: '' }
              return (
                <div key={type} className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                  <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{count as number}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── RIGHT: Log Viewer ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              value={filterSearch}
              onChange={e => { setFilterSearch(e.target.value); setPage(0) }}
              placeholder="Buscar em mensagem ou SQL..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:outline-none focus:border-indigo-400"
            />
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(0) }}
            className="py-2 px-3 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:outline-none"
          >
            <option value="">Todos os tipos</option>
            {LOG_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t]?.label || t}</option>)}
          </select>

          {/* Table filter */}
          <input
            value={filterTable}
            onChange={e => { setFilterTable(e.target.value); setPage(0) }}
            placeholder="Tabela..."
            className="w-28 py-2 px-3 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:outline-none"
          />

          {/* Source Toggle */}
          <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
            <button onClick={() => { setLogSource('db'); setPage(0) }} className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${logSource === 'db' ? 'bg-white shadow dark:bg-neutral-900 text-indigo-500' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}>Banco</button>
            <button onClick={() => { setLogSource('file'); setPage(0) }} className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${logSource === 'file' ? 'bg-white shadow dark:bg-neutral-900 text-indigo-500' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}>Arquivo</button>
          </div>

          {/* Date range */}
          {logSource === 'db' ? (
            <>
              <input type="datetime-local" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                className="py-2 px-3 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:outline-none" />
              <span className="text-xs text-neutral-400">até</span>
              <input type="datetime-local" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                className="py-2 px-3 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:outline-none" />
            </>
          ) : (
            <input type="date" value={fileDate} onChange={e => setFileDate(e.target.value)}
              className="py-2 px-3 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:outline-none" />
          )}

          {/* Actions */}
          <button onClick={() => { loadLogs(); loadStats() }} disabled={isLoadingLogs}
            className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-indigo-400 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 text-neutral-500 ${isLoadingLogs ? 'animate-spin' : ''}`} />
          </button>

          <button onClick={() => setAutoRefresh(r => !r)}
            className={`p-2 rounded-xl border transition-colors ${autoRefresh ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-500'}`}
            title={autoRefresh ? 'Parar auto-refresh' : 'Auto-refresh 5s'}>
            {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          {!isClearConfirm ? (
            <button onClick={() => setIsClearConfirm(true)}
              className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-red-400 text-neutral-400 hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-500 font-medium">Limpar tudo?</span>
              <button onClick={clearLogs} className="text-xs px-2 py-1 bg-red-500 text-white rounded-lg">Sim</button>
              <button onClick={() => setIsClearConfirm(false)} className="text-xs px-2 py-1 bg-neutral-200 dark:bg-neutral-700 rounded-lg">Não</button>
            </div>
          )}
        </div>

        {/* Count */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">{totalLogs} entrada(s) encontrada(s)</span>
          {autoRefresh && <span className="text-xs text-indigo-500 font-medium animate-pulse">● Auto-refresh ativo</span>}
        </div>

        {/* Table */}
        <div className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
          {logs.length === 0 && !isLoadingLogs ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-neutral-400">
              <ScrollText className="w-8 h-8 opacity-30" />
              <p className="text-sm font-medium">Nenhum log encontrado</p>
              <p className="text-xs">Clique em Atualizar ou aguarde o auto-refresh</p>
              <button onClick={() => { loadLogs(); loadStats() }}
                className="mt-2 px-4 py-2 bg-indigo-500 text-white text-xs font-bold rounded-xl hover:bg-indigo-600 transition-colors">
                Carregar Logs
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                    <th className="text-left px-4 py-3 font-black uppercase tracking-widest text-neutral-400 text-[10px]">Data / Hora</th>
                    <th className="text-left px-4 py-3 font-black uppercase tracking-widest text-neutral-400 text-[10px]">Tipo</th>
                    <th className="text-left px-4 py-3 font-black uppercase tracking-widest text-neutral-400 text-[10px]">Ação</th>
                    <th className="text-left px-4 py-3 font-black uppercase tracking-widest text-neutral-400 text-[10px]">Tabela</th>
                    <th className="text-left px-4 py-3 font-black uppercase tracking-widest text-neutral-400 text-[10px]">Mensagem</th>
                    <th className="text-right px-4 py-3 font-black uppercase tracking-widest text-neutral-400 text-[10px]">ms</th>
                    <th className="text-right px-4 py-3 font-black uppercase tracking-widest text-neutral-400 text-[10px]">Linhas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {logs.map((log, idx) => {
                    const meta = TYPE_META[log.type] || { label: log.type, color: 'text-neutral-400', bg: '', icon: Settings }
                    const Icon = meta.icon
                    const isExpanded = expandedRow === idx
                    const dateObj = new Date(log.created_at)
                    const dateStr = dateObj.toLocaleDateString()
                    const timeStr = dateObj.toLocaleTimeString()
                    return (
                      <>
                        <tr
                          key={log.id}
                          onClick={() => setExpandedRow(isExpanded ? null : idx)}
                          className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-2.5 font-mono text-neutral-500 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              <div className="flex flex-col">
                                <span>{timeStr}</span>
                                <span className="text-[10px] text-neutral-400">{dateStr}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${meta.bg} ${meta.color}`}>
                              <Icon className="w-2.5 h-2.5" />
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-neutral-500 capitalize">{log.action || '—'}</td>
                          <td className="px-4 py-2.5 font-mono text-neutral-600 dark:text-neutral-400">{log.table_name || '—'}</td>
                          <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300 truncate max-w-xs">{log.message || '—'}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-neutral-400">{log.duration_ms ?? '—'}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-neutral-400">{log.row_count ?? '—'}</td>
                        </tr>
                        {isExpanded && (
                          <tr key={`exp-${log.id}`} className="bg-neutral-50 dark:bg-neutral-800/30">
                            <td colSpan={7} className="px-6 py-4 space-y-3">
                              {log.sql_text && (
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">SQL</p>
                                  <pre className="text-xs font-mono bg-neutral-900 dark:bg-black text-green-400 p-3 rounded-xl overflow-x-auto whitespace-pre-wrap">
                                    {log.sql_text}
                                  </pre>
                                </div>
                              )}
                              {log.metadata && (
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Metadata</p>
                                  <pre className="text-xs font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 p-3 rounded-xl overflow-x-auto">
                                    {JSON.stringify(typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                              <div className="grid grid-cols-4 gap-3 text-xs">
                                <div><span className="text-neutral-400">Session ID:</span> <span className="font-mono text-neutral-600 dark:text-neutral-400">{log.session_id || '—'}</span></div>
                                <div><span className="text-neutral-400">Schema:</span> <span className="font-mono text-neutral-600 dark:text-neutral-400">{log.schema_name || '—'}</span></div>
                                <div><span className="text-neutral-400">Data completa:</span> <span className="font-mono text-neutral-600 dark:text-neutral-400">{new Date(log.created_at).toLocaleString()}</span></div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400">
              Página {page + 1} de {totalPages} ({totalLogs} total)
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg disabled:opacity-30 hover:border-indigo-400 transition-colors">
                Anterior
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg disabled:opacity-30 hover:border-indigo-400 transition-colors">
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
