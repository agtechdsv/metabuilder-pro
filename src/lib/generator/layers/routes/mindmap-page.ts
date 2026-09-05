import { RouteNode } from '../../ast'
import { renderFormField, getByocComponentName, toPascalCase } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// MindMap Page (Server Component)
// ─────────────────────────────────────────────────────────────────────────────

export function generateMindMapPage(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const hasCreate = route.buttons.some(b => b.actionType === 'create') || route.buttons.length === 0

  // Detecta tabelas relacionadas para lookups
  const lookupModels = new Map<string, string>()
  const allFields = [
    ...(route.filterFields || []),
    ...(route.gridFields || []),
    ...(route.formFields || []),
  ]

  allFields.forEach(f => {
    const targetModel = f.config?.relation?.targetModel || (f as any).relation?.targetModel
    const targetTable = f.config?.relation?.targetTable || f.config?.component?.rel_table || f.config?.rel_table
    if (targetModel && targetTable) {
      lookupModels.set(targetTable.toLowerCase(), targetModel)
    } else if (targetTable && !targetTable.includes('-') && targetTable.length < 30) {
      const modelName = toPascalCase(targetTable)
      lookupModels.set(targetTable.toLowerCase(), modelName)
    } else if (f.dbColumn.endsWith('_id') && !f.isPrimaryKey) {
      const base = f.dbColumn.slice(0, -3)
      const table = base.endsWith('s') ? base : (base + 's')
      const modelName = toPascalCase(table)
      lookupModels.set(table.toLowerCase(), modelName)
    }
  })

  lookupModels.delete(mnLower)

  const lookupImports = Array.from(lookupModels.entries()).map(([table, modelName]) =>
    `import { get${modelName}List } from '@/app/actions/${table}'`
  ).join('\n')

  const lookupQueries = Array.from(lookupModels.entries()).map(([table, modelName]) =>
    `  const ${table}LookupList = await get${modelName}List().catch(() => [])`
  ).join('\n')

  const buildOptionsCode: string[] = []
  allFields.forEach(f => {
    const targetTable = f.config?.relation?.targetTable || f.config?.component?.rel_table || f.config?.rel_table || (f.dbColumn.endsWith('_id') ? (f.dbColumn.slice(0, -3).endsWith('s') ? f.dbColumn.slice(0, -3) : f.dbColumn.slice(0, -3) + 's') : null)
    if (targetTable && lookupModels.has(targetTable.toLowerCase())) {
      const t = targetTable.toLowerCase()
      const relLabel = f.config?.component?.rel_label || f.config?.relation?.displayColumn || f.config?.rel_label
      const relValue = f.config?.component?.rel_value || f.config?.relation?.valueColumn || f.config?.rel_value || 'id'
      const labelExpr = relLabel
        ? `r[${JSON.stringify(relLabel)}] ?? r[${JSON.stringify(relLabel.toLowerCase())}] ?? r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
        : `r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
      const valueExpr = `r[${JSON.stringify(relValue)}] ?? r[${JSON.stringify(relValue.toLowerCase())}] ?? r.id ?? Object.values(r)[0] ?? ''`
      buildOptionsCode.push(`    '${f.dbColumn}': (${t}LookupList || []).map((r: any) => ({ value: String(${valueExpr}), label: String(${labelExpr}) })),`)
    } else if (f.config?.options && Array.isArray(f.config.options) && f.config.options.length > 0) {
      buildOptionsCode.push(`    '${f.dbColumn}': ${JSON.stringify(f.config.options)},`)
    }
  })

  return `import { get${mn}List } from '@/app/actions/${mnLower}'
${lookupImports ? `${lookupImports}\n` : ''}import { MindMapClient } from './MindMapClient'
import { DynamicIcon } from '@/app/components/DynamicIcon'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ${mn}MindMapPage(props: {
  searchParams?: Promise<Record<string, string | undefined>>
}) {
  const searchParams = props.searchParams ? await props.searchParams : {}
  const data = await get${mn}List().catch(() => [])
${lookupQueries ? `${lookupQueries}\n` : ''}
  const relationalOptions: Record<string, Array<{ value: string; label: string }>> = {
${buildOptionsCode.join('\n')}
  }

  return (
    <div className="space-y-6">
      {/* Header Padrão MetaBuilder RuntimeHeader */}
      <div className="px-6 sm:px-10 py-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-purple-600 rounded-2xl shadow-lg shadow-purple-500/20 text-white shrink-0">
            <DynamicIcon icon="${route.icon || 'Share2'}" size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
              ${route.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-8 h-1 bg-purple-600 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                MAPA MENTAL &bull; {data.length} {data.length === 1 ? 'REGISTRO' : 'REGISTROS'}
              </span>
            </div>
          </div>
        </div>

        {/* Botão Novo Registro */}
        ${hasCreate ? `<div className="flex items-center gap-3">
          <Link
            href="${route.path}/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-purple-500/20 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Registro</span>
          </Link>
        </div>` : ''}
      </div>

      {/* MindMap Interactive Orbital Canvas */}
      <div className="px-6 sm:px-10">
        <MindMapClient
          initialData={data}
          relationalOptions={relationalOptions}
          initialParams={searchParams}
        />
      </div>
    </div>
  )
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// MindMap Schema ([route]/schema.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function generateMindMapSchema(route: RouteNode): string {
  const mn = route.modelName
  const mc = route.mindmapConfig || {
    hierarchyFields: route.gridFields.filter(f => !f.isPrimaryKey && !f.isVirtual && !f.isByoc).map(f => f.dbColumn),
  }

  const rawFilterFields = route.filterFields && route.filterFields.length > 0
    ? route.filterFields
    : route.gridFields.filter(f => !f.isPrimaryKey && !f.isVirtual && !f.isByoc).slice(0, 3)

  const filterFieldsData = JSON.stringify(
    rawFilterFields.map(f => ({
      id: f.id,
      dbColumn: f.dbColumn,
      label: f.label,
      dataType: f.dataType,
      config: f.config,
    })),
    null,
    2
  )

  const fieldsData = JSON.stringify(
    route.gridFields.map(f => ({
      id: f.id,
      dbColumn: f.dbColumn,
      label: f.label,
      dataType: f.dataType,
      config: f.config,
    })),
    null,
    2
  )

  const mindmapConfigData = JSON.stringify(mc, null, 2)

  const zodFields = route.formFields.map(f => {
    let zType = 'z.any().optional()'
    if (f.dataType === 'number' || f.dataType === 'integer' || f.dataType === 'decimal') {
      zType = 'z.coerce.number().optional()'
    } else if (f.dataType === 'boolean') {
      zType = 'z.boolean().optional()'
    } else {
      zType = 'z.string().optional()'
    }
    return `  ${f.dbColumn}: ${zType},`
  }).join('\n')

  return `// ─────────────────────────────────────────────────────────────────────────────
// Schemas e configurações declarativas para Mapa Mental de ${route.title}
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'

export const filterFields = ${filterFieldsData}

export const fields = ${fieldsData}

export const mindmapConfig = ${mindmapConfigData}

export const ${mn}Schema = z.object({
${zodFields}
})

export type ${mn}FormData = z.infer<typeof ${mn}Schema>
`
}

// ─────────────────────────────────────────────────────────────────────────────
// MindMap Client Component ([route]/MindMapClient.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export function generateMindMapClient(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const pk = route.primaryKey || 'id'
  const isActionModal = route.actionInterfaceType === 'modal'
    || route.rawLayoutConfig?.action_interface_type === 'modal'

  const modalFormFieldsHtml = route.formFields
    .map(f => renderFormField(f, true, false, 'relationalOptions'))
    .filter(Boolean)
    .join('\n')

  const byocImports = route.formFields
    .filter(f => f.isByoc || f.dataType === 'byoc' || f.id.startsWith('byoc_'))
    .map(f => getByocComponentName(f))
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .map(name => `import { ${name} } from '@/components/${name}'`)
    .join('\n')

  const modalStateVars = isActionModal ? `  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('edit')
  const [activeRecord, setActiveRecord] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)` : ''

  const handleAddBody = isActionModal
    ? `    setActiveRecord({})
    setModalMode('create')
    setIsModalOpen(true)`
    : `    router.push('${route.path}/new')`

  const handleEditBody = isActionModal
    ? `    setActiveRecord(row)
    setModalMode('edit')
    setIsModalOpen(true)`
    : `    const recordId = String(row.${pk} || row.id)
    router.push(\`${route.path}/\${recordId}\`)`

  const handleViewBody = isActionModal
    ? `    handleEdit(row)`
    : `    const recordId = String(row.${pk} || row.id)
    router.push(\`${route.path}/\${recordId}\`)`

  const modalSaveHandler = isActionModal ? `  const handleSaveRecord = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const formData = new FormData(e.currentTarget)
      const payload: Record<string, any> = {}
      formData.forEach((val, key) => {
        payload[key] = val === '' ? null : val
      })

      if (modalMode === 'edit' && activeRecord) {
        const recordId = String(activeRecord.${pk} || activeRecord.id)
        await update${mn}(recordId, payload)
        setDataList(prev => prev.map(item =>
          String(item.${pk} || item.id) === recordId ? { ...item, ...payload } : item
        ))
      } else {
        const res = await create${mn}(payload)
        if (res) setDataList(prev => [res, ...prev])
      }
      setIsModalOpen(false)
      setActiveRecord(null)
      router.refresh()
    } catch (err: any) {
      console.error('Erro ao salvar registro:', err)
      alert('Erro ao salvar: ' + (err?.message || err))
    } finally {
      setIsSaving(false)
    }
  }

  const data = activeRecord
  const isEdit = modalMode === 'edit'` : ''

  const modalJsx = isActionModal ? `
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 sm:p-8 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                    {modalMode === 'edit' ? 'Editar Registro' : 'Novo Registro no Mapa'}
                  </h2>
                  <p className="text-xs font-medium text-neutral-400 mt-0.5 font-mono">
                    {modalMode === 'edit'
                      ? ('Registro #' + (activeRecord?.${pk} || activeRecord?.id || ''))
                      : 'Preencha os dados cadastrais'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
${modalFormFieldsHtml}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 sm:p-8 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Salvando...' : 'Salvar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}` : ''

  return `'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { update${mn}, delete${mn}, create${mn} } from '@/app/actions/${mnLower}'
import { fields, mindmapConfig } from './schema'
${byocImports ? `${byocImports}\n` : ''}import { Pencil, X, Save } from 'lucide-react'

// Carregamento dinâmico sem SSR para segurança do Framer Motion e renderização no cliente
const MindMapBoard = dynamic(
  () => import('@/components/MindMapBoard').then(mod => mod.MindMapBoard),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[650px] flex flex-col items-center justify-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 space-y-4">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
          Carregando mapa mental...
        </p>
      </div>
    ),
  }
)

export function MindMapClient({
  initialData,
  relationalOptions = {},
  initialParams = {},
}: {
  initialData: any[]
  relationalOptions?: Record<string, Array<{ value: string; label: string }>>
  initialParams?: Record<string, string | undefined>
}) {
  const router = useRouter()
  const [dataList, setDataList] = useState<any[]>(initialData)

${modalStateVars}

  useEffect(() => {
    setDataList(initialData)
  }, [initialData])

  const handleDelete = async (row: any) => {
    const recordId = String(row.${pk} || row.id)
    setDataList(prev => prev.filter(item => String(item.${pk} || item.id) !== recordId))
    await delete${mn}(recordId)
    router.refresh()
  }

  const handleAdd = () => {
${handleAddBody}
  }

  const handleEdit = (row: any) => {
${handleEditBody}
  }

  const handleView = (row: any) => {
${handleViewBody}
  }

${modalSaveHandler}

  return (
    <div className="space-y-6">
      <MindMapBoard
        data={dataList}
        fields={fields}
        mindmapConfig={mindmapConfig}
        relationalOptions={relationalOptions}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
${modalJsx}
    </div>
  )
}
`
}
