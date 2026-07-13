import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

interface UseCustomActionsRuntimeProps {
  project: any
  modelName: string
  customSlots: any[]
  customActions: any[]
  tunnelChannel: any
  isTunnelReady: boolean
  selectedRow: any
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>
  setRelationalRefreshKey: React.Dispatch<React.SetStateAction<number>>
  setDetailRefreshKey: React.Dispatch<React.SetStateAction<number>>
  setSelectedRow: React.Dispatch<React.SetStateAction<any>>
  setDrawerMode: React.Dispatch<React.SetStateAction<'create' | 'edit' | 'view'>>
  setIsPageVisible: React.Dispatch<React.SetStateAction<boolean>>
  setAutoOpenSlotConfig: React.Dispatch<React.SetStateAction<{ id: string, type: 'modal' | 'drawer' } | null>>
  setIframeUrl: React.Dispatch<React.SetStateAction<string>>
  setIframeTitle: React.Dispatch<React.SetStateAction<string>>
  setIsIframeModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  setIsIframeDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>
  fetchDetails: (parentRow: any, parentModel: string) => Promise<any[]>
  baseUrl?: string
}

export function useCustomActionsRuntime({
  project,
  modelName,
  customSlots,
  customActions,
  baseUrl,
  tunnelChannel,
  isTunnelReady,
  selectedRow,
  setRefreshKey,
  setRelationalRefreshKey,
  setDetailRefreshKey,
  setSelectedRow,
  setDrawerMode,
  setIsPageVisible,
  setAutoOpenSlotConfig,
  setIframeUrl,
  setIframeTitle,
  setIsIframeModalOpen,
  setIsIframeDrawerOpen,
  fetchDetails
}: UseCustomActionsRuntimeProps) {
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CLOSE_MODAL') {
        setIsIframeModalOpen(false)
        setIsIframeDrawerOpen(false)
        setIframeUrl('')
        setRefreshKey(prev => prev + 1)
        setRelationalRefreshKey(prev => prev + 1)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [setIsIframeModalOpen, setIsIframeDrawerOpen, setIframeUrl, setRefreshKey, setRelationalRefreshKey])

  const gridCustomActions = useMemo(() => {
    const dynamicActions = customSlots
      .filter((slot: any) => (slot.render_mode === 'button' || slot.render_mode === 'both') && slot.button_config?.location === 'search_grid_record')
      .map((slot: any) => ({
        id: `custom_slot_${slot.id}`,
        label: slot.button_config?.label || slot.title,
        icon: slot.button_config?.icon || 'external-link',
        context: 'row',
        action_type: slot.button_config?.action_type || 'modal'
      }));
    
    return [...customActions, ...dynamicActions];
  }, [customSlots, customActions]);

  const handleCustomAction = async (action: any, rowData?: any) => {
    const interpolate = (str: string) => {
      if (!str || !rowData) return str
      return str.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
        return rowData[key] !== undefined ? String(rowData[key]) : match
      })
    }

    if (action.action === 'system_refresh') {
      setRefreshKey(prev => prev + 1)
      setRelationalRefreshKey(prev => prev + 1)
      setDetailRefreshKey(prev => prev + 1)
      
      // If there's an open record modal, fetch fresh details
      if (selectedRow && Object.keys(selectedRow).length > 0) {
         fetchDetails(selectedRow, modelName).then(updatedDetails => {
           setSelectedRow((prev: any) => ({ ...prev, _details: updatedDetails }))
         })
      }
      return
    }

    if (action.id && action.id.startsWith('custom_slot_')) {
      const slotId = action.id.replace('custom_slot_', '');
      
      // Abre a cortina/layout principal
      setSelectedRow(rowData);
      setDrawerMode('view');
      setIsPageVisible(true);
      
      // Manda abrir a aba correspondente via modal/drawer
      setAutoOpenSlotConfig({ id: slotId, type: action.action_type || 'modal' });
      return;
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
        
        // Atualização silenciosa da tela após 1.5s para dar tempo ao fluxo de processar
        setTimeout(() => {
          setRefreshKey(prev => prev + 1)
          setRelationalRefreshKey(prev => prev + 1)
          setDetailRefreshKey(prev => prev + 1)
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
      tunnelChannel.send({ type: 'broadcast', event: 'sql_query', payload })
      toast(`Executando ação: ${action.label}...`, 'info')
    } 
    else if (action.trigger_type === 'usecase') {
      if (!action.usecase_slug) {
        return; // Just BPM was intended
      }
      const slug = interpolate(action.usecase_slug)
      const params = interpolate(action.usecase_params) || ''

      // Suporte a ações por nível no mapa mental com params acumulados dos ancestrais
      const level = rowData?.__mindmap_level__
      const ancestors: { level: number; rawData: any }[] = rowData?.__mindmap_ancestors__ || []

      // Parseia mindmap_params_by_level uma única vez
      let parsedMindmapParams: any = action.mindmap_params_by_level
      if (typeof parsedMindmapParams === 'string') {
        try { parsedMindmapParams = JSON.parse(parsedMindmapParams) } catch (e) {}
      }

      // Helper para extrair o valor de um campo do rowData
      const extractParam = (f: any, data: any): string => {
        if (typeof f === 'string') {
          const cleanKey = f.includes('.') ? f.split('.').pop() : f;
          const val = data?.[f] !== undefined ? data[f] : data?.[cleanKey as string]
          if (val === undefined || val === null || val === '') return ''
          return `${f}=${encodeURIComponent(val)}`
        } else if (f && typeof f === 'object' && f.source && f.target) {
          const cleanSource = f.source.includes('.') ? f.source.split('.').pop() : f.source
          const val = data?.[f.source] !== undefined ? data[f.source] : data?.[cleanSource as string]
          if (val === undefined || val === null || val === '') return ''
          return `${f.target}=${encodeURIComponent(val)}`
        }
        return ''
      }

      // Campos do nível atual
      let selectedFields = action.usecase_selected_fields || []
      if (level !== undefined && level !== null && parsedMindmapParams) {
        const levelFields = parsedMindmapParams?.[String(level)]
        if (levelFields && levelFields.length > 0) selectedFields = levelFields
      }
      const currentLevelParams = selectedFields
        .map((f: any) => extractParam(f, rowData))
        .filter(Boolean)

      // Campos dos ancestrais (params acumulados dos níveis superiores)
      const ancestorParams: string[] = []
      if (parsedMindmapParams) {
        for (const ancestor of ancestors) {
          const ancestorFields = parsedMindmapParams?.[String(ancestor.level)]
          if (ancestorFields && ancestorFields.length > 0) {
            ancestorFields.forEach((f: any) => {
              const p = extractParam(f, ancestor.rawData)
              if (p) ancestorParams.push(p)
            })
          }
        }
      }

      const allParamParts = [...currentLevelParams, ...ancestorParams, params].filter(Boolean)
      const allParams = allParamParts.join('&')
      
      const base = baseUrl !== undefined 
        ? baseUrl 
        : `/${project?.workspace?.slug || (window.location.pathname.split('/').filter(Boolean)[0] === 'admin' ? window.location.pathname.split('/').filter(Boolean)[1] : window.location.pathname.split('/').filter(Boolean)[0])}/${project?.slug || (window.location.pathname.split('/').filter(Boolean)[0] === 'admin' ? window.location.pathname.split('/').filter(Boolean)[2] : window.location.pathname.split('/').filter(Boolean)[1])}`
      
      const url = `${base}/${slug}${allParams ? '?' + allParams : ''}`
      const openMode = action.usecase_open_mode || 'page'
      
      if (openMode === 'modal') {
        setIframeUrl(url + (allParams ? '&embedded=true' : '?embedded=true'))
        setIframeTitle(action.label || 'Visualizar')
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
          headers: { 'Content-Type': 'application/json' }
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

  return { gridCustomActions, handleCustomAction }
}
