import { RouteNode } from '../../ast'
import { renderFormField, getByocComponentName, toPascalCase } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler Page (Server Component)
// ─────────────────────────────────────────────────────────────────────────────

export function generateSchedulerPage(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const hasCreate = route.buttons.some(b => b.actionType === 'create') || route.buttons.length === 0

  // Detecta todas as tabelas relacionadas necessárias para lookups dos filtros e cards
  const lookupModels = new Map<string, string>() // table -> modelName
  const allSchedulerFields = [...(route.filterFields || []), ...(route.gridFields || [])]
  allSchedulerFields.forEach(f => {
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

  // Remove o próprio modelo se acidentalmente incluído
  lookupModels.delete(mnLower)

  const lookupImports = Array.from(lookupModels.entries()).map(([table, modelName]) =>
    `import { get${modelName}List } from '@/app/actions/${table}'`
  ).join('\n')

  const lookupQueries = Array.from(lookupModels.entries()).map(([table, modelName]) =>
    `  const ${table}LookupList = await get${modelName}List().catch(() => [])`
  ).join('\n')

  const buildOptionsCode: string[] = []
  allSchedulerFields.forEach(f => {
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

  // Filtros
  const filterFields = route.filterFields.length > 0
    ? route.filterFields
    : route.gridFields.filter(f => !f.isPrimaryKey && !f.isVirtual && !f.isByoc).slice(0, 3)

  const relationalFilterComponents: string[] = []

  const filterInputs = filterFields.map(f => {
    const col = f.dbColumn.replace('.', '_')
    const gridSpan = f.config?.gridSpan || f.config?.component?.gridSpan || 3
    const colSpanClass = `col-span-12 md:col-span-${Math.min(12, gridSpan || 3)}`

    const targetTable = f.config?.relation?.targetTable || f.config?.component?.rel_table || f.config?.rel_table || (f.dbColumn.endsWith('_id') ? (f.dbColumn.slice(0, -3).endsWith('s') ? f.dbColumn.slice(0, -3) : f.dbColumn.slice(0, -3) + 's') : null)
    const isRelational = targetTable && lookupModels.has(targetTable.toLowerCase())

    let options = f.config?.options
    if ((!options || options.length === 0) && (f.dbColumn.toLowerCase().includes('status') || f.label.toLowerCase().includes('status'))) {
      options = [
        { label: 'Novo', value: 'Novo' },
        { label: 'Contactado', value: 'Contactado' },
        { label: 'Em Negociação', value: 'Em Negociação' },
        { label: 'Fechado Ganho', value: 'Fechado Ganho' },
        { label: 'Perdido', value: 'Perdido' }
      ]
    }

    if (isRelational && targetTable) {
      const modelName = lookupModels.get(targetTable.toLowerCase())
      const relLabel = f.config?.component?.rel_label || f.config?.relation?.displayColumn || f.config?.rel_label
      const relValue = f.config?.component?.rel_value || f.config?.relation?.valueColumn || f.config?.rel_value || 'id'
      const labelExpr = relLabel
        ? `r[${JSON.stringify(relLabel)}] ?? r[${JSON.stringify(relLabel.toLowerCase())}] ?? r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
        : `r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
      const valueExpr = `r[${JSON.stringify(relValue)}] ?? r[${JSON.stringify(relValue.toLowerCase())}] ?? r.id ?? Object.values(r)[0] ?? ''`

      relationalFilterComponents.push(`async function Filter_${col}_Select({ defaultValue }: { defaultValue?: string }) {
  const list = await get${modelName}List().catch(() => [])
  return (
    <select
      name="${col}_filter"
      defaultValue={defaultValue || ''}
      className="w-full h-[42px] px-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm"
    >
      <option value="">Todos</option>
      {list.map((r: any, i: number) => {
        const val = String(${valueExpr})
        const lbl = String(${labelExpr})
        return <option key={i} value={val}>{lbl}</option>
      })}
    </select>
  )
}`)

      return `
          <div className="flex flex-col gap-1.5 ${colSpanClass}">
            <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">${f.label}</label>
            <Suspense
              fallback={
                <select
                  name="${col}_filter"
                  defaultValue={params?.['${col}_filter'] || ''}
                  className="w-full h-[42px] px-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm opacity-60"
                >
                  <option value="">Todos</option>
                </select>
              }
            >
              <Filter_${col}_Select defaultValue={params?.['${col}_filter']} />
            </Suspense>
          </div>`
    }

    if (options && options.length > 0) {
      const optsCode = JSON.stringify(options)
      return `
          <div className="flex flex-col gap-1.5 ${colSpanClass}">
            <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">${f.label}</label>
            <select
              name="${col}_filter"
              defaultValue={params?.['${col}_filter'] || ''}
              className="w-full h-[42px] px-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm"
            >
              <option value="">Todos</option>
              {(${optsCode} as Array<{value: string; label: string}>).map((opt, i) => (
                <option key={i} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>`
    }
    return `
          <div className="flex flex-col gap-1.5 ${colSpanClass}">
            <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">${f.label}</label>
            <div className="relative group">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                name="${col}_filter"
                placeholder="Filtrar por ${f.label.toLowerCase()}..."
                defaultValue={params?.['${col}_filter'] || ''}
                className="w-full h-[42px] pl-9 pr-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm"
              />
            </div>
          </div>`
  }).join('\n')

  const headerButtonsHtml = route.buttons.filter(b => b.placement === 'header').map(b => {
    if (b.actionType === 'create') {
      return `          <Link href="${route.path}/new" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
            <Plus className="w-4 h-4" /> ${b.label}
          </Link>`
    }
    if (b.actionType === 'export') {
      return `          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95">
            <Download className="w-4 h-4 text-neutral-400" /> ${b.label}
          </button>`
    }
    return `          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95">
            ${b.label}
          </button>`
  }).join('\n') || `          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95">
            <Zap className="w-4 h-4 text-neutral-400" /> Automações
          </button>
          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95">
            <Download className="w-4 h-4 text-neutral-400" /> Exportar
          </button>${hasCreate ? `
          <Link href="${route.path}/new" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
            <Plus className="w-4 h-4" /> Novo Registro
          </Link>` : ''}`

  return `import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { get${mn}List } from '@/app/actions/${mnLower}'
${lookupImports ? `${lookupImports}\n` : ''}import { Loader2, Plus, Search, RefreshCcw, Zap, Download, Calendar } from 'lucide-react'
import { DynamicIcon } from '@/app/components/DynamicIcon'
import { SchedulerClient } from './SchedulerClient'

export const metadata: Metadata = { title: '${route.title}' }

function SchedulerLoading() {
  return (
    <div className="py-20 flex flex-col items-center justify-center gap-4 text-neutral-400 bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem]">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      <div className="text-center">
        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-200">Conectando ao banco...</h3>
        <p className="text-sm">Buscando dados no Direct Access...</p>
      </div>
    </div>
  )
}

${relationalFilterComponents.join('\n\n')}

async function ${mn}SchedulerContent({
  params,
}: {
  params: { [key: string]: string | undefined }
}) {
  const rawData = await get${mn}List()
${lookupQueries}

  const relationalOptions: Record<string, Array<{ value: string; label: string }>> = {
${buildOptionsCode.join('\n')}
  }

  return (
    <SchedulerClient
      initialData={rawData || []}
      relationalOptions={relationalOptions}
      initialParams={params}
    />
  )
}

export default async function ${mn}SchedulerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const params = await searchParams

  return (
    <div className="p-6 sm:p-10 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Cabeçalho Externo fiel à Web Produção */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white shrink-0">
            <DynamicIcon icon="${route.icon || 'Calendar'}" size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
              ${route.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-8 h-1 bg-indigo-600 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                AGENDA • SISTEMA METABUILDER
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
${headerButtonsHtml}
        </div>
      </div>

      {/* Barra de Filtros / Argumentos da View */}
      ${filterFields.length > 0 ? `
      <form method="GET" className="p-6 bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-inner">
        <div className="flex flex-col lg:flex-row items-end gap-6">
          <div className="flex-1 grid grid-cols-12 gap-4 w-full">
${filterInputs}
          </div>
          <div className="flex items-center gap-3 mb-[1px]">
            <button
              type="submit"
              className="h-[42px] px-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 capitalize tracking-wider active:scale-95 shrink-0"
            >
              <Search className="w-4 h-4" />
              Pesquisar
            </button>
            <Link
              href="${route.path}"
              className="h-[42px] px-6 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-2 capitalize tracking-wider active:scale-95 shrink-0"
            >
              <RefreshCcw className="w-4 h-4" />
              Limpar
            </Link>
          </div>
        </div>
      </form>` : ''}

      {/* Calendário dentro de Suspense Streaming */}
      <Suspense
        key={JSON.stringify(params)}
        fallback={<SchedulerLoading />}
      >
        <${mn}SchedulerContent params={params} />
      </Suspense>
    </div>
  )
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler Schema ([route]/schema.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function generateSchedulerSchema(route: RouteNode): string {
  const rawFilterFields = route.filterFields && route.filterFields.length > 0 
    ? route.filterFields 
    : route.gridFields

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

  const sc = route.schedulerConfig
  const schedulerConfigObj = {
    title_field: sc?.titleField || 'id',
    start_date_field: sc?.startDateField || 'created_at',
    end_date_field: sc?.endDateField,
    color_field: sc?.colorField,
    titleField: sc?.titleField || 'id',
    startDateField: sc?.startDateField || 'created_at',
    endDateField: sc?.endDateField,
    colorField: sc?.colorField,
  }

  const schedulerConfigData = JSON.stringify(schedulerConfigObj, null, 2)

  return `// ─────────────────────────────────────────────────────────────────────────────
// Schemas e configurações declarativas para Scheduler de ${route.title}
// ─────────────────────────────────────────────────────────────────────────────

export const filterFields = ${filterFieldsData}

export const fields = ${fieldsData}

export const schedulerConfig = ${schedulerConfigData}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler Client Component ([route]/SchedulerClient.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export function generateSchedulerClient(route: RouteNode): string {
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
    ? `    setActiveRecord(initialData || null)
    setModalMode('create')
    setIsModalOpen(true)`
    : `    router.push('${route.path}/new')`

  const handleEditBody = isActionModal
    ? `    setActiveRecord(row)
    setModalMode('edit')
    setIsModalOpen(true)`
    : `    router.push('${route.path}/' + (row.${pk} || row.id))`

  const modalSubmitHandler = isActionModal ? `  const handleSubmitModal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const formData = new FormData(e.currentTarget)
      if (modalMode === 'edit' && activeRecord) {
        const id = activeRecord.${pk} || activeRecord.id
        await update${mn}(id, formData)
        const updatedEntries = Object.fromEntries(formData.entries())
        setDataList(prev => prev.map(item =>
          String(item.${pk} || item.id) === String(id)
            ? { ...item, ...updatedEntries }
            : item
        ))
      } else {
        const res = await create${mn}(formData)
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
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                    {modalMode === 'edit' ? 'Editar Registro' : 'Novo Agendamento'}
                  </h2>
                  <p className="text-xs font-medium text-neutral-400 mt-0.5 font-mono">
                    {modalMode === 'edit'
                      ? ('Registro #' + (activeRecord?.${pk} || activeRecord?.id || ''))
                      : 'Preencha os dados do agendamento'}
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

            <form
              key={modalMode + '-' + (activeRecord?.${pk} || activeRecord?.id || 'new')}
              onSubmit={handleSubmitModal}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-5">
                  ${modalFormFieldsHtml}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-400 transition-all active:scale-95 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}` : ''

  return `'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { update${mn}, delete${mn}, create${mn} } from '@/app/actions/${mnLower}'
import DynamicScheduler from '@/components/DynamicScheduler'
import { filterFields, fields, schedulerConfig } from './schema'
${byocImports ? `${byocImports}\n` : ''}import { Search, RefreshCcw, Pencil, X, Save } from 'lucide-react'

export function SchedulerClient({
  initialData,
  relationalOptions = {},
  initialParams = {}
}: {
  initialData: any[]
  relationalOptions?: Record<string, Array<{ value: string; label: string }>>
  initialParams?: Record<string, string | undefined>
}) {
  const router = useRouter()
  const [dataList, setDataList] = useState<any[]>(initialData)

  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    if (initialParams) {
      for (const [k, v] of Object.entries(initialParams)) {
        if (v && k !== 'embedded' && k !== 'preview' && k !== 'return_to') {
          init[k] = v
        }
      }
    }
    return init
  })
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(filterValues)

${modalStateVars}

  useEffect(() => {
    setDataList(initialData)
  }, [initialData])

  const filteredData = useMemo(() => {
    return dataList.filter(item => {
      for (const [col, val] of Object.entries(activeFilters)) {
        if (!val || !val.trim()) continue
        const itemVal = item[col]
        if (itemVal === null || itemVal === undefined) return false
        const strItemVal = String(itemVal).toLowerCase().trim()
        const strFilterVal = val.toLowerCase().trim()
        if (strItemVal !== strFilterVal && !strItemVal.includes(strFilterVal)) return false
      }
      return true
    })
  }, [dataList, activeFilters])

  const handleMove = async (recordId: string, updates: Record<string, any>) => {
    setDataList(prev =>
      prev.map(item =>
        String(item.${pk} || item.id) === recordId
          ? { ...item, ...updates }
          : item
      )
    )
    await update${mn}(recordId, updates)
  }

  const handleDelete = async (row: any) => {
    const recordId = String(row.${pk} || row.id)
    setDataList(prev => prev.filter(item => String(item.${pk} || item.id) !== recordId))
    await delete${mn}(recordId)
  }

  const handleAdd = (initialData?: any) => {
${handleAddBody}
  }

  const handleEdit = (row: any) => {
${handleEditBody}
  }

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setActiveFilters({ ...filterValues })
  }

  const handleClear = () => {
    setFilterValues({})
    setActiveFilters({})
  }

${modalSubmitHandler}

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {filterFields.length > 0 && (
        <form onSubmit={handleSearch} className="p-6 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-sm space-y-4">
          <div className="grid grid-cols-12 gap-4">
            {filterFields.map((f: any) => {
              const gridSpan = f.config?.filter_config?.component?.gridSpan || f.config?.gridSpan || 3
              const colSpanClass = 'col-span-12 sm:col-span-6 md:col-span-' + Math.min(12, gridSpan)
              const options = relationalOptions?.[f.dbColumn] || f.config?.options || []
              const isDate = f.dataType === 'date' || f.dataType === 'timestamp' || f.dataType === 'timestamptz' || f.dbColumn.includes('data')

              if (options && options.length > 0) {
                return (
                  <div key={f.dbColumn} className={'flex flex-col gap-1.5 ' + colSpanClass}>
                    <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">{f.label}</label>
                    <select
                      value={filterValues[f.dbColumn] || ''}
                      onChange={e => setFilterValues(prev => ({ ...prev, [f.dbColumn]: e.target.value }))}
                      className="w-full h-[42px] px-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
                    >
                      <option value="">Todos</option>
                      {options.map((opt: any, i: number) => (
                        <option key={i} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                )
              }

              if (isDate) {
                return (
                  <div key={f.dbColumn} className={'flex flex-col gap-1.5 ' + colSpanClass}>
                    <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">{f.label}</label>
                    <input
                      type="date"
                      value={filterValues[f.dbColumn] || ''}
                      onChange={e => setFilterValues(prev => ({ ...prev, [f.dbColumn]: e.target.value }))}
                      className="w-full h-[42px] px-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm"
                    />
                  </div>
                )
              }

              return (
                <div key={f.dbColumn} className={'flex flex-col gap-1.5 ' + colSpanClass}>
                  <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">{f.label}</label>
                  <div className="relative group">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type="text"
                      placeholder={'Filtrar por ' + f.label + '...'}
                      value={filterValues[f.dbColumn] || ''}
                      onChange={e => setFilterValues(prev => ({ ...prev, [f.dbColumn]: e.target.value }))}
                      className="w-full h-[42px] pl-9 pr-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm"
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all cursor-pointer"
            >
              Limpar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" /> Pesquisar
            </button>
          </div>
        </form>
      )}

      <DynamicScheduler
        data={filteredData}
        fields={fields}
        schedulerConfig={schedulerConfig}
        onMove={handleMove}
        onAdd={handleAdd}
        onView={handleEdit}
        onEdit={handleEdit}
        onDelete={handleDelete}
        relationalOptions={relationalOptions}
        dictionary={{}}
      />
${modalJsx}
    </div>
  )
}
`
}
