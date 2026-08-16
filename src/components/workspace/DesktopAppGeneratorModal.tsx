import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Monitor, Upload, Key, Link2, Download, CheckCircle2 } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

interface DesktopAppGeneratorModalProps {
  isOpen: boolean
  onClose: () => void
  contextType: 'workspace' | 'project'
  contextId: string
  defaultName?: string
  defaultDescription?: string
  defaultTunnelUrl?: string
}

export function DesktopAppGeneratorModal({
  isOpen,
  onClose,
  contextType,
  contextId,
  defaultName,
  defaultDescription,
  defaultTunnelUrl
}: DesktopAppGeneratorModalProps) {
  const { t } = useI18n()
  const [appName, setAppName] = useState(defaultName || '')
  const [appDescription, setAppDescription] = useState(defaultDescription || '')
  const [iconBase64, setIconBase64] = useState<string | null>(null)
  const [dbConnectionString, setDbConnectionString] = useState('')
  const [tunnelUrl, setTunnelUrl] = useState(defaultTunnelUrl || '')

  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsGenerating(false)
      setAppName(defaultName || '')
      setAppDescription(defaultDescription || '')
      setTunnelUrl(defaultTunnelUrl || '')
      setIconBase64(null)
      setDbConnectionString('')
    }
  }, [isOpen, defaultName, defaultDescription, defaultTunnelUrl])

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64Src = event.target?.result as string
      
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 512
        canvas.height = 512
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, 512, 512)
          
          // Redimensiona mantendo a proporção (modo 'contain')
          const scale = Math.min(512 / img.width, 512 / img.height)
          const w = img.width * scale
          const h = img.height * scale
          const x = (512 - w) / 2
          const y = (512 - h) / 2
          
          ctx.drawImage(img, x, y, w, h)
          const squaredBase64 = canvas.toDataURL('image/png')
          setIconBase64(squaredBase64)
        }
      }
      img.src = base64Src
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

      const responseData = await response.json()
      const jobId = responseData.jobId

      if (jobId && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('START_DESKTOP_BUILD_TRACKER', {
          detail: { jobId, appName: appName || 'App' }
        }))
      }

      try {
        const { isTauri } = await import('@/utils/tauriUtils')
        if (isTauri()) {
          const { sendNotification } = await import('@tauri-apps/plugin-notification')
          sendNotification({ 
            title: t('ide.desktop_gen.notif_title', 'Build Iniciado 🚀'), 
            body: t('ide.desktop_gen.notif_body', 'A geração do instalador para {app} foi iniciada na nuvem.').replace('{app}', appName || 'o App') 
          })
        }
      } catch {}

      onClose()
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
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                    {t('workspace_components.desktop_generator.title', 'Gerador de Instalador Desktop')}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {t('workspace_components.desktop_generator.subtitle', 'Transforme este {target} em um App Windows (.msi)')
                      .replace('{target}', contextType === 'workspace' ? 'Portal de Aplicações' : 'Projeto')}
                  </p>
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
                <div className="space-y-6">
                  {/* Info Box */}
                  <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/30 bg-indigo-50 dark:bg-indigo-500/5 text-sm text-indigo-800 dark:text-indigo-300">
                    {t('workspace_components.desktop_generator.white_label_box', 'Aplicativo White-Label: Esta ferramenta irá empacotar todo o código fonte atual e gerar um executável seguro, com a sua marca e conexão de banco de dados nativa.')}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
                          {t('workspace_components.desktop_generator.software_name', 'Nome do Software')}
                        </label>
                        <input
                          type="text"
                          value={appName}
                          onChange={e => setAppName(e.target.value)}
                          placeholder={t('workspace_components.desktop_generator.software_name_placeholder', 'Ex: PDV Supermercado X')}
                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
                          {t('workspace_components.desktop_generator.short_desc', 'Descrição Curta')}
                        </label>
                        <input
                          type="text"
                          value={appDescription}
                          onChange={e => setAppDescription(e.target.value)}
                          placeholder={t('workspace_components.desktop_generator.short_desc_placeholder', 'Ex: Sistema de Gestão Interna')}
                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
                          {t('workspace_components.desktop_generator.app_icon', 'Ícone do App (.png)')}
                        </label>
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
                              {t('workspace_components.desktop_generator.upload_icon', 'Upload de Ícone')}
                            </div>
                            <input
                              type="file"
                              accept="image/png"
                              className="hidden"
                              onChange={handleIconUpload}
                            />
                            <p className="text-[10px] text-neutral-500 mt-1 text-center">
                              {t('workspace_components.desktop_generator.icon_hint', 'PNG Quadrado (ex: 512x512)')}
                            </p>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2 flex items-center gap-1">
                          <Key className="w-3 h-3" /> {t('workspace_components.desktop_generator.db_conn_string', 'Connection String do DB (Opcional)')}
                        </label>
                        <textarea
                          value={dbConnectionString}
                          onChange={e => setDbConnectionString(e.target.value)}
                          placeholder={t('workspace_components.desktop_generator.db_conn_placeholder', 'postgresql://user:pass@host:5432/db')}
                          rows={3}
                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono resize-none"
                        />
                        <p className="text-[10px] text-neutral-500 mt-1">
                          {t('workspace_components.desktop_generator.db_conn_hint', 'Se preenchido, esta string será embutida no instalador para conexão direta do Desktop Client.')}
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2 flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> {t('workspace_components.desktop_generator.web_app_url', 'URL da Aplicação Web (Para Modo Wrapper)')}
                        </label>
                        <input
                          type="text"
                          value={tunnelUrl}
                          onChange={e => setTunnelUrl(e.target.value)}
                          placeholder={t('workspace_components.desktop_generator.web_app_url_placeholder', 'https://www.metabuilderpro.com/agtechtrade/crm')}
                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                        <p className="text-[10px] text-neutral-500 mt-1">
                          {t('workspace_components.desktop_generator.web_app_url_hint', 'Endereço do backend central caso este app seja um Client.')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
            </div>

            {/* Footer */}
              <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  disabled={isGenerating}
                  className="px-6 py-2 text-sm font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  {t('workspace_components.desktop_generator.cancel', 'Cancelar')}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !appName}
                  className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t('workspace_components.desktop_generator.starting_build', 'Iniciando Build...')}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      {t('workspace_components.desktop_generator.generate_btn', 'Gerar Instalador (.msi)')}
                    </>
                  )}
                </button>
              </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

