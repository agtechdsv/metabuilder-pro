import type { AppAST, RouteNode, ResolvedField } from '../ast'
import { getGeneratorDictionary } from '../i18n'
import { toPascalCase, toCamel } from './routes/helpers'

/**
 * Exportação de dados do app gerado (Excel, CSV e JSON), nas telas cujo botão "Exportar" está ligado no Studio.
 *
 * Lê da configuração da tela: se o botão de exportação está visível (buttons_config), quais formatos o dev liberou
 * (layout_config.export_formats), as colunas da grid e os filtros. O download passa por /api/export/<tela>, que confere a sessão e
 * a permissão da tela, busca os dados pelas mesmas ações da listagem (portanto com as mesmas regras de acesso) e aplica os filtros
 * e a ordenação que a pessoa estava vendo.
 */

/** Formatos que o app gerado sabe produzir (PDF e OFX da plataforma dependem do serviço de exportação em segundo plano). */
const SUPPORTED_FORMATS = ['xlsx', 'csv', 'json'] as const

/** A tela exporta? (botão "Exportar" ligado no Studio e pelo menos um formato suportado) */
export function routeExportFormats(route: RouteNode): string[] {
  if (route.isAiGenerated) return []
  if (!route.buttons.some(b => b.actionType === 'export')) return []
  const raw = route.rawLayoutConfig?.export_formats
  const wanted: string[] = Array.isArray(raw) && raw.length > 0 ? raw.map((x: unknown) => String(x).toLowerCase()) : [...SUPPORTED_FORMATS]
  return SUPPORTED_FORMATS.filter(f => wanted.includes(f))
}

export function exportRoutes(ast: AppAST): RouteNode[] {
  return ast.routes.filter(r => routeExportFormats(r).length > 0)
}

/** O app tem alguma tela que exporta (precisa da biblioteca de planilhas)? */
export function routesNeedExport(ast: AppAST): boolean {
  return exportRoutes(ast).length > 0
}

/** Botão "Exportar" do cabeçalho de uma tela (menu com os formatos liberados). */
export function exportMenuHtml(route: RouteNode, label: string, idExpr?: string): string {
  const formats = routeExportFormats(route)
  if (formats.length === 0) return ''
  return `<ExportMenu slug=${JSON.stringify(route.viewSlug)} formats={${JSON.stringify(formats)}} label=${JSON.stringify(label)}${idExpr ? ` recordId={${idExpr}}` : ''} />`
}

export const EXPORT_MENU_IMPORT = [
  "import { ExportMenu } from '@/components/ExportMenu'",
  "import { SelectAllBox, RowSelectBox } from '@/components/RowSelect'",
].join('\n')

/** Linha de import do botão (vazia se a tela não exporta). */
export function exportImportLine(route: RouteNode): string {
  return routeExportFormats(route).length > 0 ? EXPORT_MENU_IMPORT + '\n' : ''
}

/** Texto do botão: o que o dev escreveu no Studio, ou o padrão do idioma. */
export function exportLabel(route: RouteNode, fallback: string): string {
  return route.buttons.find(b => b.actionType === 'export')?.label || fallback
}

const dedupe = <T>(list: T[], key: (x: T) => string): T[] => {
  const seen = new Set<string>()
  return list.filter(x => (seen.has(key(x)) ? false : (seen.add(key(x)), true)))
}

/** Módulo de dados da tela: colunas, filtros, ordenação e (para relações e opções fixas) o texto que a grid mostra. */
function exportDataModule(route: RouteNode): string {
  const mn = route.modelName
  const mnLower = mn.toLowerCase()
  const columns = dedupe((route.gridFields || []).filter(f => !f.hidden), f => f.dbColumn)
  const filterFields = route.filterFields.length > 0 ? route.filterFields : route.gridFields.filter(f => !f.isPrimaryKey && !f.isVirtual && !f.isByoc).slice(0, 3)

  // tabelas de consulta (relações) das colunas e dos filtros: o texto vem da tabela relacionada, como na grid
  const lookupModels = new Map<string, string>()
  const lookupField = (f: ResolvedField) => {
    const targetModel = f.config?.relation?.targetModel || (f as any).relation?.targetModel
    const targetTable = f.config?.relation?.targetTable || f.config?.component?.rel_table || f.config?.rel_table
    if (targetModel && targetTable) lookupModels.set(targetTable.toLowerCase(), targetModel)
    else if (targetTable && !targetTable.includes('-') && targetTable.length < 30) lookupModels.set(targetTable.toLowerCase(), toPascalCase(targetTable))
    else if (f.dbColumn.endsWith('_id') && !f.isPrimaryKey) {
      const base = f.dbColumn.slice(0, -3)
      const table = base.endsWith('s') ? base : base + 's'
      lookupModels.set(table.toLowerCase(), toPascalCase(table))
    }
  }
  ;[...columns, ...filterFields].forEach(lookupField)
  lookupModels.delete(mnLower)

  const lookupImports = Array.from(lookupModels.entries())
    .map(([table, modelName]) => `import { get${modelName}List } from '@/app/actions/${table}'`)
    .join('\n')
  const lookupQueries = Array.from(lookupModels.entries())
    .map(([table, modelName]) => `    get${modelName}List().catch((): any => []),`)
    .join('\n')
  const lookupNames = Array.from(lookupModels.keys()).map(t => `${t}LookupList`).join(', ')

  const options: string[] = []
  const done = new Set<string>()
  columns.forEach(f => {
    if (done.has(f.dbColumn)) return
    const targetTable = f.config?.relation?.targetTable || f.config?.component?.rel_table || f.config?.rel_table || (f.dbColumn.endsWith('_id') ? (f.dbColumn.slice(0, -3).endsWith('s') ? f.dbColumn.slice(0, -3) : f.dbColumn.slice(0, -3) + 's') : null)
    if (targetTable && lookupModels.has(targetTable.toLowerCase())) {
      done.add(f.dbColumn)
      const t = targetTable.toLowerCase()
      const relLabel = f.config?.component?.rel_label || f.config?.relation?.displayColumn || f.config?.rel_label
      const relValue = f.config?.component?.rel_value || f.config?.relation?.valueColumn || f.config?.rel_value || 'id'
      const labelExpr = relLabel
        ? `r[${JSON.stringify(relLabel)}] ?? r[${JSON.stringify(relLabel.toLowerCase())}] ?? r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
        : `r.display_label ?? Object.values(r)[1] ?? Object.values(r)[0] ?? ''`
      const valueExpr = `r[${JSON.stringify(relValue)}] ?? r[${JSON.stringify(relValue.toLowerCase())}] ?? r.id ?? Object.values(r)[0] ?? ''`
      options.push(`    ${JSON.stringify(f.dbColumn)}: (${t}LookupList || []).map((r: any) => ({ value: String(${valueExpr}), label: String(${labelExpr}) })),`)
    } else if (f.config?.options && Array.isArray(f.config.options) && f.config.options.length > 0) {
      done.add(f.dbColumn)
      options.push(`    ${JSON.stringify(f.dbColumn)}: ${JSON.stringify(f.config.options)},`)
    }
  })

  const filterCode = filterFields.map(f => {
    const col = f.dbColumn.replace('.', '_')
    const raw = f.dbColumn
    const camel = toCamel(f.dbColumn)
    return `    const val_${col} = params?.['${col}_filter'] || params?.['${col}'] || params?.['${raw}']
    if (val_${col}) {
      const itemVal = String(item['${raw}'] ?? item['${camel}'] ?? item['${col}'] ?? '').toLowerCase()
      if (!itemVal.includes(String(val_${col}).toLowerCase())) return false
    }`
  }).join('\n')

  const pk = route.primaryKey || 'id'
  return `// ARQUIVO GERADO pelo MetaBuilder — dados da exportação da tela ${route.title}.
import { get${mn}List } from '@/app/actions/${mnLower}'
${lookupImports ? lookupImports + '\n' : ''}
export const EXPORT_COLUMNS: Array<{ key: string; label: string }> = ${JSON.stringify(columns.map(f => ({ key: f.dbColumn, label: f.label })), null, 2)}

const pick = (item: any, col: string) => {
  const camel = col.replace(/[^a-zA-Z0-9]+(.)/g, (_m, c) => c.toUpperCase())
  return item?.[col] ?? item?.[camel] ?? item?.[col.toLowerCase()] ?? item?.[col.toUpperCase()] ?? item?.[col.replace('.', '_')]
}

/** Linhas da tela com os filtros e a ordenação da URL; ids (opcional) restringe aos registros informados. */
export async function getExportRows(params: Record<string, string | undefined>, ids?: string[]): Promise<Record<string, any>[]> {
  const [rawData${lookupNames ? ', ' + lookupNames : ''}] : any[] = await Promise.all([
    get${mn}List({ filters: params }),
${lookupQueries ? lookupQueries + '\n' : ''}  ])
  const dataArray: any[] = Array.isArray(rawData) ? rawData : ((rawData as any)?.content ?? [])

  const relationalOptions: Record<string, Array<{ value: string; label: string }>> = {
${options.join('\n')}
  }

  const rows = dataArray.filter((item: any) => {
${filterCode}
    if (ids && ids.length > 0 && !ids.includes(String(pick(item, ${JSON.stringify(pk)}) ?? ''))) return false
    return true
  })

  const sortBy = params?.sort_by
  const sortOrder = params?.sort_order || 'asc'
  if (sortBy) {
    rows.sort((a: any, b: any) => {
      const valA = pick(a, sortBy) ?? ''
      const valB = pick(b, sortBy) ?? ''
      if (typeof valA === 'number' && typeof valB === 'number') return sortOrder === 'asc' ? valA - valB : valB - valA
      return sortOrder === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA))
    })
  }

  return rows.map((item: any) => {
    const out: Record<string, any> = {}
    for (const c of EXPORT_COLUMNS) {
      let v = pick(item, c.key)
      const opts = relationalOptions[c.key]
      if (opts && v !== undefined && v !== null && v !== '') {
        const hit = opts.find(o => String(o.value) === String(v))
        if (hit) v = hit.label
      }
      if (v instanceof Date) v = v.toISOString()
      else if (v !== null && typeof v === 'object') v = JSON.stringify(v)
      out[c.key] = v ?? ''
    }
    return out
  })
}
`
}

const ROW_SELECT = `'use client'

import React from 'react'

/** Caixa de seleção do cabeçalho da grid: marca/desmarca todas as linhas da página. */
export function SelectAllBox() {
  return (
    <input
      type="checkbox"
      className="rounded-md border-neutral-300 dark:border-neutral-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
      onChange={e => {
        const table = e.currentTarget.closest('table')
        table?.querySelectorAll<HTMLInputElement>('input[data-mb-row-select]').forEach(el => { el.checked = e.currentTarget.checked })
        window.dispatchEvent(new Event('mb-selection'))
      }}
    />
  )
}

/** Caixa de seleção de uma linha da grid (o valor é o id do registro). */
export function RowSelectBox({ value }: { value: string | number }) {
  return (
    <input
      type="checkbox"
      data-mb-row-select=""
      value={String(value)}
      className="rounded-md border-neutral-300 dark:border-neutral-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
      onChange={() => window.dispatchEvent(new Event('mb-selection'))}
    />
  )
}
`

const EXPORT_MENU = (t: { title: string; xlsx: string; csv: string; json: string; failed: string }) => `'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Download, FileSpreadsheet, FileText, FileJson, ChevronDown, Loader2 } from 'lucide-react'

const FORMATS: Record<string, { label: string; icon: React.ReactNode }> = {
  xlsx: { label: ${JSON.stringify(t.xlsx)}, icon: <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> },
  csv: { label: ${JSON.stringify(t.csv)}, icon: <FileText className="w-4 h-4 text-sky-500" /> },
  json: { label: ${JSON.stringify(t.json)}, icon: <FileJson className="w-4 h-4 text-amber-500" /> },
}

/** Botão Exportar: menu com os formatos liberados no Studio. Leva os filtros e a ordenação da tela (e o registro, no formulário). */
export function ExportMenu({ slug, formats, label, recordId }: { slug: string; formats: string[]; label: string; recordId?: string | number }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const [selected, setSelected] = useState(0)
  useEffect(() => {
    const sync = () => setSelected(document.querySelectorAll('input[data-mb-row-select]:checked').length)
    window.addEventListener('mb-selection', sync)
    sync()
    return () => window.removeEventListener('mb-selection', sync)
  }, [])

  const run = async (format: string) => {
    setOpen(false)
    setBusy(true)
    setError('')
    try {
      const q = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
      ;['page', 'limit', 'embedded', 'mode'].forEach(k => q.delete(k))
      q.set('format', format)
      if (recordId !== undefined && recordId !== null) q.set('ids', String(recordId))
      else {
        // linhas marcadas na grid: exporta só elas
        const ids = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-mb-row-select]:checked')).map(el => el.value).filter(Boolean)
        if (ids.length > 0) q.set('ids', ids.join(','))
      }
      const res = await fetch('/api/export/' + encodeURIComponent(slug) + '?' + q.toString())
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as any)?.error || ${JSON.stringify(t.failed)})
      const blob = await res.blob()
      const name = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') || '')?.[1] || (slug + '.' + format)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.message || ${JSON.stringify(t.failed)})
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95 disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin text-neutral-400" /> : <Download className="w-4 h-4 text-neutral-400" />}
        {label}{recordId === undefined && selected > 0 ? ' (' + selected + ')' : ''}
        <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl p-2">
          <p className="px-3 pt-2 pb-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400">${t.title}</p>
          {formats.filter(f => FORMATS[f]).map(f => (
            <button key={f} type="button" onClick={() => run(f)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
              {FORMATS[f].icon}
              {FORMATS[f].label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="absolute right-0 mt-2 w-64 z-50 text-[11px] font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-xl px-3 py-2">{error}</p>}
    </div>
  )
}
`

const API_ROUTE = (guard: string) => `// ARQUIVO GERADO pelo MetaBuilder — exportação de dados (Excel, CSV e JSON) das telas com o botão Exportar ligado.
import { NextResponse } from 'next/server'
import { EXPORT_REGISTRY } from '@/lib/export-registry'
${guard ? "import { getSessionUser } from '@/lib/session-server'\n" : ''}
export const dynamic = 'force-dynamic'

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\\r\\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const entry = EXPORT_REGISTRY[slug]
  if (!entry) return NextResponse.json({ error: 'Tela não encontrada.' }, { status: 404 })
${guard}
  const url = new URL(request.url)
  const format = (url.searchParams.get('format') || 'csv').toLowerCase()
  if (!entry.formats.includes(format)) return NextResponse.json({ error: 'Formato não disponível.' }, { status: 400 })

  const query: Record<string, string> = {}
  url.searchParams.forEach((v, k) => { if (k !== 'format' && k !== 'ids') query[k] = v })
  const idsParam = url.searchParams.get('ids')
  const mod = await entry.load()
  let rows: Record<string, any>[]
  try {
    rows = await mod.getExportRows(query, idsParam ? idsParam.split(',').filter(Boolean) : undefined)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Não foi possível exportar.' }, { status: 500 })
  }

  const day = new Date().toISOString().slice(0, 10)
  const base = slug + '-' + day
  const cols = mod.EXPORT_COLUMNS

  if (format === 'json') {
    return new NextResponse(JSON.stringify(rows, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="' + base + '.json"' },
    })
  }

  if (format === 'csv') {
    const lines = [cols.map(c => csvCell(c.label)).join(';'), ...rows.map(r => cols.map(c => csvCell(r[c.key])).join(';'))]
    // BOM para o Excel abrir com acentos; separador ";" (padrão do Excel em português)
    return new NextResponse('\\uFEFF' + lines.join('\\r\\n'), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="' + base + '.csv"' },
    })
  }

  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(entry.title.replace(/[\\\\/?*[\\]:]/g, ' ').slice(0, 31) || 'Dados')
  ws.columns = cols.map(c => ({ header: c.label, key: c.key, width: Math.min(60, Math.max(12, c.label.length + 4)) }))
  rows.forEach(r => ws.addRow(r))
  ws.getRow(1).font = { bold: true }
  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="' + base + '.xlsx"',
    },
  })
}
`

/** Gera a exportação: dados por tela, registro, rota de download e o botão. Só gera algo se alguma tela exporta. */
export function generateExportLayer(ast: AppAST, files: Map<string, string>) {
  const routes = exportRoutes(ast)
  if (routes.length === 0) return
  const dict = getGeneratorDictionary(ast.targetLanguage)

  const entries: string[] = []
  for (const route of routes) {
    files.set(`app/(protected)${route.path}/export-data.ts`, exportDataModule(route))
    entries.push(`  ${JSON.stringify(route.viewSlug)}: { title: ${JSON.stringify(route.title)}, formats: ${JSON.stringify(routeExportFormats(route))}, load: () => import(${JSON.stringify(`@/app/(protected)${route.path}/export-data`)}) },`)
  }
  files.set('lib/export-registry.ts', `// ARQUIVO GERADO pelo MetaBuilder — telas que exportam dados e os formatos liberados em cada uma.
export const EXPORT_REGISTRY: Record<string, { title: string; formats: string[]; load: () => Promise<{ EXPORT_COLUMNS: Array<{ key: string; label: string }>; getExportRows: (params: Record<string, string | undefined>, ids?: string[]) => Promise<Record<string, any>[]> }> }> = {
${entries.join('\n')}
}
`)

  // com login: só quem tem sessão baixa, e só das telas a que o grupo tem acesso
  const authOn = !!ast.authConfig && ast.authConfig.authType !== 'none'
  const guard = authOn
    ? `  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 })
  if (user.acc?.no.includes(slug)) return NextResponse.json({ error: 'Você não tem acesso a esta tela.' }, { status: 403 })`
    : ''
  files.set('app/api/export/[slug]/route.ts', API_ROUTE(guard))

  const l = dict.list as any
  files.set('components/RowSelect.tsx', ROW_SELECT)
  files.set('components/ExportMenu.tsx', EXPORT_MENU({
    title: l.export_format_title, xlsx: l.export_xlsx, csv: l.export_csv, json: l.export_json, failed: l.export_failed,
  }))
}
