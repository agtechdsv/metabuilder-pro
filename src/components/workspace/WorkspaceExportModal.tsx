'use client'

import React, { useState } from 'react'
import { DownloadCloud, Loader2, Code2, Database, CheckCircle2, Layers, Coffee, Server } from 'lucide-react'
import { DbType, BackendStack } from '@/lib/generator/ast'
import { useToast } from '@/components/ui/Toast'

interface WorkspaceExportModalProps {
  isOpen: boolean
  onClose: () => void
  workspaceSlug: string
  workspaceId: string
  projectCount: number
}

const BACKEND_OPTIONS: { value: BackendStack; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'nodejs',
    label: 'Next.js Full-Stack (Node.js)',
    description: 'App Router + React Server Components + Server Actions diretas ao banco',
    icon: <span className="text-green-400 font-bold text-xs">Node</span>,
  },
  {
    value: 'java-spring',
    label: 'Next.js + Spring Boot 3 (Java 21)',
    description: 'Frontend Next.js chamando API REST Spring Boot — estrutura dual frontend/backend',
    icon: <Coffee className="w-4 h-4 text-amber-400" />,
  },
]

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
  const [backendStack, setBackendStack] = useState<BackendStack>('nodejs')
  const [javaGroupId, setJavaGroupId] = useState('com.app')
  const [javaPort, setJavaPort] = useState(8080)
  const [done, setDone] = useState(false)

  if (!isOpen) return null

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const res = await fetch('/api/export-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          workspaceId, 
          dbStack,
          backendStack,
          javaGroupId: backendStack === 'java-spring' ? javaGroupId : undefined,
          javaPort: backendStack === 'java-spring' ? javaPort : undefined,
          javaVersion: 21,
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao gerar workspace')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${workspaceSlug}-${backendStack === 'java-spring' ? 'java-spring' : 'nodejs'}-source.zip`
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
    setBackendStack('nodejs')
    setDbStack('postgres')
    setJavaGroupId('com.app')
    setJavaPort(8080)
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
              {backendStack === 'java-spring' ? (
                <p className="text-neutral-400 text-sm">
                  Estrutura dual gerada: <strong className="text-white">frontend/</strong> (Next.js multi-projeto) e{' '}
                  <strong className="text-white">backend/</strong> (Spring Boot).
                </p>
              ) : (
                <p className="text-neutral-400 text-sm">
                  O ZIP contém um único projeto <strong className="text-white">Next.js</strong> com um
                  portal de entrada e <strong className="text-white">{projectCount} sub-rota{projectCount !== 1 ? 's' : ''}</strong>.
                  <br />Extraia, rode <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-indigo-300">npm install</code> e depois <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-indigo-300">npm run dev</code>.
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-neutral-400">
                Gera a estrutura completa do Workspace, com um portal de entrada e um projeto por sub-rota. Cada projeto mantém seu próprio sistema de login.
              </p>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-neutral-200 mb-3">
                  <Server className="w-4 h-4 text-indigo-400" />
                  Stack de Backend & API
                </label>
                <div className="grid grid-cols-1 gap-2 mb-6">
                  {BACKEND_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 cursor-pointer border rounded-lg p-3 transition-colors ${
                        backendStack === opt.value
                          ? 'border-indigo-500 bg-indigo-600/10'
                          : 'border-neutral-700 hover:border-neutral-500 bg-neutral-800/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="wsBackendStack"
                        checked={backendStack === opt.value}
                        onChange={() => setBackendStack(opt.value)}
                        className="w-4 h-4 accent-indigo-500"
                      />
                      <div className="flex items-center justify-center w-8 h-8 rounded bg-neutral-900 border border-neutral-700 shrink-0">
                        {opt.icon}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-neutral-100 text-sm">{opt.label}</span>
                        <span className="text-xs text-neutral-500">{opt.description}</span>
                      </div>
                    </label>
                  ))}
                </div>

                {backendStack === 'java-spring' && (
                  <div className="mb-6 p-4 bg-black/20 border border-neutral-800 rounded-lg space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-400 mb-1">
                        Maven Group ID
                      </label>
                      <input
                        type="text"
                        value={javaGroupId}
                        onChange={e => setJavaGroupId(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                        placeholder="com.app"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-400 mb-1">
                        Porta do Spring Boot
                      </label>
                      <input
                        type="number"
                        value={javaPort}
                        onChange={e => setJavaPort(Number(e.target.value))}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                        placeholder="8080"
                      />
                    </div>
                  </div>
                )}

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
