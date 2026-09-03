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

  const fields = ${fieldsData}
  const cardFields = ${cardFieldsData}

  // Filtragem de cartões por busca textual
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return dataList
    const term = searchTerm.toLowerCase()
    return dataList.filter(item => {
      return Object.values(item).some(val => 
        val !== null && val !== undefined && String(val).toLowerCase().includes(term)
      )
    })
  }, [dataList, searchTerm])

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

      {/* Barra de Filtro e Busca Rápida no Kanban */}
      <div className="p-4 bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-inner flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar nos cartões do Kanban..."
            className="w-full h-[40px] pl-10 pr-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm"
          />
        </div>
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="flex items-center gap-2 text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
          >
            <RefreshCcw className="w-3.5 h-3.5" /> Limpar busca
          </button>
        )}
      </div>

      {/* Componente KanbanBoard com Drag-and-Drop */}
      <KanbanBoard
        data={filteredData}
        fields={fields}
        groupColumn="${groupCol}"
        ${groupDisplayField ? `groupDisplayField="${groupDisplayField}"` : ''}
        cardFields={cardFields}
        primaryKey="${route.primaryKey}"
        basePath="${route.path}"
        onMove={handleMove}
        onDelete={handleDelete}
      />
    </div>
  )
}
`
}
