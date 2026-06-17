import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { EmailTemplateType } from '@/utils/emailTemplates'

interface UseBpmEmailActionsProps {
  project: any
  initialModels: any[]
  selectedNode: any
  reactFlowInstance: any
  toast: (msg: string, type: 'success' | 'error' | 'info') => void
  t: (key: string, fallback?: string) => string
}

export function useBpmEmailActions({
  project,
  initialModels,
  selectedNode,
  reactFlowInstance,
  toast,
  t
}: UseBpmEmailActionsProps) {
  const supabase = createClient()
  
  const [selectedGroupForModal, setSelectedGroupForModal] = useState<{ id: string, name: string } | null>(null)
  const [groupUsers, setGroupUsers] = useState<any[]>([])
  const [isLoadingGroupUsers, setIsLoadingGroupUsers] = useState(false)
  const [selectedUsersInModal, setSelectedUsersInModal] = useState<string[] | 'all'>('all')
  const [modalSearchTerm, setModalSearchTerm] = useState('')
  const [editingEmailNode, setEditingEmailNode] = useState<string | null>(null)
  const [tempEmailData, setTempEmailData] = useState<{ subject: string, body: string, template: EmailTemplateType }>({ subject: '', body: '', template: 'free' })
  const [isPreviewEmailOpen, setIsPreviewEmailOpen] = useState(false)

  useEffect(() => {
    if (editingEmailNode) {
      const node = reactFlowInstance?.getNode(editingEmailNode)
      setTempEmailData({
        subject: (node?.data?.actionSubject as string) || '',
        body: (node?.data?.actionBody as string) || '',
        template: (node?.data?.emailTemplate as EmailTemplateType) || 'free'
      })
    }
  }, [editingEmailNode, reactFlowInstance])

  const openGroupUsersModal = async (grupo: { id: string, name: string }) => {
    setSelectedGroupForModal(grupo)
    setIsLoadingGroupUsers(true)
    setGroupUsers([])
    setModalSearchTerm('')
    
    const currentGroupsUsers: any = selectedNode?.data?.emailGroupsUsers || {}
    const currentSelection = currentGroupsUsers[grupo.name]
    setSelectedUsersInModal(currentSelection || 'all')

    try {
      const authConfig = project?.auth_config || {}
      const currentModel = initialModels.find(m => m.db_table_name === authConfig.db_table_name)
      const pkField = currentModel?.fields?.find((f: any) => f.is_primary_key)?.db_column_name || 'id'
      const emailField = authConfig.db_email_column || 'email'
      const nameField = authConfig.db_name_column || 'name'

      if (authConfig.sync_legacy_groups && authConfig.db_table_name) {
        let sql = ''
        if (authConfig.db_user_groups_type === 'n_to_n') {
          const urTable = authConfig.db_user_roles_table
          const userCol = authConfig.db_user_roles_user_id_column
          const roleCol = authConfig.db_user_roles_role_id_column
          sql = `SELECT u.* FROM "${authConfig.db_table_name}" u INNER JOIN "${urTable}" ur ON CAST(u."${pkField}" AS text) = CAST(ur."${userCol}" AS text) WHERE CAST(ur."${roleCol}" AS text) = '${grupo.id}'`
        } else {
          const roleCol = authConfig.db_user_role_column
          sql = `SELECT * FROM "${authConfig.db_table_name}" WHERE CAST("${roleCol}" AS text) = '${grupo.id}'`
        }

        const schemaName = currentModel?.db_schema_name || 'public'

        const tunnelQuery = () => new Promise<any>((resolve, reject) => {
          const channelName = `tunnel:${project!.id}`
          const queryId = crypto.randomUUID()
          let isFinished = false
          const channel = supabase.channel(channelName)
          const cleanup = () => { if (isFinished) return; isFinished = true; try { supabase.removeChannel(channel) } catch(e){} }
          channel.on('broadcast', { event: `query_result_${queryId}` }, (response: any) => {
            cleanup()
            if (response.payload?.success) { resolve(response.payload.data); } else { reject(new Error(response.payload?.error || 'Erro')); }
          })
          setTimeout(() => {
            if (isFinished) return
            const sendQ = async () => {
              await channel.send({ type: 'broadcast', event: 'sql_query', payload: { action: 'select', schemaName, query: sql, limit: 1000, offset: 0, queryId, token: project!.secret_token } })
            }
            if (channel.state === 'joined') { sendQ(); } else {
              channel.subscribe(async (status) => { if (isFinished) return; if (status === 'SUBSCRIBED') await sendQ(); })
            }
          }, 200)
          setTimeout(() => { if (!isFinished) { cleanup(); reject(new Error('Timeout')); } }, 6000)
        })
        
        const data = await tunnelQuery()
        setGroupUsers(data.map((u: any) => ({
          id: u[pkField]?.toString(),
          name: u[nameField] || u[emailField] || 'Usuário',
          email: u[emailField] || ''
        })))
      } else {
        const { data: dbUsers } = await supabase.from('project_users').select('*').eq('project_id', project!.id)
        const { data: dbUserRoles } = await supabase.from('project_user_roles').select('*').eq('project_id', project!.id).eq('role_id', grupo.id)
        const userIds = dbUserRoles?.map(ur => ur.user_id) || []
        const filteredUsers = (dbUsers || []).filter(u => userIds.includes(u.id))
        
        setGroupUsers(filteredUsers.map(u => ({
          id: u.id,
          name: u.name || u.email || 'Usuário',
          email: u.email
        })))
      }
    } catch (err) {
      console.error(err)
      toast(t('bpm.canvas.toasts.get_users_error', 'Erro ao buscar usuários do grupo'), 'error')
    } finally {
      setIsLoadingGroupUsers(false)
    }
  }

  return {
    selectedGroupForModal,
    setSelectedGroupForModal,
    groupUsers,
    setGroupUsers,
    isLoadingGroupUsers,
    setIsLoadingGroupUsers,
    selectedUsersInModal,
    setSelectedUsersInModal,
    modalSearchTerm,
    setModalSearchTerm,
    editingEmailNode,
    setEditingEmailNode,
    tempEmailData,
    setTempEmailData,
    isPreviewEmailOpen,
    setIsPreviewEmailOpen,
    openGroupUsersModal
  }
}
