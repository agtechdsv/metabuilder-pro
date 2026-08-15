'use client'

import { Database, Share2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Model, Relation, StepBaseProps } from '../types'
import { useI18n } from '@/i18n'

interface StepTablesProps extends StepBaseProps {
  models: Model[]
  relations?: Relation[]
}

export function StepTables({ config, setConfig, models, relations = [] }: StepTablesProps) {
  const { t } = useI18n()

  // Count direct relations per model
  const relationCountByModel = models.reduce<Record<string, number>>((acc, m) => {
    acc[m.id] = relations.filter(r =>
      r.foreign_table_id === m.id || r.referenced_table_id === m.id
    ).length
    return acc
  }, {})

  const groupedModels = models.reduce<Record<string, Model[]>>((acc, m) => {
    const schema = m.db_schema_name || 'public'
    if (!acc[schema]) acc[schema] = []
    acc[schema].push(m)
    return acc
  }, {})

  const selectedId = config.selected_models[0] || null

  const selectModel = (m: Model) => {
    setConfig({
      ...config,
      selected_models: [m.id],
      layout_config: {
        ...config.layout_config,
        master_model_id: m.id,
        filter_fields: [],
        grid_fields: [],
        form_fields: [],
        joins: []
      }
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="space-y-2">
        <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
          {t('wizard.tables.title', 'Qual é a tabela principal deste caso de uso?')}
        </h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">
          {t('wizard.tables.desc', 'Selecione uma tabela como raiz. Na próxima etapa, todos os campos das tabelas relacionadas estarão disponíveis automaticamente.')}
        </p>
      </div>

      {/* Santo Graal info callout */}
      <div className="flex items-start gap-3 p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl">
        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex-shrink-0 mt-0.5">
          <Share2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400 mb-1">
              {t('wizard.tables.santo_graal_active', 'Santo Graal ativo')}
            </p>
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 leading-relaxed">
              {t('wizard.tables.santo_graal_desc', 'O sistema detecta automaticamente todas as tabelas relacionadas à tabela raiz e disponibiliza seus campos na etapa seguinte. Você não precisa selecionar manualmente as tabelas de JOIN.')}
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/50 w-fit">
            <label className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
              {t('wizard.tables.max_depth_label', 'Profundidade Máxima (Níveis)')}
            </label>
            <select
              value={config.layout_config?.max_relation_depth || 2}
              onChange={e => setConfig({
                ...config,
                layout_config: { ...config.layout_config, max_relation_depth: parseInt(e.target.value, 10) }
              })}
              className="text-xs bg-white dark:bg-neutral-900 border border-indigo-200 dark:border-indigo-800 rounded px-2 py-1 outline-none text-indigo-900 dark:text-indigo-300 cursor-pointer"
            >
              <option value={1}>{t('wizard.tables.depth_1', '1 Nível (Apenas Relacionamentos Diretos)')}</option>
              <option value={2}>{t('wizard.tables.depth_2', '2 Níveis (Padrão - Inclui Nível 2)')}</option>
              <option value={3}>{t('wizard.tables.depth_3', '3 Níveis (Profundo)')}</option>
              <option value={4}>{t('wizard.tables.depth_4', '4 Níveis (Extremo - Pode causar lentidão)')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Model grid grouped by schema */}
      <div className="space-y-10">
        {Object.keys(groupedModels).map(schema => (
          <div key={schema} className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 flex items-center gap-2">
              <Database className="w-4 h-4" />
              {t('wizard.tables.db_prefix', 'Banco')}: {schema}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {groupedModels[schema].map(m => {
                const isSelected = selectedId === m.id
                const relCount = relationCountByModel[m.id] || 0
                return (
                  <button
                    key={m.id}
                    onClick={() => selectModel(m)}
                    className={cn(
                      "p-4 rounded-[1.5rem] border-2 text-left transition-all relative group hover:-translate-y-1",
                      isSelected
                        ? 'border-indigo-600 bg-indigo-600/5 shadow-xl shadow-indigo-500/10'
                        : 'border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900/30'
                    )}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full transition-colors ${isSelected ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:group-hover:bg-indigo-900/30 dark:group-hover:text-indigo-400'}`}>
                        <Database className="w-3 h-3" />
                        {m.db_schema_name || 'public'}
                      </div>
                      {isSelected ? (
                        <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-500/40">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-neutral-200 dark:border-neutral-700 group-hover:border-indigo-300 transition-colors" />
                      )}
                    </div>
                    <h4 className="font-bold text-base text-neutral-900 dark:text-white leading-tight">{m.display_name || m.db_table_name}</h4>
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono mt-1 uppercase tracking-widest block">{m.db_table_name}</p>
                    {relCount > 0 && (
                      <div className="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800/40 flex items-center gap-1.5">
                        <Share2 className="w-2.5 h-2.5 text-neutral-400" />
                        <span className="text-[9px] text-neutral-400 font-bold">
                          {relCount} {relCount === 1 ? t('wizard.tables.relation_single', 'relacionamento') : t('wizard.tables.relation_plural', 'relacionamentos')}
                        </span>
                      </div>
                    )}
                    {m.description && (
                      <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-2 line-clamp-2 leading-normal border-t border-neutral-100 dark:border-neutral-800/40 pt-1.5">
                        {m.description}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Selection confirmation */}
      {selectedId && (() => {
        const selModel = models.find(m => m.id === selectedId)
        const relCount = relationCountByModel[selectedId] || 0
        const selName = selModel?.display_name || selModel?.db_table_name || ''
        return (
          <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest">
                {t('wizard.tables.selected_as_root', '{name} selecionada como tabela raiz').replace('{name}', selName)}
              </p>
              {relCount > 0 && (
                <p className="text-[10px] mt-0.5 opacity-80">
                  {t('wizard.tables.auto_discovered_desc', '{count} tabela(s) relacionada(s) será(ão) descoberta(s) automaticamente na próxima etapa.').replace('{count}', String(relCount))}
                </p>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

