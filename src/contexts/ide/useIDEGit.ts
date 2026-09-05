import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { LocalSyncManager } from '@/utils/localSyncManager'
import { GitConfigManager } from '@/utils/gitConfigManager'
import * as tauriFs from '@tauri-apps/plugin-fs'
import { BaseDirectory } from '@tauri-apps/api/path'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'

export interface UseIDEGitProps {
  target: any
  syncManager: LocalSyncManager | null
  loadFileTree: () => Promise<void>
  resetTabs: () => void
  fileContents?: Record<string, string>
  setDiffActiveFile?: (path: string | null) => void
  setDiffOriginalContent?: (content: string) => void
  setDiffLocalContent?: (content: string) => void
}

export function useIDEGit({
  target,
  syncManager,
  loadFileTree,
  resetTabs,
  fileContents = {},
  setDiffActiveFile,
  setDiffOriginalContent,
  setDiffLocalContent
}: UseIDEGitProps) {
  const { toast } = useToast()
  const { t } = useI18n()
  const supabase = createClient()

  const [isSyncing, setIsSyncing] = useState(false)
  const [isDiscarding, setIsDiscarding] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [sandboxMode, setSandboxMode] = useState(false)

  const [gitLogs, setGitLogs] = useState<any[]>([])
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('local')

  // Git UI Modals
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [revertConfirmOid, setRevertConfirmOid] = useState<string | null>(null)
  const [isReverting, setIsReverting] = useState(false)
  const [showGitSettings, setShowGitSettings] = useState(false)
  const [isPushing, setIsPushing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)

  // Advanced Commit Modal
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'commit' | 'merge'>('commit')
  const [commitMessage, setCommitMessage] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [changedFiles, setChangedFiles] = useState<{ filepath: string; status: 'added' | 'modified' | 'deleted' }[]>([])
  const [selectedCommitFiles, setSelectedCommitFiles] = useState<Set<string>>(new Set())
  const [isCommitLoading, setIsCommitLoading] = useState(false)
  const [commitMenu, setCommitMenu] = useState<{ x: number; y: number } | null>(null)
  const [revertLocalConfirm, setRevertLocalConfirm] = useState<string[] | null>(null)
  const [selectedListFiles, setSelectedListFiles] = useState<Set<string>>(new Set())

  const [showNewBranchModal, setShowNewBranchModal] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [isCreatingBranch, setIsCreatingBranch] = useState(false)

  const handleSyncFromWeb = async () => {
    if (!syncManager || !target) return
    setIsSyncing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const apiRoute = target.type === 'project' ? '/api/project-source' : '/api/workspace-source'
      let payload: any = target.type === 'project' ? { projectId: target.id } : { workspaceId: target.id }

      try {
        const configStr = await tauriFs.readTextFile('metabuilder.config.json', { baseDir: BaseDirectory.AppLocalData })
        if (configStr) {
          const tunnelConfig = JSON.parse(configStr)
          const projectConn = tunnelConfig?.connections?.find((c: any) => c.projectId === target.id)
          if (projectConn && projectConn.connectionsString && projectConn.connectionsString.length > 0) {
            const primaryConn = projectConn.connectionsString[0]
            payload.legacyDriver = primaryConn.type || 'postgres'
            payload.dbConfig = { url: primaryConn.connectionString }
            payload.dataMode = 'legacy'
            payload.authStrategy = 'legacy'
          }
        }
      } catch (e) {
        // Ignora caso arquivo não exista
      }

      await syncManager.syncFromWeb(apiRoute, `Bearer ${token}`, payload)
      const mergeResult = await syncManager.startSyncSandbox()

      // Verifica se há alterações reais entre sandbox e local
      const diffFiles = await syncManager.getMergeDiffFiles()
      if (diffFiles.length === 0) {
        await syncManager.cleanUpSandbox()
        setSandboxMode(false)
        const { branches, currentBranch } = await syncManager.getBranches()
        setBranches(branches)
        setSelectedBranch(currentBranch)
        await loadFileTree()
        toast(t('workspace_components.ide_local.no_changes_to_merge', 'Nenhuma alteração para o merge.'), 'info')
        return
      }

      setSandboxMode(true)
      const { branches, currentBranch } = await syncManager.getBranches()
      setBranches(branches)
      setSelectedBranch(currentBranch)
      await loadFileTree()

      if (mergeResult.oid) {
        toast(t('ide.git.merge_clean', 'Merge limpo! Nenhum conflito encontrado.'), 'success')
      } else {
        toast(t('ide.git.merge_conflicts', 'Atenção: Conflitos encontrados. Resolva no editor antes de confirmar.'), 'info')
      }
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err.message
      toast(`${t('ide.git.sync_error', 'Erro ao sincronizar:')} ${msg}`, 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleConfirmSync = async () => {
    if (!syncManager) return
    setIsCommitting(true)
    try {
      await syncManager.confirmSync()
      setSandboxMode(false)
      setIsCommitModalOpen(false)
      const { branches, currentBranch } = await syncManager.getBranches()
      setBranches(branches)
      setSelectedBranch(currentBranch)
      await loadFileTree()
      resetTabs()
      toast(t('ide.git.sync_confirmed', 'Sincronização Efetivada'), 'success')
    } catch (err: any) {
      toast(`${t('ide.git.error', 'Erro:')} ${err.message}`, 'error')
    } finally {
      setIsCommitting(false)
    }
  }

  const handleAbortSync = async () => {
    if (!syncManager) return
    setIsDiscarding(true)
    try {
      await syncManager.abortSync()
      setSandboxMode(false)
      const { branches, currentBranch } = await syncManager.getBranches()
      setBranches(branches)
      setSelectedBranch(currentBranch)
      await loadFileTree()
      resetTabs()
      setShowDiscardConfirm(false)
      toast(t('ide.git.sync_discarded', 'Sincronização Descartada'), 'info')
    } catch (err: any) {
      toast(`${t('ide.git.error', 'Erro:')} ${err.message}`, 'error')
    } finally {
      setIsDiscarding(false)
    }
  }

  const handleRevertCommit = async () => {
    if (!syncManager || !revertConfirmOid) return
    setIsReverting(true)
    try {
      await syncManager.revertToCommit(revertConfirmOid)
      await loadFileTree()
      resetTabs()
      setIsLogModalOpen(false)
      setRevertConfirmOid(null)
      toast(t('ide.git.revert_success', 'Código revertido com sucesso!'), 'success')
    } catch (err: any) {
      toast(`${t('ide.git.error', 'Erro:')} ${err.message}`, 'error')
    } finally {
      setIsReverting(false)
    }
  }

  const handleShowLogs = async () => {
    if (!syncManager) return
    try {
      const { branches: allBranches, currentBranch } = await syncManager.getBranches()
      setBranches(allBranches)
      setSelectedBranch(currentBranch)
      const logs = await syncManager.getLog(50, currentBranch)
      setGitLogs(logs)
      setIsLogModalOpen(true)
    } catch (err: any) {
      toast(`Erro ao carregar histórico: ${err.message}`, 'error')
    }
  }

  const handleBranchChange = async (branchName: string) => {
    if (!syncManager) return

    if (branchName === '__NEW_BRANCH__') {
      setNewBranchName('')
      setShowNewBranchModal(true)
      setSelectedBranch(selectedBranch)
      return
    }

    setSelectedBranch(branchName)
    try {
      if (isLogModalOpen) {
        const logs = await syncManager.getLog(50, branchName)
        setGitLogs(logs)
      } else {
        await syncManager.checkoutBranch(branchName)
        const { branches, currentBranch } = await syncManager.getBranches()
        setBranches(branches)
        setSelectedBranch(currentBranch)
        if (target) {
          const configManager = new GitConfigManager(target.slug)
          const config = await configManager.getConfig()
          const sandboxBranch = config.branchSandbox || 'sync-sandbox'
          setSandboxMode(currentBranch === sandboxBranch)
        }
        await loadFileTree()
        resetTabs()
      }
    } catch (err: any) {
      toast(`Erro ao trocar branch: ${err.message}`, 'error')
    }
  }

  const handleCreateBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBranchName.trim() || !syncManager) return
    setIsCreatingBranch(true)
    const name = newBranchName.trim()
    try {
      await syncManager.createBranch(name)
      const { branches, currentBranch } = await syncManager.getBranches()
      setBranches(branches)
      setSelectedBranch(currentBranch)
      await loadFileTree()
      toast(`Branch ${name} criada com sucesso!`, 'success')
      setShowNewBranchModal(false)
    } catch (err: any) {
      toast(`Erro ao criar branch: ${err.message}`, 'error')
    } finally {
      setIsCreatingBranch(false)
    }
  }

  const handlePushToRemote = async () => {
    if (!syncManager || !target) return
    setIsPushing(true)
    try {
      const configManager = new GitConfigManager(target.slug)
      const config = await configManager.getConfig()
      if (!config.remoteUrl || !config.accessToken) {
        toast('Configure a URL e o Token do GitHub nas Configurações Git primeiro.', 'error')
        setShowGitSettings(true)
        return
      }
      await syncManager.pushToRemote(config.remoteUrl, config.accessToken, selectedBranch)
      toast(`Branch ${selectedBranch} enviada para o remoto com sucesso!`, 'success')
    } catch (err: any) {
      toast(`Erro no Push: ${err.message}`, 'error')
    } finally {
      setIsPushing(false)
    }
  }

  const handlePullFromRemote = async () => {
    if (!syncManager || !target) return
    setIsPulling(true)
    try {
      const configManager = new GitConfigManager(target.slug)
      const config = await configManager.getConfig()
      if (!config.remoteUrl || !config.accessToken) {
        toast('Configure a URL e o Token do GitHub nas Configurações Git primeiro.', 'error')
        setShowGitSettings(true)
        return
      }
      await syncManager.pullFromRemote(config.remoteUrl, config.accessToken, selectedBranch)
      await loadFileTree()
      toast(`Branch ${selectedBranch} atualizada com sucesso!`, 'success')
    } catch (err: any) {
      toast(`Erro no Pull: ${err.message}`, 'error')
    } finally {
      setIsPulling(false)
    }
  }

  const handleOpenCommitModal = async (mode: 'commit' | 'merge' = 'commit') => {
    if (!syncManager) return
    setIsCommitLoading(true)
    try {
      const files = mode === 'commit'
        ? await syncManager.getChangedFiles()
        : await syncManager.getMergeDiffFiles()

      if (files.length === 0) {
        toast(
          mode === 'commit'
            ? t('workspace_components.ide_local.no_local_changes', 'Nenhuma alteração local pendente.')
            : t('workspace_components.ide_local.no_changes_to_merge', 'Nenhuma alteração para o merge.'),
          'info'
        )
        if (mode === 'merge') {
          await syncManager.cleanUpSandbox()
          setSandboxMode(false)
          const { branches, currentBranch } = await syncManager.getBranches()
          setBranches(branches)
          setSelectedBranch(currentBranch)
          await loadFileTree()
        }
        return
      }

      setChangedFiles(files)
      const allPaths = new Set(files.map(f => f.filepath))
      setSelectedCommitFiles(allPaths)
      setModalMode(mode)

      // Auto-select the first file for the diff view
      if (files.length > 0 && setDiffActiveFile && setDiffOriginalContent && setDiffLocalContent) {
        const firstFile = files[0].filepath
        setDiffActiveFile(firstFile)
        const targetRef = mode === 'merge' ? 'local' : 'HEAD'
        const originalContent = await syncManager.getFileHeadContent(firstFile, targetRef)
        setDiffOriginalContent(originalContent)

        let localContent = ''
        const fullPath = target ? `AGTech/MetaBuilderPRO/${target.slug}/${firstFile}` : firstFile
        if (fileContents[fullPath] !== undefined) {
          localContent = fileContents[fullPath]
        } else {
          localContent = await syncManager.getFileLocalContent(firstFile)
        }
        setDiffLocalContent(localContent)
      }

      setIsCommitModalOpen(true)
    } catch (err: any) {
      toast(`Erro ao buscar alterações: ${err.message}`, 'error')
    } finally {
      setIsCommitLoading(false)
    }
  }

  const resetGit = () => {
    setSandboxMode(false)
    setGitLogs([])
    setBranches([])
    setSelectedBranch('local')
  }

  return {
    isSyncing,
    isDiscarding,
    isConfirming,
    sandboxMode,
    setSandboxMode,
    gitLogs,
    setGitLogs,
    branches,
    setBranches,
    selectedBranch,
    setSelectedBranch,
    isLogModalOpen,
    setIsLogModalOpen,
    showDiscardConfirm,
    setShowDiscardConfirm,
    revertConfirmOid,
    setRevertConfirmOid,
    isReverting,
    setIsReverting,
    showGitSettings,
    setShowGitSettings,
    isPushing,
    setIsPushing,
    isPulling,
    setIsPulling,
    isCommitModalOpen,
    setIsCommitModalOpen,
    modalMode,
    setModalMode,
    commitMessage,
    setCommitMessage,
    isCommitting,
    setIsCommitting,
    changedFiles,
    setChangedFiles,
    selectedCommitFiles,
    setSelectedCommitFiles,
    isCommitLoading,
    setIsCommitLoading,
    commitMenu,
    setCommitMenu,
    revertLocalConfirm,
    setRevertLocalConfirm,
    selectedListFiles,
    setSelectedListFiles,
    showNewBranchModal,
    setShowNewBranchModal,
    newBranchName,
    setNewBranchName,
    isCreatingBranch,
    setIsCreatingBranch,
    handleSyncFromWeb,
    handleConfirmSync,
    handleAbortSync,
    handleRevertCommit,
    handleShowLogs,
    handleBranchChange,
    handleCreateBranchSubmit,
    handlePushToRemote,
    handlePullFromRemote,
    handleOpenCommitModal,
    resetGit
  }
}
