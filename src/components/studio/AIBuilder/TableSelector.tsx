'use client'

import { useState, useEffect } from 'react'
import { Database, Plus, X, Check, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

interface TableSelectorProps {
  projectId: string
  selectedTables: any[]
  onSelectTable: (tables: any[]) => void
  newTables: string[]
  onChangeNewTables: (tables: string[]) => void
}

export function TableSelector({
  projectId,
  selectedTables,
  onSelectTable,
  newTables,
  onChangeNewTables,
}: TableSelectorProps) {
  const { t } = useI18n()
  const [models, setModels] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set())
  const [newTableInput, setNewTableInput] = useState('')
  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing')

  useEffect(() => {
    fetchModels()
  }, [projectId])

  const fetchModels = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/ai-builder/tables?project_id=${projectId}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.error) {
        setModels([{ id: 'error', display_name: `API Error: ${data.error}` }])
      } else if (!data.models || data.models.length === 0) {
        setModels([{ id: 'empty', display_name: `Empty response from API (Status: ${res.status})` }])
      } else {
        setModels(data.models)
      }
    } catch (e: any) {
      setModels([{ id: 'error', display_name: `Catch Error: ${e.message}` }])
    } finally {
      setIsLoading(false)
    }
  }

  const isSelected = (model: any) => selectedTables.some((t) => t.id === model.id)

  const toggleTable = (model: any) => {
    if (isSelected(model)) {
      onSelectTable(selectedTables.filter((t) => t.id !== model.id))
    } else {
      onSelectTable([...selectedTables, model])
    }
  }

  const toggleExpand = (id: string) => {
    const next = new Set(expandedModels)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedModels(next)
  }

  const addNewTable = () => {
    const name = newTableInput.trim().replace(/[^a-z0-9_]/gi, '_').toLowerCase()
    if (!name || newTables.includes(name)) return
    onChangeNewTables([...newTables, name])
    setNewTableInput('')
  }

  const removeNewTable = (name: string) => {
    onChangeNewTables(newTables.filter((t) => t !== name))
  }

  const totalSelected = selectedTables.length + newTables.length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h4 className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-wider">
          {t('ai_builder.table_context_title', 'Contexto do Banco')}
        </h4>
        <p className="text-xs text-neutral-400 mt-0.5">
          {t('ai_builder.table_context_subtitle', 'Selecione as tabelas que o caso de uso vai usar')}
        </p>
        {totalSelected > 0 && (
          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 rounded-full text-xs font-bold">
            {t('ai_builder.tables_in_context', '{count} tabela(s) no contexto').replace('{count}', totalSelected.toString())}
          </div>
        )}
      </div>

      {/* Abas */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setActiveTab('existing')}
          className={`flex-1 pb-2 text-xs font-bold transition-colors ${
            activeTab === 'existing'
              ? 'text-violet-600 border-b-2 border-violet-600'
              : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
          }`}
        >
          {t('ai_builder.tab_existing', 'Existentes')}
        </button>
        <button
          onClick={() => setActiveTab('new')}
          className={`flex-1 pb-2 text-xs font-bold transition-colors ${
            activeTab === 'new'
              ? 'text-amber-600 border-b-2 border-amber-600'
              : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
          }`}
        >
          {t('ai_builder.tab_new', 'Novas')}
        </button>
      </div>

      {/* Tabelas Existentes */}
      {activeTab === 'existing' && (
        <div className="space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
            </div>
          ) : models.length === 0 ? (
            <div className="text-center py-6">
              <Database className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />
              <p className="text-xs text-neutral-400">{t('ai_builder.no_synced_tables', 'Nenhuma tabela sincronizada.')}</p>
              <p className="text-xs text-neutral-400">{t('ai_builder.sync_first_hint', 'Sincronize o banco no Studio primeiro.')}</p>
            </div>
          ) : (
            models.map((model) => {
              const selected = isSelected(model)
              const expanded = expandedModels.has(model.id)
              const fieldCount = model.fields?.length || 0
              const fieldLabel = fieldCount === 1
                ? t('ai_builder.fields_count_single', '{count} campo').replace('{count}', fieldCount.toString())
                : t('ai_builder.fields_count_plural', '{count} campos').replace('{count}', fieldCount.toString())

              if (model.id === 'error' || model.id === 'empty') {
                return (
                  <div key={model.id} className="rounded-xl overflow-hidden border border-red-200 bg-red-50 p-3">
                    <p className="text-xs font-bold text-red-700">{model.display_name}</p>
                  </div>
                )
              }

              return (
                <div key={model.id} className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
                  <div
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                      selected
                        ? 'bg-violet-50 dark:bg-violet-500/10'
                        : 'bg-white dark:bg-neutral-900/40 hover:bg-neutral-50 dark:hover:bg-neutral-900'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleTable(model)}
                      className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                        selected
                          ? 'bg-violet-600 border-violet-600'
                          : 'border-neutral-300 dark:border-neutral-700'
                      }`}
                    >
                      {selected && <Check className="w-2.5 h-2.5 text-white" />}
                    </button>

                    {/* Nome */}
                    <button
                      onClick={() => toggleTable(model)}
                      className="flex-grow text-left"
                    >
                      <p className={`text-xs font-bold ${selected ? 'text-violet-700 dark:text-violet-300' : 'text-neutral-700 dark:text-neutral-300'}`}>
                        {model.db_table_name}
                      </p>
                      <p className="text-xs text-neutral-400">{fieldLabel}</p>
                    </button>

                    {/* Expand */}
                    {fieldCount > 0 && (
                      <button
                        onClick={() => toggleExpand(model.id)}
                        className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                      >
                        {expanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Campos expandidos */}
                  {expanded && model.fields && (
                    <div className="px-3 pb-2 bg-neutral-50 dark:bg-neutral-950/50 border-t border-neutral-200 dark:border-neutral-800">
                      <div className="pt-2 space-y-0.5">
                        {model.fields.map((f: any) => (
                          <div key={f.id} className="flex justify-between text-xs">
                            <span className="text-neutral-600 dark:text-neutral-400 font-mono">
                              {f.db_column_name || f.name}
                            </span>
                            <span className="text-neutral-400 dark:text-neutral-600">
                              {f.field_type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Novas Tabelas */}
      {activeTab === 'new' && (
        <div className="space-y-3">
          <p className="text-xs text-neutral-400 leading-relaxed">
            {t('ai_builder.new_tables_desc', 'Informe o nome das tabelas que precisam ser criadas. A IA vai gerar o SQL de migração para você.')}
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={newTableInput}
              onChange={(e) => setNewTableInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNewTable()}
              placeholder={t('ai_builder.new_table_placeholder', 'nome_da_tabela')}
              className="flex-grow px-3 py-2 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-neutral-900 dark:text-white font-mono"
            />
            <button
              onClick={addNewTable}
              disabled={!newTableInput.trim()}
              className="w-8 h-8 flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {newTables.length > 0 && (
            <div className="space-y-1.5">
              {newTables.map((tItem, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                  <span className="text-xs font-mono text-amber-700 dark:text-amber-300">✨ {tItem}</span>
                  <button
                    onClick={() => removeNewTable(tItem)}
                    className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {newTables.length === 0 && (
            <div className="text-center py-4">
              <p className="text-xs text-neutral-400">{t('ai_builder.no_new_tables', 'Nenhuma tabela nova adicionada.')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
