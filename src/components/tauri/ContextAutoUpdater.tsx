'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Rocket, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { isTauri } from '@/utils/tauriUtils'

interface ContextAutoUpdaterProps {
  contextType: 'project' | 'workspace'
  contextId: string
  appName?: string
}

/**
 * Auto-updater for client desktop apps (project or workspace).
 * Instead of using tauri-plugin-updater (which requires signed update servers),
 * it polls the Supabase builds table via API and shows a banner when a newer
 * build exists than the currently installed version.
 */
export function ContextAutoUpdater({ contextType, contextId, appName }: ContextAutoUpdaterProps) {
  const pathname = usePathname()
  const [latestBuild, setLatestBuild] = useState<{ version: string; download_url: string; body?: string } | null>(null)
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [shownOnce, setShownOnce] = useState(false)

  const isPreLogin = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/auth')
  const isSplash = pathname === '/splash'
  const isPostLogin = !isPreLogin && !isSplash

  useEffect(() => {
    if (!isTauri()) return
    const getInstalledVersion = async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app')
        const v = await getVersion()
        setCurrentVersion(v)
      } catch {
        setCurrentVersion(null)
      }
    }
    getInstalledVersion()
  }, [])

  useEffect(() => {
    if (!isTauri() || !contextId) return

    const check = async () => {
      try {
        const res = await fetch(
          `/api/releases/context?contextType=${contextType}&contextId=${contextId}&t=${Date.now()}`,
          { cache: 'no-store' }
        )
        const data = await res.json()
        const builds: any[] = data?.releases || []
        if (builds.length > 0 && builds[0].download_url && builds[0].status === 'success') {
          setLatestBuild({
            version: builds[0].version?.replace(/^v/, '') || '?',
            download_url: builds[0].download_url,
            body: builds[0].body
          })
        }
      } catch (e) {
        console.warn('[ContextAutoUpdater] Failed to check for updates:', e)
      }
    }

    const timeout = setTimeout(check, 5000)
    const interval = setInterval(check, 5 * 60 * 1000)
    return () => { clearTimeout(timeout); clearInterval(interval) }
  }, [contextType, contextId])

  useEffect(() => {
    if (!latestBuild || shownOnce) return
    const isOutdated = currentVersion === null || currentVersion !== latestBuild.version
    if (isPostLogin && isOutdated) {
      setIsOpen(true)
      setShownOnce(true)
    }
  }, [pathname, latestBuild, currentVersion, isPostLogin, shownOnce])

  const handleDownload = async () => {
    if (!latestBuild?.download_url) return
    try {
      if (isTauri()) {
        const { open } = await import('@tauri-apps/plugin-shell')
        await open(latestBuild.download_url)
      } else {
        window.open(latestBuild.download_url, '_blank')
      }
      setIsOpen(false)
    } catch (e) {
      console.error('Failed to open download URL', e)
    }
  }

  if (!isOpen || !latestBuild) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="relative bg-gradient-to-r from-indigo-500 to-purple-600 p-8 text-white text-center">
            <div className="absolute top-4 right-4">
              <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <Rocket className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold">Nova Versão Disponível!</h2>
            <p className="text-indigo-100 mt-2">
              {appName || 'O aplicativo'} {latestBuild.version} já está pronta para uso.
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center text-sm">
              <div className="flex flex-col">
                <span className="text-zinc-500 dark:text-zinc-400">Versão Atual</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{currentVersion ? `v${currentVersion}` : 'Desconhecida'}</span>
              </div>
              <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1 mx-4" />
              <div className="flex flex-col text-right">
                <span className="text-zinc-500 dark:text-zinc-400">Nova Versão</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">v{latestBuild.version}</span>
              </div>
            </div>

            {latestBuild.body && (
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800 max-h-32 overflow-y-auto custom-scrollbar text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">
                {latestBuild.body}
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Lembrar mais tarde
              </button>
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors"
              >
                <Download className="w-5 h-5" />
                <span>Baixar Instalador (v{latestBuild.version})</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
