'use client'

import React, { useState } from 'react'
import { Rnd } from 'react-rnd'
import Editor from '@monaco-editor/react'
import { X, Network, AlertTriangle, Save, Undo2, SlidersHorizontal, Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n'
import {
  parseConnString,
  buildConnString,
  getScopeContainer,
  resolveInheritedBlock,
  hasEffectiveConnection,
  summarizeConnection,
  type ConfigScope,
  type ConfigBlockKey,
} from './tunnelUtils'

interface TunnelConfigModalProps {
  isOpen: boolean
  onClose: () => void
  configContent: string
  setConfigContent: (content: string) => void
  onSaveConfig: () => void
  isSavingConfig: boolean
  hasProjects: boolean | null
  availableProjects: any[]
  /** Nível de configuração que a aba Formulário edita (global, workspace ou projeto). */
  scope: ConfigScope
  /** Enquanto o arquivo e o escopo estão sendo carregados. */
  isLoading?: boolean
}

type TFn = (key: string, fallback?: string) => string

const DEFAULT_LDAP = {
  enabled: true,
  url: 'ldap://10.0.0.15:389',
  baseDn: 'dc=empresa,dc=local',
  bindDn: 'cn=metabuilder_service,ou=Services,dc=empresa,dc=local',
  bindPassword: 'senha',
  searchFilter: '(sAMAccountName={{username}})',
}
const DEFAULT_CONNECTION = { name: 'public', type: 'postgres', connectionString: '' }
const DEFAULT_DOWNLOAD_PATH = 'C:\\AgTech\\DownloadsMetaBuilder'

export function TunnelConfigModal({
  isOpen,
  onClose,
  configContent,
  setConfigContent,
  onSaveConfig,
  isSavingConfig,
  hasProjects,
  availableProjects,
  scope,
  isLoading = false,
}: TunnelConfigModalProps) {
  const { t } = useI18n() as { t: TFn }
  const [activeConfigTab, setActiveConfigTab] = useState<'form' | 'json'>('form')

  const parsedConfig = React.useMemo(() => {
    try {
      return JSON.parse(configContent)
    } catch {
      return null
    }
  }, [configContent])

  // Aplica uma alteração sobre uma cópia do config e grava de volta no texto (fonte única, compartilhada com a aba JSON)
  const mutateConfig = (mutator: (cfg: any) => void) => {
    const clone = JSON.parse(JSON.stringify(parsedConfig))
    mutator(clone)
    setConfigContent(JSON.stringify(clone, null, 2))
  }

  const setBlock = (key: ConfigBlockKey, value: any | undefined) =>
    mutateConfig((cfg) => {
      const container = getScopeContainer(cfg, scope, true)
      if (!container) return
      if (value === undefined) delete container[key]
      else container[key] = value
    })

  if (!isOpen) return null

  // ── Títulos por escopo ───────────────────────────────────────────────────────
  const scopeTitle =
    scope.type === 'global'
      ? t('workspace_components.tunnel_control.scope_global_title', 'Global (Workspaces / Projetos)')
      : scope.type === 'workspace'
        ? t('workspace_components.tunnel_control.scope_workspace_title', 'Global (Projetos de {name})').replace('{name}', scope.workspaceName || '')
        : t('workspace_components.tunnel_control.scope_project_title', '{project} em {workspace}')
            .replace('{project}', scope.projectName || '')
            .replace('{workspace}', scope.workspaceName || '')

  const scopeDesc =
    scope.type === 'global'
      ? t('workspace_components.tunnel_control.scope_global_desc', 'Vale para todos os projetos de todos os workspaces, exceto onde um workspace ou projeto definir a sua própria configuração.')
      : scope.type === 'workspace'
        ? t('workspace_components.tunnel_control.scope_workspace_desc', 'Vale para todos os projetos deste workspace, exceto onde um projeto definir a sua própria configuração. Tem prioridade sobre o Global.')
        : t('workspace_components.tunnel_control.scope_project_desc', 'Vale somente para este projeto. Tem prioridade sobre o Workspace e o Global.')

  // Projetos do escopo sem nenhuma string de conexão efetiva (nem própria, nem herdada): o túnel deles não sobe
  const projectsWithoutConnection = parsedConfig
    ? (scope.type === 'project'
        ? availableProjects.filter((p) => p.id === scope.projectId)
        : availableProjects
      ).filter((p) => !hasEffectiveConnection(parsedConfig, p.id, p.workspace_id))
    : []

  const originLabel = (origin: 'workspace' | 'global' | null) =>
    origin === 'workspace'
      ? t('workspace_components.tunnel_control.origin_workspace', 'Workspace {name}').replace('{name}', scope.workspaceName || '')
      : t('workspace_components.tunnel_control.origin_global', 'Global')

  // ── Bloco em cascata (próprio x herdado) ─────────────────────────────────────
  const renderBlock = (
    key: ConfigBlockKey,
    title: string,
    opts: {
      createDefault: (inheritedValue: any) => any
      renderEditor: (value: any, onChange: (v: any) => void) => React.ReactNode
      renderSummary: (value: any) => React.ReactNode
    }
  ) => {
    const container = getScopeContainer(parsedConfig, scope, false)
    const value = container ? container[key] : undefined
    const isOwn = value !== undefined && value !== null
    const inherited = resolveInheritedBlock(parsedConfig, scope, key)
    const isGlobal = scope.type === 'global'

    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h5 className="font-bold text-sm text-neutral-800 dark:text-neutral-200">{title}</h5>
            {!isGlobal && (
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  isOwn
                    ? 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30'
                    : 'bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700'
                }`}
              >
                {isOwn
                  ? t('workspace_components.tunnel_control.defined_here', 'definido neste nível')
                  : inherited.origin
                    ? t('workspace_components.tunnel_control.inherited_from', 'herdado de {origin}').replace('{origin}', originLabel(inherited.origin))
                    : t('workspace_components.tunnel_control.not_defined', 'não definido')}
              </span>
            )}
          </div>
          {!isGlobal && isOwn && (
            <button
              onClick={() => setBlock(key, undefined)}
              className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-red-500 bg-neutral-50 dark:bg-neutral-800 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5" />
              {t('workspace_components.tunnel_control.revert_inherit', 'Voltar a herdar')}
            </button>
          )}
        </div>

        {isGlobal || isOwn ? (
          opts.renderEditor(value, (v) => setBlock(key, v))
        ) : (
          <div className="space-y-3">
            <div className="bg-neutral-50 dark:bg-neutral-800/40 border border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl p-4 text-sm text-neutral-500 dark:text-neutral-400 opacity-80">
              {inherited.origin ? (
                opts.renderSummary(inherited.value)
              ) : (
                <span className="italic">
                  {key === 'connectionsString'
                    ? t('workspace_components.tunnel_control.no_connection_any_level', 'Nenhuma string de conexão definida em nenhum nível.')
                    : t('workspace_components.tunnel_control.nothing_inherited', 'Nada definido nos níveis acima.')}
                </span>
              )}
            </div>
            <button
              onClick={() => setBlock(key, opts.createDefault(inherited.value))}
              className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-4 py-2 rounded-lg transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {t('workspace_components.tunnel_control.customize', 'Personalizar')}
            </button>
          </div>
        )}
      </div>
    )
  }

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
            {isLoading && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <span className="text-sm">{t('workspace_components.tunnel_control.loading_config', 'Carregando configuração...')}</span>
              </div>
            )}
            {!isLoading && activeConfigTab === 'json' && (
              <>
                <div className="px-4 py-2 text-[11px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-b border-amber-500/20 shrink-0">
                  {t(
                    'workspace_components.tunnel_control.json_full_notice',
                    'O editor JSON mostra o arquivo completo (global, workspaces e todos os projetos), independente do nível aberto no formulário.'
                  )}
                </div>
                <div className="flex-1 min-h-0">
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
              </>
            )}
            {!isLoading && activeConfigTab === 'form' &&
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
                <div className="p-6 overflow-y-auto h-full space-y-5 bg-neutral-50 dark:bg-neutral-900/50">
                  <div>
                    <h4 className="font-bold text-lg text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                      <Network className="w-5 h-5 text-indigo-500" /> {scopeTitle}
                    </h4>
                    <p className="text-xs text-neutral-500 mt-1">{scopeDesc}</p>
                  </div>

                  {projectsWithoutConnection.length > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>
                        {t(
                          'workspace_components.tunnel_control.no_connection_warning',
                          'Sem string de conexão (nem própria, nem herdada) — o túnel destes projetos não sobe:'
                        )}{' '}
                        <strong>{projectsWithoutConnection.map((p) => p.name).join(', ')}</strong>
                      </p>
                    </div>
                  )}

                  {/* 1. Strings de Conexão */}
                  {renderBlock(
                    'connectionsString',
                    t('workspace_components.tunnel_control.connection_strings', 'Strings de Conexão'),
                    {
                      createDefault: (inh) =>
                        Array.isArray(inh) && inh.length > 0 ? JSON.parse(JSON.stringify(inh)) : [{ ...DEFAULT_CONNECTION }],
                      renderSummary: (list: any[]) => (
                        <ul className="space-y-1 font-mono text-xs">
                          {list.map((c, i) => (
                            <li key={i}>{summarizeConnection(c)}</li>
                          ))}
                        </ul>
                      ),
                      renderEditor: (list: any[] | undefined, onChange) => (
                        <ConnectionStringsEditor list={list || []} onChange={onChange} t={t} />
                      ),
                    }
                  )}

                  {/* 2. Pasta de Downloads */}
                  {renderBlock(
                    'downloadPath',
                    t('workspace_components.tunnel_control.download_path_label', 'Pasta de Downloads'),
                    {
                      createDefault: (inh) => (typeof inh === 'string' && inh.trim() ? inh : DEFAULT_DOWNLOAD_PATH),
                      renderSummary: (v: string) => <span className="font-mono text-xs">{v}</span>,
                      renderEditor: (v: string | undefined, onChange) => {
                        const inheritedPath = resolveInheritedBlock(parsedConfig, scope, 'downloadPath').value
                        return (
                          <div>
                            <input
                              value={v ?? ''}
                              onChange={(e) => onChange(e.target.value)}
                              placeholder={(typeof inheritedPath === 'string' && inheritedPath) || DEFAULT_DOWNLOAD_PATH}
                              className="w-full bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 font-mono outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                            {scope.type !== 'global' && (
                              <p className="text-[11px] text-neutral-400 mt-1">
                                {t('workspace_components.tunnel_control.download_path_hint', 'Vazio = usa o padrão herdado.')}
                              </p>
                            )}
                          </div>
                        )
                      },
                    }
                  )}

                  {/* 3. LDAP */}
                  {renderBlock('ldap', 'LDAP', {
                    createDefault: (inh) => (inh ? JSON.parse(JSON.stringify(inh)) : { ...DEFAULT_LDAP }),
                    renderSummary: (l: any) => (
                      <span className="text-xs">
                        {l?.enabled
                          ? `${t('workspace_components.tunnel_control.ldap_enabled_label', 'Habilitado')} · ${l.url || ''}`
                          : t('workspace_components.tunnel_control.ldap_disabled_label', 'Desabilitado')}
                      </span>
                    ),
                    renderEditor: (ldap: any | undefined, onChange) => (
                      <LdapEditor
                        ldap={ldap}
                        t={t}
                        addLabel={t('workspace_components.tunnel_control.add_ldap_config', '+ Adicionar Configuração LDAP')}
                        onChange={onChange}
                      />
                    ),
                  })}
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
              disabled={isSavingConfig || isLoading}
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

const inputCls =
  'w-full bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50'
const smallInputCls =
  'w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm p-2 outline-none focus:border-indigo-500'
const labelCls = 'block text-[10px] uppercase font-bold text-neutral-400 mb-1.5'

/** Lista editável de strings de conexão (nome, tipo, usuário, senha, host, porta, database). */
function ConnectionStringsEditor({ list, onChange, t }: { list: any[]; onChange: (list: any[]) => void; t: TFn }) {
  const update = (idx: number, patch: any) => onChange(list.map((c, i) => (i === idx ? { ...c, ...patch } : c)))

  return (
    <div>
      {list.map((connStr: any, connIdx: number) => {
        const type = connStr.type || 'postgres'
        const parsedStr = parseConnString(type, connStr.connectionString || '')
        const handlePartChange = (field: keyof typeof parsedStr, val: string) =>
          update(connIdx, { connectionString: buildConnString(type, { ...parsedStr, [field]: val }) })

        return (
          <div
            key={connIdx}
            className="bg-neutral-50 dark:bg-neutral-800/30 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800 mb-3 relative"
          >
            <button
              onClick={() => onChange(list.filter((_, i) => i !== connIdx))}
              className="absolute top-4 right-4 p-1.5 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="grid grid-cols-2 gap-3 pr-10 mb-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                  {t('workspace_components.tunnel_control.conn_name', 'Nome')}
                </label>
                <input value={connStr.name || ''} onChange={(e) => update(connIdx, { name: e.target.value })} className={smallInputCls} />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                  {t('workspace_components.tunnel_control.conn_type', 'Tipo')}
                </label>
                <select
                  value={connStr.type || ''}
                  onChange={(e) =>
                    update(connIdx, { type: e.target.value, connectionString: buildConnString(e.target.value, parsedStr) })
                  }
                  className={smallInputCls}
                >
                  <option value="postgres">Postgres</option>
                  <option value="mysql">MySQL</option>
                  <option value="oracle">Oracle</option>
                  <option value="sqlserver">SQL Server</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-3">
              {(
                [
                  ['user', 'conn_user', 'Usuário', 'text'],
                  ['pass', 'conn_pass', 'Senha', 'password'],
                  ['host', 'conn_host', 'Host/IP', 'text'],
                  ['port', 'conn_port', 'Porta', 'text'],
                  ['db', 'conn_db', 'Database/SID', 'text'],
                ] as const
              ).map(([field, tKey, fallback, inputType]) => (
                <div key={field} className="col-span-1">
                  <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                    {t(`workspace_components.tunnel_control.${tKey}`, fallback)}
                  </label>
                  <input
                    type={inputType}
                    value={parsedStr[field]}
                    onChange={(e) => handlePartChange(field, e.target.value)}
                    className={smallInputCls}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })}
      <button
        onClick={() => onChange([...list, { name: '', type: 'postgres', connectionString: '' }])}
        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mt-1 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-lg transition-colors w-fit"
      >
        {t('workspace_components.tunnel_control.add_connection_string', '+ Nova string de conexão')}
      </button>
    </div>
  )
}

/** Editor dos campos LDAP. */
function LdapEditor({
  ldap,
  onChange,
  t,
  addLabel,
}: {
  ldap: any
  onChange: (ldap: any | undefined) => void
  t: TFn
  addLabel: string
}) {
  if (!ldap) {
    return (
      <button
        onClick={() => onChange({ ...DEFAULT_LDAP })}
        className="w-full py-3 border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-500 font-bold text-sm rounded-2xl hover:border-indigo-500 hover:text-indigo-500 dark:hover:border-indigo-400 dark:hover:text-indigo-400 transition-colors"
      >
        {addLabel}
      </button>
    )
  }

  const set = (key: string, value: any) => onChange({ ...ldap, [key]: value })

  return (
    <div>
      <label className="flex items-center gap-3 text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-5 bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-xl cursor-pointer">
        <input
          type="checkbox"
          checked={ldap.enabled || false}
          onChange={(e) => set('enabled', e.target.checked)}
          className="w-5 h-5 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
        />
        {t('workspace_components.tunnel_control.ldap_enable', 'Habilitar Autenticação LDAP')}
      </label>

      <div
        className={`grid grid-cols-2 gap-4 transition-opacity duration-200 ${!ldap.enabled ? 'opacity-40 pointer-events-none' : ''}`}
      >
        <div>
          <label className={labelCls}>{t('workspace_components.tunnel_control.ldap_server_url', 'URL do Servidor')}</label>
          <input
            value={ldap.url || ''}
            onChange={(e) => set('url', e.target.value)}
            placeholder={t('workspace_components.tunnel_control.ldap_server_placeholder', 'Ex: ldap://10.0.0.15:389')}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{t('workspace_components.tunnel_control.ldap_base_dn', 'Base DN')}</label>
          <input
            value={ldap.baseDn || ''}
            onChange={(e) => set('baseDn', e.target.value)}
            placeholder={t('workspace_components.tunnel_control.ldap_base_placeholder', 'Ex: dc=empresa,dc=local')}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>
            {t('workspace_components.tunnel_control.ldap_bind_dn', 'Bind DN (Usuário Serviço)')}
          </label>
          <input
            value={ldap.bindDn || ''}
            onChange={(e) => set('bindDn', e.target.value)}
            placeholder={t(
              'workspace_components.tunnel_control.ldap_bind_placeholder',
              'Ex: cn=servico,ou=Services,dc=empresa,dc=local'
            )}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>
            {t('workspace_components.tunnel_control.ldap_bind_pass', 'Senha (Bind Password)')}
          </label>
          <input
            type="password"
            value={ldap.bindPassword || ''}
            onChange={(e) => set('bindPassword', e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>{t('workspace_components.tunnel_control.ldap_search_filter', 'Search Filter')}</label>
          <input
            value={ldap.searchFilter || ''}
            onChange={(e) => set('searchFilter', e.target.value)}
            placeholder={t(
              'workspace_components.tunnel_control.ldap_filter_placeholder',
              'Ex: (sAMAccountName={{username}})'
            )}
            className={inputCls}
          />
        </div>
      </div>
    </div>
  )
}
