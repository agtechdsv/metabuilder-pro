'use client'

import React, { useState, useEffect } from 'react'
import {
  Save, Database, Network, Shield, AlertCircle, Key, Plus, Trash2, HardDrive
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { isTauri } from '@/utils/tauriUtils'
import Link from 'next/link'

interface DBConnection {
  name: string
  type: string
  host: string
  port: string
  database: string
  user: string
  password: string
}

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
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDesktopEnv, setIsDesktopEnv] = useState<boolean | null>(null)
  
  const [projectInfo, setProjectInfo] = useState<{ id: string, token: string } | null>(
    initialProjectId ? { id: initialProjectId, token: initialProjectToken || 'Não configurado' } : { id: 'Projeto não encontrado', token: 'Não configurado' }
  )

  const defaultConnection: DBConnection = {
    name: 'erp',
    type: 'postgres',
    host: '',
    port: '',
    database: '',
    user: '',
    password: ''
  }

  // Multi-DB Form State
  const [dbConnections, setDbConnections] = useState<DBConnection[]>([defaultConnection])
  
  // JSON Config State
  const [config, setConfig] = useState<any>({
    connections: [],
    ldap: { enabled: false, url: '', baseDn: '', bindDn: '', bindPassword: '', searchFilter: '' },
    downloadPath: ''
  })

  const parseConnectionString = (url: string, name: string): DBConnection => {
    try {
      const urlObj = new URL(url)
      return {
        name: name || 'erp',
        type: urlObj.protocol.replace(':', ''),
        user: urlObj.username,
        password: urlObj.password,
        host: urlObj.hostname,
        port: urlObj.port,
        database: urlObj.pathname.replace('/', '')
      }
    } catch (e) {
      return { ...defaultConnection, name: name || 'erp' }
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

  const buildConnectionString = (conn: DBConnection) => {
    const finalHost = conn.host || 'localhost'
    const finalPort = conn.port || getPortPlaceholder(conn.type)
    const finalUser = conn.user || getUserPlaceholder(conn.type)
    return `${conn.type}://${finalUser}:${conn.password}@${finalHost}:${finalPort}/${conn.database}`
  }

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/tunnel/config')
      const data = await res.json()
      if (data && !data.error) {
        setConfig(data)
        
        // Populate DB Connections from JSON
        const cStrings = data.connections?.[0]?.connectionsString
        if (cStrings && Array.isArray(cStrings) && cStrings.length > 0) {
          const parsedConns = cStrings.map((c: any) => parseConnectionString(c.connectionString, c.name))
          setDbConnections(parsedConns)
        }
      }
    } catch (e) {
      console.error('Error fetching config', e)
    } finally {
      setIsLoading(false)
    }
  }

  // Load config on mount
  useEffect(() => {
    const isDesktop = isTauri();
    setIsDesktopEnv(isDesktop);

    if (isDesktop) {
      fetchConfig()
    }
  }, [])

  if (isDesktopEnv === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-2xl font-bold mb-4">Acesso Restrito ao Desktop</h2>
        <p className="text-neutral-600 dark:text-neutral-400 max-w-lg mb-8">
          A configuração do túnel local e metadados de bancos de dados exigem acesso direto à máquina do desenvolvedor (File System) e não podem ser configurados via Web.
        </p>
        <Link 
          href="/features/ide"
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all"
        >
          Baixe a MetaBuilderPRO IDE
        </Link>
      </div>
    )
  }

  if (isDesktopEnv === null || isLoading) {
    return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
  }

  const updateConnection = (index: number, field: keyof DBConnection, value: string) => {
    const newConns = [...dbConnections]
    newConns[index] = { ...newConns[index], [field]: value }
    setDbConnections(newConns)
  }

  const addConnection = () => {
    setDbConnections([...dbConnections, { ...defaultConnection, name: `db_${dbConnections.length + 1}` }])
  }

  const removeConnection = (index: number) => {
    if (dbConnections.length === 1) return // Keep at least one
    const newConns = [...dbConnections]
    newConns.splice(index, 1)
    setDbConnections(newConns)
  }

  const handleSaveConfig = async () => {
    setIsSaving(true)
    
    // Sync DB Connections to JSON Config before saving
    const newConfig = { ...config }
    if (!newConfig.connections[0]) newConfig.connections[0] = { connectionsString: [] }
    
    newConfig.connections[0].connectionsString = dbConnections.map(conn => ({
      name: conn.name || 'default',
      type: conn.type,
      connectionString: buildConnectionString(conn)
    }))

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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
            <Network className="w-6 h-6 text-indigo-500" />
            Configurações de Bancos (JSON)
          </h1>
          <p className="text-sm text-neutral-500 mt-1">Gere o arquivo `metabuilder.config.json` com os dados sensíveis do ambiente do projeto.</p>
        </div>
      </div>

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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg mb-1 flex items-center gap-2"><Database className="w-5 h-5 text-indigo-500" /> Conexões de Banco de Dados</h3>
              <p className="text-sm text-neutral-500">Cadastre os bancos de dados vinculados a este projeto (ex: DB Principal, DB Financeiro).</p>
            </div>
            <button 
              onClick={addConnection}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold rounded-lg transition-colors border border-indigo-200 dark:border-indigo-800"
            >
              <Plus className="w-4 h-4" /> Adicionar Banco
            </button>
          </div>

          <div className="space-y-6">
            {dbConnections.map((conn, index) => (
              <div key={index} className="bg-neutral-50 dark:bg-neutral-800/50 p-6 rounded-xl border border-neutral-100 dark:border-neutral-800 space-y-4 relative group">
                {dbConnections.length > 1 && (
                  <button 
                    onClick={() => removeConnection(index)}
                    className="absolute top-4 right-4 text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    title="Remover Conexão"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-neutral-500 mb-1">Nome/Apelido do Banco</label>
                    <input 
                      type="text" 
                      value={conn.name}
                      onChange={(e) => updateConnection(index, 'name', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black text-sm"
                      placeholder="erp_principal"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-neutral-500 mb-1">Motor</label>
                    <select 
                      value={conn.type}
                      onChange={(e) => updateConnection(index, 'type', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black text-sm"
                    >
                      <option value="postgresql">PostgreSQL</option>
                      <option value="mysql">MySQL</option>
                      <option value="mssql">SQL Server</option>
                      <option value="oracle">Oracle</option>
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-neutral-500 mb-1">Host / IP</label>
                    <input 
                      type="text" 
                      value={conn.host}
                      onChange={(e) => updateConnection(index, 'host', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black text-sm font-mono"
                      placeholder="localhost"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-neutral-500 mb-1">Porta</label>
                    <input 
                      type="text" 
                      value={conn.port}
                      onChange={(e) => updateConnection(index, 'port', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black text-sm font-mono"
                      placeholder={getPortPlaceholder(conn.type)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 mb-1">Database</label>
                    <input 
                      type="text" 
                      value={conn.database}
                      onChange={(e) => updateConnection(index, 'database', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black text-sm font-mono"
                      placeholder="meu_banco"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 mb-1">Usuário</label>
                    <input 
                      type="text" 
                      value={conn.user}
                      onChange={(e) => updateConnection(index, 'user', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black text-sm font-mono"
                      placeholder={getUserPlaceholder(conn.type)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 mb-1">Senha</label>
                    <input 
                      type="password" 
                      value={conn.password}
                      onChange={(e) => updateConnection(index, 'password', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black text-sm font-mono"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-neutral-500 mb-1">String de Conexão Gerada</label>
                  <div className="w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10 text-xs text-indigo-700 dark:text-indigo-300 font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                    {buildConnectionString(conn)}
                  </div>
                </div>
              </div>
            ))}
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

    </div>
  )
}
