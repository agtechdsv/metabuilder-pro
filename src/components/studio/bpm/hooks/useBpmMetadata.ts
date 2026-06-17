import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

interface UseBpmMetadataProps {
  project: any
  initialViews: any[]
  initialModels: any[]
}

export function useBpmMetadata({
  project,
  initialViews,
  initialModels
}: UseBpmMetadataProps) {
  const supabase = createClient()
  const projectId = project?.id

  const [localViews, setLocalViews] = useState(initialViews)
  const [dbModels, setDbModels] = useState<any[]>(initialModels)
  const [dbFields, setDbFields] = useState<any[]>(() => initialModels.flatMap(m => m.fields || []))
  
  const [enums, setEnums] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])

  useEffect(() => {
    if (!projectId) return
    const fetchEnums = async () => {
      const { data } = await supabase
        .from('project_enumerations')
        .select('*')
        .eq('project_id', projectId)
      if (data) setEnums(data)
    }
    fetchEnums()
  }, [projectId])

  useEffect(() => {
    let unmounted = false
    if (!project) return
    
    const fetchRoles = async () => {
      const authConfig = project.auth_config || {}
      if (authConfig.sync_legacy_groups && authConfig.db_groups_table) {
        try {
          const currentModel = initialModels.find(m => m.db_table_name === authConfig.db_groups_table)
          const schemaName = currentModel?.db_schema_name || 'public'
          
          const tunnelQuery = () => new Promise<any>((resolve, reject) => {
            const channelName = `tunnel:${project.id}`
            const queryId = crypto.randomUUID()
            let isFinished = false
            const channel = supabase.channel(channelName)
            
            const cleanup = () => {
              if (isFinished) return
              isFinished = true
              try { supabase.removeChannel(channel) } catch(e){}
            }

            channel.on('broadcast', { event: `query_result_${queryId}` }, (response: any) => {
              cleanup()
              if (response.payload?.success) {
                resolve(response.payload.data)
              } else {
                reject(new Error(response.payload?.error || 'Erro'))
              }
            })

            setTimeout(() => {
              if (unmounted || isFinished) return
              
              const sendQuery = async () => {
                await channel.send({
                  type: 'broadcast', event: 'sql_query',
                  payload: { action: 'select', table: authConfig.db_groups_table, schemaName, limit: 100, offset: 0, queryId, token: project.secret_token }
                })
              }

              if (channel.state === 'joined') {
                sendQuery()
              } else {
                channel.subscribe(async (status) => {
                  if (unmounted || isFinished) return
                  if (status === 'SUBSCRIBED') {
                    await sendQuery()
                  }
                })
              }
            }, 200)

            setTimeout(() => {
              if (!isFinished) {
                cleanup()
                if (!unmounted) reject(new Error('Timeout'))
              }
            }, 6000)
          })

          const data = await tunnelQuery()
          if (unmounted) return
          const pkField = currentModel?.fields?.find((f: any) => f.is_primary_key)?.db_column_name || 'id'
          const nameField = authConfig.db_groups_name_column || 'name'
          const mappedRoles = data.map((r: any) => ({
            id: r[pkField]?.toString() || crypto.randomUUID(),
            name: r[nameField] || 'Grupo'
          }))
          setRoles(mappedRoles)
        } catch(err) {
          if (!unmounted) console.error(err)
        }
      } else {
        const { data: dbRoles } = await supabase.from('project_roles').select('*').eq('project_id', project.id)
        if (dbRoles && !unmounted) setRoles(dbRoles)
      }
    }
    
    fetchRoles()
    
    return () => { unmounted = true }
  }, [project, initialModels])

  return {
    localViews,
    setLocalViews,
    dbModels,
    setDbModels,
    dbFields,
    setDbFields,
    enums,
    setEnums,
    roles,
    setRoles
  }
}
