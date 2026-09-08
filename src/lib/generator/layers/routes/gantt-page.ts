import { RouteNode } from '../../ast'
import { renderFormField, getByocComponentName, toPascalCase, FORM_INPUT_FORMAT_HELPERS } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Gantt Page (Server Component)
// ─────────────────────────────────────────────────────────────────────────────

export function generateGanttPage(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const hasCreate = route.buttons.some(b => b.actionType === 'create') || route.buttons.length === 0

  // Detecta todas as tabelas relacionadas necessárias para lookups dos filtros e tarefas
  const lookupModels = new Map<string, string>() // table -> modelName
  const allGanttFields = [
    ...(route.filterFields || []),
    ...(route.gridFields || []),
    ...(route.formFields || []),
  ]

  allGanttFields.forEach(f => {
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
  allGanttFields.forEach(f => {
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
  const filterFields = (route.filterFields && route.filterFields.length > 0)
    ? route.filterFields
    : (route.gridFields || []).filter(f => !f.isPrimaryKey && !f.isVirtual && !f.isByoc).slice(0, 3)

  const filterInputs = filterFields.map(f => {
    const col = f.dbColumn.replace('.', '_')
    const gridSpan = f.config?.gridSpan || f.config?.component?.gridSpan || 3
    const colSpanClass = `col-span-12 md:col-span-${Math.min(12, gridSpan || 3)}`
    const targetTable = f.config?.relation?.targetTable || f.config?.component?.rel_table || f.config?.rel_table || (f.dbColumn.endsWith('_id') ? (f.dbColumn.slice(0, -3).endsWith('s') ? f.dbColumn.slice(0, -3) : f.dbColumn.slice(0, -3) + 's') : null)
    const isRelational = targetTable && lookupModels.has(targetTable.toLowerCase())

    let options = f.config?.options
    const defValExpr = `searchParams?.['${col}_filter'] || searchParams?.['${col}'] || searchParams?.['${f.dbColumn}'] || (('${col}').endsWith('_id') ? searchParams?.['${col}'.slice(0, -3)] : searchParams?.['${col}_id']) || ''`

    if (isRelational && targetTable) {
      const targetListVar = `${targetTable.toLowerCase()}LookupList`
      const relLabel = f.config?.component?.rel_label || f.config?.relation?.displayColumn || f.config?.rel_label
      const relValue = f.config?.component?.rel_value || f.config?.relation?.valueColumn || f.config?.rel_value || 'id'
      const labelExpr = relLabel
        ? `r[${JSON.stringify(relLabel)}] ?? r[${JSON.stringify(relLabel.toLowerCase())}] ?? r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
        : `r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
      const valueExpr = `r[${JSON.stringify(relValue)}] ?? r[${JSON.stringify(relValue.toLowerCase())}] ?? r.id ?? Object.values(r)[0] ?? ''`

      return `
          <div className="flex flex-col gap-1.5 ${colSpanClass}">
            <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">${f.label}</label>
            <select
              name="${col}_filter"
              defaultValue={${defValExpr}}
              className="w-full h-[42px] px-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
            >
              <option value="">Todos</option>
              {(${targetListVar} || []).map((r: any, i: number) => (
                <option key={i} value={String(${valueExpr})}>{String(${labelExpr})}</option>
              ))}
            </select>
          </div>`
    }

    if (options && options.length > 0) {
      const optsCode = JSON.stringify(options)
      return `
          <div className="flex flex-col gap-1.5 ${colSpanClass}">
            <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">${f.label}</label>
            <select
              name="${col}_filter"
              defaultValue={${defValExpr}}
              className="w-full h-[42px] px-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
            >
              <option value="">Todos</option>
              {(${optsCode} as Array<{value: string; label: string}>).map((opt, i) => (
                <option key={i} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>`
    }

    if (f.dbColumn.toLowerCase().includes('status') || f.label.toLowerCase().includes('status')) {
      const statusDefaults = [
        { label: 'Novo', value: 'Novo' },
        { label: 'Em Andamento', value: 'Em Andamento' },
        { label: 'Concluído', value: 'Concluído' },
        { label: 'A Fazer', value: 'A Fazer' },
        { label: 'Planejado', value: 'Planejado' }
      ]
      return `
          <div className="flex flex-col gap-1.5 ${colSpanClass}">
            <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">${f.label}</label>
            <select
              name="${col}_filter"
              defaultValue={${defValExpr}}
              className="w-full h-[42px] px-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
            >
              <option value="">Todos</option>
              {${JSON.stringify(statusDefaults)}.map((opt, i) => (
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
                defaultValue={${defValExpr}}
                className="w-full h-[42px] pl-9 pr-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm"
              />
            </div>
          </div>`
  }).join('\n')

  const headerButtonsHtml = route.buttons.filter(b => b.placement === 'header').map(b => {
    if (b.actionType === 'create') {
      return `          <Link href={\`${route.path}/new\${isEmbedded ? '?embedded=true' : ''}\`} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95 cursor-pointer">
            <Plus className="w-4 h-4" /> ${b.label}
          </Link>`
    }
    if (b.actionType === 'export') {
      return `          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95 cursor-pointer">
            <Download className="w-4 h-4 text-neutral-400" /> ${b.label}
          </button>`
    }
    return `          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95 cursor-pointer">
            ${b.label}
          </button>`
  }).join('\n') || `          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95 cursor-pointer">
            <Zap className="w-4 h-4 text-neutral-400" /> Automações
          </button>
          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95 cursor-pointer">
            <Download className="w-4 h-4 text-neutral-400" /> Exportar
          </button>${hasCreate ? `
          <Link href={\`${route.path}/new\${isEmbedded ? '?embedded=true' : ''}\`} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95 cursor-pointer">
            <Plus className="w-4 h-4" /> Novo Registro
          </Link>` : ''}`

  return `import { get${mn}List } from '@/app/actions/${mnLower}'
${lookupImports ? `${lookupImports}\n` : ''}import { GanttClient } from './GanttClient'
import { DynamicIcon } from '@/app/components/DynamicIcon'
import Link from 'next/link'
import { Plus, Search, RefreshCcw, Download, Zap } from 'lucide-react'
import { CloseModalButton } from '@/components/ui/custom-action-button'

export const dynamic = 'force-dynamic'

export default async function ${mn}GanttPage(props: {
  searchParams?: Promise<Record<string, string | undefined>>
}) {
  const searchParams = props.searchParams ? await props.searchParams : {}
  const isEmbedded = searchParams?.embedded === 'true'
  const rawData = await get${mn}List({ filters: searchParams }).catch(() => [])
${lookupQueries ? `${lookupQueries}\n` : ''}
  const relationalOptions: Record<string, Array<{ value: string; label: string }>> = {
${buildOptionsCode.join('\n')}
  }

  // Filtros dinâmicos da URL
  const data = (rawData || []).filter((item: any) => {
${filterFields.map(f => {
  const col = f.dbColumn.replace('.', '_')
  const rawCol = f.dbColumn
  return `    const val_${col} = searchParams?.['${col}_filter'] || searchParams?.['${col}'] || searchParams?.['${f.dbColumn}']
    if (val_${col}) {
      const itemVal = String(item['${rawCol}'] ?? item['${col}'] ?? '').toLowerCase()
      if (!itemVal.includes(String(val_${col}).toLowerCase())) return false
    }`
}).join('\n')}
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header Fiel ao Padrão MetaBuilder RuntimeHeader */}
      <div className="px-6 sm:px-10 py-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white shrink-0">
            <DynamicIcon icon="${route.icon || 'LayoutList'}" size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
              ${route.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-8 h-1 bg-indigo-600 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                ${route.description ? route.description.toUpperCase() : 'SISTEMA METABUILDER'}
              </span>
            </div>
          </div>
        </div>

        {/* Ações do Header */}
        <div className="flex items-center gap-3">
${headerButtonsHtml}
          {isEmbedded && <CloseModalButton />}
        </div>
      </div>

      {/* Barra de Filtros / Argumentos da View (Fiel à Web Produção) */}
      ${filterFields.length > 0 ? `
      <div className="px-6 sm:px-10">
        <form method="GET" className="p-6 bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-inner">
          {isEmbedded && <input type="hidden" name="embedded" value="true" />}
          <div className="flex flex-col lg:flex-row items-end gap-6">
            <div className="flex-1 grid grid-cols-12 gap-4 w-full">
${filterInputs}
            </div>
            <div className="flex items-center gap-3 mb-[1px]">
              <button
                type="submit"
                className="h-[42px] px-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 capitalize tracking-wider active:scale-95 shrink-0 cursor-pointer"
              >
                <Search className="w-4 h-4" />
                Pesquisar
              </button>
              <Link
                href={\`${route.path}\${isEmbedded ? '?embedded=true' : ''}\`}
                className="h-[42px] px-6 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-2 capitalize tracking-wider active:scale-95 shrink-0 cursor-pointer"
              >
                <RefreshCcw className="w-4 h-4" />
                Limpar
              </Link>
            </div>
          </div>
        </form>
      </div>` : ''}

      {/* Gantt Interactive Canvas */}
      <div className="px-6 sm:px-10">
        <GanttClient
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
// Gantt Schema ([route]/schema.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function generateGanttSchema(route: RouteNode): string {
  const mn = route.modelName
  const gc = route.ganttConfig || {
    titleField: 'nome',
    startDateField: 'created_at',
    endDateField: 'created_at',
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

  const ganttConfigObj = {
    titleField: gc.titleField || '',
    startDateField: gc.startDateField || '',
    endDateField: gc.endDateField || '',
    progressField: gc.progressField || '',
    // snake_case aliases para compatibilidade
    title_field: gc.titleField || '',
    start_date_field: gc.startDateField || '',
    end_date_field: gc.endDateField || '',
    progress_field: gc.progressField || '',
  }

  const ganttConfigData = JSON.stringify(ganttConfigObj, null, 2)

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

  const rowCustomActions: any[] = route.buttons
    .filter(b => b.placement === 'row' && b.actionType === 'custom')
    .map(b => ({
      id: b.id,
      label: b.label,
      icon: b.icon || 'Receipt',
      color: b.color || (b as any).color || 'indigo',
      style: b.style,
      triggerType: b.triggerType,
      usecaseSlug: b.usecaseSlug,
      usecaseOpenMode: b.usecaseOpenMode || 'modal',
      usecaseModalSize: b.usecaseModalSize || '4xl',
      usecaseModalWidth: b.usecaseModalWidth,
      usecaseModalHeight: b.usecaseModalHeight,
      usecaseSelectedFields: b.usecaseSelectedFields || [],
      usecaseParams: b.usecaseParams || '',
      linkTarget: b.linkTarget || '',
    }))

  // Fallback se não vierem de route.buttons: checa rawLayoutConfig.custom_actions
  if (rowCustomActions.length === 0 && Array.isArray(route.rawLayoutConfig?.custom_actions)) {
    route.rawLayoutConfig.custom_actions
      .filter((a: any) => {
        if (!a || a.enabled === false) return false
        const ctxs = a.contexts ? (Array.isArray(a.contexts) ? a.contexts : [a.contexts]) : (a.context ? [a.context] : ['row'])
        return ctxs.includes('row') || ctxs.includes('row_search')
      })
      .forEach((a: any) => {
        rowCustomActions.push({
          id: a.id || `custom_act_${(a.label || 'act').toLowerCase().replace(/\s+/g, '_')}`,
          label: a.label || a.name || 'Ação Customizada',
          icon: a.icon || a.custom_icon || 'Zap',
          color: a.color || 'indigo',
          style: a.style || 'primary',
          triggerType: a.trigger_type || (a.usecase_slug ? 'usecase' : 'custom'),
          usecaseSlug: a.usecase_slug || a.target_use_case,
          usecaseOpenMode: a.usecase_open_mode || 'modal',
          usecaseModalSize: a.usecaseModalSize || a.usecase_modal_size || '4xl',
          usecaseModalWidth: a.usecase_modal_width,
          usecaseModalHeight: a.usecase_modal_height,
          usecaseSelectedFields: a.usecase_selected_fields || [],
          usecaseParams: a.usecase_params || '',
          linkTarget: a.linkTarget || a.url || a.target_url || (a.usecase_slug ? `/${a.usecase_slug}` : ''),
        })
      })
  }

  const customActionsData = JSON.stringify(rowCustomActions, null, 2)

  return `// ─────────────────────────────────────────────────────────────────────────────
// Schemas e configurações declarativas para Gantt de ${route.title}
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'

export const filterFields = ${filterFieldsData}

export const fields = ${fieldsData}

export const ganttConfig = ${ganttConfigData}

export const customActions = ${customActionsData}

export const ${mn}Schema = z.object({
${zodFields}
})

export type ${mn}FormData = z.infer<typeof ${mn}Schema>
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Gantt Client Component ([route]/GanttClient.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export function generateGanttClient(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const pk = route.primaryKey || 'id'
  const isActionModal = route.actionInterfaceType === 'modal'
    || route.rawLayoutConfig?.action_interface_type === 'modal'

  const modalFormFieldsHtml = route.formFields
    .map(f => renderFormField(f, true, 'isView', 'relationalOptions', true))
    .filter(Boolean)
    .join('\n')

  const byocImports = route.formFields
    .filter(f => f.isByoc || f.dataType === 'byoc' || f.id.startsWith('byoc_'))
    .map(f => getByocComponentName(f))
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .map(name => `import { ${name} } from '@/components/${name}'`)
    .join('\n')

  const modalStateVars = isActionModal ? `  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('edit')
  const [activeRecord, setActiveRecord] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)` : ''

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
    ? `    setActiveRecord(row)
    setModalMode('view')
    setIsModalOpen(true)`
    : `    const recordId = String(row.${pk} || row.id)
    router.push(\`${route.path}/\${recordId}\`)`

  const modalSaveHandler = isActionModal ? `  const handleSaveRecord = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (modalMode === 'view') return
    setIsSaving(true)
    setSaveError(null)
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
      setSaveError(err?.message || String(err) || 'Erro ao salvar registro.')
    } finally {
      setIsSaving(false)
    }
  }

  const data = activeRecord
  const isEdit = modalMode === 'edit' || modalMode === 'view'
  const isView = modalMode === 'view'` : ''

  const modalJsx = isActionModal ? `
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 sm:p-8 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  {modalMode === 'view' ? (
                    <Eye className="w-5 h-5" />
                  ) : modalMode === 'create' ? (
                    <Plus className="w-5 h-5" />
                  ) : (
                    <Pencil className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                    {modalMode === 'view'
                      ? 'Visualizar ${route.title}'
                      : modalMode === 'edit'
                      ? 'Editar ${route.title}'
                      : 'Novo Registro no Cronograma'}
                  </h2>
                  <p className="text-xs font-medium text-neutral-400 mt-0.5 font-mono">
                    {modalMode !== 'create'
                      ? ('Registro #' + (activeRecord?.${pk} || activeRecord?.id || ''))
                      : 'Preencha os dados do registro'}
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
              {saveError && (
                <div className="mx-6 sm:mx-8 mt-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-3 text-rose-700 dark:text-rose-400 text-xs animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span className="font-medium flex-1">{saveError}</span>
                  <button type="button" onClick={() => setSaveError(null)} className="hover:opacity-75 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
${modalFormFieldsHtml}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 sm:p-8 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                {modalMode === 'view' ? (
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-bold transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                ) : (
                  <>
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
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}` : ''

  return `'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { update${mn}, delete${mn}, create${mn} } from '@/app/actions/${mnLower}'
import { GanttBoard } from '@/components/GanttBoard'
import { fields, ganttConfig, customActions } from './schema'
${byocImports ? `${byocImports}\n` : ''}import { Eye, Pencil, Plus, X, Save, AlertCircle } from 'lucide-react'

${FORM_INPUT_FORMAT_HELPERS}

export function GanttClient({
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
    try {
      const res = await delete${mn}(recordId)
      if (res && (res as any).success === false) {
        console.warn('Não foi possível excluir o registro:', (res as any).error)
        return
      }
      setDataList(prev => prev.filter(item => String(item.${pk} || item.id) !== recordId))
      router.refresh()
    } catch (err: any) {
      console.error('Erro ao excluir registro:', err)
    }
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
      <GanttBoard
        data={dataList}
        fields={fields}
        ganttConfig={ganttConfig}
        relationalOptions={relationalOptions}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        customActions={customActions}
      />
${modalJsx}
    </div>
  )
}
`
}
