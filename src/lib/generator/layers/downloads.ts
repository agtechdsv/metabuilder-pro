import type { AppAST } from '../ast'
import { getGeneratorDictionary } from '../i18n'

/**
 * Central de Downloads do app exportado.
 *
 * Mesma ideia da plataforma: cada exportação gerada fica guardada numa pasta definida por quem administra o app
 * (EXPORT_DIR; padrão Downloads/MetaBuilderExports, como o CLI do MetaBuilder) e a Central lista, baixa e exclui esses arquivos.
 * A retenção vem do projeto no Studio (download_retention_hours; vazio = sem expiração) e vai para EXPORT_RETENTION_HOURS no .env.local.
 * Nada de banco: cada arquivo tem um .meta.json ao lado com os dados que a lista mostra (tela, registros, quem exportou, data).
 */

export const EXPORT_STORE_SOURCE = `// ARQUIVO GERADO pelo MetaBuilder — cópias das exportações feitas no app.
// Pasta: EXPORT_DIR (padrão: Downloads/MetaBuilderExports do usuário que roda o app). Retenção: EXPORT_RETENTION_HOURS (0 = não expira).
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

export type ExportRecord = {
  id: string
  fileName: string
  fileType: string
  recordCount: number
  fileSize: number
  screen: string
  screenTitle: string
  owner: string
  createdAt: string
}

const META_SUFFIX = '.meta.json'

export function exportDir(): string {
  const dir = (process.env.EXPORT_DIR || '').trim()
  return dir ? path.resolve(dir) : path.join(os.homedir(), 'Downloads', 'MetaBuilderExports')
}

/** Horas que a cópia fica guardada (0 = não expira). */
export function retentionHours(): number {
  const raw = (process.env.EXPORT_RETENTION_HOURS || '').trim()
  if (raw === '') return 24
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 24
}

const safeName = (name: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/.test(name) && !name.includes('..')

function removeFiles(dir: string, fileName: string) {
  for (const f of [fileName, fileName + META_SUFFIX]) {
    try { fs.unlinkSync(path.join(dir, f)) } catch { /* já removido */ }
  }
}

/** Lê os registros da pasta e apaga os vencidos. */
function readAll(): ExportRecord[] {
  const dir = exportDir()
  let names: string[]
  try { names = fs.readdirSync(dir) } catch { return [] }
  const limitMs = retentionHours() * 3_600_000
  const out: ExportRecord[] = []
  for (const n of names) {
    if (!n.endsWith(META_SUFFIX)) continue
    try {
      const rec = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')) as ExportRecord
      if (!rec?.id || !rec.fileName || path.basename(rec.fileName) !== rec.fileName || !safeName(rec.fileName)) continue
      if (!fs.existsSync(path.join(dir, rec.fileName))) { try { fs.unlinkSync(path.join(dir, n)) } catch { /* ok */ } continue }
      if (limitMs > 0 && Date.now() - new Date(rec.createdAt).getTime() > limitMs) { removeFiles(dir, rec.fileName); continue }
      out.push(rec)
    } catch { /* meta ilegível: ignora */ }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Exportações guardadas. Com login, cada pessoa vê só as suas (owner = e-mail); sem login (owner vazio), todas. */
export function listExports(owner: string): ExportRecord[] {
  return readAll().filter(r => !owner || r.owner === owner)
}

export function findExport(id: string, owner: string): ExportRecord | null {
  return listExports(owner).find(r => r.id === id) || null
}

export function exportFilePath(rec: ExportRecord): string {
  return path.join(exportDir(), path.basename(rec.fileName))
}

export function removeExport(rec: ExportRecord) {
  removeFiles(exportDir(), path.basename(rec.fileName))
}

/** Guarda a cópia. Falha (pasta sem permissão, disco cheio) não pode impedir o download: devolve null. */
export function saveExport(body: Buffer, info: { ext: string; screen: string; screenTitle: string; recordCount: number; owner: string }): ExportRecord | null {
  try {
    const dir = exportDir()
    fs.mkdirSync(dir, { recursive: true })
    readAll() // aproveita para apagar os vencidos
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
    const slug = info.screen.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60) || 'export'
    const fileName = slug + '-' + stamp + '-' + crypto.randomBytes(2).toString('hex') + '.' + info.ext.replace(/[^a-z0-9]/gi, '').slice(0, 8)
    const rec: ExportRecord = {
      id: crypto.randomUUID(),
      fileName,
      fileType: info.ext,
      recordCount: info.recordCount,
      fileSize: body.length,
      screen: info.screen,
      screenTitle: info.screenTitle,
      owner: info.owner,
      createdAt: new Date().toISOString(),
    }
    fs.writeFileSync(path.join(dir, fileName), body)
    fs.writeFileSync(path.join(dir, fileName + META_SUFFIX), JSON.stringify(rec))
    return rec
  } catch (e: any) {
    console.error('[exportações] não foi possível guardar a cópia:', e?.message)
    return null
  }
}
`

const apiRoute = (authOn: boolean) => `// ARQUIVO GERADO pelo MetaBuilder — baixar e excluir uma exportação guardada na Central de Downloads.
import { NextResponse } from 'next/server'
import fs from 'node:fs'
import { findExport, exportFilePath, removeExport } from '@/lib/export-store'
${authOn ? "import { getSessionUser } from '@/lib/session-server'\n" : ''}
export const dynamic = 'force-dynamic'

const TYPES: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
}

async function load(params: Promise<{ id: string }>) {
  const { id } = await params
${authOn ? `  const user = await getSessionUser()
  if (!user) return { error: NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 }) }
  const owner = user.email` : "  const owner = ''"}
  const rec = findExport(id, owner)
  if (!rec) return { error: NextResponse.json({ error: 'Arquivo não encontrado (pode ter expirado).' }, { status: 404 }) }
  return { rec }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await load(params)
  if ('error' in r) return r.error
  try {
    const data = fs.readFileSync(exportFilePath(r.rec))
    return new NextResponse(data, {
      headers: {
        'Content-Type': TYPES[r.rec.fileType] || 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="' + r.rec.fileName + '"',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Arquivo não encontrado (pode ter expirado).' }, { status: 404 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await load(params)
  if ('error' in r) return r.error
  removeExport(r.rec)
  return NextResponse.json({ ok: true })
}
`

const DELETE_BUTTON = (label: string) => `'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'

export function DeleteExportButton({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      title=${JSON.stringify(label)}
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try { await fetch('/api/downloads/' + encodeURIComponent(id), { method: 'DELETE' }) } finally { setBusy(false) }
        router.refresh()
      }}
      className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-red-600 flex items-center justify-center text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  )
}
`

export function generateDownloadsLayer(ast: AppAST, files: Map<string, string>) {
  const d = getGeneratorDictionary(ast.targetLanguage)
  const authOn = !!ast.authConfig && ast.authConfig.authType !== 'none'

  files.set('lib/export-store.ts', EXPORT_STORE_SOURCE)
  files.set('app/api/downloads/[id]/route.ts', apiRoute(authOn))
  files.set('components/DeleteExportButton.tsx', DELETE_BUTTON(d.downloads.delete_label))

  files.set('app/(protected)/downloads/page.tsx', `import { Download, FileSpreadsheet, FileText, FileJson, AlertCircle, Calendar, Layers, ArrowUpDown } from 'lucide-react'
import { listExports, exportDir, retentionHours } from '@/lib/export-store'
import { DeleteExportButton } from '@/components/DeleteExportButton'
${authOn ? "import { getSessionUser } from '@/lib/session-server'\n" : ''}
export const dynamic = 'force-dynamic'

export default async function DownloadsPage() {
${authOn ? "  const user = await getSessionUser()\n  const jobs = listExports(user?.email || '__sem_sessao__')" : '  const jobs = listExports(\'\')'}
  const hours = retentionHours()
  const totalSize = jobs.reduce((acc, j) => acc + j.fileSize, 0)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center ring-1 ring-indigo-500/20">
            <Download className="w-5 h-5 text-indigo-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">${d.downloads.title}</h1>
        </div>
        <p className="text-sm text-[var(--muted)]">${d.downloads.subtitle}</p>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
        <div>
          <h4 className="text-sm font-semibold text-amber-500">${d.downloads.queue_title}</h4>
          <p className="text-xs text-amber-500/80 mt-1 leading-relaxed">
            ${d.downloads.queue_desc} ${d.downloads.folder_label}: <span className="font-mono">{exportDir()}</span> · ${d.downloads.retention_label}: {hours > 0 ? hours + 'h' : '${d.downloads.forever_label}'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: '${d.downloads.total_requested}', value: String(jobs.length), color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: '${d.downloads.total_size}', value: (totalSize / 1024 / 1024).toFixed(2) + ' MB', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: '${d.downloads.retention_label}', value: hours > 0 ? hours + 'h' : '∞', color: 'text-amber-500', bg: 'bg-amber-500/10' },
        ].map((m, idx) => (
          <div key={idx} className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">{m.label}</span>
              <div className={\`w-8 h-8 rounded-full flex items-center justify-center \${m.bg} \${m.color}\`}>
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <span className={\`text-3xl font-bold \${m.color}\`}>{m.value}</span>
          </div>
        ))}
      </div>

      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[var(--card-border)] bg-neutral-900/40 grid grid-cols-12 gap-4 items-center">
          <div className="col-span-5 flex items-center gap-2 text-xs font-black tracking-widest text-[var(--muted)] uppercase"><ArrowUpDown className="w-3 h-3"/> ${d.downloads.col_file}</div>
          <div className="col-span-4 text-xs font-black tracking-widest text-[var(--muted)] uppercase">${d.downloads.col_records}</div>
          <div className="col-span-3 text-center text-xs font-black tracking-widest text-[var(--muted)] uppercase">${d.downloads.col_actions}</div>
        </div>

        <div className="divide-y divide-[var(--card-border)]">
          {jobs.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <Download className="w-12 h-12 text-[var(--muted)] opacity-20 mb-4" />
              <h3 className="text-white font-semibold mb-1">${d.downloads.empty_title}</h3>
              <p className="text-[var(--muted)] text-sm">${d.downloads.empty_desc}</p>
            </div>
          ) : jobs.map((job) => (
            <div key={job.id} className="p-4 grid grid-cols-12 gap-4 items-center hover:bg-white/5 transition-colors group">
              <div className="col-span-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center ring-1 ring-neutral-700">
                  {job.fileType === 'csv' ? <FileText className="w-5 h-5 text-indigo-400" /> : job.fileType === 'json' ? <FileJson className="w-5 h-5 text-amber-400" /> : <FileSpreadsheet className="w-5 h-5 text-emerald-400" />}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-white text-sm truncate">{job.fileName}</div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted)]">
                    <Calendar className="w-3 h-3" />
                    {new Date(job.createdAt).toLocaleString()}
                    <span className="opacity-50">· {(job.fileSize / 1024).toFixed(2)} KB</span>
                  </div>
                </div>
              </div>

              <div className="col-span-4 text-sm text-[var(--foreground)]">
                <span className="bg-neutral-800 border border-neutral-700 px-2.5 py-1 rounded-md text-xs font-medium">
                  {job.recordCount.toLocaleString()} ${d.list.lines.toLowerCase()}
                </span>
                <span className="ml-2 text-xs text-[var(--muted)]">{job.screenTitle}</span>
              </div>

              <div className="col-span-3 flex justify-center gap-2">
                <a href={'/api/downloads/' + job.id} className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110 active:scale-95" title="${d.downloads.download_label}">
                  <Download className="w-4 h-4" />
                </a>
                <DeleteExportButton id={job.id} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
`)
}
