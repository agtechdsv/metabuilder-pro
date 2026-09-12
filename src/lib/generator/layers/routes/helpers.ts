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

export function isValidIdentifier(str?: string): boolean {
  return Boolean(str && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str) && !str.includes('-'))
}

export function findDisplayColumn(fields: any[]): string {
  if (!fields || fields.length === 0) return ''
  const strField = fields.find((f: any) => !f.isPrimaryKey && !f.isPrimary && ['varchar', 'text', 'string'].includes(String(f.dataType || f.data_type || f.type || '').toLowerCase()))
  if (strField) return strField.dbColumn || strField.db_column_name || ''
  const pkField = fields.find((f: any) => f.isPrimaryKey || f.isPrimary)
  if (pkField) return pkField.dbColumn || pkField.db_column_name || ''
  return fields[0]?.dbColumn || fields[0]?.db_column_name || ''
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
    return `{(() => { const opts = ${optsCode}; const opt = opts.find((o: any) => o.value === String(${raw})); return opt ? <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/50" style={(opt as any)?.color ? { backgroundColor: (opt as any).color + '20', color: (opt as any).color, borderColor: (opt as any).color + '40' } : undefined}>{opt.label}</span> : <span>{String(${raw} ?? '-')}</span> })()}`
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
 * Gera o trecho JSX para um campo de formulário respeitando integralmente
 * as posições, colunas (1 a 12) e larguras visuais configuradas no Studio para cada caso de uso.
 */
export function getColSpanClass(field: ResolvedField, isModal: boolean = false): string {
  const cfg = field.config || {}
  const comp = cfg.component || cfg.form_config?.component || {}
  const layout = cfg.layout || {}
  const layoutPadrao = cfg.layout_padrao || comp.layout_padrao || {}

  // 1. Prioridade às colunas explícitas (1 a 12) configuradas no Studio
  // Quando em modal/drawer, dá prioridade a modalGridSpan se configurado
  const rawCols =
    (isModal ? (comp.modalGridSpan ?? cfg.modalGridSpan ?? (field as any).modalGridSpan) : null) ??
    comp.gridSpan ??
    cfg.gridSpan ??
    comp.modalGridSpan ??
    cfg.modalGridSpan ??
    (field as any).gridSpan ??
    (field as any).columns ??
    comp.columns ??
    cfg.columns ??
    comp.col_span ??
    comp.colunas ??
    comp.ocupar_colunas ??
    comp.span ??
    layout.columns ??
    layout.col_span ??
    layoutPadrao.colunas ??
    layoutPadrao.ocupar_colunas ??
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

  // 2. Componentes multiline, textarea ou BYOC ocupam linha inteira se não houver coluna definida
  if (cfg.multiline || comp.type === 'textarea' || field.isByoc || field.isVirtual) {
    return 'col-span-12'
  }

  // 3. Largura visual configurada no Studio (ex: "50%", "33%", "25%", "6col", "4col", etc.)
  const rawWidth = isModal
    ? (comp.modalWidth || cfg.modalWidth || comp.width || cfg.width || '')
    : (comp.width || cfg.width || '')
  const w = String(rawWidth).trim().toLowerCase()

  if (w.endsWith('col')) {
    const c = parseInt(w.replace('col', '').trim(), 10)
    if (!isNaN(c) && c > 0) {
      if (c >= 12) return 'col-span-12'
      return `col-span-12 md:col-span-${c}`
    }
  }

  if (w === '50%' || w === '50' || w === 'w-1/2' || w === '6') {
    return 'col-span-12 md:col-span-6'
  }
  if (w === '33%' || w === '33.33%' || w === '33.33' || w === 'w-1/3' || w === '4') {
    return 'col-span-12 md:col-span-4'
  }
  if (w === '25%' || w === '25' || w === 'w-1/4' || w === '3') {
    return 'col-span-12 md:col-span-3'
  }
  if (w === '16.6%' || w === '16.66%' || w === '16.67%' || w === '2') {
    return 'col-span-12 md:col-span-2'
  }
  if (w === '8.33%' || w === '1') {
    return 'col-span-12 md:col-span-1'
  }
  if (w === '66.6%' || w === '66.66%' || w === '66.67%' || w === 'w-2/3' || w === '8') {
    return 'col-span-12 md:col-span-8'
  }
  if (w === '75%' || w === '75' || w === 'w-3/4' || w === '9') {
    return 'col-span-12 md:col-span-9'
  }
  if (w === '100%' || w === '100' || w === 'w-full' || w === '12') {
    return 'col-span-12'
  }

  // 4. Fallback padrão quando o campo não possui configuração de colunas ou largura no Studio
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
  readOnly: boolean | string = false,
  relationalOptionsVar = 'relationalOptions',
  isModal = false
): string {
  const col = field.dbColumn
  const label = field.label
  const dt = (field.dataType || '').toLowerCase()
  const required = field.config?.required || false
  const placeholder = field.config?.placeholder || `Digite ${label}...`
  const colSpanClass = getColSpanClass(field, isModal)

  if (field.isByoc || field.dataType === 'byoc' || field.id.startsWith('byoc_')) {
    const byocComponentName = getByocComponentName(field)
    const byocCleanLabel = field.label.replace(/^\[BYOC\]\s*/i, '')

    return `
          {/* BYOC — ${field.label} */}
          <div className="space-y-3 col-span-12">
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

  const formulaTokens = field.config?.formulaTokens || field.config?.formula_tokens || field.config?.content?.formula_tokens || (field as any).formulaTokens || []
  const hasFormula = Array.isArray(formulaTokens) && formulaTokens.length > 0

  const isStaticReadOnly = Boolean(
    (typeof readOnly === 'boolean' && readOnly) ||
    field.config?.readOnly ||
    field.config?.content?.readonly ||
    field.config?.readonly ||
    field.isVirtual ||
    col.startsWith('virt_') ||
    hasFormula
  )

  const isDynamic = typeof readOnly === 'string' && readOnly.trim() !== ''
  const readOnlyCond = isDynamic ? `(${readOnly} || ${isStaticReadOnly})` : (isStaticReadOnly ? 'true' : 'false')

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
              disabled={${readOnlyCond}}
              defaultValue={isEdit ? String(data?.${col} ?? '') : ''}
              className={"w-full border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none transition-all " + (${readOnlyCond} ? "bg-neutral-100/80 dark:bg-neutral-800/80 font-semibold cursor-not-allowed opacity-90" : "bg-slate-50 dark:bg-neutral-800 focus:ring-2 focus:ring-indigo-500/50 cursor-pointer")}
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
                disabled={${readOnlyCond}}
                defaultChecked={isEdit ? Boolean(data?.${col}) : false}
                className={"w-5 h-5 rounded-md border-2 border-neutral-300 dark:border-neutral-600 text-indigo-600 focus:ring-indigo-500 " + (${readOnlyCond} ? "cursor-not-allowed opacity-60" : "cursor-pointer")}
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
              readOnly={${readOnlyCond}}
              disabled={${readOnlyCond}}
              defaultValue={isEdit ? formatDateForInput(data?.${col}) : ''}
              className={"w-full border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none transition-all " + (${readOnlyCond} ? "bg-neutral-100/80 dark:bg-neutral-800/80 font-semibold cursor-not-allowed opacity-90" : "bg-slate-50 dark:bg-neutral-800 focus:ring-2 focus:ring-indigo-500/50")}
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
              readOnly={${readOnlyCond}}
              disabled={${readOnlyCond}}
              defaultValue={isEdit ? formatDatetimeForInput(data?.${col}) : ''}
              className={"w-full border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none transition-all " + (${readOnlyCond} ? "bg-neutral-100/80 dark:bg-neutral-800/80 font-semibold cursor-not-allowed opacity-90" : "bg-slate-50 dark:bg-neutral-800 focus:ring-2 focus:ring-indigo-500/50")}
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
              readOnly={${readOnlyCond}}
              disabled={${readOnlyCond}}
              placeholder="${placeholder}"
              defaultValue={isEdit ? String(data?.${col} ?? '') : ''}
              className={"w-full border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 rounded-xl px-4 py-3 text-sm outline-none resize-y min-h-[100px] transition-all " + (${readOnlyCond} ? "bg-neutral-100/80 dark:bg-neutral-800/80 font-semibold cursor-not-allowed opacity-90" : "bg-slate-50 dark:bg-neutral-800 focus:ring-2 focus:ring-indigo-500/50")}
            />
          </div>`
  }

  const mask = field.config?.mask || field.config?.content?.mask || (hasFormula ? '0.000,00' : '') || (col.toLowerCase().includes('cnpj') ? '00.000.000/0000-00' : col.toLowerCase().includes('cpf') ? '000.000.000-00' : col.toLowerCase().includes('cep') ? '00000-000' : (col.toLowerCase().includes('telefone') || col.toLowerCase().includes('phone')) ? '(00) 00000-0000' : (col.toLowerCase().includes('preco') || col.toLowerCase().includes('valor') || col.toLowerCase().includes('price') || col.toLowerCase().includes('total')) ? '0.000,00' : '')
  const inputType = mask ? 'text' : (dt === 'integer' || dt === 'numeric' || dt === 'float' || dt === 'double precision' || dt === 'decimal') ? 'number' : 'text'

  const formulaAttr = hasFormula ? ` data-formula={${JSON.stringify(JSON.stringify(formulaTokens))}}` : ''
  const defaultValueExpr = hasFormula
    ? `isEdit ? (formatWithMask(evaluateFormula(${JSON.stringify(formulaTokens)}, data), '${mask}')) : ''`
    : `isEdit ? (formatWithMask(data?.${col}, '${mask}')) : ''`
  const placeholderText = hasFormula ? 'Calculado automaticamente' : placeholder

  return `
          <div className="space-y-1.5 ${colSpanClass}">
            <label htmlFor="${col}" className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">${label}${required ? ' *' : ''}</label>
            <input
              id="${col}"
              name="${col}"
              type="${inputType}"
              ${required ? 'required' : ''}
              readOnly={${hasFormula ? 'true' : readOnlyCond}}
              disabled={${hasFormula ? 'false' : readOnlyCond}}
              placeholder="${placeholderText}"
              defaultValue={${defaultValueExpr}}
              ${mask ? `data-mask="${mask}"` : ''}${formulaAttr}
              className={"w-full border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 rounded-xl px-4 py-2.5 text-sm outline-none transition-all " + (${hasFormula ? 'true' : readOnlyCond} ? "bg-neutral-100/80 dark:bg-neutral-800/80 font-semibold cursor-not-allowed opacity-90" : "bg-slate-50 dark:bg-neutral-800 focus:ring-2 focus:ring-indigo-500/50")}
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

function parseAnyNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (!val) return 0
  const s = String(val).trim()
  if (s.includes(',')) {
    return parseFloat(s.replace(/\\./g, '').replace(',', '.')) || 0
  }
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function evaluateFormula(tokens: any[], currentRow: Record<string, any> = {}): any {
  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) return null
  let expression = ''
  const context: Record<string, any> = {}
  let contextIdx = 0

  context['SOMA'] = (arr: any[]) => Array.isArray(arr) ? arr.reduce((a, b) => Number(a || 0) + Number(b || 0), 0) : 0
  context['MEDIA'] = (arr: any[]) => Array.isArray(arr) && arr.length ? context['SOMA'](arr) / arr.length : 0
  context['COUNT'] = (arr: any[]) => Array.isArray(arr) ? arr.length : 0
  context['MAXIMO'] = (arr: any[]) => Array.isArray(arr) && arr.length ? Math.max(...arr.map(v => Number(v) || 0)) : 0
  context['MINIMO'] = (arr: any[]) => Array.isArray(arr) && arr.length ? Math.min(...arr.map(v => Number(v) || 0)) : 0
  context['ARREDONDAR'] = (val: any) => Math.round(Number(val) || 0)
  context['ABS'] = (val: any) => Math.abs(Number(val) || 0)
  context['SE'] = (cond: boolean, trueVal: any, falseVal: any) => cond ? trueVal : falseVal

  const synonyms: Record<string, string[]> = {
    quantidade: ['estoque_atual', 'estoque', 'qtd', 'quantidade'],
    estoque_atual: ['quantidade', 'estoque', 'qtd'],
    preco_unitario: ['preco_base', 'preco', 'valor_unitario', 'valor_base', 'valor'],
    preco_base: ['preco_unitario', 'preco', 'valor_base', 'valor_unitario', 'valor'],
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (!token) continue
    if (token.type === 'operator' || token.type === 'number') {
      expression += ' ' + token.value + ' '
    } else if (token.type === 'string') {
      expression += ' "' + String(token.value).replace(/"/g, '\\\\"') + '" '
    } else if (token.type === 'function') {
      expression += ' ' + token.value
    } else if (token.type === 'field') {
      const fieldPath = String(token.value || '')
      const varName = 'var_' + (contextIdx++)
      expression += ' ' + varName + ' '

      const colOnly = fieldPath.includes('.') ? fieldPath.split('.').pop()! : fieldPath

      let val: any = undefined
      if (currentRow) {
        if (currentRow[fieldPath] !== undefined && currentRow[fieldPath] !== null) val = currentRow[fieldPath]
        else if (currentRow[colOnly] !== undefined && currentRow[colOnly] !== null) val = currentRow[colOnly]
        else {
          const checkKeys = [fieldPath.toLowerCase(), colOnly.toLowerCase(), ...(synonyms[fieldPath.toLowerCase()] || []), ...(synonyms[colOnly.toLowerCase()] || [])]
          for (const k of Object.keys(currentRow)) {
            if (checkKeys.includes(k.toLowerCase())) {
              val = currentRow[k]
              break
            }
          }
        }
      }

      const numVal = parseAnyNumber(val)
      context[varName] = (val === '' || val === null || val === undefined) ? 0 : (isNaN(numVal) ? val : numVal)
    }
  }

  expression = expression.replace(/ , /g, ',')
  expression = expression.replace(/([^<>=!])=([^=])/g, '$1===$2')

  try {
    const fn = new Function(...Object.keys(context), 'return ' + expression)
    const res = fn(...Object.values(context))
    return (res === undefined || isNaN(res)) ? null : res
  } catch (err) {
    return null
  }
}

function recalculateFormulas(container: HTMLElement | null) {
  if (!container) return
  const rowData: Record<string, any> = {}
  const inputs = container.querySelectorAll('input, select, textarea')
  inputs.forEach((el: any) => {
    const name = el.name || el.id
    if (name) {
      rowData[name] = el.value
      rowData[name.toLowerCase()] = el.value
    }
  })

  const formulaInputs = container.querySelectorAll('[data-formula]')
  formulaInputs.forEach((el: any) => {
    try {
      const rawFormula = el.getAttribute('data-formula')
      if (!rawFormula) return
      const tokens = JSON.parse(rawFormula)
      const res = evaluateFormula(tokens, rowData)
      if (res !== null && !isNaN(Number(res))) {
        const mask = el.getAttribute('data-mask') || '0.000,00'
        el.value = formatWithMask(Number(res), mask)
      }
    } catch (e) {}
  })
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

