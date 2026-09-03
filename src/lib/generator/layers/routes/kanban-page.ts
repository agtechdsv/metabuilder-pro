import { RouteNode } from '../../ast'

// ─────────────────────────────────────────────────────────────────────────────
// Kanban Page (Server Component)
// ─────────────────────────────────────────────────────────────────────────────

export function generateKanbanPage(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()

  return `import type { Metadata } from 'next'
import { get${mn}List } from '@/app/actions/${mnLower}'
import { KanbanClient } from './KanbanClient'

export const metadata: Metadata = { title: '${route.title}' }

export default async function ${mn}KanbanPage() {
  const rawData = await get${mn}List()

  return (
    <KanbanClient
      initialData={rawData || []}
    />
  )
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Kanban Client Component ('use client')
// ─────────────────────────────────────────────────────────────────────────────

export function generateKanbanClient(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const groupCol = route.kanbanGroupField || 'status'
  const groupDisplayField = route.kanbanGroupDisplayField
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

  const fieldsData = JSON.stringify(
    route.gridFields.map(f => ({
      id: f.id,
      dbColumn: f.dbColumn,
      label: f.label,
      dataType: f.dataType,
      config: f.config,
    }))
  )

  const cardFieldsData = JSON.stringify(route.kanbanCardFields || [])

  return `'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { update${mn}, delete${mn} } from '@/app/actions/${mnLower}'
import { KanbanBoard } from '@/components/KanbanBoard'
import { DynamicIcon } from '@/app/components/DynamicIcon'
import { Plus, Search, RefreshCcw, Zap, Download } from 'lucide-react'

export function KanbanClient({ initialData }: { initialData: any[] }) {
  const [dataList, setDataList] = useState<any[]>(initialData)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [visibleCount, setVisibleCount] = useState(50)
  const BATCH_SIZE = 50

  const filterFields = ${filterFieldsData}
  const fields = ${fieldsData}
  const cardFields = ${cardFieldsData}

  // Filtragem de cartões por argumentos/filtros configurados e busca textual
  const filteredData = useMemo(() => {
    return dataList.filter(item => {
      for (const [col, val] of Object.entries(filterValues)) {
        if (!val || !val.trim()) continue
        const itemVal = item[col]
        if (itemVal === null || itemVal === undefined) return false
        if (!String(itemVal).toLowerCase().includes(val.toLowerCase().trim())) return false
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const match = Object.values(item).some(val => 
          val !== null && val !== undefined && String(val).toLowerCase().includes(term)
        )
        if (!match) return false
      }
      return true
    })
  }, [dataList, filterValues, searchTerm])

  // Paginação dinâmica por etapas (batching) idêntica à Web Produção
  const displayedData = useMemo(() => {
    return filteredData.slice(0, visibleCount)
  }, [filteredData, visibleCount])

  const handleMove = async (recordId: string, newValue: any) => {
    setDataList(prev =>
      prev.map(item =>
        String(item.${route.primaryKey} || item.id) === recordId
          ? { ...item, ['${groupCol}']: newValue }
          : item
      )
    )
    await update${mn}(recordId, { ['${groupCol}']: newValue })
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
            <DynamicIcon icon="${route.icon || 'FolderKanban'}" size={24} />
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
                KANBAN • SISTEMA METABUILDER
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
        <div className="p-6 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-sm space-y-4">
          <div className="grid grid-cols-12 gap-4">
            {filterFields.map((f: any) => {
              const gridSpan = f.config?.filter_config?.component?.gridSpan || f.config?.gridSpan || 3
              const colSpanClass = 'col-span-12 sm:col-span-6 md:col-span-' + Math.min(12, gridSpan)
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
          {Object.values(filterValues).some(Boolean) && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setFilterValues({})}
                className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-indigo-600 transition-colors"
              >
                <RefreshCcw className="w-3 h-3" /> Limpar Filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* Componente KanbanBoard com Drag-and-Drop */}
      <KanbanBoard
        data={displayedData}
        fields={fields}
        groupColumn="${groupCol}"
        ${groupDisplayField ? `groupDisplayField="${groupDisplayField}"` : ''}
        cardFields={cardFields}
        primaryKey="${route.primaryKey}"
        basePath="${route.path}"
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
