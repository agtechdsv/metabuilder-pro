import { RouteNode } from '../../ast'
import { renderFormField, getByocComponentName } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Cadastro (new/page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export function generateNewPage(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()

  const lookupModels = new Map<string, string>()
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

  const hasSelfRel = route.formFields.some(f => {
    const targetTable = f.config?.relation?.targetTable || f.config?.component?.rel_table || f.config?.rel_table || (f.dbColumn.endsWith('_id') ? (f.dbColumn.slice(0, -3).endsWith('s') ? f.dbColumn.slice(0, -3) : f.dbColumn.slice(0, -3) + 's') : null)
    return targetTable && targetTable.toLowerCase() === mnLower
  })

  const lookupImports = Array.from(lookupModels.entries())
    .filter(([table]) => table !== mnLower)
    .map(([_, modelName]) => `import { get${modelName}List } from '@/app/actions/${modelName.toLowerCase()}'`)
    .join('\n')

  const selfActionImport = (hasSelfRel || lookupModels.has(mnLower)) ? `, get${mn}List` : ''

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

  const formFieldsHtml = route.formFields
    .map(f => renderFormField(f, false, false, 'relationalOptions'))
    .filter(Boolean)
    .join('\n')

  const byocImports = route.formFields
    .filter(f => f.isByoc || f.dataType === 'byoc' || f.id.startsWith('byoc_'))
    .map(f => getByocComponentName(f))
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .map(name => `import { ${name} } from '@/components/${name}'`)
    .join('\n')

  return `import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { create${mn}${selfActionImport} } from '@/app/actions/${mnLower}'
${lookupImports ? `${lookupImports}\n` : ''}${byocImports ? `${byocImports}\n` : ''}import { DynamicIcon } from '@/app/components/DynamicIcon'
import { ArrowLeft, Save, Plus, Download, Zap } from 'lucide-react'

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

export const metadata: Metadata = { title: 'Novo — ${route.title}' }

export default async function ${mn}NewPage() {
${lookupQueries}
${selfLookupQuery}
  const relationalOptions: Record<string, Array<{ value: string; label: string }>> = {
${buildOptionsCode.join('\n')}
  }
  const isEdit = false
  const data: any = {}

  return (
    <div className="p-6 sm:p-10 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Cabeçalho Externo da View fiel à Web Produção (RuntimeHeader) */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white shrink-0">
            <DynamicIcon icon="${route.icon || 'Users'}" size={24} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                ${route.title}
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
          <Link href="${route.path}" className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95">
            <ArrowLeft className="w-4 h-4" /> Voltar para Lista
          </Link>
        </div>
      </div>

      {/* Card Principal de Cadastro */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] p-8 sm:p-10 shadow-sm relative overflow-hidden space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
              Novo ${route.title.endsWith('s') ? route.title.slice(0, -1) : route.title}
            </h2>
            <p className="text-xs font-medium text-neutral-400 mt-0.5">
              Preencha os campos para criar um novo registro no sistema.
            </p>
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
          <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-6">
${formFieldsHtml}
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-neutral-200 dark:border-neutral-800 mt-8">
            <Link
              href="${route.path}"
              className="px-6 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
            >
              <Save className="w-4 h-4" /> Criar Registro
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
`
}
