import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Unlock, Lock, Trash2, AlertTriangle, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { useClientsAdmin } from '../hooks/useClientsAdmin'

interface ClientsTabProps {
  hook: ReturnType<typeof useClientsAdmin>
}

export function ClientsTab({ hook }: ClientsTabProps) {
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
              placeholder="Buscar workspaces por nome, proprietário ou e-mail..."
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
                {filter === 'all'
                  ? 'Todos'
                  : filter === 'active'
                    ? 'Ativos'
                    : filter === 'blocked'
                      ? 'Bloqueados'
                      : 'Cadastrados'}
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
                  <th className="px-6 py-4">Dono / Email</th>
                  <th className="px-6 py-4">Licenças</th>
                  <th className="px-6 py-4">Workspaces</th>
                  <th className="px-6 py-4">Projetos</th>
                  <th className="px-6 py-4">Criação</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Ação</th>
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
                              {client.ownerLicenses} Contratada(s) / {1 + client.guestCount} Consumida(s)
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
                              Gratuito
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
                              <span className="whitespace-nowrap px-1 py-0.5 text-neutral-400">Nenhum projeto</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4.5 text-neutral-400">
                          {new Date(client.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4.5 text-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                            client.is_blocked
                              ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-450"
                          )}>
                            {client.is_blocked ? 'Bloqueado' : 'Ativo'}
                          </span>
                        </td>
                        <td className="px-6 py-4.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {client.is_blocked ? (
                              <button
                                type="button"
                                onClick={() => handleToggleBlock(client.ownerId, false, client.ownerName)}
                                className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg transition-all font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5 shrink-0"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                <span>Ativar</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleBlock(client.ownerId, true, client.ownerName)}
                                className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5 shrink-0"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                <span>Bloquear</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteClient(client.ownerName, client.ownerId, client.ownerEmail)}
                              className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 text-neutral-500 rounded-lg transition-all flex items-center gap-1.5 font-black text-[9px] uppercase tracking-wider shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Excluir</span>
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
                                          Guest
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
                                          {guest.is_blocked ? 'Bloqueado' : 'Ativo'}
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
                                              <span>Ativar</span>
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => handleToggleBlock(guest.ownerId, true, guest.ownerName)}
                                              className="px-2 py-1 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded transition-all font-black text-[9px] uppercase tracking-wider flex items-center gap-1 shrink-0"
                                            >
                                              <Lock className="w-3 h-3" />
                                              <span>Bloquear</span>
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteClient(guest.ownerName, guest.ownerId, guest.ownerEmail)}
                                            className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 text-neutral-500 rounded transition-all flex items-center gap-1 font-black text-[9px] uppercase tracking-wider shrink-0"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                            <span>Excluir</span>
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
                      Nenhum cliente/workspace encontrado.
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
        title={workspaceToBlock?.isBlocked ? "Bloquear Workspace" : "Ativar Workspace"}
        description={workspaceToBlock?.isBlocked
          ? "Isso suspenderá o acesso do cliente a este workspace temporariamente."
          : "Isso restaurará o acesso do cliente a este workspace."}
        size="md"
      >
        <div className="space-y-6">
          {workspaceToBlock?.isBlocked ? (
            <div className="flex items-center gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-700 dark:text-amber-450">
              <div className="p-2.5 bg-amber-500/20 rounded-xl">
                <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-black">Atenção!</p>
                <p className="text-xs opacity-90 mt-0.5">
                  O workspace <span className="font-bold">"{workspaceToBlock?.name}"</span> será bloqueado. Todos os seus usuários perderão acesso imediato.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-700 dark:text-emerald-450">
              <div className="p-2.5 bg-emerald-500/20 rounded-xl">
                <Unlock className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-black">Acesso Restaurado</p>
                <p className="text-xs opacity-90 mt-0.5">
                  O workspace <span className="font-bold">"{workspaceToBlock?.name}"</span> será ativado e os usuários poderão acessar novamente.
                </p>
              </div>
            </div>
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
              Cancelar
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
                  <span>Processando...</span>
                </>
              ) : workspaceToBlock?.isBlocked ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Confirmar Bloqueio</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Confirmar Ativação</span>
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
        title="Excluir Geral o Cliente"
        description="Esta ação removerá permanentemente o cliente, seu usuário de acesso, workspaces e todos os dados associados."
        size="md"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-650 dark:text-red-400">
            <div className="p-2.5 bg-red-500/20 rounded-xl">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-black">Remover permanentemente?</p>
              <p className="text-xs opacity-90 mt-0.5">
                O cliente <span className="font-bold">"{clientToDelete?.ownerName}"</span> será apagado de forma irreversível.
              </p>
            </div>
          </div>

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
              Cancelar
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
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Confirmar Exclusão</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
