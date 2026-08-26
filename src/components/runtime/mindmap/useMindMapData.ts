import { useState, useMemo, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { formatFieldValue } from '@/lib/formatters'
import { useI18n } from '@/i18n/I18nContext'

export interface MindMapNode {
  id: string
  name: string
  desc?: string
  count: number
  level: number
  field?: any // Para modo Pivot
  rawData?: any
  children?: MindMapNode[]
  isLoading?: boolean
}

export interface UseMindMapDataProps {
  data: any[]
  fields: any[]
  centralFieldId?: string
  mindmapLevels?: any[]
  primaryKeyName: string
  projectId?: string
  models?: any[]
  project?: any
  tunnelChannel?: any
  isTunnelReady?: boolean
  relationalOptions?: Record<string, any[]>
  refreshTrigger?: number
}

export function useMindMapData({
  data,
  fields,
  centralFieldId,
  mindmapLevels,
  primaryKeyName,
  projectId,
  models = [],
  project,
  tunnelChannel,
  isTunnelReady,
  relationalOptions = {},
  refreshTrigger
}: UseMindMapDataProps) {
  const { language } = useI18n()
  const localeStr = language === 'pt' ? 'pt-BR' : language === 'en' ? 'en-US' : 'es-ES'

  const formatValue = (value: any, fieldName: string, modelId: string | undefined) => {
    if (value === null || value === undefined) return value
    const model = models.find(m => m.id === modelId)
    if (!model) return value
    const field = model.fields?.find((f: any) => f.db_column_name === fieldName)
    if (!field) return value
    return formatFieldValue(value, field, relationalOptions)
  }

  const supabase = createClient()
  const [currentPath, setCurrentPath] = useState<number[]>([])
  const [loadingPath, setLoadingPath] = useState<string | null>(null)
  const [relationalTree, setRelationalTree] = useState<MindMapNode[]>([])
  const prevRootIdsRef = useRef<string>('')
  
  const isRelational = mindmapLevels && mindmapLevels.length > 0

  // 1. Processamento da Árvore (Modo Pivot Antigo)
  const pivotTreeData = useMemo(() => {
    if (isRelational || !data || data.length === 0 || !fields || fields.length === 0) return []
    let hierarchyFields = fields.filter(f => !f.hidden)
    const centralField = fields.find(f => f.id === centralFieldId)
    if (centralField) {
      hierarchyFields = [centralField, ...hierarchyFields.filter(f => f.id !== centralFieldId)]
    }

    const { extractRawValue } = require('@/lib/field-resolver')
    const getValue = (item: any, field: any) => {
      if (!item || !field) return undefined
      return extractRawValue(field.db_column_name, item, field)
    }

    const buildTree = (items: any[], level: number): MindMapNode[] => {
      if (level >= hierarchyFields.length) return []
      const currentField = hierarchyFields[level]
      const groups = new Map<string, any[]>()
      items.forEach(item => {
        const val = getValue(item, currentField)
        const keyStr = val !== undefined && val !== null && val !== '' ? String(val) : 'Unassigned'
        if (!groups.has(keyStr)) groups.set(keyStr, [])
        groups.get(keyStr)!.push(item)
      })
      return Array.from(groups.entries()).map(([name, groupItems], idx) => ({
        id: `lvl${level}-${idx}-${name}`,
        name,
        count: groupItems.length,
        level,
        field: currentField,
        rawData: groupItems[0],
        children: buildTree(groupItems, level + 1)
      }))
    }
    return buildTree(data, 0)
  }, [data, fields, centralFieldId, isRelational])

  // Inicialização do Modo Relacional
  useEffect(() => {
    if (!isRelational || !data || !mindmapLevels) return
    
    const rootLevel = mindmapLevels[0]
    const uniqueMap = new Map()
    data.forEach((item, idx) => {
      const rawName = rootLevel.title_field ? item[rootLevel.title_field] : (item.name || item.nome || item.title || item.titulo || item.id)
      const name = formatValue(rawName, rootLevel.title_field || '', rootLevel.model_id)
      const rawDesc = rootLevel.desc_field ? item[rootLevel.desc_field] : undefined
      const desc = rawDesc ? formatValue(rawDesc, rootLevel.desc_field || '', rootLevel.model_id) : undefined
      
      const pk = primaryKeyName || 'id'
      const rowId = item[pk] !== undefined ? item[pk] : (item[pk.toUpperCase()] !== undefined ? item[pk.toUpperCase()] : (item.id !== undefined ? item.id : (item.ID !== undefined ? item.ID : (item.uuid !== undefined ? item.uuid : item.UUID))))
      const key = rowId !== undefined ? rowId : `root-${idx}`
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          id: key,
          name: String(name || 'Sem Título'),
          desc: desc ? String(desc) : undefined,
          count: 0,
          level: 0,
          rawData: item,
          children: mindmapLevels.length > 1 ? undefined : []
        })
      }
    })
    const newTree = Array.from(uniqueMap.values())
    newTree.sort((a: any, b: any) => a.name.localeCompare(b.name, localeStr, { numeric: true }))
    const newRootIdsSorted = newTree.map(n => n.id).sort().join(',')
    
    const deepMerge = (newNodes: MindMapNode[], oldNodes: MindMapNode[]): MindMapNode[] => {
      const oldMap = new Map(oldNodes.map(n => [n.id, n]))
      return newNodes.map(newNode => {
        const old = oldMap.get(newNode.id)
        if (old) {
          const mergedChildren = old.children !== undefined
            ? (newNode.children !== undefined
                ? deepMerge(newNode.children, old.children)
                : old.children)
            : newNode.children
          return { ...newNode, children: mergedChildren }
        }
        return newNode
      })
    }
    
    setRelationalTree(prevTree => {
      if (prevTree.length === 0) return newTree
      return deepMerge(newTree, prevTree)
    })
    
    if (prevRootIdsRef.current !== newRootIdsSorted) {
      if (newTree.length === 1 && currentPath.length === 0) {
        setCurrentPath([0])
        if (newTree[0].children === undefined) {
          setTimeout(() => fetchChildren([0], newTree[0]), 50)
        }
      }
      prevRootIdsRef.current = newRootIdsSorted
    }
  }, [data, isRelational, mindmapLevels, isTunnelReady, localeStr])

  const treeData = isRelational ? relationalTree : pivotTreeData

  const currentNode = useMemo(() => {
    let current = { children: treeData, id: 'virtual-root', name: 'Virtual Root', count: 0, level: -1 } as MindMapNode
    for (const index of currentPath) {
      if (current.children && current.children[index]) {
        current = current.children[index]
      } else {
        break
      }
    }
    return current
  }, [treeData, currentPath])

  const currentPathIdsRef = useRef<string[]>([])

  useEffect(() => {
    if (!treeData || treeData.length === 0) return
    let current: any = { children: treeData }
    let ids: string[] = []
    let valid = true
    for (const idx of currentPath) {
      if (current.children && current.children[idx]) {
        current = current.children[idx]
        ids.push(current.id)
      } else {
        valid = false
        break
      }
    }
    if (valid) currentPathIdsRef.current = ids
  }, [treeData, currentPath])

  useEffect(() => {
    if (!treeData || treeData.length === 0 || currentPath.length === 0) return
    
    const targetIds = currentPathIdsRef.current
    if (targetIds.length === 0) return

    let current: any = { children: treeData }
    let newPath: number[] = []
    let isValidOldPath = true

    for (let i = 0; i < currentPath.length; i++) {
      const oldIdx = currentPath[i]
      const expectedId = targetIds[i]

      if (!current.children || !current.children[oldIdx] || current.children[oldIdx].id !== expectedId) {
        isValidOldPath = false
        const correctIdx = current.children ? current.children.findIndex((c: any) => c.id === expectedId) : -1
        if (correctIdx !== -1) {
          newPath.push(correctIdx)
          current = current.children[correctIdx]
        } else {
          break
        }
      } else {
        newPath.push(oldIdx)
        current = current.children[oldIdx]
      }
    }

    if (!isValidOldPath || newPath.length < currentPath.length) {
      setCurrentPath(newPath)
    }
  }, [treeData])

  const prevRefreshTriggerRef = useRef(refreshTrigger || 0)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger !== prevRefreshTriggerRef.current) {
      prevRefreshTriggerRef.current = refreshTrigger
      if (currentPath.length > 0 && currentNode && currentNode.id !== 'virtual-root') {
        fetchChildren(currentPath, currentNode)
      }
    }
  }, [refreshTrigger])

  const fetchChildren = async (path: number[], node: MindMapNode) => {
    if (!isRelational || !mindmapLevels) return
    const nextLevelIndex = node.level + 1
    if (nextLevelIndex >= mindmapLevels.length) return 
    
    const nextLevelConfig = mindmapLevels[nextLevelIndex]
    if (!nextLevelConfig.model_id) return
    
    if (nextLevelConfig.relation_type === 'indirect') {
      if (!nextLevelConfig.through_table || !nextLevelConfig.through_local_fk || !nextLevelConfig.through_target_fk) return
    } else if (nextLevelConfig.relation_type === 'multilevel') {
      if (!nextLevelConfig.relation_path || nextLevelConfig.relation_path.length === 0) return
    } else {
      if (!nextLevelConfig.foreign_key) return
    }

    const pathStr = path.join('-')
    setLoadingPath(pathStr)

    try {
      const modelData = models.find(m => m.id === nextLevelConfig.model_id)
      if (!modelData?.db_table_name) throw new Error('Model not found in project.models')

      const tableName = String(modelData.db_table_name)
      const schemaName = modelData.db_schema_name || project?.slug || 'public'
      
      let currentLevelPkName = primaryKeyName || 'id'
      if (node.level >= 0) {
        const currentLevelConfig = mindmapLevels[node.level]
        if (currentLevelConfig && currentLevelConfig.model_id) {
          const currentModel = models.find(m => m.id === currentLevelConfig.model_id)
          if (currentModel && currentModel.fields) {
            const pkField = currentModel.fields.find((f: any) => f.is_primary_key)
            if (pkField && pkField.db_column_name) {
              currentLevelPkName = pkField.db_column_name
            }
          }
        }
      }
      const rawDataId = node.rawData ? (node.rawData[currentLevelPkName] !== undefined ? node.rawData[currentLevelPkName] : (node.rawData[currentLevelPkName.toUpperCase()] !== undefined ? node.rawData[currentLevelPkName.toUpperCase()] : (node.rawData.id !== undefined ? node.rawData.id : node.rawData.ID))) : undefined
      const parentId = String(rawDataId !== undefined ? rawDataId : node.id).replace(/'/g, "''")
      
      let rawQuery = ''
      if (nextLevelConfig.relation_type === 'multilevel' && nextLevelConfig.relation_path) {
        const pathArray = nextLevelConfig.relation_path
        let joins = ''
        for (let i = pathArray.length - 1; i >= 0; i--) {
          const hop = pathArray[i]
          const hopAlias = `th${i}`
          if (i === pathArray.length - 1) {
            joins += ` INNER JOIN "${hop.table}" ${hopAlias} ON t."${hop.target_to_field}" = ${hopAlias}."${hop.target_from_field}"`
          }
          if (i > 0) {
            const prevHopAlias = `th${i - 1}`
            joins += ` INNER JOIN "${pathArray[i-1].table}" ${prevHopAlias} ON ${prevHopAlias}."${hop.from_field}" = ${hopAlias}."${hop.to_field}"`
          }
        }
        const firstHop = pathArray[0]
        rawQuery = `SELECT DISTINCT t.* FROM "${tableName}" t ${joins} WHERE th0."${firstHop.to_field}" = '${parentId}'`
      } else if (nextLevelConfig.relation_type === 'indirect' && nextLevelConfig.through_table) {
        rawQuery = `SELECT t.* FROM "${tableName}" t INNER JOIN "${nextLevelConfig.through_table}" th ON t.id = th."${nextLevelConfig.through_target_fk}" WHERE th."${nextLevelConfig.through_local_fk}" = '${parentId}'`
      } else {
        rawQuery = `SELECT * FROM "${tableName}" WHERE "${nextLevelConfig.foreign_key}" = '${parentId}'`
      }
      
      const queryId = crypto.randomUUID()
      const payload: any = {
        queryId,
        table: tableName,
        tableName: tableName,
        schemaName: schemaName,
        slug: project?.slug,
        action: 'select',
        query: rawQuery,
        sql: rawQuery,
        token: project?.secret_token || 'test-token',
        limit: 1000,
        offset: 0,
        joins: []
      }

      const handleResult = (res: any) => {
        if (res.payload?.queryId === queryId) {
          if (!res.payload?.success) {
            console.error("[MetaBuilder:MindMap] ❌ fetchChildren Query Failed:", res.payload?.error)
          }
          const childrenData = res.payload.data
          const uniqueChildren = new Map()
          ;(childrenData || []).forEach((item: any, idx: number) => {
            const rawName = nextLevelConfig.title_field ? item[nextLevelConfig.title_field] : (item.name || item.nome || item.title || item.titulo || item.id)
            const name = formatValue(rawName, nextLevelConfig.title_field || '', nextLevelConfig.model_id)
            const rawDesc = nextLevelConfig.desc_field ? item[nextLevelConfig.desc_field] : undefined
            const desc = rawDesc ? formatValue(rawDesc, nextLevelConfig.desc_field || '', nextLevelConfig.model_id) : undefined
            
            let childPkName = 'id'
            if (modelData && modelData.fields) {
              const pkField = modelData.fields.find((f: any) => f.is_primary_key)
              if (pkField && pkField.db_column_name) {
                childPkName = pkField.db_column_name
              }
            }
            const rowId = item[childPkName] !== undefined ? item[childPkName] : (item[childPkName.toUpperCase()] !== undefined ? item[childPkName.toUpperCase()] : (item.id !== undefined ? item.id : (item.ID !== undefined ? item.ID : (item.uuid !== undefined ? item.uuid : item.UUID))))
            const key = rowId !== undefined ? rowId : `${node.id}-child-${idx}`
            
            if (!uniqueChildren.has(key)) {
              uniqueChildren.set(key, {
                id: key,
                name: String(name || 'Sem Título'),
                desc: desc ? String(desc) : undefined,
                count: 0,
                level: nextLevelIndex,
                rawData: item,
                children: nextLevelIndex + 1 < mindmapLevels.length ? undefined : []
              })
            }
          })
          const newChildren = Array.from(uniqueChildren.values())
          newChildren.sort((a: any, b: any) => a.name.localeCompare(b.name, localeStr, { numeric: true }))

          setRelationalTree(prevTree => {
            const newTree = structuredClone(prevTree)
            const targetIds = currentPathIdsRef.current
            let curr: any = { children: newTree }
            
            for (const expectedId of targetIds) {
              if (!curr.children) break
              const nextIdx = curr.children.findIndex((c: any) => c.id === expectedId)
              if (nextIdx !== -1) {
                curr = curr.children[nextIdx]
              } else {
                curr = null
                break
              }
            }
            
            if (curr && curr.id === currentNode.id) {
              curr.children = newChildren
              curr.count = newChildren.length
            } else {
              let fallbackCurr: any = { children: newTree }
              let valid = true
              for (const p of path) {
                if (fallbackCurr.children && fallbackCurr.children[p]) {
                  fallbackCurr = fallbackCurr.children[p]
                } else {
                  valid = false
                  break
                }
              }
              if (valid) {
                fallbackCurr.children = newChildren
                fallbackCurr.count = newChildren.length
              }
            }
            return newTree
          })
          setLoadingPath(null)
        }
      }

      const isEjectedApp = process.env.NEXT_PUBLIC_IS_EJECTED_APP === 'true' || typeof tunnelChannel?.on !== 'function'

      if (isEjectedApp) {
        try {
          let apiData: any[] = []

          if (nextLevelConfig.relation_type === 'indirect' && nextLevelConfig.through_table) {
            const junctionRes = await fetch(`/api/${nextLevelConfig.through_table}?filter_${nextLevelConfig.through_local_fk}=${encodeURIComponent(parentId)}&limit=1000`)
            if (!junctionRes.ok) {
              const err = await junctionRes.json().catch(() => ({}))
              throw new Error(err.error || 'Erro ao buscar tabela intermediária')
            }
            const junctionRaw = await junctionRes.json()
            const junctionRecords: any[] = Array.isArray(junctionRaw) ? junctionRaw : (junctionRaw.data || [])
            const targetIds = [...new Set(junctionRecords.map((r: any) => r[nextLevelConfig.through_target_fk!]).filter(Boolean))]

            if (targetIds.length === 0) {
              apiData = []
            } else {
              const targetFetches = await Promise.all(
                targetIds.map((id: any) =>
                  fetch(`/api/${tableName}?filter_id=${encodeURIComponent(id)}&limit=1`).then(r => r.json()).catch(() => null)
                )
              )
              apiData = targetFetches.flatMap((r: any) => Array.isArray(r) ? r : (r?.data || [])).filter(Boolean)
            }
          } else if (nextLevelConfig.relation_type === 'multilevel' && nextLevelConfig.relation_path?.length) {
            const hop = nextLevelConfig.relation_path[0]
            const hopRes = await fetch(`/api/${hop.table}?filter_${hop.to_field}=${encodeURIComponent(parentId)}&limit=1000`)
            if (!hopRes.ok) {
              const err = await hopRes.json().catch(() => ({}))
              throw new Error(err.error || `Erro ao buscar tabela intermediária ${hop.table}`)
            }
            const hopRaw = await hopRes.json()
            const hopRecords: any[] = Array.isArray(hopRaw) ? hopRaw : (hopRaw.data || [])
            const targetIds = [...new Set(hopRecords.map((r: any) => r[hop.target_from_field]).filter(Boolean))]

            if (targetIds.length === 0) {
              apiData = []
            } else {
              const targetFetches = await Promise.all(
                targetIds.map((id: any) =>
                  fetch(`/api/${tableName}?filter_${hop.target_to_field}=${encodeURIComponent(id)}&limit=1`).then(r => r.json()).catch(() => null)
                )
              )
              apiData = targetFetches.flatMap((r: any) => Array.isArray(r) ? r : (r?.data || [])).filter(Boolean)
            }
          } else {
            const res = await fetch(`/api/${tableName}?filter_${nextLevelConfig.foreign_key}=${encodeURIComponent(parentId)}&limit=1000`)
            if (!res.ok) {
              const err = await res.json().catch(() => ({}))
              throw new Error(err.error || 'Erro na API Local')
            }
            const resData = await res.json()
            apiData = Array.isArray(resData) ? resData : (resData.data || [])
          }

          handleResult({ payload: { success: true, data: apiData, queryId } })
        } catch (err: any) {
          handleResult({ payload: { success: false, error: err.message, queryId } })
        }
        return
      }

      if (tunnelChannel && isTunnelReady) {
        tunnelChannel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
        tunnelChannel.on('broadcast', { event: 'sql_result' }, handleResult)
        tunnelChannel.send({
          type: 'broadcast',
          event: 'sql_query',
          payload
        })
        setTimeout(() => {
          try {
            const bindings = tunnelChannel.bindings?.broadcast
            if (Array.isArray(bindings)) {
               tunnelChannel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleResult)
            }
          } catch (_) {}
          setLoadingPath(null)
        }, 10000)
      } else {
        const channelName = `tunnel:${project?.id}`
        const channel = supabase.channel(channelName)
        channel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
        channel.on('broadcast', { event: 'sql_result' }, handleResult)
        channel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'sql_query',
              payload
            })
            setTimeout(() => {
              supabase.removeChannel(channel)
              setLoadingPath(null)
            }, 10000)
          }
        })
      }
    } catch (err) {
      console.error("Failed to fetch mindmap children:", err)
      setLoadingPath(null)
    }
  }

  const handleNodeClick = async (index: number) => {
    const nextPath = [...currentPath, index]
    const clickedNode = currentNode.children![index]

    if (isRelational) {
      if (clickedNode.children === undefined) {
        await fetchChildren(nextPath, clickedNode)
        setCurrentPath(nextPath)
      } else if (clickedNode.children.length > 0) {
        setCurrentPath(nextPath)
      }
    } else {
      if (clickedNode.children && clickedNode.children.length > 0) {
        setCurrentPath(nextPath)
      }
    }
  }

  const handleGoBack = () => {
    if (currentPath.length > 0) setCurrentPath(currentPath.slice(0, -1))
  }

  return {
    treeData,
    currentNode,
    currentPath,
    loadingPath,
    handleNodeClick,
    handleGoBack,
    isRelational,
    relationalTree
  }
}
