'use client'

import React, { useState } from 'react'
import { Loader2, Database, CheckCircle2, Layers, Coffee, Server, Play, FolderOpen, Code2, X } from 'lucide-react'
import { DbType, BackendStack } from '@/lib/generator/ast'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import { isTauri } from '@/utils/tauriUtils'
import { isWindowsDesktop, pickFolder, writeZipToFolder, runNpm, startInTerminal, openInVsCode } from '@/utils/exportToFolder'

interface WorkspaceExportModalProps {
  isOpen: boolean
  onClose: () => void
  workspaceSlug: string
  workspaceId: string
  projectCount: number
}

type Phase = 'form' | 'working' | 'done'

const BACKEND_OPTIONS: { value: BackendStack; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'nodejs',
    label: 'Next.js Full-Stack (Node.js)',
    description: 'App Router + React Server Components + Server Actions',
    icon: <span className="text-green-400 font-bold text-xs">Node</span>,
  },
  {
    value: 'java-spring',
    label: 'Next.js + Spring Boot 3 (Java 21)',
    description: 'Frontend Next.js + API REST Spring Boot',
    icon: <Coffee className="w-4 h-4 text-amber-400" />,
  },
]

const DB_VALUES: { value: DbType | 'auto'; label: string }[] = [
  { value: 'postgres', label: 'PostgreSQL (pg)' },
  { value: 'supabase', label: 'Supabase SDK' },
  { value: 'mysql', label: 'MySQL / MariaDB' },
  { value: 'sqlserver', label: 'SQL Server (mssql)' },
  { value: 'oracle', label: 'Oracle DB' },
]

/**
 * Ejetar de um Workspace (IDE Desktop): gera o portal + um app independente por projeto numa pasta escolhida, instala as
 * dependências e deixa rodar o portal. Mesmo motor do Ejetar de um projeto.
 */
export function WorkspaceExportModal({ isOpen, onClose, workspaceSlug, workspaceId, projectCount }: WorkspaceExportModalProps) {
  const { toast } = useToast()
  const { t } = useI18n()
  const [phase, setPhase] = useState<Phase>('form')
  const [status, setStatus] = useState('')
  const [dbStack, setDbStack] = useState<DbType | 'auto'>('auto')
  const [backendStack, setBackendStack] = useState<BackendStack>('nodejs')
  const [javaGroupId, setJavaGroupId] = useState('com.app')
  const [javaPort, setJavaPort] = useState(8080)
  const [savedDir, setSavedDir] = useState('')
  const [installFailed, setInstallFailed] = useState(false)
  const [portalStarted, setPortalStarted] = useState(false)

  if (!isOpen) return null

  const handleClose = () => {
    if (phase === 'working') return // gravando e instalando: espera terminar
    setPhase('form'); setStatus(''); setSavedDir(''); setInstallFailed(false); setPortalStarted(false)
    onClose()
  }

  const handleExport = async () => {
    if (!isTauri()) {
      toast(t('export_modal.desktop_only', 'A exportação do código fonte está disponível apenas na IDE Desktop. Baixe a IDE na Central de Downloads.'), 'error')
      return
    }
    try {
      setPhase('working')
      setStatus(t('export_modal.ws_generating', 'Gerando os projetos...'))
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
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || t('export_modal.ws_error', 'Erro ao gerar o workspace'))
      }
      const bytes = new Uint8Array(await res.arrayBuffer())

      // só pergunta a pasta depois de gerar (mesma ordem da exportação de um projeto)
      const dir = await pickFolder()
      if (!dir) { setPhase('form'); setStatus(''); return }

      setStatus(t('export_modal.ws_extracting', 'Gravando os arquivos...'))
      await writeZipToFolder(bytes, dir)

      setStatus(t('export_modal.ws_installing', 'Instalando as dependências (portal e projetos)...'))
      let ok = false
      try { ok = (await runNpm('run install:all', dir)).ok } catch (e) { console.error('install:all falhou:', e) }
      setInstallFailed(!ok)
      if (!ok) toast(t('export_modal.ws_install_failed', 'Os arquivos foram gravados, mas a instalação das dependências falhou. Rode npm run install:all na pasta.'), 'error')

      setSavedDir(dir)
      setPhase('done')
    } catch (err: any) {
      setPhase('form')
      toast(t('export_modal.ws_error', 'Erro ao gerar o workspace') + ': ' + (err?.message || err), 'error')
    }
  }

  const runPortal = async () => {
    try {
      await startInTerminal('npm run dev:portal', savedDir)
      setPortalStarted(true)
    } catch (e: any) {
      toast(String(e?.message || e), 'error')
    }
  }

  const openFolder = async () => {
    try {
      const { openPath } = await import('@tauri-apps/plugin-opener')
      await openPath(savedDir)
    } catch (e) { console.error('Não foi possível abrir a pasta:', e) }
  }

  const busy = phase === 'working'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-indigo-600 px-6 py-5 flex items-center gap-3">
          <Layers className="text-white w-6 h-6" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white tracking-tight">{t('export_modal.ws_title', 'Ejetar Workspace — Portal + Projetos')}</h2>
            <p className="text-indigo-200 text-xs mt-0.5">{workspaceSlug}{projectCount > 0 ? ` · ${projectCount} ${t('export_modal.ws_projects', 'projeto')}${projectCount !== 1 ? 's' : ''}` : ''}</p>
          </div>
          {!busy && <button onClick={handleClose} className="text-indigo-200 hover:text-white"><X className="w-5 h-5" /></button>}
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {phase === 'working' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
              <p className="text-neutral-200 text-sm font-medium">{status}</p>
            </div>
          )}

          {phase === 'done' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-400" />
                <p className="text-white font-semibold">{t('export_modal.ws_done', 'Workspace gerado com sucesso!')}</p>
                <p className="text-neutral-400 text-sm">{t('export_modal.ws_done_desc', 'O portal está em portal/ e cada projeto em apps/. Leia o README.md da pasta para rodar cada um.')}</p>
                <p className="text-xs font-mono text-emerald-300 break-all">{savedDir}</p>
              </div>
              {installFailed && <p className="text-xs text-amber-400 text-center">{t('export_modal.ws_install_failed', 'Os arquivos foram gravados, mas a instalação das dependências falhou. Rode npm run install:all na pasta.')}</p>}
              {isWindowsDesktop() && (
                <button onClick={runPortal} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold">
                  <Play className="w-4 h-4" /> {t('export_modal.ws_run_portal', 'Executar o portal (npm run dev:portal)')}
                </button>
              )}
              {portalStarted && <p className="text-xs text-indigo-300 text-center leading-relaxed">{t('export_modal.ws_portal_started', 'O portal está subindo em um terminal minimizado. Para cada projeto, rode npm run dev:<projeto> (veja o README.md).')}</p>}
              <div className="flex gap-2">
                <button onClick={openFolder} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-neutral-700 rounded-lg text-sm text-neutral-200 hover:bg-neutral-800">
                  <FolderOpen className="w-4 h-4" /> {t('export_modal.open_folder', 'Abrir Pasta')}
                </button>
                <button onClick={() => openInVsCode(savedDir).catch(() => toast(t('export_modal.open_vscode_failed', 'Não foi possível abrir o VS Code. Abra a pasta do projeto nele manualmente.'), 'error'))} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-neutral-700 rounded-lg text-sm text-neutral-200 hover:bg-neutral-800">
                  <Code2 className="w-4 h-4" /> {t('export_modal.ws_open_vscode', 'Abrir no VS Code')}
                </button>
              </div>
            </div>
          )}

          {phase === 'form' && (
            <>
              <p className="text-sm text-neutral-400">{t('export_modal.ws_intro', 'Gera um portal de entrada (sem login, com um card por projeto) e um app independente para cada projeto, na pasta apps/. Cada projeto mantém o próprio login e a própria conexão com o banco.')}</p>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-neutral-200 mb-3">
                  <Server className="w-4 h-4 text-indigo-400" /> {t('export_modal.ws_backend', 'Stack de Backend & API')}
                </label>
                <div className="grid grid-cols-1 gap-2 mb-4">
                  {BACKEND_OPTIONS.map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 cursor-pointer border rounded-lg p-3 transition-colors ${backendStack === opt.value ? 'border-indigo-500 bg-indigo-600/10' : 'border-neutral-700 hover:border-neutral-500 bg-neutral-800/50'}`}>
                      <input type="radio" name="wsBackendStack" checked={backendStack === opt.value} onChange={() => setBackendStack(opt.value)} className="w-4 h-4 accent-indigo-500" />
                      <div className="flex items-center justify-center w-8 h-8 rounded bg-neutral-900 border border-neutral-700 shrink-0">{opt.icon}</div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-neutral-100 text-sm">{opt.label}</span>
                        <span className="text-xs text-neutral-500">{opt.description}</span>
                      </div>
                    </label>
                  ))}
                </div>

                {backendStack === 'java-spring' && (
                  <div className="mb-4 p-4 bg-black/20 border border-neutral-800 rounded-lg space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-400 mb-1">Maven Group ID</label>
                      <input type="text" value={javaGroupId} onChange={e => setJavaGroupId(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-400 mb-1">Spring Boot Port</label>
                      <input type="number" value={javaPort} onChange={e => setJavaPort(Number(e.target.value))} className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono" />
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm font-semibold text-neutral-200 mb-3">
                  <Database className="w-4 h-4 text-indigo-400" /> {t('export_modal.ws_database', 'Stack de Banco de Dados')}
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[{ value: 'auto' as const, label: t('export_modal.ws_db_auto', 'Banco de cada projeto (recomendado)'), description: t('export_modal.ws_db_auto_desc', 'Cada projeto usa o próprio banco: Oracle, PostgreSQL, MySQL, SQL Server...') }, ...DB_VALUES.map(d => ({ ...d, description: '' }))].map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 cursor-pointer border rounded-lg p-3 transition-colors ${dbStack === opt.value ? 'border-indigo-500 bg-indigo-600/10' : 'border-neutral-700 hover:border-neutral-500 bg-neutral-800/50'}`}>
                      <input type="radio" name="wsDbStack" checked={dbStack === opt.value} onChange={() => setDbStack(opt.value)} className="w-4 h-4 accent-indigo-500" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-neutral-100 text-sm">{opt.label}</span>
                        {opt.description && <span className="text-xs text-neutral-500">{opt.description}</span>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 flex justify-end gap-3 border-t border-neutral-800 bg-neutral-900/50">
          {phase !== 'working' && (
            <button onClick={handleClose} className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors">
              {phase === 'done' ? t('export_modal.ws_close', 'Fechar') : t('export_modal.ws_cancel', 'Cancelar')}
            </button>
          )}
          {phase === 'form' && (
            <button onClick={handleExport} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-500 shadow-sm transition-colors">
              {t('export_modal.ws_start', 'Escolher a pasta e gerar')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
