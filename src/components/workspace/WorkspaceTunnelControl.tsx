'use client'

import React, { useState, useEffect } from 'react'
import { Settings, Play, Square, RefreshCw, AlertCircle, Network, FileJson, Save } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { isTauri } from '@/utils/tauriUtils'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import Editor from '@monaco-editor/react'

export function WorkspaceTunnelControl({ workspaceSlug }: { workspaceSlug: string }) {
  const { toast } = useToast()
  
  const [tunnelStatus, setTunnelStatus] = useState<'stopped' | 'running' | 'loading'>('loading')
  const [tunnelPid, setTunnelPid] = useState<number | null>(null)
  const [isDesktopEnv, setIsDesktopEnv] = useState<boolean | null>(null)

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [configContent, setConfigContent] = useState('')
  const [isSavingConfig, setIsSavingConfig] = useState(false)

  const defaultTemplate = `{
  "workspace_id": "",
  "projects": [
    {
      "project_id": "",
      "connection_string": "postgresql://postgres:password@localhost:5432/dbname"
    }
  ]
}`

  const handleOpenConfig = async () => {
    setIsConfigModalOpen(true)
    try {
      const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
      const { readTextFile, exists } = await import('@tauri-apps/plugin-fs')
      
      const dir = await appLocalDataDir()
      const configPath = await join(dir, 'metabuilder.config.json')
      
      const fileExists = await exists(configPath)
      if (fileExists) {
        const content = await readTextFile(configPath)
        setConfigContent(content)
      } else {
        setConfigContent(defaultTemplate)
      }
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

  const handleProcessControl = async (action: 'start' | 'stop' | 'sync', mode?: number) => {
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
            mode: action === 'sync' ? 3 : (mode || 1), 
            configPath: configPath 
          });
          toast(action === 'sync' ? 'Sincronização disparada.' : 'Túnel iniciado com sucesso.', 'success');
        }
        checkStatus();
        return;
      }

      const res = await fetch('/api/tunnel/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action === 'sync' ? 'start' : action, mode })
      })
      const data = await res.json()
      
      if (data.success) {
        toast(data.message, 'success')
        if (action === 'sync') {
          toast('Processo disparado. Acompanhe pela aba de Logs do respectivo projeto.', 'info')
        }
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
              Força a leitura de estrutura de todos os bancos de dados configurados no `metabuilder.config.json` ativo na máquina. O túnel será pausado brevemente.
            </p>
          </div>
          <button 
            onClick={() => handleProcessControl('sync', 3)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Disparar Sincronização Geral
          </button>
        </div>

      </div>

      {/* Modal de Configuração JSON */}
      <Modal 
        isOpen={isConfigModalOpen} 
        onClose={() => setIsConfigModalOpen(false)} 
        title="Editar metabuilder.config.json"
        description="Esta configuração será salva diretamente no AppData Local da IDE e será usada no próximo Início ou Sincronização."
      >
        <div className="h-[400px] border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden mb-6">
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
            }}
          />
        </div>
        <div className="flex justify-end gap-3">
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
      </Modal>

    </div>
  )
}
