'use client'

import React, { useState, useEffect } from 'react'
import { Settings, Play, Square, RefreshCw, AlertCircle, Network, FileJson, Save, X, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { isTauri } from '@/utils/tauriUtils'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import Editor from '@monaco-editor/react'
import { Rnd } from 'react-rnd'
import { createClient } from '@/utils/supabase/client'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'

function parseConnString(type: string, str: string) {
  let user = '', pass = '', host = '', port = '', db = '';
  if (!str) return { user, pass, host, port, db };

  try {
    let withoutProtocol = str;
    const protoIndex = str.indexOf('://');
    if (protoIndex !== -1) {
      withoutProtocol = str.substring(protoIndex + 3);
    }

    const atIndex = withoutProtocol.lastIndexOf('@');
    let authPart = '';
    let hostPathPart = withoutProtocol;
    
    if (atIndex !== -1) {
      authPart = withoutProtocol.substring(0, atIndex);
      hostPathPart = withoutProtocol.substring(atIndex + 1);
      
      const colonAuthIndex = authPart.indexOf(':');
      if (colonAuthIndex !== -1) {
        user = decodeURIComponent(authPart.substring(0, colonAuthIndex));
        pass = decodeURIComponent(authPart.substring(colonAuthIndex + 1));
      } else {
        user = decodeURIComponent(authPart);
      }
    }

    const slashIndex = hostPathPart.indexOf('/');
    let hostPortPart = hostPathPart;
    if (slashIndex !== -1) {
      hostPortPart = hostPathPart.substring(0, slashIndex);
      db = decodeURIComponent(hostPathPart.substring(slashIndex + 1));
    }

    const colonHostIndex = hostPortPart.indexOf(':');
    if (colonHostIndex !== -1) {
      host = hostPortPart.substring(0, colonHostIndex);
      port = hostPortPart.substring(colonHostIndex + 1);
    } else {
      host = hostPortPart;
    }
  } catch (e) {
    console.error("Error parsing conn string", e);
  }

  return { user, pass, host, port, db };
}

function buildConnString(type: string, parsed: {user: string, pass: string, host: string, port: string, db: string}) {
  const protocol = type === 'postgres' ? 'postgresql' : type || 'postgresql';
  const u = encodeURIComponent(parsed.user);
  const p = encodeURIComponent(parsed.pass);
  const auth = (u || p) ? `${u}:${p}@` : '';
  const port = parsed.port ? `:${parsed.port}` : '';
  const db = parsed.db ? `/${encodeURIComponent(parsed.db)}` : '';
  return `${protocol}://${auth}${parsed.host}${port}${db}`;
}

export function WorkspaceTunnelControl({ workspaceSlug }: { workspaceSlug: string }) {
  const { toast } = useToast()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const [tunnelStatus, setTunnelStatus] = useState<'stopped' | 'running' | 'loading'>('loading')
  const [tunnelPid, setTunnelPid] = useState<number | null>(null)
  const [isDesktopEnv, setIsDesktopEnv] = useState<boolean | null>(null)

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [configContent, setConfigContent] = useState('')
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [hasProjects, setHasProjects] = useState<boolean | null>(null)

  const [activeConfigTab, setActiveConfigTab] = useState<'form' | 'json'>('form')
  const [availableProjects, setAvailableProjects] = useState<any[]>([])

  const parsedConfig = React.useMemo(() => {
    try {
      return JSON.parse(configContent)
    } catch {
      return null
    }
  }, [configContent])

  const updateParsedConfig = (newConfig: any) => {
    setConfigContent(JSON.stringify(newConfig, null, 2))
  }

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
        
        setHasProjects(projectsData && projectsData.length > 0)
        setAvailableProjects(projectsData || [])

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
  const [pendingResolution, setPendingResolution] = useState<{workspaceSlug: string, projectSlug: string} | null>(null)

  const handleCloseSyncModal = async () => {
    if (syncStatus === 'running') return
    setIsSyncModalOpen(false)
    if (syncStatus === 'success') {
      try {
        const supabase = createClient()
        let query = supabase.from('projects')
          .select('slug, workspaces!inner(slug)')
          .eq('sync_status', 'draft_pending')
        
        if (workspaceSlug !== 'global') {
          const { data: workspace } = await supabase.from('workspaces').select('id').eq('slug', workspaceSlug).single()
          if (workspace) {
            query = query.eq('workspace_id', workspace.id)
          }
        }

        const { data: projects } = await query
        
        if (projects && projects.length > 0) {
          const wSlug = Array.isArray(projects[0].workspaces) ? projects[0].workspaces[0].slug : (projects[0].workspaces as any).slug
          setPendingResolution({
            workspaceSlug: wSlug,
            projectSlug: projects[0].slug
          })
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
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <Network className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-neutral-800 dark:text-neutral-100">Gerenciador do Túnel Local</h3>
            <p className="text-sm text-neutral-500">Controle o daemon central que atende às conexões de todos os seus projetos deste ambiente.</p>
          </div>
        </div>
        <button
          onClick={handleOpenConfig}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 shrink-0"
        >
          <FileJson className="w-4 h-4" /> Configurar (metabuilder.config.json)
        </button>
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
                <div className="space-y-3 w-full">
                  <div>
                    <h3 className="font-bold text-xl text-neutral-900 dark:text-white">Editar metabuilder.config.json</h3>
                    <p className="text-xs text-neutral-500 font-normal">
                      Esta configuração será salva diretamente no AppData Local da IDE e será usada no próximo Início ou Sincronização.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                       className={`text-sm font-bold px-4 py-1.5 rounded-lg transition-colors ${activeConfigTab === 'form' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
                       onClick={(e) => { e.stopPropagation(); setActiveConfigTab('form'); }}
                    >
                       Formulário
                    </button>
                    <button 
                       className={`text-sm font-bold px-4 py-1.5 rounded-lg transition-colors ${activeConfigTab === 'json' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
                       onClick={(e) => { e.stopPropagation(); setActiveConfigTab('json'); }}
                    >
                       Editor JSON
                    </button>
                  </div>
                </div>
                <button 
                  onClick={() => setIsConfigModalOpen(false)} 
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-neutral-500 hover:text-neutral-900 dark:hover:text-white shrink-0 self-start ml-4"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 min-h-0 w-full bg-white dark:bg-[#1e1e1e] border-y border-neutral-200 dark:border-neutral-800 relative overflow-hidden flex flex-col">
                {activeConfigTab === 'json' && (
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
                )}
                {activeConfigTab === 'form' && (
                  !parsedConfig ? (
                    <div className="p-8 text-center flex flex-col items-center justify-center h-full text-red-500">
                      <AlertTriangle className="w-12 h-12 mb-4 opacity-50" />
                      <h4 className="font-bold text-lg mb-2">JSON Inválido</h4>
                      <p className="text-sm opacity-80">Não foi possível processar o arquivo de configuração atual.<br/>Corrija-o na aba "Editor JSON" para usar o formulário.</p>
                    </div>
                  ) : (
                    <div className="p-6 overflow-y-auto h-full space-y-8 bg-neutral-50 dark:bg-neutral-900/50">
                      {/* Projetos / Conexões */}
                      <div>
                        <h4 className="font-bold text-lg text-neutral-800 dark:text-neutral-200 mb-4 flex items-center gap-2">
                          <Network className="w-5 h-5 text-indigo-500" /> Projetos
                        </h4>
                        
                        {parsedConfig.connections?.map((projConfig: any, originalIdx: number) => {
                          const isRelated = !projConfig.projectId || availableProjects.some(p => p.id === projConfig.projectId);
                          if (!isRelated) return null;
                          return (
                          <div key={originalIdx} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 rounded-2xl mb-4 shadow-sm">
                            <div className="flex gap-4 items-end mb-4">
                                <div className="flex-1">
                                  <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">Selecionar Projeto Existente</label>
                                  <select 
                                    className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 font-medium outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    value={projConfig.projectId || ''}
                                    onChange={(e) => {
                                      const newProjectId = e.target.value;
                                      const project = availableProjects.find(p => p.id === newProjectId);
                                      const newConfig = {...parsedConfig};
                                      newConfig.connections[originalIdx].projectId = newProjectId;
                                      if (project) {
                                          newConfig.connections[originalIdx].secretToken = project.secret_token || '';
                                      }
                                      updateParsedConfig(newConfig);
                                    }}
                                  >
                                      <option value="">Selecione um projeto para preencher os IDs...</option>
                                      {availableProjects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                      ))}
                                  </select>
                                </div>
                                <button 
                                  onClick={() => {
                                      const newConfig = {...parsedConfig};
                                      newConfig.connections.splice(originalIdx, 1);
                                      updateParsedConfig(newConfig);
                                  }}
                                  className="p-2.5 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                                  title="Remover Projeto"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div>
                                  <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">Project ID</label>
                                  <input 
                                    readOnly
                                    value={projConfig.projectId || ''} 
                                    className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 font-mono text-neutral-500 dark:text-neutral-500 outline-none cursor-not-allowed" 
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">Secret Token</label>
                                  <input 
                                    readOnly
                                    value={projConfig.secretToken || ''} 
                                    className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 font-mono text-neutral-500 dark:text-neutral-500 outline-none cursor-not-allowed" 
                                  />
                                </div>
                            </div>

                            <div className="pl-4 border-l-2 border-indigo-100 dark:border-indigo-500/20">
                                <h5 className="font-bold text-sm text-neutral-700 dark:text-neutral-300 mb-3">Strings de Conexão</h5>
                                {projConfig.connectionsString?.map((connStr: any, connIdx: number) => {
                                  const parsedStr = parseConnString(connStr.type || 'postgres', connStr.connectionString || '');
                                  
                                  const handlePartChange = (field: keyof typeof parsedStr, val: string) => {
                                    const newParsed = { ...parsedStr, [field]: val };
                                    const newStr = buildConnString(connStr.type || 'postgres', newParsed);
                                    const newConfig = {...parsedConfig};
                                    newConfig.connections[originalIdx].connectionsString[connIdx].connectionString = newStr;
                                    updateParsedConfig(newConfig);
                                  };

                                  return (
                                  <div key={connIdx} className="bg-neutral-50 dark:bg-neutral-800/30 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800 mb-3 relative">
                                      <button 
                                        onClick={() => {
                                            const newConfig = {...parsedConfig};
                                            newConfig.connections[originalIdx].connectionsString.splice(connIdx, 1);
                                            updateParsedConfig(newConfig);
                                        }}
                                        className="absolute top-4 right-4 p-1.5 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                      
                                      <div className="grid grid-cols-2 gap-3 pr-10 mb-4">
                                        <div>
                                          <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Nome</label>
                                          <input 
                                            value={connStr.name || ''} 
                                            onChange={(e) => {
                                              const newConfig = {...parsedConfig};
                                              newConfig.connections[originalIdx].connectionsString[connIdx].name = e.target.value;
                                              updateParsedConfig(newConfig);
                                            }}
                                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm p-2 outline-none focus:border-indigo-500" 
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Tipo</label>
                                          <select 
                                            value={connStr.type || ''} 
                                            onChange={(e) => {
                                              const newConfig = {...parsedConfig};
                                              newConfig.connections[originalIdx].connectionsString[connIdx].type = e.target.value;
                                              const newStr = buildConnString(e.target.value, parsedStr);
                                              newConfig.connections[originalIdx].connectionsString[connIdx].connectionString = newStr;
                                              updateParsedConfig(newConfig);
                                            }}
                                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm p-2 outline-none focus:border-indigo-500"
                                          >
                                            <option value="postgres">Postgres</option>
                                            <option value="mysql">MySQL</option>
                                            <option value="oracle">Oracle</option>
                                            <option value="sqlserver">SQL Server</option>
                                          </select>
                                        </div>
                                      </div>
                                      
                                      <div className="grid grid-cols-5 gap-3">
                                        <div className="col-span-1">
                                          <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Usuário</label>
                                          <input value={parsedStr.user} onChange={e => handlePartChange('user', e.target.value)} className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm p-2 outline-none focus:border-indigo-500" />
                                        </div>
                                        <div className="col-span-1">
                                          <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Senha</label>
                                          <input type="password" value={parsedStr.pass} onChange={e => handlePartChange('pass', e.target.value)} className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm p-2 outline-none focus:border-indigo-500" />
                                        </div>
                                        <div className="col-span-1">
                                          <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Host/IP</label>
                                          <input value={parsedStr.host} onChange={e => handlePartChange('host', e.target.value)} className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm p-2 outline-none focus:border-indigo-500" />
                                        </div>
                                        <div className="col-span-1">
                                          <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Porta</label>
                                          <input value={parsedStr.port} onChange={e => handlePartChange('port', e.target.value)} className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm p-2 outline-none focus:border-indigo-500" />
                                        </div>
                                        <div className="col-span-1">
                                          <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Database/SID</label>
                                          <input value={parsedStr.db} onChange={e => handlePartChange('db', e.target.value)} className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm p-2 outline-none focus:border-indigo-500" />
                                        </div>
                                      </div>
                                  </div>
                                  );
                                })}
                                <button 
                                  onClick={() => {
                                      const newConfig = {...parsedConfig};
                                      if (!newConfig.connections[originalIdx].connectionsString) newConfig.connections[originalIdx].connectionsString = [];
                                      newConfig.connections[originalIdx].connectionsString.push({ name: '', type: 'postgres', connectionString: '' });
                                      updateParsedConfig(newConfig);
                                  }}
                                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mt-2 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-lg transition-colors w-fit"
                                >
                                  + Nova Conexão para {availableProjects.find(p => p.id === projConfig.projectId)?.name || 'este projeto'}
                                </button>
                            </div>
                          </div>
                        );})}
                        
                        <button 
                          onClick={() => {
                              const newConfig = {...parsedConfig};
                              if (!newConfig.connections) newConfig.connections = [];
                              newConfig.connections.push({ projectId: '', secretToken: '', connectionsString: [] });
                              updateParsedConfig(newConfig);
                          }}
                          className="w-full py-4 border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-500 font-bold text-sm rounded-2xl hover:border-indigo-500 hover:text-indigo-500 dark:hover:border-indigo-400 dark:hover:text-indigo-400 transition-colors"
                        >
                          + Adicionar Projeto
                        </button>
                      </div>

                      {/* LDAP */}
                      <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                        <h4 className="font-bold text-lg text-neutral-800 dark:text-neutral-200 mb-4 flex items-center gap-2">
                          <Network className="w-5 h-5 text-indigo-500" /> LDAP
                        </h4>
                        
                        {parsedConfig.ldap ? (
                          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 rounded-2xl shadow-sm">
                              <label className="flex items-center gap-3 text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-6 bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-xl cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={parsedConfig.ldap.enabled || false}
                                  onChange={(e) => {
                                    const newConfig = {...parsedConfig};
                                    newConfig.ldap.enabled = e.target.checked;
                                    updateParsedConfig(newConfig);
                                  }}
                                  className="w-5 h-5 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                Habilitar Autenticação LDAP
                              </label>
                              
                              <div className={`grid grid-cols-2 gap-4 transition-opacity duration-200 ${!parsedConfig.ldap.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">URL do Servidor</label>
                                    <input 
                                      value={parsedConfig.ldap.url || ''}
                                      onChange={(e) => {
                                        const newConfig = {...parsedConfig};
                                        newConfig.ldap.url = e.target.value;
                                        updateParsedConfig(newConfig);
                                      }}
                                      placeholder="Ex: ldap://10.0.0.15:389"
                                      className="w-full bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Base DN</label>
                                    <input 
                                      value={parsedConfig.ldap.baseDn || ''}
                                      onChange={(e) => {
                                        const newConfig = {...parsedConfig};
                                        newConfig.ldap.baseDn = e.target.value;
                                        updateParsedConfig(newConfig);
                                      }}
                                      placeholder="Ex: dc=empresa,dc=local"
                                      className="w-full bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Bind DN (Usuário Serviço)</label>
                                    <input 
                                      value={parsedConfig.ldap.bindDn || ''}
                                      onChange={(e) => {
                                        const newConfig = {...parsedConfig};
                                        newConfig.ldap.bindDn = e.target.value;
                                        updateParsedConfig(newConfig);
                                      }}
                                      placeholder="Ex: cn=servico,ou=Services,dc=empresa,dc=local"
                                      className="w-full bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Senha (Bind Password)</label>
                                    <input 
                                      type="password"
                                      value={parsedConfig.ldap.bindPassword || ''}
                                      onChange={(e) => {
                                        const newConfig = {...parsedConfig};
                                        newConfig.ldap.bindPassword = e.target.value;
                                        updateParsedConfig(newConfig);
                                      }}
                                      className="w-full bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50" 
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Search Filter</label>
                                    <input 
                                      value={parsedConfig.ldap.searchFilter || ''}
                                      onChange={(e) => {
                                        const newConfig = {...parsedConfig};
                                        newConfig.ldap.searchFilter = e.target.value;
                                        updateParsedConfig(newConfig);
                                      }}
                                      placeholder="Ex: (sAMAccountName={{username}})"
                                      className="w-full bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50" 
                                    />
                                </div>
                              </div>
                          </div>
                        ) : (
                          <button 
                            onClick={() => {
                                const newConfig = {...parsedConfig};
                                newConfig.ldap = {
                                  enabled: true,
                                  url: "ldap://10.0.0.15:389",
                                  baseDn: "dc=empresa,dc=local",
                                  bindDn: "cn=metabuilder_service,ou=Services,dc=empresa,dc=local",
                                  bindPassword: "senha",
                                  searchFilter: "(sAMAccountName={{username}})"
                                };
                                updateParsedConfig(newConfig);
                            }}
                            className="w-full py-4 border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-500 font-bold text-sm rounded-2xl hover:border-indigo-500 hover:text-indigo-500 dark:hover:border-indigo-400 dark:hover:text-indigo-400 transition-colors"
                          >
                            + Adicionar Configuração LDAP
                          </button>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
              
              {hasProjects === false && (
                <div className="px-5 py-3 bg-amber-500/10 border-t border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2 shrink-0">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>
                    <strong>Dica:</strong> Se você gerar um projeto antes de editar esta configuração, algumas propriedades como o <code>projectId</code> e o <code>secretToken</code> já virão preenchidas automaticamente para você, facilitando bastante o processo!
                  </p>
                </div>
              )}

              <div className="p-4 bg-white dark:bg-neutral-900 flex justify-end gap-3 shrink-0 border-t border-neutral-200 dark:border-neutral-800">
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
      {pendingResolution && (
        <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={() => setPendingResolution(null)} />
          <div className="pointer-events-auto w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Sincronização Pendente</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
              Foram detectadas alterações estruturais nos metadados que dependem da sua revisão. Deseja mapear essas alterações e finalizar a sincronização agora?
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setPendingResolution(null)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Agora não
              </button>
              <Link 
                href={`/admin/${pendingResolution.workspaceSlug}/${pendingResolution.projectSlug}/sync-resolution?returnUrl=${encodeURIComponent(pathname)}`}
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
