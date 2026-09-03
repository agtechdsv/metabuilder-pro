import { RouteNode } from '../../ast'

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Page (Server Component)
// ─────────────────────────────────────────────────────────────────────────────

export function generateTimelinePage(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()

  // Detecta todas as tabelas relacionadas necessárias para lookups dos filtros e campos da timeline
  const lookupModels = new Map<string, string>() // table -> modelName
  const allTimelineFields = [
    ...(route.filterFields || []),
    ...(route.gridFields || []),
    ...(route.formFields || []),
  ]

  allTimelineFields.forEach(f => {
    const targetModel = f.config?.relation?.targetModel || (f as any).relation?.targetModel
    const targetTable = f.config?.relation?.targetTable || f.config?.component?.rel_table || f.config?.rel_table
    if (targetModel && targetTable) {
      lookupModels.set(targetTable.toLowerCase(), targetModel)
    } else if (targetTable && !targetTable.includes('-') && targetTable.length < 30) {
      const modelName = targetTable.charAt(0).toUpperCase() + targetTable.slice(1)
      lookupModels.set(targetTable.toLowerCase(), modelName)
    } else if (f.dbColumn.endsWith('_id') && !f.isPrimaryKey) {
      const base = f.dbColumn.slice(0, -3)
      const table = base.endsWith('s') ? base : (base + 's')
      const modelName = table.charAt(0).toUpperCase() + table.slice(1)
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
  allTimelineFields.forEach(f => {
    const targetTable = f.config?.relation?.targetTable || f.config?.component?.rel_table || f.config?.rel_table || (f.dbColumn.endsWith('_id') ? (f.dbColumn.slice(0, -3).endsWith('s') ? f.dbColumn.slice(0, -3) : f.dbColumn.slice(0, -3) + 's') : null)
    if (targetTable && lookupModels.has(targetTable.toLowerCase())) {
      const t = targetTable.toLowerCase()
      buildOptionsCode.push(`    '${f.dbColumn}': (${t}LookupList || []).map((r: any) => ({ value: String(r.id), label: r.nome || r.name || r.titulo || r.title || r.razao_social || String(r.id) })),`)
    } else if (f.config?.options && Array.isArray(f.config.options) && f.config.options.length > 0) {
      buildOptionsCode.push(`    '${f.dbColumn}': ${JSON.stringify(f.config.options)},`)
    }
  })

  return `import type { Metadata } from 'next'
import { get${mn}List } from '@/app/actions/${mnLower}'
${lookupImports}
import { TimelineClient } from './TimelineClient'

export const metadata: Metadata = { title: '${route.title}' }

export default async function ${mn}TimelinePage() {
  const rawData = await get${mn}List()
${lookupQueries}

  const relationalOptions: Record<string, Array<{ value: string; label: string }>> = {
${buildOptionsCode.join('\n')}
  }

  return (
    <TimelineClient
      initialData={rawData || []}
      relationalOptions={relationalOptions}
    />
  )
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Client Component ('use client')
// ─────────────────────────────────────────────────────────────────────────────

export function generateTimelineClient(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const hasCreate = route.buttons.some(b => b.actionType === 'create') || route.buttons.length === 0

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
    }))
  )

  const timelineConfigData = JSON.stringify(
    route.timelineConfig || {
      dateField: 'created_at',
      titleField: 'id',
      layoutStyle: 'infographic',
      layoutDirection: 'horizontal',
      layoutMode: 'alternating',
      timelineOrderHorizontal: 'desc',
      animated: false,
      cardScale: 1.0,
    }
  )

  return `'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { delete${mn} } from '@/app/actions/${mnLower}'
import { TimelineBoard } from '@/components/TimelineBoard'
import { DynamicIcon } from '@/app/components/DynamicIcon'
import { Plus, Search, RefreshCcw, Zap, Download } from 'lucide-react'

export function TimelineClient({
  initialData,
  relationalOptions = {}
}: {
  initialData: any[]
  relationalOptions?: Record<string, Array<{ value: string; label: string }>>
}) {
  const router = useRouter()
  const [dataList, setDataList] = useState<any[]>(initialData)
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})
  const [visibleCount, setVisibleCount] = useState(50)
  const BATCH_SIZE = 50

  useEffect(() => {
    setDataList(initialData)
  }, [initialData])

  const filterFields = ${filterFieldsData}
  const timelineConfig = ${timelineConfigData}

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
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95"
          >
            <Zap className="w-4 h-4 text-neutral-400" /> Automações
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95"
          >
            <Download className="w-4 h-4 text-neutral-400" /> Exportar
          </button>
${hasCreate ? `          <Link
            href="${route.path}/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Novo Registro
          </Link>` : ''}
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
                      className="w-full h-[42px] px-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm"
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
        onView={(row) => router.push(\`${route.path}/\${row.${route.primaryKey} || row.id}\`)}
        onEdit={(row) => router.push(\`${route.path}/\${row.${route.primaryKey} || row.id}\`)}
        onDelete={handleDelete}
        onRefresh={() => router.refresh()}
        onLoadMore={() => setVisibleCount(prev => prev + BATCH_SIZE)}
        hasMore={visibleCount < filteredData.length}
        totalRecords={filteredData.length}
        visibleCount={BATCH_SIZE}
      />
    </div>
  )
}
`
}
