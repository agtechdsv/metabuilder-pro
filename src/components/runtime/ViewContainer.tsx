'use client'

import { useState } from 'react'
import { LayoutGrid, List, Search, Filter, Plus, Pencil, Trash2, RefreshCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import DynamicGrid from '@/components/DynamicGrid'

interface ViewContainerProps {
  projectId: string
  modelName: string
  displayFields: any[]
  filterFields: any[]
  formFields: any[]
  displayType: 'list' | 'card' | 'both'
  defaultView?: 'list' | 'card'
  buttonsConfig: any[]
  locale: string
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => void
}

import DynamicCardList from './DynamicCardList'
import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Loader2 } from 'lucide-react'

export default function ViewContainer({ 
  projectId, 
  modelName, 
  displayFields, 
  filterFields = [],
  displayType = 'list',
  defaultView = 'list',
  buttonsConfig = [],
  formFields = [],
  locale,
  onView,
  onEdit,
  onDelete 
}: ViewContainerProps) {
  const [viewMode, setViewMode] = useState<'list' | 'card'>(displayType === 'both' ? defaultView : (displayType as any))
  const [searchQuery, setSearchQuery] = useState('')
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})

  const canSearch = buttonsConfig.find((b: any) => b.id === 'search')?.visible === true
  const canClear = buttonsConfig.find((b: any) => b.id === 'clear')?.visible === true
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchData = async (currentFilters: any = {}) => {
    // 1. Gera um ID único para esta requisição e limpa estados anteriores
    const queryId = crypto.randomUUID()
    const channelName = `tunnel:${projectId}`
    
    setIsLoading(true)
    setError(null)
    
    console.log(`[MetaBuilder] Iniciando busca ${queryId}...`, { table: modelName, filters: currentFilters })
    
    const channel = supabase.channel(channelName)

    // 2. Se inscreve para ouvir a resposta do Agente
    channel
      .on('broadcast', { event: `query_result_${queryId}` }, (payload) => {
        console.log(`[MetaBuilder] Resposta recebida para ${queryId}`, payload)
        if (payload.payload.success) {
          setData(payload.payload.data)
        } else {
          setError(payload.payload.error)
        }
        setIsLoading(false)
        supabase.removeChannel(channel) // Limpa após receber
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          const payload: any = {
            queryId: queryId,
            table: modelName,
            tableName: modelName,
            action: 'select',
            token: 'test-token'
          }

          if (currentFilters && Object.keys(currentFilters).length > 0) {
            payload.filters = currentFilters
          }

          // Pequeno delay para garantir que o canal de broadcast esteja "quente"
          setTimeout(() => {
            channel.send({
              type: 'broadcast',
              event: 'sql_query',
              payload
            })
          }, 200)
          
          // Timeout de segurança
          setTimeout(() => {
            setIsLoading(prev => {
              if (prev) {
                console.warn(`[MetaBuilder] Timeout na requisição ${queryId}`)
                setError('O Agente CLI não respondeu a tempo. Verifique a conexão.')
                return false
              }
              return prev
            })
          }, 10000)
        }
      })
  }

  useEffect(() => {
    fetchData()
  }, [projectId, modelName])

  const handleSearch = () => {
    fetchData(filterValues)
  }

  const handleClear = () => {
    setFilterValues({})
    fetchData({}) // Pesquisa sem filtros
  }

  const t = {
    pt: {
      search: 'Buscar registros...',
      filters: 'Filtros',
      mapped: 'colunas mapeadas',
      actions: 'Ações',
      edit: 'Editar',
      delete: 'Excluir',
      no_results: 'Nenhum registro encontrado.'
    },
    en: {
      search: 'Search records...',
      filters: 'Filters',
      mapped: 'columns mapped',
      actions: 'Actions',
      edit: 'Edit',
      delete: 'Delete',
      no_results: 'No records found.'
    }
  }[locale as 'pt' | 'en'] || {
    search: 'Search records...',
    filters: 'Filters',
    mapped: 'columns mapped',
    actions: 'Actions',
    edit: 'Edit',
    delete: 'Delete',
    no_results: 'No records found.'
  }

  return (
    <div className="space-y-8">
      {/* Toolbar - Minimalist, only showing view toggles if both are available */}
      <div className="flex flex-col md:flex-row md:items-center justify-end gap-6">
        <div className="flex items-center gap-4">
          {/* View Toggles (Only if displayType is 'both') */}
          {displayType === 'both' && (
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-900/50 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800">
              {/* Se o padrão for card, o card vem primeiro. Se for list, a list vem primeiro. */}
              {defaultView === 'card' ? (
                <>
                  <button 
                    onClick={() => setViewMode('card')}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      viewMode === 'card' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                    )}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      viewMode === 'list' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                    )}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      viewMode === 'list' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                    )}
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('card')}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      viewMode === 'card' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                    )}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Filter Arguments Bar with integrated Search Button */}
      {filterFields.length > 0 && (
        <div className="p-6 bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-inner">
          <div className="flex flex-col lg:flex-row items-end gap-6">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
              {filterFields.map(field => (
                <div key={field.id} className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">
                    {field.display_name}
                  </label>
                  <div className="relative group">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                      type="text" 
                      placeholder={`Filtrar por ${field.display_name}...`}
                      value={filterValues[field.db_column_name] || ''}
                      onChange={e => setFilterValues({ ...filterValues, [field.db_column_name]: e.target.value })}
                      className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm outline-none focus:border-indigo-500 transition-all shadow-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex items-center gap-3 mb-[1px]">
              {canSearch && (
                <button 
                  onClick={handleSearch}
                  className="h-[42px] px-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  Pesquisar
                </button>
              )}

              {canClear && (
                <button 
                  onClick={handleClear}
                  className="h-[42px] px-6 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm flex items-center gap-2"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Data Display */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-neutral-400 bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem]">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
          <div className="text-center">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-200">Conectando ao banco...</h3>
            <p className="text-sm">Buscando dados via Túnel Seguro.</p>
          </div>
        </div>
      ) : error ? (
        <div className="py-20 text-center bg-red-50/10 border border-red-500/20 rounded-[2rem]">
           <p className="text-red-500 font-bold">{error}</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] overflow-hidden shadow-xl dark:shadow-none backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800">
                  <th className="px-8 py-5 w-12">
                    <input type="checkbox" className="rounded-md bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-indigo-600 focus:ring-indigo-500 transition-all" />
                  </th>
                  {displayFields.map((field) => (
                    <th 
                      key={field.id} 
                      className="px-6 py-5 text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.15em] whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        {field.display_name}
                        {field.is_primary_key && <span className="text-indigo-500" title="Chave Primária">🔑</span>}
                      </div>
                    </th>
                  ))}
                  <th className="px-8 py-5 text-right text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.15em]">
                    {t.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                <DynamicGrid 
                  fields={displayFields} 
                  data={data}
                  buttonsConfig={buttonsConfig}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <DynamicCardList 
            fields={displayFields}
            data={data}
            buttonsConfig={buttonsConfig}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      )}
    </div>
  )
}
