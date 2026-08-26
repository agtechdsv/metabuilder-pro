import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { LocalSyncManager } from '@/utils/localSyncManager'
import * as tauriFs from '@tauri-apps/plugin-fs'
import { BaseDirectory } from '@tauri-apps/api/path'
import { useToast } from '@/components/ui/Toast'

export interface UseIDEGitProps {
  target: any
  syncManager: LocalSyncManager | null
  loadFileTree: () => Promise<void>
  resetTabs: () => void
}

export function useIDEGit({ target, syncManager, loadFileTree, resetTabs }: UseIDEGitProps) {
  const { toast } = useToast()
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
  const [changedFiles, setChangedFiles] = useState<{filepath: string, status: 'added'|'modified'|'deleted'}[]>([])
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
      setSandboxMode(true)
      await loadFileTree()
      
      if (mergeResult.oid) {
        toast('Merge limpo! Nenhum conflito encontrado.', 'success')
      } else {
        toast('Atenção: Conflitos encontrados. Resolva no editor antes de confirmar.', 'info')
      }
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err.message
      toast(`Erro ao sincronizar: ${msg}`, 'error')
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
      await loadFileTree()
      toast('Sincronização Efetivada', 'success')
    } catch (err: any) {
      toast(`Erro: ${err.message}`, 'error')
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
      await loadFileTree()
      resetTabs()
      setShowDiscardConfirm(false)
      toast('Sincronização Descartada', 'info')
    } catch (err: any) {
      toast(`Erro: ${err.message}`, 'error')
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
      toast('Código revertido com sucesso!', 'success')
    } catch (err: any) {
      toast(`Erro ao reverter: ${err.message}`, 'error')
    } finally {
      setIsReverting(false)
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
    resetGit
  }
}
