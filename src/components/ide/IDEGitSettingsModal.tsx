import React, { useState, useEffect } from 'react'
import { X, Save, Cloud, GitBranch, Network, ShieldCheck, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { GitConfigManager, GitConfig } from '@/utils/gitConfigManager'
import { useToast } from '@/components/ui/Toast'

interface IDEGitSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  projectSlug: string
}

export function IDEGitSettingsModal({ isOpen, onClose, projectSlug }: IDEGitSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'auth' | 'pipeline'>('auth')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()
  
  const [config, setConfig] = useState<GitConfig>({
    remoteUrl: '',
    accessToken: '',
    branchLocal: 'local',
    branchUpstream: 'upstream',
    branchSandbox: 'sync-sandbox'
  })

  useEffect(() => {
    if (isOpen) {
      loadConfig()
    }
  }, [isOpen, projectSlug])

  const loadConfig = async () => {
    setIsLoading(true)
    try {
      const manager = new GitConfigManager(projectSlug)
      const data = await manager.getConfig()
      setConfig({
        remoteUrl: data.remoteUrl || '',
        accessToken: data.accessToken || '',
        branchLocal: data.branchLocal || 'local',
        branchUpstream: data.branchUpstream || 'upstream',
        branchSandbox: data.branchSandbox || 'sync-sandbox'
      })
    } catch (e) {
      toast('Erro ao carregar configurações', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const manager = new GitConfigManager(projectSlug)
      await manager.saveConfig(config)
      toast('Configurações salvas com sucesso!', 'success')
      onClose()
    } catch (e: any) {
      toast(e.message || 'Erro ao salvar configurações', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-2xl bg-[#1e1e1e] border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-[#151515]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
              <Network className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Configurações Git Enterprise</h2>
              <p className="text-xs text-neutral-500">Configure repositórios remotos e pipelines customizados</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-4 border-b border-neutral-800 gap-6">
          <button 
            onClick={() => setActiveTab('auth')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'auth' ? 'border-indigo-500 text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
          >
            <Cloud className="w-4 h-4" /> Autenticação e Repositório Remoto
          </button>
          <button 
            onClick={() => setActiveTab('pipeline')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'pipeline' ? 'border-indigo-500 text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
          >
            <GitBranch className="w-4 h-4" /> Pipeline de Triangulação (Branches)
          </button>
        </div>

        {/* Content */}
        <div className="p-6 bg-[#1a1a1a] flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === 'auth' ? (
                <motion.div 
                  key="auth"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-6"
                >
                  <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800 text-sm text-neutral-400 flex gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                    <p><strong>Zero-Trust Architecture:</strong> Suas credenciais são salvas localmente no seu computador (`.metabuilder/git-config.json`) via Tauri FS. Elas nunca são enviadas para a nuvem do MetaBuilder.</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-1.5">URL do Repositório (Origin)</label>
                      <input 
                        type="text" 
                        value={config.remoteUrl}
                        onChange={e => setConfig({...config, remoteUrl: e.target.value})}
                        placeholder="https://github.com/usuario/repositorio.git"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-1.5">Personal Access Token (PAT)</label>
                      <input 
                        type="password" 
                        value={config.accessToken}
                        onChange={e => setConfig({...config, accessToken: e.target.value})}
                        placeholder="ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="pipeline"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20 text-sm text-indigo-200 flex gap-3">
                    <GitBranch className="w-5 h-5 text-indigo-400 shrink-0" />
                    <p>Ao renomear as branches abaixo, você altera o funcionamento da engine da IDE para usar a sua estrutura de Git Flow.</p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-emerald-400 mb-1.5">Branch Base (Antigo 'local')</label>
                      <p className="text-xs text-neutral-500 mb-2">A branch principal onde você trabalha e onde o código é mesclado no final.</p>
                      <input 
                        type="text" 
                        value={config.branchLocal}
                        onChange={e => setConfig({...config, branchLocal: e.target.value})}
                        placeholder="Ex: develop, main"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-cyan-400 mb-1.5">Branch da Nuvem (Antigo 'upstream')</label>
                      <p className="text-xs text-neutral-500 mb-2">A branch que recebe o código gerado via Web.</p>
                      <input 
                        type="text" 
                        value={config.branchUpstream}
                        onChange={e => setConfig({...config, branchUpstream: e.target.value})}
                        placeholder="Ex: origin/metabuilder"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-indigo-400 mb-1.5">Branch Sandbox (Antigo 'sync-sandbox')</label>
                      <p className="text-xs text-neutral-500 mb-2">A branch de testes descartável onde a IA faz a triangulação.</p>
                      <input 
                        type="text" 
                        value={config.branchSandbox}
                        onChange={e => setConfig({...config, branchSandbox: e.target.value})}
                        placeholder="Ex: review/ai-changes"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#151515] border-t border-neutral-800 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-neutral-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={isLoading || isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Configurações
          </button>
        </div>
      </motion.div>
    </div>
  )
}
