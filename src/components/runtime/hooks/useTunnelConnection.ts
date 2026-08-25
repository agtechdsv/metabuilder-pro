import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { wrapChannelWithChunking } from '@/lib/chunkedChannel'

interface UseTunnelConnectionProps {
  project: any
  modelName: string
  primaryKeyName: string
  isCadastroOnly: boolean
  initialEditId: string | null
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>
  setRelationalRefreshKey: React.Dispatch<React.SetStateAction<number>>
  setDetailRefreshKey: React.Dispatch<React.SetStateAction<number>>
  setSelectedRow: React.Dispatch<React.SetStateAction<any>>
  setDrawerMode: React.Dispatch<React.SetStateAction<'create' | 'edit' | 'view'>>
  setIsPageVisible: React.Dispatch<React.SetStateAction<boolean>>
  isEjectedApp?: boolean
}

export function useTunnelConnection({
  project,
  modelName,
  primaryKeyName,
  isCadastroOnly,
  initialEditId,
  setRefreshKey,
  setRelationalRefreshKey,
  setDetailRefreshKey,
  setSelectedRow,
  setDrawerMode,
  setIsPageVisible,
  isEjectedApp: isEjectedAppProp
}: UseTunnelConnectionProps) {
  const supabase = createClient()
  const [tunnelChannel, setTunnelChannel] = useState<any>(null)
  const [isTunnelReady, setIsTunnelReady] = useState(false)

  useEffect(() => {
    // Em apps ejected, não precisamos do WebSocket tunnel — a API REST local é suficiente.
    // Marcamos isTunnelReady=true imediatamente para que o ViewContainer possa buscar dados.
    if (isEjectedAppProp) {
      setIsTunnelReady(true)
      return
    }

    if (!project?.id) return

    const channelName = `tunnel:${project.id}`
    const channel = wrapChannelWithChunking(supabase.channel(channelName))
    
    console.log(`[MetaBuilder] 📡 Abrindo Túnel Centralizado: ${channelName}`)
    
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[MetaBuilder] ✅ Túnel Centralizado PRONTO.`)
        setTunnelChannel(channel)
        setIsTunnelReady(true)
      }
    })

    channel.on('broadcast', { event: 'bpm_workflow_completed' }, (payload: any) => {
      console.log('[MetaBuilder] 🔄 BPM Workflow Completed! Silently refreshing UI...', payload)
      // Atualiza as listagens
      setRefreshKey(prev => prev + 1)
      setRelationalRefreshKey(prev => prev + 1)
      setDetailRefreshKey(prev => prev + 1)

      const bpmTable = payload.payload?.table
      const bpmData = payload.payload?.data

      // Atualiza o registro aberto (se houver) sem fechar a tela
      if (bpmData && bpmTable === modelName) {
        setSelectedRow((prev: any) => {
          if (!prev) return prev
          const pkValue = bpmData[primaryKeyName] || bpmData.id || bpmData.ID || bpmData[primaryKeyName?.toUpperCase()]
          const prevPkValue = prev[primaryKeyName] || prev.id || prev.ID || prev[primaryKeyName?.toUpperCase()]
          
          if (String(prevPkValue) === String(pkValue)) {
            console.log('[MetaBuilder] 🔄 Atualizando formulário aberto com dados do BPM')
            return { ...prev, ...bpmData, _details: prev._details }
          }
          return prev
        })
      }
    })

    return () => {
      console.log(`[MetaBuilder] 🔌 Fechando Túnel Centralizado.`)
      try {
        channel.unsubscribe()
        supabase.removeChannel(channel._channel || channel)
      } catch (e) {}
      setTunnelChannel(null)
      setIsTunnelReady(false)
    }
  }, [isEjectedAppProp, project?.id, modelName, primaryKeyName, setRefreshKey, setRelationalRefreshKey, setDetailRefreshKey, setSelectedRow])

  // Modo "Apenas Cadastro" com ID passado por parâmetro: busca o registro e abre em edição
  useEffect(() => {
    // isEjectedAppProp é a fonte autoritativa (calculado por ViewPageContent via estrutura de URL).
    // O fallback para typeof tunnelChannel?.on garante compatibilidade em contextos sem prop.
    const isEjectedApp = isEjectedAppProp || process.env.NEXT_PUBLIC_IS_EJECTED_APP === 'true' || typeof tunnelChannel?.on !== 'function'
    
    if (!isCadastroOnly || !initialEditId) return
    if (!isEjectedApp && (!isTunnelReady || !tunnelChannel)) return

    const cleanPk = (primaryKeyName || 'id').split('.').pop() || 'id'

    if (isEjectedApp) {
      console.log(`[MetaBuilder] 🔍 Buscando registro para edição no modo Ejected via API Local`)
      fetch(`/api/${modelName}?filter_${cleanPk}=${encodeURIComponent(initialEditId)}&limit=1`)
        .then(r => r.json())
        .then(res => {
          const data = Array.isArray(res) ? res : (res.data || [])
          if (data.length > 0) {
            const record = { ...data[0] }
            // Espelhamento em lowercase
            for (const key in data[0]) {
              const lowerKey = key.toLowerCase()
              if (record[lowerKey] === undefined) {
                record[lowerKey] = data[0][key]
              }
            }
            setSelectedRow(record)
            setDrawerMode('edit')
            setIsPageVisible(true)
            console.log(`[MetaBuilder] ✅ Registro encontrado via API:`, record)
          }
        })
        .catch(err => console.error(`[MetaBuilder] ❌ Erro ao buscar via API:`, err))
      return
    }

    const queryId = crypto.randomUUID()
    const currentModel = project?.models?.find((m: any) => m.db_table_name === modelName)
    const actualSchemaName = currentModel?.db_schema_name || project?.slug || 'public'
    const dbType = (project?.db_type || 'postgres').toLowerCase();
    const isOracle = dbType === 'oracle';
    const tModel = isOracle ? `"${modelName.toUpperCase()}"` : `"${modelName}"`;
    const tPk = isOracle ? `"${cleanPk.toUpperCase()}"` : `"${cleanPk}"`;
    const rawQuery = `SELECT * FROM ${tModel} WHERE ${tPk} = '${String(initialEditId).replace(/'/g, "''")}'`

    console.log(`[MetaBuilder] 🔍 Buscando registro para edição no modo Cadastro: ${rawQuery}`)

    const handleResult = (payload: any) => {
      if (payload.payload?.queryId !== queryId) return
      if (payload.payload?.success && payload.payload?.data?.length > 0) {
        const rawRecord = payload.payload.data[0]
        const record: any = { ...rawRecord }
        // Força espelhamento em lowercase para compatibilidade com os forms
        // (necessário pois alguns drivers como Oracle retornam chaves UPPERCASE)
        for (const key in rawRecord) {
          const lowerKey = key.toLowerCase()
          if (record[lowerKey] === undefined) {
            record[lowerKey] = rawRecord[key]
          }
        }
        setSelectedRow(record)
        setDrawerMode('edit')
        setIsPageVisible(true)
        console.log(`[MetaBuilder] ✅ Registro encontrado para edição:`, record)
      }
      // Limpa o listener após receber
      const cleanup = () => {
        try {
          if (tunnelChannel.removeListener) {
            tunnelChannel.removeListener(`query_result_${queryId}`, handleResult)
            tunnelChannel.removeListener('sql_result', handleResult)
          }
          const bindings = tunnelChannel.bindings?.broadcast
          if (Array.isArray(bindings)) {
            tunnelChannel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleResult)
          }
        } catch (e) {}
      }
      cleanup()
    }

    tunnelChannel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
    tunnelChannel.on('broadcast', { event: 'sql_result' }, handleResult)

    tunnelChannel.send({
      type: 'broadcast',
      event: 'sql_query',
      payload: {
        queryId,
        table: modelName,
        schemaName: actualSchemaName,
        action: 'select',
        query: rawQuery,
        sql: rawQuery,
        token: project?.secret_token || 'test-token',
        joins: [],
        limit: 1,
        offset: 0
      }
    })
  }, [isCadastroOnly, initialEditId, isTunnelReady, tunnelChannel, modelName, primaryKeyName, project, setDrawerMode, setIsPageVisible, setSelectedRow])

  return {
    tunnelChannel,
    isTunnelReady,
    supabase
  }
}
