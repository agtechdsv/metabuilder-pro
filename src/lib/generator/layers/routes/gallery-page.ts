import { RouteNode } from '../../ast'
import { renderFormField, getByocComponentName, toPascalCase, FORM_INPUT_FORMAT_HELPERS } from './helpers'
// ─────────────────────────────────────────────────────────────────────────────
// Gallery Page (Server Component)
// ─────────────────────────────────────────────────────────────────────────────

export function generateGalleryPage(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const hasCreate = route.buttons.some(b => b.actionType === 'create') || route.buttons.length === 0

  // Detecta todas as tabelas relacionadas necessárias para lookups dos filtros e cards
  const lookupModels = new Map<string, string>() // table -> modelName
  const allGalleryFields = [
    ...(route.filterFields || []),
    ...(route.gridFields || []),
    ...(route.formFields || []),
  ]

  allGalleryFields.forEach(f => {
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

  // Também adiciona tabelas de campos relacionais de card_fields (ex: "categorias_produtos.nome")
  const cardFields = route.galleryConfig?.cardFields || []
  cardFields.forEach(cf => {
    if (cf.includes('.')) {
      const [table] = cf.split('.')
      if (table && !table.includes('-') && table.length < 30) {
        lookupModels.set(table.toLowerCase(), toPascalCase(table))
      }
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

  // Remove o próprio modelo se acidentalmente incluído
  lookupModels.delete(mnLower)

  const lookupImports = Array.from(lookupModels.entries()).map(([table, modelName]) =>
    `import { get${modelName}List } from '@/app/actions/${table}'`
  ).join('\n')

  const lookupQueries = Array.from(lookupModels.entries()).map(([table, modelName]) =>
    `  const ${table}LookupList = await get${modelName}List().catch(() => [])`
  ).join('\n')

  const buildOptionsCode: string[] = []
  allGalleryFields.forEach(f => {
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
      buildOptionsCode.push(`    '${t}': (${t}LookupList || []).map((r: any) => ({ value: String(${valueExpr}), label: String(${labelExpr}) })),`)
    } else if (f.config?.options && Array.isArray(f.config.options) && f.config.options.length > 0) {
      buildOptionsCode.push(`    '${f.dbColumn}': ${JSON.stringify(f.config.options)},`)
    }
  })

  // Filtros de Pesquisa
  const filterFields = (route.filterFields && route.filterFields.length > 0)
    ? route.filterFields
    : (route.gridFields || []).filter(f => !f.isPrimaryKey && !f.isVirtual && !f.isByoc).slice(0, 3)

  const filterInputs = filterFields.map(f => {
    const col = f.dbColumn.replace('.', '_')
    const gridSpan = f.config?.gridSpan || f.config?.component?.gridSpan || 4
    const colSpanClass = `col-span-12 md:col-span-${Math.min(12, gridSpan || 4)}`
    const targetTable = f.config?.relation?.targetTable || f.config?.component?.rel_table || f.config?.rel_table || (f.dbColumn.endsWith('_id') ? (f.dbColumn.slice(0, -3).endsWith('s') ? f.dbColumn.slice(0, -3) : f.dbColumn.slice(0, -3) + 's') : null)
    const isRelational = targetTable && lookupModels.has(targetTable.toLowerCase())

    let options = f.config?.options
    const defValExpr = `searchParams?.['${col}_filter'] || searchParams?.['${col}'] || searchParams?.['${f.dbColumn}'] || (('${col}').endsWith('_id') ? searchParams?.['${col}'.slice(0, -3)] : searchParams?.['${col}_id']) || ''`

    if (isRelational && targetTable) {
      const targetListVar = `${targetTable.toLowerCase()}LookupList`
      const relLabel = f.config?.component?.rel_label || f.config?.relation?.displayColumn || f.config?.rel_label
      const relValue = f.config?.component?.rel_value || f.config?.relation?.valueColumn || f.config?.rel_value || 'id'
      const labelExpr = relLabel
        ? `r[${JSON.stringify(relLabel)}] ?? r[${JSON.stringify(relLabel.toLowerCase())}] ?? r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
        : `r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
      const valueExpr = `r[${JSON.stringify(relValue)}] ?? r[${JSON.stringify(relValue.toLowerCase())}] ?? r.id ?? Object.values(r)[0] ?? ''`

      return `
          <div className="flex flex-col gap-1.5 ${colSpanClass}">
            <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">${f.label}</label>
            <select
              name="${col}_filter"
              defaultValue={${defValExpr}}
              className="w-full h-[42px] px-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
            >
              <option value="">Todos</option>
              {(${targetListVar} || []).map((r: any, i: number) => (
                <option key={i} value={String(${valueExpr})}>{String(${labelExpr})}</option>
              ))}
            </select>
          </div>`
    }

    if (options && options.length > 0) {
      const optsCode = JSON.stringify(options)
      return `
          <div className="flex flex-col gap-1.5 ${colSpanClass}">
            <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">${f.label}</label>
            <select
              name="${col}_filter"
              defaultValue={${defValExpr}}
              className="w-full h-[42px] px-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
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
                defaultValue={${defValExpr}}
                className="w-full h-[42px] pl-9 pr-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-300 outline-none focus:border-indigo-500 transition-all shadow-sm"
              />
            </div>
          </div>`
  }).join('\n')

  const headerButtonsHtml = route.buttons.filter(b => b.placement === 'header').map(b => {
    if (b.actionType === 'create') {
      return `          <Link href={\`${route.path}/new\${isEmbedded ? '?embedded=true' : ''}\`} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95 cursor-pointer">
            <Plus className="w-4 h-4" /> ${b.label}
          </Link>`
    }
    if (b.actionType === 'export') {
      return `          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95 cursor-pointer">
            <Download className="w-4 h-4 text-neutral-400" /> ${b.label}
          </button>`
    }
    return `          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95 cursor-pointer">
            ${b.label}
          </button>`
  }).join('\n') || `          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95 cursor-pointer">
            <Zap className="w-4 h-4 text-neutral-400" /> Automações
          </button>
          <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95 cursor-pointer">
            <Download className="w-4 h-4 text-neutral-400" /> Exportar
          </button>${hasCreate ? `
          <Link href={\`${route.path}/new\${isEmbedded ? '?embedded=true' : ''}\`} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95 cursor-pointer">
            <Plus className="w-4 h-4" /> Novo Registro
          </Link>` : ''}`

  return `import { get${mn}List } from '@/app/actions/${mnLower}'
${lookupImports ? `${lookupImports}\n` : ''}import { GalleryClient } from './GalleryClient'
import { DynamicIcon } from '@/app/components/DynamicIcon'
import Link from 'next/link'
import { Plus, Search, RefreshCcw, Download, Zap } from 'lucide-react'
import { CloseModalButton } from '@/components/ui/custom-action-button'

export const dynamic = 'force-dynamic'

export default async function ${mn}GalleryPage(props: {
  searchParams?: Promise<Record<string, string | undefined>>
}) {
  const searchParams = props.searchParams ? await props.searchParams : {}
  const isEmbedded = searchParams?.embedded === 'true'
  const rawData = await get${mn}List({ filters: searchParams }).catch(() => [])
${lookupQueries ? `${lookupQueries}\n` : ''}
  const rawJoins = ${JSON.stringify(rawJoins)}
  const tablesData: Record<string, any[]> = {
    ${Array.from(lookupModels.keys()).map(t => `'${t}': ${t}LookupList || [],`).join('\n    ')}
  }

  const enrichedData = (rawData || []).map((row: any) => {
    const item: Record<string, any> = { ...row }
    for (const [tbl, list] of Object.entries(tablesData)) {
      const singular = tbl.endsWith('s') ? tbl.slice(0, -1) : tbl
      const fkVal = row[tbl + '_id'] ?? row[singular + '_id'] ?? row['id_' + tbl] ?? row['id_' + singular]
      if (fkVal != null && Array.isArray(list)) {
        const match = list.find((r: any) => String(r.id) === String(fkVal))
        if (match) {
          item[tbl] = match
          item[singular] = match
          for (const [k, v] of Object.entries(match)) {
            item[tbl + '.' + k] = v
            item[singular + '.' + k] = v
          }
        }
      }
    }

    for (const j of rawJoins) {
      const fromTbl = (j.from || '').toLowerCase()
      const toTbl = (j.to || '').toLowerCase()
      const localKey = j.localKey || 'id'
      const foreignKey = j.foreignKey || (fromTbl + '_id')

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
              item[fromTbl + '.' + k] = v
              item[singular + '.' + k] = v
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
              item[toTbl + '.' + k] = v
              item[singular + '.' + k] = v
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

  // Filtros dinâmicos da URL
  const data = (enrichedData || []).filter((item: any) => {
${filterFields.map(f => {
  const col = f.dbColumn.replace('.', '_')
  const rawCol = f.dbColumn
  return `    const val_${col} = searchParams?.['${col}_filter'] || searchParams?.['${col}'] || searchParams?.['${f.dbColumn}']
    if (val_${col}) {
      const itemVal = String(item['${rawCol}'] ?? item['${col}'] ?? '').toLowerCase()
      if (!itemVal.includes(String(val_${col}).toLowerCase())) return false
    }`
}).join('\n')}
    for (const [paramKey, paramVal] of Object.entries(searchParams || {})) {
      if (!paramVal || paramKey === 'embedded' || paramKey.endsWith('_filter') || paramKey === 'page' || paramKey === 'limit' || paramKey === 'sort_by' || paramKey === 'sort_order' || paramKey === 'view_mode' || paramKey === 'layout') continue

      if (paramKey.includes('.')) {
        const [targetTable, targetCol] = paramKey.split('.')
        const tTable = targetTable.toLowerCase()
        if (tTable === '${mnLower}' || tTable.replace(/s$/, '') === '${mnLower}'.replace(/s$/, '')) {
          const val = item[targetCol] ?? item[paramKey]
          if (val !== undefined && val !== null) {
            if (typeof val === 'object') {
              const subVal = String(val.id ?? Object.values(val)[0] ?? '')
              if (subVal.toLowerCase() !== String(paramVal).toLowerCase()) return false
            } else if (String(val).toLowerCase() !== String(paramVal).toLowerCase()) {
              return false
            }
          }
        } else {
          // Filtro por tabela relacionada (ex: pedidos.id)
          const val = item[paramKey] ?? (item[tTable] ? (item[tTable][targetCol] ?? item[tTable].id) : undefined)
          if (val !== undefined && val !== null) {
            if (String(val).toLowerCase() !== String(paramVal).toLowerCase()) return false
          } else if (tablesData[tTable] && tablesData[tTable].length > 0) {
            let hasLink = false
            for (const j of rawJoins) {
              const fromT = (j.from || '').toLowerCase()
              const toT = (j.to || '').toLowerCase()
              const lKey = j.localKey || 'id'
              const fKey = j.foreignKey || (fromT + '_id')

              if (toT === '${mnLower}' && tablesData[fromT]) {
                const intermediateList = tablesData[fromT]
                const itemVal = item[lKey] ?? item.id
                const matchingRows = intermediateList.filter((r: any) => String(r[fKey] ?? r['${mnLower}_id'] ?? r.produto_id) === String(itemVal))
                for (const mRow of matchingRows) {
                  const directTarget = mRow[tTable + '_id'] ?? mRow[targetCol] ?? mRow.pedido_id
                  if (directTarget != null && String(directTarget).toLowerCase() === String(paramVal).toLowerCase()) {
                    hasLink = true
                    break
                  }
                }
              } else if (fromT === '${mnLower}' && tablesData[toT]) {
                const intermediateList = tablesData[toT]
                const itemVal = item[lKey] ?? item.id
                const matchingRows = intermediateList.filter((r: any) => String(r[fKey] ?? r['${mnLower}_id'] ?? r.produto_id) === String(itemVal))
                for (const mRow of matchingRows) {
                  const directTarget = mRow[tTable + '_id'] ?? mRow[targetCol] ?? mRow.pedido_id
                  if (directTarget != null && String(directTarget).toLowerCase() === String(paramVal).toLowerCase()) {
                    hasLink = true
                    break
                  }
                }
              }
              if (hasLink) break
            }
            if (!hasLink) {
              const targetList = tablesData[tTable]
              const targetRow = targetList.find((r: any) => String(r[targetCol] ?? r.id).toLowerCase() === String(paramVal).toLowerCase())
              if (targetRow) {
                const fkVal = targetRow['${mnLower}_id'] ?? targetRow.produto_id
                if (fkVal != null && String(fkVal).toLowerCase() !== String(item.id).toLowerCase()) {
                  return false
                }
              }
            }
          }
        }
      } else {
        const val = item[paramKey] ?? (paramKey.endsWith('_id') ? item[paramKey.slice(0, -3)] : undefined)
        if (val !== undefined && val !== null) {
          if (typeof val === 'object') {
            const subVal = String(val.id ?? Object.values(val)[0] ?? '')
            if (subVal.toLowerCase() !== String(paramVal).toLowerCase()) return false
          } else if (String(val).toLowerCase() !== String(paramVal).toLowerCase()) {
            return false
          }
        }
      }
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header Fiel ao Padrão MetaBuilder RuntimeHeader */}
      <div className="px-6 sm:px-10 py-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white shrink-0">
            <DynamicIcon icon="${route.icon || 'LayoutGrid'}" size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
              ${route.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-8 h-1 bg-indigo-600 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                ${route.description ? route.description.toUpperCase() : 'SISTEMA METABUILDER'}
              </span>
            </div>
          </div>
        </div>

        {/* Ações do Header */}
        <div className="flex items-center gap-3">
${headerButtonsHtml}
          {isEmbedded && <CloseModalButton />}
        </div>
      </div>

      {/* Barra de Filtros / Argumentos da View (Fiel à Web Produção) */}
      ${filterFields.length > 0 ? `
      <div className="px-6 sm:px-10">
        <form method="GET" className="p-6 bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-inner">
          {isEmbedded && <input type="hidden" name="embedded" value="true" />}
          <div className="flex flex-col lg:flex-row items-end gap-6">
            <div className="flex-1 grid grid-cols-12 gap-4 w-full">
${filterInputs}
            </div>
            <div className="flex items-center gap-3 mb-[1px]">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 h-[42px] bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                Pesquisar
              </button>
              <Link
                href={\`${route.path}\${isEmbedded ? '?embedded=true' : ''}\`}
                className="flex items-center gap-2 px-5 h-[42px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
              >
                <RefreshCcw className="w-3.5 h-3.5 text-neutral-400" />
                Limpar
              </Link>
            </div>
          </div>
        </form>
      </div>` : ''}

      {/* Conteúdo da Galeria */}
      <div className="px-6 sm:px-10 pb-12">
        <GalleryClient
          initialData={data}
          relationalOptions={relationalOptions}
          initialParams={searchParams}
        />
      </div>
    </div>
  )
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Gallery Schema ([route]/schema.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function generateGallerySchema(route: RouteNode): string {
  const mn = route.modelName
  const gc = route.galleryConfig || {}

  const rawFilterFields = route.filterFields && route.filterFields.length > 0
    ? route.filterFields
    : route.gridFields.filter(f => !f.isPrimaryKey && !f.isVirtual && !f.isByoc).slice(0, 3)

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

  // Combina gridFields e formFields para garantir que url_imagem e cardFields estejam presentes
  const fieldMap = new Map<string, any>()
  ;[...route.gridFields, ...route.formFields].forEach(f => {
    if (!fieldMap.has(f.dbColumn)) {
      fieldMap.set(f.dbColumn, {
        id: f.id,
        dbColumn: f.dbColumn,
        label: f.label,
        dataType: f.dataType,
        config: f.config,
      })
    }
  })
  const fieldsData = JSON.stringify(Array.from(fieldMap.values()), null, 2)

  let resolvedImageField = gc.imageField || (gc as any).image_field || ''
  if (!resolvedImageField) {
    const candidate = Array.from(fieldMap.values()).find(f =>
      f.dataType === 'image' ||
      f.dataType === 'file' ||
      f.dbColumn.toLowerCase().includes('foto') ||
      f.dbColumn.toLowerCase().includes('imagem') ||
      f.dbColumn.toLowerCase().includes('image') ||
      f.dbColumn.toLowerCase().includes('avatar') ||
      f.dbColumn.toLowerCase().includes('capa') ||
      f.dbColumn.toLowerCase().includes('thumb') ||
      (f.dbColumn.toLowerCase().includes('url') && !f.dbColumn.toLowerCase().includes('id'))
    )
    if (candidate) resolvedImageField = candidate.dbColumn
  }

  const galleryConfigObj = {
    imageField: resolvedImageField,
    titleField: gc.titleField || (gc as any).title_field || '',
    cardFields: gc.cardFields || (gc as any).card_fields || [],
    cardFieldsLabels: gc.cardFieldsLabels || (gc as any).card_fields_labels || {},
    clickBehavior: gc.clickBehavior || (gc as any).click_behavior || 'fullscreen',
    // snake_case aliases para total interoperabilidade
    image_field: resolvedImageField,
    title_field: gc.titleField || (gc as any).title_field || '',
    card_fields: gc.cardFields || (gc as any).card_fields || [],
    card_fields_labels: gc.cardFieldsLabels || (gc as any).card_fields_labels || {},
  }

  const galleryConfigData = JSON.stringify(galleryConfigObj, null, 2)

  // Extração de Custom Actions (Row context)
  const rowCustomActions: any[] = route.buttons
    .filter(b => b.placement === 'row' && b.actionType === 'custom')
    .map(b => ({
      id: b.id,
      label: b.label,
      icon: b.icon || 'Receipt',
      color: b.color || (b as any).color || 'indigo',
      style: b.style,
      triggerType: b.triggerType,
      usecaseSlug: b.usecaseSlug,
      usecaseOpenMode: b.usecaseOpenMode || 'modal',
      usecaseModalSize: b.usecaseModalSize || '4xl',
      usecaseModalWidth: b.usecaseModalWidth,
      usecaseModalHeight: b.usecaseModalHeight,
      usecaseSelectedFields: b.usecaseSelectedFields || [],
      usecaseParams: b.usecaseParams || '',
      linkTarget: b.linkTarget || '',
    }))

  if (rowCustomActions.length === 0 && Array.isArray(route.rawLayoutConfig?.custom_actions)) {
    route.rawLayoutConfig.custom_actions
      .filter((a: any) => {
        if (!a || a.enabled === false) return false
        const ctxs = a.contexts ? (Array.isArray(a.contexts) ? a.contexts : [a.contexts]) : (a.context ? [a.context] : ['row'])
        return ctxs.includes('row') || ctxs.includes('row_search')
      })
      .forEach((a: any) => {
        rowCustomActions.push({
          id: a.id || `custom_act_${(a.label || 'act').toLowerCase().replace(/\s+/g, '_')}`,
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

  const zodFields = route.formFields.map(f => {
    let zType = 'z.any().optional()'
    if (f.dataType === 'number' || f.dataType === 'integer' || f.dataType === 'decimal') {
      zType = 'z.coerce.number().optional()'
    } else if (f.dataType === 'boolean') {
      zType = 'z.boolean().optional()'
    } else {
      zType = 'z.string().optional()'
    }
    return `  ${f.dbColumn}: ${zType},`
  }).join('\n')

  return `// ─────────────────────────────────────────────────────────────────────────────
// Schemas e configurações declarativas para Galeria de ${route.title}
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'

export const filterFields = ${filterFieldsData}

export const fields = ${fieldsData}

export const galleryConfig = ${galleryConfigData}

export const customActions = ${customActionsData}

export const ${mn}Schema = z.object({
${zodFields}
})

export type ${mn}FormData = z.infer<typeof ${mn}Schema>
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Gallery Client Component ([route]/GalleryClient.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export function generateGalleryClient(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const pk = route.primaryKey || 'id'
  const isActionModal = route.actionInterfaceType === 'modal'
    || route.rawLayoutConfig?.action_interface_type === 'modal'

  const modalFormFieldsHtml = route.formFields
    .map(f => renderFormField(f, true, 'isView', 'relationalOptions', true))
    .filter(Boolean)
    .join('\n')

  const byocImports = route.formFields
    .filter(f => f.isByoc || f.dataType === 'byoc' || f.id.startsWith('byoc_'))
    .map(f => getByocComponentName(f))
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .map(name => `import { ${name} } from '@/components/${name}'`)
    .join('\n')

  const modalStateVars = isActionModal ? `  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('edit')
  const [activeRecord, setActiveRecord] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const formRef = React.useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (isModalOpen && formRef.current) {
      recalculateFormulas(formRef.current)
    }
  }, [isModalOpen, activeRecord])` : ''

  const handleAddBody = isActionModal
    ? `    setActiveRecord(null)
    setModalMode('create')
    setSaveError(null)
    setIsModalOpen(true)`
    : `    router.push('${route.path}/new')`

  const handleEditBody = isActionModal
    ? `    setActiveRecord(row)
    setModalMode('edit')
    setSaveError(null)
    setIsModalOpen(true)`
    : `    router.push('${route.path}/' + (row.${pk} || row.id))`

  const handleViewBody = isActionModal
    ? `    setActiveRecord(row)
    setModalMode('view')
    setSaveError(null)
    setIsModalOpen(true)`
    : `    router.push('${route.path}/' + (row.${pk} || row.id))`

  const modalSubmitHandler = isActionModal ? `  const handleSubmitModal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (modalMode === 'view') return
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
  const isEdit = modalMode === 'edit' || modalMode === 'view'
  const isView = modalMode === 'view'` : ''

  const modalJsx = isActionModal ? `
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 sm:p-8 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  {modalMode === 'view' ? (
                    <Eye className="w-5 h-5" />
                  ) : modalMode === 'create' ? (
                    <Plus className="w-5 h-5" />
                  ) : (
                    <Pencil className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                    {modalMode === 'view' ? 'Visualizar' : modalMode === 'edit' ? 'Editar Registro' : 'Novo Item na Galeria'}
                  </h2>
                  <p className="text-xs font-medium text-neutral-400 mt-0.5 font-mono">
                    {modalMode !== 'create'
                      ? ('Registro #' + (activeRecord?.${pk} || activeRecord?.id || ''))
                      : 'Preencha os dados do registro'}
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
              ref={formRef}
              key={modalMode + '-' + (activeRecord?.${pk} || activeRecord?.id || 'new')}
              onSubmit={handleSubmitModal}
              onInput={(e) => recalculateFormulas(e.currentTarget)}
              className="flex flex-col flex-1 overflow-hidden"
            >
              {saveError && (
                <div className="mx-6 sm:mx-8 mt-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-3 text-rose-700 dark:text-rose-400 text-xs animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span className="font-medium flex-1">{saveError}</span>
                  <button type="button" onClick={() => setSaveError(null)} className="hover:opacity-75 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-5">
                  ${modalFormFieldsHtml}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                {modalMode === 'view' ? (
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 rounded-xl bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 transition-all active:scale-95 cursor-pointer"
                  >
                    Fechar
                  </button>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}` : ''

  return `'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { update${mn}, delete${mn}, create${mn} } from '@/app/actions/${mnLower}'
import { GalleryBoard } from '@/components/GalleryBoard'
import { fields, galleryConfig, customActions } from './schema'
${byocImports ? `${byocImports}\n` : ''}import { Pencil, X, Save, Eye, Plus, AlertCircle } from 'lucide-react'

${FORM_INPUT_FORMAT_HELPERS}

export function GalleryClient({
  initialData,
  relationalOptions = {},
  initialParams = {},
}: {
  initialData: any[]
  relationalOptions?: Record<string, Array<{ value: string; label: string }>>
  initialParams?: Record<string, string | undefined>
}) {
  const router = useRouter()
  const [dataList, setDataList] = useState<any[]>(initialData)

${modalStateVars}

  useEffect(() => {
    setDataList(initialData)
  }, [initialData])

  const handleDelete = async (row: any) => {
    const recordId = String(row.${pk} || row.id)
    setDataList(prev => prev.filter(item => String(item.${pk} || item.id) !== recordId))
    await delete${mn}(recordId)
    router.refresh()
  }

  const handleAdd = () => {
${handleAddBody}
  }

  const handleEdit = (row: any) => {
${handleEditBody}
  }

  const handleView = (row: any) => {
${handleViewBody}
  }

${modalSubmitHandler}

  return (
    <div className="space-y-6">
      <GalleryBoard
        data={dataList}
        fields={fields}
        galleryConfig={galleryConfig}
        relationalOptions={relationalOptions}
        customActions={customActions}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAdd={handleAdd}
      />
${modalJsx}
    </div>
  )
}
`
}
