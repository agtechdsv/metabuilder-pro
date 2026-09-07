import { RouteNode } from '../../ast'
import { toPascalCase, renderFormField, getByocComponentName, FORM_INPUT_FORMAT_HELPERS } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Kanban Page (Server Component)
// ─────────────────────────────────────────────────────────────────────────────

export function generateKanbanPage(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const hasCreate = route.buttons.some(b => b.actionType === 'create') || route.buttons.length === 0

  // Detecta todas as tabelas relacionadas necessárias para lookups dos filtros e cards
  const lookupModels = new Map<string, string>() // table -> modelName
  const allKanbanFields = [...(route.filterFields || []), ...(route.gridFields || [])]
  allKanbanFields.forEach(f => {
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
  allKanbanFields.forEach(f => {
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
                  defaultValue={params?.['${col}_filter'] || params?.['${col}'] || params?.['${f.dbColumn}'] || (('${col}').endsWith('_id') ? params?.['${col}'.slice(0, -3)] : params?.['${col}_id']) || ''}
                  className="w-full h-[42px] px-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm opacity-60"
                >
                  <option value="">Todos</option>
                </select>
              }
            >
              <Filter_${col}_Select defaultValue={params?.['${col}_filter'] || params?.['${col}'] || params?.['${f.dbColumn}'] || (('${col}').endsWith('_id') ? params?.['${col}'.slice(0, -3)] : params?.['${col}_id'])} />
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
              defaultValue={params?.['${col}_filter'] || params?.['${col}'] || params?.['${f.dbColumn}'] || (('${col}').endsWith('_id') ? params?.['${col}'.slice(0, -3)] : params?.['${col}_id']) || ''}
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
                defaultValue={params?.['${col}_filter'] || params?.['${col}'] || params?.['${f.dbColumn}'] || (('${col}').endsWith('_id') ? params?.['${col}'.slice(0, -3)] : params?.['${col}_id']) || ''}
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
${lookupImports ? `${lookupImports}\n` : ''}import { Loader2, Plus, Search, RefreshCcw, Zap, Download } from 'lucide-react'
import { DynamicIcon } from '@/app/components/DynamicIcon'
import { CloseModalButton } from '@/components/ui/custom-action-button'
import { KanbanClient } from './KanbanClient'

export const metadata: Metadata = { title: '${route.title}' }

function KanbanLoading() {
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

async function ${mn}KanbanContent({
  params,
  isEmbedded = false,
}: {
  params: { [key: string]: string | undefined }
  isEmbedded?: boolean
}) {
  const rawData = await get${mn}List()
${lookupQueries}

  const relationalOptions: Record<string, Array<{ value: string; label: string }>> = {
${buildOptionsCode.join('\n')}
  }

  return (
    <KanbanClient
      initialData={rawData || []}
      relationalOptions={relationalOptions}
      initialParams={params}
      isEmbedded={isEmbedded}
    />
  )
}

export default async function ${mn}KanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const params = await searchParams
  const isEmbedded = params?.embedded === 'true'

  return (
    <div className="p-6 sm:p-10 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Cabeçalho Externo fiel à Web Produção (RuntimeHeader) */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white shrink-0">
            <DynamicIcon icon="${route.icon || 'FolderKanban'}" size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
              ${route.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-8 h-1 bg-indigo-600 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                KANBAN • SISTEMA METABUILDER
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
${headerButtonsHtml}
          {isEmbedded && <CloseModalButton />}
        </div>
      </div>

      {/* Barra de Filtros / Argumentos da View (Fiel à Web Produção) */}
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

      {/* Board Kanban dentro de Suspense Streaming */}
      <Suspense
        key={JSON.stringify(params)}
        fallback={<KanbanLoading />}
      >
        <${mn}KanbanContent params={params} isEmbedded={isEmbedded} />
      </Suspense>
    </div>
  )
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Kanban Schema ([route]/schema.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function generateKanbanSchema(route: RouteNode): string {
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

  const cardFieldsData = JSON.stringify(route.kanbanCardFields || [], null, 2)

  return `// ─────────────────────────────────────────────────────────────────────────────
// Schemas e configurações declarativas para Kanban de ${route.title}
// ─────────────────────────────────────────────────────────────────────────────

export const filterFields = ${filterFieldsData}

export const fields = ${fieldsData}

export const cardFields = ${cardFieldsData}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Kanban Client Component ([route]/KanbanClient.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export function generateKanbanClient(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const pk = route.primaryKey || 'id'
  const groupCol = route.kanbanGroupField || 'status'
  const groupDisplayField = route.kanbanGroupDisplayField
  const isDrawer = route.actionInterfaceType === 'drawer'
    || route.rawLayoutConfig?.action_interface_type === 'drawer'
  const isModal = route.actionInterfaceType === 'modal'
    || route.rawLayoutConfig?.action_interface_type === 'modal'
  const isActionOverlay = isDrawer || isModal

  const formFieldsToUse = (route.formFields && route.formFields.length > 0)
    ? route.formFields
    : (route.gridFields && route.gridFields.length > 0)
    ? route.gridFields
    : []

  const modalFormFieldsHtml = formFieldsToUse
    .map(f => renderFormField(f, true, 'isView', 'relationalOptions'))
    .filter(Boolean)
    .join('\n')

  const byocImports = formFieldsToUse
    .filter(f => f.isByoc || f.dataType === 'byoc' || f.id.startsWith('byoc_'))
    .map(f => getByocComponentName(f))
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .map(name => `import { ${name} } from '@/components/${name}'`)
    .join('\n')

  const modalStateVars = isActionOverlay ? `  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('edit')
  const [activeRecord, setActiveRecord] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)` : ''

  const handleEditCode = isActionOverlay ? `  const handleEdit = (item: any) => {
    setActiveRecord(item)
    setModalMode('edit')
    setIsModalOpen(true)
  }` : ''

  const modalSaveHandler = isActionOverlay ? `  const handleSaveRecord = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (modalMode === 'view') return
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
    } catch (err: any) {
      console.error('Erro ao salvar registro:', err)
      alert('Erro ao salvar: ' + (err?.message || err))
    } finally {
      setIsSaving(false)
    }
  }

  const data = activeRecord
  const isEdit = modalMode === 'edit' || modalMode === 'view'
  const isView = modalMode === 'view'` : ''

  const overlayJsx = isActionOverlay ? (
    isDrawer ? `
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="w-full max-w-2xl h-full bg-white dark:bg-neutral-900 shadow-2xl border-l border-neutral-200 dark:border-neutral-800 flex flex-col animate-in slide-in-from-right duration-300 relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-neutral-100 dark:border-neutral-800">
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
                      : 'Novo Registro'}
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

            <form key={activeRecord ? String(activeRecord.${pk} || activeRecord.id || '') : 'new'} onSubmit={handleSaveRecord} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
${modalFormFieldsHtml}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                {modalMode !== 'view' && (
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}` : `
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
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
                      : 'Novo Registro'}
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

            <form key={activeRecord ? String(activeRecord.${pk} || activeRecord.id || '') : 'new'} onSubmit={handleSaveRecord} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
${modalFormFieldsHtml}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                {modalMode !== 'view' && (
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}`
  ) : ''

  return `'use client'

import React, { useState, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { update${mn}, delete${mn}${isActionOverlay ? `, create${mn}` : ''} } from '@/app/actions/${mnLower}'
import { fields, cardFields } from './schema'
import { RefreshCcw${isActionOverlay ? ', Eye, Pencil, Plus, X, Save' : ''} } from 'lucide-react'
${byocImports ? `${byocImports}\n` : ''}
${isActionOverlay ? FORM_INPUT_FORMAT_HELPERS : ''}

// Carregamento dinâmico sem SSR para evitar conflito de IDs aria no dnd-kit
const KanbanBoard = dynamic(
  () => import('@/components/KanbanBoard').then(mod => mod.KanbanBoard),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[600px] flex flex-col items-center justify-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-8 space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
          Carregando Kanban...
        </p>
      </div>
    ),
  }
)

export function KanbanClient({
  initialData,
  relationalOptions = {},
  initialParams = {},
  isEmbedded = false,
}: {
  initialData: any[]
  relationalOptions?: Record<string, Array<{ value: string; label: string }>>
  initialParams?: Record<string, string | undefined>
  isEmbedded?: boolean
}) {
  const [dataList, setDataList] = useState<any[]>(initialData)
  const [visibleCount, setVisibleCount] = useState(50)
  const BATCH_SIZE = 50

${modalStateVars}

  useEffect(() => {
    setDataList(initialData)
  }, [initialData])

  // Filtragem de cartões por argumentos/filtros recebidos via searchParams ou custom actions
  const filteredData = useMemo(() => {
    return dataList.filter(item => {
      for (const [rawKey, rawVal] of Object.entries(initialParams || {})) {
        if (!rawVal || !String(rawVal).trim()) continue
        if (rawKey === 'embedded' || rawKey === 'preview' || rawKey === 'return_to') continue
        const val = String(rawVal).trim().toLowerCase()
        const col = rawKey.endsWith('_filter') ? rawKey.replace(/_filter$/, '') : rawKey

        const possibleCols = [
          col,
          col.replace(/_/g, '.'),
          col.endsWith('_id') ? col.slice(0, -3) : (col + '_id'),
          rawKey,
        ]

        let matched = false
        for (const c of possibleCols) {
          const itemVal = item[c] ?? (item as any)?.[c.toLowerCase()]
          if (itemVal !== undefined && itemVal !== null) {
            const strVal = String(itemVal).toLowerCase()
            if (strVal === val || strVal.includes(val)) {
              matched = true
              break
            }
          }
        }
        if (!matched) return false
      }
      return true
    })
  }, [dataList, initialParams])

  // Paginação dinâmica por etapas (batching) idêntica à Web Produção
  const displayedData = useMemo(() => {
    return filteredData.slice(0, visibleCount)
  }, [filteredData, visibleCount])

  const handleMove = async (recordId: string, newValue: any) => {
    setDataList(prev =>
      prev.map(item =>
        String(item.${route.primaryKey || 'id'} || item.id) === recordId
          ? { ...item, ['${groupCol}']: newValue }
          : item
      )
    )
    await update${mn}(recordId, { ['${groupCol}']: newValue })
  }

  const handleDelete = async (recordId: string) => {
    setDataList(prev => prev.filter(item => String(item.${route.primaryKey || 'id'} || item.id) !== recordId))
    await delete${mn}(recordId)
  }

${handleEditCode}
${modalSaveHandler}

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Componente KanbanBoard com Drag-and-Drop */}
      <KanbanBoard
        data={displayedData}
        fields={fields}
        groupColumn="${groupCol}"
        ${groupDisplayField ? `groupDisplayField="${groupDisplayField}"` : ''}
        cardFields={cardFields}
        primaryKey="${route.primaryKey || 'id'}"
        basePath="${route.path}"
        relationalOptions={relationalOptions}
        onMove={handleMove}
        onDelete={handleDelete}
        ${isActionOverlay ? 'onEdit={handleEdit}' : ''}
        isEmbedded={isEmbedded}
      />
${overlayJsx}

      {/* Botão Flutuante de Carregar Mais Registros Fiel à Web Produção */}
      {displayedData.length < filteredData.length && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <button
            type="button"
            onClick={() => setVisibleCount(prev => prev + BATCH_SIZE)}
            className="px-6 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-2xl flex items-center gap-2 ring-1 ring-black/5 dark:ring-white/10 active:scale-95 cursor-pointer"
          >
            <RefreshCcw className="w-4 h-4 text-indigo-500" />
            Carregar mais {Math.min(BATCH_SIZE, filteredData.length - displayedData.length)} registros... ({displayedData.length} de {filteredData.length})
          </button>
        </div>
      )}
    </div>
  )
}
`
}

