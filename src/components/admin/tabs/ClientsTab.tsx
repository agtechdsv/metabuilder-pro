import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Unlock, Lock, Trash2, AlertTriangle, Loader2, ChevronDown, ChevronRight, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'
import { hasOpenBilling } from '@/lib/admin/billingCancel'
import { useClientsAdmin, type BillingPreview } from '../hooks/useClientsAdmin'

interface ClientsTabProps {
  hook: ReturnType<typeof useClientsAdmin>
  /** atalho "Cobranças" da linha do cliente (abre a subaba Cobranças filtrada por ele) */
  onViewCharges?: (userId: string, name: string) => void
}

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

/** Cobrança no Asaas ligada ao cliente: o que será cancelado (excluir) ou a escolha de cancelar também (bloquear). */
function BillingBox({ preview, mode, checked, onCheck, disabled }: { preview: BillingPreview; mode: 'block' | 'delete'; checked?: boolean; onCheck?: (v: boolean) => void; disabled?: boolean }) {
  const { t } = useI18n()
  const open = hasOpenBilling(preview.info)
  const parts: string[] = []
  if (preview.info?.hasSubscription) parts.push(t('admin_clients.billing_sub'))
  if (preview.info && preview.info.chargeCount > 0) parts.push(t('admin_clients.billing_charges').replace('{n}', String(preview.info.chargeCount)).replace('{total}', brl(preview.info.chargeTotal)))
  return (
    <div data-testid="billing-box" className="rounded-2xl border border-neutral-200 dark:border-neutral-700 p-4 space-y-2 text-xs text-neutral-600 dark:text-neutral-300">
      <p className="text-[11px] font-black uppercase tracking-widest text-neutral-500">{t('admin_clients.billing_title')}</p>
      {preview.loading ? (
        <p className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('admin_clients.billing_loading')}</p>
      ) : preview.error ? (
        <p className="text-amber-600 dark:text-amber-400">{t('admin_clients.billing_error').replace('{error}', preview.error)}</p>
      ) : !open ? (
        <p>{t('admin_clients.billing_none')}</p>
      ) : mode === 'delete' ? (
        <>
          <p className="font-bold">{t('admin_clients.billing_delete_will')} {parts.join(' + ')}.</p>
          <p className="opacity-80">{t('admin_clients.billing_delete_note')}</p>
        </>
      ) : (
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" data-testid="cancel-billing-check" className="mt-0.5" checked={!!checked} disabled={disabled} onChange={e => onCheck?.(e.target.checked)} />
          <span>
            <span className="font-bold block">{t('admin_clients.billing_block_label')} ({parts.join(' + ')})</span>
            <span className="opacity-80">{t('admin_clients.billing_block_hint')}</span>
          </span>
        </label>
      )}
    </div>
  )
}

export function ClientsTab({ hook, onViewCharges }: ClientsTabProps) {
  const { t, language } = useI18n()
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR'
  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    isBlockModalOpen,
    setIsBlockModalOpen,
    workspaceToBlock,
    setWorkspaceToBlock,
    isBlockingWorkspace,
    isDeleteClientModalOpen,
    setIsDeleteClientModalOpen,
    clientToDelete,
    setClientToDelete,
    isDeletingClient,
    billingPreview,
    cancelBillingOnBlock,
    setCancelBillingOnBlock,
    filteredClients,
    clientTypeFilter,
    setClientTypeFilter,
    handleToggleBlock,
    handleConfirmToggleBlock,
    handleDeleteClient,
    handleConfirmDeleteClient
  } = hook

  const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set())

  const toggleExpand = (ownerId: string) => {
    setExpandedOwners(prev => {
      const next = new Set(prev)
      if (next.has(ownerId)) next.delete(ownerId)
      else next.add(ownerId)
      return next
    })
  }

  return (
    <>
      <motion.div
        key="clients"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 15 }}
        transition={{ duration: 0.25 }}
        className="space-y-6"
      >
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white dark:bg-neutral-900/40 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm backdrop-blur-sm">
          <div className="relative w-full sm:w-auto flex-grow max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder={t('admin_clients.search_ph')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs font-medium focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-200"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap justify-end">
            <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-950 p-1 rounded-xl">
              {(['PRO', 'FREE'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setClientTypeFilter(type)}
                  className={cn(
                    "px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all capitalize",
                    clientTypeFilter === type
                      ? 'bg-white dark:bg-neutral-850 text-indigo-500 dark:text-indigo-400 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
                  )}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-950 p-1 rounded-xl">
            {(['all', 'active', 'blocked', 'registered'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={cn(
                  "px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all capitalize",
                  statusFilter === filter
                    ? 'bg-white dark:bg-neutral-850 text-indigo-500 dark:text-indigo-400 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
                )}
              >
                {t('admin_clients.filter_' + filter)}
              </button>
            ))}
            </div>
          </div>
        </div>

        {/* Clients Table */}
        <div className="bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-150 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-950/40 text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                  <th className="px-6 py-4">{t('admin_clients.col_owner')}</th>
                  <th className="px-6 py-4">{t('admin_clients.col_licenses')}</th>
                  <th className="px-6 py-4">{t('admin_clients.col_workspaces')}</th>
                  <th className="px-6 py-4">{t('admin_clients.col_projects')}</th>
                  <th className="px-6 py-4">{t('admin_clients.col_created')}</th>
                  <th className="px-6 py-4 text-center">{t('admin_clients.col_status')}</th>
                  <th className="px-6 py-4 text-right">{t('admin_clients.col_action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850/60">
                {filteredClients.length > 0 ? (
                  filteredClients.map(client => (
                    <React.Fragment key={client.ownerId}>
                      <tr className="text-xs text-neutral-700 dark:text-neutral-350 hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20 transition-all">
                        <td className="px-6 py-4.5">
                          <div className="flex items-center gap-2">
                            {client.teamMembers && client.teamMembers.length > 0 ? (
                              <button 
                                onClick={() => toggleExpand(client.ownerId)}
                                className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors text-neutral-400"
                              >
                                {expandedOwners.has(client.ownerId) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            ) : (
                              <div className="w-6" /> // Placeholder to align texts
                            )}
                            <div>
                              <span className="font-bold text-neutral-800 dark:text-neutral-200">{client.ownerName}</span>
                              <span className="block text-[10px] text-neutral-400 mt-0.5">{client.ownerEmail}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4.5 font-mono font-bold text-xs">
                          {client.ownerLicenses > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                              {t('admin_clients.licenses_count').replace('{n}', String(client.ownerLicenses)).replace('{m}', String(1 + client.guestCount))}
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
                              {t('admin_clients.free')}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4.5 group relative">
                          <span className="font-bold cursor-default px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                            {client.workspaces.length}
                          </span>
                          <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex flex-col bg-neutral-900 text-white text-[10px] p-2 rounded z-10 w-max shadow-xl border border-neutral-800">
                            {client.workspaces.map((w: any) => (
                              <span key={w.id} className="whitespace-nowrap px-1 py-0.5">{w.name} (/{w.slug})</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4.5 group relative">
                          <span className="font-bold cursor-default px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                            {client.projects.length}
                          </span>
                          <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex flex-col bg-neutral-900 text-white text-[10px] p-2 rounded z-10 w-max shadow-xl border border-neutral-800">
                            {client.projects.length > 0 ? client.projects.map((p: any) => (
                              <span key={p.id} className="whitespace-nowrap px-1 py-0.5">{p.name} (/{p.slug})</span>
                            )) : (
                              <span className="whitespace-nowrap px-1 py-0.5 text-neutral-400">{t('admin_clients.no_projects')}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4.5 text-neutral-400">
                          {new Date(client.created_at).toLocaleDateString(locale)}
                        </td>
                        <td className="px-6 py-4.5 text-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                            client.is_blocked
                              ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-450"
                          )}>
                            {client.is_blocked ? t('admin_clients.status_blocked') : t('admin_clients.status_active')}
                          </span>
                        </td>
                        <td className="px-6 py-4.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {onViewCharges && (
                              <button
                                type="button"
                                data-testid="client-view-charges"
                                onClick={() => onViewCharges(client.ownerId, client.ownerName || client.ownerEmail)}
                                className="px-3 py-1.5 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white rounded-lg transition-all font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5 shrink-0"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                <span>{t('admin_charges.view_charges')}</span>
                              </button>
                            )}
                            {client.is_blocked ? (
                              <button
                                type="button"
                                onClick={() => handleToggleBlock(client.ownerId, false, client.ownerName)}
                                className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg transition-all font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5 shrink-0"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                <span>{t('admin_clients.activate')}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleBlock(client.ownerId, true, client.ownerName)}
                                className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5 shrink-0"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                <span>{t('admin_clients.block')}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteClient(client.ownerName, client.ownerId, client.ownerEmail)}
                              className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 text-neutral-500 rounded-lg transition-all flex items-center gap-1.5 font-black text-[9px] uppercase tracking-wider shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{t('admin_clients.delete')}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedOwners.has(client.ownerId) && client.teamMembers && (
                        <tr className="bg-neutral-50/30 dark:bg-neutral-900/20 border-b border-neutral-100 dark:border-neutral-850">
                          <td colSpan={7} className="px-0 py-0">
                            <div className="pl-14 pr-6 py-3">
                              <table className="w-full text-left">
                                <tbody className="divide-y divide-neutral-100/50 dark:divide-neutral-850/50">
                                  {client.teamMembers.map((guest: any) => (
                                    <tr key={guest.ownerId} className="text-xs text-neutral-600 dark:text-neutral-400">
                                      <td className="py-2.5 w-1/3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                                          <div>
                                            <span className="font-bold text-neutral-700 dark:text-neutral-300">{guest.ownerName}</span>
                                            <span className="block text-[10px] text-neutral-400">{guest.ownerEmail}</span>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="py-2.5">
                                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
                                          {t('admin_clients.guest')}
                                        </span>
                                      </td>
                                      <td className="py-2.5 text-neutral-400 text-center">-</td>
                                      <td className="py-2.5 text-center">
                                        <span className={cn(
                                          "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                          guest.is_blocked
                                            ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-450"
                                        )}>
                                          {guest.is_blocked ? t('admin_clients.status_blocked') : t('admin_clients.status_active')}
                                        </span>
                                      </td>
                                      <td className="py-2.5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          {guest.is_blocked ? (
                                            <button
                                              type="button"
                                              onClick={() => handleToggleBlock(guest.ownerId, false, guest.ownerName)}
                                              className="px-2 py-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded transition-all font-black text-[9px] uppercase tracking-wider flex items-center gap-1 shrink-0"
                                            >
                                              <Unlock className="w-3 h-3" />
                                              <span>{t('admin_clients.activate')}</span>
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => handleToggleBlock(guest.ownerId, true, guest.ownerName)}
                                              className="px-2 py-1 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded transition-all font-black text-[9px] uppercase tracking-wider flex items-center gap-1 shrink-0"
                                            >
                                              <Lock className="w-3 h-3" />
                                              <span>{t('admin_clients.block')}</span>
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteClient(guest.ownerName, guest.ownerId, guest.ownerEmail)}
                                            className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 text-neutral-500 rounded transition-all flex items-center gap-1 font-black text-[9px] uppercase tracking-wider shrink-0"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                            <span>{t('admin_clients.delete')}</span>
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-neutral-400 italic">
                      {t('admin_clients.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Confirm Block/Unblock Workspace Modal */}
      <Modal
        isOpen={isBlockModalOpen}
        onClose={() => {
          if (!isBlockingWorkspace) {
            setIsBlockModalOpen(false)
            setWorkspaceToBlock(null)
          }
        }}
        title={workspaceToBlock?.isBlocked ? t('admin_clients.block_title') : t('admin_clients.activate_title')}
        description={workspaceToBlock?.isBlocked
          ? t('admin_clients.block_desc')
          : t('admin_clients.activate_desc')}
        size="md"
      >
        <div className="space-y-6">
          {workspaceToBlock?.isBlocked ? (
            <div className="flex items-center gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-700 dark:text-amber-450">
              <div className="p-2.5 bg-amber-500/20 rounded-xl">
                <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-black">{t('admin_clients.attention')}</p>
                <p className="text-xs opacity-90 mt-0.5">
                  {t('admin_clients.block_warn').replace('{name}', workspaceToBlock?.name ?? '')}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-700 dark:text-emerald-450">
              <div className="p-2.5 bg-emerald-500/20 rounded-xl">
                <Unlock className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-black">{t('admin_clients.restored')}</p>
                <p className="text-xs opacity-90 mt-0.5">
                  {t('admin_clients.activate_warn').replace('{name}', workspaceToBlock?.name ?? '')}
                </p>
              </div>
            </div>
          )}

          {workspaceToBlock?.isBlocked && (
            <BillingBox preview={billingPreview} mode="block" checked={cancelBillingOnBlock} onCheck={setCancelBillingOnBlock} disabled={isBlockingWorkspace} />
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isBlockingWorkspace}
              onClick={() => {
                setIsBlockModalOpen(false)
                setWorkspaceToBlock(null)
              }}
              className="h-10 px-5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-xs uppercase tracking-widest border border-neutral-200 dark:border-neutral-750 rounded-xl transition-all"
            >
              {t('admin_clients.cancel')}
            </button>
            <button
              type="button"
              disabled={isBlockingWorkspace}
              onClick={handleConfirmToggleBlock}
              className={cn(
                "h-10 px-6 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md flex items-center gap-2 text-white",
                workspaceToBlock?.isBlocked
                  ? "bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 shadow-amber-500/20"
                  : "bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 shadow-emerald-500/20"
              )}
            >
              {isBlockingWorkspace ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('admin_clients.processing')}</span>
                </>
              ) : workspaceToBlock?.isBlocked ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>{t('admin_clients.confirm_block')}</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>{t('admin_clients.confirm_activate')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Client Modal */}
      <Modal
        isOpen={isDeleteClientModalOpen}
        onClose={() => {
          if (!isDeletingClient) {
            setIsDeleteClientModalOpen(false)
            setClientToDelete(null)
          }
        }}
        title={t('admin_clients.delete_title')}
        description={t('admin_clients.delete_desc')}
        size="md"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-650 dark:text-red-400">
            <div className="p-2.5 bg-red-500/20 rounded-xl">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-black">{t('admin_clients.delete_q')}</p>
              <p className="text-xs opacity-90 mt-0.5">
                {t('admin_clients.delete_warn').replace('{name}', clientToDelete?.ownerName ?? '')}
              </p>
            </div>
          </div>

          <BillingBox preview={billingPreview} mode="delete" disabled={isDeletingClient} />

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isDeletingClient}
              onClick={() => {
                setIsDeleteClientModalOpen(false)
                setClientToDelete(null)
              }}
              className="h-10 px-5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-xs uppercase tracking-widest border border-neutral-200 dark:border-neutral-750 rounded-xl transition-all"
            >
              {t('admin_clients.cancel')}
            </button>
            <button
              type="button"
              disabled={isDeletingClient}
              onClick={handleConfirmDeleteClient}
              className="h-10 px-6 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-red-500/20 flex items-center gap-2"
            >
              {isDeletingClient ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('admin_clients.deleting')}</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>{t('admin_clients.confirm_delete')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
