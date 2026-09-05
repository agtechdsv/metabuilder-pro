'use client'

import React from 'react'
import {
  History, X, FolderGit2, AlertTriangle, GitBranch, Loader2, CheckCircle2
} from 'lucide-react'
import { useI18n } from '@/i18n'

export interface IDEGitModalsProps {
  isOpen: boolean
  isLogModalOpen: boolean
  setIsLogModalOpen: (open: boolean) => void
  gitLogs: any[]
  branches: string[]
  selectedBranch: string
  handleBranchChange: (branch: string) => void
  setRevertConfirmOid: (oid: string | null) => void
  showDiscardConfirm: boolean
  setShowDiscardConfirm: (show: boolean) => void
  isDiscarding: boolean
  handleAbortSync: () => Promise<void>
  revertConfirmOid: string | null
  isReverting: boolean
  handleRevertCommit: () => Promise<void>
  showNewBranchModal: boolean
  setShowNewBranchModal: (show: boolean) => void
  newBranchName: string
  setNewBranchName: (name: string) => void
  isCreatingBranch: boolean
  handleCreateBranchSubmit: (e: React.FormEvent) => Promise<void>
}

export function IDEGitModals({
  isOpen,
  isLogModalOpen,
  setIsLogModalOpen,
  gitLogs,
  branches,
  selectedBranch,
  handleBranchChange,
  setRevertConfirmOid,
  showDiscardConfirm,
  setShowDiscardConfirm,
  isDiscarding,
  handleAbortSync,
  revertConfirmOid,
  isReverting,
  handleRevertCommit,
  showNewBranchModal,
  setShowNewBranchModal,
  newBranchName,
  setNewBranchName,
  isCreatingBranch,
  handleCreateBranchSubmit
}: IDEGitModalsProps) {
  const { t } = useI18n()

  if (!isOpen) return null

  return (
    <>
      {/* Git Log Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-neutral-800 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 shrink-0 bg-neutral-900/50">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-400" /> Histórico
                </h2>
                <div className="h-6 w-px bg-neutral-700 mx-2"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Branch:</span>
                  <select
                    value={selectedBranch}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-1.5 min-w-[120px] outline-none"
                  >
                    {branches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {gitLogs.length === 0 ? (
                <div className="text-center text-neutral-500 py-8">Nenhum commit encontrado.</div>
              ) : (
                gitLogs.map(log => (
                  <div key={log.oid} className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-white text-sm">{log.message}</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRevertConfirmOid(log.oid)}
                          className="opacity-0 group-hover:opacity-100 px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 rounded text-xs font-bold transition-all"
                        >
                          Reverter para esta versão
                        </button>
                        <div
                          className="flex items-center gap-1.5 text-xs text-neutral-500 font-mono bg-neutral-950 px-2 py-1 rounded border border-neutral-800/50"
                          title="Código de Hash (Identificador Único do Commit)"
                        >
                          <span className="text-neutral-600">ID:</span> {log.oid.substring(0, 7)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-neutral-400">
                      <span className="flex items-center gap-1.5">
                        <FolderGit2 className="w-3.5 h-3.5" /> {log.author}
                      </span>
                      <span>•</span>
                      <span>{log.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Descarte */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-neutral-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-black text-white mb-2">
                {t('workspace_components.ide_local.discard_sync_title', 'Descartar Sincronização?')}
              </h3>
              <p className="text-neutral-400 text-sm">
                {t(
                  'workspace_components.ide_local.discard_sync_desc1',
                  'Isso irá cancelar o processo de merge e reverter seu projeto local exatamente para o estado antes da sincronização. Nenhuma das alterações remotas será aplicada no seu ambiente local.'
                )}
              </p>
              <p className="text-rose-400 text-sm mt-3 font-semibold">
                {t(
                  'workspace_components.ide_local.discard_sync_desc2',
                  'Tem certeza que deseja prosseguir? Esta ação não pode ser desfeita.'
                )}
              </p>
            </div>
            <div className="bg-neutral-900/50 p-4 border-t border-neutral-800 flex justify-end gap-3">
              <button
                onClick={() => setShowDiscardConfirm(false)}
                disabled={isDiscarding}
                className="px-4 py-2 text-sm font-semibold text-neutral-300 hover:text-white transition-colors disabled:opacity-50"
              >
                {t('workspace_components.ide_local.cancel', 'Cancelar')}
              </button>
              <button
                onClick={handleAbortSync}
                disabled={isDiscarding}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-red-500/20 disabled:opacity-50"
              >
                {isDiscarding
                  ? t('workspace_components.ide_local.discarding', 'Descartando...')
                  : t('workspace_components.ide_local.yes_discard_all', 'Sim, Descartar Tudo')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Reversão de Commit */}
      {revertConfirmOid && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-neutral-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-orange-900/20 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-orange-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Reverter para Commit Anterior?</h2>
              <div className="text-sm text-neutral-400 space-y-3">
                <p>Amigo dev, preste muita atenção:</p>
                <p>
                  Se você confirmar, o seu HD será forçado a <strong>voltar no tempo</strong> exatamente para o código deste commit.
                </p>
                <p className="text-red-400 font-semibold">
                  Se você tiver alterações pendentes que não foram comitadas, elas serão sumariamente apagadas. A responsabilidade é inteiramente sua.
                </p>
              </div>
            </div>
            <div className="bg-neutral-900/50 p-4 border-t border-neutral-800 flex justify-end gap-3">
              <button
                onClick={() => setRevertConfirmOid(null)}
                disabled={isReverting}
                className="px-4 py-2 text-sm font-semibold text-neutral-300 hover:text-white transition-colors disabled:opacity-50"
              >
                Vou pensar melhor
              </button>
              <button
                onClick={handleRevertCommit}
                disabled={isReverting}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-orange-500/20 disabled:opacity-50"
              >
                {isReverting ? 'Revertendo...' : 'Sim, Reverter e Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Branch */}
      {showNewBranchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999999] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-neutral-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-emerald-900/20 flex items-center justify-center mb-4">
                <GitBranch className="w-6 h-6 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Criar Nova Branch</h2>
              <p className="text-sm text-neutral-400 mb-6">
                Digite um nome para a sua nova branch. Ela será criada a partir da branch atual e você já será movido para ela.
              </p>

              <form onSubmit={handleCreateBranchSubmit}>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={e => setNewBranchName(e.target.value)}
                  placeholder="Ex: feat/nova-tela"
                  autoFocus
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono mb-6"
                />

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNewBranchModal(false)}
                    disabled={isCreatingBranch}
                    className="px-4 py-2 text-sm font-semibold text-neutral-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!newBranchName.trim() || isCreatingBranch}
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {isCreatingBranch ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Criar Branch
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
