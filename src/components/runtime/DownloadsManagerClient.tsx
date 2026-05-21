'use client'

import React, { useState, useEffect } from 'react'
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  FileJson, 
  File,
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  ChevronRight,
  HardDrive,
  Calendar,
  Layers,
  ArrowUpDown,
  ShieldAlert,
  Clock
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'

interface DownloadJob {
  id: string
  project_id: string
  user_id: string
  view_name: string
  model_name?: string
  file_type: string
  file_name: string
  file_path?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  record_count?: number
  file_size?: number
  file_url?: string
  error_message?: string
  workspace_slug?: string
  created_at?: string
  updated_at?: string
}

interface DownloadsManagerClientProps {
  workspaceSlug: string
  projectSlug: string
  projectId: string
  userId: string
}

export function DownloadsManagerClient({
  workspaceSlug,
  projectSlug,
  projectId,
  userId
}: DownloadsManagerClientProps) {
  const supabase = createClient()
  const { toast } = useToast()

  const [jobs, setJobs] = useState<DownloadJob[]>([])
  const [filter, setFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all')
  const [isClearing, setIsClearing] = useState(false)
  const [isDeletingConfirm, setIsDeletingConfirm] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    type: 'single' | 'clear_all'
    jobId?: string
    viewName?: string
  }>({ isOpen: false, type: 'single' })

  // 1. Fetch Jobs
  const fetchJobs = async () => {
    if (!userId || !projectId) return

    try {
      const { data, error } = await supabase
        .from('download_jobs')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setJobs(data || [])
    } catch (err: any) {
      console.error('Error fetching jobs:', err)
      toast(err.message || 'Não foi possível carregar as exportações.', 'error')
    }
  }

  // Trigger a quick, silent background cleanup of expired jobs (>24 hours old)
  const runCleanup = async () => {
    if (!userId) return
    try {
      await fetch('/api/export', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, cleanup: true })
      })
    } catch (err) {
      console.error('[DownloadsPage] Expiry cleanup failed:', err)
    }
  }

  useEffect(() => {
    if (userId && projectId) {
      runCleanup().then(() => fetchJobs())
    }
  }, [userId, projectId])

  // 2. Realtime Subscription to Broadcast Tunnel and download_jobs table
  useEffect(() => {
    if (!userId || !projectId) return

    // A. Listen to the real-time Broadcast Tunnel (instant percentages straight from the worker)
    const broadcastChannel = supabase
      .channel(`tunnel_manager:${projectId}`)
      .on('broadcast', { event: 'download_progress' }, (envelope: any) => {
        const payload = envelope.payload
        console.log('[DownloadsPage] Broadcast progress update received:', payload)
        if (payload && payload.jobId) {
          setJobs(prev => {
            const exists = prev.some(job => job.id === payload.jobId)
            if (exists) {
              return prev.map(job => {
                if (job.id === payload.jobId) {
                  return {
                    ...job,
                    progress: payload.progress,
                    status: payload.status,
                    file_url: payload.fileUrl || job.file_url,
                    file_name: payload.fileName || job.file_name,
                    record_count: payload.recordCount !== undefined ? payload.recordCount : job.record_count,
                    error_message: payload.error || job.error_message,
                    updated_at: new Date().toISOString()
                  }
                }
                return job
              })
            } else {
              const mockJob: DownloadJob = {
                id: payload.jobId,
                user_id: userId,
                workspace_slug: workspaceSlug,
                project_id: projectId,
                view_name: payload.viewName || 'Exportação',
                file_name: payload.fileName || '',
                file_type: (payload.fileName?.split('.').pop() || 'xlsx') as any,
                progress: payload.progress,
                status: payload.status,
                file_url: payload.fileUrl,
                record_count: payload.recordCount || 0,
                error_message: payload.error,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
              return [mockJob, ...prev]
            }
          })
        }
      })
      .subscribe()

    // B. Listen to postgres database changes as a reliable fallback/syncer
    const dbChannel = supabase
      .channel(`realtime_db_manager:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'download_jobs',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('[DownloadsPage] Postgres Realtime change detected:', payload)
          
          if (payload.eventType === 'INSERT') {
            const newJob = payload.new as DownloadJob
            if (newJob.project_id === projectId) {
              setJobs(prev => {
                const exists = prev.some(job => job.id === newJob.id)
                if (exists) return prev
                return [newJob, ...prev]
              })
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedJob = payload.new as DownloadJob
            setJobs(prev => prev.map(job => job.id === updatedJob.id ? updatedJob : job))
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id
            setJobs(prev => prev.filter(job => job.id !== deletedId))
          }
        }
      )
      .subscribe()

    return () => {
      broadcastChannel.unsubscribe()
      dbChannel.unsubscribe()
    }
  }, [userId, projectId, workspaceSlug])

  // 3. Delete Job
  const handleDeleteJob = async (jobId: string) => {
    if (!userId) return
    setIsDeletingConfirm(true)
    try {
      const response = await fetch('/api/export', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, jobId })
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao excluir job')
      }
      
      setJobs(prev => prev.filter(job => job.id !== jobId))
      toast('A exportação selecionada foi permanentemente removida.', 'success')
    } catch (err: any) {
      toast(err.message || 'Não foi possível excluir a exportação.', 'error')
    } finally {
      setIsDeletingConfirm(false)
      setConfirmDialog({ isOpen: false, type: 'single' })
    }
  }

  // 4. Clear completed/failed history
  const handleClearHistory = async () => {
    if (!userId || !projectId) return
    setIsClearing(true)

    try {
      const response = await fetch('/api/export', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, projectId, clearAll: true })
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao limpar histórico')
      }

      setJobs(prev => prev.filter(job => job.status === 'pending' || job.status === 'processing'))
      toast('Todo o histórico de exportações concluídas e falhas foi permanentemente removido.', 'success')
    } catch (err: any) {
      toast(err.message || 'Não foi possível limpar o histórico.', 'error')
    } finally {
      setIsClearing(false)
      setConfirmDialog({ isOpen: false, type: 'clear_all' })
    }
  }

  // 5. Force download of the generated file
  const handleDownloadFile = async (e: React.MouseEvent, url: string, fileName: string) => {
    e.preventDefault()
    toast('Iniciando o download do arquivo...', 'success')

    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Não foi possível obter o arquivo.')
      const blob = await response.blob()
      
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (err: any) {
      console.warn('Erro ao realizar download via blob, abrindo link em nova aba:', err)
      window.open(url, '_blank')
    }
  }

  // Stat calculations
  const totalCount = jobs.length
  const completedCount = jobs.filter(j => j.status === 'completed').length
  const processingCount = jobs.filter(j => j.status === 'processing' || j.status === 'pending').length
  const failedCount = jobs.filter(j => j.status === 'failed').length

  const filteredJobs = jobs.filter(j => {
    if (filter === 'completed') return j.status === 'completed'
    if (filter === 'processing') return j.status === 'processing' || j.status === 'pending'
    if (filter === 'failed') return j.status === 'failed'
    return true
  })

  // Format File Size
  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'N/A'
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="px-10 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-5">
          <div className="p-3.5 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl shadow-xl shadow-indigo-500/30 text-white">
            <HardDrive className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
              Gerenciador de Downloads
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-8 h-1 bg-indigo-600 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                Central de Exportações Assíncronas
              </span>
            </div>
          </div>
        </div>

        {totalCount > 0 && (
          <button
            onClick={() => setConfirmDialog({ isOpen: true, type: 'clear_all' })}
            disabled={isClearing}
            className="flex items-center gap-2 px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-red-600 dark:hover:text-red-400 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
          >
            {isClearing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Limpar Histórico
          </button>
        )}
      </div>

      <main className="px-10 pb-12 space-y-8 animate-in fade-in duration-1000 delay-200">
        {/* Retention Policy Banner */}
        <div className="bg-amber-500/10 dark:bg-amber-400/5 border border-amber-500/20 rounded-[2rem] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl shadow-amber-500/5">
          <div className="flex gap-4 items-start">
            <div className="p-3 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl flex-shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Política de Retenção de Arquivos (24 Horas)
              </h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-3xl leading-normal font-medium">
                Por razões de privacidade, integridade de dados e conformidade, todos os arquivos exportados ficam disponíveis de forma segura por até <strong>24 horas</strong>. Após este período, tanto o arquivo no armazenamento em nuvem (bucket privado) quanto seu histórico de download serão <strong>permanentemente eliminados</strong> do servidor de forma automática.
              </p>
            </div>
          </div>
          <div className="px-4 py-2 bg-amber-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-400 self-start md:self-center border border-amber-500/20 flex-shrink-0">
            Autolimpeza Ativa
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Card 1: Total */}
          <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200/50 dark:border-neutral-800/50 rounded-3xl p-6 flex items-center justify-between shadow-xl shadow-neutral-100/50 dark:shadow-none hover:translate-y-[-2px] transition-all duration-300">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">
                Total Solicitado
              </span>
              <span className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                {totalCount}
              </span>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Completed */}
          <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200/50 dark:border-neutral-800/50 rounded-3xl p-6 flex items-center justify-between shadow-xl shadow-neutral-100/50 dark:shadow-none hover:translate-y-[-2px] transition-all duration-300">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">
                Exportações Concluídas
              </span>
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                {completedCount}
              </span>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Processing */}
          <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200/50 dark:border-neutral-800/50 rounded-3xl p-6 flex items-center justify-between shadow-xl shadow-neutral-100/50 dark:shadow-none hover:translate-y-[-2px] transition-all duration-300">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">
                Em Processamento
              </span>
              <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                {processingCount}
              </span>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <Loader2 className={`w-5 h-5 ${processingCount > 0 ? 'animate-spin' : ''}`} />
            </div>
          </div>

          {/* Card 4: Failed */}
          <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200/50 dark:border-neutral-800/50 rounded-3xl p-6 flex items-center justify-between shadow-xl shadow-neutral-100/50 dark:shadow-none hover:translate-y-[-2px] transition-all duration-300">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">
                Falhas
              </span>
              <span className="text-3xl font-black text-red-600 dark:text-red-400 tracking-tight">
                {failedCount}
              </span>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-2xl">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Tab Controls and List */}
        <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200/50 dark:border-neutral-800/50 rounded-[2rem] overflow-hidden shadow-2xl">
          {/* Tabs header toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-8 py-5 border-b border-neutral-200/50 dark:border-neutral-800/50">
            <div className="flex items-center gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl w-full sm:w-auto">
              <button
                onClick={() => setFilter('all')}
                className={`flex-1 sm:flex-initial px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                  filter === 'all' 
                    ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-md' 
                    : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                }`}
              >
                Todos ({totalCount})
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={`flex-1 sm:flex-initial px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                  filter === 'completed' 
                    ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-md' 
                    : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                }`}
              >
                Concluídos ({completedCount})
              </button>
              <button
                onClick={() => setFilter('processing')}
                className={`flex-1 sm:flex-initial px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                  filter === 'processing' 
                    ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-md' 
                    : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                }`}
              >
                Processando ({processingCount})
              </button>
              <button
                onClick={() => setFilter('failed')}
                className={`flex-1 sm:flex-initial px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                  filter === 'failed' 
                    ? 'bg-white dark:bg-neutral-900 text-red-600 dark:text-red-400 shadow-md' 
                    : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                }`}
              >
                Falhas ({failedCount})
              </button>
            </div>
            
            <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
              {filteredJobs.length} {filteredJobs.length === 1 ? 'arquivo listado' : 'arquivos listados'}
            </div>
          </div>

          {/* List Area */}
          {filteredJobs.length === 0 ? (
            <div className="px-8 py-20 flex flex-col items-center justify-center text-center">
              <div className="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-full text-neutral-400 dark:text-neutral-500 mb-4 animate-bounce">
                <Download className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-black text-neutral-700 dark:text-neutral-300 uppercase tracking-widest">
                Nenhuma exportação encontrada
              </h3>
              <p className="text-xs text-neutral-400 mt-2 max-w-xs leading-normal">
                Clique no botão "Exportar" em qualquer painel ou grade de visualização para gerar planilhas e relatórios assíncronos.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-150/50 dark:divide-neutral-800/40">
              {filteredJobs.map((job) => {
                const isCompleted = job.status === 'completed'
                const isFailed = job.status === 'failed'
                const isProcessing = job.status === 'processing' || job.status === 'pending'
                
                const isXlsx = job.file_type === 'xlsx'
                const isCsv = job.file_type === 'csv'
                const isPdf = job.file_type === 'pdf'

                return (
                  <div 
                    key={job.id} 
                    className="px-8 py-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-neutral-50/40 dark:hover:bg-neutral-800/10 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`p-3.5 rounded-2xl flex-shrink-0 ${
                        isCompleted 
                          ? isXlsx
                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : isCsv
                              ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                              : isPdf
                                ? 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                                : 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                          : isFailed
                            ? 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                            : 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                      }`}>
                        {isCompleted ? (
                          isXlsx ? (
                            <FileSpreadsheet className="w-6 h-6" />
                          ) : isCsv ? (
                            <FileText className="w-6 h-6" />
                          ) : isPdf ? (
                            <File className="w-6 h-6" />
                          ) : (
                            <FileJson className="w-6 h-6" />
                          )
                        ) : isFailed ? (
                          <AlertCircle className="w-6 h-6" />
                        ) : (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        )}
                      </div>

                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black text-neutral-800 dark:text-neutral-100 leading-none truncate max-w-xs">
                            {job.view_name}
                          </h4>
                          <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md ${
                            isXlsx 
                              ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                              : isCsv 
                                ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                                : isPdf
                                  ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                                  : 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                          }`}>
                            {job.file_type}
                          </span>
                        </div>
                        <span className="text-[10px] text-neutral-400 font-bold font-mono tracking-tight truncate max-w-md">
                          {job.file_name || 'Gerando nome de arquivo...'}
                        </span>
                        
                        <div className="flex items-center gap-3.5 mt-1 text-[9px] text-neutral-400 font-semibold uppercase tracking-wider flex-wrap">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                            {new Date(job.created_at || new Date()).toLocaleString('pt-BR')}
                          </span>
                          {isCompleted && (
                            <>
                              <span>•</span>
                              <span>{job.record_count ?? 0} registros</span>
                              <span>•</span>
                              <span>{formatBytes(job.file_size)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 w-full lg:w-64">
                      {isProcessing && (
                        <>
                          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-neutral-400">
                            <span>Processando registros...</span>
                            <span className="text-indigo-600 dark:text-indigo-400">{job.progress}%</span>
                          </div>
                          <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2 overflow-hidden shadow-inner">
                            <div 
                              className="bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-indigo-500 h-2 rounded-full transition-all duration-500 animate-pulse"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        </>
                      )}

                      {isCompleted && (
                        <div className="flex items-center gap-2 self-start lg:self-end">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-xl border border-emerald-250/20">
                            Disponível para download
                          </span>
                        </div>
                      )}

                      {isFailed && (
                        <div className="flex flex-col gap-1 w-full text-left lg:text-right">
                          <span className="text-[9px] font-black uppercase tracking-widest text-red-500 self-start lg:self-end bg-red-50 dark:bg-red-950/20 px-3 py-1.5 rounded-xl border border-red-250/20">
                            Falha no processamento
                          </span>
                          <span className="text-[9px] text-red-400 font-medium leading-normal italic line-clamp-2 max-w-xs mt-1">
                            {job.error_message || 'Erro inesperado ao consultar o banco de dados.'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 self-end lg:self-center">
                      {isCompleted && job.file_url ? (
                        <a
                          href={job.file_url}
                          download={job.file_name}
                          onClick={(e) => handleDownloadFile(e, job.file_url!, job.file_name || 'export_file')}
                          className="flex items-center gap-2 py-3 px-5 bg-gradient-to-tr from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-600/25"
                        >
                          <Download className="w-4 h-4" />
                          Baixar Arquivo
                        </a>
                      ) : (
                        <button
                          disabled
                          className="flex items-center gap-2 py-3 px-5 bg-neutral-100 dark:bg-neutral-800 text-neutral-400 rounded-2xl text-[10px] font-black uppercase tracking-widest opacity-60 cursor-not-allowed"
                        >
                          <Download className="w-4 h-4" />
                          Aguardando...
                        </button>
                      )}

                      <button
                        onClick={() => setConfirmDialog({ isOpen: true, type: 'single', jobId: job.id, viewName: job.view_name })}
                        className="p-3 text-neutral-400 hover:text-red-500 bg-neutral-50 dark:bg-neutral-800/40 hover:bg-red-50 dark:hover:bg-red-950/30 border border-neutral-200/40 dark:border-neutral-850/40 rounded-2xl transition-all active:scale-95"
                        title="Remover do histórico"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Confirmation Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/50 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl scale-in duration-200 animate-in flex flex-col items-center text-center">
            <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-3xl mb-5 shadow-xl shadow-red-500/5">
              <ShieldAlert className="w-8 h-8 animate-bounce" />
            </div>
            
            <h3 className="text-lg font-black text-neutral-900 dark:text-white uppercase tracking-wider">
              {confirmDialog.type === 'single' ? 'Excluir Exportação' : 'Limpar Histórico'}
            </h3>
            
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2.5 leading-relaxed font-medium">
              {confirmDialog.type === 'single' ? (
                <>
                  Você tem certeza que deseja remover permanentemente os dados exportados de <strong>"{confirmDialog.viewName}"</strong>? O arquivo será excluído definitivamente do histórico e do servidor de arquivos.
                </>
              ) : (
                <>
                  Esta ação removerá <strong>todos os registros concluídos e falhas</strong> de exportações deste projeto. Todos os arquivos gerados serão excluídos definitivamente de nossos servidores.
                </>
              )}
            </p>

            <div className="grid grid-cols-2 gap-4 w-full mt-8">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                disabled={isDeletingConfirm || isClearing}
                className="py-3 px-5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (confirmDialog.type === 'single' && confirmDialog.jobId) {
                    handleDeleteJob(confirmDialog.jobId)
                  } else {
                    handleClearHistory()
                  }
                }}
                disabled={isDeletingConfirm || isClearing}
                className="py-3 px-5 bg-gradient-to-tr from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {(isDeletingConfirm || isClearing) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
