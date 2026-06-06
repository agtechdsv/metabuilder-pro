'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Trash2, Save, Database, Edit2, List, X, Download } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'

interface EnumValue {
  value: string
  description: string
}

interface Enumeration {
  id: string
  project_id: string
  name: string
  description: string | null
  values: EnumValue[]
}

export function EnumerationsClient({ workspace, project, workspace_slug, project_slug }: any) {
  const { t } = useI18n()
  const { toast } = useToast()
  const supabase = createClient()

  const [enumerations, setEnumerations] = useState<Enumeration[]>([])
  const [loading, setLoading] = useState(true)

  const [editingEnum, setEditingEnum] = useState<Enumeration | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Estados de Importação
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [otherProjects, setOtherProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [projectEnums, setProjectEnums] = useState<Enumeration[]>([])
  const [selectedEnums, setSelectedEnums] = useState<Set<string>>(new Set())
  const [importLoading, setImportLoading] = useState(false)

  // Estados para Geração Automática (Banco de Dados)
  const [enumSource, setEnumSource] = useState<'manual' | 'database'>('manual')
  const [dbModels, setDbModels] = useState<any[]>([])
  const [dbFields, setDbFields] = useState<any[]>([])
  const [selectedDbModel, setSelectedDbModel] = useState('')
  const [selectedDbField, setSelectedDbField] = useState('')
  const [isFetchingDistinct, setIsFetchingDistinct] = useState(false)

  // Busca de Modelos e Fields para a opção de DB
  useEffect(() => {
    const fetchMetadata = async () => {
      const { data: models } = await supabase.from('models').select('*').eq('project_id', project.id).order('db_table_name')
      const { data: fields } = await supabase.from('fields').select('*').order('db_column_name')
      if (models) setDbModels(models)
      if (fields) setDbFields(fields)
    }
    fetchMetadata()
  }, [project.id, supabase])

  // Configuração do Canal do Túnel para receber resultados do DB
  useEffect(() => {
    const channelName = `tunnel:${project.id}`
    const channel = supabase.channel(channelName)
    
    channel.on('broadcast', { event: 'sql_result' }, (payload) => {
      if (payload.payload?.queryId === 'fetch_distinct_enum') {
        const results = payload.payload.data || []
        if (results.length > 0) {
          const newValues = results.map((r: any) => ({
            value: String(r.value),
            description: String(r.value)
          }))
          setEditingEnum(prev => prev ? { ...prev, values: newValues } : null)
          toast(t('dashboard.projects.studio.enums.import_success').replace('{count}', String(results.length)), 'success')
        } else {
          toast(t('dashboard.projects.studio.enums.no_value_found'), 'info')
        }
        setIsFetchingDistinct(false)
      }
    }).subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [project.id, supabase, toast, t])

  const fetchDistinctValues = async () => {
    if (!selectedDbModel || !selectedDbField) {
      toast(t('dashboard.projects.studio.enums.select_table_column_error'), 'error')
      return
    }
    
    setIsFetchingDistinct(true)
    
    const model = dbModels.find(m => m.id === selectedDbModel)
    const field = dbFields.find(f => f.id === selectedDbField)
    
    if (!model || !field) return

    const query = `SELECT DISTINCT "${field.db_column_name}" as value FROM "${model.db_table_name}" WHERE "${field.db_column_name}" IS NOT NULL`

    const channelName = `tunnel:${project.id}`
    const channel = supabase.channel(channelName)
    
    await channel.send({
      type: 'broadcast',
      event: 'sql_query',
      payload: {
        queryId: 'fetch_distinct_enum',
        action: 'select',
        query: query,
        token: project.secret_token,
        schemaName: model.db_schema_name || 'public'
      }
    })
    
    // Timeout in case CLI is offline
    setTimeout(() => {
      setIsFetchingDistinct(prev => {
        if (prev) {
          toast(t('dashboard.projects.studio.enums.timeout_error'), 'error')
          return false
        }
        return prev
      })
    }, 8000)
  }

  const openImportModal = async () => {
    setIsImportModalOpen(true)
    setImportLoading(true)
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .eq('workspace_id', project.workspace_id)
      .neq('id', project.id)
    setOtherProjects(data || [])
    setImportLoading(false)
  }

  useEffect(() => {
    if (selectedProjectId) {
      const fetchProjectEnums = async () => {
        setImportLoading(true)
        const { data } = await supabase
          .from('project_enumerations')
          .select('*')
          .eq('project_id', selectedProjectId)
        setProjectEnums(data || [])
        setImportLoading(false)
      }
      fetchProjectEnums()
    } else {
      setProjectEnums([])
    }
  }, [selectedProjectId, supabase])

  const toggleEnumSelection = (id: string) => {
    const newSet = new Set(selectedEnums)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedEnums(newSet)
  }

  const handleImport = async () => {
    if (selectedEnums.size === 0) return
    setImportLoading(true)
    const enumsToImport = projectEnums.filter(e => selectedEnums.has(e.id))
    const newEnums = enumsToImport.map(e => ({
      project_id: project.id,
      name: e.name,
      description: e.description,
      values: e.values
    }))
    
    const { error } = await supabase.from('project_enumerations').insert(newEnums)
    if (error) {
      toast(t('dashboard.projects.studio.enums.import_error'), 'error')
    } else {
      toast(t('dashboard.projects.studio.enums.import_success_simple'), 'success')
      setIsImportModalOpen(false)
      setSelectedProjectId('')
      setSelectedEnums(new Set())
      fetchEnumerations()
    }
    setImportLoading(false)
  }

  const fetchEnumerations = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('project_enumerations')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })

    if (error) {
      toast(t('dashboard.projects.studio.enums.fetch_error'), 'error')
    } else {
      setEnumerations(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchEnumerations()
  }, [])

  const openNewModal = () => {
    setEditingEnum({
      id: '',
      project_id: project.id,
      name: '',
      description: '',
      values: []
    })
    setEnumSource('manual')
    setSelectedDbModel('')
    setSelectedDbField('')
    setIsModalOpen(true)
  }

  const openEditModal = (e: Enumeration) => {
    setEditingEnum({ ...e })
    setIsModalOpen(true)
  }

  const deleteEnum = async (id: string) => {
    if (!confirm(t('dashboard.projects.studio.enums.delete_confirm_msg'))) return
    const { error } = await supabase.from('project_enumerations').delete().eq('id', id)
    if (error) {
      toast(t('dashboard.projects.studio.enums.delete_error'), 'error')
    } else {
      toast(t('dashboard.projects.studio.enums.delete_success'), 'success')
      fetchEnumerations()
    }
  }

  const saveEnum = async () => {
    if (!editingEnum?.name) {
      toast(t('dashboard.projects.studio.enums.name_required'), 'error')
      return
    }

    if (editingEnum.id) {
      // Update
      const { error } = await supabase.from('project_enumerations').update({
        name: editingEnum.name,
        description: editingEnum.description,
        values: editingEnum.values
      }).eq('id', editingEnum.id)

      if (error) {
        toast(t('dashboard.projects.studio.enums.update_error'), 'error')
      } else {
        toast(t('dashboard.projects.studio.enums.update_success'), 'success')
        setIsModalOpen(false)
        fetchEnumerations()
      }
    } else {
      // Insert
      const { error } = await supabase.from('project_enumerations').insert({
        project_id: editingEnum.project_id,
        name: editingEnum.name,
        description: editingEnum.description,
        values: editingEnum.values
      })

      if (error) {
        toast(t('dashboard.projects.studio.enums.create_error'), 'error')
      } else {
        toast(t('dashboard.projects.studio.enums.create_success'), 'success')
        setIsModalOpen(false)
        fetchEnumerations()
      }
    }
  }

  const addEnumValue = () => {
    if (editingEnum) {
      setEditingEnum({
        ...editingEnum,
        values: [...editingEnum.values, { value: '', description: '' }]
      })
    }
  }

  const updateEnumValue = (index: number, key: 'value' | 'description', val: string) => {
    if (editingEnum) {
      const newValues = [...editingEnum.values]
      newValues[index][key] = val
      setEditingEnum({ ...editingEnum, values: newValues })
    }
  }

  const removeEnumValue = (index: number) => {
    if (editingEnum) {
      const newValues = [...editingEnum.values]
      newValues.splice(index, 1)
      setEditingEnum({ ...editingEnum, values: newValues })
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-black flex items-center gap-3 text-neutral-900 dark:text-white tracking-tight">
            <Database className="w-6 h-6 text-indigo-600 dark:text-indigo-500" />
            {t('dashboard.projects.studio.enums.title')}
          </h3>
          <p className="text-xs text-neutral-500 mt-1">{t('dashboard.projects.studio.enums.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={openImportModal}
            className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-full text-xs font-bold transition-all"
          >
            <Download className="w-4 h-4" /> {t('dashboard.projects.studio.enums.import')}
          </button>
          <button 
            onClick={openNewModal}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-bold transition-all shadow-[0_0_25px_rgba(79,70,229,0.4)]"
          >
            <Plus className="w-4 h-4" /> {t('dashboard.projects.studio.enums.new_enum')}
          </button>
        </div>
      </div>

      <div className="w-full">
        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-neutral-500 mt-4 font-bold text-xs">{t('dashboard.projects.studio.enums.loading')}</p>
          </div>
        ) : enumerations.length === 0 ? (
          <div className="text-center py-20 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-3xl">
            <List className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold">{t('dashboard.projects.studio.enums.empty_title')}</h3>
            <p className="text-sm text-neutral-500 mt-2">{t('dashboard.projects.studio.enums.empty_subtitle')}</p>
            <button 
              onClick={openNewModal}
              className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-bold transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> {t('dashboard.projects.studio.enums.create_first')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enumerations.map(e => (
              <div key={e.id} className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl hover:border-indigo-500 transition-colors flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-black text-base">{e.name}</h4>
                    {e.description && <p className="text-xs text-neutral-500 mt-1">{e.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditModal(e)} className="p-2 text-neutral-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteEnum(e.id)} className="p-2 text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mt-auto">
                  {e.values.slice(0, 3).map((v, i) => (
                    <span key={i} className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-md text-[10px] font-bold text-neutral-700 dark:text-neutral-300 truncate max-w-full">
                      {v.description} ({v.value})
                    </span>
                  ))}
                  {e.values.length > 3 && (
                    <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-md text-[10px] font-bold text-neutral-700 dark:text-neutral-300">
                      +{e.values.length - 3} {t('dashboard.projects.studio.enums.items_count')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Edição */}
      {isModalOpen && editingEnum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-xl">
                  <List className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h3 className="font-black text-lg">{editingEnum.id ? t('dashboard.projects.studio.enums.edit_title') : t('dashboard.projects.studio.enums.new_title')}</h3>
                  <p className="text-xs text-neutral-500">{t('dashboard.projects.studio.enums.configure_desc')}</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t('dashboard.projects.studio.enums.name_label')} <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editingEnum.name}
                    onChange={e => setEditingEnum({ ...editingEnum, name: e.target.value })}
                    placeholder="Ex: StatusPagamento"
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t('dashboard.projects.studio.enums.desc_label')}</label>
                  <input
                    type="text"
                    value={editingEnum.description || ''}
                    onChange={e => setEditingEnum({ ...editingEnum, description: e.target.value })}
                    placeholder="Ex: Status das faturas..."
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={enumSource === 'manual'} onChange={() => setEnumSource('manual')} className="accent-indigo-600" />
                    <span className="text-sm font-bold">{t('dashboard.projects.studio.enums.manual_source')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={enumSource === 'database'} onChange={() => setEnumSource('database')} className="accent-indigo-600" />
                    <span className="text-sm font-bold">{t('dashboard.projects.studio.enums.db_source')}</span>
                  </label>
                </div>

                {enumSource === 'database' && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t('dashboard.projects.studio.enums.target_table')}</label>
                        <select 
                          value={selectedDbModel} 
                          onChange={e => { setSelectedDbModel(e.target.value); setSelectedDbField(''); }}
                          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                        >
                          <option value="">{t('dashboard.projects.studio.enums.select_table')}</option>
                          {dbModels.map(m => (
                            <option key={m.id} value={m.id}>{m.display_name || m.db_table_name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t('dashboard.projects.studio.enums.target_column')}</label>
                        <select 
                          value={selectedDbField} 
                          onChange={e => setSelectedDbField(e.target.value)}
                          disabled={!selectedDbModel}
                          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 disabled:opacity-50"
                        >
                          <option value="">{t('dashboard.projects.studio.enums.select_column')}</option>
                          {dbFields.filter(f => f.model_id === selectedDbModel).map(f => (
                            <option key={f.id} value={f.id}>{f.display_name || f.db_column_name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button 
                      onClick={fetchDistinctValues}
                      disabled={isFetchingDistinct || !selectedDbModel || !selectedDbField}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isFetchingDistinct ? (
                         <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                         <Database className="w-4 h-4" />
                      )}
                      {isFetchingDistinct ? t('dashboard.projects.studio.enums.fetching_values') : t('dashboard.projects.studio.enums.load_distinct')}
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between mt-4">
                  <div>
                    <h4 className="text-sm font-bold">{t('dashboard.projects.studio.enums.fixed_values')}</h4>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mt-1">{t('dashboard.projects.studio.enums.fixed_values_hint')}</p>
                  </div>
                  <button onClick={addEnumValue} className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-2">
                    <Plus className="w-3 h-3" /> {t('dashboard.projects.studio.enums.add_value')}
                  </button>
                </div>

                <div className="space-y-2">
                  {editingEnum.values.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
                      <p className="text-xs text-neutral-500 font-bold">{t('dashboard.projects.studio.enums.no_values_added')}</p>
                    </div>
                  ) : (
                    editingEnum.values.map((v, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={v.value}
                          onChange={e => updateEnumValue(i, 'value', e.target.value)}
                          placeholder="Value (ex: 1, pending...)"
                          className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                        />
                        <input
                          type="text"
                          value={v.description}
                          onChange={e => updateEnumValue(i, 'description', e.target.value)}
                          placeholder="Description (ex: Pendente)"
                          className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                        />
                        <button onClick={() => removeEnumValue(i)} className="p-2.5 text-neutral-400 hover:text-red-500 bg-neutral-50 hover:bg-red-50 dark:bg-neutral-900 dark:hover:bg-red-900/20 border border-neutral-200 dark:border-neutral-800 hover:border-red-500/50 rounded-xl transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 rounded-b-3xl flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-bold rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                {t('dashboard.projects.studio.enums.cancel')}
              </button>
              <button onClick={saveEnum} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-indigo-600/20">
                <Save className="w-4 h-4" /> {t('dashboard.projects.studio.enums.save_enum')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Importação */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-xl">
                  <Download className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h3 className="font-black text-lg">{t('dashboard.projects.studio.enums.import_title')}</h3>
                  <p className="text-xs text-neutral-500">{t('dashboard.projects.studio.enums.import_desc')}</p>
                </div>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t('dashboard.projects.studio.enums.select_source_project')}</label>
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="">{t('dashboard.projects.studio.enums.select_project')}</option>
                  {otherProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {selectedProjectId && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold">{t('dashboard.projects.studio.enums.available_enums')}</h4>
                  {importLoading ? (
                    <div className="text-center py-8">
                      <div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                  ) : projectEnums.length === 0 ? (
                    <div className="text-center py-6 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                      <p className="text-xs text-neutral-500 font-bold">{t('dashboard.projects.studio.enums.project_no_enums')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar">
                      {projectEnums.map(e => (
                        <label key={e.id} className="flex items-center gap-3 p-4 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-pointer hover:border-indigo-500 transition-colors">
                          <input 
                            type="checkbox" 
                            checked={selectedEnums.has(e.id)}
                            onChange={() => toggleEnumSelection(e.id)}
                            className="w-4 h-4 accent-indigo-600 rounded"
                          />
                          <div>
                            <span className="text-sm font-bold block">{e.name}</span>
                            <span className="text-[10px] text-neutral-500 block mt-0.5">{e.values.length} {t('dashboard.projects.studio.enums.registered_values')}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 rounded-b-3xl flex justify-end gap-3">
              <button onClick={() => setIsImportModalOpen(false)} className="px-6 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-bold rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                {t('dashboard.projects.studio.enums.cancel')}
              </button>
              <button 
                onClick={handleImport} 
                disabled={selectedEnums.size === 0 || importLoading}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importLoading ? t('dashboard.projects.studio.enums.importing') : t('dashboard.projects.studio.enums.import_selected').replace('{count}', String(selectedEnums.size))}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
