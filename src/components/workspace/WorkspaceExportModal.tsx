'use client'

import React, { useState } from 'react'
import { DownloadCloud, Loader2, Code2, Database, CheckCircle2, Layers } from 'lucide-react'
import { DbType } from '@/lib/generator/ast'
import { useToast } from '@/components/ui/Toast'

interface WorkspaceExportModalProps {
  isOpen: boolean
  onClose: () => void
  workspaceSlug: string
  workspaceId: string
  projectCount: number
}

const DB_OPTIONS: { value: DbType; label: string; description: string }[] = [
  { value: 'postgres', label: 'PostgreSQL (pg)', description: 'Queries parametrizadas diretas ($1, $2...)' },
  { value: 'supabase', label: 'Supabase SDK', description: 'Client @supabase/ssr com RLS' },
  { value: 'mysql', label: 'MySQL / MariaDB', description: 'Driver mysql2/promise com pool' },
  { value: 'sqlserver', label: 'SQL Server (mssql)', description: 'Bindings nomeados @param' },
  { value: 'oracle', label: 'Oracle DB', description: 'Bindings nomeados :param + connection pool' },
]

export function WorkspaceExportModal({
  isOpen, onClose, workspaceSlug, workspaceId, projectCount
}: WorkspaceExportModalProps) {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)
  const [dbStack, setDbStack] = useState<DbType>('postgres')
  const [done, setDone] = useState(false)

  if (!isOpen) return null

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const res = await fetch('/api/export-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, dbStack })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao gerar workspace')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${workspaceSlug}-native-source.zip`
      a.click()
      URL.revokeObjectURL(url)

      setDone(true)
      toast('Download iniciado! Portal Next.js gerado com sucesso.', 'success')
    } catch (err: any) {
      toast('Erro ao exportar: ' + err.message, 'error')
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
          <Layers className="text-white w-6 h-6" />
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Exportar Workspace — Portal Unificado</h2>
            <p className="text-indigo-200 text-xs mt-0.5">{workspaceSlug} · {projectCount} projeto{projectCount !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400" />
              <p className="text-white font-semibold">Workspace exportado com sucesso!</p>
              <p className="text-neutral-400 text-sm">
                O ZIP contém um único projeto <strong className="text-white">Next.js</strong> com um
                portal de entrada e <strong className="text-white">{projectCount} sub-rota{projectCount !== 1 ? 's' : ''}</strong>.
                <br />Extraia, rode <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-indigo-300">npm install</code> e depois <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-indigo-300">npm run dev</code>.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-neutral-400">
                Gera um único projeto <strong className="text-white">Next.js App Router</strong> com um
                portal de entrada e um projeto por sub-rota. Cada projeto mantém seu próprio sistema de login.
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
                      className={`flex items-center gap-3 cursor-pointer border rounded-lg p-3 transition-colors ${
                        dbStack === opt.value
                          ? 'border-indigo-500 bg-indigo-600/10'
                          : 'border-neutral-700 hover:border-neutral-500 bg-neutral-800/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="wsDbStack"
                        checked={dbStack === opt.value}
                        onChange={() => setDbStack(opt.value)}
                        className="w-4 h-4 accent-indigo-500"
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
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-500 shadow-sm transition-colors disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
              {isExporting ? 'Gerando portal...' : 'Exportar como Next.js'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
