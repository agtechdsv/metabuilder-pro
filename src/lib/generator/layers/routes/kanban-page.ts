import { RouteNode } from '../../ast'
import { toPascalCase } from './helpers'

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
${lookupImports ? `${lookupImports}\n` : ''}import { Loader2, Plus, Search, RefreshCcw, Zap, Download } from 'lucide-react'
import { DynamicIcon } from '@/app/components/DynamicIcon'
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
}: {
  params: { [key: string]: string | undefined }
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
    />
  )
}

export default async function ${mn}KanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const params = await searchParams

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
        <${mn}KanbanContent params={params} />
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
  const groupCol = route.kanbanGroupField || 'status'
  const groupDisplayField = route.kanbanGroupDisplayField

  return `'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { update${mn}, delete${mn} } from '@/app/actions/${mnLower}'
import { KanbanBoard } from '@/components/KanbanBoard'
import { fields, cardFields } from './schema'
import { RefreshCcw } from 'lucide-react'

export function KanbanClient({
  initialData,
  relationalOptions = {},
  initialParams = {}
}: {
  initialData: any[]
  relationalOptions?: Record<string, Array<{ value: string; label: string }>>
  initialParams?: Record<string, string | undefined>
}) {
  const [dataList, setDataList] = useState<any[]>(initialData)
  const [visibleCount, setVisibleCount] = useState(50)
  const BATCH_SIZE = 50

  useEffect(() => {
    setDataList(initialData)
  }, [initialData])

  // Filtragem de cartões por argumentos/filtros recebidos via searchParams
  const filteredData = useMemo(() => {
    return dataList.filter(item => {
      for (const [key, val] of Object.entries(initialParams || {})) {
        if (!key.endsWith('_filter') || !val || !val.trim()) continue
        const col = key.replace('_filter', '')
        const itemVal = item[col] ?? item[col.replace(/_/g, '.')] ?? ''
        if (!String(itemVal).toLowerCase().includes(val.toLowerCase().trim())) return false
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
      />

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

