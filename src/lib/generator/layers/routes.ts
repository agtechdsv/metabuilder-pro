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
function renderFormField(field: ResolvedField, isEdit = false): string {
  const col = field.dbColumn.replace(/\./g, '_')
  const label = field.label || field.dbColumn
  const required = field.config?.required || false
  const placeholder = field.config?.placeholder || ''
  const readOnly = field.config?.readOnly || field.isPrimaryKey
  const dt = (field.dataType || '').toLowerCase()

  if (field.isPrimaryKey && !isEdit) return '' // não renderiza PK no form de criação

  if (field.isByoc || field.isVirtual) {
    return `
          {/* TODO: campo virtual/BYOC — ${field.label} */}
          <div className="space-y-2 opacity-50 pointer-events-none">
            <label className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">${label} <span className="text-[9px] normal-case text-amber-500">[Em desenvolvimento]</span></label>
            <input disabled value="// TODO" className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-3 text-sm" />
          </div>`
  }

  if (field.config?.options?.length) {
    const optsCode = JSON.stringify(field.config.options)
    return `
          <div className="space-y-2">
            <label htmlFor="${col}" className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">${label}${required ? ' *' : ''}</label>
            <select
              id="${col}"
              name="${col}"
              ${required ? 'required' : ''}
              ${readOnly ? 'disabled' : ''}
              defaultValue={isEdit ? String(data?.${col} ?? '') : ''}
              className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all disabled:opacity-60"
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
          <div className="space-y-2">
            <label htmlFor="${col}" className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">${label}${required ? ' *' : ''}</label>
            {/* TODO: Carregar lista de ${targetTable} para o select */}
            <select
              id="${col}"
              name="${col}"
              ${required ? 'required' : ''}
              defaultValue={isEdit ? String(data?.${col} ?? '') : ''}
              className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            >
              <option value="">Selecione ${label}...</option>
              {/* TODO: map(${targetTable}List, o => <option value={o.${valueColumn}}>{o.${displayColumn}}</option>) */}
            </select>
          </div>`
  }

  if (dt === 'boolean') {
    return `
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">${label}</label>
            <div className="flex items-center gap-3 py-1">
              <input
                id="${col}"
                name="${col}"
                type="checkbox"
                ${readOnly ? 'disabled' : ''}
                defaultChecked={isEdit ? Boolean(data?.${col}) : false}
                className="w-5 h-5 rounded-md border-2 border-neutral-300 dark:border-neutral-600 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="${col}" className="text-sm text-neutral-700 dark:text-neutral-300">${label}</label>
            </div>
          </div>`
  }

  if (dt === 'date') {
    return `
          <div className="space-y-2">
            <label htmlFor="${col}" className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">${label}${required ? ' *' : ''}</label>
            <input
              id="${col}"
              name="${col}"
              type="date"
              ${required ? 'required' : ''}
              ${readOnly ? 'readOnly disabled' : ''}
              defaultValue={isEdit && data?.${col} ? String(data.${col}).slice(0, 10) : ''}
              className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all disabled:opacity-60"
            />
          </div>`
  }

  if (field.config?.multiline || dt === 'text') {
    const rows = field.config?.rows || 4
    return `
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="${col}" className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">${label}${required ? ' *' : ''}</label>
            <textarea
              id="${col}"
              name="${col}"
              rows={${rows}}
              ${required ? 'required' : ''}
              ${readOnly ? 'readOnly disabled' : ''}
              placeholder="${placeholder}"
              defaultValue={isEdit ? String(data?.${col} ?? '') : ''}
              className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all disabled:opacity-60 resize-y min-h-[100px]"
            />
          </div>`
  }

  const inputType = (dt === 'integer' || dt === 'numeric' || dt === 'float' || dt === 'double precision' || dt === 'decimal') ? 'number'
    : (dt === 'timestamp' || dt === 'timestamptz' || dt === 'datetime') ? 'datetime-local'
    : 'text'

  return `
          <div className="space-y-2">
            <label htmlFor="${col}" className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">${label}${required ? ' *' : ''}</label>
            <input
              id="${col}"
              name="${col}"
              type="${inputType}"
              ${required ? 'required' : ''}
              ${readOnly ? 'readOnly disabled' : ''}
              placeholder="${placeholder}"
              defaultValue={isEdit ? String(data?.${col} ?? '') : ''}
              className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
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
import { Plus, Pencil, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
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
    const iconContent = b.icon
      ? `<span className="text-sm font-black">${b.icon}</span>`
      : `<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`
    return `                      <button type="button" className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:text-indigo-600 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all" title="${b.label}">${iconContent}</button>`
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
// Abas via searchParams (?tab=0) para compatibilidade com metadata e server actions
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
        `          <Link`,
        `            href={\`?tab=${i}\`}`,
        `            scroll={false}`,
        `            className={activeTab === ${i}`,
        `              ? 'px-6 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-lg shadow-lg shadow-indigo-500/20 transition-all'`,
        `              : 'px-6 py-2.5 text-neutral-500 dark:text-neutral-400 font-semibold text-sm rounded-lg hover:text-neutral-700 dark:hover:text-neutral-200 transition-all'}`,
        `          >`,
        `            ${tab.label}`,
        `          </Link>`,
      ].join('\n')).join('\n')
    : ''

  const tabPanels = hasRelationTabs
    ? route.relationTabs.map((tab, i) => [
        `        {activeTab === ${i} && (`,
        `          <div>`,
        `            <div className="flex items-center justify-between mb-4">`,
        `              <h3 className="text-base font-bold text-neutral-900 dark:text-white">${tab.label}</h3>`,
        `              <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500">${tab.relatedTable} (${tab.foreignKey} = {String(data.${pk} ?? '')})</span>`,
        `            </div>`,
        `            {/* TODO: Carregar registros filhos de ${tab.relatedTable} onde ${tab.foreignKey} = data.${pk} */}`,
        `            <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-8">Nenhum registro encontrado em ${tab.label}.</p>`,
        `          </div>`,
        `        )}`,
      ].join('\n')).join('\n')
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

  const tabsSection = hasRelationTabs
    ? [
        '',
        '      {/* Abas de relacionamento (Mestre-Detalhe) */}',
        '      <div className="mt-6">',
        '        <div className="flex gap-2 mb-4 p-1.5 bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-x-auto">',
        tabButtons,
        '        </div>',
        '        <div className="bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">',
        tabPanels,
        '        </div>',
        '      </div>',
      ].join('\n')
    : ''

  return `import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { get${mn}ById, update${mn} } from '@/app/actions/${mnLower}'
import { ArrowLeft, Save } from 'lucide-react'

export const metadata: Metadata = { title: 'Editar \u2014 ${route.title}' }

export default async function ${mn}DetailPage({
${tabSearchParamArg}}: ${tabSearchParamType}) {
  const resolvedParams = await params
  const data = await get${mn}ById(resolvedParams.id)

  if (!data) notFound()
${activeTabResolution}
  return (
    <div className="p-6 sm:p-8 max-w-[1200px] mx-auto pb-24">
      <Link href="${route.path}" className="inline-flex items-center text-xs font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors mb-6 uppercase tracking-widest">
        <ArrowLeft className="w-3 h-3 mr-2" /> Voltar para ${route.title}
      </Link>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
          <span className="text-2xl font-black text-indigo-600">{String(data.${pk} ?? '?').charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">Editar ${route.title}</h1>
          <p className="text-sm text-neutral-400">ID: {String(data.${pk} ?? '').slice(0, 8)}...</p>
        </div>
      </div>

      <form action={async (formData: FormData) => {
        'use server'
        const payload: Record<string, any> = {}
        formData.forEach((v, k) => { payload[k] = v })
        await update${mn}(resolvedParams.id, payload)
      }}>
        <div className="bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-8 shadow-xl relative overflow-hidden mb-6">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] pointer-events-none rounded-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 relative z-10">
${formFieldsHtml}
          </div>

          <div className="flex justify-end pt-6 border-t border-neutral-200 dark:border-neutral-800 mt-6">
            <button type="submit" className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm tracking-wide transition-colors shadow-lg shadow-indigo-500/20">
              <Save className="w-4 h-4" /> Salvar Alterações
            </button>
          </div>
        </div>
      </form>
${tabsSection}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 relative z-10">
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

