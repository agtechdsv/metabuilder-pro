import { RouteNode } from '../../ast'
import { renderFormField, getByocComponentName, toPascalCase, FORM_INPUT_FORMAT_HELPERS } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler Page (Server Component)
// ─────────────────────────────────────────────────────────────────────────────

export function generateSchedulerPage(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const hasCreate = route.buttons.some(b => b.actionType === 'create') || route.buttons.length === 0

  // Detecta todas as tabelas relacionadas necessárias para lookups dos filtros, cards e schedulerConfig
  const lookupModels = new Map<string, string>() // table -> modelName
  const allSchedulerFields = [
    ...(route.filterFields || []),
    ...(route.gridFields || []),
    ...(route.formFields || [])
  ]

  // Garante que campos referenciados pelo schedulerConfig também sejam incluídos nos lookups relacionais
  const schedFieldNames = [
    route.schedulerConfig?.titleField,
    route.schedulerConfig?.startDateField,
    route.schedulerConfig?.endDateField,
    route.schedulerConfig?.colorField
  ].filter(Boolean) as string[]

  schedFieldNames.forEach(name => {
    if (!allSchedulerFields.some(f => f.dbColumn === name || f.id === name)) {
      allSchedulerFields.push({
        id: name,
        dbColumn: name,
        label: name,
        dataType: 'string',
        isPrimaryKey: false,
        isVirtual: false,
        config: {}
      } as any)
    }
  })

  // Adiciona tabelas de joins declarados na view ao lookup
  const rawJoins: Array<{ from: string; to: string; localKey?: string; foreignKey?: string }> =
    route.rawLayoutConfig?.joins || []

  rawJoins.forEach(j => {
    const fromTbl = (j.from || '').toLowerCase()
    const toTbl = (j.to || '').toLowerCase()
    if (fromTbl && !fromTbl.includes('-') && fromTbl.length < 30) {
      lookupModels.set(fromTbl, toPascalCase(fromTbl))
    }
    if (toTbl && !toTbl.includes('-') && toTbl.length < 30) {
      lookupModels.set(toTbl, toPascalCase(toTbl))
    }
  })

  schedFieldNames.forEach(name => {
    if (name.includes('.')) {
      const tbl = name.split('.')[0].toLowerCase()
      if (tbl && !tbl.includes('-') && tbl.length < 30) {
        lookupModels.set(tbl, toPascalCase(tbl))
      }
    }
  })

  allSchedulerFields.forEach(f => {
    const targetModel = f.config?.relation?.targetModel || (f as any).relation?.targetModel
    const targetTable = f.config?.relation?.targetTable || f.config?.component?.rel_table || f.config?.rel_table
    if (targetModel && targetTable) {
      lookupModels.set(targetTable.toLowerCase(), targetModel)
    } else if (targetTable && !targetTable.includes('-') && targetTable.length < 30) {
      const modelName = toPascalCase(targetTable)
      lookupModels.set(targetTable.toLowerCase(), modelName)
    } else if (f.dbColumn.endsWith('_id') && !f.isPrimaryKey) {
      const base = f.dbColumn.slice(0, -3)
      const table = base.endsWith('s') ? base : (base + 's')
      const modelName = toPascalCase(table)
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
  const registeredOptionKeys = new Set<string>()
  allSchedulerFields.forEach(f => {
    const targetTable = f.config?.relation?.targetTable || f.config?.component?.rel_table || f.config?.rel_table || (f.dbColumn.endsWith('_id') ? (f.dbColumn.slice(0, -3).endsWith('s') ? f.dbColumn.slice(0, -3) : f.dbColumn.slice(0, -3) + 's') : null)
    if (targetTable && lookupModels.has(targetTable.toLowerCase())) {
      const t = targetTable.toLowerCase()
      const relLabel = f.config?.component?.rel_label || f.config?.relation?.displayColumn || f.config?.rel_label
      const relValue = f.config?.component?.rel_value || f.config?.relation?.valueColumn || f.config?.rel_value || 'id'
      const labelExpr = relLabel
        ? `r[${JSON.stringify(relLabel)}] ?? r[${JSON.stringify(relLabel.toLowerCase())}] ?? r.nome ?? r.name ?? r.razao_social ?? r.titulo ?? r.title ?? r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
        : `r.nome ?? r.name ?? r.razao_social ?? r.titulo ?? r.title ?? r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
      const valueExpr = `r[${JSON.stringify(relValue)}] ?? r[${JSON.stringify(relValue.toLowerCase())}] ?? r.id ?? Object.values(r)[0] ?? ''`
      
      const mappingCode = `(${t}LookupList || []).map((r: any) => ({ value: String(${valueExpr}), label: String(${labelExpr}) }))`
      
      if (!registeredOptionKeys.has(f.dbColumn)) {
        registeredOptionKeys.add(f.dbColumn)
        buildOptionsCode.push(`    '${f.dbColumn}': ${mappingCode},`)
      }
      if (f.id && !registeredOptionKeys.has(f.id)) {
        registeredOptionKeys.add(f.id)
        buildOptionsCode.push(`    '${f.id}': ${mappingCode},`)
      }
      if (t && !registeredOptionKeys.has(t)) {
        registeredOptionKeys.add(t)
        buildOptionsCode.push(`    '${t}': ${mappingCode},`)
      }
    } else if (f.config?.options && Array.isArray(f.config.options) && f.config.options.length > 0) {
      if (!registeredOptionKeys.has(f.dbColumn)) {
        registeredOptionKeys.add(f.dbColumn)
        buildOptionsCode.push(`    '${f.dbColumn}': ${JSON.stringify(f.config.options)},`)
      }
    }
  })

  // Registra opções para todas as tabelas em lookupModels
  lookupModels.forEach((_modelName, tbl) => {
    const labelExpr = `r.nome_empresa ?? r.nome ?? r.name ?? r.razao_social ?? r.titulo ?? r.title ?? r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
    const mappingCode = `(${tbl}LookupList || []).map((r: any) => ({ value: String(r.id ?? Object.values(r)[0] ?? ''), label: String(${labelExpr}) }))`
    if (!registeredOptionKeys.has(tbl)) {
      registeredOptionKeys.add(tbl)
      buildOptionsCode.push(`    '${tbl}': ${mappingCode},`)
    }
    const singular = tbl.endsWith('s') ? tbl.slice(0, -1) : tbl
    const fkCol = `${singular}_id`
    if (!registeredOptionKeys.has(fkCol)) {
      registeredOptionKeys.add(fkCol)
      buildOptionsCode.push(`    '${fkCol}': ${mappingCode},`)
    }
  })

  // Filtros
  const filterFields = route.filterFields.length > 0
    ? route.filterFields
    : route.gridFields.filter(f => !f.isPrimaryKey && !f.isVirtual && !f.isByoc).slice(0, 3)

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

  const headerButtonsHtml = route.buttons.filter(b => b.placement === 'header').map(b => {
    if (b.actionType === 'create') {
      return `          <Link href={\`${route.path}/new\${isEmbedded ? '?embedded=true' : ''}\`} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
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
  }).join('\n') || `          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95">
            <Zap className="w-4 h-4 text-neutral-400" /> Automações
          </button>
          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95">
            <Download className="w-4 h-4 text-neutral-400" /> Exportar
          </button>${hasCreate ? `
          <Link href={\`${route.path}/new\${isEmbedded ? '?embedded=true' : ''}\`} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
            <Plus className="w-4 h-4" /> Novo Registro
          </Link>` : ''}`

  return `import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { get${mn}List } from '@/app/actions/${mnLower}'
${lookupImports ? `${lookupImports}\n` : ''}import { Loader2, Plus, Search, RefreshCcw, Zap, Download, Calendar } from 'lucide-react'
import { DynamicIcon } from '@/app/components/DynamicIcon'
import { CloseModalButton } from '@/components/ui/custom-action-button'
import { SchedulerClient } from './SchedulerClient'

export const metadata: Metadata = { title: '${route.title}' }

function SchedulerLoading() {
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

async function ${mn}SchedulerContent({
  params,
}: {
  params: { [key: string]: string | undefined }
}) {
  const rawData = await get${mn}List({ filters: params }).catch(() => [])
${lookupQueries}

  const rawJoins = ${JSON.stringify(rawJoins)}
  const tablesData: Record<string, any[]> = {
    ${Array.from(lookupModels.keys()).map(t => `'${t}': ${t}LookupList || [],`).join('\n    ')}
  }

  const enrichedData = (rawData || []).map((row: any) => {
    const item: Record<string, any> = { ...row }
    for (const [tbl, list] of Object.entries(tablesData)) {
      const singular = tbl.endsWith('s') ? tbl.slice(0, -1) : tbl
      const fkVal = row[\`\${tbl}_id\`] ?? row[\`\${singular}_id\`] ?? row[\`id_\${tbl}\`] ?? row[\`id_\${singular}\`]
      if (fkVal != null && Array.isArray(list)) {
        const match = list.find((r: any) => String(r.id) === String(fkVal))
        if (match) {
          item[tbl] = match
          item[singular] = match
          for (const [k, v] of Object.entries(match)) {
            item[\`\${tbl}.\${k}\`] = v
            item[\`\${singular}.\${k}\`] = v
          }
        }
      }
    }

    for (const j of rawJoins) {
      const fromTbl = (j.from || '').toLowerCase()
      const toTbl = (j.to || '').toLowerCase()
      const localKey = j.localKey || 'id'
      const foreignKey = j.foreignKey || \`\${fromTbl}_id\`

      const toObj = item[toTbl] || (toTbl === '${mnLower}' ? item : null)
      const fromList = tablesData[fromTbl]
      if (toObj && Array.isArray(fromList) && !item[fromTbl]) {
        const foreignVal = toObj[foreignKey] ?? item[foreignKey]
        if (foreignVal != null) {
          const match = fromList.find((r: any) => String(r[localKey] ?? r.id) === String(foreignVal))
          if (match) {
            item[fromTbl] = match
            const singular = fromTbl.endsWith('s') ? fromTbl.slice(0, -1) : fromTbl
            item[singular] = match
            for (const [k, v] of Object.entries(match)) {
              item[\`\${fromTbl}.\${k}\`] = v
              item[\`\${singular}.\${k}\`] = v
            }
          }
        }
      }

      const fromObj = item[fromTbl] || (fromTbl === '${mnLower}' ? item : null)
      const toList = tablesData[toTbl]
      if (fromObj && Array.isArray(toList) && !item[toTbl]) {
        const localVal = fromObj[localKey] ?? item[localKey]
        if (localVal != null) {
          const match = toList.find((r: any) => String(r[foreignKey] ?? r.id) === String(localVal))
          if (match) {
            item[toTbl] = match
            const singular = toTbl.endsWith('s') ? toTbl.slice(0, -1) : toTbl
            item[singular] = match
            for (const [k, v] of Object.entries(match)) {
              item[\`\${toTbl}.\${k}\`] = v
              item[\`\${singular}.\${k}\`] = v
            }
          }
        }
      }
    }

    for (const [tbl, obj] of Object.entries(item)) {
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [k, v] of Object.entries(obj)) {
          if (k.endsWith('_id') && v != null) {
            const targetTbl = k.slice(0, -3)
            const targetList = tablesData[targetTbl] || tablesData[targetTbl + 's'] || (targetTbl.endsWith('s') ? tablesData[targetTbl.slice(0, -1)] : null)
            const targetKey = tablesData[targetTbl] ? targetTbl : (tablesData[targetTbl + 's'] ? targetTbl + 's' : targetTbl)
            if (Array.isArray(targetList) && !item[targetKey]) {
              const subMatch = targetList.find((r: any) => String(r.id) === String(v))
              if (subMatch) {
                item[targetKey] = subMatch
                const subSingular = targetKey.endsWith('s') ? targetKey.slice(0, -1) : targetKey
                item[subSingular] = subMatch
                for (const [sk, sv] of Object.entries(subMatch)) {
                  item[\`\${targetKey}.\${sk}\`] = sv
                  item[\`\${subSingular}.\${sk}\`] = sv
                }
              }
            }
          }
        }
      }
    }

    return item
  })

  const relationalOptions: Record<string, Array<{ value: string; label: string }>> = {
${buildOptionsCode.join('\n')}
  }

  return (
    <SchedulerClient
      initialData={enrichedData}
      relationalOptions={relationalOptions}
      initialParams={params}
    />
  )
}

export default async function ${mn}SchedulerPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | undefined }>
}) {
  const params = searchParams ? await searchParams : {}
  const isEmbedded = params?.embedded === 'true'

  return (
    <div className="p-6 sm:p-10 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Cabeçalho Externo fiel à Web Produção */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white shrink-0">
            <DynamicIcon icon="${route.icon || 'Calendar'}" size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
              ${route.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-8 h-1 bg-indigo-600 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                AGENDA • SISTEMA METABUILDER
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
${headerButtonsHtml}
          {isEmbedded && <CloseModalButton />}
        </div>
      </div>

      {/* Barra de Filtros / Argumentos da View */}
      ${filterFields.length > 0 ? `
      <form method="GET" className="p-6 bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-sm">
        {isEmbedded && <input type="hidden" name="embedded" value="true" />}
        <div className="flex flex-col lg:flex-row items-end gap-6">
          <div className="flex-1 grid grid-cols-12 gap-4 w-full">
${filterInputs}
          </div>
          <div className="flex items-center gap-3 mb-[1px]">
            <button
              type="submit"
              className="h-[42px] px-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 capitalize tracking-wider active:scale-95 shrink-0 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              Pesquisar
            </button>
            <Link
              href={\`${route.path}\${isEmbedded ? '?embedded=true' : ''}\`}
              className="h-[42px] px-6 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-2 capitalize tracking-wider active:scale-95 shrink-0 cursor-pointer"
            >
              <RefreshCcw className="w-4 h-4" />
              Limpar
            </Link>
          </div>
        </div>
      </form>` : ''}

      {/* Calendário dentro de Suspense Streaming */}
      <Suspense
        key={JSON.stringify(params)}
        fallback={<SchedulerLoading />}
      >
        <${mn}SchedulerContent params={params} />
      </Suspense>
    </div>
  )
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler Schema ([route]/schema.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function generateSchedulerSchema(route: RouteNode): string {
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
    })),
    null,
    2
  )

  const allFields = [
    ...(route.gridFields || []),
    ...(route.formFields || []),
    ...(route.filterFields || [])
  ].filter((f, idx, arr) => arr.findIndex(x => (x.dbColumn && x.dbColumn === f.dbColumn) || (x.id && x.id === f.id)) === idx)

  const fieldsData = JSON.stringify(
    allFields.map(f => ({
      id: f.id,
      dbColumn: f.dbColumn,
      db_column_name: f.dbColumn,
      label: f.label,
      display_name: f.label,
      dataType: f.dataType,
      config: f.config,
    })),
    null,
    2
  )

  const sc = route.schedulerConfig
  const schedulerConfigObj = {
    title_field: sc?.titleField || 'id',
    start_date_field: sc?.startDateField || 'created_at',
    end_date_field: sc?.endDateField,
    color_field: sc?.colorField,
    titleField: sc?.titleField || 'id',
    startDateField: sc?.startDateField || 'created_at',
    endDateField: sc?.endDateField,
    colorField: sc?.colorField,
  }

  const schedulerConfigData = JSON.stringify(schedulerConfigObj, null, 2)

  const rowCustomActions: any[] = route.buttons
    .filter(b => b.actionType === 'custom' && (b.placement === 'row' || (b as any).placement === 'card'))
    .map(b => ({
      id: b.id,
      label: b.label,
      icon: b.icon,
      color: b.color || 'indigo',
      style: b.style || 'primary',
      triggerType: b.triggerType || (b.usecaseSlug ? 'usecase' : 'custom'),
      usecaseSlug: b.usecaseSlug || '',
      usecaseOpenMode: b.usecaseOpenMode || 'modal',
      usecaseModalSize: b.usecaseModalSize || '4xl',
      usecaseModalWidth: b.usecaseModalWidth,
      usecaseModalHeight: b.usecaseModalHeight,
      usecaseSelectedFields: b.usecaseSelectedFields || [],
      usecaseParams: b.usecaseParams || '',
      linkTarget: b.linkTarget || '',
    }))

  if (Array.isArray(route.rawLayoutConfig?.custom_actions)) {
    route.rawLayoutConfig.custom_actions
      .filter((a: any) => {
        if (!a || a.enabled === false) return false
        const actId = a.id || `custom_act_${(a.label || a.name || 'act').toLowerCase().replace(/\s+/g, '_')}`
        if (rowCustomActions.some(existing => existing.id === actId || existing.label === (a.label || a.name))) {
          return false
        }
        const hasPlacementCard = a.placements && Array.isArray(a.placements) && a.placements.some((p: any) =>
          ['scheduler', 'calendar', 'search', 'board'].includes(p.location) ||
          (p.contexts && p.contexts.some((c: string) => ['row', 'card', 'row_search', 'item'].includes(c)))
        )
        const ctxs = a.contexts ? (Array.isArray(a.contexts) ? a.contexts : [a.contexts]) : (a.context ? [a.context] : ['row'])
        const hasContextCard = ctxs.some((c: string) => ['row', 'row_search', 'card', 'item'].includes(c))
        return hasPlacementCard || hasContextCard || !a.placements
      })
      .forEach((a: any) => {
        rowCustomActions.push({
          id: a.id || `custom_act_${(a.label || a.name || 'act').toLowerCase().replace(/\s+/g, '_')}`,
          label: a.label || a.name || 'Ação Customizada',
          icon: a.icon || a.custom_icon || 'Zap',
          color: a.color || 'indigo',
          style: a.style || 'primary',
          triggerType: a.trigger_type || (a.usecase_slug ? 'usecase' : 'custom'),
          usecaseSlug: a.usecase_slug || a.target_use_case,
          usecaseOpenMode: a.usecase_open_mode || 'modal',
          usecaseModalSize: a.usecaseModalSize || a.usecase_modal_size || '4xl',
          usecaseModalWidth: a.usecase_modal_width,
          usecaseModalHeight: a.usecase_modal_height,
          usecaseSelectedFields: a.usecase_selected_fields || [],
          usecaseParams: a.usecase_params || '',
          linkTarget: a.linkTarget || a.url || a.target_url || (a.usecase_slug ? `/${a.usecase_slug}` : ''),
        })
      })
  }

  const customActionsData = JSON.stringify(rowCustomActions, null, 2)

  return `// ─────────────────────────────────────────────────────────────────────────────
// Schemas e configurações declarativas para Scheduler de ${route.title}
// ─────────────────────────────────────────────────────────────────────────────

export const filterFields = ${filterFieldsData}

export const fields = ${fieldsData}

export const schedulerConfig = ${schedulerConfigData}

export const customActions = ${customActionsData}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler Client Component ([route]/SchedulerClient.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export function generateSchedulerClient(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const pk = route.primaryKey || 'id'
  const isDrawer = route.actionInterfaceType === 'drawer'
    || route.rawLayoutConfig?.action_interface_type === 'drawer'
  const isModal = route.actionInterfaceType === 'modal'
    || route.rawLayoutConfig?.action_interface_type === 'modal'
  const isActionOverlay = isDrawer || isModal

  const formFieldsToUse = (route.formFields && route.formFields.length > 0)
    ? route.formFields
    : (route.gridFields && route.gridFields.length > 0)
    ? route.gridFields
    : []

  const modalFormFieldsHtml = formFieldsToUse
    .map(f => renderFormField(f, true, false, 'relationalOptions'))
    .filter(Boolean)
    .join('\n')

  const byocImports = formFieldsToUse
    .filter(f => f.isByoc || f.dataType === 'byoc' || f.id.startsWith('byoc_'))
    .map(f => getByocComponentName(f))
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .map(name => `import { ${name} } from '@/components/${name}'`)
    .join('\n')

  const modalStateVars = isActionOverlay ? `  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('edit')
  const [activeRecord, setActiveRecord] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)` : ''

  const handleAddBody = isActionOverlay
    ? `    setActiveRecord(initialData || null)
    setModalMode('create')
    setIsModalOpen(true)`
    : `    router.push('${route.path}/new')`

  const handleEditBody = isActionOverlay
    ? `    setActiveRecord(row)
    setModalMode('edit')
    setIsModalOpen(true)`
    : `    router.push('${route.path}/' + (row.${pk} || row.id))`

  const modalSubmitHandler = isActionOverlay ? `  const handleSubmitModal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    setSaveError(null)
    try {
      const formData = new FormData(e.currentTarget)
      if (modalMode === 'edit' && activeRecord) {
        const id = activeRecord.${pk} || activeRecord.id
        await update${mn}(id, formData)
        const updatedEntries = Object.fromEntries(formData.entries())
        setDataList(prev => prev.map(item =>
          String(item.${pk} || item.id) === String(id)
            ? { ...item, ...updatedEntries }
            : item
        ))
      } else {
        const res = await create${mn}(formData)
        if (res) setDataList(prev => [res, ...prev])
      }
      setIsModalOpen(false)
      setActiveRecord(null)
      router.refresh()
    } catch (err: any) {
      console.error('Erro ao salvar registro:', err)
      setSaveError(err?.message || String(err) || 'Erro ao salvar registro.')
    } finally {
      setIsSaving(false)
    }
  }

  const data = activeRecord
  const isEdit = modalMode === 'edit' || modalMode === 'view'` : ''

  const modalJsx = isActionOverlay ? (
    isDrawer ? `
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="w-full max-w-lg h-full bg-white dark:bg-neutral-900 shadow-2xl border-l border-neutral-200 dark:border-neutral-800 flex flex-col animate-in slide-in-from-right duration-300 relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                    {modalMode === 'edit' ? 'Editar Registro' : 'Novo Agendamento'}
                  </h2>
                  <p className="text-xs font-medium text-neutral-400 mt-0.5 font-mono">
                    {modalMode === 'edit'
                      ? ('Registro #' + (activeRecord?.${pk} || activeRecord?.id || ''))
                      : 'Preencha os dados do agendamento'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              key={modalMode + '-' + (activeRecord?.${pk} || activeRecord?.id || 'new')}
              onSubmit={handleSubmitModal}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-5">
                  ${modalFormFieldsHtml}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-400 transition-all active:scale-95 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}` : `
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 sm:p-8 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                    {modalMode === 'edit' ? 'Editar Registro' : 'Novo Agendamento'}
                  </h2>
                  <p className="text-xs font-medium text-neutral-400 mt-0.5 font-mono">
                    {modalMode === 'edit'
                      ? ('Registro #' + (activeRecord?.${pk} || activeRecord?.id || ''))
                      : 'Preencha os dados do agendamento'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              key={modalMode + '-' + (activeRecord?.${pk} || activeRecord?.id || 'new')}
              onSubmit={handleSubmitModal}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-5">
                  ${modalFormFieldsHtml}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-400 transition-all active:scale-95 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}`
  ) : ''

  return `'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { update${mn}, delete${mn}, create${mn} } from '@/app/actions/${mnLower}'
import DynamicScheduler from '@/components/DynamicScheduler'
import { fields, schedulerConfig, customActions } from './schema'
${byocImports ? `${byocImports}\n` : ''}import { Pencil, X, Save } from 'lucide-react'

${FORM_INPUT_FORMAT_HELPERS}

export function SchedulerClient({
  initialData,
  relationalOptions = {},
  initialParams = {}
}: {
  initialData: any[]
  relationalOptions?: Record<string, Array<{ value: string; label: string }>>
  initialParams?: Record<string, string | undefined>
}) {
  const router = useRouter()
  const [dataList, setDataList] = useState<any[]>(initialData)
  const [visibleCount, setVisibleCount] = useState(50)
  const BATCH_SIZE = 50

${modalStateVars}

  useEffect(() => {
    setDataList(initialData)
  }, [initialData])

  const displayedData = useMemo(() => {
    return dataList.slice(0, visibleCount)
  }, [dataList, visibleCount])

  const handleMove = async (recordId: string, updates: Record<string, any>) => {
    setDataList(prev =>
      prev.map(item =>
        String(item.${pk} || item.id) === recordId
          ? { ...item, ...updates }
          : item
      )
    )
    await update${mn}(recordId, updates)
  }

  const handleDelete = async (row: any) => {
    const recordId = String(row.${pk} || row.id)
    setDataList(prev => prev.filter(item => String(item.${pk} || item.id) !== recordId))
    await delete${mn}(recordId)
  }

  const handleAdd = (initialData?: any) => {
${handleAddBody}
  }

  const handleEdit = (row: any) => {
${handleEditBody}
  }

${modalSubmitHandler}

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <DynamicScheduler
        data={displayedData}
        fields={fields}
        schedulerConfig={schedulerConfig}
        onMove={handleMove}
        onAdd={handleAdd}
        onView={handleEdit}
        onEdit={handleEdit}
        onDelete={handleDelete}
        relationalOptions={relationalOptions}
        dictionary={{}}
        customActions={customActions}
        hasMore={visibleCount < dataList.length}
        totalRecords={dataList.length}
        onLoadMore={() => setVisibleCount(prev => prev + BATCH_SIZE)}
      />
${modalJsx}
    </div>
  )
}
`
}
