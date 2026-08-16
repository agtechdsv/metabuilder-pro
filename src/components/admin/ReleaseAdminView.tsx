'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Rocket, FileText, CheckCircle2, AlertCircle, Loader2, Terminal, GitCommit, UploadCloud, ExternalLink, Trash2, Calendar, DownloadCloud, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'

export function ReleaseAdminView({ refreshTrigger = false }: { refreshTrigger?: boolean }) {
  const { t } = useI18n()

  const [version, setVersion] = useState('')
  const [generateReleaseNotes, setGenerateReleaseNotes] = useState(true)
  const [releaseNotes, setReleaseNotes] = useState('')
  const [buildWindows, setBuildWindows] = useState(true)
  const [buildMacOs, setBuildMacOs] = useState(true)
  const [buildLinux, setBuildLinux] = useState(true)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [releaseUrl, setReleaseUrl] = useState('')

  // Tabs State
  const [activeTab, setActiveTab] = useState<'launch' | 'history'>('launch')

  // History State
  const [historyReleases, setHistoryReleases] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [deleteConfirmTag, setDeleteConfirmTag] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Bulk Delete State
  const [selectedReleases, setSelectedReleases] = useState<string[]>([])
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)

  // Local Git State
  const [gitMessage, setGitMessage] = useState('')
  const [gitStatus, setGitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [gitError, setGitError] = useState('')
  const [gitLog, setGitLog] = useState('')

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/admin/release/history')
      const data = await res.json()
      if (data.releases) setHistoryReleases(data.releases)
    } catch (e) {
      console.error(e)
    }
    setLoadingHistory(false)
  }

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory()
    }
  }, [activeTab, refreshTrigger])

  const confirmDeleteRelease = async () => {
    if (!deleteConfirmTag) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/release/history?tag=${deleteConfirmTag}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao deletar release')
      await fetchHistory()
    } catch (e) {
      console.error(e)
    }
    setIsDeleting(false)
    setDeleteConfirmTag(null)
  }

  const handleBulkDelete = async () => {
    if (selectedReleases.length === 0) return
    
    setIsBulkDeleting(true)
    try {
      // Deleta um por um em paralelo ou sequencialmente. Sequencialmente é mais seguro para não tomar rate limit da api do github.
      for (const tag of selectedReleases) {
        await fetch(`/api/admin/release/history?tag=${tag}`, { method: 'DELETE' })
      }
      setSelectedReleases([])
      setShowBulkConfirm(false)
      await fetchHistory()
    } catch (e) {
      console.error(e)
    }
    setIsBulkDeleting(false)
  }

  const handleDeploy = async () => {
    if (!version.trim()) {
      setStatus('error')
      setErrorMessage('Por favor, informe a versão (ex: 0.2.0)')
      return
    }

    // Validação básica do formato sem o "v"
    if (version.startsWith('v')) {
      setStatus('error')
      setErrorMessage('Informe apenas os números da versão (ex: 0.2.0), não use o prefixo "v"')
      return
    }

    try {
      setStatus('loading')
      setErrorMessage('')

      const response = await fetch('/api/admin/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: version.trim(),
          generateReleaseNotes,
          releaseNotes: generateReleaseNotes ? '' : releaseNotes,
          buildWindows,
          buildMacOs,
          buildLinux
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro desconhecido ao gerar release')
      }

      setStatus('success')
      setReleaseUrl(data.releaseUrl)

    } catch (error: any) {
      console.error(error)
      setStatus('error')
      setErrorMessage(error.message || 'Falha na comunicação com a API')
    }
  }

  const handleGitAction = async (action: 'commit' | 'push') => {
    if (action === 'commit' && !gitMessage.trim()) {
      setGitError('A mensagem de commit é obrigatória.')
      setGitStatus('error')
      return
    }

    try {
      setGitStatus('loading')
      setGitError('')
      setGitLog('')

      const response = await fetch('/api/admin/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, message: gitMessage })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro na execução do git')
      }

      setGitLog(`STDOUT:\n${data.stdout}\n\nSTDERR:\n${data.stderr}`)
      setGitStatus('success')

      if (action === 'commit') {
        setGitMessage('')
      }
    } catch (error: any) {
      console.error(error)
      setGitStatus('error')
      setGitError(error.message || 'Falha na comunicação')
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Rocket className="w-6 h-6 text-indigo-500" />
              Releases (IDE)
            </h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Lance novas atualizações do Desktop com apenas 1 clique ou gerencie o histórico.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('launch')}
          className={cn(
            "px-4 py-3 text-sm font-bold transition-colors border-b-2",
            activeTab === 'launch'
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          )}
        >
          Lançamento
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            "px-4 py-3 text-sm font-bold transition-colors border-b-2 flex items-center gap-2",
            activeTab === 'history'
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          )}
        >
          Histórico
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'launch' && (
      <motion.div
        key="launch"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm"
      >
        <div className="space-y-6">

          {/* Version Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Nova Versão da IDE
            </label>
            <input
              type="text"
              placeholder="Ex: 0.2.0"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full sm:w-1/3 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Esta versão será alterada automaticamente no package.json e no tauri.conf.json
            </p>
          </div>

          {/* Release Notes Toggle */}
          <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Release Notes Automático
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Deixe o Github preencher as novidades usando os commits mais recentes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGenerateReleaseNotes(!generateReleaseNotes)}
                className={cn(
                  "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  generateReleaseNotes ? "bg-indigo-500" : "bg-zinc-200 dark:bg-zinc-700"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    generateReleaseNotes ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {!generateReleaseNotes && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2"
              >
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Release Notes Personalizado (Markdown)
                </label>
                <textarea
                  rows={5}
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  placeholder="Descreva as novidades desta versão..."
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y"
                />
              </motion.div>
            )}
          </div>

          {/* OS Targets Selection */}
          <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sistemas Operacionais
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Selecione para quais plataformas você deseja gerar os instaladores.
              </p>

              <div className="flex flex-wrap gap-3">
                {[
                  { id: 'windows', label: 'Windows (.exe)', state: buildWindows, setter: setBuildWindows },
                  { id: 'macos', label: 'macOS (.dmg)', state: buildMacOs, setter: setBuildMacOs },
                  { id: 'linux', label: 'Linux (.deb)', state: buildLinux, setter: setBuildLinux },
                ].map((os) => (
                  <button
                    key={os.id}
                    type="button"
                    onClick={() => os.setter(!os.state)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border flex items-center gap-2",
                      os.state
                        ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400 shadow-sm"
                        : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400 hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                    )}
                  >
                    {os.state ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-current opacity-30" />
                    )}
                    {os.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-6 flex justify-end">
            <button
              onClick={handleDeploy}
              disabled={status === 'loading'}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Atualizando Repositório...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  Gerar Release e Disparar Deploy
                </>
              )}
            </button>
          </div>

          {/* Status Feedback */}
          {status === 'error' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-start gap-3 border border-red-100 dark:border-red-900/30"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium">Falha ao lançar release</h4>
                <p className="text-sm mt-1 opacity-90">{errorMessage}</p>
              </div>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-start gap-3 border border-emerald-100 dark:border-emerald-900/30"
            >
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium">Build disparado com sucesso! 🚀</h4>
                <p className="text-sm mt-1 opacity-90">
                  Os arquivos do projeto foram atualizados no Github e o <strong>Github Actions</strong> já está rodando em background para compilar os instaladores e publicar a release automaticamente.
                  Pode navegar à vontade por onde quiser!
                </p>
              </div>
            </motion.div>
          )}

        </div>
      </motion.div>
        )}

        {activeTab === 'history' && (
      <motion.div
        key="history"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm"
      >
        {loadingHistory ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="space-y-4">
            {historyReleases.length === 0 ? (
              <div className="text-center p-8 text-gray-500 dark:text-gray-400">Nenhuma release encontrada no Github.</div>
            ) : (
              <>
                <div className="flex items-center justify-between p-2 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-300">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedReleases.length === historyReleases.length && historyReleases.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedReleases(historyReleases.map(r => r.tag_name));
                        } else {
                          setSelectedReleases([]);
                        }
                      }}
                    />
                    Selecionar Todos
                  </label>
                  {selectedReleases.length > 0 && (
                    <div className="flex items-center justify-end shrink-0">
                      {showBulkConfirm ? (
                        <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                          <span className="text-xs font-bold text-red-500 mr-2">Excluir {selectedReleases.length} releases?</span>
                          <button onClick={() => setShowBulkConfirm(false)} className="p-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                          <button onClick={handleBulkDelete} disabled={isBulkDeleting} className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-50 transition-colors shadow-sm">
                            {isBulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowBulkConfirm(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-medium rounded-lg transition-colors shadow-sm text-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir selecionados ({selectedReleases.length})
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {historyReleases.map(release => (
                  <div key={release.id} className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-indigo-500/50 transition-colors bg-zinc-50 dark:bg-zinc-800/50">
                    <div className="flex items-center gap-4 w-full">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                        checked={selectedReleases.includes(release.tag_name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedReleases([...selectedReleases, release.tag_name]);
                          } else {
                            setSelectedReleases(selectedReleases.filter(id => id !== release.tag_name));
                          }
                        }}
                      />
                      <div className="space-y-3 w-full">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 dark:text-white">{release.name}</h3>
                          <span className="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-full font-mono">{release.tag_name}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {new Date(release.published_at).toLocaleDateString()} às {new Date(release.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="flex items-center gap-1"><DownloadCloud className="w-3.5 h-3.5" /> {release.assets.length} assets disponíveis</span>
                        </div>
                        {release.assets && release.assets.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {release.assets.map((asset: any) => (
                              <a 
                                key={asset.id} 
                                href={asset.browser_download_url} 
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors shadow-sm"
                                title={`Baixar ${asset.name} (${(asset.size / 1024 / 1024).toFixed(2)} MB)`}
                              >
                                <DownloadCloud className="w-3.5 h-3.5" /> 
                                {asset.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  <div className="flex items-start justify-end shrink-0 gap-2">
                    {release.html_url && (
                      <button 
                        onClick={() => window.open(release.html_url, '_blank')} 
                        className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
                        title="Ver no GitHub"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </button>
                    )}
                    {deleteConfirmTag === release.tag_name ? (
                      <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                        <span className="text-xs font-bold text-red-500 mr-2">Excluir Tudo?</span>
                        <button onClick={() => setDeleteConfirmTag(null)} className="p-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                        <button onClick={confirmDeleteRelease} disabled={isDeleting} className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-50 transition-colors shadow-sm">
                          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirmTag(release.tag_name)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
              }
              </>
            )}
          </div>
        )}
      </motion.div>
        )}
      </AnimatePresence>

      {/* LOCAL GIT PANEL */}
      {process.env.NODE_ENV === 'development' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-50 dark:bg-zinc-900 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm mt-8"
        >
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="w-5 h-5 text-zinc-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Painel de Versionamento Local (Dev Only)</h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Ferramentas exclusivas para o seu ambiente de desenvolvimento. Estes botões realizam operações do Git diretamente na sua máquina local.
          </p>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2 w-full">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mensagem do Commit
                </label>
                <input
                  type="text"
                  placeholder="Ex: feat: adiciona novo componente de upload"
                  value={gitMessage}
                  onChange={(e) => setGitMessage(e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleGitAction('commit')}
                  disabled={gitStatus === 'loading'}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-900 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium rounded-lg transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {gitStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCommit className="w-4 h-4" />}
                  Commit All
                </button>
                <button
                  onClick={() => handleGitAction('push')}
                  disabled={gitStatus === 'loading'}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-medium rounded-lg transition-colors border border-zinc-200 dark:border-zinc-700 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {gitStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  Push
                </button>
              </div>
            </div>

            {gitStatus === 'error' && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex gap-2 items-center">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {gitError}
              </div>
            )}

            {gitStatus === 'success' && gitLog && (
              <div className="mt-4 p-4 bg-black rounded-lg overflow-x-auto text-green-400 font-mono text-xs whitespace-pre-wrap">
                {gitLog}
              </div>
            )}
          </div>
        </motion.div>
      )}

    </div>
  )
}
