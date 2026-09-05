import { RouteNode } from '../../ast'
import { renderGridCellValue } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Listagem (pesquisa_cadastro — page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export function generateListPage(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const hasCreate = route.buttons.some(b => b.actionType === 'create') || route.buttons.length === 0

  // Detecta todas as tabelas relacionadas necessárias para lookups dos filtros e colunas da grid
  const lookupModels = new Map<string, string>() // table -> modelName
  const allListFields = [...(route.filterFields || []), ...(route.gridFields || [])]
  allListFields.forEach(f => {
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

  const hasLookups = lookupModels.size > 0
  const fetchDataCode = hasLookups
    ? `  const [rawData, ${Array.from(lookupModels.keys()).map(t => `${t}LookupList`).join(', ')}] = await Promise.all([\n    get${mn}List(),\n    ${Array.from(lookupModels.values()).map(m => `get${m}List().catch(() => [])`).join(',\n    ')}\n  ])`
    : `  const rawData = await get${mn}List()`

  const buildOptionsCode: string[] = []
  allListFields.forEach(f => {
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

  // Cabeçalhos da tabela com ordenação interativa (Links preservando query params)
  const thCells = route.gridFields
    .filter(f => !f.hidden)
    .map(f => {
      const col = f.dbColumn
      return `              <th
                key="${col}"
                className="px-6 py-4 text-[10px] font-black text-neutral-400 dark:text-neutral-500 tracking-[0.15em] whitespace-nowrap cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors group/th"
              >
                <Link
                  href={makeQuery({ sort_by: '${col}', sort_order: sortBy === '${col}' && sortOrder === 'asc' ? 'desc' : 'asc' })}
                  className="flex items-center gap-2"
                >
                  <span>${f.label.toUpperCase()}</span>
                  <div className={"transition-opacity " + (sortBy === '${col}' ? 'opacity-100' : 'opacity-0 group-hover/th:opacity-100')}>
                    {sortBy === '${col}' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
                    )}
                  </div>
                </Link>
              </th>`
    })
    .join('\n')

  // Células de dados
  const tdCells = route.gridFields
    .filter(f => !f.hidden)
    .map(f => `                <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400 whitespace-nowrap">\n                  ${renderGridCellValue(f, 'item', 'relationalOptions')}\n                </td>`)
    .join('\n')

  // Filtros
  const filterFields = route.filterFields.length > 0 ? route.filterFields : route.gridFields.filter(f => !f.isPrimaryKey && !f.isVirtual && !f.isByoc).slice(0, 3)
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

  const rowButtonsHtml = route.buttons
    .filter(b => b.placement === 'row' && b.actionType !== 'view' && b.actionType !== 'edit' && b.actionType !== 'update' && b.actionType !== 'delete')
    .map(b => {
      const actionConfig = {
        id: b.id,
        label: b.label,
        icon: b.icon || 'Receipt',
        style: b.style,
        triggerType: b.triggerType,
        usecaseSlug: b.usecaseSlug,
        usecaseOpenMode: b.usecaseOpenMode || 'modal',
        usecaseModalSize: b.usecaseModalSize || 'full',
        usecaseModalWidth: b.usecaseModalWidth,
        usecaseModalHeight: b.usecaseModalHeight,
        usecaseSelectedFields: b.usecaseSelectedFields || [],
        usecaseParams: b.usecaseParams || '',
        linkTarget: b.linkTarget || '',
      }
      return `                      <CustomActionButton action={${JSON.stringify(actionConfig)}} item={item} />`
    })
    .join('\n')

  return `import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { get${mn}List } from '@/app/actions/${mnLower}'
import { delete${mn} } from '@/app/actions/${mnLower}'
${lookupImports ? `${lookupImports}\n` : ''}import { Plus, Pencil, ChevronLeft, ChevronRight, Receipt, ArrowUpDown, ArrowUp, ArrowDown, Search, RefreshCcw, Download, Loader2 } from 'lucide-react'
import { DynamicIcon } from '@/app/components/DynamicIcon'
import { DeleteButton } from '@/components/ui/delete-button'
import { CustomActionButton, CloseModalButton } from '@/components/ui/custom-action-button'
import { LimitSelector } from '@/components/ui/limit-selector'

export const metadata: Metadata = { title: '${route.title}' }

function TableLoading() {
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

async function ${mn}TableContent({
  params,
}: {
  params: { [key: string]: string | undefined }
}) {
  const sortBy = params?.sort_by
  const sortOrder = params?.sort_order || 'asc'
  const page = Math.max(1, parseInt(params?.page || '1', 10) || 1)
  const limit = Math.max(1, parseInt(params?.limit || '15', 10) || 15)

${fetchDataCode}

  const relationalOptions: Record<string, Array<{ value: string; label: string }>> = {
${buildOptionsCode.join('\n')}
  }

  // Filtros dinâmicos da URL
  const filteredData = (rawData || []).filter((item: any) => {
${filterFields.map(f => {
  const col = f.dbColumn.replace('.', '_')
  const rawCol = f.dbColumn
  return `    const val_${col} = params?.['${col}_filter']
    if (val_${col}) {
      const itemVal = String(item['${rawCol}'] ?? item['${col}'] ?? '').toLowerCase()
      if (!itemVal.includes(String(val_${col}).toLowerCase())) return false
    }`
}).join('\n')}
    return true
  })

  // Ordenação de colunas
  if (sortBy) {
    filteredData.sort((a: any, b: any) => {
      const rawCol = sortBy.replace('.', '_')
      const valA = a[sortBy] ?? a[rawCol] ?? ''
      const valB = b[sortBy] ?? b[rawCol] ?? ''
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA
      }
      return sortOrder === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA))
    })
  }

  const totalRows = filteredData.length
  const totalPages = Math.ceil(totalRows / limit) || 1
  const paginatedData = filteredData.slice((page - 1) * limit, page * limit)

  // Helper para construir querystring preservando filtros e ordenação
  const makeQuery = (newParams: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams()
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') q.set(k, String(v))
      }
    }
    for (const [k, v] of Object.entries(newParams)) {
      if (v === undefined || v === '') q.delete(k)
      else q.set(k, String(v))
    }
    const str = q.toString()
    return str ? ('?' + str) : ''
  }

  return (
    <div className="bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] overflow-hidden shadow-xl dark:shadow-none backdrop-blur-sm flex flex-col w-full">
      <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="sticky top-0 z-20">
            <tr className="bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
              <th className="px-4 py-4 w-[60px] border-r border-neutral-200/50 dark:border-neutral-700/50 text-[10px] font-black text-neutral-400 dark:text-neutral-500 tracking-[0.15em] text-center">#</th>
${thCells}
              <th className="px-4 py-4 text-right text-[10px] font-black text-neutral-400 dark:text-neutral-500 tracking-[0.15em] border-l border-neutral-200/50 dark:border-neutral-700/50">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item: any, idx: number) => (
              <tr key={item.${route.primaryKey} || idx} className={"group border-b border-neutral-100 dark:border-neutral-800/50 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors " + (idx % 2 === 0 ? "" : "bg-neutral-50/50 dark:bg-neutral-900/20")}>
                <td className="px-4 py-4 w-[60px] text-center border-r border-neutral-200/50 dark:border-neutral-700/50">
                  <span className="text-[11px] font-black text-neutral-300 dark:text-neutral-600">{(page - 1) * limit + idx + 1}</span>
                </td>
${tdCells}
                <td className="px-4 py-4 text-right border-l border-neutral-200/50 dark:border-neutral-700/50">
                  <div className="flex items-center justify-end gap-1.5">
                    <Link href={'${route.path}/' + item.${route.primaryKey}} className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all active:scale-90 shadow-sm flex items-center justify-center" title="Visualizar">
                      <Search className="w-3.5 h-3.5" />
                    </Link>
                    <Link href={'${route.path}/' + item.${route.primaryKey}} className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 border border-neutral-200 dark:border-neutral-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all active:scale-90 shadow-sm flex items-center justify-center" title="Editar">
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                    <DeleteButton
                      recordName={String(item[${JSON.stringify(route.gridFields.find(f => !f.isPrimaryKey && !f.hidden)?.dbColumn || route.primaryKey)}] || item.${route.primaryKey})}
                      onDelete={async () => { 'use server'; await delete${mn}(item.${route.primaryKey}) }}
                    />
${rowButtonsHtml}
                  </div>
                </td>
              </tr>
            ))}
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan={${route.gridFields.filter(f => !f.hidden).length + 2}} className="h-48 text-center">
                  <p className="text-neutral-400 dark:text-neutral-600 text-sm">Nenhum registro encontrado.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Rodapé com Navegador de Páginas fiel à Web Produção */}
      <div className="px-8 py-4 bg-neutral-50/50 dark:bg-neutral-900/50 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-[11px] font-bold text-neutral-500 uppercase tracking-widest">
          <span className="opacity-60">Exibir</span>
          <LimitSelector currentLimit={limit} />
          <span className="mx-2 opacity-20">|</span>
          <span className="opacity-60">Total: <span className="text-neutral-900 dark:text-white font-bold">{totalRows}</span></span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={page > 1 ? makeQuery({ page: page - 1 }) : '#'}
            className={"p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all " + (page <= 1 ? "opacity-30 pointer-events-none" : "")}
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
              .map((p) => (
                <Link
                  key={p}
                  href={makeQuery({ page: p })}
                  className={"w-8 h-8 rounded-lg text-[10px] font-black transition-all flex items-center justify-center " + (page === p ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30" : "text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800")}
                >
                  {p}
                </Link>
              ))}
          </div>

          <Link
            href={page < totalPages ? makeQuery({ page: page + 1 }) : '#'}
            className={"p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all " + (page >= totalPages ? "opacity-30 pointer-events-none" : "")}
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default async function ${mn}ListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const params = await searchParams
  const isEmbedded = params?.embedded === 'true'

  return (
    <div className="p-6 sm:p-10 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Cabeçalho fiel à Web Produção (RuntimeHeader) */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white shrink-0">
            <DynamicIcon icon="${route.icon || 'Users'}" size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
              ${route.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-8 h-1 bg-indigo-600 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                ${route.logicType.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
${route.buttons.filter(b => b.placement === 'header').map(b => {
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
  if (b.actionType === 'custom') {
    const actionConfig = {
      id: b.id,
      label: b.label,
      icon: b.icon || 'Zap',
      style: b.style,
      triggerType: b.triggerType,
      usecaseSlug: b.usecaseSlug,
      usecaseOpenMode: b.usecaseOpenMode || 'modal',
      usecaseModalSize: b.usecaseModalSize || 'full',
      usecaseModalWidth: b.usecaseModalWidth,
      usecaseModalHeight: b.usecaseModalHeight,
      usecaseSelectedFields: b.usecaseSelectedFields || [],
      usecaseParams: b.usecaseParams || '',
      linkTarget: b.linkTarget || '',
    }
    return `          <CustomActionButton action={${JSON.stringify(actionConfig)}} variant="header" />`
  }
  return `          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95">
            ${b.label}
          </button>`
}).join('\n') || (hasCreate ? `          <Link href="${route.path}/new" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
            <Plus className="w-4 h-4" /> Novo Registro
          </Link>` : '')}
          {isEmbedded && <CloseModalButton />}
        </div>
      </div>

      {/* Filtros fiéis ao ViewFilterBar */}
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
      </form>

      {/* Tabela de Resultados dentro de Suspense Streaming */}
      <Suspense
        key={JSON.stringify(params)}
        fallback={<TableLoading />}
      >
        <${mn}TableContent params={params} />
      </Suspense>
    </div>
  )
}
`
}
