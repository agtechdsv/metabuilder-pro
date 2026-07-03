'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/utils/supabase/client'
import { CheckCircle2, X, Rocket, ExternalLink, Package } from 'lucide-react'

interface ReleaseNotification {
  version: string
  name: string
  category: string
}

export function ReleaseCompletionNotifier() {
  const [notification, setNotification] = useState<ReleaseNotification | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const subscribedRef = useRef(false)

  useEffect(() => {
    if (subscribedRef.current) return
    subscribedRef.current = true

    const supabase = createClient()

    const channel = supabase
      .channel('release-completion-notifier')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'app_downloads',
          filter: "category=in.(ide-win,ide-mac,ide-linux)"
        },
        (payload) => {
          const record = payload.new as any
          if (record.category?.startsWith('ide-')) {
            setNotification({
              version: record.version,
              name: record.name,
              category: record.category,
            })
            setIsVisible(true)

            // Auto-hide after 12 seconds
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            timeoutRef.current = setTimeout(() => {
              setIsVisible(false)
            }, 12000)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }

  const getCategoryLabel = (category: string) => {
    if (category === 'ide-win') return 'Windows'
    if (category === 'ide-mac') return 'macOS'
    if (category === 'ide-linux') return 'Linux'
    return category
  }

  return (
    <AnimatePresence>
      {isVisible && notification && (
        <motion.div
          initial={{ opacity: 0, y: 80, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 80, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-6 right-6 z-[9999] w-full max-w-sm"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 rounded-2xl blur-xl -z-10" />

          <div className="relative bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl shadow-2xl shadow-emerald-500/10 overflow-hidden">
            {/* Top accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-indigo-500" />

            <div className="p-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Rocket className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Build Concluído!
                    </p>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                      Instalador Pronto 🎉
                    </h4>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-500/5 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                  <Package className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Plataforma</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {notification.name}
                    </p>
                  </div>
                  <span className="ml-auto flex-shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-200 dark:border-emerald-700">
                    {getCategoryLabel(notification.category)}
                  </span>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  O instalador da versão <strong className="text-gray-700 dark:text-gray-300">v{notification.version}</strong> foi compilado e está disponível para download no Supabase e no Github.
                </p>
              </div>

              {/* Actions */}
              <div className="mt-4 flex items-center gap-2">
                <a
                  href={`https://github.com/agtechdsv/metabuilder-pro/releases/tag/v${notification.version}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ver no Github
                </a>
                <button
                  onClick={handleDismiss}
                  className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-600 dark:text-gray-400 text-xs font-semibold rounded-lg transition-colors"
                >
                  Dispensar
                </button>
              </div>
            </div>

            {/* Progress bar (auto-dismiss countdown) */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 12, ease: 'linear' }}
              style={{ transformOrigin: 'left' }}
              className="h-0.5 w-full bg-gradient-to-r from-emerald-400 to-indigo-500 opacity-40"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
