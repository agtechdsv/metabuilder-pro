'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle2, X, Download, Cloud, Package, Terminal, Archive, UploadCloud } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

interface BuildJob {
  jobId: string
  appName: string
}

export function DesktopBuildTracker() {
  const [job, setJob] = useState<BuildJob | null>(null)
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [isVisible, setIsVisible] = useState(false)
  const [stepMessage, setStepMessage] = useState('Iniciando infraestrutura na Nuvem...')
  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(15)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const handleStartEvent = (e: CustomEvent<BuildJob>) => {
      setJob(e.detail)
      setStatus('pending')
      setIsVisible(true)
    }

    window.addEventListener('START_DESKTOP_BUILD_TRACKER', handleStartEvent as EventListener)
    return () => {
      window.removeEventListener('START_DESKTOP_BUILD_TRACKER', handleStartEvent as EventListener)
    }
  }, [])

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
        setStepMessage('Finalizando e transferindo o arquivo...')
        setStepIndex(4)
        setProgress(95)
      } else if (timeElapsed >= 120) { // 2 minutos
        setStepMessage('Empacotando instalador nativo (.msi)...')
        setStepIndex(3)
        setProgress(85)
      } else if (timeElapsed >= 45) { // 45 segundos
        setStepMessage('Compilando motor Rust e Webviews...')
        setStepIndex(2)
        setProgress(65)
      } else if (timeElapsed >= 15) { // 15 segundos
        setStepMessage('Instalando dependências e SDKs...')
        setStepIndex(1)
        setProgress(35)
      }
    }, 5000);

    return () => {
      clearInterval(interval)
      clearInterval(progressInterval)
    }
  }, [job, status, supabase])

  const handleDownloadClick = () => {
    setIsVisible(false)
    router.push('/client/dashboard?tab=downloads&subtab=workspaces')
  }

  return (
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
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                  {status === 'success' ? 'Instalador Pronto!' :
                   status === 'error' ? 'Erro na Geração' :
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
            <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden mt-1">
              <div 
                className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out relative overflow-hidden" 
                style={{ width: `${progress}%` }}
              >
                <div className="absolute top-0 left-0 w-full h-full bg-white/20 animate-pulse" />
              </div>
            </div>
          )}

          {status === 'success' && (
            <button
              onClick={handleDownloadClick}
              className="mt-2 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              Acessar Central de Downloads
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
