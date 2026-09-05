import { RouteNode } from '../../ast'
import { renderFormField, getByocComponentName, toPascalCase } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Page (Server Component)
// ─────────────────────────────────────────────────────────────────────────────

export function generateTimelinePage(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()

  // Detecta todas as tabelas relacionadas necessárias para lookups dos filtros, campos da timeline e abas
  const lookupModels = new Map<string, string>() // table -> modelName
  const allTimelineFields = [
    ...(route.filterFields || []),
    ...(route.gridFields || []),
    ...(route.formFields || []),
    ...route.relationTabs.flatMap(tab => [
      ...(tab.formFields || []),
      ...(tab.gridFields || [])
    ])
  ]

  allTimelineFields.forEach(f => {
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

  const optionsMap = new Map<string, string>()
  allTimelineFields.forEach(f => {
    if (optionsMap.has(f.dbColumn)) return
    const targetTable = f.config?.relation?.targetTable || f.config?.component?.rel_table || f.config?.rel_table || (f.dbColumn.endsWith('_id') ? (f.dbColumn.slice(0, -3).endsWith('s') ? f.dbColumn.slice(0, -3) : f.dbColumn.slice(0, -3) + 's') : null)
    if (targetTable && lookupModels.has(targetTable.toLowerCase())) {
      const t = targetTable.toLowerCase()
      const relLabel = f.config?.component?.rel_label || f.config?.relation?.displayColumn || f.config?.rel_label
      const relValue = f.config?.component?.rel_value || f.config?.relation?.valueColumn || f.config?.rel_value || 'id'
      const labelExpr = relLabel
        ? `r[${JSON.stringify(relLabel)}] ?? r[${JSON.stringify(relLabel.toLowerCase())}] ?? r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
        : `r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
      const valueExpr = `r[${JSON.stringify(relValue)}] ?? r[${JSON.stringify(relValue.toLowerCase())}] ?? r.id ?? Object.values(r)[0] ?? ''`
      optionsMap.set(
        f.dbColumn,
        `    '${f.dbColumn}': (${t}LookupList || []).map((r: any) => ({ value: String(${valueExpr}), label: String(${labelExpr}) })),`
      )
    } else if (f.config?.options && Array.isArray(f.config.options) && f.config.options.length > 0) {
      optionsMap.set(f.dbColumn, `    '${f.dbColumn}': ${JSON.stringify(f.config.options)},`)
    }
  })

  // Garante lookups para campos usados na timeline mesmo se não estiverem em filterFields
  const extraLookupCols = [route.timelineConfig?.titleField, route.timelineConfig?.descField, route.timelineConfig?.iconField].filter(Boolean) as string[]
  extraLookupCols.forEach(col => {
    if (col && col.endsWith('_id') && !optionsMap.has(col)) {
      const base = col.slice(0, -3)
      const t = (base.endsWith('s') ? base : (base + 's')).toLowerCase()
      if (lookupModels.has(t)) {
        const matchedField = allTimelineFields.find(f => f.dbColumn === col)
        const relLabel = matchedField?.config?.component?.rel_label || matchedField?.config?.relation?.displayColumn || matchedField?.config?.rel_label
        const relValue = matchedField?.config?.component?.rel_value || matchedField?.config?.relation?.valueColumn || matchedField?.config?.rel_value || 'id'
        const labelExpr = relLabel
          ? `r[${JSON.stringify(relLabel)}] ?? r[${JSON.stringify(relLabel.toLowerCase())}] ?? r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
          : `r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
        const valueExpr = `r[${JSON.stringify(relValue)}] ?? r[${JSON.stringify(relValue.toLowerCase())}] ?? r.id ?? Object.values(r)[0] ?? ''`
        optionsMap.set(
          col,
          `    '${col}': (${t}LookupList || []).map((r: any) => ({ value: String(${valueExpr}), label: String(${labelExpr}) })),`
        )
      }
    }
  })

  return `import type { Metadata } from 'next'
import { Suspense } from 'react'
import { get${mn}List } from '@/app/actions/${mnLower}'
${lookupImports}
import { Loader2 } from 'lucide-react'
import { TimelineClient } from './TimelineClient'

export const metadata: Metadata = { title: '${route.title}' }

function TimelineLoading() {
  return (
    <div className="p-6 sm:p-10 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="py-20 flex flex-col items-center justify-center gap-4 text-neutral-400 bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem]">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <div className="text-center">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-200">Conectando ao banco...</h3>
          <p className="text-sm">Buscando dados no Direct Access...</p>
        </div>
      </div>
    </div>
  )
}

async function ${mn}TimelineContent({
  params,
}: {
  params: { [key: string]: string | undefined }
}) {
  const rawData = await get${mn}List()
${lookupQueries}

  const relationalOptions: Record<string, Array<{ value: string; label: string }>> = {
${Array.from(optionsMap.values()).join('\n')}
  }

  return (
    <TimelineClient
      initialData={rawData || []}
      relationalOptions={relationalOptions}
      initialParams={params}
    />
  )
}

export default async function ${mn}TimelinePage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | undefined }>
}) {
  const params = searchParams ? await searchParams : {}

  return (
    <Suspense fallback={<TimelineLoading />}>
      <${mn}TimelineContent params={params} />
    </Suspense>
  )
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Timeline Schema ([route]/schema.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function generateTimelineSchema(route: RouteNode): string {
  const isActionModal = route.actionInterfaceType === 'modal' || route.rawLayoutConfig?.action_interface_type === 'modal'
  const hasRelationTabs = route.relationTabs.length > 0

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

  const timelineConfigData = JSON.stringify(
    route.timelineConfig || {
      dateField: 'created_at',
      titleField: 'id',
      layoutStyle: 'infographic',
      layoutDirection: 'horizontal',
      layoutMode: 'alternating',
      timelineOrderHorizontal: 'asc',
      timelineOrderVertical: 'asc',
      animated: false,
      cardScale: 1.0,
    },
    null,
    2
  )

  const usedTabPrefixes = new Set<string>()
  const tabConstants: string[] = []

  if (hasRelationTabs && isActionModal) {
    route.relationTabs.forEach((tab, i) => {
      const tabFields = (tab.formFields && tab.formFields.length > 0 ? tab.formFields : tab.gridFields)
        .filter(f => !f.dbColumn.includes('.') || f.dbColumn.startsWith(tab.relatedTable + '.'))

      const basePrefix = tab.relatedTable.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
      const constPrefix = usedTabPrefixes.has(basePrefix) ? `${basePrefix}_${i + 1}` : basePrefix
      usedTabPrefixes.add(constPrefix)

      const fieldsConstName = `${constPrefix}_FIELDS`
      const subDetailsConstName = `${constPrefix}_SUB_DETAILS`

      const mappedFields = tabFields.map(f => ({
        id: f.id,
        label: f.label,
        dbColumn: f.dbColumn.includes('.') ? f.dbColumn.split('.').pop()! : f.dbColumn,
        dataType: f.dataType,
        isPrimaryKey: f.isPrimaryKey,
        config: f.config,
      }))

      const mappedSubDetails = tab.subDetails && tab.subDetails.length > 0
        ? tab.subDetails.map(sub => ({
            relatedTable: sub.relatedTable,
            relatedModelName: sub.relatedModelName,
            foreignKey: sub.foreignKey,
            label: sub.label,
            fields: (sub.formFields && sub.formFields.length > 0 ? sub.formFields : sub.gridFields).map(f => ({
              id: f.id,
              label: f.label,
              dbColumn: f.dbColumn.includes('.') ? f.dbColumn.split('.').pop()! : f.dbColumn,
              dataType: f.dataType,
              isPrimaryKey: f.isPrimaryKey,
              config: f.config,
            }))
          }))
        : []

      tabConstants.push(
        `// Schema de campos da aba "${tab.label}" (${tab.relatedTable})`,
        `export const ${fieldsConstName} = ${JSON.stringify(mappedFields, null, 2)} as const`,
        ``,
        `// Sub-detalhes da aba "${tab.label}" (${tab.relatedTable})`,
        `export const ${subDetailsConstName} = ${JSON.stringify(mappedSubDetails, null, 2)} as const`,
        ``
      )
    })
  }

  return `// ─────────────────────────────────────────────────────────────────────────────
// Schemas e configurações declarativas para Timeline de ${route.title}
// ─────────────────────────────────────────────────────────────────────────────

export const filterFields = ${filterFieldsData}

export const timelineConfig = ${timelineConfigData}
${tabConstants.length > 0 ? `\n${tabConstants.join('\n')}\n` : ''}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Client Component ('use client')
// ─────────────────────────────────────────────────────────────────────────────

export function generateTimelineClient(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const hasCreate = route.buttons.some(b => b.actionType === 'create') || route.buttons.length === 0
  const isActionModal = route.actionInterfaceType === 'modal' || route.rawLayoutConfig?.action_interface_type === 'modal'
  const hasRelationTabs = route.relationTabs.length > 0

  // Geração de formulário modal de edição/criação
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

  const relationImports = hasRelationTabs && isActionModal
    ? [
        `import { DetailRelationSection } from '@/components/DetailRelationSection'`,
        ...route.relationTabs.map(t =>
          `import { get${t.relatedModelName}ByField, create${t.relatedModelName}, update${t.relatedModelName}, delete${t.relatedModelName} } from '@/app/actions/${t.relatedTable.toLowerCase()}'`
        ),
      ].join('\n')
    : ''

  const usedTabPrefixes = new Set<string>()
  const modalTabConstNames: string[] = []

  const relationTabPanels = hasRelationTabs && isActionModal
    ? route.relationTabs.map((tab, i) => {
        const basePrefix = tab.relatedTable.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
        const constPrefix = usedTabPrefixes.has(basePrefix) ? `${basePrefix}_${i + 1}` : basePrefix
        usedTabPrefixes.add(constPrefix)

        const fieldsConstName = `${constPrefix}_FIELDS`
        const subDetailsConstName = `${constPrefix}_SUB_DETAILS`

        modalTabConstNames.push(fieldsConstName, subDetailsConstName)

        return `
            <div key="${tab.relatedTable}" className="space-y-3">
              <DetailRelationSection
                label="${tab.label}"
                relatedTable="${tab.relatedTable}"
                foreignKey="${tab.foreignKey}"
                parentId={String(activeRecord?.${route.primaryKey} || activeRecord?.id || '')}
                items={modalRelationItems['${tab.relatedTable}'] || []}
                fields={${fieldsConstName} as any}
                subDetails={${subDetailsConstName} as any}
                createAction={create${tab.relatedModelName}}
                updateAction={update${tab.relatedModelName}}
                deleteAction={delete${tab.relatedModelName}}
                backPath="${route.path}"
              />
            </div>`
      }).join('\n')
    : ''

  const schemaImports = `import { filterFields, timelineConfig${modalTabConstNames.length > 0 ? `, ${modalTabConstNames.join(', ')}` : ''} } from './schema'`

  return `'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { delete${mn}, update${mn}, create${mn} } from '@/app/actions/${mnLower}'
import { TimelineBoard } from '@/components/TimelineBoard'
import { DynamicIcon } from '@/app/components/DynamicIcon'
${byocImports ? `${byocImports}\n` : ''}${relationImports ? `${relationImports}\n` : ''}${schemaImports}
import { Plus, Search, RefreshCcw, Zap, Download, Pencil, X, Save } from 'lucide-react'

function formatDateForInput(v: any) {
  if (!v) return ''
  if (typeof v === 'string' && /^\\d{4}-\\d{2}-\\d{2}$/.test(v)) return v
  try {
    const d = new Date(v)
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear()
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return \`\${year}-\${month}-\${day}\`
    }
  } catch (e) {}
  return String(v).slice(0, 10)
}

function formatDatetimeForInput(v: any) {
  if (!v) return ''
  try {
    const d = new Date(v)
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const hours = String(d.getHours()).padStart(2, '0')
      const minutes = String(d.getMinutes()).padStart(2, '0')
      return \`\${year}-\${month}-\${day}T\${hours}:\${minutes}\`
    }
  } catch (e) {}
  return String(v).slice(0, 16)
}

export function TimelineClient({
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
  const [isEmbedded, setIsEmbedded] = useState(initialParams?.embedded === 'true')

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

  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(() => {
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

  const [visibleCount, setVisibleCount] = useState(50)
  const BATCH_SIZE = 50

  // Estado da Modal de Ação (quando configurada no Studio como 'modal')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('edit')
  const [activeRecord, setActiveRecord] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [modalRelationItems, setModalRelationItems] = useState<Record<string, any[]>>({})

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      if (sp.get('embedded') === 'true') setIsEmbedded(true)
      const fromUrl: Record<string, string> = {}
      sp.forEach((val, key) => {
        if (key !== 'embedded' && key !== 'preview' && key !== 'return_to') {
          fromUrl[key] = val
        }
      })
      if (Object.keys(fromUrl).length > 0) {
        setFilterValues(prev => ({ ...fromUrl, ...prev }))
        setActiveFilters(prev => ({ ...fromUrl, ...prev }))
      }
    }
  }, [])

  useEffect(() => {
    setDataList(initialData)
  }, [initialData])

  // Busca itens relacionados para o registro aberto na modal
  useEffect(() => {
    if (activeRecord && (activeRecord.${route.primaryKey} || activeRecord.id)) {
      const recId = String(activeRecord.${route.primaryKey} || activeRecord.id)
${hasRelationTabs && isActionModal ? route.relationTabs.map(tab => `      get${tab.relatedModelName}ByField('${tab.foreignKey}', recId)
        .then((items: any) => setModalRelationItems(prev => ({ ...prev, '${tab.relatedTable}': items || [] })))
        .catch(() => {})`).join('\n') : ''}
    } else {
      setModalRelationItems({})
    }
  }, [activeRecord])

  // Filtragem de registros conforme a barra de argumentos/filtros
  const filteredData = useMemo(() => {
    return dataList.filter(item => {
      for (const [col, val] of Object.entries(activeFilters)) {
        if (!val || !val.trim()) continue
        const itemVal = item[col]
        if (itemVal === null || itemVal === undefined) return false

        // Comparação flexível para IDs e strings
        const strItemVal = String(itemVal).toLowerCase().trim()
        const strFilterVal = val.toLowerCase().trim()
        if (strItemVal !== strFilterVal && !strItemVal.includes(strFilterVal)) {
          return false
        }
      }
      return true
    })
  }, [dataList, activeFilters])

  // Paginação dinâmica por etapas (batching) idêntica à Web Produção
  const displayedData = useMemo(() => {
    return filteredData.slice(0, visibleCount)
  }, [filteredData, visibleCount])

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setActiveFilters({ ...filterValues })
    setVisibleCount(BATCH_SIZE)
  }

  const handleClear = () => {
    setFilterValues({})
    setActiveFilters({})
    setVisibleCount(BATCH_SIZE)
  }

  const handleDelete = async (recordId: string) => {
    setDataList(prev => prev.filter(item => String(item.${route.primaryKey} || item.id) !== recordId))
    await delete${mn}(recordId)
  }

  const handleOpenCreate = () => {
    setActiveRecord(null)
    setModalMode('create')
    setIsModalOpen(true)
  }

  const handleOpenEdit = (record: any) => {
    setActiveRecord(record)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleSubmitModal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const formData = new FormData(e.currentTarget)
      if (modalMode === 'edit' && activeRecord) {
        const id = activeRecord.${route.primaryKey} || activeRecord.id
        await update${mn}(id, formData)
        const updatedEntries = Object.fromEntries(formData.entries())
        setDataList(prev => prev.map(item =>
          String(item.${route.primaryKey} || item.id) === String(id)
            ? { ...item, ...updatedEntries }
            : item
        ))
      } else {
        const res = await create${mn}(formData)
        if (res) {
          setDataList(prev => [res, ...prev])
        }
      }
      setIsModalOpen(false)
      setActiveRecord(null)
      router.refresh()
    } catch (err: any) {
      console.error('Erro ao salvar registro:', err)
      alert('Erro ao salvar registro: ' + (err?.message || err))
    } finally {
      setIsSaving(false)
    }
  }

  // Atalhos para compatibilidade com renderFormField
  const data = activeRecord
  const isEdit = modalMode === 'edit'

  return (
    <div className="p-6 sm:p-10 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Cabeçalho Externo fiel à Web Produção (RuntimeHeader) */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white shrink-0">
            <DynamicIcon icon="${route.icon || 'Clock'}" size={24} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                ${route.title}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[10px] font-black text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 tracking-widest uppercase">
                {filteredData.length} REG
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-8 h-1 bg-indigo-600 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                TIMELINE • SISTEMA METABUILDER
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Zap className="w-4 h-4 text-neutral-400" /> Automações
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4 text-neutral-400" /> Exportar
          </button>
${hasCreate ? (isActionModal ? `          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Novo Registro
          </button>` : `          <Link
            href="${route.path}/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Novo Registro
          </Link>`) : ''}
          {isEmbedded && (
            <button 
              type="button"
              onClick={() => window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*')}
              className="p-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-xl transition-all text-neutral-500 hover:text-neutral-900 dark:hover:text-white shrink-0 ml-1 cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Barra de Argumentos / Filtros Dinâmicos Fiel à Web Produção */}
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
                    <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">
                      {f.label}
                    </label>
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
                    <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">
                      {f.label}
                    </label>
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
                  <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">
                    {f.label}
                  </label>
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

      {/* Componente TimelineBoard com Direção, Estilos e Controles */}
      <TimelineBoard
        data={displayedData}
        timelineConfig={timelineConfig}
        relationalOptions={relationalOptions}
        onView={(row) => ${isActionModal ? 'handleOpenEdit(row)' : `router.push(\`${route.path}/\${row.${route.primaryKey} || row.id}\`)`}}
        onEdit={(row) => ${isActionModal ? 'handleOpenEdit(row)' : `router.push(\`${route.path}/\${row.${route.primaryKey} || row.id}\`)`}}
        onDelete={handleDelete}
        onRefresh={() => router.refresh()}
        onLoadMore={() => setVisibleCount(prev => prev + BATCH_SIZE)}
        hasMore={visibleCount < filteredData.length}
        totalRecords={filteredData.length}
        visibleCount={BATCH_SIZE}
      />

      {/* Modal de Ação / Edição (Configurada no Studio como 'modal') */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Cabeçalho da Modal fiel ao Studio */}
            <div className="flex items-center justify-between p-6 sm:p-8 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                    {modalMode === 'edit' ? 'Editar Registro' : 'Novo Registro'}
                  </h2>
                  <p className="text-xs font-medium text-neutral-400 mt-0.5 font-mono">
                    {modalMode === 'edit'
                      ? \`Registro #\${activeRecord?.${route.primaryKey} || activeRecord?.id || ''}\`
                      : 'Preencha os dados do registro'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulário com scroll interno e sub-tabelas */}
            <form
              key={modalMode + '-' + (activeRecord?.${route.primaryKey} || activeRecord?.id || 'new')}
              onSubmit={handleSubmitModal}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-5">
${modalFormFieldsHtml}
                </div>

${hasRelationTabs && isActionModal ? `                {modalMode === 'edit' && activeRecord && (
                  <div className="space-y-6 pt-6 border-t border-neutral-100 dark:border-neutral-800">
${relationTabPanels}
                  </div>
                )}` : ''}
              </div>

              {/* Rodapé da Modal */}
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
      )}
    </div>
  )
}
`
}
