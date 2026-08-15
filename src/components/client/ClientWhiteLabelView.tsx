'use client'

import { useState } from 'react'
import { Globe, Loader2, Link as LinkIcon, AlertCircle, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n'

interface ClientWhiteLabelViewProps {
  workspaces: any[]
  projects: any[]
}

export function ClientWhiteLabelView({ workspaces, projects }: ClientWhiteLabelViewProps) {
  const { t } = useI18n()
  const [selectedTargetId, setSelectedTargetId] = useState<string>('')
  const [domain, setDomain] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const [transferModal, setTransferModal] = useState({
    isOpen: false,
    domain: '',
    isWorkspace: false,
    targetName: ''
  })
  
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false)

  // Find selected target in workspaces or projects
  const selectedWorkspace = workspaces?.find(w => w.id === selectedTargetId)
  const selectedProject = projects?.find(p => p.id === selectedTargetId)
  const selectedTarget = selectedWorkspace || selectedProject
  const targetType = selectedWorkspace ? 'workspace' : selectedProject ? 'project' : null

  const handleAddDomain = async (forceTransfer = false) => {
    if (!domain) {
      toast(t('client_views.whitelabel.invalid_domain_toast', 'Por favor, informe um domínio válido.'), 'error')
      return
    }

    // Basic domain validation (allows subdomains like www.)
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
    if (!domainRegex.test(domain)) {
      toast(t('client_views.whitelabel.invalid_format_toast', 'Formato de domínio inválido. Use algo como www.suaempresa.com'), 'error')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.toLowerCase(), targetId: selectedTargetId, targetType, forceTransfer })
      })
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409 && data.requiresTransfer) {
          setIsLoading(false)
          setTransferModal({
            isOpen: true,
            domain: domain,
            isWorkspace: data.existingTargetType === 'workspace',
            targetName: data.existingTargetName
          })
          return
        }
        throw new Error(data.error || 'Erro ao vincular domínio')
      }

      toast(t('client_views.whitelabel.bind_success_toast', 'Domínio vinculado com sucesso! Siga as instruções de DNS.'), 'success')
      
      // Update local state temporarily to reflect the DB change without a page reload
      const newDomain = domain.toLowerCase()
      workspaces.forEach(w => {
        if (w.custom_domain === newDomain) w.custom_domain = null
      })
      projects.forEach(p => {
        if (p.custom_domain === newDomain) p.custom_domain = null
      })
      
      if (selectedTarget) selectedTarget.custom_domain = newDomain
      setDomain('')
    } catch (error: any) {
      toast(error.message, 'error')
    }
    setIsLoading(false)
  }

  const handleRemoveDomainClick = () => {
    if (!selectedTarget || !selectedTarget.custom_domain) return
    setIsRemoveModalOpen(true)
  }

  const handleConfirmRemoveDomain = async () => {
    if (!selectedTarget || !selectedTarget.custom_domain) return

    setIsRemoveModalOpen(false)
    try {
      const response = await fetch(`/api/domains?domain=${selectedTarget.custom_domain}&targetId=${selectedTarget.id}&targetType=${targetType}`, {
        method: 'DELETE'
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao remover domínio')
      }

      toast(t('client_views.whitelabel.remove_success_toast', 'Domínio removido com sucesso!'), 'success')
      selectedTarget.custom_domain = null
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
            <h2 className="text-xl font-black text-neutral-900 dark:text-white">
              {t('client_views.whitelabel.title', 'White-Label & Domínio Customizado')}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {t('client_views.whitelabel.desc', 'Configure um domínio próprio para que seus usuários acessem o sistema com a sua marca.')}
            </p>
          </div>
        </div>

        <div className="max-w-2xl space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">
              {t('client_views.whitelabel.select_target_label', 'Selecione o Destino')}
            </label>
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">{t('client_views.whitelabel.select_target_placeholder', 'Selecione um Workspace ou Projeto para configurar...')}</option>
              {workspaces?.length > 0 && (
                <optgroup label={t('client_views.whitelabel.workspace_optgroup', 'Portais de Aplicação (Workspaces)')}>
                  {workspaces.map(w => (
                    <option key={w.id} value={w.id}>{t('client_views.whitelabel.portal_prefix', 'Portal: ')}{w.name}</option>
                  ))}
                </optgroup>
              )}
              {projects?.length > 0 && (
                <optgroup label={t('client_views.whitelabel.project_optgroup', 'Projetos Específicos')}>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{t('client_views.whitelabel.project_prefix', 'Projeto: ')}{p.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {selectedTarget && (
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl p-6 border border-neutral-100 dark:border-neutral-800">
              {selectedTarget.custom_domain ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <h4 className="font-bold text-neutral-900 dark:text-white">
                          {t('client_views.whitelabel.active_domain_title', 'Domínio Ativo')}
                        </h4>
                      </div>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                        {selectedTarget.custom_domain}
                      </p>
                    </div>
                    <button
                      onClick={handleRemoveDomainClick}
                      disabled={isLoading}
                      className="px-4 py-2 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      {t('client_views.whitelabel.remove_btn', 'Remover')}
                    </button>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-sm font-bold text-amber-700 dark:text-amber-500 mb-2">
                        {t('client_views.whitelabel.dns_config_needed', 'Configuração de DNS Necessária')}
                      </h5>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
                        {t('client_views.whitelabel.dns_config_desc', 'Para que o domínio funcione, acesse o painel onde você comprou o domínio (Registro.br, GoDaddy, HostGator) e adicione o seguinte apontamento:')}
                      </p>
                      <div className="bg-white dark:bg-neutral-900 rounded-lg p-3 font-mono text-xs text-neutral-700 dark:text-neutral-300 grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                          <span className="text-neutral-400 block mb-1">{t('client_views.whitelabel.dns_type', 'TIPO')}</span>
                          <strong>CNAME</strong>
                        </div>
                        <div className="col-span-1">
                          <span className="text-neutral-400 block mb-1">{t('client_views.whitelabel.dns_name', 'NOME')}</span>
                          <strong>{selectedTarget.custom_domain.startsWith('www.') ? 'www' : '@'}</strong>
                        </div>
                        <div className="col-span-1">
                          <span className="text-neutral-400 block mb-1">{t('client_views.whitelabel.dns_value', 'VALOR/DESTINO')}</span>
                          <strong>cname.vercel-dns.com</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-bold text-neutral-900 dark:text-white mb-2">
                      {t('client_views.whitelabel.bind_domain_to', 'Vincular Domínio ao {target}')
                        .replace('{target}', targetType === 'workspace' ? t('client_views.whitelabel.bind_portal', 'Portal') : t('client_views.whitelabel.bind_project', 'Projeto'))}
                    </h4>
                    <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                      {t('client_views.whitelabel.new_domain_label', 'Novo Domínio (ex: www.suaempresa.com)')}
                    </label>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <Globe className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="text"
                          value={domain}
                          onChange={(e) => setDomain(e.target.value)}
                          placeholder={t('client_views.whitelabel.new_domain_placeholder', 'www.minhaempresa.com')}
                          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl pl-11 pr-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <button
                        onClick={() => handleAddDomain(false)}
                        disabled={isLoading || !domain}
                        className="px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold transition-colors flex items-center gap-2"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-5 h-5" />}
                        {t('client_views.whitelabel.bind_btn', 'Vincular')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={transferModal.isOpen}
        onClose={() => setTransferModal({ ...transferModal, isOpen: false })}
        title={t('client_views.whitelabel.transfer_modal_title', 'Transferência de Domínio')}
      >
        <div className="space-y-6">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {t('client_views.whitelabel.transfer_modal_desc1', 'O domínio {domain} já está associado ao {target}: {name}.')
                  .replace('{domain}', transferModal.domain)
                  .replace('{target}', transferModal.isWorkspace ? t('client_views.whitelabel.bind_portal', 'Portal') : t('client_views.whitelabel.bind_project', 'Projeto'))
                  .replace('{name}', transferModal.targetName)}
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
                {t('client_views.whitelabel.transfer_modal_desc2', 'A nova associação irá remover a associação anterior. Tem certeza que deseja continuar e transferir?')}
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setTransferModal({ ...transferModal, isOpen: false })}
              className="flex-1 px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              {t('client_views.whitelabel.transfer_modal_cancel', 'Cancelar')}
            </button>
            <button
              onClick={() => {
                setTransferModal({ ...transferModal, isOpen: false })
                handleAddDomain(true)
              }}
              className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors"
            >
              {t('client_views.whitelabel.transfer_modal_confirm', 'Sim, Transferir')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isRemoveModalOpen}
        onClose={() => setIsRemoveModalOpen(false)}
        title={t('client_views.whitelabel.remove_modal_title', 'Remover Domínio')}
      >
        <div className="space-y-6">
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex gap-4">
            <AlertCircle className="w-6 h-6 text-rose-500 shrink-0" />
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {t('client_views.whitelabel.remove_modal_desc1', 'Tem certeza que deseja remover este domínio?')}
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
                {t('client_views.whitelabel.remove_modal_desc2', 'O seu {target} parará de responder por ele imediatamente.')
                  .replace('{target}', targetType === 'workspace' ? t('client_views.whitelabel.workspace_optgroup', 'Portal de Aplicações') : t('client_views.whitelabel.bind_project', 'projeto'))}
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setIsRemoveModalOpen(false)}
              className="flex-1 px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              {t('client_views.whitelabel.remove_modal_cancel', 'Cancelar')}
            </button>
            <button
              onClick={handleConfirmRemoveDomain}
              className="flex-1 px-4 py-3 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {t('client_views.whitelabel.remove_modal_confirm', 'Sim, Remover')}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  )
}

