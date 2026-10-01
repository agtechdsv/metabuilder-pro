'use client'

import React, { useState, useEffect } from 'react'
import { Play, Square, RefreshCw, Network, FileJson } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { isTauri } from '@/utils/tauriUtils'
import { createClient } from '@/utils/supabase/client'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/i18n'

import { defaultTunnelConfigTemplate, normalizeTunnelConfig, type ConfigScope } from './tunnel/tunnelUtils'
import { TunnelConfigModal } from './tunnel/TunnelConfigModal'
import { TunnelSyncConsoleModal } from './tunnel/TunnelSyncConsoleModal'
import { TunnelPendingResolutionModal } from './tunnel/TunnelPendingResolutionModal'
import { TunnelLogConsoleModal } from './tunnel/TunnelLogConsoleModal'

/**
 * Escopo do componente (define o que o botão "Configurar" edita e o que a Sincronização abrange):
 *  - workspaceSlug === 'global' e sem projectSlug → nível 1: global (todos os workspaces/projetos)
 *  - workspaceSlug de um workspace → nível 2: projetos deste workspace
 *  - projectSlug informado → nível 3: somente este projeto
 */
export function WorkspaceTunnelControl({ workspaceSlug, projectSlug }: { workspaceSlug: string; projectSlug?: string }) {
  const { t, language } = useI18n()
  const { toast } = useToast()
  const pathname = usePathname()

  const [tunnelStatus, setTunnelStatus] = useState<'stopped' | 'running' | 'loading'>('loading')
  const [tunnelPid, setTunnelPid] = useState<number | null>(null)
  const [isDesktopEnv, setIsDesktopEnv] = useState<boolean | null>(null)

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
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

  const [configScope, setConfigScope] = useState<ConfigScope>({ type: 'global' })

  const scopeType: ConfigScope['type'] = projectSlug ? 'project' : workspaceSlug === 'global' ? 'global' : 'workspace'

  /** Resolve o escopo atual e os projetos que ele abrange (para a modal e para a sincronização). */
  const loadScope = async (): Promise<{ scope: ConfigScope; projects: any[] }> => {
    const supabase = createClient()
    const cols = 'id, name, slug, secret_token, workspace_id'

    if (workspaceSlug === 'global' && !projectSlug) {
      const { data } = await supabase.from('projects').select(cols)
      return { scope: { type: 'global' }, projects: data || [] }
    }

    const { data: ws } = await supabase.from('workspaces').select('id, name').eq('slug', workspaceSlug).single()
    let query = supabase.from('projects').select(cols)
    if (ws) query = query.eq('workspace_id', ws.id)
    if (projectSlug) query = query.eq('slug', projectSlug)
    const { data } = await query
    const projects = data || []

    if (projectSlug) {
      const p = projects[0]
      return {
        scope: {
          type: 'project',
          workspaceId: ws?.id,
          workspaceName: ws?.name,
          projectId: p?.id,
          projectName: p?.name,
          secretToken: p?.secret_token || '',
        },
        projects,
      }
    }
    return { scope: { type: 'workspace', workspaceId: ws?.id, workspaceName: ws?.name }, projects }
  }

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
        const { scope, projects: projectsData } = await loadScope()
        setConfigScope(scope)
        setHasProjects(projectsData.length > 0)
        setAvailableProjects(projectsData)

        // Formato em cascata: migra ldap/downloadPath antigos da raiz para "defaults" e garante uma entrada por projeto.
        // As entradas novas NÃO levam string de conexão de exemplo: sem string própria o projeto herda do workspace/global.
        const currentConfig = normalizeTunnelConfig(JSON.parse(configText))
        currentConfig.connections = currentConfig.connections.filter(
          (c: any) => c.projectId || c.connectionsString?.length || c.connectionString
        )
        for (const p of projectsData) {
          const existing = currentConfig.connections.find((c: any) => c.projectId === p.id)
          if (!existing) {
            currentConfig.connections.push({
              projectId: p.id,
              workspaceId: p.workspace_id,
              secretToken: p.secret_token || '',
            })
          } else {
            if (!existing.workspaceId) existing.workspaceId = p.workspace_id
            if (!existing.secretToken && p.secret_token) existing.secretToken = p.secret_token
          }
        }
        // Mantém o nome do workspace no arquivo para facilitar a leitura do JSON
        if (scope.type !== 'global' && scope.workspaceId) {
          const wsEntry = currentConfig.workspaces.find((w: any) => w?.workspaceId === scope.workspaceId)
          if (wsEntry && scope.workspaceName) wsEntry.name = scope.workspaceName
        }
        configText = JSON.stringify(currentConfig, null, 2)
      } catch (dbErr) {
        console.warn('Falha ao preparar o config (projetos/escopo):', dbErr)
      }

      setConfigContent(configText)
    } catch (e: any) {
      toast(t('workspace_components.tunnel_control.config_load_error', 'Erro ao carregar configuração.') + (e?.message ? ` ${e.message}` : ''), 'error')
    }
  }

  const handleSaveConfig = async () => {
    setIsSavingConfig(true)
    try {
      JSON.parse(configContent)

      const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
      const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs')

      const dir = await appLocalDataDir()
      if (!(await exists(dir))) {
        await mkdir(dir, { recursive: true })
      }

      const configPath = await join(dir, 'metabuilder.config.json')
      await writeTextFile(configPath, configContent)

      toast(t('workspace_components.tunnel_control.config_save_success', 'Configuração salva com sucesso!'), 'success')
      setIsConfigModalOpen(false)
    } catch (e: any) {
      toast(t('workspace_components.tunnel_control.config_save_error', 'Erro ao salvar configuração.') + (e?.message ? `: ${e.message}` : ''), 'error')
    } finally {
      setIsSavingConfig(false)
    }
  }

  const checkStatus = async () => {
    try {
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core')
        const isRunning = await invoke<boolean>('statuscli')
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

    checkStatus()

    let bc: BroadcastChannel | null = null
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('metabuilder-tunnel-sync')
      bc.onmessage = (event) => {
        if (event.data?.type === 'STATUS_CHANGE') {
          setTunnelStatus(event.data.status)
        }
      }
    }

    if (isDesktop) {
      const interval = setInterval(checkStatus, 5000)
      return () => {
        if (bc) bc.close()
        clearInterval(interval)
      }
    }

    return () => {
      if (bc) bc.close()
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
    setSyncLogs([t('workspace_components.tunnel_control.sync_starting', 'Iniciando Sincronização Geral...')])

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
          // Escopo da sincronização: global = todos; workspace = projetos do workspace; projeto = somente ele
          let scopedProjectIds: string[] | undefined
          if (scopeType !== 'global') {
            const { projects } = await loadScope()
            scopedProjectIds = projects.map((p: any) => p.id)
            setSyncLogs((prev) => [
              ...prev,
              t('workspace_components.tunnel_control.sync_scope_log', 'Escopo: {n} projeto(s).').replace('{n}', String(scopedProjectIds!.length)),
            ])
          }
          const result = await invoke<string>('runsynccli', { configPath, lang: language, projects: scopedProjectIds })
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
          body: JSON.stringify({ action: 'start', mode: 3, lang: language }),
        })
        const data = await res.json()
        if (data.success) {
          setSyncLogs((prev) => [
            ...prev,
            data.message,
            t('workspace_components.tunnel_control.sync_web_cloud', 'Processo disparado na nuvem. Verifique os logs do servidor.')
          ])
          setSyncStatus('success')
        } else {
          setSyncLogs((prev) => [...prev, `[ERRO] ${data.message}`])
          setSyncStatus('error')
        }
      } catch (e: any) {
        setSyncLogs((prev) => [
          ...prev,
          `[ERRO] ${t('workspace_components.tunnel_control.sync_web_comm_error', 'Falha de comunicação web:')} ${e.message}`
        ])
        setSyncStatus('error')
      }
    }
  }

  const broadcastTunnelStatus = (status: 'stopped' | 'running') => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('metabuilder-tunnel-sync')
        bc.postMessage({ type: 'STATUS_CHANGE', status })
        bc.close()
      } catch (_) {}
    }
  }

  const handleProcessControl = async (action: 'start' | 'stop', mode?: number) => {
    setTunnelStatus('loading')
    try {
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core')
        if (action === 'stop') {
          await invoke('stopcli')
          toast(t('workspace_components.tunnel_control.process_stopped_success', 'Processo parado com sucesso'), 'success')
          broadcastTunnelStatus('stopped')
        } else {
          const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
          const dir = await appLocalDataDir()
          const configPath = await join(dir, 'metabuilder.config.json')

          await invoke('startcli', {
            mode: mode || 1,
            configPath: configPath,
            lang: language,
          })
          toast(t('workspace_components.tunnel_control.tunnel_started_success', 'Túnel iniciado com sucesso.'), 'success')
          broadcastTunnelStatus('running')
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
        if (action === 'start') {
          toast(t('workspace_components.tunnel_control.tunnel_started_success', 'Túnel iniciado com sucesso.'), 'success')
          broadcastTunnelStatus('running')
        } else if (action === 'stop') {
          toast(t('workspace_components.tunnel_control.tunnel_stopped_success', 'Túnel parado com sucesso'), 'success')
          broadcastTunnelStatus('stopped')
        } else {
          toast(data.message, 'success')
        }
      } else {
        toast(data.message || t('workspace_components.tunnel_control.process_comm_error', 'Erro ao comunicar com o processo.'), 'error')
      }

      checkStatus()
    } catch (e) {
      toast(t('workspace_components.tunnel_control.cli_process_failed', 'Falha ao executar processo CLI.'), 'error')
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
            <button
              onClick={async () => {
                if (isTauri()) {
                  try {
                    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
                    const existing = await WebviewWindow.getByLabel('tunnel-logs')
                    if (existing) {
                      await existing.unminimize().catch(() => {})
                      await existing.show().catch(() => {})
                      await existing.setFocus().catch(() => {})
                      return
                    }

                    const logWindow = new WebviewWindow('tunnel-logs', {
                      url: '/tunnel-logs',
                      title: 'Tunnel Logs - MetaBuilder PRO',
                      width: 900,
                      height: 600,
                      center: true,
                      decorations: true,
                    })
                    logWindow.once('tauri://error', async (e) => {
                      console.error('Error creating log window', e)
                      const w = await WebviewWindow.getByLabel('tunnel-logs')
                      if (w) {
                        await w.unminimize().catch(() => {})
                        await w.show().catch(() => {})
                        await w.setFocus().catch(() => {})
                      } else {
                        setIsLogModalOpen(true)
                      }
                    })
                  } catch (e) {
                    setIsLogModalOpen(true)
                  }
                } else {
                  setIsLogModalOpen(true)
                }
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 shrink-0"
              title={t('workspace_components.tunnel_control.view_tunnel_logs', 'Ver Logs do Túnel')}
            >
              {t('workspace_components.tunnel_control.logs_btn', 'Logs')}
            </button>
          </div>
        </div>

        {/* Sincronização Global */}
        <div className="bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-sm flex items-center gap-2 text-neutral-700 dark:text-neutral-300 mb-2">
              <RefreshCw className="w-4 h-4 text-indigo-500" />{' '}
              {scopeType === 'project'
                ? t('workspace_components.tunnel_control.sync_title_project', 'Sincronização deste Projeto (Introspecção)')
                : scopeType === 'workspace'
                  ? t('workspace_components.tunnel_control.sync_title_workspace', 'Sincronização do Workspace (Introspecção)')
                  : t('workspace_components.tunnel_control.global_sync_title', 'Sincronização Global (Introspecção)')}
            </h4>
            <p className="text-xs text-neutral-500 mb-4">
              {scopeType === 'project'
                ? t('workspace_components.tunnel_control.sync_desc_project', 'Força a leitura da estrutura do banco de dados somente deste projeto. Não afeta a execução do túnel.')
                : scopeType === 'workspace'
                  ? t('workspace_components.tunnel_control.sync_desc_workspace', 'Força a leitura da estrutura dos bancos de dados dos projetos deste workspace. Não afeta a execução do túnel.')
                  : t(
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
            {scopeType === 'project'
              ? t('workspace_components.tunnel_control.trigger_sync_project', 'Sincronizar este Projeto')
              : scopeType === 'workspace'
                ? t('workspace_components.tunnel_control.trigger_sync_workspace', 'Sincronizar o Workspace')
                : t('workspace_components.tunnel_control.trigger_sync', 'Disparar Sincronização Geral')}
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
        scope={configScope}
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

      {/* Modal de Logs do Túnel */}
      <TunnelLogConsoleModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
      />
    </div>
  )
}
