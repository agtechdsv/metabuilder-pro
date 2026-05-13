'use client'

import { useState } from 'react'
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
  actionInterfaceType = 'drawer',
  baseUrl,
  breadcrumbs = [],
  description,
  icon
}: ViewPageContentProps) {

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
  const [isDetailDeleteModalOpen, setIsDetailDeleteModalOpen] = useState(false)
  const [selectedDetail, setSelectedDetail] = useState<any>(null)
  const [detailFieldsToRender, setDetailFieldsToRender] = useState<any[]>([])
  const [detailModalMode, setDetailModalMode] = useState<'create' | 'edit'>('edit')
  const [currentDetailTable, setCurrentDetailTable] = useState('')

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

  const fetchDetails = async (masterRow: any) => {
    if (logicType !== 'master_detail' || !joins || joins.length === 0) return []

    const allDetails: any[] = []
    
    // Para cada join configurado a partir da tabela mestre
    for (const join of joins) {
      if (join.from === modelName) {
        const localValue = masterRow[join.localKey]
        if (localValue === undefined || localValue === null) continue

        console.log(`[MetaBuilder] Fetching details from ${join.to} where ${join.foreignKey} = ${localValue}`)
        
        // Busca os registros na tabela detalhe
        const { data: detailData, error } = await supabase
          .from(join.to)
          .select('*')
          .eq(join.foreignKey, localValue)

        if (error) {
          console.error(`Error fetching details from ${join.to}:`, error)
          continue
        }

        if (detailData) {
          allDetails.push(...detailData.map(d => ({ 
            ...d, 
            model_name: dictionary[detailFields.find(f => f.db_column_name.includes(join.to) || f.model_name === join.to)?.model_id] || join.to 
          })))
        }
      }
    }
    return allDetails
  }

  const detailFields = formFields.filter(f => f.model_id && String(f.model_id) !== String(masterModelId))

  const handleOpenView = async (row: any) => {
    setDrawerMode('view')
    setIsProcessing(true)
    const details = await fetchDetails(row)
    setSelectedRow({ ...row, _details: details })
    setIsProcessing(false)
    setOpen(true)
  }

  const handleOpenEdit = async (row: any) => {
    setDrawerMode('edit')
    setIsProcessing(true)
    const details = await fetchDetails(row)
    setSelectedRow({ ...row, _details: details })
    setIsProcessing(false)
    setOpen(true)
  }

  const handleOpenDelete = (row: any) => {
    setSelectedRow(row)
    setIsDeleteModalOpen(true)
  }

  const handleOpenAddDetail = (tableName: string) => {
    const fields = detailFields.filter(f => f.model_name === tableName)
    setDetailFieldsToRender(fields)
    setSelectedDetail({})
    setDetailModalMode('create')
    setCurrentDetailTable(tableName)
    setIsDetailModalOpen(true)
  }

  const handleEditDetail = (detail: any) => {
    const fields = detailFields.filter(f => f.model_name === detail.model_name)
    setDetailFieldsToRender(fields)
    setSelectedDetail(detail)
    setDetailModalMode('edit')
    setCurrentDetailTable(detail.model_name)
    setIsDetailModalOpen(true)
  }

  const handleDeleteDetail = (detail: any) => {
    setSelectedDetail(detail)
    setIsDetailDeleteModalOpen(true)
  }

  const handleSaveDetail = async (formData: any) => {
    setIsProcessing(true)
    const queryId = crypto.randomUUID()
    const channelName = `tunnel:${project.id}`
    const channel = supabase.channel(channelName)

    try {
      const action = detailModalMode
      const fields = detailFields.filter(f => f.model_name === tableName)
      const pkField = fields.find(f => f.is_primary_key) || { db_column_name: 'id' }
      const detailPkName = pkField.db_column_name.split('.').pop() || 'id'
      
      let rawQuery = ''
      const sanitizedData: any = {}
      for (const [k, v] of Object.entries(formData)) {
        if (v !== undefined && v !== null && k !== 'model_name' && k !== '_details') {
          // Extrai o nome base da coluna caso esteja prefixado (ex: tabela.coluna -> coluna)
          const baseK = k.split('.').pop() || k
          sanitizedData[baseK] = String(v)
        }
      }

      // Se for inclusão, garantir que a FK para o mestre esteja correta
      if (action === 'create' && logicType === 'master_detail' && joins) {
        const join = joins.find(j => j.from === modelName && j.to === tableName)
        if (join) {
          sanitizedData[join.foreignKey] = String(selectedRow[join.localKey])
        }
      }

      if (action === 'edit') {
        const setClause = Object.entries(sanitizedData)
          .map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`)
          .join(', ')
        rawQuery = `UPDATE ${tableName} SET ${setClause} WHERE ${detailPkName} = '${String(selectedDetail[detailPkName] || selectedDetail['id']).replace(/'/g, "''")}'`
      } else {
        const keys = Object.keys(sanitizedData).join(', ')
        const values = Object.values(sanitizedData)
          .map(v => `'${String(v).replace(/'/g, "''")}'`)
          .join(', ')
        rawQuery = `INSERT INTO ${tableName} (${keys}) VALUES (${values})`
      }

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
              idValue: selectedDetail[detailPkName] || selectedDetail['id']
            }
          })
        }
      })

      setTimeout(async () => {
        setIsDetailModalOpen(false)
        supabase.removeChannel(channel)
        
        if (selectedRow) {
          const updatedDetails = await fetchDetails(selectedRow)
          setSelectedRow({ ...selectedRow, _details: updatedDetails })
        }
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
      const tableName = selectedDetail.model_name
      const fields = detailFields.filter(f => f.model_name === tableName)
      const pkField = fields.find(f => f.is_primary_key) || { db_column_name: 'id' }
      const detailPkName = pkField.db_column_name.split('.').pop() || 'id'
      const pkValue = selectedDetail[detailPkName] || selectedDetail['id']
      
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
              idValue: selectedDetail[detailPkName] || selectedDetail['id']
            }
          })
        }
      })

      setTimeout(async () => {
        setIsDetailDeleteModalOpen(false)
        supabase.removeChannel(channel)
        
        if (selectedRow) {
          const updatedDetails = await fetchDetails(selectedRow)
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
          
          const filters: any = {}
          let pkValue = formData[pkName]
          
          if (action === 'update' && pkValue !== undefined && pkValue !== null) {
            filters[pkName] = String(pkValue)
          }

          // Remove campos nulos/undefined e filtra APENAS os campos que o usuário configurou
          const sanitizedData: any = {}
          for (const [k, v] of Object.entries(formData)) {
            const isFormField = formFields.some(f => f.db_column_name === k)
            if (isFormField && v !== undefined && v !== null && k !== pkName) {
              sanitizedData[k] = String(v)
            } else if (action === 'insert' && isFormField && v !== undefined && v !== null) {
              if (k === pkName && v === '') {
                // Pula a PK no INSERT se estiver vazia, permitindo que o banco de dados auto-gere (Auto-increment/UUID)
                continue
              }
              sanitizedData[k] = String(v)
            }
          }

          // RAW SQL Builder: Montamos a query SQL bruta no front-end para Agentes CLI que exigem a string SQL
          let rawQuery = ''
          if (action === 'update' && pkValue) {
            const setClause = Object.entries(sanitizedData)
              .map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`)
              .join(', ')
            rawQuery = `UPDATE ${modelName} SET ${setClause} WHERE ${pkName} = '${String(pkValue).replace(/'/g, "''")}'`
          } else if (action === 'insert') {
            const keys = Object.keys(sanitizedData).join(', ')
            const values = Object.values(sanitizedData)
              .map(v => `'${String(v).replace(/'/g, "''")}'`)
              .join(', ')
            rawQuery = `INSERT INTO ${modelName} (${keys}) VALUES (${values})`
          }

          console.log(`[MetaBuilder] Executing ${action} on ${modelName}`, { data: sanitizedData, filters, pkName, pkValue, rawQuery })

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
        }
      })

      // Ouvir confirmação (opcional, ou apenas assumir sucesso e recarregar)
      // Para este MVP, vamos fechar e recarregar após 1s
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
            detailDisplayMode={detailDisplayMode}
            isPageMode={true}
            onEditDetail={handleEditDetail}
            onDeleteDetail={handleDeleteDetail}
            onAddDetail={handleOpenAddDetail}
          />
        ) : (
          <ViewContainer 
            key={refreshKey}
            projectId={project.id}
            modelName={modelName}
            displayFields={displayFields}
            filterFields={filterFields}
            formFields={formFields}
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
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          mode={drawerMode}
          fields={formFields}
          initialData={selectedRow}
          onSave={handleSave}
          isLoading={isProcessing}
          logicType={logicType}
          masterModelId={masterModelId}
          detailDisplayMode={detailDisplayMode}
          onEditDetail={handleEditDetail}
          onDeleteDetail={handleDeleteDetail}
          onAddDetail={handleOpenAddDetail}
        />
      ) : (
        <RecordDrawer 
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          mode={drawerMode}
          fields={formFields}
          initialData={selectedRow}
          onSave={handleSave}
          isLoading={isProcessing}
          logicType={logicType}
          masterModelId={masterModelId}
          detailDisplayMode={detailDisplayMode}
          onEditDetail={handleEditDetail}
          onDeleteDetail={handleDeleteDetail}
          onAddDetail={handleOpenAddDetail}
        />
      )}

      <DeleteConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        isLoading={isProcessing}
        recordName={selectedRow?.name || selectedRow?.titulo || selectedRow?.id}
      />

      {/* Modal de Edição de Detalhe */}
      <RecordModal 
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        mode={detailModalMode}
        fields={detailFieldsToRender}
        initialData={selectedDetail}
        onSave={handleSaveDetail}
        isLoading={isProcessing}
      />

      {/* Modal de Confirmação de Exclusão de Detalhe */}
      <DeleteConfirmModal 
        isOpen={isDetailDeleteModalOpen}
        onClose={() => setIsDetailDeleteModalOpen(false)}
        onConfirm={handleConfirmDeleteDetail}
        isLoading={isProcessing}
        recordName={selectedDetail?.display_name || selectedDetail?.name || selectedDetail?.id}
      />
    </div>
  )
}
