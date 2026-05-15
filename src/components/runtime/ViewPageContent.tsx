'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Table, Plus, LayoutGrid } from 'lucide-react'
import { HeaderActions } from '@/components/layout/HeaderActions'
import RecordDrawer from './RecordDrawer'
import RecordModal from './RecordModal'
import DeleteConfirmModal from './DeleteConfirmModal'
import { createClient } from '@/utils/supabase/client'
import dynamic from 'next/dynamic'
import { useI18n } from '@/i18n/I18nContext'

import RecordForm from './RecordForm'
import { RuntimeHeader } from './RuntimeHeader'

// Importamos o ViewContainer sem SSR para evitar o "piscar" do loader
// e conflitos de hidratação com o sessionStorage
const ViewContainer = dynamic(() => import('./ViewContainer'), { ssr: false })

interface ViewPageContentProps {
  workspace: any
  project: any
  viewName: string
  modelName: string
  displayFields: any[]
  filterFields: any[]
  formFields: any[]
  displayType: 'list' | 'card' | 'both'
  defaultView: 'list' | 'card'
  buttonsConfig: any[]
  locale: string
  canAdd: boolean
  viewId: string
  primaryKeyName: string
  logicType?: string
  kanbanGroupField?: string
  mindmapCentralField?: string
  dictionary?: any
  joins?: any[]
  masterModelId?: string
  detailDisplayMode?: 'tabs' | 'sections'
  actionInterfaceType?: 'drawer' | 'modal' | 'page'
  detailsInterfaceTypes?: Record<string, string>
  detailsInlineTypes?: Record<string, boolean>
  baseUrl?: string
  breadcrumbs?: { label: string; href: string }[]
  description?: string
  icon?: string
}

import { RuntimeBreadcrumbs } from './RuntimeBreadcrumbs'

export default function ViewPageContent({
  workspace,
  project,
  viewName,
  modelName,
  displayFields,
  filterFields,
  formFields,
  displayType,
  defaultView,
  buttonsConfig,
  locale,
  canAdd,
  viewId,
  primaryKeyName,
  logicType,
  kanbanGroupField,
  mindmapCentralField,
  dictionary = {},
  joins = [],
  masterModelId,
  detailDisplayMode,
  detailsInterfaceTypes,
  detailsInlineTypes,
  actionInterfaceType = 'drawer',
  baseUrl,
  breadcrumbs = [],
  description,
  icon
}: ViewPageContentProps) {

  // Garante que todas as listas de campos sejam únicas por ID
  const cleanDisplayFields = useMemo(() => {
    const seen = new Set()
    return displayFields.filter(f => {
      if (!f?.id || seen.has(f.id)) return false
      seen.add(f.id)
      return true
    })
  }, [displayFields])

  const cleanFilterFields = useMemo(() => {
    const seen = new Set()
    return filterFields.filter(f => {
      if (!f?.id || seen.has(f.id)) return false
      seen.add(f.id)
      return true
    })
  }, [filterFields])

  const cleanFormFields = useMemo(() => {
    const seen = new Set()
    return formFields.filter(f => {
      if (!f?.id || seen.has(f.id)) return false
      seen.add(f.id)
      return true
    })
  }, [formFields])

  const detailFields = useMemo(() => 
    cleanFormFields.filter(f => f.model_id && String(f.model_id) !== String(masterModelId)),
  [cleanFormFields, masterModelId])

  const { t } = useI18n()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPageVisible, setIsPageVisible] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'view'>('create')
  const [selectedRow, setSelectedRow] = useState<any>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)
  const [isDetailDeleteModalOpen, setIsDetailDeleteModalOpen] = useState(false)
  const [selectedDetail, setSelectedDetail] = useState<any>(null)
  const [detailFieldsToRender, setDetailFieldsToRender] = useState<any[]>([])
  const [detailModalMode, setDetailModalMode] = useState<'create' | 'edit'>('edit')
  const [currentDetailTable, setCurrentDetailTable] = useState('')
  const [parentRowIdForDetail, setParentRowIdForDetail] = useState<any>(null)
  const [itemToDelete, setItemToDelete] = useState<any>(null)
  const [detailHistory, setDetailHistory] = useState<any[]>([])
  const [activeTabForDetail, setActiveTabForDetail] = useState<string>('master')
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)

  const isModal = actionInterfaceType === 'modal'
  const isPage = actionInterfaceType === 'page'

  const setOpen = (val: boolean) => {
    if (isModal) setIsModalOpen(val)
    else if (isPage) setIsPageVisible(val)
    else setIsDrawerOpen(val)
  }
  
  const isOpen = isModal ? isModalOpen : (isPage ? isPageVisible : isDrawerOpen)

  const supabase = createClient()

  const handleOpenAdd = () => {
    setDrawerMode('create')
    setSelectedRow({})
    setOpen(true)
  }

  const fetchDetails = async (parentRow: any, parentModel: string) => {
    if (logicType !== 'master_detail' || !joins || joins.length === 0) return []

    const allDetails: any[] = []
    
    // Para cada join configurado a partir da tabela pai informada
    for (const join of joins) {
      const isMatch = join.from?.toLowerCase() === parentModel?.toLowerCase()
      console.log(`[MetaBuilder] Checking join: ${join.from} -> ${join.to} | Match: ${isMatch} (Parent: ${parentModel})`)

      if (isMatch) {
        const localValue = parentRow[join.localKey] || parentRow[join.localKey.toUpperCase()] || parentRow.id || parentRow.ID
        
        if (localValue === undefined || localValue === null) {
          console.warn(`[MetaBuilder] localValue not found for key ${join.localKey} in row:`, parentRow)
          continue
        }

        console.log(`[MetaBuilder] Fetching details from ${join.to} where ${join.foreignKey} = ${localValue}`)
        
        const { data: detailData, error } = await supabase
          .from(join.to)
          .select('*')
          .eq(join.foreignKey, localValue)

        if (error) {
          console.error(`[MetaBuilder] Error fetching details from ${join.to}:`, error)
          continue
        }

        if (detailData) {
          const modelField = detailFields.find(f => f.db_column_name.includes(join.to) || f.model_name?.toLowerCase() === join.to?.toLowerCase())
          const friendlyName = dictionary[modelField?.model_id || ''] || join.to

          console.log(`[MetaBuilder] Found ${detailData.length} records in ${join.to}. Friendly Name: ${friendlyName}`)

          allDetails.push(...detailData.map(d => ({ 
            ...d, 
            model_name: join.to, // Mantém o nome original do banco para lógica de campos
            display_model_name: friendlyName // Novo campo para exibição na UI
          })))
        }
      }
    }
    console.log(`[MetaBuilder] Total details fetched: ${allDetails.length}`)
    
    // Garante que não existam registros duplicados (caso existam múltiplos JOINS para a mesma tabela)
    const seen = new Set()
    return allDetails.filter(d => {
      const duplicate = seen.has(d.id || d.ID)
      seen.add(d.id || d.ID)
      return !duplicate
    })
  }

  // Removido o filtro anterior que estava solto

  const handleOpenView = async (row: any) => {
    setDrawerMode('view')
    setIsProcessing(true)
    const details = await fetchDetails(row, modelName)
    setSelectedRow({ ...row, _details: details })
    setIsProcessing(false)
    setOpen(true)
  }

  const handleOpenEdit = async (row: any) => {
    setDrawerMode('edit')
    setIsProcessing(true)
    const details = await fetchDetails(row, modelName)
    setSelectedRow({ ...row, _details: details })
    setIsProcessing(false)
    setOpen(true)
  }

  const handleOpenDelete = (row: any) => {
    setSelectedRow(row)
    setIsDeleteModalOpen(true)
  }

  const handleOpenAddDetail = (tableName: string, parentId?: any) => {
    // Se já houver um detalhe aberto, movemos para o histórico para permitir empilhamento
    if (selectedDetail && (isDetailModalOpen || isDetailDrawerOpen)) {
      setDetailHistory(prev => [...prev, {
        record: selectedDetail,
        tableName: currentDetailTable,
        fields: detailFieldsToRender,
        activeTab: activeTabForDetail
      }])
    }

    // Fecha os toggles atuais para que o nível anterior seja renderizado via history map
    setIsDetailModalOpen(false)
    setIsDetailDrawerOpen(false)

    const fields = detailFields.filter(f => f.model_name === tableName)
    setDetailFieldsToRender(fields)
    setSelectedDetail({})
    setDetailModalMode('create')
    setCurrentDetailTable(tableName)
    setParentRowIdForDetail(parentId || (selectedRow?.id || selectedRow?.ID))
    
    const model = (project as any)?.models?.find((m: any) => m.db_table_name.toLowerCase() === tableName.toLowerCase())
    const interfaceType = detailsInterfaceTypes?.[model?.id || ''] || (project.ui_config as any)?.details_interface_types?.[model?.id || ''] || 'modal'
    
    setTimeout(() => {
      if (interfaceType === 'drawer') setIsDetailDrawerOpen(true)
      else setIsDetailModalOpen(true)
    }, 0)
  }

  const handleEditDetail = async (detail: any) => {
    // Se já houver um detalhe selecionado (ex: Projeto), guardamos ele no histórico antes de ir para o Model
    if (selectedDetail && (isDetailModalOpen || isDetailDrawerOpen)) {
      setDetailHistory(prev => [...prev, {
        record: selectedDetail,
        tableName: currentDetailTable,
        fields: detailFieldsToRender,
        activeTab: activeTabForDetail
      }])
    }

    // Fechamos os toggles do nível atual pois ele será movido para o histórico
    // e renderizado pelo map(detailHistory). O novo nível será aberto no setTimeout.
    setIsDetailModalOpen(false)
    setIsDetailDrawerOpen(false)
    
    setIsProcessing(true)
    const subDetails = await fetchDetails(detail, detail.model_name)
    
    setDetailFieldsToRender(detailFields)
    setSelectedDetail({ ...detail, _details: subDetails })
    setDetailModalMode('edit')
    setCurrentDetailTable(detail.model_name)
    setActiveTabForDetail('master') // Começa nos dados principais do sub-detalhe
    setParentRowIdForDetail(null)
    setIsProcessing(false)
    
    const model = (project as any)?.models?.find((m: any) => m.db_table_name.toLowerCase() === detail.model_name?.toLowerCase())
    const interfaceType = detailsInterfaceTypes?.[model?.id || ''] || (project.ui_config as any)?.details_interface_types?.[model?.id || ''] || 'modal'
    
    // Pequeno tick para garantir que o React desmonte o modal anterior
    // antes de montar o novo (evita colisão de key no mesmo ciclo de render)
    setTimeout(() => {
      if (interfaceType === 'drawer') setIsDetailDrawerOpen(true)
      else setIsDetailModalOpen(true)
    }, 0)
  }

  const handleCloseDetail = () => {
    if (detailHistory.length > 0) {
      const last = detailHistory[detailHistory.length - 1]
      setDetailHistory(prev => prev.slice(0, -1))
      setSelectedDetail(last.record)
      setCurrentDetailTable(last.tableName)
      setDetailFieldsToRender(last.fields)
      setActiveTabForDetail(last.activeTab || 'master')
      setDetailModalMode('edit')
      
      const model = (project as any)?.models?.find((m: any) => m.db_table_name.toLowerCase() === last.tableName?.toLowerCase())
      const interfaceType = detailsInterfaceTypes?.[model?.id || ''] || (project.ui_config as any)?.details_interface_types?.[model?.id || ''] || 'modal'
      
      if (interfaceType === 'drawer') {
        setIsDetailDrawerOpen(true)
        setIsDetailModalOpen(false)
      } else {
        setIsDetailModalOpen(true)
        setIsDetailDrawerOpen(false)
      }
    } else {
      setIsDetailModalOpen(false)
      setIsDetailDrawerOpen(false)
      setSelectedDetail(null)
      setActiveTabForDetail('master')
    }
  }

  const handleDeleteDetail = (detail: any) => {
    setItemToDelete(detail)
    setIsDetailDeleteModalOpen(true)
  }

  const handleSaveDetail = async (formData: any) => {
    setIsProcessing(true)
    const queryId = crypto.randomUUID()
    const channelName = `tunnel:${project.id}`
    const channel = supabase.channel(channelName)

    try {
      const action = detailModalMode
      const tableName = currentDetailTable
      const fields = detailFields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())
      const pkField = fields.find(f => f.is_primary_key) || { db_column_name: 'id' }
      const detailPkName = pkField.db_column_name.split('.').pop() || 'id'
      
      // Internal-only keys that must never be sent to the DB.
      // Also exclude table-prefixed keys (e.g. 'models.name') — RecordForm writes both
      // 'models.name' and 'name' on change; only the base key is valid in a SQL SET clause.
      const INTERNAL_KEYS = new Set(['_details', 'model_name', 'display_model_name'])

      let rawQuery = ''
      const sanitizedData: any = {}
      for (const [k, v] of Object.entries(formData)) {
        if (
          INTERNAL_KEYS.has(k) ||
          k.includes('.') ||                              // skip table-prefixed keys
          k.toLowerCase() === detailPkName.toLowerCase() ||
          v === null ||
          v === undefined
        ) continue

        sanitizedData[k] = String(v)
      }

      // Se for inclusão, garantir que a FK para o mestre esteja correta
      if (action === 'create' && logicType === 'master_detail' && joins) {
        const join = joins.find(j => j.to?.toLowerCase() === tableName?.toLowerCase())
        if (join) {
          const parentId = parentRowIdForDetail || (selectedRow[join.localKey] || selectedRow[join.localKey.toUpperCase()] || selectedRow.id || selectedRow.ID)
          sanitizedData[join.foreignKey] = String(parentId)
        }
      }

      const dPkValue = selectedDetail[detailPkName] || selectedDetail[detailPkName.toUpperCase()] || selectedDetail['id'] || selectedDetail['ID']

      if (action === 'edit') {
        if (Object.keys(sanitizedData).length === 0) {
          // Nothing to update — likely no fields were changed
          setIsProcessing(false)
          return
        }
        const setClause = Object.entries(sanitizedData)
          .map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`)
          .join(', ')
        rawQuery = `UPDATE ${tableName} SET ${setClause} WHERE ${detailPkName} = '${String(dPkValue).replace(/'/g, "''")}'`
      } else {
        const keys = Object.keys(sanitizedData).join(', ')
        const values = Object.values(sanitizedData)
          .map(v => `'${String(v).replace(/'/g, "''")}'`)
          .join(', ')
        rawQuery = `INSERT INTO ${tableName} (${keys}) VALUES (${values})`
      }

      console.log(`[MetaBuilder:Detail] ${action} on ${tableName}`, { sanitizedData, rawQuery, dPkValue })

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'sql_query',
            payload: {
              queryId,
              table: tableName,
              action: action === 'edit' ? 'update' : 'insert',
              data: sanitizedData,
              sql: rawQuery,
              idColumn: detailPkName,
              idValue: dPkValue
            }
          })

          // Batch save modified sub-details if any (for nested levels)
          if (formData._details && formData._details.length > 0) {
            for (const subDetail of formData._details) {
              const sdTableName = subDetail.model_name
              if (!sdTableName) continue

              const sdFields = detailFields.filter(f => f.model_name?.toLowerCase() === sdTableName.toLowerCase())
              const sPkField = sdFields.find(f => f.is_primary_key) || { db_column_name: 'id' }
              const sdPkName = sPkField.db_column_name.split('.').pop() || 'id'
              const sdPkValue = subDetail[sdPkName] || subDetail[sdPkName.toUpperCase()] || subDetail['id'] || subDetail['ID']

              if (sdPkValue) {
                const sanitizedSD: any = {}
                for (const [k, v] of Object.entries(subDetail)) {
                  if (
                    INTERNAL_KEYS.has(k) ||
                    k.includes('.') ||                            // skip table-prefixed keys
                    k.toLowerCase() === sdPkName.toLowerCase() ||
                    v === null ||
                    v === undefined
                  ) continue
                  sanitizedSD[k] = String(v)
                }

                if (Object.keys(sanitizedSD).length > 0) {
                  const setClause = Object.entries(sanitizedSD)
                    .map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`)
                    .join(', ')
                  const sdQuery = `UPDATE ${sdTableName} SET ${setClause} WHERE ${sdPkName} = '${String(sdPkValue).replace(/'/g, "''")}'`

                  channel.send({
                    type: 'broadcast',
                    event: 'sql_query',
                    payload: {
                      queryId: crypto.randomUUID(),
                      table: sdTableName,
                      action: 'update',
                      data: sanitizedSD,
                      sql: sdQuery,
                      idColumn: sdPkName,
                      idValue: sdPkValue
                    }
                  })
                }
              }
            }
          }
        }
      })

      setTimeout(async () => {
        supabase.removeChannel(channel)
        
        // Recarrega os sub-detalhes do detalhe corrente (ex: Models dentro do Project drawer)
        if (selectedDetail) {
          const freshSubDetails = await fetchDetails(selectedDetail, selectedDetail.model_name || currentDetailTable)
          setSelectedDetail((prev: any) => prev ? { ...prev, _details: freshSubDetails } : prev)
        }
        
        // Recarrega os detalhes do mestre (ex: Projects na lista do Master drawer)
        if (selectedRow) {
          const updatedDetails = await fetchDetails(selectedRow, modelName)
          setSelectedRow({ ...selectedRow, _details: updatedDetails })
        }
        
        // Recarrega a lista principal
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(`metabuilder_cache_${project.id}:${modelName}`)
        }
        setRefreshKey(prev => prev + 1)
        
        // Incrementa a key do detail modal/drawer para forçar remount com dados frescos
        setDetailRefreshKey(prev => prev + 1)
        
        handleCloseDetail()
        setIsProcessing(false)
      }, 1500)

    } catch (error) {
      console.error('Error saving detail:', error)
      setIsProcessing(false)
    }
  }

  const handleConfirmDeleteDetail = async () => {
    setIsProcessing(true)
    const queryId = crypto.randomUUID()
    const channelName = `tunnel:${project.id}`
    const channel = supabase.channel(channelName)

    try {
      const tableName = itemToDelete.model_name
      const fields = detailFields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())
      const pkField = fields.find(f => f.is_primary_key) || { db_column_name: 'id' }
      const detailPkName = pkField.db_column_name.split('.').pop() || 'id'
      const pkValue = itemToDelete[detailPkName] || itemToDelete[detailPkName.toUpperCase()] || itemToDelete['id'] || itemToDelete['ID']
      
      const rawQuery = `DELETE FROM ${tableName} WHERE ${detailPkName} = '${String(pkValue).replace(/'/g, "''")}'`

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'sql_query',
            payload: {
              queryId,
              table: tableName,
              action: 'delete',
              sql: rawQuery,
              idColumn: detailPkName,
              idValue: pkValue
            }
          })
        }
      })

      setTimeout(async () => {
        setIsDetailDeleteModalOpen(false)
        setItemToDelete(null)
        supabase.removeChannel(channel)
        
        if (selectedRow) {
          const updatedDetails = await fetchDetails(selectedRow, modelName)
          setSelectedRow({ ...selectedRow, _details: updatedDetails })
        }
        setIsProcessing(false)
      }, 1500)
    } catch (error) {
      console.error('Error deleting detail:', error)
      setIsProcessing(false)
    }
  }

  const handleSave = async (formData: any) => {
    setIsProcessing(true)
    const queryId = crypto.randomUUID()
    const channelName = `tunnel:${project.id}`
    const channel = supabase.channel(channelName)

    try {
      const action = drawerMode === 'create' ? 'insert' : 'update'
      
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          const pkName = primaryKeyName
          
          // Case-insensitive PK value resolution
          const pkValue = formData[pkName] ?? formData[pkName.toUpperCase()] ?? formData[pkName.toLowerCase()]
          
          const filters: any = {}
          if (action === 'update' && pkValue !== undefined && pkValue !== null) {
            filters[pkName] = String(pkValue)
          }

          // Whitelist: only include fields explicitly configured in the Studio.
          // This prevents sending system columns (created_at, etc.) that PostgreSQL may reject.
          // We match BOTH full db_column_name ('projects.name') AND base name ('name') because
          // RecordForm stores edited values under both keys.
          const MASTER_INTERNAL = new Set(['_details', 'model_name', 'display_model_name'])
          const masterFormFields = formFields.filter(f =>
            !f.model_id || String(f.model_id) === String(masterModelId)
          )
          const sanitizedData: any = {}
          for (const [k, v] of Object.entries(formData)) {
            if (MASTER_INTERNAL.has(k) || k.includes('.') || k.toLowerCase() === pkName.toLowerCase() || v === null || v === undefined) continue
            const isConfiguredField = masterFormFields.some(f => {
              const base = f.db_column_name.split('.').pop() || f.db_column_name
              return f.db_column_name === k || base === k
            })
            if (!isConfiguredField) continue
            sanitizedData[k] = String(v)
          }

          // RAW SQL Builder
          let rawQuery = ''
          if (action === 'update' && pkValue && Object.keys(sanitizedData).length > 0) {
            const setClause = Object.entries(sanitizedData)
              .map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`)
              .join(', ')
            rawQuery = `UPDATE ${modelName} SET ${setClause} WHERE ${pkName} = '${String(pkValue).replace(/'/g, "''")}'`
          } else if (action === 'insert' && Object.keys(sanitizedData).length > 0) {
            const keys = Object.keys(sanitizedData).join(', ')
            const values = Object.values(sanitizedData)
              .map(v => `'${String(v).replace(/'/g, "''")}'`)
              .join(', ')
            rawQuery = `INSERT INTO ${modelName} (${keys}) VALUES (${values})`
          }

          console.log(`[MetaBuilder] ${action} on ${modelName}`, { pkValue, sanitizedData, rawQuery })

          const payload: any = {
            queryId,
            table: modelName,
            tableName: modelName, 
            action,
            data: sanitizedData,
            record: sanitizedData, 
            query: rawQuery, 
            sql: rawQuery, 
            idColumn: pkName,   // EXATAMENTE o que o Agente CLI espera
            idValue: pkValue,   // EXATAMENTE o que o Agente CLI espera
            token: 'test-token'
          }

          if (Object.keys(filters).length > 0) {
            payload.filters = filters
            payload.where = filters
            payload.id = filters[pkName]
          }

          channel.send({
            type: 'broadcast',
            event: 'sql_query',
            payload
          })

          // Batch save modified details if any
          if (formData._details && formData._details.length > 0) {
            for (const detail of formData._details) {
              const detailTableName = detail.model_name
              if (!detailTableName) continue
              
              const dFields = detailFields.filter(f => f.model_name?.toLowerCase() === detailTableName.toLowerCase())
              const pkField = dFields.find(f => f.is_primary_key) || { db_column_name: 'id' }
              const dPkName = pkField.db_column_name.split('.').pop() || 'id'
              const dPkValue = detail[dPkName] || detail[dPkName.toUpperCase()] || detail['id'] || detail['ID']
              
              if (dPkValue) {
                const sanitizedDetail: any = {}
                for (const [k, v] of Object.entries(detail)) {
                  const isMatch = dFields.some(f => {
                    const bCol = f.db_column_name.split('.').pop() || f.db_column_name
                    return f.db_column_name.toLowerCase() === k.toLowerCase() || bCol.toLowerCase() === k.toLowerCase()
                  })
                  if (isMatch && k.toLowerCase() !== dPkName.toLowerCase() && k.toLowerCase() !== 'id') {
                    sanitizedDetail[k] = String(v)
                  }
                }

                if (Object.keys(sanitizedDetail).length > 0) {
                  const setClause = Object.entries(sanitizedDetail)
                    .map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`)
                    .join(', ')
                  const detailQuery = `UPDATE ${detailTableName} SET ${setClause} WHERE ${dPkName} = '${String(dPkValue).replace(/'/g, "''")}'`
                  
                  channel.send({
                    type: 'broadcast',
                    event: 'sql_query',
                    payload: {
                      queryId: crypto.randomUUID(),
                      table: detailTableName,
                      action: 'update',
                      data: sanitizedDetail,
                      sql: detailQuery,
                      idColumn: dPkName,
                      idValue: dPkValue
                    }
                  })
                }

                // SUB-DETAILS (Recursividade manual para o 3º nível)
                if (detail._details && detail._details.length > 0) {
                  for (const subDetail of detail._details) {
                    const subTableName = subDetail.model_name
                    if (!subTableName) continue

                    const sdFields = detailFields.filter(f => f.model_name?.toLowerCase() === subTableName.toLowerCase())
                    const sPkField = sdFields.find(f => f.is_primary_key) || { db_column_name: 'id' }
                    const sPkName = sPkField.db_column_name.split('.').pop() || 'id'
                    const sPkValue = subDetail[sPkName] || subDetail[sPkName.toUpperCase()] || subDetail['id'] || subDetail['ID']

                    if (sPkValue) {
                      const sanitizedSub: any = {}
                      for (const [sk, sv] of Object.entries(subDetail)) {
                        const isMatch = sdFields.some(f => {
                          const bCol = f.db_column_name.split('.').pop() || f.db_column_name
                          return f.db_column_name.toLowerCase() === sk.toLowerCase() || bCol.toLowerCase() === sk.toLowerCase()
                        })
                        if (isMatch && sk.toLowerCase() !== sPkName.toLowerCase() && sk.toLowerCase() !== 'id') {
                          sanitizedSub[sk] = String(sv)
                        }
                      }

                      if (Object.keys(sanitizedSub).length > 0) {
                        const subSetClause = Object.entries(sanitizedSub)
                          .map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`)
                          .join(', ')
                        const subQuery = `UPDATE ${subTableName} SET ${subSetClause} WHERE ${sPkName} = '${String(sPkValue).replace(/'/g, "''")}'`
                        
                        channel.send({
                          type: 'broadcast',
                          event: 'sql_query',
                          payload: {
                            queryId: crypto.randomUUID(),
                            table: subTableName,
                            action: 'update',
                            data: sanitizedSub,
                            sql: subQuery,
                            idColumn: sPkName,
                            idValue: sPkValue
                          }
                        })
                      }
                    }
                  }
                }
              }
            }
          }
        }
      })

      // Ouvir confirmação (opcional, ou apenas assumir sucesso e recarregar)
      setTimeout(() => {
        if (isPage) setIsPageVisible(false)
        else setOpen(false)
        
        setIsProcessing(false)
        supabase.removeChannel(channel)
        
        // Limpar cache para forçar refresh real
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(`metabuilder_cache_${project.id}:${modelName}`)
        }
        
        setRefreshKey(prev => prev + 1)
        
        // Limpar seleção para garantir refresh limpo
        if (!isPage) setSelectedRow(null)
      }, 1500)

    } catch (error) {
      console.error('Error saving:', error)
      setIsProcessing(false)
    }
  }

  const handleDelete = async () => {
    setIsProcessing(true)
    const queryId = crypto.randomUUID()
    const channelName = `tunnel:${project.id}`
    const channel = supabase.channel(channelName)

    try {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          const pkName = primaryKeyName

          const filters: any = {}
          let pkValue = selectedRow[pkName]

          if (pkValue !== undefined && pkValue !== null) {
            filters[pkName] = String(pkValue)
          }

          let rawQuery = ''
          if (pkValue !== undefined && pkValue !== null) {
            rawQuery = `DELETE FROM ${modelName} WHERE ${pkName} = '${String(pkValue).replace(/'/g, "''")}'`
          }

          console.log(`[MetaBuilder] Executing delete on ${modelName}`, { filters, pkName, pkValue, rawQuery })

          const payload: any = {
            queryId,
            table: modelName,
            tableName: modelName,
            action: 'delete',
            query: rawQuery,
            sql: rawQuery,
            idColumn: pkName,
            idValue: pkValue,
            token: 'test-token'
          }

          if (Object.keys(filters).length > 0) {
            payload.filters = filters
            payload.where = filters
            payload.id = filters[pkName]
          }

          channel.send({
            type: 'broadcast',
            event: 'sql_query',
            payload
          })
        }
      })

      setTimeout(() => {
        setIsDeleteModalOpen(false)
        setIsProcessing(false)
        supabase.removeChannel(channel)
        setRefreshKey(prev => prev + 1)
      }, 1500)
    } catch (error) {
      console.error('Error deleting:', error)
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header com Branding Dinâmico */}
      <RuntimeHeader 
        viewName={viewName}
        subtitle={description}
        icon={icon}
        actions={canAdd && (
          <button 
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all font-bold text-xs shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            {t('runtime.new_record')}
          </button>
        )}
      />

      <main className="px-10 py-2 pb-8">

        {isPage && isPageVisible ? (

          <RecordForm 
            mode={drawerMode}
            fields={formFields}
            initialData={selectedRow}
            onSave={handleSave}
            onCancel={() => setIsPageVisible(false)}
            isLoading={isProcessing}
            logicType={logicType}
            masterModelId={masterModelId}
            masterModelName={modelName}
            detailDisplayMode={detailDisplayMode}
            isPageMode={true}
            onEditDetail={handleEditDetail}
            onDeleteDetail={handleDeleteDetail}
            onAddDetail={handleOpenAddDetail}
            joins={joins}
          />
        ) : (
          <ViewContainer 
            key={refreshKey}
            projectId={project.id}
            modelName={modelName}
            displayFields={cleanDisplayFields}
            filterFields={cleanFilterFields}
            formFields={cleanFormFields}
            displayType={displayType}
            defaultView={defaultView}
            buttonsConfig={buttonsConfig}
            locale={locale}
            onView={handleOpenView}
            onEdit={handleOpenEdit}
            onDelete={handleOpenDelete}
            logicType={logicType}
            primaryKeyName={primaryKeyName}
            dictionary={dictionary}
            joins={joins}
            masterModelId={masterModelId}
            detailDisplayMode={detailDisplayMode}
            actionInterfaceType={actionInterfaceType}
          />
        )}
      </main>

      {isModal ? (
        <RecordModal 
          key={`master-modal-${selectedRow?.id ?? 'new'}`}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          zIndex={200}
          mode={drawerMode}
          fields={cleanFormFields}
          initialData={selectedRow}
          onSave={handleSave}
          isLoading={isProcessing}
          logicType={logicType}
          masterModelId={masterModelId}
          masterModelName={modelName}
          detailDisplayMode={detailDisplayMode}
          onEditDetail={handleEditDetail}
          onDeleteDetail={handleDeleteDetail}
          onAddDetail={handleOpenAddDetail}
          joins={joins}
          dictionary={dictionary}
          detailsInlineTypes={detailsInlineTypes}
          initialTab={activeTabForDetail}
          onTabChange={setActiveTabForDetail}
        />
      ) : (
        <RecordDrawer 
          key={`master-drawer-${selectedRow?.id ?? 'new'}`}
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          zIndex={200}
          mode={drawerMode}
          fields={cleanFormFields}
          initialData={selectedRow}
          onSave={handleSave}
          isLoading={isProcessing}
          logicType={logicType}
          masterModelId={masterModelId}
          masterModelName={modelName}
          detailDisplayMode={detailDisplayMode}
          onEditDetail={handleEditDetail}
          onDeleteDetail={handleDeleteDetail}
          onAddDetail={handleOpenAddDetail}
          joins={joins}
          dictionary={dictionary}
          detailsInlineTypes={detailsInlineTypes}
          initialTab={activeTabForDetail}
          onTabChange={setActiveTabForDetail}
        />
      )}

      <DeleteConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        isLoading={isProcessing}
        recordName={selectedRow?.name || selectedRow?.titulo || selectedRow?.id}
      />

      {/* Renderização de níveis anteriores do histórico (para ficarem visíveis no fundo) */}
      {detailHistory.map((item, idx) => {
        const model = (project as any)?.models?.find((m: any) => m.db_table_name.toLowerCase() === item.tableName?.toLowerCase())
        const interfaceType = detailsInterfaceTypes?.[model?.id || ''] || (project.ui_config as any)?.details_interface_types?.[model?.id || ''] || 'modal'
        
        const historyProps = {
          mode: 'edit' as const,
          fields: item.fields,
          initialData: item.record,
          isLoading: false,
          logicType: "master_detail" as const,
          masterModelName: item.tableName,
          joins: joins,
          dictionary: dictionary,
          detailsInlineTypes: detailsInlineTypes,
          initialTab: item.activeTab,
          onClose: () => {
            // Se fechar um nível do fundo, voltamos para ele (remove os níveis acima)
            const levelsToRemove = detailHistory.length - idx
            let newHistory = [...detailHistory]
            for(let i=0; i < levelsToRemove; i++) handleCloseDetail()
          }
        }

        return interfaceType === 'modal' ? (
          <RecordModal 
            key={`history-modal-${idx}-${item.record?.id}`}
            isOpen={true}
            zIndex={200 + (idx + 1) * 100}
            {...historyProps}
          />
        ) : (
          <RecordDrawer 
            key={`history-drawer-${idx}-${item.record?.id}`}
            isOpen={true}
            zIndex={200 + (idx + 1) * 100}
            {...historyProps}
          />
        )
      })}

      {/* Modal de Edição de Detalhe (Nível Atual) */}
      <RecordModal 
        key={`detail-modal-${currentDetailTable}-${selectedDetail?.id ?? detailHistory.length}-${detailRefreshKey}`}
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetail}
        zIndex={200 + (detailHistory.length + 1) * 100}
        mode={detailModalMode}
        fields={detailFieldsToRender}
        initialData={selectedDetail}
        onSave={handleSaveDetail}
        isLoading={isProcessing}
        logicType="master_detail"
        masterModelName={currentDetailTable}
        onEditDetail={handleEditDetail}
        onDeleteDetail={handleDeleteDetail}
        onAddDetail={handleOpenAddDetail}
        joins={joins}
        dictionary={dictionary}
        detailsInlineTypes={detailsInlineTypes}
        initialTab={activeTabForDetail}
        onTabChange={setActiveTabForDetail}
      />

      {/* Drawer de Edição de Detalhe */}
      <RecordDrawer 
        key={`detail-drawer-${currentDetailTable}-${selectedDetail?.id ?? detailHistory.length}-${detailRefreshKey}`}
        isOpen={isDetailDrawerOpen}
        onClose={handleCloseDetail}
        zIndex={200 + (detailHistory.length + 1) * 100}
        mode={detailModalMode}
        fields={detailFieldsToRender}
        initialData={selectedDetail}
        onSave={handleSaveDetail}
        isLoading={isProcessing}
        logicType="master_detail"
        masterModelName={currentDetailTable}
        onEditDetail={handleEditDetail}
        onDeleteDetail={handleDeleteDetail}
        onAddDetail={handleOpenAddDetail}
        joins={joins}
        dictionary={dictionary}
        detailsInlineTypes={detailsInlineTypes}
        initialTab={activeTabForDetail}
        onTabChange={setActiveTabForDetail}
      />

      {/* Modal de Confirmação de Exclusão de Detalhe */}
      <DeleteConfirmModal 
        isOpen={isDetailDeleteModalOpen}
        onClose={() => {
          setIsDetailDeleteModalOpen(false)
          setItemToDelete(null)
        }}
        onConfirm={handleConfirmDeleteDetail}
        isLoading={isProcessing}
        recordName={itemToDelete?.display_name || itemToDelete?.name || itemToDelete?.id}
      />
    </div>
  )
}
