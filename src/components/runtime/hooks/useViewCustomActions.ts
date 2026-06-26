import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

export function useViewCustomActions({
  projectId,
  modelName,
  project,
  tunnelChannel,
  isTunnelReady,
  onCustomAction,
  setRefreshTrigger
}: {
  projectId: string
  modelName: string
  project: any
  tunnelChannel: any
  isTunnelReady: boolean
  onCustomAction?: (action: any, row?: any) => void
  setRefreshTrigger: React.Dispatch<React.SetStateAction<number>>
}) {
  const { toast } = useToast()
  const router = useRouter()

  const [iframeUrl, setIframeUrl] = useState<string>('')
  const [iframeTitle, setIframeTitle] = useState<string>('')
  const [isIframeModalOpen, setIsIframeModalOpen] = useState(false)
  const [iframeModalSize, setIframeModalSize] = useState<string>('md')
  const [iframeModalWidth, setIframeModalWidth] = useState<string>('')
  const [iframeModalHeight, setIframeModalHeight] = useState<string>('')
  const [isIframeDrawerOpen, setIsIframeDrawerOpen] = useState(false)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CLOSE_MODAL') {
        setIsIframeModalOpen(false)
        setIsIframeDrawerOpen(false)
        setIframeUrl('')
        setRefreshTrigger(prev => prev + 1)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [setRefreshTrigger])

  const handleCustomAction = async (action: any, rowData?: any) => {
    if (onCustomAction) {
      onCustomAction(action, rowData)
      return
    }

    // Helper to interpolate variables {{field}}
    const interpolate = (str: string) => {
      if (!str || !rowData) return str
      return str.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
        return rowData[key] !== undefined ? String(rowData[key]) : match
      })
    }

    if (action.linked_bpm_workflows && action.linked_bpm_workflows.length > 0) {
      if (!tunnelChannel || !isTunnelReady) {
        toast('Túnel com banco de dados não está pronto para automações.', 'error')
      } else {
        const payload: any = {
          action: 'trigger_bpm',
          workflows: action.linked_bpm_workflows,
          rowData: rowData || {},
          token: project?.secret_token || 'test-token',
          tableName: modelName,
          schemaName: project?.slug || 'public'
        }
        tunnelChannel.send({ type: 'broadcast', event: 'sql_query', payload })

        setTimeout(() => {
          setRefreshTrigger(prev => prev + 1)
          toast('Ação executada com sucesso!', 'success')
        }, 1500)
      }
    }

    if (action.trigger_type === 'sql') {
      if (!tunnelChannel || !isTunnelReady) {
        toast('Túnel com banco de dados não está pronto.', 'error')
        return
      }
      const queryId = crypto.randomUUID()
      const currentModel = project?.models?.find((m: any) => m.db_table_name === modelName)
      const actualSchemaName = currentModel?.db_schema_name || project?.slug || 'public'
      const customQuery = interpolate(action.sql_query || '')

      const payload: any = {
        queryId,
        query: customQuery,
        sql: customQuery,
        params: [],
        action: 'execute_custom',
        token: project?.secret_token || 'test-token',
        schemaName: actualSchemaName,
        table: modelName
      }
      tunnelChannel.send({
        type: 'broadcast',
        event: 'sql_query',
        payload
      })
      toast(`Executando ação: ${action.label}...`, 'info')
    }
    else if (action.trigger_type === 'usecase') {
      if (!action.usecase_slug) {
        return
      }
      const slug = interpolate(action.usecase_slug)
      const params = interpolate(action.usecase_params) || ''

      const level = rowData?.__mindmap_level__
      let selectedFields = action.usecase_selected_fields || []
      
      // DEBUG: Log para diagnosticar params por nível
      console.error('[CustomAction DEBUG]', {
        level,
        mindmap_params_by_level: action.mindmap_params_by_level,
        usecase_selected_fields: action.usecase_selected_fields,
        rowData_keys: rowData ? Object.keys(rowData) : [],
      })

      if (level !== undefined && level !== null) {
        let parsedMindmapParams = action.mindmap_params_by_level
        if (typeof parsedMindmapParams === 'string') {
          try { parsedMindmapParams = JSON.parse(parsedMindmapParams) } catch (e) {}
        }
        selectedFields = parsedMindmapParams?.[String(level)] || []
        console.error('[CustomAction DEBUG] level selectedFields:', String(level), selectedFields)
      }
      const fieldsParams = selectedFields
        .map((f: any) => {
          if (typeof f === 'string') {
            const cleanKey = f.includes('.') ? f.split('.').pop() : f;
            const val = rowData?.[f] !== undefined ? rowData[f] : rowData?.[cleanKey as string];
            if (val === undefined || val === null || val === '') return '';
            return `${cleanKey}=${encodeURIComponent(val)}`
          } else if (f && typeof f === 'object' && f.source && f.target) {
            const cleanSource = f.source.includes('.') ? f.source.split('.').pop() : f.source;
            const val = rowData?.[f.source] !== undefined ? rowData[f.source] : rowData?.[cleanSource as string];
            if (val === undefined || val === null || val === '') return '';
            return `${f.target}=${encodeURIComponent(val)}`
          }
          return ''
        })
        .filter(Boolean)
        .join('&')

      const allParams = [fieldsParams, params].filter(Boolean).join('&')

      const pathParts = window.location.pathname.split('/').filter(Boolean)
      const isAdminPath = pathParts[0] === 'admin'
      const currentWorkspaceSlug = isAdminPath ? pathParts[1] : pathParts[0]
      const currentProjectSlug = isAdminPath ? pathParts[2] : pathParts[1]
      const url = `/${project?.workspace?.slug || currentWorkspaceSlug}/${project?.slug || currentProjectSlug}/${slug}${allParams ? '?' + allParams : ''}`
      const openMode = action.usecase_open_mode || 'page'

      if (openMode === 'modal') {
        setIframeUrl(url + (allParams ? '&embedded=true' : '?embedded=true'))
        setIframeTitle(action.label || 'Visualizar')
        setIframeModalSize(action.usecase_modal_size || 'md')
        setIframeModalWidth(action.usecase_modal_width || '')
        setIframeModalHeight(action.usecase_modal_height || '')
        setIsIframeModalOpen(true)
      } else if (openMode === 'drawer') {
        setIframeUrl(url + (allParams ? '&embedded=true' : '?embedded=true'))
        setIframeTitle(action.label || 'Visualizar')
        setIsIframeDrawerOpen(true)
      } else {
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
        const finalUrl = url + (url.includes('?') ? '&' : '?') + `return_to=${returnTo}`
        router.push(finalUrl)
      }
    }
    else if (action.trigger_type === 'rest') {
      const url = interpolate(action.rest_url)
      try {
        toast(`Executando chamada REST...`, 'info')
        const options: RequestInit = {
          method: action.rest_method || 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
        if (['POST', 'PUT', 'PATCH'].includes(action.rest_method) && action.rest_body) {
          options.body = interpolate(action.rest_body)
        }
        const res = await fetch(url, options)
        if (res.ok) {
          toast(`Ação "${action.label}" executada com sucesso!`, 'success')
        } else {
          toast(`Erro ao executar API: ${res.status} ${res.statusText}`, 'error')
        }
      } catch (err: any) {
        toast(`Erro de rede: ${err.message}`, 'error')
      }
    }
  }

  return {
    iframeUrl,
    setIframeUrl,
    iframeTitle,
    setIframeTitle,
    isIframeModalOpen,
    setIsIframeModalOpen,
    iframeModalSize,
    setIframeModalSize,
    iframeModalWidth,
    setIframeModalWidth,
    iframeModalHeight,
    setIframeModalHeight,
    isIframeDrawerOpen,
    setIsIframeDrawerOpen,
    handleCustomAction
  }
}
