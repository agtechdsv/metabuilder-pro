import { useState, useMemo } from 'react'
import { useToast } from '@/components/ui/Toast'
import { toggleClientBlock, deleteClientAdmin } from '@/app/actions/admin'

export function useClientsAdmin(
  mappedWorkspaces: any[],
  clientProfiles: any[],
  setWorkspaces: React.Dispatch<React.SetStateAction<any[]>>,
  setClientProfiles: React.Dispatch<React.SetStateAction<any[]>>
) {
  const { toast } = useToast()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked' | 'registered'>('all')
  const [clientTypeFilter, setClientTypeFilter] = useState<'PRO' | 'FREE'>('PRO')

  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false)
  const [workspaceToBlock, setWorkspaceToBlock] = useState<{ id: string, isBlocked: boolean, name: string } | null>(null)
  const [isBlockingWorkspace, setIsBlockingWorkspace] = useState(false)

  const [isDeleteClientModalOpen, setIsDeleteClientModalOpen] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<{ id: string, name: string, ownerName: string, ownerId: string, ownerEmail: string } | null>(null)
  const [isDeletingClient, setIsDeletingClient] = useState(false)

  const filteredClients = useMemo(() => {
    const clientsMap = new Map<string, any>()
    
    // First, initialize all clients from profiles
    clientProfiles.forEach(p => {
      if (p.is_super_admin) return

      clientsMap.set(p.id, {
        ownerId: p.id,
        ownerName: p.full_name || 'Sem nome',
        ownerEmail: p.email || 'Sem e-mail',
        ownerLicenses: p.subscription_licenses || 0,
        subscription_tier: p.subscription_tier || 'free',
        guestCount: 0,
        created_at: p.created_at || new Date().toISOString(), // Fallback if missing
        is_blocked: p.is_blocked || false,
        workspaces: []
      })
    })

    // Then, attach workspaces and sum guest count
    mappedWorkspaces.forEach(w => {
      if (w.ownerIsSuperAdmin) return
      
      let client = clientsMap.get(w.owner_id)
      if (!client) {
         client = {
            ownerId: w.owner_id,
            ownerName: w.ownerName,
            ownerEmail: w.ownerEmail,
            ownerLicenses: w.ownerLicenses,
            subscription_tier: w.subscription_tier || 'free',
            guestCount: 0,
            created_at: w.created_at,
            is_blocked: w.is_blocked,
            workspaces: []
         }
         clientsMap.set(w.owner_id, client)
      }
      
      client.workspaces.push(w)
      client.guestCount += (w.guestCount || 0)
      if (w.created_at && (!client.created_at || client.created_at === new Date().toISOString())) {
        client.created_at = w.created_at // Use oldest workspace date or profile date
      }
    })

    const result: any[] = []
    
    clientsMap.forEach(client => {
      const matchesSearch =
        client.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.ownerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.workspaces.some((w: any) => 
          w.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          w.slug.toLowerCase().includes(searchQuery.toLowerCase())
        )

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !client.is_blocked) ||
        (statusFilter === 'blocked' && client.is_blocked) ||
        (statusFilter === 'registered' && client.subscription_tier !== 'pro')

      const matchesType = 
        clientTypeFilter === 'PRO' ? client.subscription_tier === 'pro' : client.subscription_tier !== 'pro'

      if (matchesSearch && matchesStatus && matchesType) {
        result.push(client)
      }
    })
    
    return result
  }, [mappedWorkspaces, clientProfiles, searchQuery, statusFilter, clientTypeFilter])

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
    clientTypeFilter,
    setClientTypeFilter,
    handleToggleBlock,
    handleConfirmToggleBlock,
    handleDeleteClient,
    handleConfirmDeleteClient
  }
}
