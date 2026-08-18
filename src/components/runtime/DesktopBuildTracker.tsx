'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle2, X, Download, Cloud, Package, Terminal, Archive, UploadCloud, CheckCircle, FolderOpen, Play } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/i18n/I18nContext'

interface BuildJob {
  jobId: string
  appName: string
}

export function DesktopBuildTracker() {
  const { t } = useI18n()
  const [job, setJob] = useState<BuildJob | null>(null)
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [isVisible, setIsVisible] = useState(false)
  const [stepMessage, setStepMessage] = useState(t('client_views.desktop_tracker.step0', 'Iniciando infraestrutura na Nuvem...'))
  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(15)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [ideDownloadModal, setIdeDownloadModal] = useState<{
    open: boolean;
    phase: 'downloading' | 'done' | 'error';
    fileName: string;
    progress: number;
    savedPath: string;
    savedDir: string;
    canRun: boolean;
    isProject: boolean;
  } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const handleStartEvent = (e: CustomEvent<BuildJob>) => {
      setJob(e.detail)
      setStatus('pending')
      setIsVisible(true)
      setStepMessage(t('client_views.desktop_tracker.step0', 'Iniciando infraestrutura na Nuvem...'))
      setStepIndex(0)
      setProgress(15)
    }

    window.addEventListener('START_DESKTOP_BUILD_TRACKER', handleStartEvent as EventListener)
    return () => {
      window.removeEventListener('START_DESKTOP_BUILD_TRACKER', handleStartEvent as EventListener)
    }
  }, [t])

  useEffect(() => {
    if (!job || status !== 'pending') return

    // Poll the database for the actual status
    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from('desktop_builds')
        .select('status, download_url')
        .eq('id', job.jobId)
        .single()

      if (!error && data) {
        if (data.status === 'success' && data.download_url) {
          setStatus('success')
          setDownloadUrl(data.download_url)
        } else if (data.status === 'error') {
          setStatus('error')
        }
      }
    }, 5000)

    // Simulate progress messages based on typical Github Actions execution time
    let timeElapsed = 0;
    const progressInterval = setInterval(() => {
      timeElapsed += 5; // runs every 5 seconds
      
      if (timeElapsed >= 180) { // 3 minutos
        setStepMessage(t('client_views.desktop_tracker.step4', 'Finalizando e transferindo o arquivo...'))
        setStepIndex(4)
        setProgress(95)
      } else if (timeElapsed >= 120) { // 2 minutos
        setStepMessage(t('client_views.desktop_tracker.step3', 'Empacotando instalador nativo (.msi)...'))
        setStepIndex(3)
        setProgress(85)
      } else if (timeElapsed >= 45) { // 45 segundos
        setStepMessage(t('client_views.desktop_tracker.step2', 'Compilando motor Rust e Webviews...'))
        setStepIndex(2)
        setProgress(65)
      } else if (timeElapsed >= 15) { // 15 segundos
        setStepMessage(t('client_views.desktop_tracker.step1', 'Instalando dependências e SDKs...'))
        setStepIndex(1)
        setProgress(35)
      }
    }, 5000);

    return () => {
      clearInterval(interval)
      clearInterval(progressInterval)
    }
  }, [job, status, supabase, t])

  const handleDownloadClick = () => {
    setIsVisible(false)
    router.push('/client/dashboard?tab=downloads&subtab=workspaces')
  }

  const handleCancelBuild = async () => {
    if (!job) return
    setIsVisible(false)
    try {
      await supabase
        .from('desktop_builds')
        .delete()
        .eq('id', job.jobId)
    } catch (e) {
      console.error('Falha ao cancelar build:', e)
    }
  }

  const handleDirectDownload = async () => {
    if (!downloadUrl) return;
    
    // Check if we are inside Tauri
    const checkTauri = async () => {
      try {
        const { isTauri } = await import('@tauri-apps/api/core')
        return isTauri()
      } catch (e) {
        return false
      }
    }
    
    const isTauriEnv = await checkTauri()
    
    let realFileName = downloadUrl.split('/').pop() || 'app-installer.msi'
    let labelName = `${job?.appName || 'App'} (${realFileName})`

    if (isTauriEnv) {
      setIdeDownloadModal({
        open: true,
        phase: 'downloading',
        fileName: labelName,
        progress: 0,
        savedPath: '',
        savedDir: '',
        canRun: false,
        isProject: true,
      })

      try {
        const abort = new AbortController()
        abortRef.current = abort

        const response = await fetch(downloadUrl, { signal: abort.signal })
        if (!response.ok) throw new Error(t('client_views.downloads.error_start_download', 'Falha ao iniciar download'))

        const contentLength = Number(response.headers.get('content-length') || 0)
        const reader = response.body!.getReader()
        const chunks: Uint8Array[] = []
        let received = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          received += value.length
          const pct = contentLength > 0 ? Math.min(Math.round((received / contentLength) * 100), 99) : 0
          setIdeDownloadModal(prev => prev ? { ...prev, progress: pct } : prev)
        }

        const total = chunks.reduce((a, c) => a + c.length, 0)
        const merged = new Uint8Array(total)
        let offset = 0
        for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length }

        const { downloadDir } = await import('@tauri-apps/api/path')
        const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')

        const dir = await downloadDir()
        const isWindows = dir.includes('\\') || !dir.startsWith('/')
        const separator = isWindows ? '\\' : '/'
        let fullPath = `${dir}${separator}${realFileName}`
        if (isWindows) {
          fullPath = fullPath.replace(/\//g, '\\')
        }

        await writeFile(realFileName, merged, { baseDir: BaseDirectory.Download })

        const canRun = realFileName.toLowerCase().endsWith('.msi')

        setIdeDownloadModal({
          open: true,
          phase: 'done',
          fileName: labelName,
          progress: 100,
          savedPath: fullPath,
          savedDir: dir,
          canRun,
          isProject: true,
        })
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        setIdeDownloadModal(prev => prev ? { ...prev, phase: 'error' } : prev)
      }
      return
    }

    // Fallback for Web browser
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = realFileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleOpenFolder = async (dir: string, fileFullPath: string) => {
    try {
      if (fileFullPath) {
        const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
        await revealItemInDir(fileFullPath)
      } else {
        const { openPath } = await import('@tauri-apps/plugin-opener')
        await openPath(dir)
      }
    } catch (e) {
      try {
        const { openPath } = await import('@tauri-apps/plugin-opener')
        await openPath(dir)
      } catch {}
    }
  }

  const handleRunInstaller = async (path: string, isProject?: boolean) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('runinstaller', { path })

      await new Promise(resolve => setTimeout(resolve, 1500))

      if (!isProject) {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const current = getCurrentWindow()
        await current.close()
      }
    } catch (e) {
      alert(t('client_views.downloads.alert_install_error', 'Não foi possível executar o instalador: ') + e)
    }
  }

  return (
    <>
      <AnimatePresence>
        {isVisible && job && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-6 right-6 z-[9999] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 min-w-[300px]"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  status === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                  status === 'error' ? 'bg-red-500/10 text-red-500' :
                  'bg-indigo-500/10 text-indigo-500'
                }`}>
                  {status === 'success' ? <CheckCircle2 className="w-5 h-5" /> :
                   status === 'error' ? <X className="w-5 h-5" /> :
                   (
                     <div className="relative flex items-center justify-center">
                       <Loader2 className="w-8 h-8 animate-spin absolute opacity-20" />
                       {stepIndex === 0 && <Cloud className="w-4 h-4 animate-pulse" />}
                       {stepIndex === 1 && <Package className="w-4 h-4 animate-pulse" />}
                       {stepIndex === 2 && <Terminal className="w-4 h-4 animate-pulse" />}
                       {stepIndex === 3 && <Archive className="w-4 h-4 animate-pulse" />}
                       {stepIndex === 4 && <UploadCloud className="w-4 h-4 animate-pulse" />}
                     </div>
                   )}
                </div>
                <div>
                  <h4 className="font-bold text-neutral-900 dark:text-white mb-1 leading-none">
                    {status === 'success' ? t('client_views.desktop_tracker.success_title', 'Instalador Pronto!') : 
                     status === 'error' ? t('client_views.desktop_tracker.error_title', 'Erro na Geração') : 
                     stepMessage}
                  </h4>
                  <p className="text-xs text-neutral-500 max-w-[200px] truncate">
                    {job.appName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsVisible(false)}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {status === 'pending' && (
              <>
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden mt-1">
                  <div 
                    className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out relative overflow-hidden" 
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute top-0 left-0 w-full h-full bg-white/20 animate-pulse" />
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    onClick={handleCancelBuild}
                    className="w-full py-2 px-4 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl transition-colors"
                  >
                    {t('client_views.desktop_tracker.cancel_build', 'Cancelar Geração')}
                  </button>
                </div>
              </>
            )}

            {status === 'success' && (
              <div className="pt-2 flex flex-col gap-2">
                {downloadUrl && (
                  <button
                    onClick={() => {
                      setIsVisible(false)
                      handleDirectDownload()
                    }}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    {t('client_views.desktop_tracker.download_now', 'Baixar Instalador Agora')}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* IDE Download Progress Modal */}
      {ideDownloadModal?.open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white text-center">
              <div className="mx-auto bg-white/20 w-14 h-14 rounded-full flex items-center justify-center mb-3">
                {ideDownloadModal.phase === 'done' ? (
                  <CheckCircle className="w-7 h-7 text-white" />
                ) : ideDownloadModal.phase === 'error' ? (
                  <X className="w-7 h-7 text-white" />
                ) : (
                  <Download className="w-7 h-7 text-white" />
                )}
              </div>
              <h3 className="text-lg font-black">
                {ideDownloadModal.phase === 'downloading' && t('client_views.downloads.modal_downloading', 'Baixando...')}
                {ideDownloadModal.phase === 'done' && t('client_views.downloads.modal_download_done', 'Download Concluído!')}
                {ideDownloadModal.phase === 'error' && t('client_views.downloads.modal_download_error', 'Erro no Download')}
              </h3>
              <p className="text-indigo-100 text-sm mt-1 truncate max-w-xs mx-auto">{ideDownloadModal.fileName}</p>
            </div>

            <div className="p-6 space-y-5">
              {/* Progress bar */}
              {ideDownloadModal.phase === 'downloading' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-neutral-500">
                    <span>{t('client_views.downloads.modal_progress', 'Progresso')}</span>
                    <span>{ideDownloadModal.progress}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${ideDownloadModal.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-center text-neutral-400">{t('client_views.downloads.modal_saving_hint', 'Salvando na pasta Downloads do sistema...')}</p>
                </div>
              )}

              {/* Done state */}
              {ideDownloadModal.phase === 'done' && (
                <div className="space-y-3">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3 text-xs text-emerald-700 dark:text-emerald-400 text-center font-medium">
                    {t('client_views.downloads.modal_saved_in', 'Arquivo salvo em:')} <span className="font-bold">Downloads</span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => handleOpenFolder(ideDownloadModal.savedDir, ideDownloadModal.savedPath)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <FolderOpen className="w-4 h-4" />
                      {t('client_views.downloads.modal_open_folder', 'Abrir Pasta')}
                    </button>

                    {ideDownloadModal.canRun ? (
                      <button
                        onClick={() => handleRunInstaller(ideDownloadModal.savedPath, ideDownloadModal.isProject)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                      >
                        <Play className="w-4 h-4" />
                        {t('client_views.downloads.modal_install_now', 'Instalar Agora')}
                      </button>
                    ) : (
                      <div className="flex-1 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400 text-center font-medium flex items-center justify-center">
                        {t('client_views.downloads.modal_close_ide_hint', 'Feche a IDE antes de instalar')}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setIdeDownloadModal(null)}
                    className="w-full text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 font-bold uppercase tracking-widest py-1 transition-colors"
                  >
                    {t('client_views.downloads.modal_close', 'Fechar')}
                  </button>
                </div>
              )}

              {/* Error state */}
              {ideDownloadModal.phase === 'error' && (
                <div className="space-y-3">
                  <p className="text-sm text-center text-red-500 font-medium">{t('client_views.downloads.modal_error_desc', 'Não foi possível completar o download. Tente novamente.')}</p>
                  <button
                    onClick={() => setIdeDownloadModal(null)}
                    className="w-full px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    {t('client_views.downloads.modal_close', 'Fechar')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

