'use client'

import React, { useState } from 'react'
import { DownloadCloud, Loader2, Code2, Database, CheckCircle2 } from 'lucide-react'
import { DbType } from '@/lib/generator/ast'
import { useToast } from '@/components/ui/Toast'
import { isTauri } from '@/utils/tauriUtils'

interface NativeExportModalProps {
  isOpen: boolean
  onClose: () => void
  projectSlug: string
  projectId: string
}

const DB_OPTIONS: { value: DbType; label: string; description: string }[] = [
  { value: 'postgres', label: 'PostgreSQL (pg)', description: 'Queries parametrizadas diretas ($1, $2...)' },
  { value: 'supabase', label: 'Supabase SDK', description: 'Client @supabase/ssr com RLS' },
  { value: 'mysql', label: 'MySQL / MariaDB', description: 'Driver mysql2/promise com pool' },
  { value: 'sqlserver', label: 'SQL Server (mssql)', description: 'Bindings nomeados @param' },
  { value: 'oracle', label: 'Oracle DB', description: 'Bindings nomeados :param + connection pool' },
]

export function NativeExportModal({ isOpen, onClose, projectSlug, projectId }: NativeExportModalProps) {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)
  const [dbStack, setDbStack] = useState<DbType>('postgres')
  const [done, setDone] = useState(false)

  if (!isOpen) return null

  const handleEject = async () => {
    setIsExporting(true)
    try {
      // 1. Busca o ZIP do servidor (o CleanCodeGenerator roda server-side)
      const res = await fetch('/api/export-native', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, dbStack })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao gerar código')
      }

      const buffer = await res.arrayBuffer()
      const merged = new Uint8Array(buffer)

      if (isTauri()) {
        // 2. Abre o seletor de pasta nativo do sistema operacional
        const { open } = await import('@tauri-apps/plugin-dialog')
        const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs')
        const { join, dirname } = await import('@tauri-apps/api/path')
        const JSZip = (await import('jszip')).default

        const selectedDir = await open({ directory: true, title: 'Escolha a pasta de destino do projeto' })
        if (!selectedDir || typeof selectedDir !== 'string') {
          setIsExporting(false)
          return
        }

        // 3. Extrai o ZIP para a pasta escolhida
        const zip = await JSZip.loadAsync(merged)
        for (const relativePath of Object.keys(zip.files)) {
          const zipEntry = zip.files[relativePath]
          if (zipEntry.dir) continue

          const fullPath = await join(selectedDir, relativePath)
          const dirPath = await dirname(fullPath)

          try { await mkdir(dirPath, { recursive: true }) } catch (e) { /* pasta já existe */ }

          const fileBytes = await zipEntry.async('uint8array')
          await writeFile(fullPath, fileBytes)
        }

        setDone(true)
        toast(`Projeto ejetado com sucesso em ${selectedDir}!`, 'success')
      } else {
        // Fallback web: download normal do ZIP
        const blob = new Blob([merged], { type: 'application/zip' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${projectSlug}-native-source.zip`
        a.click()
        URL.revokeObjectURL(url)
        setDone(true)
        toast('Download iniciado!', 'success')
      }
    } catch (err: any) {
      toast('Erro ao ejetar: ' + err.message, 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const handleClose = () => {
    setDone(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-5 flex items-center gap-3">
          <Code2 className="text-white w-6 h-6" />
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Ejetar Código-Fonte Nativo</h2>
            <p className="text-indigo-200 text-xs mt-0.5">{projectSlug}</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400" />
              <p className="text-white font-semibold">Código ejetado com sucesso!</p>
              <p className="text-neutral-400 text-sm">O projeto Next.js foi gerado com o driver <strong className="text-white">{dbStack}</strong>. Abra a pasta escolhida, rode <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-indigo-300">npm install</code> e depois <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-indigo-300">npm run dev</code>.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-neutral-400">
                Gera um projeto <strong className="text-white">Next.js App Router</strong> puro com React Server Components, Server Actions tipadas e <strong className="text-white">.env.local</strong> pré-configurado.
              </p>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-neutral-200 mb-3">
                  <Database className="w-4 h-4 text-indigo-400" />
                  Stack de Banco de Dados
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {DB_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 cursor-pointer border rounded-lg p-3 transition-colors ${dbStack === opt.value ? 'border-indigo-500 bg-indigo-600/10' : 'border-neutral-700 hover:border-neutral-500 bg-neutral-800/50'}`}
                    >
                      <input
                        type="radio"
                        name="dbStack"
                        checked={dbStack === opt.value}
                        onChange={() => setDbStack(opt.value)}
                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 accent-indigo-500"
                      />
                      <div className="flex flex-col">
                        <span className="font-semibold text-neutral-100 text-sm">{opt.label}</span>
                        <span className="text-xs text-neutral-500">{opt.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-3 border-t border-neutral-800 bg-neutral-900/50">
          <button
            onClick={handleClose}
            disabled={isExporting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            {done ? 'Fechar' : 'Cancelar'}
          </button>
          {!done && (
            <button
              onClick={handleEject}
              disabled={isExporting}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-500 shadow-sm transition-colors disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
              {isExporting ? 'Gerando projeto...' : 'Ejetar na Pasta Local'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
