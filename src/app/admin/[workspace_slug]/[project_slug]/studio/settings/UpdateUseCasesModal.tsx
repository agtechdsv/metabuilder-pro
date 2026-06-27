'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { RefreshCw, CheckSquare, Square, LayoutTemplate, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createDefaultFieldMeta } from '@/components/studio/UseCaseBuilder/utils'

interface UpdateUseCasesModalProps {
  isOpen: boolean
  onClose: () => void
  field: any
  models: any[]
  project: any
}

export function UpdateUseCasesModal({ isOpen, onClose, field, models, project }: UpdateUseCasesModalProps) {
  const { toast } = useToast()
  const supabase = createClient()
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [useCases, setUseCases] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isOpen || !field || !project) return

    const loadUseCases = async () => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase
          .from('ui_views')
          .select('*')
          .eq('project_id', project.id)
          
        if (error) throw error

        const relevantUseCases = (data || []).filter((uc: any) => {
          const cfg = uc.draft_config?.layout_config || uc.layout_config
          if (!cfg) return false
          
          const inForm = (cfg.form_fields || []).includes(field.id)
          const inGrid = (cfg.grid_fields || []).includes(field.id)
          const inFilter = (cfg.filter_fields || []).includes(field.id)
          const inMeta = cfg.fields_metadata && cfg.fields_metadata[field.id]

          return inForm || inGrid || inFilter || inMeta
        })

        setUseCases(relevantUseCases)
        setSelectedIds(new Set(relevantUseCases.map((uc: any) => uc.id)))
      } catch (error) {
        console.error('Error loading use cases:', error)
        toast('Erro ao buscar casos de uso.', 'error')
      } finally {
        setIsLoading(false)
      }
    }

    loadUseCases()
  }, [isOpen, field, supabase, toast])

  const handleToggleSelectAll = () => {
    if (selectedIds.size === useCases.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(useCases.map(uc => uc.id)))
    }
  }

  const handleToggleUseCase = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const handleConfirm = async () => {
    if (selectedIds.size === 0) {
      toast('Selecione ao menos um caso de uso.', 'info')
      return
    }

    setIsSaving(true)
    try {
      const selectedUCs = useCases.filter(uc => selectedIds.has(uc.id))
      const newFieldMeta = createDefaultFieldMeta(field.id, models)

      for (const uc of selectedUCs) {
        const currentDraft = uc.draft_config || {
          name: uc.name,
          slug: uc.slug,
          logic_type: uc.logic_type,
          has_arguments: uc.has_arguments,
          tables_config: uc.tables_config,
          query_type: uc.query_type,
          custom_query: uc.custom_query,
          layout_config: uc.layout_config || {},
          buttons_config: uc.buttons_config,
          model_id: uc.model_id,
          project_id: uc.project_id,
          view_type: uc.view_type
        }
        const layoutConfig = currentDraft.layout_config || {}
        const fieldsMetadata = layoutConfig.fields_metadata || {}

        const updatedDraft = {
          ...currentDraft,
          layout_config: {
            ...layoutConfig,
            fields_metadata: {
              ...fieldsMetadata,
              [field.id]: newFieldMeta
            }
          }
        }

        const { error } = await supabase
          .from('ui_views')
          .update({ draft_config: updatedDraft })
          .eq('id', uc.id)

        if (error) throw error
      }

      toast(`${selectedUCs.length} Caso(s) de Uso atualizado(s) com sucesso!`, 'success')
      onClose()
    } catch (error) {
      console.error('Error updating use cases:', error)
      toast('Erro ao atualizar os casos de uso.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (!field) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sincronizar Casos de Uso"
      hideHeader
      size="2xl"
    >
      <div className="flex flex-col h-[85vh] bg-[#f8f9fc] dark:bg-[#030303] overflow-hidden rounded-[2rem]">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-[#080808]/80 backdrop-blur-xl px-10 py-6 border-b border-neutral-200 dark:border-neutral-800 space-y-4 rounded-t-[2rem]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-neutral-900 dark:text-white">
                  Atualizar Casos de Uso
                </h2>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                  Propagar os defaults de <span className="font-bold text-indigo-600">{field.display_name || field.db_column_name}</span> para os Rascunhos selecionados.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleConfirm}
                disabled={isSaving || selectedIds.size === 0}
                className="flex items-center gap-2 px-6 h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {isSaving ? 'Atualizando...' : 'Confirmar Atualização'}
              </button>
              <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-800 hidden sm:block"></div>
              <button
                onClick={onClose}
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-900 text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral-400 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-xs font-bold uppercase tracking-widest">Buscando Casos de Uso...</p>
            </div>
          ) : useCases.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral-400 gap-4">
              <LayoutTemplate className="w-12 h-12 opacity-50" />
              <div className="text-center">
                <p className="text-sm font-bold text-neutral-600 dark:text-neutral-300">Nenhum caso de uso encontrado.</p>
                <p className="text-xs mt-1">Este campo ainda não está sendo utilizado em nenhum rascunho de caso de uso.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
                <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                  Casos de Uso Encontrados ({useCases.length})
                </h3>
                <button
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  {selectedIds.size === useCases.length ? (
                    <><CheckSquare className="w-4 h-4" /> Desselecionar Todos</>
                  ) : (
                    <><Square className="w-4 h-4" /> Selecionar Todos</>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {useCases.map((uc) => (
                  <div
                    key={uc.id}
                    onClick={() => handleToggleUseCase(uc.id)}
                    className={cn(
                      "flex items-center gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all",
                      selectedIds.has(uc.id)
                        ? "bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-500 shadow-md shadow-indigo-500/10"
                        : "bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 hover:border-indigo-300 dark:hover:border-indigo-800"
                    )}
                  >
                    <div className={cn(
                      "flex-shrink-0 transition-colors",
                      selectedIds.has(uc.id) ? "text-indigo-600" : "text-neutral-300 dark:text-neutral-700"
                    )}>
                      {selectedIds.has(uc.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-neutral-900 dark:text-white truncate">
                        {uc.name}
                      </h4>
                      <p className="text-[10px] font-mono text-neutral-500 truncate mt-0.5">
                        /{uc.slug}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
