import { useState, useMemo } from 'react'
import { useToast } from '@/components/ui/Toast'
import { toggleClientBlock, deleteClientAdmin } from '@/app/actions/admin'

export function useClientsAdmin(
  mappedWorkspaces: any[],
  setWorkspaces: React.Dispatch<React.SetStateAction<any[]>>,
  setClientProfiles: React.Dispatch<React.SetStateAction<any[]>>
) {
  const { toast } = useToast()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked' | 'registered'>('all')

  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false)
  const [workspaceToBlock, setWorkspaceToBlock] = useState<{ id: string, isBlocked: boolean, name: string } | null>(null)
  const [isBlockingWorkspace, setIsBlockingWorkspace] = useState(false)

  const [isDeleteClientModalOpen, setIsDeleteClientModalOpen] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<{ id: string, name: string, ownerName: string, ownerId: string, ownerEmail: string } | null>(null)
  const [isDeletingClient, setIsDeletingClient] = useState(false)

  const filteredClients = useMemo(() => {
    const clientsMap = new Map<string, any>()
    mappedWorkspaces.forEach(w => {
      if (w.ownerIsSuperAdmin) return

      const matchesSearch =
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.ownerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.slug.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !w.is_blocked && w.ownerLicenses > 0) ||
        (statusFilter === 'blocked' && w.is_blocked) ||
        (statusFilter === 'registered' && w.ownerLicenses === 0)

      if (matchesSearch && matchesStatus) {
        if (!clientsMap.has(w.owner_id)) {
          clientsMap.set(w.owner_id, {
            ownerId: w.owner_id,
            ownerName: w.ownerName,
            ownerEmail: w.ownerEmail,
            ownerLicenses: w.ownerLicenses,
            guestCount: w.guestCount,
            created_at: w.created_at,
            is_blocked: w.is_blocked,
            workspaces: []
          })
        }
        clientsMap.get(w.owner_id).workspaces.push(w)
      }
    })
    return Array.from(clientsMap.values())
  }, [mappedWorkspaces, searchQuery, statusFilter])

  const handleToggleBlock = (ownerId: string, isBlocked: boolean, clientName: string) => {
    setWorkspaceToBlock({ id: ownerId, isBlocked, name: clientName })
    setIsBlockModalOpen(true)
  }

  const handleConfirmToggleBlock = async () => {
    if (!workspaceToBlock) return
    setIsBlockingWorkspace(true)
    const actionLabel = workspaceToBlock.isBlocked ? 'bloquear' : 'desbloquear'
    const result = await toggleClientBlock(workspaceToBlock.id, workspaceToBlock.isBlocked)
    setIsBlockingWorkspace(false)
    if (result.success) {
      toast(`Cliente "${workspaceToBlock.name}" foi ${workspaceToBlock.isBlocked ? 'bloqueado' : 'desbloqueado'} com sucesso!`, 'success')
      setClientProfiles(prev => prev.map(p => p.id === workspaceToBlock.id ? {
        ...p,
        is_blocked: workspaceToBlock.isBlocked,
        subscription_status: workspaceToBlock.isBlocked ? 'blocked' : 'active'
      } : p))
      setIsBlockModalOpen(false)
      setWorkspaceToBlock(null)
    } else {
      toast(result.error || `Erro ao ${actionLabel} o cliente.`, 'error')
    }
  }

  const handleDeleteClient = (ownerName: string, ownerId: string, ownerEmail: string) => {
    setClientToDelete({ id: '', name: '', ownerName, ownerId, ownerEmail })
    setIsDeleteClientModalOpen(true)
  }

  const handleConfirmDeleteClient = async () => {
    if (!clientToDelete) return
    setIsDeletingClient(true)
    const result = await deleteClientAdmin(clientToDelete.ownerId)
    setIsDeletingClient(false)
    if (result.success) {
      toast(`Cliente "${clientToDelete.ownerName}" (${clientToDelete.name}) excluído com sucesso.`, 'success')
      setWorkspaces(prev => prev.filter(w => w.owner_id !== clientToDelete.ownerId))
      setIsDeleteClientModalOpen(false)
      setClientToDelete(null)
    } else {
      toast(result.error || 'Erro ao excluir o cliente.', 'error')
    }
  }

  return {
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
    handleToggleBlock,
    handleConfirmToggleBlock,
    handleDeleteClient,
    handleConfirmDeleteClient
  }
}
