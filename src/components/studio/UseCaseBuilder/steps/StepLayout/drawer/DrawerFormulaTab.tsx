'use client'

import React from 'react'
import FormulaBuilder from '../../../../FormulaBuilder'
import { getModelsWithRelations } from '@/lib/relationPathFinder'

interface DrawerFormulaTabProps {
  currentFieldMeta: any
  updateMeta: (section: string, field: string, value: any) => void
  models: any[]
  relations: any[]
  config: any
  editingFieldId: string
  t: (key: string, fallback?: string) => string
}

export function DrawerFormulaTab({
  currentFieldMeta,
  updateMeta,
  models,
  relations,
  config,
  editingFieldId,
  t
}: DrawerFormulaTabProps) {
  const availableFields = [
    ...getModelsWithRelations(
      models?.filter((m: any) => config.selected_models?.includes(m.id)) || [],
      relations,
      models,
      config.layout_config?.max_relation_depth || 2
    ).flatMap((g: any) =>
      (g.model.fields || []).map((f: any) => ({
        id: f.id,
        modelName: g.label,
        db_column_name: g.prefix ? `${g.prefix}${f.db_column_name}` : f.db_column_name,
        display_name: f.display_name,
      }))
    ),
    ...(config.layout_config?.form_fields || [])
      .filter((fid: string) => fid.startsWith('virt_') && fid !== editingFieldId)
      .map((fid: string) => {
        const meta = config.layout_config?.fields_metadata?.[fid] || {}
        const virtModelId = meta.virtual_model_id
        let vModelName = 'Virtual'
        let vDbTable = ''
        if (virtModelId) {
          const foundModel = models?.find((m: any) => m.id === virtModelId)
          if (foundModel) {
            vModelName = foundModel.display_name || foundModel.name
            vDbTable = foundModel.db_table_name
          }
        }

        const isMaster =
          !virtModelId ||
          virtModelId === (config.layout_config?.master_model_id || config.selected_models?.[0])
        const dbColName = isMaster ? fid : `${vDbTable}.${fid}`

        return {
          id: fid,
          modelName: vModelName,
          db_column_name: dbColName,
          display_name: meta.label?.text || 'Campo Calculado',
          isVirtual: true,
        }
      }),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 bg-indigo-600 rounded-full" />
          <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest">
            {t('wizard.layout.drawer.formula_title', 'Cálculos e Fórmulas')}
          </h4>
        </div>
        <FormulaBuilder
          value={currentFieldMeta.content?.formula_tokens || []}
          onChange={(tokens) => {
            updateMeta('content', 'formula_tokens', tokens)
          }}
          availableFields={availableFields}
        />
      </div>
    </div>
  )
}
