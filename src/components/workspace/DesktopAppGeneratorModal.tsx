import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Monitor, Upload, Key, Link2, Download, CheckCircle2 } from 'lucide-react'

interface DesktopAppGeneratorModalProps {
  isOpen: boolean
  onClose: () => void
  contextType: 'workspace' | 'project'
  contextId: string
  defaultName?: string
  defaultDescription?: string
}

export function DesktopAppGeneratorModal({
  isOpen,
  onClose,
  contextType,
  contextId,
  defaultName,
  defaultDescription
}: DesktopAppGeneratorModalProps) {
  const [appName, setAppName] = useState(defaultName || '')
  const [appDescription, setAppDescription] = useState(defaultDescription || '')
  const [iconBase64, setIconBase64] = useState<string | null>(null)
  const [dbConnectionString, setDbConnectionString] = useState('')
  const [tunnelUrl, setTunnelUrl] = useState('')

  const [isGenerating, setIsGenerating] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setIconBase64(base64)
    }
    reader.readAsDataURL(file)
  }

  const handleGenerate = async () => {
    try {
      setIsGenerating(true)
      // Call the API endpoint
      const response = await fetch('/api/build-desktop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contextType,
          contextId,
          appName,
          appDescription,
          iconBase64,
          dbConnectionString,
          tunnelUrl
        })
      })

      if (!response.ok) {
        throw new Error('Falha ao iniciar geração')
      }

      setIsSuccess(true)
    } catch (error) {
      console.error(error)
      alert('Erro ao gerar aplicativo: ' + (error as Error).message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-black/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center overflow-hidden text-indigo-600 dark:text-indigo-400">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Gerador de Instalador Desktop</h3>
                  <p className="text-xs text-neutral-500">Transforme este {contextType === 'workspace' ? 'Portal de Aplicações' : 'Projeto'} em um App Windows (.msi)</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 transition-colors"
                disabled={isGenerating}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              {isSuccess ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </div>
                  <h3 className="text-2xl font-black mb-2 text-neutral-900 dark:text-white">Build Iniciado na Nuvem!</h3>
                  <p className="text-neutral-500 mb-8 max-w-sm">
                    A infraestrutura do GitHub Actions está compilando o seu instalador Windows. Isso pode levar de 3 a 5 minutos. Você receberá o arquivo <strong>{appName || 'App'}.msi</strong> quando estiver pronto.
                  </p>
                  <button
                    onClick={onClose}
                    className="px-8 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold rounded-xl shadow-xl hover:scale-105 active:scale-95 transition-all"
                  >
                    Entendido, Fechar
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Info Box */}
                  <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/30 bg-indigo-50 dark:bg-indigo-500/5 text-sm text-indigo-800 dark:text-indigo-300">
                    <strong>Aplicativo White-Label:</strong> Esta ferramenta irá empacotar todo o código fonte atual e gerar um executável seguro, com a sua marca e conexão de banco de dados nativa.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Nome do Software</label>
                        <input
                          type="text"
                          value={appName}
                          onChange={e => setAppName(e.target.value)}
                          placeholder="Ex: PDV Supermercado X"
                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Descrição Curta</label>
                        <input
                          type="text"
                          value={appDescription}
                          onChange={e => setAppDescription(e.target.value)}
                          placeholder="Ex: Sistema de Gestão Interna"
                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Ícone do App (.png)</label>
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 overflow-hidden shrink-0">
                            {iconBase64 ? (
                              <img src={iconBase64} alt="Icon Preview" className="w-full h-full object-contain p-2" />
                            ) : (
                              <Monitor className="w-6 h-6 text-neutral-400" />
                            )}
                          </div>
                          <label className="flex-1 cursor-pointer">
                            <div className="flex items-center justify-center gap-2 px-4 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors text-sm font-medium">
                              <Upload className="w-4 h-4" />
                              Upload de Ícone
                            </div>
                            <input
                              type="file"
                              accept="image/png"
                              className="hidden"
                              onChange={handleIconUpload}
                            />
                            <p className="text-[10px] text-neutral-500 mt-1 text-center">PNG Quadrado (ex: 512x512)</p>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2 flex items-center gap-1">
                          <Key className="w-3 h-3" /> Connection String do DB (Opcional)
                        </label>
                        <textarea
                          value={dbConnectionString}
                          onChange={e => setDbConnectionString(e.target.value)}
                          placeholder="postgresql://user:pass@host:5432/db"
                          rows={3}
                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono resize-none"
                        />
                        <p className="text-[10px] text-neutral-500 mt-1">Se preenchido, esta string será embutida no instalador para conexão direta do Desktop Client.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2 flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> URL da Aplicação Web (Para Modo Wrapper)
                        </label>
                        <input
                          type="text"
                          value={tunnelUrl}
                          onChange={e => setTunnelUrl(e.target.value)}
                          placeholder="https://www.metabuilderpro.com/agtechtrade/crm"
                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                        <p className="text-[10px] text-neutral-500 mt-1">Endereço do backend central caso este app seja um Client.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {!isSuccess && (
              <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  disabled={isGenerating}
                  className="px-6 py-2 text-sm font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !appName}
                  className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Iniciando Build...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Gerar Instalador (.msi)
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
