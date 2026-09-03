import { ResolvedField } from '../../ast'

export function toCamel(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_m, c) => c.toUpperCase())
    .replace(/^[A-Z]/, (m) => m.toLowerCase())
}

export function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_m, c) => c.toUpperCase())
    .replace(/^[a-z]/, (m) => m.toUpperCase())
}

/**
 * Gera o trecho JSX para renderizar o valor de um campo na tabela de listagem.
 * Replica a lógica de renderização do Runtime ViewPageContent.
 */
export function renderGridCellValue(field: ResolvedField, varName = 'item'): string {
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
    return `<span className={"inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider " + (${raw} ? "bg-green-50 text-green-600 border border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800/50" : "bg-neutral-100 text-neutral-500 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700")}>{${raw} ? 'Sim' : 'Não'}</span>`
  }
  if (dt === 'date' || dt === 'timestamp' || dt === 'timestamptz' || dt === 'datetime') {
    return `<span>{${raw} ? new Date(${raw}).toLocaleDateString('pt-BR') : '-'}</span>`
  }
  if (field.config?.options?.length) {
    const optsCode = JSON.stringify(field.config.options)
    return `{(() => { const opts = ${optsCode}; const opt = opts.find((o: any) => o.value === String(${raw})); return opt ? <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/50" style={opt.color ? { backgroundColor: opt.color + '20', color: opt.color, borderColor: opt.color + '40' } : undefined}>{opt.label}</span> : <span>{String(${raw} ?? '-')}</span> })()}`
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
export function getColSpanClass(field: ResolvedField): string {
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

export function renderFormField(field: ResolvedField, isEdit: boolean, readOnly = false): string {
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

  const mask = field.config?.mask || field.config?.content?.mask || (col.toLowerCase().includes('cnpj') ? '00.000.000/0000-00' : col.toLowerCase().includes('cpf') ? '000.000.000-00' : col.toLowerCase().includes('cep') ? '00000-000' : (col.toLowerCase().includes('telefone') || col.toLowerCase().includes('phone')) ? '(00) 00000-0000' : (col.toLowerCase().includes('preco') || col.toLowerCase().includes('valor') || col.toLowerCase().includes('price')) ? '0.000,00' : '')
  const inputType = mask ? 'text' : (dt === 'integer' || dt === 'numeric' || dt === 'float' || dt === 'double precision' || dt === 'decimal') ? 'number' : 'text'

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
