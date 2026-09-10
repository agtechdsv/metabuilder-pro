'use client'

import React, { useState } from 'react'
import { DownloadCloud, Loader2, Code2, Database, CheckCircle2, Server, Coffee } from 'lucide-react'
import { DbType, BackendStack } from '@/lib/generator/ast'
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

export function NativeExportModal({ isOpen, onClose, projectSlug, projectId }: NativeExportModalProps) {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)
  const [dbStack, setDbStack] = useState<DbType>('postgres')
  const [backendStack, setBackendStack] = useState<BackendStack>('nodejs')
  const [javaGroupId, setJavaGroupId] = useState('com.app')
  const [javaPort, setJavaPort] = useState(8080)
  const [done, setDone] = useState(false)

  if (!isOpen) return null

  // GAP fix: reset state on every open so re-opens start clean
  const handleClose = () => {
    setDone(false)
    setBackendStack('nodejs')
    setDbStack('postgres')
    setJavaGroupId('com.app')
    setJavaPort(8080)
    onClose()
  }

  const handleEject = async () => {
    setIsExporting(true)
    try {
      const res = await fetch('/api/export-native', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          dbStack,
          backendStack,
          javaGroupId: backendStack === 'java-spring' ? javaGroupId : undefined,
          javaPort: backendStack === 'java-spring' ? javaPort : undefined,
          javaVersion: 21,
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao gerar código')
      }

      const buffer = await res.arrayBuffer()
      const merged = new Uint8Array(buffer)
      const zipName = `${projectSlug}-${backendStack === 'java-spring' ? 'java-spring' : 'nodejs'}-source.zip`

      if (isTauri()) {
        const { open } = await import('@tauri-apps/plugin-dialog')
        const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs')
        const { join, dirname } = await import('@tauri-apps/api/path')
        const JSZip = (await import('jszip')).default

        const selectedDir = await open({ directory: true, title: 'Escolha a pasta de destino do projeto' })
        if (!selectedDir || typeof selectedDir !== 'string') {
          setIsExporting(false)
          return
        }

        const zip = await JSZip.loadAsync(merged)
        for (const relativePath of Object.keys(zip.files)) {
          const zipEntry = zip.files[relativePath]
          if (zipEntry.dir) continue

          const fullPath = await join(selectedDir, relativePath)
          const dirPath = await dirname(fullPath)

          try { await mkdir(dirPath, { recursive: true }) } catch (_) { /* pasta já existe */ }

          const fileBytes = await zipEntry.async('uint8array')
          await writeFile(fullPath, fileBytes)
        }

        setDone(true)
        toast(`Projeto ejetado com sucesso em ${selectedDir}!`, 'success')
      } else {
        const blob = new Blob([merged], { type: 'application/zip' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = zipName
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

  const isJava = backendStack === 'java-spring'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-indigo-600 px-6 py-5 flex items-center gap-3 shrink-0">
          <Code2 className="text-white w-6 h-6" />
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Ejetar Código-Fonte Nativo</h2>
            <p className="text-indigo-200 text-xs mt-0.5">{projectSlug}</p>
          </div>
        </div>

        {/* Body — scrollável */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400" />
              <p className="text-white font-semibold">Código ejetado com sucesso!</p>
              {isJava ? (
                <p className="text-neutral-400 text-sm">
                  Estrutura dual gerada: <strong className="text-white">frontend/</strong> (Next.js) e{' '}
                  <strong className="text-white">backend/</strong> (Spring Boot). Leia os{' '}
                  <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-indigo-300">README.md</code> em
                  cada pasta para iniciar.
                </p>
              ) : (
                <p className="text-neutral-400 text-sm">
                  Projeto Next.js gerado com driver <strong className="text-white">{dbStack}</strong>. Rode{' '}
                  <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-indigo-300">npm install</code> e{' '}
                  <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-indigo-300">npm run dev</code>.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* ── Seção 1: Backend Stack ── */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-neutral-200 mb-3">
                  <Server className="w-4 h-4 text-indigo-400" />
                  Stack de Backend
                </label>
                <div className="grid grid-cols-1 gap-2">
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
                        name="backendStack"
                        checked={backendStack === opt.value}
                        onChange={() => setBackendStack(opt.value)}
                        className="w-4 h-4 accent-indigo-500 shrink-0"
                      />
                      <div className="flex items-center gap-2 shrink-0">{opt.icon}</div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-neutral-100 text-sm">{opt.label}</span>
                        <span className="text-xs text-neutral-500">{opt.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* ── Seção 2: Campos Java (só quando java-spring) ── */}
              {isJava && (
                <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-500/5 space-y-3">
                  <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Configurações Spring Boot</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs text-neutral-400 mb-1">Maven groupId</label>
                      <input
                        type="text"
                        value={javaGroupId}
                        onChange={e => setJavaGroupId(e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, '.'))}
                        placeholder="com.empresa"
                        className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                      <p className="text-xs text-neutral-600 mt-0.5">ex: com.empresa — usado como package Java base</p>
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Porta Spring Boot</label>
                      <input
                        type="number"
                        min={1}
                        max={65535}
                        value={javaPort}
                        onChange={e => setJavaPort(Number(e.target.value))}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Java Version</label>
                      <div className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-400 cursor-not-allowed">
                        Java 21 (LTS)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Seção 3: DB Stack ── */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-neutral-200 mb-3">
                  <Database className="w-4 h-4 text-indigo-400" />
                  {isJava ? 'Banco de Dados (Spring Boot)' : 'Stack de Banco de Dados'}
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
                        name="dbStack"
                        checked={dbStack === opt.value}
                        onChange={() => setDbStack(opt.value)}
                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 accent-indigo-500"
                      />
                      <div className="flex flex-col">
                        <span className="font-semibold text-neutral-100 text-sm">{opt.label}</span>
                        <span className="text-xs text-neutral-500">
                          {isJava
                            ? opt.value === 'supabase'
                              ? 'Supabase é PostgreSQL — usará driver JDBC PostgreSQL'
                              : opt.description.replace('Driver', 'Driver JDBC')
                            : opt.description}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-3 border-t border-neutral-800 bg-neutral-900/50 shrink-0">
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
