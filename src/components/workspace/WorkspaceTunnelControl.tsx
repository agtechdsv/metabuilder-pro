'use client'

import React, { useState, useEffect } from 'react'
import { Play, Square, RefreshCw, Network, FileJson } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { isTauri } from '@/utils/tauriUtils'
import { createClient } from '@/utils/supabase/client'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/i18n'

import { defaultTunnelConfigTemplate } from './tunnel/tunnelUtils'
import { TunnelConfigModal } from './tunnel/TunnelConfigModal'
import { TunnelSyncConsoleModal } from './tunnel/TunnelSyncConsoleModal'
import { TunnelPendingResolutionModal } from './tunnel/TunnelPendingResolutionModal'

export function WorkspaceTunnelControl({ workspaceSlug }: { workspaceSlug: string }) {
  const { t } = useI18n()
  const { toast } = useToast()
  const pathname = usePathname()

  const [tunnelStatus, setTunnelStatus] = useState<'stopped' | 'running' | 'loading'>('loading')
  const [tunnelPid, setTunnelPid] = useState<number | null>(null)
  const [isDesktopEnv, setIsDesktopEnv] = useState<boolean | null>(null)

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [configContent, setConfigContent] = useState('')
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [hasProjects, setHasProjects] = useState<boolean | null>(null)
  const [availableProjects, setAvailableProjects] = useState<any[]>([])

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [syncLogs, setSyncLogs] = useState<string[]>([])
  const [pendingResolution, setPendingResolution] = useState<{ workspaceSlug: string; projectSlug: string } | null>(
    null
  )

  const handleOpenConfig = async () => {
    setIsConfigModalOpen(true)
    try {
      const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
      const { readTextFile, exists } = await import('@tauri-apps/plugin-fs')

      const dir = await appLocalDataDir()
      const configPath = await join(dir, 'metabuilder.config.json')

      let configText = ''
      const fileExists = await exists(configPath)
      if (fileExists) {
        configText = await readTextFile(configPath)
      } else {
        configText = defaultTunnelConfigTemplate
      }

      try {
        const { createClient } = await import('@/utils/supabase/client')
        const supabase = createClient()

        const { data: projectsData } = await supabase.from('projects').select('id, name, secret_token')

        setHasProjects(projectsData && projectsData.length > 0)
        setAvailableProjects(projectsData || [])

        if (projectsData && projectsData.length > 0) {
          const currentConfig = JSON.parse(configText)

          if (currentConfig && Array.isArray(currentConfig.connections)) {
            const existingProjectIds = new Set(currentConfig.connections.map((c: any) => c.projectId))

            if (currentConfig.connections.length === 1 && currentConfig.connections[0].projectId === '') {
              currentConfig.connections = []
              existingProjectIds.clear()
            }

            for (const p of projectsData) {
              if (!existingProjectIds.has(p.id)) {
                const safeName = p.name ? p.name.toLowerCase().replace(/\s+/g, '') : 'public'
                currentConfig.connections.push({
                  projectId: p.id,
                  secretToken: p.secret_token || '',
                  connectionsString: [
                    {
                      name: safeName || 'public',
                      type: 'postgres',
                      connectionString: 'postgresql://postgres:password@localhost:5432/dbname',
                    },
                  ],
                })
              }
            }
            configText = JSON.stringify(currentConfig, null, 2)
          }
        }
      } catch (err) {
        console.error('Erro ao buscar projetos para popular config:', err)
      }

      setConfigContent(configText)
    } catch (e) {
      console.error(e)
      toast('Erro ao carregar configuração.', 'error')
    }
  }

  const handleSaveConfig = async () => {
    setIsSavingConfig(true)
    try {
      const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')

      const dir = await appLocalDataDir()
      const configPath = await join(dir, 'metabuilder.config.json')

      await writeTextFile(configPath, configContent)
      toast('Configuração salva com sucesso!', 'success')
      setIsConfigModalOpen(false)
    } catch (e) {
      console.error(e)
      toast('Erro ao salvar configuração.', 'error')
    } finally {
      setIsSavingConfig(false)
    }
  }

  const checkStatus = async () => {
    try {
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core')
        const isRunning = await invoke('statuscli')
        setTunnelStatus(isRunning ? 'running' : 'stopped')
        setTunnelPid(null)
        return
      }

      const res = await fetch('/api/tunnel/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      })
      const data = await res.json()
      setTunnelStatus(data.isRunning ? 'running' : 'stopped')
      setTunnelPid(data.pid)
    } catch (e) {
      setTunnelStatus('stopped')
    }
  }

  useEffect(() => {
    const isDesktop = isTauri()
    setIsDesktopEnv(isDesktop)

    if (isDesktop) {
      checkStatus()
      const interval = setInterval(checkStatus, 5000)
      return () => clearInterval(interval)
    }
  }, [])

  const handleCloseSyncModal = async () => {
    if (syncStatus === 'running') return
    setIsSyncModalOpen(false)
    if (syncStatus === 'success') {
      try {
        const supabase = createClient()
        let query = supabase.from('projects').select('slug, workspaces!inner(slug)').eq('sync_status', 'draft_pending')

        if (workspaceSlug !== 'global') {
          const { data: workspace } = await supabase.from('workspaces').select('id').eq('slug', workspaceSlug).single()
          if (workspace) {
            query = query.eq('workspace_id', workspace.id)
          }
        }

        const { data: projects } = await query

        if (projects && projects.length > 0) {
          const wSlug = Array.isArray(projects[0].workspaces)
            ? projects[0].workspaces[0].slug
            : (projects[0].workspaces as any).slug
          setPendingResolution({
            workspaceSlug: wSlug,
            projectSlug: projects[0].slug,
          })
        }
      } catch (e) {
        console.error('Error checking sync status', e)
      }
    }
  }

  const handleSync = async () => {
    setIsSyncModalOpen(true)
    setSyncStatus('running')
    setSyncLogs(['Iniciando Sincronização Geral...'])

    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const { listen } = await import('@tauri-apps/api/event')
        const { appLocalDataDir, join } = await import('@tauri-apps/api/path')

        const dir = await appLocalDataDir()
        const configPath = await join(dir, 'metabuilder.config.json')

        const unlisten = await listen<string>('sync-log', (event) => {
          if (event.payload.includes('Node.js 18 and below are deprecated')) return
          setSyncLogs((prev) => [...prev, event.payload])
        })

        try {
          const result = await invoke<string>('runsynccli', { configPath })
          setSyncLogs((prev) => [...prev, result])
          setSyncStatus('success')
        } catch (error: any) {
          setSyncLogs((prev) => [...prev, `[FALHA] ${error}`])
          setSyncStatus('error')
        } finally {
          unlisten()
        }
      } catch (e: any) {
        setSyncLogs((prev) => [...prev, `[ERRO INTERNO] ${e.message || String(e)}`])
        setSyncStatus('error')
      }
    } else {
      try {
        const res = await fetch('/api/tunnel/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start', mode: 3 }),
        })
        const data = await res.json()
        if (data.success) {
          setSyncLogs((prev) => [...prev, data.message, 'Processo disparado na nuvem. Verifique os logs do servidor.'])
          setSyncStatus('success')
        } else {
          setSyncLogs((prev) => [...prev, `[ERRO] ${data.message}`])
          setSyncStatus('error')
        }
      } catch (e: any) {
        setSyncLogs((prev) => [...prev, `[ERRO] Falha de comunicação web: ${e.message}`])
        setSyncStatus('error')
      }
    }
  }

  const handleProcessControl = async (action: 'start' | 'stop', mode?: number) => {
    setTunnelStatus('loading')
    try {
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core')
        if (action === 'stop') {
          await invoke('stopcli')
          toast('Processo parado com sucesso', 'success')
        } else {
          const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
          const dir = await appLocalDataDir()
          const configPath = await join(dir, 'metabuilder.config.json')

          await invoke('startcli', {
            mode: mode || 1,
            configPath: configPath,
          })
          toast('Túnel iniciado com sucesso.', 'success')
        }
        checkStatus()
        return
      }

      const res = await fetch('/api/tunnel/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, mode }),
      })
      const data = await res.json()

      if (data.success) {
        toast(data.message, 'success')
      } else {
        toast(data.message || 'Erro ao comunicar com o processo.', 'error')
      }

      checkStatus()
    } catch (e) {
      toast('Falha ao executar processo CLI.', 'error')
      checkStatus()
    }
  }

  if (isDesktopEnv === false || isDesktopEnv === null) {
    return null
  }

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm mb-8">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <Network className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-neutral-800 dark:text-neutral-100">
              {t('workspace_components.tunnel_control.title', 'Gerenciador do Túnel Local')}
            </h3>
            <p className="text-sm text-neutral-500">
              {t(
                'workspace_components.tunnel_control.desc',
                'Controle o daemon central que atende às conexões de todos os seus projetos deste ambiente.'
              )}
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenConfig}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 shrink-0"
        >
          <FileJson className="w-4 h-4" />{' '}
          {t('workspace_components.tunnel_control.config_btn', 'Configurar (metabuilder.config.json)')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status e Controles Base */}
        <div className="bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 rounded-xl p-5">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest font-black text-neutral-400">
                {t('workspace_components.tunnel_control.status_title', 'Estado do Serviço (cli-win.exe)')}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className={`w-3 h-3 rounded-full ${
                    tunnelStatus === 'running'
                      ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse'
                      : tunnelStatus === 'stopped'
                      ? 'bg-red-500'
                      : 'bg-neutral-400 animate-bounce'
                  }`}
                />
                <span className="font-bold text-neutral-700 dark:text-neutral-300">
                  {tunnelStatus === 'running'
                    ? t('workspace_components.tunnel_control.status_running', 'Em Execução')
                    : tunnelStatus === 'stopped'
                    ? t('workspace_components.tunnel_control.status_stopped', 'Parado')
                    : t('workspace_components.tunnel_control.status_loading', 'Verificando...')}
                </span>
              </div>
            </div>
            {tunnelPid && (
              <div className="text-right">
                <p className="text-xs uppercase tracking-widest font-black text-neutral-400">PID</p>
                <p className="font-mono text-sm font-bold text-neutral-600 dark:text-neutral-400">{tunnelPid}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              disabled={tunnelStatus !== 'stopped'}
              onClick={() => handleProcessControl('start', 1)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${
                tunnelStatus === 'stopped'
                  ? 'bg-green-500 hover:bg-green-600 text-white shadow-md shadow-green-500/20'
                  : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
              }`}
            >
              <Play className="w-4 h-4" /> {t('workspace_components.tunnel_control.start_tunnel', 'Iniciar Túnel')}
            </button>
            <button
              disabled={tunnelStatus !== 'running'}
              onClick={() => handleProcessControl('stop')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${
                tunnelStatus === 'running'
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20'
                  : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
              }`}
            >
              <Square className="w-4 h-4" /> {t('workspace_components.tunnel_control.stop_tunnel', 'Parar Túnel')}
            </button>
          </div>
        </div>

        {/* Sincronização Global */}
        <div className="bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-sm flex items-center gap-2 text-neutral-700 dark:text-neutral-300 mb-2">
              <RefreshCw className="w-4 h-4 text-indigo-500" />{' '}
              {t('workspace_components.tunnel_control.global_sync_title', 'Sincronização Global (Introspecção)')}
            </h4>
            <p className="text-xs text-neutral-500 mb-4">
              {t(
                'workspace_components.tunnel_control.global_sync_desc',
                'Força a leitura de estrutura de todos os bancos de dados configurados no `metabuilder.config.json` ativo na máquina. Não afeta a execução do túnel.'
              )}
            </p>
          </div>
          <button
            onClick={handleSync}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />{' '}
            {t('workspace_components.tunnel_control.trigger_sync', 'Disparar Sincronização Geral')}
          </button>
        </div>
      </div>

      {/* Modal de Configuração JSON com Rnd */}
      <TunnelConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        configContent={configContent}
        setConfigContent={setConfigContent}
        onSaveConfig={handleSaveConfig}
        isSavingConfig={isSavingConfig}
        hasProjects={hasProjects}
        availableProjects={availableProjects}
      />

      {/* Modal de Sincronização */}
      <TunnelSyncConsoleModal
        isOpen={isSyncModalOpen}
        syncStatus={syncStatus}
        syncLogs={syncLogs}
        onClose={handleCloseSyncModal}
      />

      {/* Modal de Aviso de Sincronização Pendente */}
      <TunnelPendingResolutionModal
        pendingResolution={pendingResolution}
        pathname={pathname}
        onClose={() => setPendingResolution(null)}
      />
    </div>
  )
}
