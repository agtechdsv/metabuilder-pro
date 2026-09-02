/**
 * routes.ts
 *
 * Gera as pages Next.js para cada RouteNode da AST.
 *
 * Para logic_type 'pesquisa_cadastro':
 *   - page.tsx     → Listagem com grid dinâmico (gridFields) e filtros (filterFields)
 *   - [id]/page.tsx → Detalhe com formFields e abas de relacionamento (relationTabs)
 *   - new/page.tsx  → Cadastro com formFields
 *
 * Para outros logic_type: placeholder "Em desenvolvimento"
 */

import { AppAST, RouteNode, ResolvedField, RelationTab } from '../ast'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toCamel(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_m, c) => c.toUpperCase())
    .replace(/^[A-Z]/, (m) => m.toLowerCase())
}

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_m, c) => c.toUpperCase())
    .replace(/^[a-z]/, (m) => m.toUpperCase())
}

/**
 * Gera o trecho JSX para renderizar o valor de um campo na tabela de listagem.
 * Replica a lógica de renderização do Runtime ViewPageContent.
 */
function renderGridCellValue(field: ResolvedField, varName = 'item'): string {
  const col = field.dbColumn.includes('.') ? `["${field.dbColumn}"]` : `.${field.dbColumn}`
  const raw = `${varName}${col}`
  const dt = (field.dataType || '').toLowerCase()

  if (field.isByoc || field.isVirtual) {
    return `<span className="text-xs text-neutral-400 italic">// TODO: virtual field</span>`
  }
  if (field.isPrimaryKey) {
    return `<span className="font-mono text-[10px] text-neutral-400 truncate max-w-[80px] block">{String(${raw} ?? '-').slice(0, 8)}...</span>`
  }
  if (dt === 'boolean') {
    return `<span className={\`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider \${${raw} ? 'bg-green-50 text-green-600 border border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800/50' : 'bg-neutral-100 text-neutral-500 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700'}\`}>{${raw} ? 'Sim' : 'Não'}</span>`
  }
  if (dt === 'date' || dt === 'timestamp' || dt === 'timestamptz' || dt === 'datetime') {
    return `<span>{${raw} ? new Date(${raw}).toLocaleDateString('pt-BR') : '-'}</span>`
  }
  if (field.config?.options?.length) {
    const optsCode = JSON.stringify(field.config.options)
    return `{(() => { const opts = ${optsCode}; const opt = opts.find((o: any) => o.value === String(${raw})); return opt ? <span className={\`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/50\`} style={opt.color ? { backgroundColor: opt.color + '20', color: opt.color, borderColor: opt.color + '40' } : undefined}>{opt.label}</span> : <span>{String(${raw} ?? '-')}</span> })()}`
  }
  if (field.config?.format === 'currency') {
    return `<span>{${raw} != null ? Number(${raw}).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</span>`
  }
  if (field.config?.format === 'percent') {
    return `<span>{${raw} != null ? Number(${raw}).toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 1 }) : '-'}</span>`
  }
  return `<span>{String(${raw} ?? '-')}</span>`
}

/**
 * Gera o trecho JSX para um campo de formulário.
 * Replica o mapeamento de input do Runtime.
 */
function getColSpanClass(field: ResolvedField): string {
  const cfg = field.config || {}
  const comp = cfg.component || {}
  const layout = cfg.layout || {}
  const layoutPadrao = cfg.layout_padrao || comp.layout_padrao || {}

  const rawCols =
    comp.gridSpan ??
    comp.modalGridSpan ??
    cfg.gridSpan ??
    cfg.grid_span ??
    cfg.modalGridSpan ??
    comp.columns ??
    comp.col_span ??
    comp.colunas ??
    comp.ocupar_colunas ??
    comp.span ??
    layout.columns ??
    layout.col_span ??
    layoutPadrao.colunas ??
    layoutPadrao.ocupar_colunas ??
    cfg.columns ??
    cfg.col_span ??
    cfg.colSpan ??
    cfg.colunas ??
    cfg.ocupar_colunas

  let numCols: number | null = null
  if (typeof rawCols === 'number') {
    numCols = rawCols
  } else if (typeof rawCols === 'string') {
    const match = rawCols.match(/\d+/)
    if (match) numCols = parseInt(match[0], 10)
  }

  if (numCols !== null && numCols > 0) {
    if (numCols >= 12) return 'col-span-12'
    return `col-span-12 md:col-span-${numCols}`
  }

  if (cfg.multiline || comp.type === 'textarea' || field.isByoc || field.isVirtual) {
    return 'col-span-12'
  }

  const w = String(cfg.width || comp.width || '').trim()
  if (w === '50%' || w === '50' || w === 'w-1/2' || w === '6' || w === '6 col') {
    return 'col-span-12 md:col-span-6'
  }
  if (w === '33%' || w === '33.33%' || w === '33.33' || w === '4' || w === '4 col') {
    return 'col-span-12 md:col-span-4'
  }
  if (w === '25%' || w === '25' || w === 'w-1/4' || w === '3' || w === '3 col') {
    return 'col-span-12 md:col-span-3'
  }

  // Fallbacks semânticos alinhados com o padrão do Studio quando não houver config explícita:
  const col = field.dbColumn.toLowerCase()
  if (col === 'nome' || col === 'name' || col === 'razao_social' || col === 'descricao' || col === 'description' || col === 'title' || col === 'titulo') {
    return 'col-span-12 md:col-span-6'
  }
  if (col === 'cnpj' || col === 'cpf' || col === 'cnpj_cpf' || col === 'status' || col.endsWith('_status') || col === 'telefone' || col === 'phone' || col === 'cep') {
    return 'col-span-12 md:col-span-3'
  }
  if (col === 'latitude' || col === 'longitude' || col === 'lat' || col === 'lng') {
    return 'col-span-12 md:col-span-3'
  }
  if (col === 'email') {
    return 'col-span-12 md:col-span-6'
  }

  return 'col-span-12 md:col-span-6'
}

export function getByocComponentName(field: ResolvedField): string {
  if (field.config?.byocName) return toPascalCase(field.config.byocName)
  if (field.config?.componentName) return toPascalCase(field.config.componentName)
  if (field.config?.component?.name) return toPascalCase(field.config.component.name)
  
  const rawId = String(field.id || '').replace(/^byoc_/, '')
  const withoutHash = rawId.replace(/^[a-z0-9]{6,10}_/i, '')
  if (withoutHash && withoutHash.length > 2) {
    return toPascalCase(withoutHash)
  }
  
  const rawLabel = String(field.label || '').replace(/^\[BYOC\]\s*/i, '')
  if (rawLabel) {
    return toPascalCase(rawLabel)
  }
  
  return toPascalCase(rawId) || 'TimelineStatusVendas'
}

function renderFormField(field: ResolvedField, isEdit: boolean, readOnly = false): string {
  const col = field.dbColumn
  const label = field.label
  const dt = field.dataType
  const required = field.config?.required || false
  const placeholder = field.config?.placeholder || `Digite ${label}...`
  const colSpanClass = getColSpanClass(field)

  if (field.isByoc || field.dataType === 'byoc' || field.id.startsWith('byoc_')) {
    const byocComponentName = getByocComponentName(field)
    const byocCleanLabel = field.label.replace(/^\[BYOC\]\s*/i, '')

    return `
          {/* BYOC — ${field.label} */}
          <div className="space-y-3 col-span-12">
            <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">[BYOC] ${byocCleanLabel}</span>
            <${byocComponentName} initialStatus={isEdit ? String(data?.status || data?.Status || 'Novo') : 'Novo'} data={data} />
          </div>`
  }

  const isReadOnly = Boolean(
    readOnly ||
    field.config?.readOnly ||
    field.config?.content?.readonly ||
    field.config?.readonly ||
    field.isVirtual ||
    col.startsWith('virt_')
  )

  let options = field.config?.options
  if (!options || !Array.isArray(options) || options.length === 0) {
    const rawFixed = field.config?.fixed_options || field.config?.component?.fixed_options
    if (typeof rawFixed === 'string' && rawFixed.trim()) {
      options = rawFixed.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean).map((s: string) => {
        if (s.includes(':')) {
          const [l, v] = s.split(':').map((p: string) => p.trim())
          return { label: l || v, value: v || l }
        }
        return { label: s, value: s }
      })
    } else if (col === 'status' || col.endsWith('_status') || label.toLowerCase() === 'status') {
      options = [
        { label: 'Novo', value: 'Novo' },
        { label: 'Contactado', value: 'Contactado' },
        { label: 'Em Negociação', value: 'Em Negociação' },
        { label: 'Fechado Ganho', value: 'Fechado Ganho' },
        { label: 'Perdido', value: 'Perdido' }
      ]
    }
  }

  if (options && Array.isArray(options) && options.length > 0) {
    const optsCode = JSON.stringify(options)
    return `
          <div className="space-y-1.5 ${colSpanClass}">
            <label htmlFor="${col}" className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">${label}${required ? ' *' : ''}</label>
            <select
              id="${col}"
              name="${col}"
              ${required ? 'required' : ''}
              ${isReadOnly ? 'disabled' : ''}
              defaultValue={isEdit ? String(data?.${col} ?? '') : ''}
              className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all disabled:opacity-60"
            >
              <option value="">Selecione...</option>
              {(${optsCode} as Array<{value: string; label: string}>).map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>`
  }

  if (field.config?.relation?.targetTable) {
    const { targetTable, displayColumn, valueColumn } = field.config.relation
    return `
          <div className="space-y-1.5 ${colSpanClass}">
            <label htmlFor="${col}" className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">${label}${required ? ' *' : ''}</label>
            {/* TODO: Carregar lista de ${targetTable} para o select */}
            <select
              id="${col}"
              name="${col}"
              ${required ? 'required' : ''}
              defaultValue={isEdit ? String(data?.${col} ?? '') : ''}
              className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            >
              <option value="">Selecione ${label}...</option>
              {/* TODO: map(${targetTable}List, o => <option value={o.${valueColumn}}>{o.${displayColumn}}</option>) */}
            </select>
          </div>`
  }

  if (dt === 'boolean') {
    return `
          <div className="space-y-1.5 ${colSpanClass}">
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">${label}</label>
            <div className="flex items-center gap-3 py-1">
              <input
                id="${col}"
                name="${col}"
                type="checkbox"
                ${isReadOnly ? 'disabled' : ''}
                defaultChecked={isEdit ? Boolean(data?.${col}) : false}
                className="w-5 h-5 rounded-md border-2 border-neutral-300 dark:border-neutral-600 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="${col}" className="text-sm text-neutral-700 dark:text-neutral-300">${label}</label>
            </div>
          </div>`
  }

  const isDate = dt === 'date' || col.toLowerCase().includes('data') || col.toLowerCase().includes('date')
  if (isDate) {
    return `
          <div className="space-y-1.5 ${colSpanClass}">
            <label htmlFor="${col}" className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">${label}${required ? ' *' : ''}</label>
            <input
              id="${col}"
              name="${col}"
              type="date"
              ${required ? 'required' : ''}
              ${isReadOnly ? 'readOnly disabled' : ''}
              defaultValue={isEdit ? formatDateForInput(data?.${col}) : ''}
              className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all disabled:opacity-60"
            />
          </div>`
  }

  if (dt === 'timestamp' || dt === 'timestamptz' || dt === 'datetime') {
    return `
          <div className="space-y-1.5 ${colSpanClass}">
            <label htmlFor="${col}" className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">${label}${required ? ' *' : ''}</label>
            <input
              id="${col}"
              name="${col}"
              type="datetime-local"
              ${required ? 'required' : ''}
              ${isReadOnly ? 'readOnly disabled' : ''}
              defaultValue={isEdit ? formatDatetimeForInput(data?.${col}) : ''}
              className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all disabled:opacity-60"
            />
          </div>`
  }

  if (field.config?.multiline || field.config?.component?.type === 'textarea') {
    const rows = field.config?.rows || 4
    return `
          <div className="space-y-1.5 ${colSpanClass}">
            <label htmlFor="${col}" className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">${label}${required ? ' *' : ''}</label>
            <textarea
              id="${col}"
              name="${col}"
              rows={${rows}}
              ${required ? 'required' : ''}
              ${isReadOnly ? 'readOnly disabled' : ''}
              placeholder="${placeholder}"
              defaultValue={isEdit ? String(data?.${col} ?? '') : ''}
              className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all disabled:opacity-60 resize-y min-h-[100px]"
            />
          </div>`
  }

  const inputType = (dt === 'integer' || dt === 'numeric' || dt === 'float' || dt === 'double precision' || dt === 'decimal') ? 'number' : 'text'
  const mask = field.config?.mask || field.config?.content?.mask || (col.toLowerCase().includes('cnpj') ? '00.000.000/0000-00' : col.toLowerCase().includes('cpf') ? '000.000.000-00' : col.toLowerCase().includes('cep') ? '00000-000' : (col.toLowerCase().includes('telefone') || col.toLowerCase().includes('phone')) ? '(00) 00000-0000' : '')

  return `
          <div className="space-y-1.5 ${colSpanClass}">
            <label htmlFor="${col}" className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">${label}${required ? ' *' : ''}</label>
            <input
              id="${col}"
              name="${col}"
              type="${inputType}"
              ${required ? 'required' : ''}
              ${isReadOnly ? 'readOnly disabled' : ''}
              placeholder="${placeholder}"
              defaultValue={isEdit ? (formatWithMask(data?.${col}, '${mask}')) : ''}
              ${mask ? `data-mask="${mask}"` : ''}
              className="w-full ${isReadOnly ? 'bg-neutral-100/80 dark:bg-neutral-800/80 font-semibold cursor-not-allowed opacity-90' : 'bg-slate-50 dark:bg-neutral-800'} border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
          </div>`
}

// ─────────────────────────────────────────────────────────────────────────────
// WIP Placeholder (para logic_types não suportados ainda)
// ─────────────────────────────────────────────────────────────────────────────

function generateWipPage(route: RouteNode): string {
  return `import type { Metadata } from 'next'

export const metadata: Metadata = { title: '${route.title}' }

export default function ${route.modelName}Page() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
      <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
      </div>
      <h1 className="text-xl font-black text-neutral-900 dark:text-white mb-2">${route.title}</h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
        Este tipo de visualização (<strong>${route.logicType}</strong>) está em desenvolvimento e será disponibilizado em breve.
      </p>
    </div>
  )
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Listagem (pesquisa_cadastro — page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

function generateListPage(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const hasCreate = route.buttons.some(b => b.actionType === 'create') || route.buttons.length === 0

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
                  <div className={\`transition-opacity \${sortBy === '${col}' ? 'opacity-100' : 'opacity-0 group-hover/th:opacity-100'}\`}>
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
    .map(f => `                <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400 whitespace-nowrap">\n                  ${renderGridCellValue(f)}\n                </td>`)
    .join('\n')

  // Filtros
  const filterFields = route.filterFields.length > 0 ? route.filterFields : route.gridFields.filter(f => !f.isPrimaryKey && !f.isVirtual && !f.isByoc).slice(0, 3)
  const filterInputs = filterFields.map(f => {
    const col = f.dbColumn.replace('.', '_')
    const gridSpan = f.config?.gridSpan || f.config?.component?.gridSpan || 3
    const colSpanClass = `col-span-12 md:col-span-${Math.min(12, gridSpan || 3)}`
    
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

  return `import type { Metadata } from 'next'
import Link from 'next/link'
import { get${mn}List } from '@/app/actions/${mnLower}'
import { delete${mn} } from '@/app/actions/${mnLower}'
import { Plus, Pencil, ChevronLeft, ChevronRight, Receipt, ArrowUpDown, ArrowUp, ArrowDown, Search, RefreshCcw, Download } from 'lucide-react'
import { DynamicIcon } from '@/app/components/DynamicIcon'
import { DeleteButton } from '@/components/ui/delete-button'
import { LimitSelector } from '@/components/ui/limit-selector'

export const metadata: Metadata = { title: '${route.title}' }

export default async function ${mn}ListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const params = await searchParams
  const sortBy = params?.sort_by
  const sortOrder = params?.sort_order || 'asc'
  const page = Math.max(1, parseInt(params?.page || '1', 10) || 1)
  const limit = Math.max(1, parseInt(params?.limit || '15', 10) || 15)

  const rawData = await get${mn}List()

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
    return str ? \`?\${str}\` : ''
  }

  return (
    <div className="p-6 sm:p-10 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Cabeçalho fiel à Web Produção (RuntimeHeader) */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white shrink-0">
            <DynamicIcon icon="${route.icon || 'Users'}" size={24} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                ${route.title}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[10px] font-black text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 tracking-widest uppercase">
                {totalRows} REG
              </span>
            </div>
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
  return `          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95">
            ${b.label}
          </button>`
}).join('\n') || (hasCreate ? `          <Link href="${route.path}/new" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
            <Plus className="w-4 h-4" /> Novo Registro
          </Link>` : '')}
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

      {/* Tabela de Resultados */}
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
                <tr key={item.${route.primaryKey} || idx} className={\`group border-b border-neutral-100 dark:border-neutral-800/50 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors \${idx % 2 === 0 ? '' : 'bg-neutral-50/50 dark:bg-neutral-900/20'}\`}>
                  <td className="px-4 py-4 w-[60px] text-center border-r border-neutral-200/50 dark:border-neutral-700/50">
                    <span className="text-[11px] font-black text-neutral-300 dark:text-neutral-600">{(page - 1) * limit + idx + 1}</span>
                  </td>
${tdCells}
                  <td className="px-4 py-4 text-right border-l border-neutral-200/50 dark:border-neutral-700/50">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link href={\`${route.path}/\${item.${route.primaryKey}}\`} className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all active:scale-90 shadow-sm flex items-center justify-center" title="Visualizar">
                        <Search className="w-3.5 h-3.5" />
                      </Link>
                      <Link href={\`${route.path}/\${item.${route.primaryKey}}\`} className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 border border-neutral-200 dark:border-neutral-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all active:scale-90 shadow-sm flex items-center justify-center" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </Link>
                      <DeleteButton
                        recordName={item.nome || item.name || item.titulo || item.razao_social || String(item.${route.primaryKey})}
                        onDelete={async () => { 'use server'; await delete${mn}(item.${route.primaryKey}) }}
                      />
${route.buttons.filter(b => b.placement === 'row' && b.actionType !== 'view' && b.actionType !== 'edit' && b.actionType !== 'update' && b.actionType !== 'delete').map(b => `
                      <Link href={\`${b.linkTarget || '#'}${b.linkTarget?.includes('?') ? '&' : '?'}${mnLower}_id=\${item.${route.primaryKey}}\`} className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 hover:text-indigo-600 hover:border-indigo-500 transition-all active:scale-90 shadow-sm flex items-center justify-center" title="${b.label}">
                        <DynamicIcon icon="${b.icon || 'Receipt'}" size={14} />
                      </Link>`).join('')}
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
              className={\`p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all \${page <= 1 ? 'opacity-30 pointer-events-none' : ''}\`}
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
                    className={\`w-8 h-8 rounded-lg text-[10px] font-black transition-all flex items-center justify-center \${
                      page === p
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                        : 'text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                    }\`}
                  >
                    {p}
                  </Link>
                ))}
            </div>

            <Link
              href={page < totalPages ? makeQuery({ page: page + 1 }) : '#'}
              className={\`p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all \${page >= totalPages ? 'opacity-30 pointer-events-none' : ''}\`}
            >
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Client Component para Abas de Detalhe ([id]/DetailTabsClient.tsx)
// ─────────────────────────────────────────────────────────────────────────────

function generateDetailTabsClient(route: RouteNode): string {
  const mn = route.modelName
  const pk = route.primaryKey

  const formFieldsHtml = route.formFields
    .map(f => renderFormField(f, true))
    .filter(Boolean)
    .join('\n')

  const hasRelationTabs = route.relationTabs.length > 0

  const tabButtons = hasRelationTabs
    ? route.relationTabs.map((tab, i) => [
        `            <button`,
        `              type="button"`,
        `              onClick={() => setActiveTab(${i + 1})}`,
        `              className={activeTab === ${i + 1}`,
        `                ? 'text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 pb-3 -mb-3.5 tracking-wide transition-all'`,
        `                : 'text-sm font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 pb-3 -mb-3.5 tracking-wide transition-all'}`,
        `            >`,
        `              ${tab.label}`,
        `            </button>`,
      ].join('\n')).join('\n')
    : ''

  const lookupModels = new Map<string, string>()
  if (hasRelationTabs) {
    route.relationTabs.forEach(tab => {
      const allTabFields = tab.formFields && tab.formFields.length > 0 ? tab.formFields : tab.gridFields
      allTabFields.forEach(f => {
        if (f.config?.relation?.targetTable && f.config?.relation?.targetModel) {
          lookupModels.set(f.config.relation.targetTable, f.config.relation.targetModel)
        }
      })
      if (tab.subDetails) {
        tab.subDetails.forEach(sub => {
          const allSubFields = sub.formFields && sub.formFields.length > 0 ? sub.formFields : sub.gridFields
          allSubFields.forEach(f => {
            if (f.config?.relation?.targetTable && f.config?.relation?.targetModel) {
              lookupModels.set(f.config.relation.targetTable, f.config.relation.targetModel)
            }
          })
        })
      }
    })
  }

  const lookupImports = Array.from(lookupModels.entries()).map(([_, modelName]) =>
    `import { get${modelName}List } from '@/app/actions/${modelName.toLowerCase()}'`
  ).join('\n')

  const subDetailModels = new Map<string, string>()
  if (hasRelationTabs) {
    route.relationTabs.forEach(tab => {
      if (tab.subDetails) {
        tab.subDetails.forEach(sub => {
          subDetailModels.set(sub.relatedTable, sub.relatedModelName)
        })
      }
    })
  }

  const subDetailImports = Array.from(subDetailModels.entries()).map(([_, modelName]) =>
    `import { create${modelName}, update${modelName}, delete${modelName} } from '@/app/actions/${modelName.toLowerCase()}'`
  ).join('\n')

  const relationImports = hasRelationTabs
    ? [
        `import { DetailRelationSection } from '@/components/DetailRelationSection'`,
        lookupImports,
        subDetailImports,
        ...route.relationTabs.map(t => `import { create${t.relatedModelName}, update${t.relatedModelName}, delete${t.relatedModelName} } from '@/app/actions/${t.relatedModelName.toLowerCase()}'`),
      ].filter(Boolean).join('\n')
    : ''

  const tabPanels = hasRelationTabs
    ? route.relationTabs.map((tab, i) => {
        const tabFields = (tab.formFields && tab.formFields.length > 0 ? tab.formFields : tab.gridFields)
          .filter(f => !f.dbColumn.includes('.') || f.dbColumn.startsWith(tab.relatedTable + '.'))
        
        const fieldsJson = JSON.stringify(tabFields.map(f => ({
          id: f.id,
          label: f.label,
          dbColumn: f.dbColumn.includes('.') ? f.dbColumn.split('.').pop()! : f.dbColumn,
          dataType: f.dataType,
          isPrimaryKey: f.isPrimaryKey,
          config: f.config,
        })))

        const subDetailsJson = tab.subDetails && tab.subDetails.length > 0
          ? JSON.stringify(tab.subDetails.map(sub => ({
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
            })))
          : '[]'

        const subActionProps = tab.subDetails && tab.subDetails.length > 0
          ? [
              `              createSubAction={create${tab.subDetails[0].relatedModelName}}`,
              `              updateSubAction={update${tab.subDetails[0].relatedModelName}}`,
              `              deleteSubAction={delete${tab.subDetails[0].relatedModelName}}`,
            ].join('\n')
          : ''

        const lookupMappingCode = Array.from(lookupModels.entries()).map(([tTable]) => [
          `                if (targetTable === '${tTable}') {`,
          `                  return {`,
          `                    ...f,`,
          `                    config: {`,
          `                      ...f.config,`,
          `                      // Lookup data is missing in client context right now. We will fetch on mount if needed, or pass as props.`,
          `                      // For now, keeping structure. DetailRelationSection can fetch it via actions.`,
          `                    }`,
          `                  }`,
          `                }`,
        ].join('\n')).join('\n')

        return [
          `          {activeTab === ${i + 1} && (`,
          `            <DetailRelationSection`,
          `              label="${tab.label}"`,
          `              relatedTable="${tab.relatedTable}"`,
          `              foreignKey="${tab.foreignKey}"`,
          `              parentId={id}`,
          `              items={${tab.relatedTable}Items || []}`,
          `              fields={(${fieldsJson} as any[]).map((f: any) => {`,
          `                const targetTable = f.config?.relation?.targetTable`,
          lookupMappingCode,
          `                return f`,
          `              })}`,
          `              subDetails={(${subDetailsJson} as any[]).map((sub: any) => ({`,
          `                ...sub,`,
          `                fields: (sub.fields || []).map((f: any) => {`,
          `                  const targetTable = f.config?.relation?.targetTable`,
          lookupMappingCode,
          `                  return f`,
          `                })`,
          `              }))}`,
          `              createAction={create${tab.relatedModelName}}`,
          `              updateAction={update${tab.relatedModelName}}`,
          `              deleteAction={delete${tab.relatedModelName}}`,
          `              backPath={backPath}`,
          subActionProps,
          `            />`,
          `          )}`,
        ].filter(Boolean).join('\n')
      }).join('\n')
    : ''

  const tabsHeader = hasRelationTabs
    ? `
          {/* Barra de Abas no Topo do Card */}
          <div className="flex items-center gap-8 border-b border-neutral-200 dark:border-neutral-800 pb-3 mb-8 relative z-10">
            <button
              type="button"
              onClick={() => setActiveTab(0)}
              className={activeTab === 0
                ? "text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 pb-3 -mb-3.5 tracking-wide transition-all"
                : "text-sm font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 pb-3 -mb-3.5 tracking-wide transition-all"}
            >
              {title}
            </button>
${tabButtons}
          </div>`
    : ''

  const byocImports = route.formFields
    .filter(f => f.isByoc || f.dataType === 'byoc' || f.id.startsWith('byoc_'))
    .map(f => getByocComponentName(f))
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .map(name => `import { ${name} } from '@/components/${name}'`)
    .join('\n')

  return `'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { DetailMasterForm } from '@/components/DetailMasterForm'
import { DynamicIcon } from '@/app/components/DynamicIcon'
${byocImports ? `${byocImports}\n` : ''}${relationImports}
import { ArrowLeft, Save, Plus, Pencil, Download, Zap } from 'lucide-react'

// TODO: In a more robust approach, lookups should be fetched either in Server Component and passed as props, 
// or fetched in useEffect here. DetailRelationSection might be already handling fetching internally.
// We are adding lookup fetches in useEffect.

${Array.from(lookupModels.entries()).map(([tTable, mName]) => `let cached${tTable}LookupList: any[] = []`).join('\n')}

export function ${mn}DetailTabsClient({
  id,
  data,
  updateAction,
  backPath,
  title,
  icon,
  newPath,
${hasRelationTabs ? route.relationTabs.map((tab) => `  ${tab.relatedTable}Items,`).join('\n') : ''}
}: {
  id: string
  data: any
  updateAction: any
  backPath: string
  title: string
  icon: string
  newPath: string
${hasRelationTabs ? route.relationTabs.map((tab) => `  ${tab.relatedTable}Items?: any[]`).join('\n') : ''}
}) {
  const [activeTab, setActiveTab] = useState(0)

${Array.from(lookupModels.entries()).map(([tTable, mName]) => `  const [${tTable}LookupList, set${tTable}LookupList] = useState<any[]>(cached${tTable}LookupList)`).join('\n')}

  useEffect(() => {
${Array.from(lookupModels.entries()).map(([tTable, mName]) => `
    if (cached${tTable}LookupList.length === 0) {
      get${mName}List().then(list => {
        cached${tTable}LookupList = list
        set${tTable}LookupList(list)
      }).catch(console.error)
    }`).join('\n')}
  }, [])

  return (
    <div className="p-6 sm:p-10 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Cabeçalho Externo da View fiel à Web Produção (RuntimeHeader) */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white shrink-0">
            <DynamicIcon icon={icon} size={24} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                {title}
              </h1>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-8 h-1 bg-indigo-600 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                SISTEMA METABUILDER
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95">
            <Zap className="w-4 h-4 text-neutral-400" /> Automações
          </button>
          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95">
            <Download className="w-4 h-4 text-neutral-400" /> Exportar
          </button>
          <Link href={newPath} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
            <Plus className="w-4 h-4" /> Novo Registro
          </Link>
        </div>
      </div>

      {/* Card Principal de Edição */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] p-8 sm:p-10 shadow-sm relative overflow-hidden space-y-8">
        {/* Cabeçalho Interno do Card */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                {title.endsWith('s') ? title.slice(0, -1) : title}
              </h2>
              <p className="text-xs font-medium text-neutral-400 mt-0.5">
                {String(data?.nome || data?.name || data?.nome_empresa || data?.title || data?.${pk} || '')}
              </p>
            </div>
          </div>

          <Link
            href={backPath}
            className="flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors uppercase tracking-widest"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para Lista
          </Link>
        </div>
${tabsHeader}

        {/* Formulário com Suporte a Abas */}
        {(!${hasRelationTabs} || activeTab === 0) ? (
          <DetailMasterForm id={id} backPath={backPath} title={title} updateAction={updateAction}>
            <div className="grid grid-cols-12 gap-x-6 gap-y-6">
${formFieldsHtml}
            </div>
          </DetailMasterForm>
        ) : (
          <div className="space-y-6">
${tabPanels}
          </div>
        )}
      </div>
    </div>
  )
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Mestre-Detalhe + Edição
// [id]/page.tsx        → Server Component (fetch) → passa props ao Client
// [id]/DetailTabsClient.tsx → 'use client' (gerencia activeTab via useState)
// Isso garante que trocar de aba NUNCA recarrega a página nem perde dados.
// ─────────────────────────────────────────────────────────────────────────────

function generateDetailPage(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const pk = route.primaryKey

  const formFieldsHtml = route.formFields
    .map(f => renderFormField(f, true))
    .filter(Boolean)
    .join('\n')

  const hasRelationTabs = route.relationTabs.length > 0

  const lookupModels = new Map<string, string>()
  if (hasRelationTabs) {
    route.relationTabs.forEach(tab => {
      const allTabFields = tab.formFields && tab.formFields.length > 0 ? tab.formFields : tab.gridFields
      allTabFields.forEach(f => {
        if (f.config?.relation?.targetTable && f.config?.relation?.targetModel) {
          lookupModels.set(f.config.relation.targetTable, f.config.relation.targetModel)
        }
      })
      if (tab.subDetails) {
        tab.subDetails.forEach(sub => {
          const allSubFields = sub.formFields && sub.formFields.length > 0 ? sub.formFields : sub.gridFields
          allSubFields.forEach(f => {
            if (f.config?.relation?.targetTable && f.config?.relation?.targetModel) {
              lookupModels.set(f.config.relation.targetTable, f.config.relation.targetModel)
            }
          })
        })
      }
    })
  }

  const lookupImports = Array.from(lookupModels.entries()).map(([_, modelName]) =>
    `import { get${modelName}List } from '@/app/actions/${modelName.toLowerCase()}'`
  ).join('\n')

  const lookupQueries = Array.from(lookupModels.entries()).map(([table, modelName]) =>
    `  const ${table}LookupList = await get${modelName}List().catch(() => [])\n`
  ).join('')

  const subDetailModels = new Map<string, string>()
  if (hasRelationTabs) {
    route.relationTabs.forEach(tab => {
      if (tab.subDetails) {
        tab.subDetails.forEach(sub => {
          subDetailModels.set(sub.relatedTable, sub.relatedModelName)
        })
      }
    })
  }

  const subDetailImports = Array.from(subDetailModels.entries()).map(([_, modelName]) =>
    `import { get${modelName}List, create${modelName}, update${modelName}, delete${modelName} } from '@/app/actions/${modelName.toLowerCase()}'`
  ).join('\n')

  const subDetailQueries = Array.from(subDetailModels.entries()).map(([table, modelName]) =>
    `  const ${table}AllList = await get${modelName}List().catch(() => [])\n`
  ).join('')

  const relationImports = hasRelationTabs
    ? [
        `import { DetailRelationSection } from '@/components/DetailRelationSection'`,
        lookupImports,
        subDetailImports,
        ...route.relationTabs.map(t => `import { get${t.relatedModelName}ByField, create${t.relatedModelName}, update${t.relatedModelName}, delete${t.relatedModelName} } from '@/app/actions/${t.relatedModelName.toLowerCase()}'`),
      ].filter(Boolean).join('\n')
    : ''

  const relationQueries = hasRelationTabs
    ? [
        lookupQueries,
        subDetailQueries,
        ...route.relationTabs.map((tab) => {
          const rawQuery = `  const ${tab.relatedTable}ListRaw = await get${tab.relatedModelName}ByField('${tab.foreignKey}', resolvedParams.id)\n`
          if (tab.subDetails && tab.subDetails.length > 0) {
            const sub = tab.subDetails[0]
            return (
              rawQuery +
              `  const ${tab.relatedTable}List = (${tab.relatedTable}ListRaw || []).map((row: any) => {\n` +
              `    const rowId = String(row.id || row.codigo || '')\n` +
              `    const childItems = (${sub.relatedTable}AllList || []).filter((subRow: any) => {\n` +
              `      const fkVal = String(subRow['${sub.foreignKey}'] || subRow['id_${tab.relatedTable}'] || subRow['${tab.relatedTable}_id'] || subRow['${tab.relatedTable}'] || '')\n` +
              `      return fkVal === rowId\n` +
              `    })\n` +
              `    return { ...row, items: childItems, itens_pedido: childItems, _details: childItems }\n` +
              `  })\n`
            )
          }
          return rawQuery + `  const ${tab.relatedTable}List = ${tab.relatedTable}ListRaw || []\n`
        })
      ].filter(Boolean).join('')
    : ''

  const byocImports = route.formFields
    .filter(f => f.isByoc || f.dataType === 'byoc' || f.id.startsWith('byoc_'))
    .map(f => getByocComponentName(f))
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .map(name => `import { ${name} } from '@/components/${name}'`)
    .join('\n')

  return `import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { get${mn}ById, update${mn} } from '@/app/actions/${mnLower}'
${byocImports ? `${byocImports}\n` : ''}${relationImports}
import { ${mn}DetailTabsClient } from './DetailTabsClient'

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

function formatWithMask(v: any, mask?: string) {
  if (!v && v !== 0) return ''
  const s = String(v)
  if (mask === '00.000.000/0000-00' || (!mask && (s.length === 14 || /^\\d{14}$/.test(s)))) {
    const d = s.replace(/\\D/g, '')
    if (d.length === 14) {
      return \`\${d.slice(0, 2)}.\${d.slice(2, 5)}.\${d.slice(5, 8)}/\${d.slice(8, 12)}-\${d.slice(12, 14)}\`
    }
  }
  if (mask === '000.000.000-00' || (!mask && (s.length === 11 || /^\\d{11}$/.test(s)))) {
    const d = s.replace(/\\D/g, '')
    if (d.length === 11) {
      return \`\${d.slice(0, 3)}.\${d.slice(3, 6)}.\${d.slice(6, 9)}-\${d.slice(9, 11)}\`
    }
  }
  if (mask === '00000-000') {
    const d = s.replace(/\\D/g, '')
    if (d.length === 8) return \`\${d.slice(0, 5)}-\${d.slice(5, 8)}\`
  }
  if (mask === '(00) 00000-0000') {
    const d = s.replace(/\\D/g, '')
    if (d.length === 11) return \`(\${d.slice(0, 2)}) \${d.slice(2, 7)}-\${d.slice(7, 11)}\`
    if (d.length === 10) return \`(\${d.slice(0, 2)}) \${d.slice(2, 6)}-\${d.slice(6, 10)}\`
  }
  return s
}

export const metadata: Metadata = { title: 'Editar \u2014 ${route.title}' }

export default async function ${mn}DetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params
  const data = await get${mn}ById(resolvedParams.id)

  if (!data) notFound()

${relationQueries}
  return (
    <${mn}DetailTabsClient
      id={resolvedParams.id}
      data={data}
      updateAction={update${mn}}
      backPath="${route.path}"
      title="${route.title}"
      icon="${route.icon || 'Users'}"
      newPath="${route.path}/new"
${hasRelationTabs ? route.relationTabs.map((tab) => `      ${tab.relatedTable}Items={${tab.relatedTable}List || []}`).join('\n') : ''}
    />
  )
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Cadastro (new/page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

function generateNewPage(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()

  const formFieldsHtml = route.formFields
    .map(f => renderFormField(f, false))
    .filter(Boolean)
    .join('\n')

  const byocImports = route.formFields
    .filter(f => f.isByoc || f.dataType === 'byoc' || f.id.startsWith('byoc_'))
    .map(f => getByocComponentName(f))
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .map(name => `import { ${name} } from '@/components/${name}'`)
    .join('\n')

  return `import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { create${mn} } from '@/app/actions/${mnLower}'
${byocImports ? `${byocImports}\n` : ''}import { DynamicIcon } from '@/app/components/DynamicIcon'
import { ArrowLeft, Save, Plus, Download, Zap } from 'lucide-react'

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

function formatWithMask(v: any, mask?: string) {
  if (!v && v !== 0) return ''
  const s = String(v)
  if (mask === '00.000.000/0000-00' || (!mask && (s.length === 14 || /^\\d{14}$/.test(s)))) {
    const d = s.replace(/\\D/g, '')
    if (d.length === 14) {
      return \`\${d.slice(0, 2)}.\${d.slice(2, 5)}.\${d.slice(5, 8)}/\${d.slice(8, 12)}-\${d.slice(12, 14)}\`
    }
  }
  if (mask === '000.000.000-00' || (!mask && (s.length === 11 || /^\\d{11}$/.test(s)))) {
    const d = s.replace(/\\D/g, '')
    if (d.length === 11) {
      return \`\${d.slice(0, 3)}.\${d.slice(3, 6)}.\${d.slice(6, 9)}-\${d.slice(9, 11)}\`
    }
  }
  if (mask === '00000-000') {
    const d = s.replace(/\\D/g, '')
    if (d.length === 8) return \`\${d.slice(0, 5)}-\${d.slice(5, 8)}\`
  }
  if (mask === '(00) 00000-0000') {
    const d = s.replace(/\\D/g, '')
    if (d.length === 11) return \`(\${d.slice(0, 2)}) \${d.slice(2, 7)}-\${d.slice(7, 11)}\`
    if (d.length === 10) return \`(\${d.slice(0, 2)}) \${d.slice(2, 6)}-\${d.slice(6, 10)}\`
  }
  return s
}

export const metadata: Metadata = { title: 'Novo — ${route.title}' }

export default function ${mn}NewPage() {
  const isEdit = false
  const data: any = {}

  return (
    <div className="p-6 sm:p-10 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Cabeçalho Externo da View fiel à Web Produção (RuntimeHeader) */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white shrink-0">
            <DynamicIcon icon="${route.icon || 'Users'}" size={24} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                ${route.title}
              </h1>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-8 h-1 bg-indigo-600 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                SISTEMA METABUILDER
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="${route.path}" className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95">
            <ArrowLeft className="w-4 h-4" /> Voltar para Lista
          </Link>
        </div>
      </div>

      {/* Card Principal de Cadastro */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] p-8 sm:p-10 shadow-sm relative overflow-hidden space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
              Novo ${route.title.endsWith('s') ? route.title.slice(0, -1) : route.title}
            </h2>
            <p className="text-xs font-medium text-neutral-400 mt-0.5">
              Preencha os campos para criar um novo registro no sistema.
            </p>
          </div>
        </div>

        <form action={async (formData: FormData) => {
          'use server'
          const payload: Record<string, any> = {}
          formData.forEach((v, k) => { payload[k] = v })
          const result = await create${mn}(payload)
          if (result?.id) redirect(\`${route.path}/\${result.id}\`)
          else redirect('${route.path}')
        }}>
          <div className="grid grid-cols-12 gap-x-6 gap-y-6">
${formFieldsHtml}
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-neutral-200 dark:border-neutral-800 mt-8">
            <Link
              href="${route.path}"
              className="px-6 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
            >
              <Save className="w-4 h-4" /> Criar Registro
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

export function generateRoutes(ast: AppAST, files: Map<string, string>) {
  for (const route of ast.routes) {
    const routeDir = `app/(protected)${route.path}`

    if (route.logicType === 'pesquisa_cadastro' || route.logicType === 'personalizado') {
      // Listagem
      files.set(`${routeDir}/page.tsx`, generateListPage(route))
      // Mestre-Detalhe + Edição (formulário + abas de relacionamento)
      files.set(`${routeDir}/[id]/page.tsx`, generateDetailPage(route))
      files.set(`${routeDir}/[id]/DetailTabsClient.tsx`, generateDetailTabsClient(route))
      // Criação
      files.set(`${routeDir}/new/page.tsx`, generateNewPage(route))
    } else {
      // Placeholder "Em desenvolvimento" para outros tipos
      files.set(`${routeDir}/page.tsx`, generateWipPage(route))
    }
  }
}

