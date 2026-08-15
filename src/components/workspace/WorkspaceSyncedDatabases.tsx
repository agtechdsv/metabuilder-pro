'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Database, Pencil, Trash2, Loader2, AlertTriangle, Save, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n'

interface ProjectData {
  id: string
  name: string
  slug: string
}

interface SyncedSchema {
  project_id: string
  db_schema_name: string
}

interface GroupedData {
  project: ProjectData
  schemas: string[]
}
interface WorkspaceSyncedDatabasesProps {
  workspaceId?: string
}

export function WorkspaceSyncedDatabases({ workspaceId }: WorkspaceSyncedDatabasesProps = {}) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [groupedData, setGroupedData] = useState<GroupedData[]>([])
  const { toast } = useToast()
  const supabase = createClient()

  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<{ projectId: string, projectName: string, schemaName: string } | null>(null)
  const [newSchemaName, setNewSchemaName] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      let projectsQuery = supabase.from('projects').select('id, name, slug')
      if (workspaceId) {
        projectsQuery = projectsQuery.eq('workspace_id', workspaceId)
      }
      
      const { data: projectsData, error: projectsError } = await projectsQuery
      
      if (projectsError) throw projectsError

      // Fetch distinct schemas from models
      const { data: modelsData, error: modelsError } = await supabase
        .from('models')
        .select('project_id, db_schema_name')
        
      if (modelsError) throw modelsError

      // Group models by project and distinct schema
      const projectMap = new Map<string, ProjectData>()
      projectsData.forEach(p => projectMap.set(p.id, p))

      const schemaMap = new Map<string, Set<string>>()
      modelsData.forEach(model => {
        if (!schemaMap.has(model.project_id)) {
          schemaMap.set(model.project_id, new Set())
        }
        if (model.db_schema_name) {
          schemaMap.get(model.project_id)!.add(model.db_schema_name)
        }
      })

      const finalData: GroupedData[] = []
      schemaMap.forEach((schemas, projectId) => {
        const project = projectMap.get(projectId)
        if (project) {
          finalData.push({
            project,
            schemas: Array.from(schemas).sort()
          })
        }
      })

      // Sort by project name
      finalData.sort((a, b) => a.project.name.localeCompare(b.project.name))
      setGroupedData(finalData)
    } catch (err: any) {
      console.error(err)
      toast('Erro ao carregar dados dos bancos sincronizados', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleEditClick = (projectId: string, projectName: string, schemaName: string) => {
    setSelectedItem({ projectId, projectName, schemaName })
    setNewSchemaName(schemaName)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (projectId: string, projectName: string, schemaName: string) => {
    setSelectedItem({ projectId, projectName, schemaName })
    setIsDeleteModalOpen(true)
  }

  const handleUpdateSchema = async () => {
    if (!selectedItem || !newSchemaName.trim()) return
    if (newSchemaName.trim() === selectedItem.schemaName) {
      setIsEditModalOpen(false)
      return
    }

    setIsProcessing(true)
    try {
      const { error } = await supabase
        .from('models')
        .update({ db_schema_name: newSchemaName.trim() })
        .eq('project_id', selectedItem.projectId)
        .eq('db_schema_name', selectedItem.schemaName)

      if (error) throw error

      toast('Schema renomeado com sucesso!', 'success')
      setIsEditModalOpen(false)
      fetchData() // Refresh list
    } catch (err: any) {
      console.error(err)
      toast(err.message || 'Erro ao renomear schema', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeleteSchema = async () => {
    if (!selectedItem) return

    setIsProcessing(true)
    try {
      const { error } = await supabase
        .from('models')
        .delete()
        .eq('project_id', selectedItem.projectId)
        .eq('db_schema_name', selectedItem.schemaName)

      if (error) throw error

      toast('Tabelas do schema removidas com sucesso!', 'success')
      setIsDeleteModalOpen(false)
      fetchData() // Refresh list
    } catch (err: any) {
      console.error(err)
      toast(err.message || 'Erro ao remover schema', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
      <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-500" />
          {t('workspace_components.synced_dbs.title', 'Bancos Sincronizados (Schemas)')}
        </h2>
        <p className="text-sm text-neutral-500 mt-1">
          {t('workspace_components.synced_dbs.desc', 'Gerencie os schemas criados pela sincronização/introspecção em seus projetos. Você pode renomear conexões ou limpar schemas antigos para evitar duplicidade nas tabelas do seu projeto.')}
        </p>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
            <p>{t('workspace_components.synced_dbs.loading', 'Carregando bancos sincronizados...')}</p>
          </div>
        ) : groupedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
            <Database className="w-12 h-12 mb-4 opacity-20" />
            <p>{t('workspace_components.synced_dbs.no_dbs_found', 'Nenhum banco de dados sincronizado encontrado.')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedData.map((group) => (
              <div key={group.project.id} className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                <div className="bg-neutral-50 dark:bg-neutral-900/50 px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-neutral-900 dark:text-white">{group.project.name}</span>
                    <span className="text-xs text-neutral-500 font-mono">/{group.project.slug}</span>
                  </div>
                  <div className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md">
                    {group.schemas.length} {group.schemas.length === 1 ? t('workspace_components.synced_dbs.single_schema', 'Schema') : t('workspace_components.synced_dbs.plural_schemas', 'Schemas')}
                  </div>
                </div>
                <div className="divide-y divide-neutral-100 dark:divide-neutral-850">
                  {group.schemas.map(schema => (
                    <div key={schema} className="px-5 py-4 flex items-center justify-between hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm text-neutral-800 dark:text-neutral-200">{schema}</span>
                        <span className="text-[10px] text-neutral-400 uppercase tracking-widest mt-1">
                          {t('workspace_components.synced_dbs.conn_name_label', 'Nome da Conexão')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditClick(group.project.id, group.project.name, schema)}
                          className="p-2 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
                          title={t('workspace_components.synced_dbs.rename_schema_tooltip', 'Renomear Schema')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(group.project.id, group.project.name, schema)}
                          className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          title={t('workspace_components.synced_dbs.delete_schema_tooltip', 'Excluir Schema e Tabelas Vinculadas')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => !isProcessing && setIsEditModalOpen(false)} title={t('workspace_components.synced_dbs.rename_modal_title', 'Renomear Schema de Conexão')}>
        <div className="p-5 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 p-3 rounded-xl text-sm border border-blue-100 dark:border-blue-800/30">
            {t('workspace_components.synced_dbs.rename_modal_desc', 'Isso atualizará o db_schema_name de todas as tabelas e modelos sincronizados no projeto {projectName} que estão sob o schema atual ({schemaName}).')
              .replace('{projectName}', selectedItem?.projectName || '')
              .replace('{schemaName}', selectedItem?.schemaName || '')}
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
              {t('workspace_components.synced_dbs.new_schema_name_label', 'Novo Nome do Schema (Connection Name)')}
            </label>
            <input
              type="text"
              value={newSchemaName}
              onChange={(e) => setNewSchemaName(e.target.value)}
              disabled={isProcessing}
              className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors"
              placeholder="Ex: crm"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              onClick={() => setIsEditModalOpen(false)}
              disabled={isProcessing}
              className="px-5 py-2.5 text-sm font-bold text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
              {t('workspace_components.synced_dbs.rename_cancel', 'Cancelar')}
            </button>
            <button
              onClick={handleUpdateSchema}
              disabled={isProcessing || !newSchemaName.trim() || newSchemaName.trim() === selectedItem?.schemaName}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('workspace_components.synced_dbs.rename_save', 'Salvar Alteração')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => !isProcessing && setIsDeleteModalOpen(false)} title={t('workspace_components.synced_dbs.delete_modal_title', 'Excluir Schema')}>
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/30">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold">{t('workspace_components.synced_dbs.delete_warning_title', 'Atenção! Esta ação é destrutiva.')}</h4>
              <p className="text-sm">
                {t('workspace_components.synced_dbs.delete_warning_desc', 'Você está prestes a excluir todas as referências de tabelas do schema {schemaName} no projeto {projectName}.')
                  .replace('{schemaName}', selectedItem?.schemaName || '')
                  .replace('{projectName}', selectedItem?.projectName || '')}
              </p>
            </div>
          </div>
          
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Se esse nome de conexão não existe mais no seu <code>metabuilder.config.json</code>, esta é a ação correta para limpar os "órfãos". Você precisará sincronizar o projeto novamente se deletar o schema ativo.
          </p>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isProcessing}
              className="px-5 py-2.5 text-sm font-bold text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
              {t('workspace_components.synced_dbs.delete_cancel', 'Cancelar')}
            </button>
            <button
              onClick={handleDeleteSchema}
              disabled={isProcessing}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {t('workspace_components.synced_dbs.delete_confirm', 'Excluir Schema')}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
