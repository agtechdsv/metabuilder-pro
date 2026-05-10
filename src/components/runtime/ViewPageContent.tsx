'use client'

import { useState } from 'react'
import { Table, Plus, LayoutGrid } from 'lucide-react'
import { HeaderActions } from '@/components/layout/HeaderActions'
import RecordDrawer from './RecordDrawer'
import DeleteConfirmModal from './DeleteConfirmModal'
import { createClient } from '@/utils/supabase/client'
import dynamic from 'next/dynamic'
import { useI18n } from '@/i18n/I18nContext'

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
  dictionary?: any
  joins?: any[]
}

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
  dictionary = {},
  joins = []
}: ViewPageContentProps) {
  const { t } = useI18n()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'view'>('create')
  const [selectedRow, setSelectedRow] = useState<any>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const supabase = createClient()

  const handleOpenAdd = () => {
    setDrawerMode('create')
    setSelectedRow({})
    setIsDrawerOpen(true)
  }

  const handleOpenView = (row: any) => {
    setDrawerMode('view')
    setSelectedRow(row)
    setIsDrawerOpen(true)
  }

  const handleOpenEdit = (row: any) => {
    setDrawerMode('edit')
    setSelectedRow(row)
    setIsDrawerOpen(true)
  }

  const handleOpenDelete = (row: any) => {
    setSelectedRow(row)
    setIsDeleteModalOpen(true)
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
        setIsDrawerOpen(false)
        setIsProcessing(false)
        supabase.removeChannel(channel)
        setRefreshKey(prev => prev + 1)
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
    <div className="min-h-screen bg-white dark:bg-[#050505] text-neutral-900 dark:text-neutral-200 transition-colors duration-300">
      {/* Header com Branding Dinâmico */}
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/50 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              <Table className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">
                  {workspace.name}
                </span>
                <span className="text-neutral-300 dark:text-neutral-600 text-xs">/</span>
                <span className="text-neutral-500 dark:text-neutral-400 text-xs font-medium">
                  {project.name}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white capitalize tracking-tight">
                {viewName}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <HeaderActions />
            {canAdd && (
              <button 
                onClick={handleOpenAdd}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all font-bold text-xs shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95"
              >
                <Plus className="w-4 h-4" />
                {t('runtime.new_record')}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
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
          kanbanGroupField={kanbanGroupField}
          dictionary={dictionary}
          joins={joins}
        />
      </main>

      <RecordDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        mode={drawerMode}
        fields={formFields}
        initialData={selectedRow}
        onSave={handleSave}
        isLoading={isProcessing}
      />

      <DeleteConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        isLoading={isProcessing}
        recordName={selectedRow?.name || selectedRow?.titulo || selectedRow?.id}
      />
    </div>
  )
}
