import { RouteNode } from '../../ast'
import { renderFormField, getByocComponentName, isValidIdentifier } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Declarative Schema para Abas de Relacionamento ([id]/schema.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function generateDetailSchema(route: RouteNode): string {
  const hasCustomSlots = Boolean(route.customSlots && route.customSlots.length > 0)
  const hasRelationTabs = !hasCustomSlots && route.relationTabs.length > 0
  if (!hasRelationTabs) {
    return `// ─────────────────────────────────────────────────────────────────────────────
// Schemas e configurações declarativas da rota ${route.title}
// ─────────────────────────────────────────────────────────────────────────────

export const RELATION_TABS = [] as const
`
  }

  const usedTabPrefixes = new Set<string>()
  const tabConstants: string[] = []

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
          itemTitleField: sub.itemTitleField,
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

  return `// ─────────────────────────────────────────────────────────────────────────────
// Schemas e metadados declarativos para as abas de relacionamento de ${route.title}
// ─────────────────────────────────────────────────────────────────────────────

${tabConstants.join('\n')}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Client Component para Abas de Detalhe ([id]/DetailTabsClient.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export function generateDetailTabsClient(route: RouteNode): string {
  const mn = route.modelName
  const pk = route.primaryKey
  const title = route.title
  const backPath = route.path

  const formFieldsHtml = route.formFields
    .map(f => renderFormField(f, true, 'isView', 'relationalOptions'))
    .filter(Boolean)
    .join('\n')

  const hasCustomSlots = Boolean(route.customSlots && route.customSlots.length > 0)
  const hasRelationTabs = !hasCustomSlots && route.relationTabs.length > 0
  const hasAnyTabs = hasCustomSlots ? route.customSlots!.length > 1 : hasRelationTabs

  const masterSlot = hasCustomSlots ? route.customSlots![0] : undefined
  const detailSlots = hasCustomSlots ? route.customSlots!.slice(1) : []

  const getSlotIconName = (icon?: string, widgetType?: string): string => {
    if (icon && icon.trim() !== '') return icon
    switch (widgetType) {
      case 'timeline': return 'Clock'
      case 'scheduler': return 'Calendar'
      case 'galeria': return 'Image'
      case 'kanban': return 'Activity'
      case 'mapa_mental': return 'Settings'
      case 'analytics': return 'BarChart3'
      case 'grid': return 'Grid'
      case 'form':
      case 'pesquisa_cadastro':
      default:
        return 'AlignJustify'
    }
  }

  const tabButtons = hasCustomSlots
    ? detailSlots.map((slot, i) => {
        const iconName = getSlotIconName(slot.icon, slot.widgetType)
        return [
          `            <button`,
          `              type="button"`,
          `              onClick={() => { setActiveTab(${i + 1}); setVisitedTabs(p => ({ ...p, [${i + 1}]: true })) }}`,
          `              className={activeTab === ${i + 1}`,
          `                ? 'flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap shrink-0 border-indigo-600 text-indigo-600'`,
          `                : 'flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap shrink-0 border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`,
          `            >`,
          `              <DynamicIcon icon="${iconName}" size={14} />`,
          `              <span>${slot.title}</span>`,
          `            </button>`,
        ].join('\n')
      }).join('\n')
    : (hasRelationTabs
        ? route.relationTabs.map((tab, i) => [
            `            <button`,
            `              type="button"`,
            `              onClick={() => { setActiveTab(${i + 1}); setVisitedTabs(p => ({ ...p, [${i + 1}]: true })) }}`,
            `              className={activeTab === ${i + 1}`,
            `                ? 'flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap shrink-0 border-indigo-600 text-indigo-600'`,
            `                : 'flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap shrink-0 border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`,
            `            >`,
            `              <DynamicIcon icon="List" size={14} />`,
            `              <span>${tab.label}</span>`,
            `            </button>`,
          ].join('\n')).join('\n')
        : '')

  const lookupModels = new Map<string, string>()
  if (hasRelationTabs) {
    route.relationTabs.forEach(tab => {
      const allTabFields = tab.formFields && tab.formFields.length > 0 ? tab.formFields : tab.gridFields
      allTabFields.forEach(f => {
        const tTable = f.config?.relation?.targetTable
        const tModel = f.config?.relation?.targetModel
        if (tTable && tModel && isValidIdentifier(tTable) && isValidIdentifier(tModel)) {
          lookupModels.set(tTable, tModel)
        }
      })
      if (tab.subDetails) {
        tab.subDetails.forEach(sub => {
          const allSubFields = sub.formFields && sub.formFields.length > 0 ? sub.formFields : sub.gridFields
          allSubFields.forEach(f => {
            const tTable = f.config?.relation?.targetTable
            const tModel = f.config?.relation?.targetModel
            if (tTable && tModel && isValidIdentifier(tTable) && isValidIdentifier(tModel)) {
              lookupModels.set(tTable, tModel)
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
          if (isValidIdentifier(sub.relatedTable) && isValidIdentifier(sub.relatedModelName)) {
            subDetailModels.set(sub.relatedTable, sub.relatedModelName)
          }
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

  const usedTabPrefixes = new Set<string>()
  const importedConstNames: string[] = []

  const tabPanels = hasRelationTabs
    ? route.relationTabs.map((tab, i) => {
        const basePrefix = tab.relatedTable.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
        const constPrefix = usedTabPrefixes.has(basePrefix) ? `${basePrefix}_${i + 1}` : basePrefix
        usedTabPrefixes.add(constPrefix)

        const fieldsConstName = `${constPrefix}_FIELDS`
        const subDetailsConstName = `${constPrefix}_SUB_DETAILS`

        importedConstNames.push(fieldsConstName, subDetailsConstName)

        const subActionProps = tab.subDetails && tab.subDetails.length > 0
          ? [
              `              createSubAction={create${tab.subDetails[0].relatedModelName}}`,
              `              updateSubAction={update${tab.subDetails[0].relatedModelName}}`,
              `              deleteSubAction={delete${tab.subDetails[0].relatedModelName}}`,
            ].join('\n')
          : ''

        return [
          `          <div className={activeTab === ${i + 1} ? 'block' : 'hidden'}>`,
          `            <DetailRelationSection`,
          `              label="${tab.label}"`,
          `              relatedTable="${tab.relatedTable}"`,
          `              foreignKey="${tab.foreignKey}"`,
          `              parentId={id}`,
          `              itemTitleField="${tab.itemTitleField || ''}"`,
          `              items={${tab.relatedTable}Items || []}`,
          `              fields={${fieldsConstName} as unknown as any[]}`,
          `              subDetails={${subDetailsConstName} as unknown as any[]}`,
          `              createAction={create${tab.relatedModelName}}`,
          `              updateAction={update${tab.relatedModelName}}`,
          `              deleteAction={delete${tab.relatedModelName}}`,
          `              backPath={backPath}`,
          `              readOnly={isView}`,
          `              relationalOptions={relationalOptions}`,
          subActionProps,
          `            />`,
          `          </div>`,
        ].filter(Boolean).join('\n')
      }).join('\n')
    : ''

  const customTabPanels = hasCustomSlots
    ? detailSlots.map((slot, i) => {
        const masterTable = (route.modelTable || route.modelName || '').toLowerCase()
        const masterPk = route.primaryKey || 'id'
        const fkParam = slot.foreignKey
          ? `${slot.foreignKey}=\${id}`
          : (masterTable ? `${masterTable}.${masterPk}=\${id}` : `parent_id=\${id}`)
        return [
          `          <div className={activeTab === ${i + 1} ? 'block w-full' : 'hidden'}>`,
          `            {visitedTabs[${i + 1}] && (`,
          `              <div className="relative w-full min-h-[400px]">`,
          `                {!loadedIframes[${i + 1}] && (`,
          `                  <div className="py-24 flex flex-col items-center justify-center gap-3 text-neutral-400 bg-white dark:bg-neutral-900/30 border border-neutral-100 dark:border-neutral-800 rounded-3xl animate-in fade-in duration-200">`,
          `                    <Loader2 className="w-9 h-9 animate-spin text-indigo-500" />`,
          `                    <div className="text-center">`,
          `                      <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-200">Conectando ao banco...</h3>`,
          `                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">Buscando dados via Túnel Seguro</p>`,
          `                    </div>`,
          `                  </div>`,
          `                )}`,
          `                <iframe`,
          `                  src={\`/${slot.useCaseSlug}?embedded=true&view_mode=tab&tab=true&${fkParam}\${isView ? '&mode=view' : ''}\`}`,
          `                  className={\`w-full border-0 bg-transparent transition-opacity duration-300 \${!loadedIframes[${i + 1}] ? 'opacity-0 h-0 min-h-0 overflow-hidden' : 'min-h-[800px] opacity-100'}\`}`,
          `                  title="${slot.title}"`,
          `                  onLoad={() => setLoadedIframes(p => ({ ...p, [${i + 1}]: true }))}`,
          `                />`,
          `              </div>`,
          `            )}`,
          `          </div>`,
        ].join('\n')
      }).join('\n')
    : ''

  const masterTitle = hasCustomSlots ? (masterSlot?.title || title) : title
  const masterIconName = getSlotIconName(masterSlot?.icon, masterSlot?.widgetType || 'form')

  const tabsHeader = hasAnyTabs
    ? `
          {/* Custom Tabs Header fiel à Web Produção */}
          <div className="px-6 pt-2 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => { setActiveTab(0); setVisitedTabs(p => ({ ...p, 0: true })) }}
                className={activeTab === 0
                  ? "flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap shrink-0 border-indigo-600 text-indigo-600"
                  : "flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap shrink-0 border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"}
              >
                <DynamicIcon icon="${masterIconName}" size={14} />
                <span>${masterTitle}</span>
              </button>
${tabButtons}
            </div>
          </div>`
    : ''

  const byocImports = route.formFields
    .filter(f => f.isByoc || f.dataType === 'byoc' || f.id.startsWith('byoc_'))
    .map(f => getByocComponentName(f))
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .map(name => `import { ${name} } from '@/components/${name}'`)
    .join('\n')

  const schemaImports = hasRelationTabs && importedConstNames.length > 0
    ? `import { ${importedConstNames.join(', ')} } from './schema'`
    : ''

  return `'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { DetailMasterForm } from '@/components/DetailMasterForm'
import { DynamicIcon } from '@/app/components/DynamicIcon'
import { CloseModalButton } from '@/components/ui/custom-action-button'
${byocImports ? `${byocImports}\n` : ''}${relationImports ? `${relationImports}\n` : ''}${schemaImports ? `${schemaImports}\n` : ''}import { ArrowLeft, Save, Plus, Pencil, Eye, Download, Zap, Loader2 } from 'lucide-react'

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



export function ${mn}DetailTabsClient({
  id,
  data,
  updateAction,
  backPath,
  title,
  icon,
  newPath,
  relationalOptions = {},
  initialMode,
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
  initialMode?: 'edit' | 'view'
${hasRelationTabs ? route.relationTabs.map((tab) => `  ${tab.relatedTable}Items?: any[]`).join('\n') : ''}
}) {
  const searchParams = useSearchParams()
  const [isIframe, setIsIframe] = useState(false)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.self !== window.top) {
        setIsIframe(true)
      }
    } catch (e) {
      setIsIframe(true)
    }
  }, [])
  const isEmbedded = searchParams?.get('embedded') === 'true' || isIframe
  const isView = (searchParams?.get('mode') === 'view') || initialMode === 'view'
  const [activeTab, setActiveTab] = useState(0)
  const [visitedTabs, setVisitedTabs] = useState<Record<number, boolean>>({ 0: true })
  const [loadedIframes, setLoadedIframes] = useState<Record<number, boolean>>({})
  const isEdit = true



  return (
    <div className="p-6 sm:p-10 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Cabeçalho Externo da View fiel à Web Produção (RuntimeHeader) */}
      {!isEmbedded && (
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
            <Link href={newPath + (isEmbedded ? '?embedded=true' : '')} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
              <Plus className="w-4 h-4" /> Novo Registro
            </Link>
          </div>
        </div>
      )}
      {isEmbedded && (
        <div className="flex justify-end items-center -mb-4">
          <CloseModalButton />
        </div>
      )}

      {/* Card Principal de Edição */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm flex flex-col">
        {/* Cabeçalho Interno do Card fiel à Web Produção */}
        <div className="flex items-center justify-between p-8 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 shrink-0">
              {isView ? <Eye className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                ${hasCustomSlots
                  ? `{(isView ? 'Visualizar Item' : 'Editar Item')}`
                  : `{(isView ? 'Visualizar ' : 'Editar ') + (title.endsWith('s') ? title.slice(0, -1) : title)}`}
              </h3>
              <p className="text-[10px] font-black tracking-[0.2em] text-neutral-400 mt-0.5">
                ${hasCustomSlots
                  ? `{\`Registro #\${data?.id ?? data?.${pk} ?? id ?? 'N/A'}\`}`
                  : (route.rawLayoutConfig?.form_header_subtitle_field
                      ? `{String(data?.[${JSON.stringify(route.rawLayoutConfig.form_header_subtitle_field)}] ?? data?.nome ?? data?.name ?? data?.razao_social ?? data?.display_label ?? data?.${pk} ?? '')}`
                      : `{String(data?.display_label ?? data?.nome ?? data?.name ?? data?.razao_social ?? data?.titulo ?? data?.${pk} ?? Object.values(data || {})[1] ?? '')}`)}
              </p>
            </div>
          </div>

          <Link
            href={backPath}
            onClick={(e) => {
              if (isEmbedded) {
                e.preventDefault()
                window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*')
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-black tracking-widest text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all uppercase cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para Lista
          </Link>
        </div>
${tabsHeader}

        <div className="p-8">
          {/* Formulário com Suporte a Abas */}
          <div className={(!${hasAnyTabs} || activeTab === 0) ? 'block' : 'hidden'}>
            <DetailMasterForm id={id} backPath={backPath} title={title} updateAction={updateAction} isView={isView}>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-6">
${formFieldsHtml}
              </div>
            </DetailMasterForm>
          </div>
          
          {${hasAnyTabs} && (
            <div className={activeTab !== 0 ? 'block w-full' : 'hidden'}>
${hasCustomSlots ? customTabPanels : tabPanels}
            </div>
          )}
        </div>
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

  const hasCustomSlots = Boolean(route.customSlots && route.customSlots.length > 0)
  const hasRelationTabs = !hasCustomSlots && route.relationTabs.length > 0

  const lookupModels = new Map<string, string>()

  // 1. Lookups para os campos do formulário principal
  route.formFields.forEach(f => {
    const targetModel = f.config?.relation?.targetModel || (f as any).relation?.targetModel
    const targetTable = f.config?.relation?.targetTable || f.config?.component?.rel_table || f.config?.rel_table
    if (targetModel && targetTable && isValidIdentifier(targetTable) && isValidIdentifier(targetModel)) {
      lookupModels.set(targetTable.toLowerCase(), targetModel)
    } else if (targetTable && isValidIdentifier(targetTable) && targetTable.length < 30) {
      const modelName = targetTable.charAt(0).toUpperCase() + targetTable.slice(1)
      if (isValidIdentifier(modelName)) {
        lookupModels.set(targetTable.toLowerCase(), modelName)
      }
    } else if (f.dbColumn.endsWith('_id') && !f.isPrimaryKey) {
      const base = f.dbColumn.slice(0, -3)
      const table = base.endsWith('s') ? base : (base + 's')
      const modelName = table.charAt(0).toUpperCase() + table.slice(1)
      if (isValidIdentifier(table) && isValidIdentifier(modelName)) {
        lookupModels.set(table.toLowerCase(), modelName)
      }
    }
  })

  // 2. Lookups para as abas de relação
  if (hasRelationTabs) {
    route.relationTabs.forEach(tab => {
      const allTabFields = tab.formFields && tab.formFields.length > 0 ? tab.formFields : tab.gridFields
      allTabFields.forEach(f => {
        const comp = f.config?.component || f.config?.form_config?.component || {}
        let relTable = f.config?.relation?.targetTable || comp.rel_table
        let relModel = f.config?.relation?.targetModel || comp.rel_model
        if (!relTable && f.dbColumn.endsWith('_id') && !f.isPrimaryKey && f.dbColumn !== tab.foreignKey) {
          const base = f.dbColumn.slice(0, -3)
          relTable = base.endsWith('s') ? base : (base + 's')
          relModel = relTable.charAt(0).toUpperCase() + relTable.slice(1)
        }
        if (relTable && relTable.toLowerCase() !== tab.relatedTable.toLowerCase() && isValidIdentifier(relTable)) {
          const modelName = relModel && isValidIdentifier(relModel) ? relModel : (relTable.charAt(0).toUpperCase() + relTable.slice(1))
          if (isValidIdentifier(modelName)) {
            lookupModels.set(relTable.toLowerCase(), modelName)
          }
        }
      })
      if (tab.subDetails) {
        tab.subDetails.forEach(sub => {
          const allSubFields = sub.formFields && sub.formFields.length > 0 ? sub.formFields : sub.gridFields
          allSubFields.forEach(f => {
            const comp = f.config?.component || f.config?.form_config?.component || {}
            let relTable = f.config?.relation?.targetTable || comp.rel_table
            let relModel = f.config?.relation?.targetModel || comp.rel_model
            if (!relTable && f.dbColumn.endsWith('_id') && !f.isPrimaryKey && f.dbColumn !== sub.foreignKey) {
              const base = f.dbColumn.slice(0, -3)
              relTable = base.endsWith('s') ? base : (base + 's')
              relModel = relTable.charAt(0).toUpperCase() + relTable.slice(1)
            }
            if (relTable && relTable.toLowerCase() !== sub.relatedTable.toLowerCase() && isValidIdentifier(relTable)) {
              const modelName = relModel && isValidIdentifier(relModel) ? relModel : (relTable.charAt(0).toUpperCase() + relTable.slice(1))
              if (isValidIdentifier(modelName)) {
                lookupModels.set(relTable.toLowerCase(), modelName)
              }
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
    if (!isValidIdentifier(table) || !isValidIdentifier(modelName)) return ''
    if (table === mnLower) {
      return `  const ${table}LookupList = await get${mn}List().catch(() => [])\n`
    }
    return `  const ${table}LookupList = await get${modelName}List().catch(() => [])\n`
  }).join('')

  const selfLookupQuery = (hasSelfRel && !lookupModels.has(mnLower))
    ? `  const ${mnLower}LookupList = await get${mn}List().catch(() => [])\n`
    : ''

  const buildOptionsCode: string[] = []
  const allCandidateFields: Array<{ f: any; table: string }> = []
  route.formFields.forEach(f => allCandidateFields.push({ f, table: mnLower }))
  if (hasRelationTabs) {
    route.relationTabs.forEach(tab => {
      const tabFields = tab.formFields && tab.formFields.length > 0 ? tab.formFields : tab.gridFields
      tabFields.forEach(f => allCandidateFields.push({ f, table: tab.relatedTable.toLowerCase() }))
      if (tab.subDetails) {
        tab.subDetails.forEach(sub => {
          const subFields = sub.formFields && sub.formFields.length > 0 ? sub.formFields : sub.gridFields
          subFields.forEach(f => allCandidateFields.push({ f, table: sub.relatedTable.toLowerCase() }))
        })
      }
    })
  }

  const addedOptionKeys = new Set<string>()
  allCandidateFields.forEach(({ f, table }) => {
    const dt = (f.dataType || '').toLowerCase()
    const comp = f.config?.component || f.config?.form_config?.component || {}
    const compType = String(comp.type || f.config?.type || f.config?.content?.type || '').toLowerCase()
    const mask = f.config?.content?.mask || f.config?.mask || comp.mask || ''
    const format = String(f.config?.format || f.format || '').toLowerCase()
    const isDate =
      dt.includes('date') ||
      dt.includes('time') ||
      dt.includes('timestamp') ||
      compType === 'date' ||
      compType === 'datetime' ||
      compType === 'datetime-local' ||
      compType === 'time' ||
      format === 'date' ||
      format === 'datetime' ||
      mask === '00/00/0000'
    const hasFormula = Boolean(
      comp.formula_tokens?.length ||
      comp.formulaTokens?.length ||
      f.config?.formula_tokens?.length ||
      f.config?.formulaTokens?.length ||
      f.config?.content?.formula_tokens?.length
    )
    if (isDate || hasFormula) {
      return
    }

    let targetTable: string | null = null
    const isExplicitRel = f.config?.relation?.targetTable || comp.options_type === 'relational' || f.config?.options_type === 'relational' || ['select', 'combo', 'combobox', 'lookup'].includes(compType)

    if (f.config?.relation?.targetTable) {
      targetTable = f.config.relation.targetTable
    } else if (comp.rel_table && (isExplicitRel || comp.rel_table.toLowerCase() !== table.toLowerCase())) {
      targetTable = comp.rel_table
    } else if (f.config?.rel_table && isExplicitRel && f.config.rel_table.toLowerCase() !== table.toLowerCase()) {
      targetTable = f.config.rel_table
    } else if (f.dbColumn.endsWith('_id')) {
      const base = f.dbColumn.slice(0, -3)
      targetTable = base.endsWith('s') ? base : (base + 's')
    }

    if (targetTable && targetTable.toLowerCase() === table.toLowerCase() && !f.dbColumn.endsWith('_id')) {
      targetTable = null
    }

    if (targetTable && isValidIdentifier(targetTable) && (lookupModels.has(targetTable.toLowerCase()) || targetTable.toLowerCase() === mnLower)) {
      const t = targetTable.toLowerCase()
      const relLabel = f.config?.component?.rel_label || f.config?.relation?.displayColumn || f.config?.rel_label
      const relValue = f.config?.component?.rel_value || f.config?.relation?.valueColumn || f.config?.rel_value || 'id'
      const labelExpr = relLabel
        ? `r[${JSON.stringify(relLabel)}] ?? r[${JSON.stringify(relLabel.toLowerCase())}] ?? r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
        : `r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
      const valueExpr = `r[${JSON.stringify(relValue)}] ?? r[${JSON.stringify(relValue.toLowerCase())}] ?? r.id ?? Object.values(r)[0] ?? ''`
      if (!addedOptionKeys.has(f.dbColumn)) {
        buildOptionsCode.push(`    '${f.dbColumn}': (${t}LookupList || []).map((r: any) => ({ value: String(${valueExpr}), label: String(${labelExpr}) })),`)
        addedOptionKeys.add(f.dbColumn)
      }
      const fullKey = `${table}.${f.dbColumn}`
      if (!addedOptionKeys.has(fullKey)) {
        buildOptionsCode.push(`    '${fullKey}': (${t}LookupList || []).map((r: any) => ({ value: String(${valueExpr}), label: String(${labelExpr}) })),`)
        addedOptionKeys.add(fullKey)
      }
    } else {
      const rawOpts = f.config?.options || f.config?.component?.options || f.config?.form_config?.options || f.options
      const rawFixed = f.config?.fixed_options || f.config?.component?.fixed_options || f.config?.form_config?.fixed_options || f.config?.enum_values || f.config?.component?.enum_values
      let parsed: any[] = []
      if (Array.isArray(rawOpts) && rawOpts.length > 0) {
        parsed = rawOpts
      } else if (rawFixed) {
        if (typeof rawFixed === 'string') {
          parsed = rawFixed.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean).map((s: string) => {
            if (s.includes(':')) {
              const [l, v] = s.split(':').map((p: string) => p.trim())
              return { label: l || v, value: v || l }
            }
            return { label: s, value: s }
          })
        } else if (Array.isArray(rawFixed)) {
          parsed = rawFixed
        }
      }
      if (parsed.length > 0) {
        if (!addedOptionKeys.has(f.dbColumn)) {
          buildOptionsCode.push(`    '${f.dbColumn}': ${JSON.stringify(parsed)},`)
          addedOptionKeys.add(f.dbColumn)
        }
        const fullKey = `${table}.${f.dbColumn}`
        if (!addedOptionKeys.has(fullKey)) {
          buildOptionsCode.push(`    '${fullKey}': ${JSON.stringify(parsed)},`)
          addedOptionKeys.add(fullKey)
        }
      }
    }
  })

  const subDetailModels = new Map<string, string>()
  if (hasRelationTabs) {
    route.relationTabs.forEach(tab => {
      if (tab.subDetails) {
        tab.subDetails.forEach(sub => {
          if (isValidIdentifier(sub.relatedTable) && isValidIdentifier(sub.relatedModelName)) {
            subDetailModels.set(sub.relatedTable, sub.relatedModelName)
          }
        })
      }
    })
  }

  const serverActionsMap = new Map<string, Set<string>>()
  const addServerAction = (modelLower: string, fn: string) => {
    if (!isValidIdentifier(modelLower)) return
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
    if (table !== mnLower && isValidIdentifier(modelName)) {
      addServerAction(modelName.toLowerCase(), `get${modelName}List`)
    }
  })
  subDetailModels.forEach((modelName) => {
    if (isValidIdentifier(modelName)) {
      addServerAction(modelName.toLowerCase(), `get${modelName}List`)
      addServerAction(modelName.toLowerCase(), `create${modelName}`)
      addServerAction(modelName.toLowerCase(), `update${modelName}`)
      addServerAction(modelName.toLowerCase(), `delete${modelName}`)
    }
  })
  if (hasRelationTabs) {
    route.relationTabs.forEach(t => {
      if (isValidIdentifier(t.relatedModelName)) {
        addServerAction(t.relatedModelName.toLowerCase(), `get${t.relatedModelName}ByField`)
        addServerAction(t.relatedModelName.toLowerCase(), `create${t.relatedModelName}`)
        addServerAction(t.relatedModelName.toLowerCase(), `update${t.relatedModelName}`)
        addServerAction(t.relatedModelName.toLowerCase(), `delete${t.relatedModelName}`)
      }
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

export async function generateMetadata({
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ mode?: string; embedded?: string }>
}): Promise<Metadata> {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const isView = resolvedSearchParams?.mode === 'view'
  return { title: (isView ? 'Visualizar' : 'Editar') + ' \u2014 ${route.title}' }
}

export default async function ${mn}DetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ mode?: string; embedded?: string }>
}) {
  const resolvedParams = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const initialMode = resolvedSearchParams?.mode === 'view' ? 'view' : 'edit'
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
      initialMode={initialMode}
${hasRelationTabs ? route.relationTabs.map((tab) => `      ${tab.relatedTable}Items={${tab.relatedTable}List || []}`).join('\n') : ''}
    />
  )
}
`
}
