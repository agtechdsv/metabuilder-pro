'use client'

import React, { useState } from 'react'
import {
  Database,
  Download,
  CheckCircle,
  X,
  FolderOpen,
  Copy
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isTauri } from '@/utils/tauriUtils'
import { DownloadModalState } from './types'

interface ProjectExportModalProps {
  modalState: DownloadModalState
  onClose: () => void
  onStartExport: (
    projectId: string,
    fileName: string,
    dataMode: string,
    authStrategy: string,
    legacyDriver: string,
    dbConfig?: any,
    authConfig?: any
  ) => void
  exportModels: any[]
}

export function ProjectExportModal({
  modalState,
  onClose,
  onStartExport,
  exportModels
}: ProjectExportModalProps) {
  const [exportTab, setExportTab] = useState<'database' | 'auth'>('database')
  const [exportDataMode, setExportDataMode] = useState<'tunnel' | 'supabase' | 'postgres'>('supabase')
  const [exportAuthStrategy, setExportAuthStrategy] = useState<'managed' | 'legacy' | 'ldap' | 'none'>('none')
  const [exportLegacyDriver, setExportLegacyDriver] = useState<'supabase' | 'postgres'>('supabase')
  const [exportDbUser, setExportDbUser] = useState('user')
  const [exportDbPassword, setExportDbPassword] = useState('password')
  const [exportDbHost, setExportDbHost] = useState('localhost')
  const [exportDbPort, setExportDbPort] = useState('5432')
  const [exportDbName, setExportDbName] = useState('dataBase')
  const [exportSupaUrl, setExportSupaUrl] = useState('')
  const [exportSupaAnonKey, setExportSupaAnonKey] = useState('')
  const [exportAuthTableName, setExportAuthTableName] = useState('usuarios')
  const [exportAuthEmailCol, setExportAuthEmailCol] = useState('email')
  const [exportAuthPassCol, setExportAuthPassCol] = useState('senha')
  const [exportAuthHash, setExportAuthHash] = useState('Bcrypt')

  const handleOpenFolder = async (dir: string, fileFullPath: string) => {
    try {
      if (fileFullPath) {
        const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
        await revealItemInDir(fileFullPath)
      } else {
        const { openPath } = await import('@tauri-apps/plugin-opener')
        await openPath(dir)
      }
    } catch (e) {
      console.error('Não foi possível abrir o explorador:', e)
      try {
        const { openPath } = await import('@tauri-apps/plugin-opener')
        await openPath(dir)
      } catch { }
    }
  }

  const handleSubmitExport = () => {
    onStartExport(
      modalState.projectId!,
      modalState.fileName,
      exportDataMode,
      exportAuthStrategy,
      exportLegacyDriver,
      exportDataMode === 'postgres'
        ? {
            user: exportDbUser,
            password: exportDbPassword,
            host: exportDbHost,
            port: exportDbPort,
            database: exportDbName
          }
        : exportDataMode === 'supabase'
        ? {
            supabaseUrl: exportSupaUrl,
            supabaseAnonKey: exportSupaAnonKey
          }
        : null,
      exportAuthStrategy === 'legacy'
        ? {
            legacy: {
              usersTable: exportAuthTableName,
              emailColumn: exportAuthEmailCol,
              passwordColumn: exportAuthPassCol,
              passwordHash: exportAuthHash
            },
            db_table_name: exportAuthTableName,
            db_email_column: exportAuthEmailCol,
            db_password_column: exportAuthPassCol,
            db_user_role_column: 'id',
            db_password_hash: exportAuthHash
          }
        : null
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white text-center">
          <div className="mx-auto bg-white/20 w-14 h-14 rounded-full flex items-center justify-center mb-3">
            {modalState.phase === 'selecting' ? (
              <Database className="w-7 h-7 text-white animate-pulse" />
            ) : modalState.phase === 'done' ? (
              <CheckCircle className="w-7 h-7 text-white" />
            ) : modalState.phase === 'error' ? (
              <X className="w-7 h-7 text-white" />
            ) : (
              <Download className="w-7 h-7 text-white" />
            )}
          </div>
          <h3 className="text-lg font-black">
            {modalState.phase === 'selecting' && 'Configurar Exportação'}
            {modalState.phase === 'downloading' && 'Baixando Código Fonte...'}
            {modalState.phase === 'done' && 'Download Concluído!'}
            {modalState.phase === 'error' && 'Erro no Download'}
          </h3>
          <p className="text-indigo-100 text-sm mt-1 truncate max-w-xs mx-auto">{modalState.fileName}</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Selecting Database Option */}
          {modalState.phase === 'selecting' && (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex border-b border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setExportTab('database')}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
                    exportTab === 'database'
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                  }`}
                >
                  Banco de Dados
                </button>
                <button
                  type="button"
                  onClick={() => setExportTab('auth')}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
                    exportTab === 'auth'
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                  }`}
                >
                  Autenticação (Login)
                </button>
              </div>

              {/* Database Tab */}
              {exportTab === 'database' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setExportDataMode('tunnel')}
                      className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ${
                        exportDataMode === 'tunnel'
                          ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10'
                          : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                          exportDataMode === 'tunnel' ? 'border-indigo-500' : 'border-neutral-300 dark:border-neutral-700'
                        }`}
                      >
                        {exportDataMode === 'tunnel' && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-neutral-900 dark:text-white">MetaBuilder Tunnel (BaaS)</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Conecta via Websocket ao servidor online. Ideal para Frontend Desacoplado.
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportDataMode('supabase')}
                      className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ${
                        exportDataMode === 'supabase'
                          ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10'
                          : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                          exportDataMode === 'supabase' ? 'border-indigo-500' : 'border-neutral-300 dark:border-neutral-700'
                        }`}
                      >
                        {exportDataMode === 'supabase' && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-neutral-900 dark:text-white">Supabase (Nativo)</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Conecta via SDK oficial do Supabase. Ideal para infraestrutura serverless na nuvem.
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportDataMode('postgres')}
                      className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ${
                        exportDataMode === 'postgres'
                          ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10'
                          : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                          exportDataMode === 'postgres' ? 'border-indigo-500' : 'border-neutral-300 dark:border-neutral-700'
                        }`}
                      >
                        {exportDataMode === 'postgres' && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-neutral-900 dark:text-white">PostgreSQL (Nativo - pg)</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Gera queries SQL diretas via driver `pg`. Ideal para hospedar localmente (on-premise) no servidor do cliente.
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Configuração Supabase Data */}
                  {exportDataMode === 'supabase' && (
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3 font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
                      <p className="font-bold text-neutral-500 uppercase tracking-widest text-[9px]">Configuração do Supabase</p>
                      <div className="space-y-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-neutral-500 font-sans text-xs">Supabase URL</span>
                          <input
                            type="text"
                            value={exportSupaUrl}
                            onChange={(e) => setExportSupaUrl(e.target.value)}
                            placeholder="https://your-project.supabase.co"
                            className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500 text-xs w-full font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-neutral-500 font-sans text-xs">Supabase Anon Key</span>
                          <input
                            type="text"
                            value={exportSupaAnonKey}
                            onChange={(e) => setExportSupaAnonKey(e.target.value)}
                            placeholder="your-anon-key"
                            className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500 text-xs w-full font-mono truncate"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Configuração Postgres Data */}
                  {exportDataMode === 'postgres' && (
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3 font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
                      <p className="font-bold text-neutral-500 uppercase tracking-widest text-[9px]">Configuração da URL de Conexão</p>
                      <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-neutral-950 p-3 rounded-xl border border-neutral-200/60 dark:border-neutral-800/80 leading-relaxed text-xs">
                        <span className="text-neutral-500">postgresql://</span>
                        <input
                          type="text"
                          value={exportDbUser}
                          onChange={(e) => setExportDbUser(e.target.value)}
                          placeholder="user"
                          className="px-2 py-0.5 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded text-center text-neutral-900 dark:text-white outline-none focus:border-indigo-500 w-16"
                          title="Usuário"
                        />
                        <span className="text-neutral-500">:</span>
                        <input
                          type="text"
                          value={exportDbPassword}
                          onChange={(e) => setExportDbPassword(e.target.value)}
                          placeholder="password"
                          className="px-2 py-0.5 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded text-center text-neutral-900 dark:text-white outline-none focus:border-indigo-500 w-16"
                          title="Senha"
                        />
                        <span className="text-neutral-500">@</span>
                        <input
                          type="text"
                          value={exportDbHost}
                          onChange={(e) => setExportDbHost(e.target.value)}
                          placeholder="localhost"
                          className="px-2 py-0.5 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded text-center text-neutral-900 dark:text-white outline-none focus:border-indigo-500 w-24"
                          title="Host"
                        />
                        <span className="text-neutral-500">:</span>
                        <input
                          type="text"
                          value={exportDbPort}
                          onChange={(e) => setExportDbPort(e.target.value)}
                          placeholder="5432"
                          className="px-2 py-0.5 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded text-center text-neutral-900 dark:text-white outline-none focus:border-indigo-500 w-14"
                          title="Porta"
                        />
                        <span className="text-neutral-500">/</span>
                        <input
                          type="text"
                          value={exportDbName}
                          onChange={(e) => setExportDbName(e.target.value)}
                          placeholder="dataBase"
                          className="px-2 py-0.5 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded text-center text-neutral-900 dark:text-white outline-none focus:border-indigo-500 w-32"
                          title="Nome do Banco de Dados"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Auth Tab */}
              {exportTab === 'auth' && (
                <div className="space-y-4 pt-4 max-h-[50vh] overflow-y-auto pr-2 pb-2">
                  <div
                    onClick={() => setExportAuthStrategy('none')}
                    className={cn(
                      "p-4 rounded-xl border border-white/10 cursor-pointer transition-all duration-200",
                      exportAuthStrategy === 'none' ? "bg-white/10 border-white/20" : "hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", exportAuthStrategy === 'none' ? "border-[#5E2BFF]" : "border-gray-500")}>
                        {exportAuthStrategy === 'none' && <div className="w-2 h-2 bg-[#5E2BFF] rounded-full" />}
                      </div>
                      <span className="font-medium">Sem Autenticação</span>
                    </div>
                    <p className="text-sm text-gray-400 ml-7">
                      O app exportado não exigirá login. Middlewares de proteção serão removidos.
                    </p>
                  </div>

                  <div
                    onClick={() => setExportAuthStrategy('legacy')}
                    className={cn(
                      "p-4 rounded-xl border border-white/10 cursor-pointer transition-all duration-200",
                      exportAuthStrategy === 'legacy' ? "bg-white/10 border-white/20" : "hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", exportAuthStrategy === 'legacy' ? "border-[#5E2BFF]" : "border-gray-500")}>
                        {exportAuthStrategy === 'legacy' && <div className="w-2 h-2 bg-[#5E2BFF] rounded-full" />}
                      </div>
                      <span className="font-medium">Via Banco de Dados Legado</span>
                    </div>
                    <p className="text-sm text-gray-400 ml-7 mb-4">
                      O app exportado validará o login comparando com SUA tabela de usuários sincronizada.
                    </p>

                    {exportAuthStrategy === 'legacy' && (
                      <div className="ml-7 space-y-4 border-t border-white/10 pt-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-2">Driver de Conexão do BD Legado</label>
                          <div className="flex items-center space-x-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                checked={exportLegacyDriver === 'supabase'}
                                onChange={() => setExportLegacyDriver('supabase')}
                                className="text-[#5E2BFF] focus:ring-[#5E2BFF]"
                              />
                              <span className="text-xs">Supabase SDK</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                checked={exportLegacyDriver === 'postgres'}
                                onChange={() => setExportLegacyDriver('postgres')}
                                className="text-[#5E2BFF] focus:ring-[#5E2BFF]"
                              />
                              <span className="text-xs">Driver PostgreSQL Nativo (pg)</span>
                            </label>
                          </div>
                        </div>
                        <div className="mt-4 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                          <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-3 uppercase">Mapeamento de Autenticação</p>
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="flex flex-col gap-1">
                              <span className="text-neutral-500 font-sans text-xs">Tabela Usuários:</span>
                              <select
                                value={exportAuthTableName}
                                onChange={(e) => setExportAuthTableName(e.target.value)}
                                className="w-full px-2 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-900 dark:text-white outline-none focus:border-indigo-500 font-mono"
                              >
                                <option value="">Selecione a tabela...</option>
                                {exportModels.map(m => (
                                  <option key={m.id} value={m.db_table_name}>{m.db_table_name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-neutral-500 font-sans text-xs">Coluna Email:</span>
                              <select
                                value={exportAuthEmailCol}
                                onChange={(e) => setExportAuthEmailCol(e.target.value)}
                                className="w-full px-2 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-900 dark:text-white outline-none focus:border-indigo-500 font-mono"
                              >
                                <option value="">Selecione o campo...</option>
                                {exportModels.find(m => m.db_table_name === exportAuthTableName)?.fields?.map((f: any) => (
                                  <option key={f.id || f.db_column_name} value={f.db_column_name}>{f.db_column_name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-neutral-500 font-sans text-xs">Coluna Senha:</span>
                              <select
                                value={exportAuthPassCol}
                                onChange={(e) => setExportAuthPassCol(e.target.value)}
                                className="w-full px-2 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-900 dark:text-white outline-none focus:border-indigo-500 font-mono"
                              >
                                <option value="">Selecione o campo...</option>
                                {exportModels.find(m => m.db_table_name === exportAuthTableName)?.fields?.map((f: any) => (
                                  <option key={f.id || f.db_column_name} value={f.db_column_name}>{f.db_column_name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-neutral-500 font-sans text-xs">Formato Hash:</span>
                              <select
                                value={exportAuthHash}
                                onChange={(e) => setExportAuthHash(e.target.value)}
                                className="w-full px-2 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-900 dark:text-white outline-none focus:border-indigo-500 font-mono"
                              >
                                <option value="Bcrypt">Bcrypt</option>
                                <option value="Plain">Texto Puro</option>
                                <option value="MD5">MD5</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    onClick={() => setExportAuthStrategy('ldap')}
                    className={cn(
                      "p-4 rounded-xl border border-white/10 cursor-pointer transition-all duration-200",
                      exportAuthStrategy === 'ldap' ? "bg-white/10 border-white/20" : "hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", exportAuthStrategy === 'ldap' ? "border-[#5E2BFF]" : "border-gray-500")}>
                        {exportAuthStrategy === 'ldap' && <div className="w-2 h-2 bg-[#5E2BFF] rounded-full" />}
                      </div>
                      <span className="font-medium">LDAP / AD</span>
                    </div>
                    <p className="text-sm text-gray-400 ml-7">
                      Integração corporativa nativa. O app gerado validará no Active Directory do cliente.
                    </p>
                    {exportAuthStrategy === 'ldap' && (
                      <div className="ml-7 mt-4 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
                          Por questões de segurança corporativa, você precisará configurar as variáveis do LDAP diretamente nas propriedades do projeto exportado.
                          No fonte exportado, preencha as variáveis em seu arquivo <code className="bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded">.env.local</code> da seguinte forma:
                        </p>
                        <div className="relative group">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigator.clipboard.writeText(
                                `# Configurações do Active Directory (LDAP)\nLDAP_URL="ldap://10.0.0.15:389"\nLDAP_BASE_DN="dc=empresa,dc=local"\nLDAP_BIND_DN="cn=metabuilder_service,ou=Services,dc=empresa,dc=local"\nLDAP_BIND_PASSWORD="senha_secreta_do_bind"\nLDAP_SEARCH_FILTER="(sAMAccountName={{username}})"`
                              )
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copiar"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <pre className="text-[10px] text-indigo-400 bg-neutral-950 p-3 rounded border border-neutral-800 overflow-x-auto font-mono leading-tight whitespace-pre">
                            {`# Configurações do Active Directory (LDAP)
LDAP_URL="ldap://10.0.0.15:389"
LDAP_BASE_DN="dc=empresa,dc=local"
LDAP_BIND_DN="cn=metabuilder_service,ou=Services,dc=empresa,dc=local"
LDAP_BIND_PASSWORD="senha_secreta_do_bind"
LDAP_SEARCH_FILTER="(sAMAccountName={{username}})"`}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2.5 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  onClick={handleSubmitExport}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.2)]"
                >
                  Iniciar Exportação
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-950 dark:text-white rounded-xl text-sm font-bold transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {modalState.phase === 'downloading' && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-neutral-500">
                <span>Progresso</span>
                <span>{modalState.progress}%</span>
              </div>
              <div className="h-2.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${modalState.progress}%` }}
                />
              </div>
              <p className="text-xs text-center text-neutral-400">
                {isTauri() ? 'Salvando na pasta Downloads do sistema...' : 'Preparando arquivo no navegador...'}
              </p>
            </div>
          )}

          {/* Done state */}
          {modalState.phase === 'done' && (
            <div className="space-y-3">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3 text-xs text-emerald-700 dark:text-emerald-400 text-center font-medium">
                Arquivo salvo em: <span className="font-bold">Downloads</span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2.5">
                {isTauri() ? (
                  <button
                    onClick={() => handleOpenFolder(modalState.savedDir, modalState.savedPath)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Abrir Pasta
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                  >
                    Concluído
                  </button>
                )}
              </div>

              {isTauri() && (
                <button
                  onClick={onClose}
                  className="w-full text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 font-bold uppercase tracking-widest py-1 transition-colors"
                >
                  Fechar
                </button>
              )}
            </div>
          )}

          {/* Error state */}
          {modalState.phase === 'error' && (
            <div className="space-y-3">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl p-3 text-xs text-red-700 dark:text-red-400 text-center font-medium">
                Ocorreu um erro ao gerar o arquivo de código fonte.
              </div>
              <button
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-xl text-sm font-bold transition-colors"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
