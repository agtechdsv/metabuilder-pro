import { RouteNode } from '../../ast'
import { renderFormField, getByocComponentName } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Client Component para Abas de Detalhe ([id]/DetailTabsClient.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export function generateDetailTabsClient(route: RouteNode): string {
  const mn = route.modelName
  const pk = route.primaryKey
  const title = route.title
  const backPath = route.path

  const formFieldsHtml = route.formFields
    .map(f => renderFormField(f, true, false, 'relationalOptions'))
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

  const clientActionsMap = new Map<string, Set<string>>()
  const addClientAction = (modelLower: string, fn: string) => {
    const key = `@/app/actions/${modelLower}`
    if (!clientActionsMap.has(key)) clientActionsMap.set(key, new Set())
    clientActionsMap.get(key)!.add(fn)
  }

  lookupModels.forEach((modelName) => {
    addClientAction(modelName.toLowerCase(), `get${modelName}List`)
  })
  subDetailModels.forEach((modelName) => {
    addClientAction(modelName.toLowerCase(), `create${modelName}`)
    addClientAction(modelName.toLowerCase(), `update${modelName}`)
    addClientAction(modelName.toLowerCase(), `delete${modelName}`)
  })
  if (hasRelationTabs) {
    route.relationTabs.forEach(t => {
      addClientAction(t.relatedModelName.toLowerCase(), `create${t.relatedModelName}`)
      addClientAction(t.relatedModelName.toLowerCase(), `update${t.relatedModelName}`)
      addClientAction(t.relatedModelName.toLowerCase(), `delete${t.relatedModelName}`)
    })
  }

  const clientActionImports = Array.from(clientActionsMap.entries())
    .map(([path, fns]) => `import { ${Array.from(fns).join(', ')} } from '${path}'`)
    .join('\n')

  const relationImports = hasRelationTabs
    ? [
        `import { DetailRelationSection } from '@/components/DetailRelationSection'`,
        clientActionImports,
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
          `                      options: (${tTable}LookupList || []).map((r: any) => {`,
          `                        const relLbl = f.config?.component?.rel_label || f.config?.relation?.displayColumn || f.config?.rel_label`,
          `                        return {`,
          `                          value: String(r.id ?? r.codigo ?? r.uuid ?? Object.values(r)[0] ?? ''),`,
          `                          label: String(relLbl ? (r[relLbl] ?? r[relLbl.toLowerCase()] ?? r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? '') : (r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? '')),`,
          `                        }`,
          `                      })`,
          `                    }`,
          `                  }`,
          `                }`,
        ].join('\n')).join('\n')

        return [
          `          <div className={activeTab === ${i + 1} ? 'block' : 'hidden'}>`,
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
          `          </div>`,
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

  if (mask === '00000-000') {
    if (d.length <= 5) return d
    return \`\${d.slice(0, 5)}-\${d.slice(5, 8)}\`
  }

  if (mask === '(00) 00000-0000' || mask === '(00) 0000-0000') {
    if (d.length <= 2) return \`(\${d}\`
    if (d.length <= 6) return \`(\${d.slice(0, 2)}) \${d.slice(2)}\`
    if (d.length <= 10) return \`(\${d.slice(0, 2)}) \${d.slice(2, 6)}-\${d.slice(6)}\`
    return \`(\${d.slice(0, 2)}) \${d.slice(2, 7)}-\${d.slice(7, 11)}\`
  }

  if (mask === '00/00/0000') {
    if (d.length <= 2) return d
    if (d.length <= 4) return \`\${d.slice(0, 2)}/\${d.slice(2)}\`
    return \`\${d.slice(0, 2)}/\${d.slice(2, 4)}/\${d.slice(4, 8)}\`
  }

  return s
}

${Array.from(lookupModels.entries()).map(([tTable]) => `let cached${tTable}LookupList: any[] = []`).join('\n')}

export function ${mn}DetailTabsClient({
  id,
  data,
  updateAction,
  backPath,
  title,
  icon,
  newPath,
  relationalOptions = {},
${hasRelationTabs ? route.relationTabs.map((tab) => `  ${tab.relatedTable}Items,`).join('\n') : ''}
}: {
  id: string
  data: any
  updateAction: any
  backPath: string
  title: string
  icon: string
  newPath: string
  relationalOptions?: Record<string, Array<{ value: string; label: string }>>
${hasRelationTabs ? route.relationTabs.map((tab) => `  ${tab.relatedTable}Items?: any[]`).join('\n') : ''}
}) {
  const [activeTab, setActiveTab] = useState(0)
  const isEdit = true

${Array.from(lookupModels.entries()).map(([tTable]) => `  const [${tTable}LookupList, set${tTable}LookupList] = useState<any[]>(cached${tTable}LookupList)`).join('\n')}

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
                {${route.rawLayoutConfig?.form_header_subtitle_field ? `String(data?.[${JSON.stringify(route.rawLayoutConfig.form_header_subtitle_field)}] ?? data?.${pk} ?? '')` : `String(data?.display_label ?? data?.${pk} ?? Object.values(data || {})[1] ?? '')`}}
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

        {/* Formulário com Suporte a Abas (Renderizados simultaneamente, alternados via CSS para não perder estado) */}
        <div className={(!${hasRelationTabs} || activeTab === 0) ? 'block' : 'hidden'}>
          <DetailMasterForm id={id} backPath={backPath} title={title} updateAction={updateAction}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-6">
${formFieldsHtml}
            </div>
          </DetailMasterForm>
        </div>
        
        {${hasRelationTabs} && (
          <div className={activeTab !== 0 ? 'block space-y-6' : 'hidden'}>
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
// ─────────────────────────────────────────────────────────────────────────────

export function generateDetailPage(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const pk = route.primaryKey

  const hasRelationTabs = route.relationTabs.length > 0

  const lookupModels = new Map<string, string>()

  // 1. Lookups para os campos do formulário principal
  route.formFields.forEach(f => {
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

  // 2. Lookups para as abas de relação
  if (hasRelationTabs) {
    route.relationTabs.forEach(tab => {
      const allTabFields = tab.formFields && tab.formFields.length > 0 ? tab.formFields : tab.gridFields
      allTabFields.forEach(f => {
        if (f.config?.relation?.targetTable && f.config?.relation?.targetModel) {
          lookupModels.set(f.config.relation.targetTable.toLowerCase(), f.config.relation.targetModel)
        }
      })
      if (tab.subDetails) {
        tab.subDetails.forEach(sub => {
          const allSubFields = sub.formFields && sub.formFields.length > 0 ? sub.formFields : sub.gridFields
          allSubFields.forEach(f => {
            if (f.config?.relation?.targetTable && f.config?.relation?.targetModel) {
              lookupModels.set(f.config.relation.targetTable.toLowerCase(), f.config.relation.targetModel)
            }
          })
        })
      }
    })
  }

  const hasSelfRel = route.formFields.some(f => {
    const targetTable = f.config?.relation?.targetTable || f.config?.component?.rel_table || f.config?.rel_table || (f.dbColumn.endsWith('_id') ? (f.dbColumn.slice(0, -3).endsWith('s') ? f.dbColumn.slice(0, -3) : f.dbColumn.slice(0, -3) + 's') : null)
    return targetTable && targetTable.toLowerCase() === mnLower
  })

  const lookupQueries = Array.from(lookupModels.entries()).map(([table, modelName]) => {
    if (table === mnLower) {
      return `  const ${table}LookupList = await get${mn}List().catch(() => [])\n`
    }
    return `  const ${table}LookupList = await get${modelName}List().catch(() => [])\n`
  }).join('')

  const selfLookupQuery = (hasSelfRel && !lookupModels.has(mnLower))
    ? `  const ${mnLower}LookupList = await get${mn}List().catch(() => [])\n`
    : ''

  const buildOptionsCode: string[] = []
  route.formFields.forEach(f => {
    const targetTable = f.config?.relation?.targetTable || f.config?.component?.rel_table || f.config?.rel_table || (f.dbColumn.endsWith('_id') ? (f.dbColumn.slice(0, -3).endsWith('s') ? f.dbColumn.slice(0, -3) : f.dbColumn.slice(0, -3) + 's') : null)
    if (targetTable && (lookupModels.has(targetTable.toLowerCase()) || targetTable.toLowerCase() === mnLower)) {
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

  const serverActionsMap = new Map<string, Set<string>>()
  const addServerAction = (modelLower: string, fn: string) => {
    const key = `@/app/actions/${modelLower}`
    if (!serverActionsMap.has(key)) serverActionsMap.set(key, new Set())
    serverActionsMap.get(key)!.add(fn)
  }

  // Modelo principal
  addServerAction(mnLower, `get${mn}ById`)
  addServerAction(mnLower, `update${mn}`)
  if (hasSelfRel || lookupModels.has(mnLower)) {
    addServerAction(mnLower, `get${mn}List`)
  }

  lookupModels.forEach((modelName, table) => {
    if (table !== mnLower) {
      addServerAction(modelName.toLowerCase(), `get${modelName}List`)
    }
  })
  subDetailModels.forEach((modelName) => {
    addServerAction(modelName.toLowerCase(), `get${modelName}List`)
    addServerAction(modelName.toLowerCase(), `create${modelName}`)
    addServerAction(modelName.toLowerCase(), `update${modelName}`)
    addServerAction(modelName.toLowerCase(), `delete${modelName}`)
  })
  if (hasRelationTabs) {
    route.relationTabs.forEach(t => {
      addServerAction(t.relatedModelName.toLowerCase(), `get${t.relatedModelName}ByField`)
      addServerAction(t.relatedModelName.toLowerCase(), `create${t.relatedModelName}`)
      addServerAction(t.relatedModelName.toLowerCase(), `update${t.relatedModelName}`)
      addServerAction(t.relatedModelName.toLowerCase(), `delete${t.relatedModelName}`)
    })
  }

  const serverActionImports = Array.from(serverActionsMap.entries())
    .map(([path, fns]) => `import { ${Array.from(fns).join(', ')} } from '${path}'`)
    .join('\n')

  const subDetailQueries = Array.from(subDetailModels.entries()).map(([table, modelName]) =>
    `  const ${table}AllList = await get${modelName}List().catch(() => [])\n`
  ).join('')

  const relationQueries = [
    lookupQueries,
    selfLookupQuery,
    ...(hasRelationTabs
      ? [
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
                `    return { ...row, items: childItems, [${JSON.stringify(sub.relatedTable)}]: childItems, _details: childItems }\n` +
                `  })\n`
              )
            }
            return rawQuery + `  const ${tab.relatedTable}List = ${tab.relatedTable}ListRaw || []\n`
          })
        ]
      : [])
  ].filter(Boolean).join('')

  const byocImports = route.formFields
    .filter(f => f.isByoc || f.dataType === 'byoc' || f.id.startsWith('byoc_'))
    .map(f => getByocComponentName(f))
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .map(name => `import { ${name} } from '@/components/${name}'`)
    .join('\n')

  return `import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
${serverActionImports}
${byocImports ? `${byocImports}\n` : ''}${hasRelationTabs ? "import { DetailRelationSection } from '@/components/DetailRelationSection'\n" : ''}import { ${mn}DetailTabsClient } from './DetailTabsClient'

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

  if (mask === '00000-000') {
    if (d.length <= 5) return d
    return \`\${d.slice(0, 5)}-\${d.slice(5, 8)}\`
  }

  if (mask === '(00) 00000-0000' || mask === '(00) 0000-0000') {
    if (d.length <= 2) return \`(\${d}\`
    if (d.length <= 6) return \`(\${d.slice(0, 2)}) \${d.slice(2)}\`
    if (d.length <= 10) return \`(\${d.slice(0, 2)}) \${d.slice(2, 6)}-\${d.slice(6)}\`
    return \`(\${d.slice(0, 2)}) \${d.slice(2, 7)}-\${d.slice(7, 11)}\`
  }

  if (mask === '00/00/0000') {
    if (d.length <= 2) return d
    if (d.length <= 4) return \`\${d.slice(0, 2)}/\${d.slice(2)}\`
    return \`\${d.slice(0, 2)}/\${d.slice(2, 4)}/\${d.slice(4, 8)}\`
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
  const relationalOptions: Record<string, Array<{ value: string; label: string }>> = {
${buildOptionsCode.join('\n')}
  }

  return (
    <${mn}DetailTabsClient
      id={resolvedParams.id}
      data={data}
      updateAction={update${mn}}
      backPath="${route.path}"
      title="${route.title}"
      icon="${route.icon || 'Users'}"
      newPath="${route.path}/new"
      relationalOptions={relationalOptions}
${hasRelationTabs ? route.relationTabs.map((tab) => `      ${tab.relatedTable}Items={${tab.relatedTable}List || []}`).join('\n') : ''}
    />
  )
}
`
}
