'use client'

import React, { useState, useEffect } from 'react'
import {
  Settings, Play, Square, RefreshCw, Save, Database, 
  Network, HardDrive, Shield, AlertCircle, Key
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/utils/supabase/client'
import { useI18n } from '@/i18n/I18nContext'

export default function TunnelSettingsClient({ 
  workspaceSlug, 
  projectSlug,
  initialProjectId,
  initialProjectToken
}: { 
  workspaceSlug: string, 
  projectSlug: string,
  initialProjectId?: string,
  initialProjectToken?: string
}) {
  const { toast } = useToast()
  const { t } = useI18n()
  
  const [activeTab, setActiveTab] = useState<'tunnel' | 'config'>('tunnel')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [tunnelStatus, setTunnelStatus] = useState<'stopped' | 'running' | 'loading'>('loading')
  const [tunnelPid, setTunnelPid] = useState<number | null>(null)
  
  const [projectInfo, setProjectInfo] = useState<{ id: string, token: string } | null>(
    initialProjectId ? { id: initialProjectId, token: initialProjectToken || 'Não configurado' } : { id: 'Projeto não encontrado', token: 'Não configurado' }
  )

  // DB Form State
  const [dbForm, setDbForm] = useState({
    type: 'postgres',
    host: '',
    port: '',
    database: '',
    user: '',
    password: ''
  })
  
  // JSON Config State
  const [config, setConfig] = useState<any>({
    connections: [],
    ldap: { enabled: false, url: '', baseDn: '', bindDn: '', bindPassword: '', searchFilter: '' },
    downloadPath: ''
  })

  // Load config & status on mount
  useEffect(() => {
    fetchConfig()
    checkStatus()
    
    // Poll status every 5 seconds
    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const parseConnectionString = (url: string) => {
    if (!url) return
    try {
      const urlObj = new URL(url)
      setDbForm({
        type: urlObj.protocol.replace(':', ''),
        user: urlObj.username,
        password: urlObj.password,
        host: urlObj.hostname,
        port: urlObj.port,
        database: urlObj.pathname.replace('/', '')
      })
    } catch (e) {
      // Invalid URL format, ignore
    }
  }

  const getPortPlaceholder = (type: string) => {
    switch (type) {
      case 'mysql': return '3306'
      case 'mssql': return '1433'
      case 'oracle': return '1521'
      default: return '5432'
    }
  }

  const getUserPlaceholder = (type: string) => {
    switch (type) {
      case 'mysql': return 'root'
      case 'mssql': return 'sa'
      case 'oracle': return 'system'
      default: return 'postgres'
    }
  }

  const buildConnectionString = () => {
    const finalHost = dbForm.host || 'localhost'
    const finalPort = dbForm.port || getPortPlaceholder(dbForm.type)
    const finalUser = dbForm.user || getUserPlaceholder(dbForm.type)
    return `${dbForm.type}://${finalUser}:${dbForm.password}@${finalHost}:${finalPort}/${dbForm.database}`
  }

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/tunnel/config')
      const data = await res.json()
      if (data && !data.error) {
        setConfig(data)
        
        // Populate DB Form if connectionString exists
        const cString = data.connections?.[0]?.connectionsString?.[0]?.connectionString
        if (cString) {
          parseConnectionString(cString)
        }
      }
    } catch (e) {
      console.error('Error fetching config', e)
    } finally {
      setIsLoading(false)
    }
  }

  const checkStatus = async () => {
    try {
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

  const handleSaveConfig = async () => {
    setIsSaving(true)
    
    // Sync DB Form to JSON Config before saving
    const newConfig = { ...config }
    if (!newConfig.connections[0]) newConfig.connections[0] = { connectionsString: [{}] }
    if (!newConfig.connections[0].connectionsString[0]) newConfig.connections[0].connectionsString[0] = {}
    
    newConfig.connections[0].connectionsString[0] = {
      name: 'erp',
      type: dbForm.type,
      connectionString: buildConnectionString()
    }

    // Auto populate project ID and token if missing
    if (projectInfo) {
      newConfig.connections[0].projectId = projectInfo.id
      newConfig.connections[0].secretToken = projectInfo.token || newConfig.connections[0].secretToken
    }
    
    setConfig(newConfig)

    try {
      const res = await fetch('/api/tunnel/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      })
      const data = await res.json()
      if (data.success) {
        toast('Configurações salvas com sucesso no arquivo local.', 'success')
      } else {
        toast(data.error || 'Erro ao salvar configurações.', 'error')
      }
    } catch (e) {
      toast('Erro de comunicação ao salvar.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleProcessControl = async (action: 'start' | 'stop' | 'sync', mode?: number) => {
    setTunnelStatus('loading')
    try {
      const res = await fetch('/api/tunnel/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action === 'sync' ? 'start' : action, mode })
      })
      const data = await res.json()
      
      if (data.success) {
        toast(data.message, 'success')
        if (action === 'sync') {
          toast('Processo disparado. Acompanhe pela aba de Logs.', 'info')
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

  if (isLoading) {
    return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
            <Network className="w-6 h-6 text-indigo-500" />
            {t('dashboard.projects.studio.tunnel.title')}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">{t('dashboard.projects.studio.tunnel.subtitle')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800">
        <button 
          onClick={() => setActiveTab('tunnel')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'tunnel' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}
        >
          {t('dashboard.projects.studio.tunnel.tabs.control')}
        </button>
        <button 
          onClick={() => setActiveTab('config')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'config' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}
        >
          {t('dashboard.projects.studio.tunnel.tabs.config')}
        </button>
      </div>

      {/* TUNNEL CONTROL TAB */}
      {activeTab === 'tunnel' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Settings className="w-5 h-5" /> Status do Túnel Local</h3>
            <p className="text-sm text-neutral-500 mb-6">Inicie o processo do túnel (`cli-win.exe`) em background para escutar requisições do servidor central.</p>

            <div className="flex items-center gap-4 mb-8 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
              <div className="flex-1">
                <p className="text-xs uppercase tracking-widest font-black text-neutral-400">Estado Atual</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-3 h-3 rounded-full ${tunnelStatus === 'running' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse' : tunnelStatus === 'stopped' ? 'bg-red-500' : 'bg-neutral-400 animate-bounce'}`} />
                  <span className="font-bold text-neutral-700 dark:text-neutral-300">
                    {tunnelStatus === 'running' ? 'Ativo e Rodando' : tunnelStatus === 'stopped' ? 'Parado' : 'Carregando...'}
                  </span>
                </div>
              </div>
              {tunnelPid && (
                <div className="text-right">
                  <p className="text-xs uppercase tracking-widest font-black text-neutral-400">PID do Processo</p>
                  <p className="font-mono text-sm font-bold text-neutral-600 dark:text-neutral-400">{tunnelPid}</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button 
                disabled={tunnelStatus !== 'stopped'}
                onClick={() => handleProcessControl('start', 1)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${tunnelStatus === 'stopped' ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'}`}
              >
                <Play className="w-4 h-4" /> Iniciar Túnel
              </button>
              <button 
                disabled={tunnelStatus !== 'running'}
                onClick={() => handleProcessControl('stop')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${tunnelStatus === 'running' ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'}`}
              >
                <Square className="w-4 h-4" /> Parar Túnel
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Database className="w-5 h-5" /> Sincronização de Banco (Introspecção)</h3>
            <p className="text-sm text-neutral-500 mb-6">Força a leitura da estrutura do banco de dados local do cliente e envia os metadados para a nuvem.</p>

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 mb-8 flex items-start gap-3 text-amber-800 dark:text-amber-200">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p className="text-xs font-medium">A sincronização é executada em background e gera registros na aba de Logs deste projeto. O túnel normal será suspenso durante a operação se for iniciado no mesmo processo.</p>
            </div>

            <button 
              onClick={() => handleProcessControl('sync', 3)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Disparar Sincronização (--mode 3)
            </button>
          </div>
        </div>
      )}

      {/* JSON CONFIG TAB */}
      {activeTab === 'config' && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 space-y-8">
          
          <div>
            <h3 className="font-bold text-lg mb-1 flex items-center gap-2"><Shield className="w-5 h-5 text-indigo-500" /> Autenticação do Projeto</h3>
            <p className="text-sm text-neutral-500 mb-4">Credenciais capturadas automaticamente do sistema. Estas informações identificam qual projeto este túnel atende.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
              <div>
                <label className="block text-xs font-bold text-indigo-900/60 dark:text-indigo-200/60 mb-1">Project ID</label>
                <div className="w-full px-3 py-2 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50 bg-white/50 dark:bg-black/50 text-sm text-neutral-600 dark:text-neutral-400 font-mono select-all">
                  {projectInfo?.id || 'Carregando...'}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-indigo-900/60 dark:text-indigo-200/60 mb-1">Secret Token</label>
                <div className="w-full px-3 py-2 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50 bg-white/50 dark:bg-black/50 text-sm text-neutral-600 dark:text-neutral-400 font-mono select-all truncate">
                  {projectInfo?.token || 'Não configurado'}
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-neutral-200 dark:bg-neutral-800 w-full" />

          <div>
            <h3 className="font-bold text-lg mb-1 flex items-center gap-2"><Database className="w-5 h-5 text-indigo-500" /> Detalhes da Conexão do Banco</h3>
            <p className="text-sm text-neutral-500 mb-4">Credenciais do banco de dados local do cliente (ex: PostgreSQL, Oracle, SQLServer).</p>
            <div className="bg-neutral-50 dark:bg-neutral-800/50 p-6 rounded-xl border border-neutral-100 dark:border-neutral-800 space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">Motor do Banco</label>
                  <select 
                    value={dbForm.type}
                    onChange={(e) => setDbForm({...dbForm, type: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black text-sm"
                  >
                    <option value="postgresql">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="mssql">SQL Server</option>
                    <option value="oracle">Oracle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">Host / IP</label>
                  <input 
                    type="text" 
                    value={dbForm.host}
                    onChange={(e) => setDbForm({...dbForm, host: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black text-sm font-mono"
                    placeholder="localhost ou 192.168.0.1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">Porta</label>
                  <input 
                    type="text" 
                    value={dbForm.port}
                    onChange={(e) => setDbForm({...dbForm, port: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black text-sm font-mono"
                    placeholder={getPortPlaceholder(dbForm.type)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">Nome do Banco (Database)</label>
                  <input 
                    type="text" 
                    value={dbForm.database}
                    onChange={(e) => setDbForm({...dbForm, database: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black text-sm font-mono"
                    placeholder="erp_db"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">Usuário</label>
                  <input 
                    type="text" 
                    value={dbForm.user}
                    onChange={(e) => setDbForm({...dbForm, user: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black text-sm font-mono"
                    placeholder={getUserPlaceholder(dbForm.type)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">Senha</label>
                  <input 
                    type="password" 
                    value={dbForm.password}
                    onChange={(e) => setDbForm({...dbForm, password: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black text-sm font-mono"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-neutral-500 mb-1">String de Conexão Gerada</label>
                <div className="w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10 text-xs text-indigo-700 dark:text-indigo-300 font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                  {buildConnectionString()}
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-neutral-200 dark:bg-neutral-800 w-full" />

          <div>
            <h3 className="font-bold text-lg mb-1 flex items-center gap-2"><Key className="w-5 h-5 text-indigo-500" /> Autenticação Corporativa (LDAP)</h3>
            <p className="text-sm text-neutral-500 mb-4">Integração com Active Directory para logins de usuários da empresa.</p>
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 rounded-xl space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={config.ldap?.enabled || false}
                  onChange={(e) => setConfig({...config, ldap: {...config.ldap, enabled: e.target.checked}})}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Habilitar sincronização de usuários via LDAP</span>
              </label>

              {config.ldap?.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 mb-1">LDAP URL</label>
                    <input 
                      type="text" 
                      value={config.ldap.url || ''}
                      onChange={(e) => setConfig({...config, ldap: {...config.ldap, url: e.target.value}})}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black text-sm font-mono"
                      placeholder="ldap://10.0.0.15:389"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 mb-1">Base DN</label>
                    <input 
                      type="text" 
                      value={config.ldap.baseDn || ''}
                      onChange={(e) => setConfig({...config, ldap: {...config.ldap, baseDn: e.target.value}})}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black text-sm font-mono"
                      placeholder="dc=empresa,dc=local"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-neutral-200 dark:bg-neutral-800 w-full" />

          <div>
            <h3 className="font-bold text-lg mb-1 flex items-center gap-2"><HardDrive className="w-5 h-5 text-indigo-500" /> Diretórios do Sistema</h3>
            <p className="text-sm text-neutral-500 mb-4">Caminhos na máquina local usados pelo túnel.</p>
            <div>
              <label className="block text-xs font-bold text-neutral-500 mb-1">Download Path</label>
              <input 
                type="text" 
                value={config.downloadPath || ''}
                onChange={(e) => setConfig({...config, downloadPath: e.target.value})}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black text-sm font-mono max-w-md"
                placeholder="C:\AgTech\DownloadsMetaBuilder"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button 
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSaving ? 'Salvando...' : 'Salvar Configurações JSON'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
