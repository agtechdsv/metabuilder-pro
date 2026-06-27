'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, Database, Table, Columns, Search, ArrowRight, Type, Hash, Calendar, List, Link as LinkIcon, ToggleLeft, ArrowLeft, ScrollText, FunctionSquare, RefreshCw } from 'lucide-react'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { useI18n } from '@/i18n/I18nContext'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { FieldSettingsModal } from './FieldSettingsModal'
import ProjectLogsTab from '@/components/studio/ProjectLogs/ProjectLogsTab'
import { CalculatedFieldsTab } from './CalculatedFieldsTab'
import { UpdateUseCasesModal } from './UpdateUseCasesModal'

interface SettingsDashboardClientProps {
  workspace: any
  project: any
  models: any[]
  relations: any[]
  enumerations: any[]
  workspace_slug: string
  project_slug: string
}

export function SettingsDashboardClient({
  workspace,
  project,
  models,
  relations,
  enumerations,
  workspace_slug,
  project_slug
}: SettingsDashboardClientProps) {
  const { t } = useI18n()
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  
  const [activeTab, setActiveTab] = useState<'fields' | 'calculated' | 'global'>('fields')
  const [selectedModelId, setSelectedModelId] = useState<string | null>(models.length > 0 ? models[0].id : null)
  const [searchQuery, setSearchQuery] = useState('')
  
  // States for Drawer
  const [selectedField, setSelectedField] = useState<any>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [updateTargetField, setUpdateTargetField] = useState<any>(null)

  // Handlers for Drawer
  const handleOpenDrawer = (field: any) => {
    setSelectedField(field)
    setIsDrawerOpen(true)
  }

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false)
    setTimeout(() => setSelectedField(null), 300) // Wait for animation
  }

  const selectedModel = models.find(m => m.id === selectedModelId)
  
  const filteredFields = selectedModel?.fields?.filter((f: any) => {
    if (!searchQuery) return true
    const s = searchQuery.toLowerCase()
    return f.db_column_name.toLowerCase().includes(s) || 
           (f.display_name && f.display_name.toLowerCase().includes(s))
  }) || []

  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'varchar':
      case 'text':
        return <Type className="w-4 h-4 text-blue-500" />
      case 'integer':
      case 'bigint':
      case 'numeric':
      case 'double precision':
        return <Hash className="w-4 h-4 text-purple-500" />
      case 'date':
      case 'timestamp':
      case 'timestamp with time zone':
        return <Calendar className="w-4 h-4 text-orange-500" />
      case 'boolean':
        return <ToggleLeft className="w-4 h-4 text-green-500" />
      case 'uuid':
        return <LinkIcon className="w-4 h-4 text-indigo-500" />
      case 'jsonb':
      case 'json':
        return <List className="w-4 h-4 text-pink-500" />
      default:
        return <Columns className="w-4 h-4 text-neutral-500" />
    }
  }

  return (
    <>
      <Breadcrumbs 
        workspaceName={workspace?.name}
        projectName={project?.name}
        workspaceSlug={workspace_slug}
        projectSlug={project_slug}
        viewName="Configurações do Projeto"
      />

      <main className="w-full px-10 pt-4 pb-4 space-y-6 flex-grow">
        
        <div className="sticky top-16 z-30 bg-white/80 dark:bg-[#080808]/80 backdrop-blur-xl -mx-10 px-10 py-4 border-b border-neutral-200 dark:border-neutral-800 space-y-4">
          <section className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-neutral-900 dark:bg-white rounded-xl text-white dark:text-black shadow-lg shadow-black/10 dark:shadow-white/10">
                <Settings2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-neutral-900 dark:text-white">
                  Configurações do Projeto
                </h2>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                  Gerencie padrões globais, defaults de campos e configurações avançadas do projeto.
                </p>
              </div>
            </div>
          </section>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-900/50 p-1 rounded-[1.5rem] border border-neutral-200 dark:border-neutral-800 w-fit">
            <button 
              onClick={() => setActiveTab('fields')}
              className={`flex items-center gap-2 px-6 py-2 rounded-[1rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'fields' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-xl' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              <Columns className="w-4 h-4" /> Defaults dos Campos
            </button>
            <button 
              onClick={() => setActiveTab('calculated')}
              className={`flex items-center gap-2 px-6 py-2 rounded-[1rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'calculated' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-xl' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              <FunctionSquare className="w-4 h-4" /> Campos Calculados
            </button>
            <button 
              onClick={() => setActiveTab('global')}
              className={`flex items-center gap-2 px-6 py-2 rounded-[1rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'global' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-xl' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              <ScrollText className="w-4 h-4" /> Configurações Globais
            </button>
          </div>
        </div>

        {activeTab === 'fields' && (
          <div className="flex gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Left Column: Models List */}
            <div className="w-80 flex-shrink-0 flex flex-col gap-3">
              <div className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-4 flex flex-col gap-2 shadow-sm">
                <div className="px-3 py-2">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Tabelas Sincronizadas</h3>
                  <p className="text-xs text-neutral-500">Selecione uma tabela para configurar os defaults dos seus campos.</p>
                </div>
                
                <div className="flex flex-col gap-1 max-h-[calc(100vh-320px)] overflow-y-auto pr-1 custom-scrollbar">
                  {models.map(model => (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModelId(model.id)}
                      className={`flex items-center gap-3 p-3 rounded-2xl text-left transition-all ${
                        selectedModelId === model.id 
                          ? 'bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 shadow-sm' 
                          : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50 border border-transparent'
                      }`}
                    >
                      <div className={`p-2 rounded-xl ${selectedModelId === model.id ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'}`}>
                        <Table className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${selectedModelId === model.id ? 'text-indigo-900 dark:text-indigo-300' : 'text-neutral-700 dark:text-neutral-300'}`}>
                          {model.display_name || model.db_table_name}
                        </p>
                        <p className="text-[10px] text-neutral-400 truncate font-mono">
                          {model.db_table_name}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Fields List */}
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              {selectedModel ? (
                <div className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] shadow-sm flex flex-col h-[calc(100vh-230px)]">
                  
                  {/* Header */}
                  <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-4 shrink-0">
                    <div>
                      <h2 className="text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2">
                        <Table className="w-5 h-5 text-indigo-500" />
                        {selectedModel.display_name || selectedModel.db_table_name}
                      </h2>
                      <p className="text-xs text-neutral-500 mt-1">
                        Gerencie como os campos desta tabela devem se comportar por padrão em novos Casos de Uso.
                      </p>
                    </div>

                    <div className="relative w-64 shrink-0">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input 
                        type="text" 
                        placeholder="Buscar campos..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-full pl-10 pr-4 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* List */}
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {filteredFields.map((field: any) => {
                        const hasCustomDefaults = field.widget_options && Object.keys(field.widget_options).length > 0;
                        
                        return (
                          <div 
                            key={field.id}
                            className="group relative bg-white dark:bg-neutral-900/40 p-5 rounded-2xl border border-neutral-100 dark:border-neutral-800 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 cursor-pointer transition-all hover:-translate-y-1 overflow-hidden"
                            onClick={() => handleOpenDrawer(field)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-white dark:bg-neutral-800 rounded-lg shadow-sm">
                                  {getFieldIcon(field.data_type)}
                                </div>
                                <span className="text-xs font-bold font-mono text-neutral-600 dark:text-neutral-400 truncate max-w-[120px]">
                                  {field.data_type}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {hasCustomDefaults && (
                                  <div className="flex items-center gap-1">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setUpdateTargetField(field)
                                        setIsUpdateModalOpen(true)
                                      }}
                                      title="Atualizar Casos de Uso"
                                      className="p-1 rounded-md text-indigo-500 hover:text-white hover:bg-indigo-600 transition-colors"
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                    </button>
                                    <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 text-[9px] font-bold rounded uppercase tracking-wider">
                                      Customizado
                                    </span>
                                  </div>
                                )}
                                <div className="w-6 h-6 bg-white dark:bg-neutral-800 rounded-full shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                                  <ArrowRight className="w-3 h-3 text-indigo-600" />
                                </div>
                              </div>
                            </div>

                            <div>
                              <p className="text-sm font-black text-neutral-900 dark:text-white truncate">
                                {field.display_name || field.db_column_name}
                              </p>
                              <p className="text-[10px] text-neutral-500 font-mono truncate">
                                {field.db_column_name}
                              </p>
                            </div>
                            
                            {/* Decorative line on hover */}
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                          </div>
                        )
                      })}
                      
                      {filteredFields.length === 0 && (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center text-center">
                          <Columns className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mb-3" />
                          <p className="text-sm font-bold text-neutral-600 dark:text-neutral-400">Nenhum campo encontrado</p>
                          <p className="text-xs text-neutral-500">Tente buscar com outro termo.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] flex flex-col items-center justify-center text-center p-10">
                  <Database className="w-16 h-16 text-neutral-200 dark:text-neutral-800 mb-4" />
                  <h3 className="text-lg font-black text-neutral-700 dark:text-neutral-300 mb-2">Selecione uma Tabela</h3>
                  <p className="text-sm text-neutral-500 max-w-sm">
                    Escolha uma tabela no menu lateral para visualizar e configurar os padrões de interface dos seus campos.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'calculated' && (
          <CalculatedFieldsTab project={project} models={models} />
        )}

        {activeTab === 'global' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ProjectLogsTab project={project} />
          </div>
        )}
      </main>

      {selectedField && (
        <FieldSettingsModal
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          workspace={workspace}
          project={project}
          field={selectedField}
          models={models}
          relations={relations}
          enumerations={enumerations}
          workspace_slug={workspace_slug}
          project_slug={project_slug}
        />
      )}

      <UpdateUseCasesModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        field={updateTargetField}
        models={models}
      />
    </>
  )
}
