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

  if (numCols === null) {
    const w = String(cfg.width || comp.width || '').trim()
    if (w === '100%' || w === '100' || w === 'w-full' || cfg.multiline || comp.type === 'textarea' || field.isByoc || field.isVirtual) {
      numCols = 12
    } else if (w === '50%' || w === '50' || w === 'w-1/2') {
      numCols = 6
    } else if (w === '33%' || w === '33.33%' || w === '33.33') {
      numCols = 4
    } else if (w === '25%' || w === '25' || w === 'w-1/4') {
      numCols = 3
    }
  }

  if (!numCols) {
    numCols = 6
  }

  if (numCols >= 12) return 'col-span-12'
  if (numCols === 6) return 'col-span-12 md:col-span-6'
  if (numCols === 4) return 'col-span-12 md:col-span-4'
  if (numCols === 3) return 'col-span-12 md:col-span-3'
  if (numCols === 2) return 'col-span-12 md:col-span-2'
  if (numCols === 1) return 'col-span-12 md:col-span-1'
  if (numCols === 8) return 'col-span-12 md:col-span-8'
  if (numCols === 9) return 'col-span-12 md:col-span-9'
  return `col-span-12 md:col-span-${numCols}`
}

function renderFormField(field: ResolvedField, isEdit: boolean, readOnly = false): string {
  const col = field.dbColumn
  const label = field.label
  const dt = field.dataType
  const required = field.config?.required || false
  const placeholder = field.config?.placeholder || `Digite ${label}...`
  const colSpanClass = getColSpanClass(field)

  if (field.isByoc || field.isVirtual) {
    const byocName = field.config?.byocName || field.id.replace(/^byoc_/, '')
    const byocComponentName = toPascalCase(byocName)

    if (byocName.toLowerCase().includes('timeline') || byocName.toLowerCase().includes('status')) {
      const steps = ['Novo', 'Contactado', 'Em Negociação', 'Fechado Ganho']
      return `
          {/* BYOC — ${field.label} */}
          <div className="space-y-3 col-span-12">
            <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">[BYOC] ${field.label}</span>
            <div className="bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 shadow-inner">
              <div className="flex items-center justify-between relative">
                <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-indigo-600 dark:bg-indigo-600/50 rounded-full" />
                <div className="absolute left-6 right-1/4 top-1/2 -translate-y-1/2 h-1 bg-indigo-600 rounded-full" />
                {${JSON.stringify(steps)}.map((st, i) => {
                  const isPassed = i < 2
                  const isCurrent = i === 2
                  return (
                    <div key={st} className="flex flex-col items-center gap-2 relative z-10">
                      <div className={\`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all \${isCurrent ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20' : isPassed ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-600 text-neutral-400'}\`}>
                        {isPassed ? '✓' : i + 1}
                      </div>
                      <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">{st}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>`
    }
    return `
          {/* TODO: campo virtual/BYOC — ${field.label} */}
          <div className="space-y-2 col-span-12 opacity-50 pointer-events-none">
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">${label} <span className="text-[9px] normal-case text-amber-500">[Em desenvolvimento]</span></label>
            <input disabled value="// TODO" className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm" />
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

  if (field.config?.options?.length) {
    const optsCode = JSON.stringify(field.config.options)
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
              defaultValue={isEdit ? String(data?.${col} ?? '') : ''}
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

  // Cabeçalhos da tabela
  const thCells = route.gridFields
    .filter(f => !f.hidden)
    .map(f => `              <th className="px-6 py-4 text-[10px] font-black text-neutral-400 dark:text-neutral-500 tracking-[0.15em] whitespace-nowrap">${f.label.toUpperCase()}</th>`)
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
    if (f.config?.options?.length) {
      const optsCode = JSON.stringify(f.config.options)
      return `
          <div className="space-y-1.5">
            <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">${f.label}</label>
            <select
              name="${col}_filter"
              className="flex h-10 w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            >
              <option value="">Todos</option>
              {(${optsCode} as Array<{value: string; label: string}>).map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>`
    }
    return `
          <div className="space-y-1.5">
            <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">${f.label}</label>
            <input
              type="search"
              name="${col}_filter"
              placeholder="Filtrar por ${f.label.toLowerCase()}..."
              className="flex h-10 w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
          </div>`
  }).join('\n')

  return `import type { Metadata } from 'next'
import Link from 'next/link'
import { get${mn}List } from '@/app/actions/${mnLower}'
import { delete${mn} } from '@/app/actions/${mnLower}'
import { Plus, Pencil, Eye, ChevronLeft, ChevronRight, Receipt } from 'lucide-react'
import { DeleteButton } from '@/components/ui/delete-button'

export const metadata: Metadata = { title: '${route.title}' }

export default async function ${mn}ListPage() {
  const data = await get${mn}List()

  return (
    <div className="p-6 sm:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/10 flex items-center justify-center ring-1 ring-indigo-500/20">
            <span className="text-xl font-bold text-indigo-600">{String('${mn}').charAt(0)}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              ${route.title}
              <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 tracking-wider">
                {data.length} REG
              </span>
            </h1>
            <p className="text-xs font-black tracking-widest text-neutral-400 dark:text-neutral-500 mt-1 uppercase">${route.logicType.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
${route.buttons.filter(b => b.placement === 'header').map(b => {
  if (b.actionType === 'create') {
    return `          <Link href="${route.path}/new" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold tracking-wide transition-colors shadow-lg shadow-indigo-500/20">
            <Plus className="w-4 h-4" /> ${b.label}
          </Link>`
  }
  if (b.actionType === 'export') {
    return `          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-xs font-bold tracking-wide transition-all">
            ${b.label}
          </button>`
  }
  return `          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-xs font-bold tracking-wide transition-all">
            {/* TODO: ${b.label} — ${b.actionType} */}
            ${b.label}
          </button>`
}).join('\n') || (hasCreate ? `          <Link href="${route.path}/new" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold tracking-wide transition-colors shadow-lg shadow-indigo-500/20">
            <Plus className="w-4 h-4" /> Novo ${route.title}
          </Link>` : '')}
        </div>
      </div>

      {/* Filtros */}
      <div className="p-5 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
${filterInputs}
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold tracking-wide transition-colors flex-1 md:flex-none">
            Pesquisar
          </button>
          <button type="reset" className="px-5 py-2.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 text-xs font-bold tracking-wide transition-colors">
            Limpar
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] overflow-hidden shadow-xl dark:shadow-none backdrop-blur-sm flex flex-col w-full">
        <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                <th className="px-4 py-4 w-[60px] border-r border-neutral-200/50 dark:border-neutral-700/50 text-[10px] font-black text-neutral-400 dark:text-neutral-500 tracking-[0.15em]">#</th>
${thCells}
                <th className="px-4 py-4 text-right text-[10px] font-black text-neutral-400 dark:text-neutral-500 tracking-[0.15em] border-l border-neutral-200/50 dark:border-neutral-700/50">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item: any, idx: number) => (
                <tr key={item.${route.primaryKey}} className={\`group border-b border-neutral-100 dark:border-neutral-800/50 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors \${idx % 2 === 0 ? '' : 'bg-neutral-50/50 dark:bg-neutral-900/20'}\`}>
                  <td className="px-4 py-4 w-[60px] text-center border-r border-neutral-200/50 dark:border-neutral-700/50">
                    <span className="text-[11px] font-black text-neutral-300 dark:text-neutral-600">{idx + 1}</span>
                  </td>
${tdCells}
                  <td className="px-4 py-4 text-right border-l border-neutral-200/50 dark:border-neutral-700/50">
                    <div className="flex items-center justify-end gap-1">
${(() => {
  const rowBtns = route.buttons.filter(b => b.placement === 'row')
  if (rowBtns.length === 0) {
    return [
      `                      <Link href={\`${route.path}/\${item.${route.primaryKey}}\`} className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all" title="Visualizar"><Eye className="w-4 h-4" /></Link>`,
      `                      <Link href={\`${route.path}/\${item.${route.primaryKey}}\`} className="w-8 h-8 rounded-full flex items-center justify-center text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/30 transition-all" title="Editar"><Pencil className="w-4 h-4" /></Link>`,
      `                      <form action={async () => { 'use server'; await delete${mn}(item.${route.primaryKey}) }}><DeleteButton /></form>`,
    ].join('\n')
  }
  return rowBtns.map(b => {
    if (b.actionType === 'view') {
      return `                      <Link href={\`${route.path}/\${item.${route.primaryKey}}\`} className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all" title="${b.label}"><Eye className="w-4 h-4" /></Link>`
    }
    if (b.actionType === 'update' || b.actionType === 'edit') {
      return `                      <Link href={\`${route.path}/\${item.${route.primaryKey}}\`} className="w-8 h-8 rounded-full flex items-center justify-center text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/30 transition-all" title="${b.label}"><Pencil className="w-4 h-4" /></Link>`
    }
    if (b.actionType === 'delete') {
      return `                      <form action={async () => { 'use server'; await delete${mn}(item.${route.primaryKey}) }}><DeleteButton /></form>`
    }
    if (b.linkTarget) {
      return `                      <Link href={\`${b.linkTarget}?${mnLower}_id=\${item.${route.primaryKey}}\`} className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:text-indigo-600 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all" title="${b.label}"><Receipt className="w-4 h-4" /></Link>`
    }
    return `                      <button type="button" className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:text-indigo-600 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all" title="${b.label}"><Receipt className="w-4 h-4" /></button>`
  }).join('\n')
})()}
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={${route.gridFields.filter(f => !f.hidden).length + 2}} className="h-48 text-center">
                    <p className="text-neutral-400 dark:text-neutral-600 text-sm">Nenhum registro encontrado.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-8 py-4 bg-neutral-50/50 dark:bg-neutral-900/50 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">{data.length} registro{data.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Mestre-Detalhe + Edição ([id]/page.tsx) — Server Component puro
// Abas no topo do card via searchParams (?tab=0) para perfeita paridade com Web
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

  const tabButtons = hasRelationTabs
    ? route.relationTabs.map((tab, i) => [
        `            <Link`,
        `              href={\`?tab=${i + 1}\`}`,
        `              scroll={false}`,
        `              className={activeTab === ${i + 1}`,
        `                ? 'text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 pb-3 -mb-3.5 tracking-wide transition-all'`,
        `                : 'text-sm font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 pb-3 -mb-3.5 tracking-wide transition-all'}`,
        `            >`,
        `              ${tab.label}`,
        `            </Link>`,
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
    `import { get${modelName}List } from '@/app/actions/${modelName.toLowerCase()}'`
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

        const lookupMappingCode = Array.from(lookupModels.entries()).map(([tTable]) => [
          `                if (targetTable === '${tTable}') {`,
          `                  return {`,
          `                    ...f,`,
          `                    config: {`,
          `                      ...f.config,`,
          `                      options: (${tTable}LookupList || []).map((r: any) => ({`,
          `                        value: String(r.id ?? r.codigo ?? r.uuid ?? ''),`,
          `                        label: String(r.nome || r.nome_completo || r.nome_empresa || r.name || r.title || r.id || ''),`,
          `                      }))`,
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
          `              parentId={resolvedParams.id}`,
          `              items={${tab.relatedTable}List || []}`,
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
          `            />`,
          `          )}`,
        ].join('\n')
      }).join('\n')
    : ''

  const tabSearchParamType = hasRelationTabs
    ? `{\n  params: Promise<{ id: string }>\n  searchParams?: Promise<Record<string, string | string[] | undefined>>\n}`
    : `{\n  params: Promise<{ id: string }>\n}`

  const tabSearchParamArg = hasRelationTabs
    ? `  params,\n  searchParams,\n`
    : `  params,\n`

  const activeTabResolution = hasRelationTabs
    ? `\n  const resolvedSearch = searchParams ? await searchParams : {}\n  const activeTab = Number(typeof resolvedSearch?.tab === 'string' ? resolvedSearch.tab : 0)\n`
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

  const tabsHeader = hasRelationTabs
    ? `
          {/* Barra de Abas no Topo do Card */}
          <div className="flex items-center gap-8 border-b border-neutral-200 dark:border-neutral-800 pb-3 mb-8 relative z-10">
            <Link
              href="?tab=0"
              scroll={false}
              className={activeTab === 0
                ? "text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 pb-3 -mb-3.5 tracking-wide transition-all"
                : "text-sm font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 pb-3 -mb-3.5 tracking-wide transition-all"}
            >
              ${route.title}
            </Link>
${tabButtons}
          </div>`
    : ''

  return `import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { get${mn}ById, update${mn} } from '@/app/actions/${mnLower}'
import { DetailMasterForm } from '@/components/DetailMasterForm'
${relationImports}
import { ArrowLeft, Save, Plus, Pencil } from 'lucide-react'

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

export const metadata: Metadata = { title: 'Editar \u2014 ${route.title}' }

export default async function ${mn}DetailPage({
${tabSearchParamArg}}: ${tabSearchParamType}) {
  const resolvedParams = await params
  const data = await get${mn}ById(resolvedParams.id)

  if (!data) notFound()
${activeTabResolution}
${relationQueries}  const isEdit = true

  return (
    <div className="p-6 sm:p-8 max-w-[1200px] mx-auto pb-24">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Pencil className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-0.5">${route.title}</h1>
            <p className="text-sm text-neutral-400">{String(data.nome || data.name || data.nome_empresa || data.title || data.${pk} || '')}</p>
          </div>
        </div>
        <Link href="${route.path}" className="inline-flex items-center text-xs font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors uppercase tracking-widest">
          <ArrowLeft className="w-3.5 h-3.5 mr-2" /> Voltar para Lista
        </Link>
      </div>

      {/* Card Principal */}
      <div className="bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] pointer-events-none rounded-full" />
${tabsHeader}

        {/* Conteúdo da Aba Mestre (Tab 0) */}
        {(!${hasRelationTabs} || activeTab === 0) && (
          <DetailMasterForm id={resolvedParams.id} backPath="${route.path}" title="${route.title}" updateAction={update${mn}}>
            <div className="grid grid-cols-12 gap-x-6 gap-y-5">
${formFieldsHtml}
            </div>
          </DetailMasterForm>
        )}

${tabPanels}
      </div>
    </div>
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

  return `import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { create${mn} } from '@/app/actions/${mnLower}'
import { ArrowLeft, Save } from 'lucide-react'

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

export const metadata: Metadata = { title: 'Novo — ${route.title}' }

export default function ${mn}NewPage() {
  const isEdit = false
  const data: any = {}

  return (
    <div className="p-6 sm:p-8 max-w-[1200px] mx-auto pb-24">
      <Link href="${route.path}" className="inline-flex items-center text-xs font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors mb-6 uppercase tracking-widest">
        <ArrowLeft className="w-3 h-3 mr-2" /> Voltar para ${route.title}
      </Link>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
          <span className="text-2xl font-black text-indigo-600">+</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">Novo ${route.title}</h1>
          <p className="text-sm text-neutral-400">Preencha os campos para criar um novo registro.</p>
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
        <div className="bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] pointer-events-none rounded-full" />
          <div className="grid grid-cols-12 gap-x-6 gap-y-5 relative z-10">
${formFieldsHtml}
          </div>

          <div className="flex justify-end pt-6 border-t border-neutral-200 dark:border-neutral-800 mt-6">
            <button type="submit" className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm tracking-wide transition-colors shadow-lg shadow-indigo-500/20">
              <Save className="w-4 h-4" /> Criar ${route.title}
            </button>
          </div>
        </div>
      </form>
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
      // Criação
      files.set(`${routeDir}/new/page.tsx`, generateNewPage(route))
    } else {
      // Placeholder "Em desenvolvimento" para outros tipos
      files.set(`${routeDir}/page.tsx`, generateWipPage(route))
    }
  }
}

