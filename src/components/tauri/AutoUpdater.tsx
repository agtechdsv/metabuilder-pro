'use client'

import { useEffect, useState, useRef } from 'react'
import { check, Update } from '@tauri-apps/plugin-updater'
import { getVersion } from '@tauri-apps/api/app'
import { isTauri } from '@/utils/tauriUtils'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Rocket, X, RefreshCw } from 'lucide-react'
import { usePathname } from 'next/navigation'

export function AutoUpdater() {
  const pathname = usePathname()
  const [updateInfo, setUpdateInfo] = useState<Update | null>(null)
  const [currentVersion, setCurrentVersion] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState({ downloaded: 0, total: 0 })
  const [isOpen, setIsOpen] = useState(false)
  
  const [shownPostLogin, setShownPostLogin] = useState(false)

  // Verifica qual a fase atual
  const isPreLogin = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/auth')
  const isSplash = pathname === '/splash'
  const isPostLogin = !isPreLogin && !isSplash

  useEffect(() => {
    if (!isTauri()) return

    const checkForUpdates = async () => {
      try {
        const appVersion = await getVersion()
        setCurrentVersion(appVersion)

        const update = await check()
        if (update && update.available) {
          setUpdateInfo(update)
        }
      } catch (error) {
        console.error('Erro ao buscar atualizações:', error)
      }
    }

    setTimeout(checkForUpdates, 3000)
  }, [])

  // Efeito que decide se o modal deve abrir baseado na navegação
  useEffect(() => {
    if (!updateInfo) return

    if (isPreLogin || isSplash) {
      setShownPostLogin(false) // reseta se o usuario deslogar
      setIsOpen(false) // Fecha o modal se o usuário for deslogado
    } else if (isPostLogin) {
      if (!shownPostLogin) {
        setIsOpen(true)
        setShownPostLogin(true)
      }
    }
  }, [pathname, updateInfo, isPreLogin, isPostLogin, isSplash, shownPostLogin])

  const handleUpdate = async () => {
    if (!updateInfo) return

    setIsDownloading(true)
    let downloaded = 0
    let contentLength = 0

    try {
      await import('@tauri-apps/api/core').then(m => m.invoke('stopcli')).catch(() => {});
                                    await updateInfo.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0
            setProgress({ downloaded: 0, total: contentLength })
            break
          case 'Progress':
            downloaded += event.data.chunkLength
            setProgress({ downloaded, total: contentLength })
            break
          case 'Finished':
            setIsDownloading(false)
            break
        }
      })
    } catch (error: any) {
      console.error('Erro durante a atualização:', error)
      alert(`Erro na atualização: ${error?.message || String(error)}`)
      setIsDownloading(false)
    }
  }

  if (!isOpen || !updateInfo) return null

  const percentage = progress.total > 0 ? Math.round((progress.downloaded / progress.total) * 100) : 0

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
              {!isDownloading && (
                <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <Rocket className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold">Nova Versão Disponível!</h2>
            <p className="text-indigo-100 mt-2">
              MetaBuilder PRO {updateInfo.version} já está pronta para uso.
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center text-sm">
              <div className="flex flex-col">
                <span className="text-zinc-500 dark:text-zinc-400">Versão Atual</span>
                <span className="font-semibold text-zinc-900 dark:text-white">v{currentVersion}</span>
              </div>
              <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1 mx-4" />
              <div className="flex flex-col text-right">
                <span className="text-zinc-500 dark:text-zinc-400">Nova Versão</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">v{updateInfo.version}</span>
              </div>
            </div>

            {updateInfo.body && (
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800 max-h-32 overflow-y-auto custom-scrollbar text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">
                {updateInfo.body}
              </div>
            )}

            {isDownloading ? (
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <span>Baixando atualização...</span>
                  <span>{percentage}%</span>
                </div>
                <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden relative">
                  <motion.div 
                    className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ ease: "easeOut" }}
                  />
                </div>
                <p className="text-xs text-center text-zinc-400">
                  {(progress.downloaded / 1024 / 1024).toFixed(1)} MB de {(progress.total / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            ) : (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Lembrar mais tarde
                </button>
                <button
                  onClick={handleUpdate}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Instalar e Reiniciar
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
