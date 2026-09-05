'use client'

import React, { useState } from 'react'
import { Rnd } from 'react-rnd'
import Editor from '@monaco-editor/react'
import { X, Network, AlertTriangle, Save } from 'lucide-react'
import { useI18n } from '@/i18n'
import { parseConnString, buildConnString } from './tunnelUtils'

interface TunnelConfigModalProps {
  isOpen: boolean
  onClose: () => void
  configContent: string
  setConfigContent: (content: string) => void
  onSaveConfig: () => void
  isSavingConfig: boolean
  hasProjects: boolean | null
  availableProjects: any[]
}

export function TunnelConfigModal({
  isOpen,
  onClose,
  configContent,
  setConfigContent,
  onSaveConfig,
  isSavingConfig,
  hasProjects,
  availableProjects
}: TunnelConfigModalProps) {
  const { t } = useI18n()
  const [activeConfigTab, setActiveConfigTab] = useState<'form' | 'json'>('form')

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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto transition-opacity"
        onClick={onClose}
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
                <h3 className="font-bold text-xl text-neutral-900 dark:text-white">
                  {t('workspace_components.tunnel_control.modal_title', 'Editar metabuilder.config.json')}
                </h3>
                <p className="text-xs text-neutral-500 font-normal">
                  {t(
                    'workspace_components.tunnel_control.modal_desc',
                    'Esta configuração será salva diretamente no AppData Local da IDE e será usada no próximo Início ou Sincronização.'
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className={`text-sm font-bold px-4 py-1.5 rounded-lg transition-colors ${
                    activeConfigTab === 'form'
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                      : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveConfigTab('form')
                  }}
                >
                  {t('workspace_components.tunnel_control.form_tab', 'Formulário')}
                </button>
                <button
                  className={`text-sm font-bold px-4 py-1.5 rounded-lg transition-colors ${
                    activeConfigTab === 'json'
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                      : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveConfigTab('json')
                  }}
                >
                  {t('workspace_components.tunnel_control.json_tab', 'Editor JSON')}
                </button>
              </div>
            </div>
            <button
              onClick={onClose}
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
            {activeConfigTab === 'form' &&
              (!parsedConfig ? (
                <div className="p-8 text-center flex flex-col items-center justify-center h-full text-red-500">
                  <AlertTriangle className="w-12 h-12 mb-4 opacity-50" />
                  <h4 className="font-bold text-lg mb-2">
                    {t('workspace_components.tunnel_control.invalid_json_title', 'JSON Inválido')}
                  </h4>
                  <p className="text-sm opacity-80">
                    {t(
                      'workspace_components.tunnel_control.invalid_json_desc',
                      'Não foi possível processar o arquivo de configuração atual. Corrija-o na aba "Editor JSON" para usar o formulário.'
                    )}
                  </p>
                </div>
              ) : (
                <div className="p-6 overflow-y-auto h-full space-y-8 bg-neutral-50 dark:bg-neutral-900/50">
                  {/* Projetos / Conexões */}
                  <div>
                    <h4 className="font-bold text-lg text-neutral-800 dark:text-neutral-200 mb-4 flex items-center gap-2">
                      <Network className="w-5 h-5 text-indigo-500" />{' '}
                      {t('workspace_components.tunnel_control.projects_title', 'Projetos')}
                    </h4>

                    {parsedConfig.connections?.map((projConfig: any, originalIdx: number) => {
                      const isRelated =
                        !projConfig.projectId || availableProjects.some((p) => p.id === projConfig.projectId)
                      if (!isRelated) return null
                      return (
                        <div
                          key={originalIdx}
                          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 rounded-2xl mb-4 shadow-sm"
                        >
                          <div className="flex gap-4 items-end mb-4">
                            <div className="flex-1">
                              <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
                                {t(
                                  'workspace_components.tunnel_control.select_existing_project',
                                  'Selecionar Projeto Existente'
                                )}
                              </label>
                              <select
                                className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 font-medium outline-none focus:ring-2 focus:ring-indigo-500/50"
                                value={projConfig.projectId || ''}
                                onChange={(e) => {
                                  const newProjectId = e.target.value
                                  const project = availableProjects.find((p) => p.id === newProjectId)
                                  const newConfig = { ...parsedConfig }
                                  newConfig.connections[originalIdx].projectId = newProjectId
                                  if (project) {
                                    newConfig.connections[originalIdx].secretToken = project.secret_token || ''
                                  }
                                  updateParsedConfig(newConfig)
                                }}
                              >
                                <option value="">
                                  {t(
                                    'workspace_components.tunnel_control.select_project_placeholder',
                                    'Selecione um projeto para preencher os IDs...'
                                  )}
                                </option>
                                {availableProjects.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              onClick={() => {
                                const newConfig = { ...parsedConfig }
                                newConfig.connections.splice(originalIdx, 1)
                                updateParsedConfig(newConfig)
                              }}
                              className="p-2.5 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                              title={t('workspace_components.tunnel_control.remove_project', 'Remover Projeto')}
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                              <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
                                {t('workspace_components.tunnel_control.project_id_label', 'Project ID')}
                              </label>
                              <input
                                readOnly
                                value={projConfig.projectId || ''}
                                className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 font-mono text-neutral-500 dark:text-neutral-500 outline-none cursor-not-allowed"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
                                {t('workspace_components.tunnel_control.secret_token_label', 'Secret Token')}
                              </label>
                              <input
                                readOnly
                                value={projConfig.secretToken || ''}
                                className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 font-mono text-neutral-500 dark:text-neutral-500 outline-none cursor-not-allowed"
                              />
                            </div>
                          </div>

                          <div className="pl-4 border-l-2 border-indigo-100 dark:border-indigo-500/20">
                            <h5 className="font-bold text-sm text-neutral-700 dark:text-neutral-300 mb-3">
                              {t('workspace_components.tunnel_control.connection_strings', 'Strings de Conexão')}
                            </h5>
                            {projConfig.connectionsString?.map((connStr: any, connIdx: number) => {
                              const parsedStr = parseConnString(
                                connStr.type || 'postgres',
                                connStr.connectionString || ''
                              )

                              const handlePartChange = (field: keyof typeof parsedStr, val: string) => {
                                const newParsed = { ...parsedStr, [field]: val }
                                const newStr = buildConnString(connStr.type || 'postgres', newParsed)
                                const newConfig = { ...parsedConfig }
                                newConfig.connections[originalIdx].connectionsString[connIdx].connectionString = newStr
                                updateParsedConfig(newConfig)
                              }

                              return (
                                <div
                                  key={connIdx}
                                  className="bg-neutral-50 dark:bg-neutral-800/30 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800 mb-3 relative"
                                >
                                  <button
                                    onClick={() => {
                                      const newConfig = { ...parsedConfig }
                                      newConfig.connections[originalIdx].connectionsString.splice(connIdx, 1)
                                      updateParsedConfig(newConfig)
                                    }}
                                    className="absolute top-4 right-4 p-1.5 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>

                                  <div className="grid grid-cols-2 gap-3 pr-10 mb-4">
                                    <div>
                                      <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                                        {t('workspace_components.tunnel_control.conn_name', 'Nome')}
                                      </label>
                                      <input
                                        value={connStr.name || ''}
                                        onChange={(e) => {
                                          const newConfig = { ...parsedConfig }
                                          newConfig.connections[originalIdx].connectionsString[connIdx].name =
                                            e.target.value
                                          updateParsedConfig(newConfig)
                                        }}
                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm p-2 outline-none focus:border-indigo-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                                        {t('workspace_components.tunnel_control.conn_type', 'Tipo')}
                                      </label>
                                      <select
                                        value={connStr.type || ''}
                                        onChange={(e) => {
                                          const newConfig = { ...parsedConfig }
                                          newConfig.connections[originalIdx].connectionsString[connIdx].type =
                                            e.target.value
                                          const newStr = buildConnString(e.target.value, parsedStr)
                                          newConfig.connections[originalIdx].connectionsString[
                                            connIdx
                                          ].connectionString = newStr
                                          updateParsedConfig(newConfig)
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
                                      <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                                        {t('workspace_components.tunnel_control.conn_user', 'Usuário')}
                                      </label>
                                      <input
                                        value={parsedStr.user}
                                        onChange={(e) => handlePartChange('user', e.target.value)}
                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm p-2 outline-none focus:border-indigo-500"
                                      />
                                    </div>
                                    <div className="col-span-1">
                                      <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                                        {t('workspace_components.tunnel_control.conn_pass', 'Senha')}
                                      </label>
                                      <input
                                        type="password"
                                        value={parsedStr.pass}
                                        onChange={(e) => handlePartChange('pass', e.target.value)}
                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm p-2 outline-none focus:border-indigo-500"
                                      />
                                    </div>
                                    <div className="col-span-1">
                                      <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                                        {t('workspace_components.tunnel_control.conn_host', 'Host/IP')}
                                      </label>
                                      <input
                                        value={parsedStr.host}
                                        onChange={(e) => handlePartChange('host', e.target.value)}
                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm p-2 outline-none focus:border-indigo-500"
                                      />
                                    </div>
                                    <div className="col-span-1">
                                      <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                                        {t('workspace_components.tunnel_control.conn_port', 'Porta')}
                                      </label>
                                      <input
                                        value={parsedStr.port}
                                        onChange={(e) => handlePartChange('port', e.target.value)}
                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm p-2 outline-none focus:border-indigo-500"
                                      />
                                    </div>
                                    <div className="col-span-1">
                                      <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                                        {t('workspace_components.tunnel_control.conn_db', 'Database/SID')}
                                      </label>
                                      <input
                                        value={parsedStr.db}
                                        onChange={(e) => handlePartChange('db', e.target.value)}
                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm p-2 outline-none focus:border-indigo-500"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                            <button
                              onClick={() => {
                                const newConfig = { ...parsedConfig }
                                if (!newConfig.connections[originalIdx].connectionsString)
                                  newConfig.connections[originalIdx].connectionsString = []
                                newConfig.connections[originalIdx].connectionsString.push({
                                  name: '',
                                  type: 'postgres',
                                  connectionString: '',
                                })
                                updateParsedConfig(newConfig)
                              }}
                              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mt-2 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-lg transition-colors w-fit"
                            >
                              {t(
                                'workspace_components.tunnel_control.new_connection_for',
                                '+ Nova Conexão para {name}'
                              ).replace(
                                '{name}',
                                availableProjects.find((p) => p.id === projConfig.projectId)?.name ||
                                  t(
                                    'workspace_components.tunnel_control.new_connection_this_project',
                                    'este projeto'
                                  )
                              )}
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    <button
                      onClick={() => {
                        const newConfig = { ...parsedConfig }
                        if (!newConfig.connections) newConfig.connections = []
                        newConfig.connections.push({ projectId: '', secretToken: '', connectionsString: [] })
                        updateParsedConfig(newConfig)
                      }}
                      className="w-full py-4 border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-500 font-bold text-sm rounded-2xl hover:border-indigo-500 hover:text-indigo-500 dark:hover:border-indigo-400 dark:hover:text-indigo-400 transition-colors"
                    >
                      {t('workspace_components.tunnel_control.add_project', '+ Adicionar Projeto')}
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
                              const newConfig = { ...parsedConfig }
                              newConfig.ldap.enabled = e.target.checked
                              updateParsedConfig(newConfig)
                            }}
                            className="w-5 h-5 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          {t('workspace_components.tunnel_control.ldap_enable', 'Habilitar Autenticação LDAP')}
                        </label>

                        <div
                          className={`grid grid-cols-2 gap-4 transition-opacity duration-200 ${
                            !parsedConfig.ldap.enabled ? 'opacity-40 pointer-events-none' : ''
                          }`}
                        >
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">
                              {t('workspace_components.tunnel_control.ldap_server_url', 'URL do Servidor')}
                            </label>
                            <input
                              value={parsedConfig.ldap.url || ''}
                              onChange={(e) => {
                                const newConfig = { ...parsedConfig }
                                newConfig.ldap.url = e.target.value
                                updateParsedConfig(newConfig)
                              }}
                              placeholder={t(
                                'workspace_components.tunnel_control.ldap_server_placeholder',
                                'Ex: ldap://10.0.0.15:389'
                              )}
                              className="w-full bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">
                              {t('workspace_components.tunnel_control.ldap_base_dn', 'Base DN')}
                            </label>
                            <input
                              value={parsedConfig.ldap.baseDn || ''}
                              onChange={(e) => {
                                const newConfig = { ...parsedConfig }
                                newConfig.ldap.baseDn = e.target.value
                                updateParsedConfig(newConfig)
                              }}
                              placeholder={t(
                                'workspace_components.tunnel_control.ldap_base_placeholder',
                                'Ex: dc=empresa,dc=local'
                              )}
                              className="w-full bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">
                              {t(
                                'workspace_components.tunnel_control.ldap_bind_dn',
                                'Bind DN (Usuário Serviço)'
                              )}
                            </label>
                            <input
                              value={parsedConfig.ldap.bindDn || ''}
                              onChange={(e) => {
                                const newConfig = { ...parsedConfig }
                                newConfig.ldap.bindDn = e.target.value
                                updateParsedConfig(newConfig)
                              }}
                              placeholder={t(
                                'workspace_components.tunnel_control.ldap_bind_placeholder',
                                'Ex: cn=servico,ou=Services,dc=empresa,dc=local'
                              )}
                              className="w-full bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">
                              {t(
                                'workspace_components.tunnel_control.ldap_bind_pass',
                                'Senha (Bind Password)'
                              )}
                            </label>
                            <input
                              type="password"
                              value={parsedConfig.ldap.bindPassword || ''}
                              onChange={(e) => {
                                const newConfig = { ...parsedConfig }
                                newConfig.ldap.bindPassword = e.target.value
                                updateParsedConfig(newConfig)
                              }}
                              className="w-full bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">
                              {t('workspace_components.tunnel_control.ldap_search_filter', 'Search Filter')}
                            </label>
                            <input
                              value={parsedConfig.ldap.searchFilter || ''}
                              onChange={(e) => {
                                const newConfig = { ...parsedConfig }
                                newConfig.ldap.searchFilter = e.target.value
                                updateParsedConfig(newConfig)
                              }}
                              placeholder={t(
                                'workspace_components.tunnel_control.ldap_filter_placeholder',
                                'Ex: (sAMAccountName={{username}})'
                              )}
                              className="w-full bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          const newConfig = { ...parsedConfig }
                          newConfig.ldap = {
                            enabled: true,
                            url: 'ldap://10.0.0.15:389',
                            baseDn: 'dc=empresa,dc=local',
                            bindDn: 'cn=metabuilder_service,ou=Services,dc=empresa,dc=local',
                            bindPassword: 'senha',
                            searchFilter: '(sAMAccountName={{username}})',
                          }
                          updateParsedConfig(newConfig)
                        }}
                        className="w-full py-4 border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-500 font-bold text-sm rounded-2xl hover:border-indigo-500 hover:text-indigo-500 dark:hover:border-indigo-400 dark:hover:text-indigo-400 transition-colors"
                      >
                        {t(
                          'workspace_components.tunnel_control.add_ldap_config',
                          '+ Adicionar Configuração LDAP'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>

          {hasProjects === false && (
            <div className="px-5 py-3 bg-amber-500/10 border-t border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2 shrink-0">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                <strong>{t('workspace_components.tunnel_control.tip_title', 'Dica:')}</strong>{' '}
                {t(
                  'workspace_components.tunnel_control.tip_desc',
                  'Se você gerar um projeto antes de editar esta configuração, algumas propriedades como o projectId e o secretToken já virão preenchidas automaticamente para você, facilitando bastante o processo!'
                )}
              </p>
            </div>
          )}

          <div className="p-4 bg-white dark:bg-neutral-900 flex justify-end gap-3 shrink-0 border-t border-neutral-200 dark:border-neutral-800">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {t('workspace_components.synced_dbs.rename_cancel', 'Cancelar')}
            </button>
            <button
              onClick={onSaveConfig}
              disabled={isSavingConfig}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all disabled:opacity-50"
            >
              {isSavingConfig ? (
                t('workspace_components.tunnel_control.saving', 'Salvando...')
              ) : (
                <>
                  <Save className="w-4 h-4" />{' '}
                  {t('workspace_components.tunnel_control.save_config', 'Salvar Configuração')}
                </>
              )}
            </button>
          </div>
        </div>
      </Rnd>
    </div>
  )
}
