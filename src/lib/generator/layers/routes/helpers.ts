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
export function renderGridCellValue(field: ResolvedField, varName = 'item', relationalOptionsVar?: string): string {
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
  if (relationalOptionsVar) {
    const isRelational = !!(
      field.config?.relation?.targetTable ||
      field.config?.component?.rel_table ||
      field.config?.rel_table ||
      (field.dbColumn.endsWith('_id') && !field.isPrimaryKey)
    )
    if (isRelational) {
      return `{(() => { const opt = ${relationalOptionsVar}?.[${JSON.stringify(field.dbColumn)}]?.find((o: any) => String(o.value) === String(${raw})); return <span>{opt ? opt.label : String(${raw} ?? '-')}</span> })()}`
    }
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
  const comp = cfg.component || cfg.form_config?.component || {}
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
  if (w === '100%' || w === '100' || w === 'w-full' || w === '12' || w === '12 col') {
    return 'col-span-12'
  }

  // Padrão alinhado ao Runtime do Studio (RecordForm.tsx line 441):
  // Se o campo não tiver gridSpan configurado, a largura padrão é 12 (linha inteira).
  return 'col-span-12'
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
  
  return toPascalCase(rawId) || 'CustomComponent'
}

export function renderFormField(
  field: ResolvedField,
  isEdit: boolean,
  readOnly = false,
  relationalOptionsVar = 'relationalOptions'
): string {
  const col = field.dbColumn
  const label = field.label
  const dt = (field.dataType || '').toLowerCase()
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

  // Primary Key (ID) - destaque visual fiel ao Studio (# PK)
  if (field.isPrimaryKey) {
    return `
          <div className="space-y-1.5 ${colSpanClass}">
            <label htmlFor="${col}" className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">${label} # PK</label>
            <input
              id="${col}"
              name="${col}"
              type="text"
              readOnly
              disabled
              defaultValue={isEdit ? String(data?.${col} ?? '') : ''}
              className="w-full bg-neutral-100/80 dark:bg-neutral-800/80 border border-slate-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 font-mono text-sm rounded-xl px-4 py-2.5 outline-none cursor-not-allowed"
            />
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

  const comp = field.config?.form_config?.component || field.config?.component || {}
  const compType = String(comp.type || '').toLowerCase()

  let options = field.config?.options
  if (!options || !Array.isArray(options) || options.length === 0) {
    const rawFixed = field.config?.fixed_options || comp.fixed_options
    if (typeof rawFixed === 'string' && rawFixed.trim()) {
      options = rawFixed.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean).map((s: string) => {
        if (s.includes(':')) {
          const [l, v] = s.split(':').map((p: string) => p.trim())
          return { label: l || v, value: v || l }
        }
        return { label: s, value: s }
      })
    }
  }

  const isTextLike = ['text', 'number', 'textarea', 'date', 'datetime'].includes(compType)

  const isSelect =
    ['select', 'combo (select)', 'radio', 'radio buttons'].includes(compType) ||
    ((col.endsWith('_id') || Boolean(field.config?.relation?.targetTable)) && !field.isPrimaryKey && !isTextLike) ||
    (Boolean(options && options.length > 0) && !isTextLike)

  if (isSelect) {
    const defaultOpts = options && options.length > 0 ? JSON.stringify(options) : '[]'
    return `
          <div className="space-y-1.5 ${colSpanClass}">
            <label htmlFor="${col}" className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">${label}${required ? ' *' : ''}</label>
            <select
              id="${col}"
              name="${col}"
              ${required ? 'required' : ''}
              ${isReadOnly ? 'disabled' : ''}
              defaultValue={isEdit ? String(data?.${col} ?? '') : ''}
              className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all disabled:opacity-60 cursor-pointer"
            >
              <option value="">Selecione ${label}...</option>
              {(${relationalOptionsVar}?.['${col}'] || ${defaultOpts}).map((opt: any, i: number) => (
                <option key={i} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>`
  }

  if (dt === 'boolean' || compType === 'switch' || compType === 'checkbox') {
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
                className="w-5 h-5 rounded-md border-2 border-neutral-300 dark:border-neutral-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="${col}" className="text-sm text-neutral-700 dark:text-neutral-300 cursor-pointer">${label}</label>
            </div>
          </div>`
  }

  const isDate =
    dt === 'date' ||
    compType === 'date' ||
    col.toLowerCase().includes('data') ||
    col.toLowerCase().includes('date') ||
    col.toLowerCase().includes('criado') ||
    col.toLowerCase().includes('created') ||
    col.toLowerCase().includes('atualizado') ||
    col.toLowerCase().includes('updated')

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

  if (dt === 'timestamp' || dt === 'timestamptz' || dt === 'datetime' || compType === 'datetime' || compType === 'datetime-local') {
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

  if (field.config?.multiline || compType === 'textarea' || ['área de texto (textarea)', 'textarea'].includes(compType)) {
    const rows = field.config?.rows || comp.rows || 4
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

export const FORM_INPUT_FORMAT_HELPERS = `
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
  if (!mask) return String(v)
  const s = String(v)

  if (mask === '0.000,00' || mask === 'currency' || mask === 'moeda') {
    let num = 0
    if (typeof v === 'number') num = isNaN(v) ? 0 : v
    else if (s.includes(',')) num = Number(s.replace(/\\./g, '').replace(',', '.')) || 0
    else {
      const parsed = Number(s)
      num = !isNaN(parsed) ? parsed : (parseInt(s.replace(/\\D/g, ''), 10) / 100 || 0)
    }
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (mask === '0.000') {
    const num = typeof v === 'number' ? v : (Number(s.includes(',') ? s.replace(/\\./g, '').replace(',', '.') : s) || 0)
    return num.toLocaleString('pt-BR')
  }

  const d = s.replace(/\\D/g, '')
  if (mask === '00.000.000/0000-00' || (!mask && d.length === 14)) {
    if (d.length <= 2) return d
    if (d.length <= 5) return \`\${d.slice(0, 2)}.\${d.slice(2)}\`
    if (d.length <= 8) return \`\${d.slice(0, 2)}.\${d.slice(2, 5)}.\${d.slice(5)}\`
    if (d.length <= 12) return \`\${d.slice(0, 2)}.\${d.slice(2, 5)}.\${d.slice(5, 8)}/\${d.slice(8)}\`
    return \`\${d.slice(0, 2)}.\${d.slice(2, 5)}.\${d.slice(5, 8)}/\${d.slice(8, 12)}-\${d.slice(12, 14)}\`
  }

  if (mask === '000.000.000-00' || (!mask && d.length === 11)) {
    if (d.length <= 3) return d
    if (d.length <= 6) return \`\${d.slice(0, 3)}.\${d.slice(3)}\`
    if (d.length <= 9) return \`\${d.slice(0, 3)}.\${d.slice(3, 6)}.\${d.slice(6)}\`
    return \`\${d.slice(0, 3)}.\${d.slice(3, 6)}.\${d.slice(6, 9)}-\${d.slice(9, 11)}\`
  }

  if (mask === '00000-000' || (!mask && d.length === 8)) {
    if (d.length <= 5) return d
    return \`\${d.slice(0, 5)}-\${d.slice(5, 8)}\`
  }

  if (mask === '(00) 00000-0000' || mask === '(00) 0000-0000' || (!mask && (d.length === 10 || d.length === 11))) {
    if (d.length <= 2) return d ? \`(\${d}\` : ''
    if (d.length <= 6) return \`(\${d.slice(0, 2)}) \${d.slice(2)}\`
    if (d.length <= 10) return \`(\${d.slice(0, 2)}) \${d.slice(2, 6)}-\${d.slice(6)}\`
    return \`(\${d.slice(0, 2)}) \${d.slice(2, 7)}-\${d.slice(7, 11)}\`
  }

  return s
}
`

