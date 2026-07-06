'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HeaderActions } from '@/components/layout/HeaderActions'
import { LoginForm } from '@/components/auth/LoginForm'
import { Zap, Code2, Info, X, FileText, Rocket, History, Download, ChevronDown, ChevronUp } from 'lucide-react'

export function IDELanding({ user }: { user: any }) {
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const [releaseNotesList, setReleaseNotesList] = useState<any[]>([])
  const [isFetchingNotes, setIsFetchingNotes] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [localVersion, setLocalVersion] = useState<string | null>(null)

  useEffect(() => {
    // Fetch the latest release notes from GitHub (for the modal)
    setIsFetchingNotes(true)
    fetch('/api/releases')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setReleaseNotesList(data)
        }
      })
      .finally(() => setIsFetchingNotes(false))
    // Fetch the real installed version based on environment
    const checkVersion = async () => {
      const { isTauri } = await import('@tauri-apps/api/core')
      const isTauriEnv = isTauri()

      if (!isTauriEnv) {
        setLocalVersion('Web App Edition')
        return
      }

      // 1. Fetch Version Independently
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
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-black text-neutral-900 dark:text-white flex flex-col relative overflow-hidden font-sans transition-colors duration-500">
      {/* Background glow effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="w-full px-8 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <img src="/logo-crystal.png" alt="MetaBuilder PRO" className="w-10 h-10 object-contain drop-shadow-md" />
          <h1 className="text-xl font-bold tracking-tight">
            MetaBuilder<span className="text-indigo-600 dark:text-indigo-500">PRO</span>
          </h1>
        </div>
        <HeaderActions hideUser={true} />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 px-8 py-12 max-w-7xl mx-auto w-full relative z-10">

        {/* Left Side: Welcome & Features */}
        <div className="flex-1 flex flex-col items-start max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                {localVersion || 'Carregando...'}
              </div>

              <button
                onClick={() => setShowReleaseNotes(true)}
                title="Ver Histórico de Atualizações"
                className="p-1.5 rounded-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
              </button>
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight mb-6">
              O futuro do <br />
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 dark:from-indigo-400 dark:via-purple-400 dark:to-emerald-400 bg-clip-text text-transparent">
                desenvolvimento
              </span>
            </h2>
            <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-10 leading-relaxed">
              Bem-vindo ao MetaBuilder PRO IDE. Estruture interfaces premium, conecte bancos de dados e gere código de alta qualidade em tempo recorde.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 shadow-sm flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h4 className="font-bold">Performance Nativa</h4>
                  <p className="text-sm text-neutral-600 dark:text-neutral-500 mt-1">Acesso direto ao sistema de arquivos local para geração ultra-rápida de código.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 shadow-sm flex items-center justify-center shrink-0">
                  <Code2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-bold">Editor Avançado</h4>
                  <p className="text-sm text-neutral-600 dark:text-neutral-500 mt-1">Inteligência de metadados integrada diretamente no seu ambiente de trabalho.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Side: Login Box */}
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="bg-white/80 dark:bg-neutral-900/50 backdrop-blur-xl border border-neutral-200 dark:border-white/10 p-8 rounded-[2rem] shadow-2xl">
            <h3 className="text-xl font-bold mb-6 text-center">Acesse sua conta</h3>
            <LoginForm />
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-6 text-xs text-neutral-500 dark:text-neutral-600 relative z-10">
        &copy; {new Date().getFullYear()} AgTech Development. Todos os direitos reservados.
      </footer>

      {/* Release Notes Modal */}
      <AnimatePresence>
        {showReleaseNotes && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center overflow-hidden">
                    <img src="/logo-transparent.png" alt="MetaBuilder PRO" className="w-8 h-8 object-contain" />
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
                  <div className="space-y-8 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-neutral-200 dark:before:via-neutral-800 before:to-transparent">

                    {/* Botão de Atualizar no topo se tiver nova versão */}
                    {releaseNotesList.length > 0 && localVersion && (
                      (() => {
                        const installed = localVersion.replace('IDE Engine v', '').trim()
                        const latest = releaseNotesList[0].version.replace('v', '')
                        const isOutdated = localVersion.startsWith('IDE Engine') && installed !== latest && installed !== 'Erro:' && !localVersion.includes('Erro')

                        if (isOutdated) {
                          return (
                            <div className="relative flex items-center justify-center mb-10 z-10">
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

                    {releaseNotesList.map((release, i) => {
                      const isCurrent = localVersion ? localVersion.includes(release.version.replace('v', '')) : false
                      const isExpanded = !!expandedNotes[release.version]
                      const isLatest = i === 0

                      return (
                        <div key={release.version} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                          {/* Icon */}
                          <div className="flex items-center justify-center w-6 h-6 rounded-full border-4 border-white dark:border-neutral-900 bg-indigo-500 text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow z-10">
                            <div className="w-1.5 h-1.5 bg-white rounded-full" />
                          </div>

                          {/* Card */}
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
                                  <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-600 dark:text-neutral-300 bg-transparent border-0 p-0 m-0 leading-relaxed">
                                      {release.body
                                        .replace(/\*\*Full Changelog\*\*:.*?(\n|$)/g, '')
                                        .split('\n')
                                        .filter((line: any) => {
                                          const cleanLine = line.replace(/^[^a-zA-Z0-9]+/, '').toLowerCase()
                                          return !cleanLine.startsWith('chore:') && !cleanLine.startsWith('merge')
                                        })
                                        .join('\n')
                                        .trim() || 'Sem detalhes para esta versão.'}
                                    </pre>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      )
                    })}
                  </div>
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
    </div>
  )
}
