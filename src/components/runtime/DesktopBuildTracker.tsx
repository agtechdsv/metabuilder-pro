'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle2, X, Download, Monitor } from 'lucide-react'
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

    return () => clearInterval(interval)
  }, [job, status, supabase])

  const handleDownloadClick = () => {
    setIsVisible(false)
    router.push('/client/downloads?tab=workspaces')
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
                 <Loader2 className="w-5 h-5 animate-spin" />}
              </div>
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                  {status === 'success' ? 'Instalador Pronto!' :
                   status === 'error' ? 'Erro na Geração' :
                   'Gerando App Desktop...'}
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
              <div className="h-full bg-indigo-500 w-1/3 animate-pulse rounded-full" />
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
