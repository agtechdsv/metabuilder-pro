'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Rocket, FileText, CheckCircle2, AlertCircle, Loader2, Terminal, GitCommit, UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'

export function ReleaseAdminView() {
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

  // Local Git State
  const [gitMessage, setGitMessage] = useState('')
  const [gitStatus, setGitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [gitError, setGitError] = useState('')
  const [gitLog, setGitLog] = useState('')

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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Rocket className="w-6 h-6 text-indigo-500" />
            Lançamento de Releases (IDE)
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Lance novas atualizações do Desktop com apenas 1 clique. Nós cuidamos do versionamento e do Github Actions para você!
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
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
                  { id: 'windows', label: 'Windows (.exe / .msi)', state: buildWindows, setter: setBuildWindows },
                  { id: 'macos', label: 'macOS (.app / .dmg)', state: buildMacOs, setter: setBuildMacOs },
                  { id: 'linux', label: 'Linux (.deb / .AppImage)', state: buildLinux, setter: setBuildLinux },
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
                <h4 className="font-medium">Release criada com sucesso! 🚀</h4>
                <p className="text-sm mt-1 opacity-90">
                  Os arquivos do projeto foram atualizados e a Release está sendo gerada no Github. 
                  O <strong>Github Actions</strong> já está rodando em background para compilar os instaladores e jogar no Supabase!{' '}
                  Pode navegar à vontade por onde quiser! Assim que finalizado iremos lhe avisar!
                </p>
                <a 
                  href={releaseUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-block mt-3 text-sm font-medium hover:underline"
                >
                  Ver release no Github &rarr;
                </a>
              </div>
            </motion.div>
          )}

        </div>
      </motion.div>

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
