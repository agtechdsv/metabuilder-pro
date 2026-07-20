'use client'

import React, { useState, useEffect } from 'react'
import { Settings, Play, Square, RefreshCw, AlertCircle, Network, FileJson, Save, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { isTauri } from '@/utils/tauriUtils'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import Editor from '@monaco-editor/react'
import { Rnd } from 'react-rnd'
import { createClient } from '@/utils/supabase/client'
import { usePathname } from 'next/navigation'

export function WorkspaceTunnelControl({ workspaceSlug }: { workspaceSlug: string }) {
  const { toast } = useToast()
  const pathname = usePathname()
  
  const [tunnelStatus, setTunnelStatus] = useState<'stopped' | 'running' | 'loading'>('loading')
  const [tunnelPid, setTunnelPid] = useState<number | null>(null)
  const [isDesktopEnv, setIsDesktopEnv] = useState<boolean | null>(null)

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [configContent, setConfigContent] = useState('')
  const [isSavingConfig, setIsSavingConfig] = useState(false)

  const defaultTemplate = `{
  "connections": [
    {
      "projectId": "",
      "secretToken": "",
      "connectionsString": [
        {
          "name": "public",
          "type": "postgres",
          "connectionString": "postgresql://postgres:password@localhost:5432/dbname"
        }
      ]
    }
  ],
  "ldap": {
    "enabled": false,
    "url": "ldap://10.0.0.15:389",
    "baseDn": "dc=empresa,dc=local",
    "bindDn": "cn=metabuilder_service,ou=Services,dc=empresa,dc=local",
    "bindPassword": "senha_secreta_do_bind",
    "searchFilter": "(sAMAccountName={{username}})"
  },
  "downloadPath": "C:\\\\AgTech\\\\DownloadsMetaBuilder"
}`

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
        configText = defaultTemplate
      }

      try {
        const { createClient } = await import('@/utils/supabase/client')
        const supabase = createClient()
        
        const { data: projectsData } = await supabase.from('projects').select('id, name, secret_token')

        if (projectsData && projectsData.length > 0) {
          let currentConfig = JSON.parse(configText)
          
          if (currentConfig && Array.isArray(currentConfig.connections)) {
            const existingProjectIds = new Set(currentConfig.connections.map((c: any) => c.projectId))
            
            // Remove o template vazio se for o único item
            if (currentConfig.connections.length === 1 && currentConfig.connections[0].projectId === "") {
              currentConfig.connections = []
              existingProjectIds.clear()
            }

            for (const p of projectsData) {
              if (!existingProjectIds.has(p.id)) {
                const safeName = p.name ? p.name.toLowerCase().replace(/\s+/g, '') : "public"
                currentConfig.connections.push({
                  projectId: p.id,
                  secretToken: p.secret_token || "",
                  connectionsString: [
                    {
                      name: safeName || "public",
                      type: "postgres",
                      connectionString: "postgresql://postgres:password@localhost:5432/dbname"
                    }
                  ]
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
        const { invoke } = await import('@tauri-apps/api/core');
        const isRunning = await invoke('statuscli');
        setTunnelStatus(isRunning ? 'running' : 'stopped');
        setTunnelPid(null);
        return;
      }

      const res = await fetch('/api/tunnel/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' })
      })
      const data = await res.json()
      setTunnelStatus(data.isRunning ? 'running' : 'stopped')
      setTunnelPid(data.pid)
    } catch (e) {
      setTunnelStatus('stopped')
    }
  }

  useEffect(() => {
    const isDesktop = isTauri();
    setIsDesktopEnv(isDesktop);

    if (isDesktop) {
      checkStatus()
      
      // Poll status every 5 seconds
      const interval = setInterval(checkStatus, 5000)
      return () => clearInterval(interval)
    }
  }, [])

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [syncLogs, setSyncLogs] = useState<string[]>([])
  const [syncError, setSyncError] = useState<string | null>(null)
  const [pendingResolutionProject, setPendingResolutionProject] = useState<string | null>(null)

  const handleCloseSyncModal = async () => {
    if (syncStatus === 'running') return
    setIsSyncModalOpen(false)
    if (syncStatus === 'success') {
      try {
        const supabase = createClient()
        const { data: workspace } = await supabase.from('workspaces').select('id').eq('slug', workspaceSlug).single()
        if (workspace) {
          const { data: projects } = await supabase.from('projects')
            .select('slug')
            .eq('workspace_id', workspace.id)
            .eq('sync_status', 'draft_pending')
          
          if (projects && projects.length > 0) {
            setPendingResolutionProject(projects[0].slug)
          }
        }
      } catch (e) {
        console.error('Error checking sync status', e)
      }
    }
  }
  
  const logsEndRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [syncLogs])

  const handleSync = async () => {
    setIsSyncModalOpen(true)
    setSyncStatus('running')
    setSyncLogs(['Iniciando Sincronização Geral...'])
    setSyncError(null)

    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const { listen } = await import('@tauri-apps/api/event')
        const { appLocalDataDir, join } = await import('@tauri-apps/api/path')

        const dir = await appLocalDataDir()
        const configPath = await join(dir, 'metabuilder.config.json')

        const unlisten = await listen<string>('sync-log', (event) => {
          if (event.payload.includes('Node.js 18 and below are deprecated')) return;
          setSyncLogs(prev => [...prev, event.payload])
        })

        try {
          const result = await invoke<string>('runsynccli', { configPath })
          setSyncLogs(prev => [...prev, result])
          setSyncStatus('success')
        } catch (error: any) {
          setSyncLogs(prev => [...prev, `[FALHA] ${error}`])
          setSyncError(String(error))
          setSyncStatus('error')
        } finally {
          unlisten()
        }
      } catch (e: any) {
        setSyncLogs(prev => [...prev, `[ERRO INTERNO] ${e.message || String(e)}`])
        setSyncStatus('error')
        setSyncError(String(e))
      }
    } else {
      // Fallback para Web (não aplicável se o card inteiro não renderiza na web, mas deixamos por segurança)
      try {
        const res = await fetch('/api/tunnel/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start', mode: 3 })
        })
        const data = await res.json()
        if (data.success) {
          setSyncLogs(prev => [...prev, data.message, 'Processo disparado na nuvem. Verifique os logs do servidor.'])
          setSyncStatus('success')
        } else {
          setSyncLogs(prev => [...prev, `[ERRO] ${data.message}`])
          setSyncStatus('error')
          setSyncError(data.message)
        }
      } catch (e: any) {
        setSyncLogs(prev => [...prev, `[ERRO] Falha de comunicação web: ${e.message}`])
        setSyncStatus('error')
        setSyncError(String(e))
      }
    }
  }

  const handleProcessControl = async (action: 'start' | 'stop', mode?: number) => {
    setTunnelStatus('loading')
    try {
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core');
        if (action === 'stop') {
          await invoke('stopcli');
          toast('Processo parado com sucesso', 'success');
        } else {
          const { appLocalDataDir, join } = await import('@tauri-apps/api/path');
          const dir = await appLocalDataDir();
          const configPath = await join(dir, 'metabuilder.config.json');
          
          await invoke('startcli', { 
            mode: (mode || 1), 
            configPath: configPath 
          });
          toast('Túnel iniciado com sucesso.', 'success');
        }
        checkStatus();
        return;
      }

      const res = await fetch('/api/tunnel/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, mode })
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
    return null; // Oculta o card se não for ambiente Desktop IDE ou se estiver carregando a verificação
  }

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
          <Network className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-neutral-800 dark:text-neutral-100">Gerenciador do Túnel Local</h3>
          <p className="text-sm text-neutral-500">Controle o daemon central que atende às conexões de todos os seus projetos deste ambiente.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Status e Controles Base */}
        <div className="bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 rounded-xl p-5">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest font-black text-neutral-400">Estado do Serviço (cli-win.exe)</p>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-3 h-3 rounded-full ${tunnelStatus === 'running' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse' : tunnelStatus === 'stopped' ? 'bg-red-500' : 'bg-neutral-400 animate-bounce'}`} />
                <span className="font-bold text-neutral-700 dark:text-neutral-300">
                  {tunnelStatus === 'running' ? 'Ativo e Rodando' : tunnelStatus === 'stopped' ? 'Parado' : 'Carregando...'}
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
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${tunnelStatus === 'stopped' ? 'bg-green-500 hover:bg-green-600 text-white shadow-md shadow-green-500/20' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'}`}
            >
              <Play className="w-4 h-4" /> Iniciar Túnel
            </button>
            <button 
              disabled={tunnelStatus !== 'running'}
              onClick={() => handleProcessControl('stop')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${tunnelStatus === 'running' ? 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'}`}
            >
              <Square className="w-4 h-4" /> Parar Túnel
            </button>
          </div>
          
          <div className="mt-3">
            <button
              onClick={handleOpenConfig}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20"
            >
              <FileJson className="w-4 h-4" /> Configurar (metabuilder.config.json)
            </button>
          </div>
        </div>

        {/* Sincronização Global */}
        <div className="bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-sm flex items-center gap-2 text-neutral-700 dark:text-neutral-300 mb-2">
              <RefreshCw className="w-4 h-4 text-indigo-500" /> Sincronização Global (Introspecção)
            </h4>
            <p className="text-xs text-neutral-500 mb-4">
              Força a leitura de estrutura de todos os bancos de dados configurados no `metabuilder.config.json` ativo na máquina. Não afeta a execução do túnel.
            </p>
          </div>
          <button 
            onClick={handleSync}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Disparar Sincronização Geral
          </button>
        </div>

      </div>

      {/* Modal de Configuração JSON com Rnd */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto transition-opacity" 
            onClick={() => setIsConfigModalOpen(false)} 
          />
          <Rnd
            default={{
              x: (typeof window !== 'undefined' ? window.innerWidth - 800 : 0) / 2,
              y: (typeof window !== 'undefined' ? window.innerHeight - 600 : 0) / 2,
              width: 800,
              height: 600,
            }}
            minWidth={400}
            minHeight={300}
            bounds="window"
            dragHandleClassName="drag-handle"
            className="pointer-events-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300"
          >
            <div className="flex flex-col w-full h-full">
              <div className="drag-handle p-5 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center cursor-move shrink-0 bg-white dark:bg-neutral-900">
                <div className="space-y-1">
                  <h3 className="font-bold text-xl text-neutral-900 dark:text-white">Editar metabuilder.config.json</h3>
                  <p className="text-xs text-neutral-500 font-normal">
                    Esta configuração será salva diretamente no AppData Local da IDE e será usada no próximo Início ou Sincronização.
                  </p>
                </div>
                <button 
                  onClick={() => setIsConfigModalOpen(false)} 
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-neutral-500 hover:text-neutral-900 dark:hover:text-white shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 min-h-0 w-full bg-[#1e1e1e] border-y border-neutral-200 dark:border-neutral-800 relative">
                <Editor
                  height="100%"
                  defaultLanguage="json"
                  value={configContent}
                  onChange={(value) => setConfigContent(value || '')}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    formatOnPaste: true,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              </div>
              
              <div className="p-4 bg-white dark:bg-neutral-900 flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={isSavingConfig}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all disabled:opacity-50"
                >
                  {isSavingConfig ? 'Salvando...' : (
                    <>
                      <Save className="w-4 h-4" /> Salvar Configuração
                    </>
                  )}
                </button>
              </div>
            </div>
          </Rnd>
        </div>
      )}

      {/* Modal de Sincronização */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto transition-opacity" 
            onClick={handleCloseSyncModal} 
          />
          <div className="pointer-events-auto w-full max-w-4xl max-h-[80vh] bg-[#0c0c0c] border border-neutral-800 rounded-[1.5rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 relative">
            <div className="p-5 border-b border-neutral-800 flex justify-between items-center bg-[#111]">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${syncStatus === 'running' ? 'bg-indigo-500 animate-pulse' : syncStatus === 'success' ? 'bg-green-500' : syncStatus === 'error' ? 'bg-red-500' : 'bg-neutral-500'}`} />
                <div>
                  <h3 className="font-bold text-lg text-white">Console de Sincronização</h3>
                  <p className="text-xs text-neutral-400 font-mono">cli-win.exe --action=sync</p>
                </div>
              </div>
              <button 
                onClick={handleCloseSyncModal} 
                disabled={syncStatus === 'running'}
                className="p-2 hover:bg-neutral-800 rounded-xl transition-colors text-neutral-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 p-4 font-mono text-xs overflow-y-auto bg-[#0c0c0c] min-h-[300px]">
              {syncLogs.map((log, i) => (
                <div key={i} className={`mb-1 ${log.includes('ERROR') || log.includes('ERRO') || log.includes('FALHA') ? 'text-red-400' : log.includes('sucesso') ? 'text-green-400' : 'text-neutral-300'}`}>
                  <span className="text-neutral-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
                  {log}
                </div>
              ))}
              {syncStatus === 'running' && (
                <div className="text-indigo-400 animate-pulse mt-4">Processando...</div>
              )}
              <div ref={logsEndRef} />
            </div>
            
            {syncStatus !== 'running' && (
              <div className={`p-4 border-t border-neutral-800 flex justify-between items-center ${syncStatus === 'success' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                <div className="flex items-center gap-2">
                  {syncStatus === 'success' ? (
                    <span className="font-bold text-sm text-green-500">✓ Sincronização concluída com sucesso!</span>
                  ) : (
                    <span className="font-bold text-sm text-red-500">⚠ Falha na sincronização. Verifique os logs acima.</span>
                  )}
                </div>
                <button
                  onClick={handleCloseSyncModal}
                  className="px-6 py-2 rounded-xl font-bold text-sm bg-white text-black hover:bg-neutral-200 transition-colors"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Aviso de Sincronização Pendente */}
      {pendingResolutionProject && (
        <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={() => setPendingResolutionProject(null)} />
          <div className="pointer-events-auto w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Sincronização Pendente</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
              Foram detectadas alterações estruturais nos metadados que dependem da sua revisão. Deseja mapear essas alterações e finalizar a sincronização agora?
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setPendingResolutionProject(null)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Agora não
              </button>
              <Link 
                href={`/admin/${workspaceSlug}/${pendingResolutionProject}/sync-resolution?returnUrl=${encodeURIComponent(pathname)}`}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
              >
                Sim, revisar agora
              </Link>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
