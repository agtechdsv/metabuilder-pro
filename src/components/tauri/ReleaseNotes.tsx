'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { History, X, Download, ChevronDown, ChevronUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useI18n } from '@/i18n/I18nContext'

export function ReleaseNotes({ variant = 'header' }: { variant?: 'header' | 'pill' }) {
  const { language } = useI18n()
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const [releaseNotesList, setReleaseNotesList] = useState<any[]>([])
  const [isFetchingNotes, setIsFetchingNotes] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [localVersion, setLocalVersion] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const checkVersion = async () => {
      const { isTauri } = await import('@tauri-apps/api/core')
      const isTauriEnv = isTauri()

      if (!isTauriEnv) {
        setLocalVersion('Web App Edition')
        return
      }

      try {
        const { getVersion } = await import('@tauri-apps/api/app')
        const v = await getVersion()
        setLocalVersion(`IDE Engine v${v}`)
      } catch (e: any) {
        console.error('Failed to get Tauri version', e)
        setLocalVersion(`Erro: ${e.message || String(e)}`)
      }
    }
    checkVersion()
  }, [])

  useEffect(() => {
    if (showReleaseNotes) {
      setIsFetchingNotes(true)
      fetch(`/changelog.json?t=${Date.now()}`, { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            const mappedReleases = Object.entries(data)
              .map(([version, info]: [string, any]) => {
                const lines = info[language] || info.en || info.pt || []
                const body = lines.map((l: string) => {
                  const trimmed = l.trim()
                  if (trimmed.startsWith('#') || trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed === '') {
                    return l
                  }
                  return `- ${l}`
                }).join('\n')
                return {
                  version,
                  published_at: info.date,
                  body
                }
              })
              .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
            setReleaseNotesList(mappedReleases)
          } else if (Array.isArray(data)) {
            // Fallback for old array format just in case
            setReleaseNotesList(data)
          }
        })
        .finally(() => setIsFetchingNotes(false))
    }
  }, [showReleaseNotes, language])

  const modalContent = (
    <AnimatePresence>
      {showReleaseNotes && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center overflow-hidden">
                  <img src="/icon-desktop-square.png" alt="MetaBuilder PRO" className="w-8 h-8 object-contain" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Histórico de Atualizações</h3>
                  <p className="text-xs text-neutral-500">Acompanhe as novidades do MetaBuilder PRO</p>
                </div>
              </div>
              <button
                onClick={() => setShowReleaseNotes(false)}
                className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              {isFetchingNotes ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-sm">Buscando histórico...</p>
                </div>
              ) : (
                <>
                  {releaseNotesList.length > 0 && localVersion && (
                    (() => {
                      const installed = localVersion.replace('IDE Engine v', '').trim()
                      const latest = releaseNotesList[0].version.replace('v', '')
                      const isOutdated = localVersion.startsWith('IDE Engine') && installed !== latest && installed !== 'Erro:' && !localVersion.includes('Erro')

                      if (isOutdated) {
                        return (
                          <div className="sticky top-0 z-30 flex items-center justify-center pb-6 pt-2 bg-white/95 dark:bg-black/95 backdrop-blur-sm -mx-6 px-6 -mt-4 mb-8 shadow-sm">
                            <button
                              onClick={async () => {
                                try {
                                  setIsUpdating(true)
                                  const { check } = await import('@tauri-apps/plugin-updater')
                                  const update = await check()
                                  if (update) {
                                    await update.downloadAndInstall()
                                  }
                                } catch (e) {
                                  console.error('Update failed', e)
                                } finally {
                                  setIsUpdating(false)
                                }
                              }}
                              disabled={isUpdating}
                              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-full shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
                            >
                              {isUpdating ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  Atualizando...
                                </>
                              ) : (
                                <>
                                  <Download className="w-4 h-4" />
                                  Atualizar para a versão {latest}
                                </>
                              )}
                            </button>
                          </div>
                        )
                      }
                      return null
                    })()
                  )}

                  <div className="space-y-8 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-neutral-200 dark:before:via-neutral-800 before:to-transparent">
                    {releaseNotesList.map((release, i) => {
                      const isCurrent = localVersion ? localVersion.includes(release.version.replace('v', '')) : false
                      const isExpanded = !!expandedNotes[release.version]
                      const isLatest = i === 0

                      let finalBody = release.body
                      if (finalBody === '' || !finalBody) finalBody = 'Sem detalhes para esta versão.'

                      return (
                        <div key={release.version} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full border-4 border-white dark:border-neutral-900 bg-indigo-500 text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow z-10">
                            <div className="w-1.5 h-1.5 bg-white rounded-full" />
                          </div>

                          <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl bg-white dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 shadow-sm transition-all hover:shadow-md">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-lg text-indigo-600 dark:text-indigo-400">{release.version}</span>
                              <time className="text-xs text-neutral-400">
                                {new Date(release.published_at).toLocaleDateString('pt-BR')}
                              </time>
                            </div>
                            
                            <div className="mb-2">
                              {isCurrent ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                                  Versão Atual
                                </span>
                              ) : isLatest ? (
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                                  Nova Versão
                                </span>
                              ) : null}
                            </div>

                            <button 
                              onClick={() => setExpandedNotes(prev => ({ ...prev, [release.version]: !prev[release.version] }))}
                              className="flex items-center gap-1 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                              Release Notes
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                  animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
                                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-300">
                                    <ReactMarkdown 
                                      remarkPlugins={[remarkGfm]}
                                      components={{
                                        p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />,
                                        h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-6 mb-4 text-neutral-900 dark:text-white" {...props} />,
                                        h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-5 mb-3 text-neutral-900 dark:text-white" {...props} />,
                                        h3: ({node, ...props}) => <h3 className="text-base font-bold mt-4 mb-2 text-neutral-900 dark:text-white" {...props} />,
                                        ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
                                        ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />,
                                        li: ({node, ...props}) => <li className="pl-1" {...props} />,
                                        strong: ({node, ...props}) => <strong className="font-bold text-neutral-900 dark:text-white" {...props} />,
                                        a: ({node, ...props}) => <a className="text-indigo-600 dark:text-indigo-400 hover:underline" {...props} />,
                                        code: ({node, ...props}) => <code className="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-indigo-600 dark:text-indigo-400" {...props} />
                                      }}
                                    >
                                      {finalBody}
                                    </ReactMarkdown>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex justify-end">
              <button
                onClick={() => setShowReleaseNotes(false)}
                className="px-6 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-bold rounded-lg hover:opacity-90 transition-opacity"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <button
        onClick={() => {
          setExpandedNotes({})
          setShowReleaseNotes(true)
        }}
        title="Ver Histórico de Atualizações"
        className={
          variant === 'header'
            ? "flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-indigo-600 hover:text-white hover:bg-indigo-600 dark:hover:bg-indigo-600 transition-colors shadow-sm cursor-pointer group"
            : "p-1.5 rounded-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm cursor-pointer"
        }
      >
        <History className={variant === 'header' ? "w-5 h-5 group-hover:rotate-[-30deg] transition-transform" : "w-3.5 h-3.5"} />
      </button>

      {mounted && typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null}
    </>
  )
}
