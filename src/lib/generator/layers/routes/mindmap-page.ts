import { RouteNode } from '../../ast'
import { renderFormField, getByocComponentName, toPascalCase, FORM_INPUT_FORMAT_HELPERS } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// MindMap Page (Server Component)
// ─────────────────────────────────────────────────────────────────────────────

export function generateMindMapPage(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const hasCreate = route.buttons.some(b => b.actionType === 'create') || route.buttons.length === 0

  // Detecta tabelas relacionadas para lookups
  const lookupModels = new Map<string, string>()
  const allFields = [
    ...(route.filterFields || []),
    ...(route.gridFields || []),
    ...(route.formFields || []),
  ]

  if (route.relationTabs && route.relationTabs.length > 0) {
    route.relationTabs.forEach(tab => {
      const tabFields = tab.formFields && tab.formFields.length > 0 ? tab.formFields : tab.gridFields
      if (tabFields) allFields.push(...tabFields)
      if (tab.subDetails) {
        tab.subDetails.forEach(sub => {
          const subFields = sub.formFields && sub.formFields.length > 0 ? sub.formFields : sub.gridFields
          if (subFields) allFields.push(...subFields)
        })
      }
    })
  }

  allFields.forEach(f => {
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

  lookupModels.delete(mnLower)

  const lookupImports = Array.from(lookupModels.entries()).map(([table, modelName]) =>
    `import { get${modelName}List } from '@/app/actions/${table}'`
  ).join('\n')

  const lookupQueries = Array.from(lookupModels.entries()).map(([table, modelName]) =>
    `  const ${table}LookupList = await get${modelName}List().catch(() => [])`
  ).join('\n')

  const buildOptionsCode: string[] = []
  allFields.forEach(f => {
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

  return `import { get${mn}List } from '@/app/actions/${mnLower}'
${lookupImports ? `${lookupImports}\n` : ''}import { MindMapClient } from './MindMapClient'
import { DynamicIcon } from '@/app/components/DynamicIcon'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ${mn}MindMapPage(props: {
  searchParams?: Promise<Record<string, string | undefined>>
}) {
  const searchParams = props.searchParams ? await props.searchParams : {}
  const data = await get${mn}List().catch(() => [])
${lookupQueries ? `${lookupQueries}\n` : ''}
  const relationalOptions: Record<string, Array<{ value: string; label: string }>> = {
${buildOptionsCode.join('\n')}
  }

  return (
    <div className="space-y-6">
      {/* Header Padrão MetaBuilder RuntimeHeader */}
      <div className="px-6 sm:px-10 py-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-purple-600 rounded-2xl shadow-lg shadow-purple-500/20 text-white shrink-0">
            <DynamicIcon icon="${route.icon || 'Share2'}" size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
              ${route.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-8 h-1 bg-purple-600 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                MAPA MENTAL &bull; {data.length} {data.length === 1 ? 'REGISTRO' : 'REGISTROS'}
              </span>
            </div>
          </div>
        </div>

        {/* Botão Novo Registro */}
        ${hasCreate ? `<div className="flex items-center gap-3">
          <Link
            href="${route.path}/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-purple-500/20 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Registro</span>
          </Link>
        </div>` : ''}
      </div>

      {/* MindMap Interactive Orbital Canvas */}
      <div className="px-6 sm:px-10">
        <MindMapClient
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
// MindMap Schema ([route]/schema.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function generateMindMapSchema(route: RouteNode): string {
  const mn = route.modelName
  const mc = route.mindmapConfig || {
    hierarchyFields: route.gridFields.filter(f => !f.isPrimaryKey && !f.isVirtual && !f.isByoc).map(f => f.dbColumn),
  }

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

  const fieldsData = JSON.stringify(
    route.gridFields.map(f => ({
      id: f.id,
      dbColumn: f.dbColumn,
      label: f.label,
      dataType: f.dataType,
      config: f.config,
    })),
    null,
    2
  )

  const mindmapConfigData = JSON.stringify(mc, null, 2)

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

  const hasRelationTabs = route.relationTabs && route.relationTabs.length > 0

  const usedTabPrefixes = new Set<string>()
  const tabConstants: string[] = []

  if (hasRelationTabs) {
    route.relationTabs.forEach((tab, i) => {
      const tabFields = (tab.formFields && tab.formFields.length > 0 ? tab.formFields : tab.gridFields)
        .filter(f => !f.dbColumn.includes('.') || f.dbColumn.startsWith(tab.relatedTable + '.'))

      const basePrefix = tab.relatedTable.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
      const constPrefix = usedTabPrefixes.has(basePrefix) ? `${basePrefix}_${i + 1}` : basePrefix
      usedTabPrefixes.add(constPrefix)

      const fieldsConstName = `${constPrefix}_FIELDS`
      const subDetailsConstName = `${constPrefix}_SUB_DETAILS`

      const mappedFields = tabFields.map(f => ({
        id: f.id,
        label: f.label,
        dbColumn: f.dbColumn.includes('.') ? f.dbColumn.split('.').pop()! : f.dbColumn,
        dataType: f.dataType,
        isPrimaryKey: f.isPrimaryKey,
        config: f.config,
      }))

      const mappedSubDetails = tab.subDetails && tab.subDetails.length > 0
        ? tab.subDetails.map(sub => ({
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
          }))
        : []

      tabConstants.push(
        `// Schema de campos da aba "${tab.label}" (${tab.relatedTable})`,
        `export const ${fieldsConstName} = ${JSON.stringify(mappedFields, null, 2)} as const`,
        ``,
        `// Sub-detalhes da aba "${tab.label}" (${tab.relatedTable})`,
        `export const ${subDetailsConstName} = ${JSON.stringify(mappedSubDetails, null, 2)} as const`,
        ``
      )
    })
  }

  return `// ─────────────────────────────────────────────────────────────────────────────
// Schemas e configurações declarativas para Mapa Mental de ${route.title}
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'

export const filterFields = ${filterFieldsData}

export const fields = ${fieldsData}

export const mindmapConfig = ${mindmapConfigData}

export const ${mn}Schema = z.object({
${zodFields}
})

export type ${mn}FormData = z.infer<typeof ${mn}Schema>

${tabConstants.join('\n')}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// MindMap Client Component ([route]/MindMapClient.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export function generateMindMapClient(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const pk = route.primaryKey || 'id'
  const isActionModal = route.actionInterfaceType === 'modal'
    || route.rawLayoutConfig?.action_interface_type === 'modal'
  const hasRelationTabs = route.relationTabs && route.relationTabs.length > 0

  const modalFormFieldsHtml = route.formFields
    .map(f => renderFormField(f, true, false, 'relationalOptions'))
    .filter(Boolean)
    .join('\n')

  const byocImports = route.formFields
    .filter(f => f.isByoc || f.dataType === 'byoc' || f.id.startsWith('byoc_'))
    .map(f => getByocComponentName(f))
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .map(name => `import { ${name} } from '@/components/${name}'`)
    .join('\n')

  const clientActionsMap = new Map<string, Set<string>>()
  const addClientAction = (modelLower: string, fn: string) => {
    const key = `@/app/actions/${modelLower}`
    if (!clientActionsMap.has(key)) clientActionsMap.set(key, new Set())
    clientActionsMap.get(key)!.add(fn)
  }

  if (hasRelationTabs && isActionModal) {
    route.relationTabs.forEach(t => {
      const ml = t.relatedTable.toLowerCase()
      addClientAction(ml, `get${t.relatedModelName}ByField`)
      addClientAction(ml, `create${t.relatedModelName}`)
      addClientAction(ml, `update${t.relatedModelName}`)
      addClientAction(ml, `delete${t.relatedModelName}`)
      if (t.subDetails) {
        t.subDetails.forEach(sub => {
          const sml = sub.relatedTable.toLowerCase()
          addClientAction(sml, `create${sub.relatedModelName}`)
          addClientAction(sml, `update${sub.relatedModelName}`)
          addClientAction(sml, `delete${sub.relatedModelName}`)
        })
      }
    })
  }

  if (route.mindmapConfig?.levels && route.mindmapConfig.levels.length > 1) {
    route.mindmapConfig.levels.slice(1).forEach(lvl => {
      if (lvl.relationType === 'multilevel' && lvl.relationPath && lvl.relationPath.length > 0) {
        lvl.relationPath.forEach(hop => {
          const hopTable = hop.table.toLowerCase()
          const hopModel = toPascalCase(hop.table)
          addClientAction(hopTable, `get${hopModel}ByField`)
        })
        if (lvl.modelTable && lvl.modelName) {
          addClientAction(lvl.modelTable.toLowerCase(), `get${lvl.modelName}ById`)
          addClientAction(lvl.modelTable.toLowerCase(), `get${lvl.modelName}ByField`)
        }
      } else if (lvl.relationType === 'indirect' && lvl.throughTable) {
        const throughTable = lvl.throughTable.toLowerCase()
        const throughModel = toPascalCase(lvl.throughTable)
        addClientAction(throughTable, `get${throughModel}ByField`)
        if (lvl.modelTable && lvl.modelName) {
          addClientAction(lvl.modelTable.toLowerCase(), `get${lvl.modelName}ById`)
          addClientAction(lvl.modelTable.toLowerCase(), `get${lvl.modelName}ByField`)
        }
      } else if (lvl.modelTable && lvl.modelName) {
        addClientAction(lvl.modelTable.toLowerCase(), `get${lvl.modelName}ByField`)
      }
    })
  }

  const clientActionImports = Array.from(clientActionsMap.entries())
    .map(([path, fns]) => `import { ${Array.from(fns).join(', ')} } from '${path}'`)
    .join('\n')

  const relationImports = [
    (hasRelationTabs && isActionModal) ? `import { DetailRelationSection } from '@/components/DetailRelationSection'` : '',
    clientActionImports,
  ].filter(Boolean).join('\n')

  const usedTabPrefixes = new Set<string>()
  const modalTabConstNames: string[] = []

  const relationTabPanels = hasRelationTabs && isActionModal
    ? route.relationTabs.map((tab, i) => {
        const basePrefix = tab.relatedTable.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
        const constPrefix = usedTabPrefixes.has(basePrefix) ? `${basePrefix}_${i + 1}` : basePrefix
        usedTabPrefixes.add(constPrefix)

        const fieldsConstName = `${constPrefix}_FIELDS`
        const subDetailsConstName = `${constPrefix}_SUB_DETAILS`

        modalTabConstNames.push(fieldsConstName, subDetailsConstName)

        const subActionProps = tab.subDetails && tab.subDetails.length > 0
          ? [
              `                createSubAction={create${tab.subDetails[0].relatedModelName}}`,
              `                updateSubAction={update${tab.subDetails[0].relatedModelName}}`,
              `                deleteSubAction={delete${tab.subDetails[0].relatedModelName}}`,
            ].join('\n')
          : ''

        return `
            <div key="${tab.relatedTable}" className="space-y-3">
              <DetailRelationSection
                label="${tab.label}"
                relatedTable="${tab.relatedTable}"
                foreignKey="${tab.foreignKey}"
                parentId={String(activeRecord?.${pk} || activeRecord?.id || '')}
                items={modalRelationItems['${tab.relatedTable}'] || []}
                fields={(${fieldsConstName} as any[]).map((f: any) => {
                  const opts = relationalOptions?.[f.dbColumn]
                  if (opts && opts.length > 0) {
                    return {
                      ...f,
                      config: {
                        ...f.config,
                        options: opts
                      }
                    }
                  }
                  return f
                })}
                subDetails={(${subDetailsConstName} as any[]).map((sub: any) => ({
                  ...sub,
                  fields: (sub.fields || []).map((f: any) => {
                    const opts = relationalOptions?.[f.dbColumn]
                    if (opts && opts.length > 0) {
                      return {
                        ...f,
                        config: {
                          ...f.config,
                          options: opts
                        }
                      }
                    }
                    return f
                  })
                }))}
                createAction={create${tab.relatedModelName}}
                updateAction={update${tab.relatedModelName}}
                deleteAction={delete${tab.relatedModelName}}
                backPath="${route.path}"
                hideFooter={true}
${subActionProps}
              />
            </div>`
      }).join('\n')
    : ''

  const schemaImports = `import { fields, mindmapConfig${modalTabConstNames.length > 0 ? `, ${modalTabConstNames.join(', ')}` : ''} } from './schema'`

  const modalStateVars = isActionModal ? `  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('edit')
  const [activeRecord, setActiveRecord] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [modalRelationItems, setModalRelationItems] = useState<Record<string, any[]>>({})` : ''

  const relationFetchEffect = (hasRelationTabs && isActionModal)
    ? `
  // Busca itens relacionados para o registro aberto na modal
  useEffect(() => {
    if (activeRecord && (activeRecord.${pk} || activeRecord.id)) {
      const recId = String(activeRecord.${pk} || activeRecord.id)
${route.relationTabs.map(tab => `      get${tab.relatedModelName}ByField('${tab.foreignKey}', recId)
        .then((items: any) => setModalRelationItems(prev => ({ ...prev, '${tab.relatedTable}': items || [] })))
        .catch(() => {})`).join('\n')}
    } else {
      setModalRelationItems({})
    }
  }, [activeRecord])`
    : ''

  const handleAddBody = isActionModal
    ? `    setActiveRecord({})
    setModalMode('create')
    setIsModalOpen(true)`
    : `    router.push('${route.path}/new')`

  const handleEditBody = isActionModal
    ? `    setActiveRecord(row)
    setModalMode('edit')
    setIsModalOpen(true)`
    : `    const recordId = String(row.${pk} || row.id)
    router.push(\`${route.path}/\${recordId}\`)`

  const handleViewBody = isActionModal
    ? `    handleEdit(row)`
    : `    const recordId = String(row.${pk} || row.id)
    router.push(\`${route.path}/\${recordId}\`)`

  const modalSaveHandler = isActionModal ? `  const handleSaveRecord = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const masterContainer = document.getElementById('mindmap-master-fields')
      const payload: Record<string, any> = {}
      if (masterContainer) {
        const inputs = masterContainer.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')
        inputs.forEach(inp => {
          if (inp.name) {
            payload[inp.name] = inp.value === '' ? null : inp.value
          }
        })
      } else {
        const formData = new FormData(e.currentTarget)
        formData.forEach((val, key) => {
          payload[key] = val === '' ? null : val
        })
      }

      if (modalMode === 'edit' && activeRecord) {
        const recordId = String(activeRecord.${pk} || activeRecord.id)
        await update${mn}(recordId, payload)
        setDataList(prev => prev.map(item =>
          String(item.${pk} || item.id) === recordId ? { ...item, ...payload } : item
        ))
      } else {
        const res = await create${mn}(payload)
        if (res) setDataList(prev => [res, ...prev])
      }

      // Salva alterações nas abas de detalhe (relações filhas e sub-itens)
      if (modalMode === 'edit') {
        const savePromises: Promise<any>[] = []
        window.dispatchEvent(new CustomEvent('save-all-relations', { detail: { promises: savePromises } }))
        if (savePromises.length > 0) {
          await Promise.all(savePromises)
        }
      }

      setIsModalOpen(false)
      setActiveRecord(null)
      setModalRelationItems({})
      router.refresh()
    } catch (err: any) {
      console.error('Erro ao salvar registro:', err)
      alert('Erro ao salvar: ' + (err?.message || err))
    } finally {
      setIsSaving(false)
    }
  }

  const data = activeRecord
  const isEdit = modalMode === 'edit'` : ''

  const modalJsx = isActionModal ? `
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-2xl w-full ${hasRelationTabs ? 'max-w-4xl' : 'max-w-2xl'} max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 sm:p-8 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                    {modalMode === 'edit' ? 'Editar Registro' : 'Novo Registro no Mapa'}
                  </h2>
                  <p className="text-xs font-medium text-neutral-400 mt-0.5 font-mono">
                    {modalMode === 'edit'
                      ? ('Registro #' + (activeRecord?.${pk} || activeRecord?.id || ''))
                      : 'Preencha os dados cadastrais'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); setActiveRecord(null); setModalRelationItems({}); }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
                <div id="mindmap-master-fields" className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-5">
${modalFormFieldsHtml}
                </div>

${hasRelationTabs && isActionModal ? `                {modalMode === 'edit' && activeRecord && (
                  <div className="space-y-6 pt-6 border-t border-neutral-100 dark:border-neutral-800">
${relationTabPanels}
                  </div>
                )}` : ''}
              </div>

              <div className="flex items-center justify-end gap-3 p-6 sm:p-8 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setActiveRecord(null); setModalRelationItems({}); }}
                  className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Salvando...' : (modalMode === 'edit' ? 'Salvar Alterações' : 'Salvar Registro')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}` : ''

  const mindmapLevels = route.mindmapConfig?.levels || []
  const hasMindmapLevels = mindmapLevels.length > 1

  const levelFetchHandlers = hasMindmapLevels
    ? mindmapLevels.slice(1).map((lvl, idx) => {
        const lvlIdx = idx + 1
        const titleField = lvl.titleField || 'nome'
        const descExpr = lvl.descField ? `item['${lvl.descField}'] ? String(item['${lvl.descField}']) : undefined` : 'undefined'
        const hasDeeper = lvlIdx < mindmapLevels.length - 1

        if (lvl.relationType === 'multilevel' && lvl.relationPath && lvl.relationPath.length > 0) {
          const hops = lvl.relationPath
          return `    if (nextLevelIndex === ${lvlIdx}) {
      let currentIds = [parentId]
      ${hops.map((hop, hIdx) => {
        const hopModel = toPascalCase(hop.table)
        return `// Hop ${hIdx + 1}: ${hop.table} (${hop.to_field} -> ${hop.target_from_field})
      const hop${hIdx}Fetches = await Promise.all(
        currentIds.map(id => get${hopModel}ByField('${hop.to_field}', id).catch(() => []))
      )
      const hop${hIdx}Rows = hop${hIdx}Fetches.flat()
      currentIds = Array.from(new Set(hop${hIdx}Rows.map((r: any) => r['${hop.target_from_field}']).filter(Boolean)))
      if (currentIds.length === 0) return []`
      }).join('\n      ')}

      const targetField = '${hops[hops.length - 1].target_to_field || 'id'}'
      const items = targetField === 'id'
        ? (await Promise.all(currentIds.map(id => get${lvl.modelName}ById(String(id)).catch(() => null)))).filter(Boolean)
        : (await Promise.all(currentIds.map(id => get${lvl.modelName}ByField(targetField, id).then(r => Array.isArray(r) ? r[0] : r).catch(() => null)))).filter(Boolean)

      return (items || []).map((item: any) => ({
        id: String(item.id || item.codigo || item.uuid || Math.random()),
        name: String(item['${titleField}'] || item.nome || item.name || item.title || item.descricao || 'Sem Título'),
        desc: ${descExpr},
        count: 0,
        level: ${lvlIdx},
        rawData: item,
        children: ${hasDeeper ? 'undefined' : '[]'},
      }))
    }`
        }

        if (lvl.relationType === 'indirect' && lvl.throughTable && lvl.throughLocalFk && lvl.throughTargetFk) {
          const throughModel = toPascalCase(lvl.throughTable)
          return `    if (nextLevelIndex === ${lvlIdx}) {
      const junctionItems = await get${throughModel}ByField('${lvl.throughLocalFk}', parentId).catch(() => [])
      const targetIds = Array.from(new Set((junctionItems || []).map((j: any) => j['${lvl.throughTargetFk}']).filter(Boolean)))
      const items = targetIds.length > 0
        ? (await Promise.all(targetIds.map(id => get${lvl.modelName}ById(String(id)).catch(() => null)))).filter(Boolean)
        : []
      return (items || []).map((item: any) => ({
        id: String(item.id || item.codigo || item.uuid || Math.random()),
        name: String(item['${titleField}'] || item.nome || item.name || item.title || item.descricao || 'Sem Título'),
        desc: ${descExpr},
        count: 0,
        level: ${lvlIdx},
        rawData: item,
        children: ${hasDeeper ? 'undefined' : '[]'},
      }))
    }`
        }

        const fk = lvl.foreignKey || `${route.modelTable.toLowerCase()}_id`
        return `    if (nextLevelIndex === ${lvlIdx}) {
      const items = await get${lvl.modelName}ByField('${fk}', parentId).catch(() => [])
      return (items || []).map((item: any) => ({
        id: String(item.id || item.codigo || item.uuid || Math.random()),
        name: String(item['${titleField}'] || item.nome || item.name || item.title || item.descricao || 'Sem Título'),
        desc: ${descExpr},
        count: 0,
        level: ${lvlIdx},
        rawData: item,
        children: ${hasDeeper ? 'undefined' : '[]'},
      }))
    }`
      }).join('\n')
    : ''

  const fetchChildrenFn = hasMindmapLevels ? `
  const handleFetchChildren = async (nextLevelIndex: number, parentNode: any): Promise<any[]> => {
    const parentRow = parentNode.rawData
    const parentId = String(parentRow?.id ?? parentRow?.ID ?? (parentRow && parentRow['${pk}']) ?? parentRow?.uuid ?? parentRow?.codigo ?? parentNode.id)
    if (!parentId) return []

${levelFetchHandlers}

    return []
  }
` : ''

  return `'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { update${mn}, delete${mn}, create${mn} } from '@/app/actions/${mnLower}'
${relationImports ? `${relationImports}\n` : ''}${schemaImports}
${byocImports ? `${byocImports}\n` : ''}import { Pencil, X, Save } from 'lucide-react'

${FORM_INPUT_FORMAT_HELPERS}

// Carregamento dinâmico sem SSR para segurança do Framer Motion e renderização no cliente
const MindMapBoard = dynamic(
  () => import('@/components/MindMapBoard').then(mod => mod.MindMapBoard),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[650px] flex flex-col items-center justify-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 space-y-4">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
          Carregando mapa mental...
        </p>
      </div>
    ),
  }
)

export function MindMapClient({
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
${relationFetchEffect}

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

${modalSaveHandler}
${fetchChildrenFn}

  return (
    <div className="space-y-6">
      <MindMapBoard
        data={dataList}
        fields={fields}
        mindmapConfig={mindmapConfig}
        relationalOptions={relationalOptions}
${hasMindmapLevels ? '        onFetchChildren={handleFetchChildren}\n' : ''}        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
${modalJsx}
    </div>
  )
}
`
}
