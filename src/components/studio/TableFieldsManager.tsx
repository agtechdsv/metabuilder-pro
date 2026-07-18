'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'
import { 
  Database, 
  Search, 
  Table, 
  Tag, 
  FileText, 
  Save, 
  Key, 
  Check, 
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TableFieldsManagerProps {
  project: any
  models: any[]
  onSaveSuccess?: () => void
}

interface FieldEdit {
  display_name: string
  is_visible_in_list: boolean
  is_visible_in_form: boolean
  is_searchable: boolean
  is_sortable: boolean
  order_index: number
  ui_widget: string
}

export function TableFieldsManager({ project, models, onSaveSuccess }: TableFieldsManagerProps) {
  const { t } = useI18n()
  const { toast } = useToast()
  const supabase = createClient()

  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [fields, setFields] = useState<any[]>([])
  const [loadingFields, setLoadingFields] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Edit states
  const [modelDisplayName, setModelDisplayName] = useState('')
  const [modelDescription, setModelDescription] = useState('')
  const [modelCanCreate, setModelCanCreate] = useState(true)
  const [modelCanUpdate, setModelCanUpdate] = useState(true)
  const [modelCanDelete, setModelCanDelete] = useState(true)
  const [fieldEdits, setFieldEdits] = useState<Record<string, FieldEdit>>({})

  // Modal de Migração de Schema
  const [schemaModalOpen, setSchemaModalOpen] = useState(false)
  const [newSchemaName, setNewSchemaName] = useState('')
  const [isMigratingSchema, setIsMigratingSchema] = useState(false)

  // Select first model by default if models list is available
  useEffect(() => {
    if (models.length > 0 && !selectedModelId) {
      setSelectedModelId(models[0].id)
    }
  }, [models])

  const fetchFields = useCallback(async () => {
    if (!selectedModelId) return
    setLoadingFields(true)
    try {
      const { data, error } = await supabase
        .from('fields')
        .select('*')
        .eq('model_id', selectedModelId)
        .order('order_index', { ascending: true })

      if (error) throw error

      if (data) {
        setFields(data)
        const edits: Record<string, FieldEdit> = {}
        data.forEach(f => {
          edits[f.id] = {
            display_name: f.display_name || f.db_column_name || '',
            is_visible_in_list: f.is_visible_in_list !== false,
            is_visible_in_form: f.is_visible_in_form !== false,
            is_searchable: f.is_searchable !== false,
            is_sortable: f.is_sortable !== false,
            order_index: typeof f.order_index === 'number' ? f.order_index : 0,
            ui_widget: f.ui_widget || 'text'
          }
        })
        setFieldEdits(edits)
      }
    } catch (err: any) {
      console.error('Error fetching fields:', err)
      toast(t('dashboard.projects.studio.metadata.toasts.fetch_error') + err.message, 'error')
    } finally {
      setLoadingFields(false)
    }
  }, [selectedModelId, supabase, toast, t])

  // Load fields and model info when selectedModelId changes
  useEffect(() => {
    if (!selectedModelId) return

    const currentModel = models.find(m => m.id === selectedModelId)
    if (currentModel) {
      setModelDisplayName(currentModel.display_name || currentModel.db_table_name)
      setModelDescription(currentModel.description || '')
      setModelCanCreate(currentModel.can_create !== false)
      setModelCanUpdate(currentModel.can_update !== false)
      setModelCanDelete(currentModel.can_delete !== false)
    }

    fetchFields()
  }, [selectedModelId, models, fetchFields])

  const handleSave = async () => {
    if (!selectedModelId) return
    setIsSaving(true)

    try {
      // 1. Update model display_name, description & permissions
      const { error: modelErr } = await supabase
        .from('models')
        .update({
          display_name: modelDisplayName,
          description: modelDescription,
          can_create: modelCanCreate,
          can_update: modelCanUpdate,
          can_delete: modelCanDelete
        })
        .eq('id', selectedModelId)

      if (modelErr) throw modelErr

      // 2. Update modified fields
      const promises = fields.map(f => {
        const edit = fieldEdits[f.id]
        if (!edit) return Promise.resolve({ error: null })
        
        // Skip if nothing changed
        const hasChanged = 
          edit.display_name !== (f.display_name || f.db_column_name) ||
          edit.is_visible_in_list !== (f.is_visible_in_list !== false) ||
          edit.is_visible_in_form !== (f.is_visible_in_form !== false) ||
          edit.is_searchable !== (f.is_searchable === true) ||
          edit.is_sortable !== (f.is_sortable !== false) ||
          edit.order_index !== (typeof f.order_index === 'number' ? f.order_index : 0) ||
          edit.ui_widget !== (f.ui_widget || 'text')

        if (!hasChanged) {
          return Promise.resolve({ error: null })
        }

        return supabase
          .from('fields')
          .update({
            display_name: edit.display_name,
            is_visible_in_list: edit.is_visible_in_list,
            is_visible_in_form: edit.is_visible_in_form,
            is_searchable: edit.is_searchable,
            is_sortable: edit.is_sortable,
            order_index: edit.order_index,
            ui_widget: edit.ui_widget
          })
          .eq('id', f.id)
      })

      const results = await Promise.all(promises)
      const hasError = results.some(r => r.error)

      if (hasError) {
        toast(t('dashboard.projects.studio.metadata.toasts.save_partial_error'), 'error')
      } else {
        toast(t('dashboard.projects.studio.metadata.toasts.save_success'), 'success')
        onSaveSuccess?.()
      }
    } catch (err: any) {
      console.error('Error saving model/fields metadata:', err)
      toast(t('dashboard.projects.studio.metadata.toasts.save_error') + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleFieldChange = (fieldId: string, key: keyof FieldEdit, value: any) => {
    setFieldEdits(prev => {
      const current = prev[fieldId] || {
        display_name: '',
        is_visible_in_list: true,
        is_visible_in_form: true,
        is_searchable: true,
        is_sortable: true,
        order_index: 0,
        ui_widget: 'text'
      }

      const updated = {
        ...current,
        [key]: value
      }

      // Se desmarcar "Visível no Grid" (is_visible_in_list), desmarca também "Ordenável" (is_sortable)
      if (key === 'is_visible_in_list' && value === false) {
        updated.is_sortable = false
      }

      return {
        ...prev,
        [fieldId]: updated
      }
    })
  }

  const filteredModels = models.filter(m => 
    m.db_table_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.display_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedModel = models.find(m => m.id === selectedModelId)

  return (
    <div className="w-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-black flex items-center gap-3 text-neutral-900 dark:text-white tracking-tight">
            <Database className="w-6 h-6 text-indigo-600 dark:text-indigo-500" />
            {t('dashboard.projects.studio.metadata.title')}
          </h3>
          <p className="text-xs text-neutral-500 mt-1">{t('dashboard.projects.studio.metadata.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Tables List */}
        <div className="lg:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('dashboard.projects.studio.metadata.search_placeholder')}
              className="w-full bg-neutral-50 dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-2xl pl-11 pr-4 py-3 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
            {filteredModels.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 text-xs font-bold">
                {t('dashboard.projects.studio.metadata.no_tables')}
              </div>
            ) : (
              filteredModels.map(m => {
                const isSelected = m.id === selectedModelId
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModelId(m.id)}
                    className={cn(
                      "w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-3 group",
                      isSelected 
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/10" 
                        : "bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 hover:bg-neutral-55 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                    )}
                  >
                    <div className={cn(
                      "p-2.5 rounded-xl transition-all",
                      isSelected ? "bg-white/10 text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-500"
                    )}>
                      <Table className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-black uppercase tracking-wider block truncate">{m.db_table_name}</span>
                      <span className={cn(
                        "text-[10px] block mt-0.5 truncate",
                        isSelected ? "text-white/70" : "text-neutral-400"
                      )}>
                        {m.display_name || m.db_table_name}
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Properties & Fields Editor */}
        <div className="lg:col-span-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 lg:p-8 space-y-8 min-h-[40vh]">
          {selectedModel ? (
            <>
              {/* Table Metadata Section */}
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/50 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-xl">
                      <Table className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm uppercase tracking-wider">{selectedModel.db_table_name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Schema: {selectedModel.db_schema_name || 'public'}</p>
                        <button 
                          type="button"
                          onClick={() => {
                            setNewSchemaName(selectedModel.db_schema_name || 'public')
                            setSchemaModalOpen(true)
                          }}
                          className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-md text-[9px] font-bold uppercase tracking-wider transition-colors"
                          title="Migrar/Renomear Schema"
                        >
                          Migrar
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchFields}
                      disabled={loadingFields}
                      type="button"
                      className="p-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 bg-white dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-full transition-all flex items-center justify-center group shadow-sm"
                      title={t('dashboard.projects.studio.metadata.refresh_tooltip')}
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingFields ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500 ease-out'}`} />
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-505 disabled:opacity-50 text-white rounded-full text-xs font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{t('dashboard.projects.studio.metadata.saving')}</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>{t('dashboard.projects.studio.metadata.save_table')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-500" /> {t('dashboard.projects.studio.metadata.friendly_name')}
                    </label>
                    <input
                      type="text"
                      value={modelDisplayName}
                      onChange={e => setModelDisplayName(e.target.value)}
                      placeholder={t('dashboard.projects.studio.metadata.friendly_name_placeholder')}
                      className="w-full bg-neutral-50 dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" /> {t('dashboard.projects.studio.metadata.table_description')}
                    </label>
                    <input
                      type="text"
                      value={modelDescription}
                      onChange={e => setModelDescription(e.target.value)}
                      placeholder={t('dashboard.projects.studio.metadata.description_placeholder')}
                      className="w-full bg-neutral-50 dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Permissões da Tabela */}
                <div className="bg-neutral-50 dark:bg-neutral-955 border border-neutral-100 dark:border-neutral-800/80 rounded-2xl p-5 space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-500" /> {t('dashboard.projects.studio.metadata.actions_permissions')}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Can Create */}
                    <label className="flex items-center justify-between p-3.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 transition-all group">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{t('dashboard.projects.studio.metadata.allow_creation')}</span>
                        <span className="text-[9px] text-neutral-400">{t('dashboard.projects.studio.metadata.allow_creation_desc')}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={modelCanCreate}
                        onChange={e => setModelCanCreate(e.target.checked)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </label>

                    {/* Can Update */}
                    <label className="flex items-center justify-between p-3.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 transition-all group">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{t('dashboard.projects.studio.metadata.allow_edition')}</span>
                        <span className="text-[9px] text-neutral-400">{t('dashboard.projects.studio.metadata.allow_edition_desc')}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={modelCanUpdate}
                        onChange={e => setModelCanUpdate(e.target.checked)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </label>

                    {/* Can Delete */}
                    <label className="flex items-center justify-between p-3.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 transition-all group">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{t('dashboard.projects.studio.metadata.allow_deletion')}</span>
                        <span className="text-[9px] text-neutral-400">{t('dashboard.projects.studio.metadata.allow_deletion_desc')}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={modelCanDelete}
                        onChange={e => setModelCanDelete(e.target.checked)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Fields List Section */}
              <div className="space-y-5 pt-4 border-t border-neutral-100 dark:border-neutral-800/50">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-500" /> {t('dashboard.projects.studio.metadata.detected_columns').replace('{count}', String(fields.length))}
                  </h4>
                </div>

                {loadingFields ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                    <p className="text-neutral-500 mt-4 font-bold text-xs">{t('dashboard.projects.studio.metadata.loading_columns')}</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                    {fields.map(f => {
                      const edit = fieldEdits[f.id] || {
                        display_name: '',
                        is_visible_in_list: true,
                        is_visible_in_form: true,
                        is_searchable: false,
                        is_sortable: true,
                        order_index: 0,
                        ui_widget: 'text'
                      }
                      return (
                        <div key={f.id} className="p-5 bg-neutral-50 dark:bg-neutral-955 border border-neutral-100 dark:border-neutral-850 rounded-2xl space-y-4">
                          {/* Column Identification */}
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-wider">{f.db_column_name}</span>
                              <span className="px-2 py-0.5 bg-neutral-200/50 dark:bg-neutral-800 text-[9px] font-mono text-neutral-600 dark:text-neutral-400 rounded border border-neutral-200 dark:border-neutral-700">
                                {f.data_type}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {f.is_primary_key && (
                                <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase tracking-wider rounded border border-indigo-500/20 flex items-center gap-1">
                                  <Key className="w-2.5 h-2.5" /> PK
                                </span>
                              )}
                              {!f.is_nullable && (
                                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-wider rounded border border-amber-500/20">
                                  {t('dashboard.projects.studio.metadata.required')}
                                </span>
                              )}
                            </div>
                          </div>
 
                          {/* Editable Inputs */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-3 space-y-1.5">
                              <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">{t('dashboard.projects.studio.metadata.ui_label')}</label>
                              <input
                                type="text"
                                value={edit.display_name}
                                onChange={e => handleFieldChange(f.id, 'display_name', e.target.value)}
                                placeholder={f.db_column_name}
                                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">{t('dashboard.projects.studio.metadata.order_index')}</label>
                              <input
                                type="number"
                                value={edit.order_index}
                                onChange={e => handleFieldChange(f.id, 'order_index', parseInt(e.target.value) || 0)}
                                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                              />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                              <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Tipo de Interface</label>
                              <select
                                value={edit.ui_widget || 'text'}
                                onChange={e => handleFieldChange(f.id, 'ui_widget', e.target.value)}
                                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-indigo-500 transition-colors appearance-none"
                              >
                                <option value="text">Texto (Padrão)</option>
                                <option value="number">Número</option>
                                <option value="date">Data/Hora</option>
                                <option value="switch">Switch (Booleano)</option>
                                <option value="image_uploader">Imagem (Upload Base64)</option>
                                <option value="document_uploader">Documento (Upload Base64)</option>
                                <option value="file_uploader">Arquivo Genérico (Base64)</option>
                              </select>
                            </div>
                          </div>

                                            {/* Checkboxes Config */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                            {/* is_searchable */}
                            <label className="flex items-center gap-2 p-2 bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 rounded-xl cursor-pointer hover:border-indigo-500/50 transition-all">
                              <input
                                type="checkbox"
                                checked={edit.is_searchable}
                                onChange={e => handleFieldChange(f.id, 'is_searchable', e.target.checked)}
                                className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
                              />
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300">{t('dashboard.projects.studio.metadata.visible_filter')}</span>
                              </div>
                            </label>

                            {/* is_visible_in_list */}
                            <label className="flex items-center gap-2 p-2 bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 rounded-xl cursor-pointer hover:border-indigo-500/50 transition-all">
                              <input
                                type="checkbox"
                                checked={edit.is_visible_in_list}
                                onChange={e => handleFieldChange(f.id, 'is_visible_in_list', e.target.checked)}
                                className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
                              />
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300">{t('dashboard.projects.studio.metadata.visible_grid')}</span>
                              </div>
                            </label>

                            {/* is_visible_in_form */}
                            <label className="flex items-center gap-2 p-2 bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 rounded-xl cursor-pointer hover:border-indigo-500/50 transition-all">
                              <input
                                type="checkbox"
                                checked={edit.is_visible_in_form}
                                onChange={e => handleFieldChange(f.id, 'is_visible_in_form', e.target.checked)}
                                className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
                              />
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300">{t('dashboard.projects.studio.metadata.visible_form')}</span>
                              </div>
                            </label>

                            {/* is_sortable */}
                            <label className="flex items-center gap-2 p-2 bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 rounded-xl cursor-pointer hover:border-indigo-500/50 transition-all">
                              <input
                                type="checkbox"
                                checked={edit.is_sortable}
                                onChange={e => handleFieldChange(f.id, 'is_sortable', e.target.checked)}
                                className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
                              />
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300">{t('dashboard.projects.studio.metadata.sortable')}</span>
                              </div>
                            </label>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-20 text-neutral-400 dark:text-neutral-600 gap-4">
              <Table className="w-12 h-12 opacity-50" />
              <div>
                <h4 className="font-bold text-sm">{t('dashboard.projects.studio.metadata.no_table_selected')}</h4>
                <p className="text-xs mt-1">{t('dashboard.projects.studio.metadata.select_table_desc')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={schemaModalOpen}
        onClose={() => !isMigratingSchema && setSchemaModalOpen(false)}
        title="Renomear e Migrar Schema"
        description={`Digite o NOVO nome do schema para migrar TODOS os modelos deste projeto que atualmente estão no schema '${selectedModel?.db_schema_name || 'public'}'.`}
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Novo Nome do Schema</label>
            <input
              type="text"
              value={newSchemaName}
              onChange={e => setNewSchemaName(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              disabled={isMigratingSchema}
              className="mt-1 w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="ex: crm"
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setSchemaModalOpen(false)}
              disabled={isMigratingSchema}
              className="px-4 py-2 text-sm font-bold text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                const currentSchema = selectedModel?.db_schema_name || 'public';
                if (!newSchemaName || newSchemaName === currentSchema) {
                  setSchemaModalOpen(false);
                  return;
                }
                setIsMigratingSchema(true);
                fetch('/api/metadata/rename-schema', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    projectId: project.id,
                    oldSchema: currentSchema,
                    newSchema: newSchemaName
                  })
                }).then(res => res.json()).then(data => {
                  setIsMigratingSchema(false);
                  if (data.success) {
                    toast(`Schema migrado para '${newSchemaName}' com sucesso! Rode o CLI novamente.`, 'success')
                    setSchemaModalOpen(false);
                    if (onSaveSuccess) onSaveSuccess();
                  } else {
                    toast(data.error || 'Erro ao migrar schema', 'error')
                  }
                }).catch(err => {
                  setIsMigratingSchema(false);
                  toast('Erro na requisição', 'error')
                })
              }}
              disabled={isMigratingSchema || !newSchemaName || newSchemaName === (selectedModel?.db_schema_name || 'public')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
            >
              {isMigratingSchema ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isMigratingSchema ? 'Migrando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
