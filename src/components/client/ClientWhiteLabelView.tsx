'use client'

import { useState } from 'react'
import { Globe, Loader2, Link as LinkIcon, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface ClientWhiteLabelViewProps {
  projects: any[]
}

export function ClientWhiteLabelView({ projects }: ClientWhiteLabelViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [domain, setDomain] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const selectedProject = projects.find(p => p.id === selectedProjectId)

  const handleAddDomain = async () => {
    if (!domain) {
      toast('Por favor, informe um domínio válido.', 'error')
      return
    }

    // Basic domain validation (allows subdomains like www.)
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
    if (!domainRegex.test(domain)) {
      toast('Formato de domínio inválido. Use algo como www.suaempresa.com', 'error')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.toLowerCase(), projectId: selectedProjectId })
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao vincular domínio')
      }

      toast('Domínio vinculado com sucesso! Siga as instruções de DNS.', 'success')
      // Update local state temporarily (it will refresh on next dashboard load)
      if (selectedProject) selectedProject.custom_domain = domain.toLowerCase()
      setDomain('')
    } catch (error: any) {
      toast(error.message, 'error')
    }
    setIsLoading(false)
  }

  const handleRemoveDomain = async () => {
    if (!selectedProject || !selectedProject.custom_domain) return

    if (!window.confirm('Tem certeza que deseja remover este domínio? O seu projeto parará de responder por ele.')) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/domains?domain=${selectedProject.custom_domain}&projectId=${selectedProject.id}`, {
        method: 'DELETE'
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao remover domínio')
      }

      toast('Domínio removido com sucesso!', 'success')
      selectedProject.custom_domain = null
    } catch (error: any) {
      toast(error.message, 'error')
    }
    setIsLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-neutral-900 dark:text-white">White-Label & Domínio Customizado</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Configure um domínio próprio para que seus usuários acessem o sistema com a sua marca.
            </p>
          </div>
        </div>

        <div className="max-w-2xl space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">Selecione o Projeto</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">Selecione um projeto para configurar...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {selectedProject && (
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl p-6 border border-neutral-100 dark:border-neutral-800">
              {selectedProject.custom_domain ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <h4 className="font-bold text-neutral-900 dark:text-white">Domínio Ativo</h4>
                      </div>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                        {selectedProject.custom_domain}
                      </p>
                    </div>
                    <button
                      onClick={handleRemoveDomain}
                      disabled={isLoading}
                      className="px-4 py-2 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Remover
                    </button>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-sm font-bold text-amber-700 dark:text-amber-500 mb-2">Configuração de DNS Necessária</h5>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
                        Para que o domínio funcione, acesse o painel onde você comprou o domínio (Registro.br, GoDaddy, HostGator) e adicione o seguinte apontamento:
                      </p>
                      <div className="bg-white dark:bg-neutral-900 rounded-lg p-3 font-mono text-xs text-neutral-700 dark:text-neutral-300 grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                          <span className="text-neutral-400 block mb-1">TIPO</span>
                          <strong>CNAME</strong>
                        </div>
                        <div className="col-span-1">
                          <span className="text-neutral-400 block mb-1">NOME</span>
                          <strong>{selectedProject.custom_domain.startsWith('www.') ? 'www' : '@'}</strong>
                        </div>
                        <div className="col-span-1">
                          <span className="text-neutral-400 block mb-1">VALOR/DESTINO</span>
                          <strong>cname.vercel-dns.com</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">Novo Domínio (ex: www.suaempresa.com)</label>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <Globe className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="text"
                          value={domain}
                          onChange={(e) => setDomain(e.target.value)}
                          placeholder="www.minhaempresa.com"
                          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl pl-11 pr-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <button
                        onClick={handleAddDomain}
                        disabled={isLoading || !domain}
                        className="px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold transition-colors flex items-center gap-2"
                      >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LinkIcon className="w-5 h-5" />}
                        Vincular
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
