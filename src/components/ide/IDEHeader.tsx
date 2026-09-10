'use client'

import React from 'react'
import {
  FolderGit2, XCircle, Loader2, CheckCircle2, DownloadCloud,
  Save, UploadCloud, Download, History, Settings, Package,
  PanelBottomOpen, PanelLeftOpen, Minimize2, X,
  Server, Coffee
} from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '@/i18n'
import { Modal } from '@/components/ui/Modal'

export interface IDEHeaderProps {
  target: { type: 'project' | 'workspace'; id: string; name: string; slug: string }
  sandboxMode: boolean
  setShowDiscardConfirm: (show: boolean) => void
  isDiscarding: boolean
  isConfirming: boolean
  handleOpenCommitModal: (mode: 'commit' | 'merge') => void
  handleSyncFromWeb: (backendStack?: string, javaGroupId?: string, javaPort?: number) => void
  isSyncing: boolean
  selectedBranch: string
  handleBranchChange: (branch: string) => void
  branches: string[]
  isCommitLoading: boolean
  isCommitting: boolean
  handlePushToRemote: () => void
  isPushing: boolean
  handlePullFromRemote: () => void
  isPulling: boolean
  handleShowLogs: () => void
  setShowGitSettings: (show: boolean) => void
  setShowNativeExport: (show: boolean) => void
  showConsole: boolean
  setShowConsole: React.Dispatch<React.SetStateAction<boolean>>
  showSidebar: boolean
  setShowSidebar: React.Dispatch<React.SetStateAction<boolean>>
  setIsMinimized: (minimized: boolean) => void
  closeIDE: () => void
}

export function IDEHeader({
  target,
  sandboxMode,
  setShowDiscardConfirm,
  isDiscarding,
  isConfirming,
  handleOpenCommitModal,
  handleSyncFromWeb,
  isSyncing,
  selectedBranch,
  handleBranchChange,
  branches,
  isCommitLoading,
  isCommitting,
  handlePushToRemote,
  isPushing,
  handlePullFromRemote,
  isPulling,
  handleShowLogs,
  setShowGitSettings,
  setShowNativeExport,
  showConsole,
  setShowConsole,
  showSidebar,
  setShowSidebar,
  setIsMinimized,
  closeIDE
}: IDEHeaderProps) {
  const { t } = useI18n()
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)
  const [backendStack, setBackendStack] = useState<'nodejs' | 'java-spring'>('nodejs')
  const [javaGroupId, setJavaGroupId] = useState('com.app')
  const [javaPort, setJavaPort] = useState(8080)

  const confirmSync = () => {
    setIsSyncModalOpen(false)
    handleSyncFromWeb(backendStack, javaGroupId, javaPort)
  }

  return (
    <div className="bg-[#1a1b1e] border-b border-neutral-800 flex items-center justify-between px-4 py-2 shrink-0 shadow-lg relative">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400">
          <FolderGit2 className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white leading-tight">
            {t('workspace_components.ide_local.title', 'IDE Local')}
          </span>
          <span className="text-xs text-neutral-500">
            {target.type === 'workspace' ? 'Workspace' : 'Projeto'}: {target.name}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Botões de Ação da IDE */}
        <div className="flex items-center gap-2 mr-4 border-r border-neutral-800 pr-4">
          {sandboxMode ? (
            <>
              <button
                onClick={() => setShowDiscardConfirm(true)}
                disabled={isDiscarding || isConfirming}
                className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                {isDiscarding ? t('workspace_components.ide_local.discarding', 'Descartando...') : t('workspace_components.ide_local.discard', 'Descartar')}
              </button>
              <button
                onClick={() => handleOpenCommitModal('merge')}
                disabled={isDiscarding || isConfirming}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {isConfirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {isConfirming ? t('workspace_components.ide_local.confirming', 'Confirmando...') : t('workspace_components.ide_local.confirm_merge', 'Confirmar Merge')}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsSyncModalOpen(true)}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              {isSyncing ? t('workspace_components.ide_local.syncing', 'Sincronizando...') : t('workspace_components.ide_local.eject_sync', 'Ejetar & Sincronizar')}
            </button>
          )}

          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden h-8">
            <div className="px-2 bg-neutral-800 text-neutral-400 border-r border-neutral-700 flex items-center h-full">
              <FolderGit2 className="w-3.5 h-3.5" />
            </div>
            <select
              value={selectedBranch}
              onChange={(e) => handleBranchChange(e.target.value)}
              className="bg-transparent text-xs text-neutral-300 font-mono px-2 py-1 outline-none min-w-[120px] h-full"
            >
              <option value="__NEW_BRANCH__" className="text-emerald-400 font-bold bg-neutral-900">
                {t('workspace_components.ide_local.new_branch', '+ Nova Branch...')}
              </option>
              <optgroup label={t('workspace_components.ide_local.branches_group', 'Branches')}>
                {branches.map(b => (
                  <option key={b} value={b} className="bg-neutral-900 text-neutral-300">
                    {b}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <button
            onClick={() => handleOpenCommitModal('commit')}
            disabled={isCommitLoading || isCommitting}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            title="Commit Local"
          >
            {isCommitLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Commit
          </button>

          <button
            onClick={handlePushToRemote}
            disabled={isPushing}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            title={t('workspace_components.ide_local.push_tooltip', 'Push para Remoto (GitHub)')}
          >
            {isPushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />} Push
          </button>

          <button
            onClick={handlePullFromRemote}
            disabled={isPulling}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            title={t('workspace_components.ide_local.pull_tooltip', 'Pull do Remoto (GitHub)')}
          >
            {isPulling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Pull
          </button>

          <button
            onClick={handleShowLogs}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold transition-colors"
            title={t('workspace_components.ide_local.history_tooltip', 'Ver Histórico (Git Log)')}
          >
            <History className="w-3.5 h-3.5" /> {t('workspace_components.ide_local.history_btn', 'Histórico')}
          </button>

          <button
            onClick={() => setShowGitSettings(true)}
            className="flex items-center justify-center w-8 h-8 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-colors border border-neutral-700"
            title={t('workspace_components.ide_local.git_settings_tooltip', 'Configurações Git (Remote & Pipeline)')}
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowNativeExport(true)}
            className="flex items-center justify-center gap-1.5 px-2.5 h-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-xs font-bold border border-indigo-500"
            title="Ejetar código-fonte nativo (Next.js puro)"
          >
            <Package className="w-3.5 h-3.5" />
            Ejetar
          </button>

          {/* Console toggle button */}
          <button
            onClick={() => setShowConsole(v => !v)}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors border ${
              showConsole
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-700'
            }`}
            title={showConsole ? t('workspace_components.ide_local.hide_console', 'Ocultar Console') : t('workspace_components.ide_local.show_console', 'Mostrar Console')}
          >
            <PanelBottomOpen className="w-4 h-4" />
          </button>

          {/* Sidebar toggle button */}
          <button
            onClick={() => setShowSidebar(v => !v)}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors border ${
              showSidebar
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-700'
            }`}
            title={showSidebar ? t('workspace_components.ide_local.hide_files', 'Ocultar Arquivos') : t('workspace_components.ide_local.show_files', 'Mostrar Arquivos')}
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => setIsMinimized(true)}
          className="px-3 py-1.5 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all flex items-center gap-2 text-xs font-bold"
          title={t('workspace_components.ide_local.minimize_ide', 'Minimizar IDE')}
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={closeIDE}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-red-500/80 text-neutral-300 hover:text-white transition-colors"
          title={t('workspace_components.ide_local.close_ide', 'Fechar IDE')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Sync Modal */}
      <Modal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} title="Configuração de Sincronização">
        <div className="p-4 space-y-4">
          <p className="text-sm text-neutral-400">
            Selecione a stack de Backend para gerar o código na IDE Local.
          </p>
          <div className="grid grid-cols-1 gap-2">
            <label className={`flex items-center gap-3 cursor-pointer border rounded-lg p-3 transition-colors ${
              backendStack === 'nodejs' ? 'border-indigo-500 bg-indigo-600/10' : 'border-neutral-700 hover:border-neutral-500 bg-neutral-800/50'
            }`}>
              <input type="radio" checked={backendStack === 'nodejs'} onChange={() => setBackendStack('nodejs')} className="w-4 h-4 accent-indigo-500" />
              <div className="flex flex-col">
                <span className="font-semibold text-neutral-100 text-sm">Next.js Full-Stack (Node.js)</span>
              </div>
            </label>
            <label className={`flex items-center gap-3 cursor-pointer border rounded-lg p-3 transition-colors ${
              backendStack === 'java-spring' ? 'border-indigo-500 bg-indigo-600/10' : 'border-neutral-700 hover:border-neutral-500 bg-neutral-800/50'
            }`}>
              <input type="radio" checked={backendStack === 'java-spring'} onChange={() => setBackendStack('java-spring')} className="w-4 h-4 accent-indigo-500" />
              <div className="flex flex-col">
                <span className="font-semibold text-neutral-100 text-sm">Next.js + Spring Boot 3 (Java 21)</span>
              </div>
            </label>
          </div>
          
          {backendStack === 'java-spring' && (
            <div className="p-3 bg-black/20 border border-neutral-800 rounded-lg space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">Maven Group ID</label>
                <input type="text" value={javaGroupId} onChange={e => setJavaGroupId(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">Porta do Spring Boot</label>
                <input type="number" value={javaPort} onChange={e => setJavaPort(Number(e.target.value))} className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500" />
              </div>
            </div>
          )}
          
          <div className="flex justify-end pt-2">
            <button onClick={confirmSync} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-500 transition-colors">
              Sincronizar Agora
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
