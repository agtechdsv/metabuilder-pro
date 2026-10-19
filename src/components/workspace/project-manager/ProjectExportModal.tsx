'use client'

import React, { useState } from 'react'
import {
  Database,
  Download,
  CheckCircle,
  X,
  FolderOpen,
  Copy,
  Loader2,
  Play,
  Square,
  Globe,
  AppWindow,
  Server,
  Coffee
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { isTauri, openExternalUrl } from '@/utils/tauriUtils'
import { usePreview } from '@/contexts/PreviewContext'
import { detectJava, installPortableJdk, startBackendCommand } from '@/utils/javaRuntime'
import { askUser } from './useProjectExport'
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
    authConfig?: any,
    backendStack?: string,
    javaGroupId?: string,
    javaPort?: number,
    accessAdmin?: boolean,
    javaOptions?: Record<string, unknown>
  ) => void
  exportModels: any[]
}

export function ProjectExportModal({
  modalState,
  onClose,
  onStartExport,
  exportModels
}: ProjectExportModalProps) {
  const { t } = useI18n()
  const { openPreview } = usePreview()
  // depois de exportar (desktop, Windows): sobe o app num terminal e abre no navegador ou no navegador da IDE
  const [devStarted, setDevStarted] = useState(false)
  // PIDs das janelas de terminal do app (frontend e, no Java, backend): é por eles que o servidor é parado
  const [devPids, setDevPids] = useState<number[]>([])
  const [devStopping, setDevStopping] = useState(false)
  const [devError, setDevError] = useState('')
  // mensagem enquanto prepara (ex.: baixando o JDK portátil)
  const [devPreparing, setDevPreparing] = useState('')
  const [devUrl, setDevUrl] = useState('http://localhost:3000')
  const [exportTab, setExportTab] = useState<'backend' | 'database' | 'auth'>('backend')
  const prefill = modalState.defaults || {}
  const [backendStack, setBackendStack] = useState<'nodejs' | 'java-spring'>(prefill.backendStack || 'nodejs')
  const [javaGroupId, setJavaGroupId] = useState(prefill.javaGroupId || 'com.app')
  const [javaPort, setJavaPort] = useState(prefill.javaPort || 8080)
  // opções do backend Java (valem de verdade na geração)
  const [javaOpts, setJavaOpts] = useState(prefill.javaOptions || { jwt: true, migrations: false, tests: false, docker: true, env: true, swagger: true, readme: true })
  const toggleJava = (k: keyof typeof javaOpts) => setJavaOpts(o => ({ ...o, [k]: !o[k] }))
  // abre com o que o projeto já tem configurado (banco e login); o usuário ainda pode trocar
  const defaults = modalState.defaults || {}
  const [exportDataMode, setExportDataMode] = useState<'tunnel' | 'supabase' | 'postgres' | 'oracle' | 'mysql' | 'sqlserver'>(defaults.dataMode || 'supabase')
  // banco do projeto que não é Postgres: vira uma opção própria (com a porta e o formato de conexão dele)
  const nativeDb = (['oracle', 'mysql', 'sqlserver'] as const).find(k => k === defaults.dataMode)
  const NATIVE_INFO = {
    oracle: { label: `Oracle (${t('export_modal.native', "Nativo")} - oracledb)`, port: '1521', dbLabel: 'Service name' },
    mysql: { label: `MySQL (${t('export_modal.native', "Nativo")} - mysql2)`, port: '3306', dbLabel: t('export_modal.database', "Banco") },
    sqlserver: { label: `SQL Server (${t('export_modal.native', "Nativo")} - mssql)`, port: '1433', dbLabel: t('export_modal.database', "Banco") },
  } as const
  const buildNativeConnection = (kind: 'oracle' | 'mysql' | 'sqlserver') => {
    const u = encodeURIComponent(exportDbUser), p = encodeURIComponent(exportDbPassword)
    if (kind === 'oracle') return `oracle://${u}:${p}@${exportDbHost}:${exportDbPort}/${exportDbName}`
    if (kind === 'mysql') return `mysql://${u}:${p}@${exportDbHost}:${exportDbPort}/${exportDbName}`
    return `Server=${exportDbHost},${exportDbPort};Database=${exportDbName};User Id=${exportDbUser};Password=${exportDbPassword};Encrypt=true`
  }
  const [exportAuthStrategy, setExportAuthStrategy] = useState<'managed' | 'legacy' | 'ldap' | 'none'>(defaults.authStrategy || 'none')
  const [exportLegacyDriver, setExportLegacyDriver] = useState<'supabase' | 'postgres'>(defaults.legacyDriver || 'supabase')
  const saved = defaults.dbConnection
  const [exportDbUser, setExportDbUser] = useState(saved?.user || 'user')
  const [exportDbPassword, setExportDbPassword] = useState(saved?.password || 'password')
  const [exportDbHost, setExportDbHost] = useState(saved?.host || 'localhost')
  const [exportDbPort, setExportDbPort] = useState(saved?.port || (nativeDb ? NATIVE_INFO[nativeDb].port : '5432'))
  const [exportDbName, setExportDbName] = useState(saved?.database || 'dataBase')
  const [exportSupaUrl, setExportSupaUrl] = useState('')
  const [exportSupaAnonKey, setExportSupaAnonKey] = useState('')
  const [exportAuthTableName, setExportAuthTableName] = useState(defaults.authTable || 'usuarios')
  const [exportAuthEmailCol, setExportAuthEmailCol] = useState(defaults.authEmailColumn || 'email')
  const [exportAuthPassCol, setExportAuthPassCol] = useState(defaults.authPasswordColumn || 'senha')
  const [exportAuthHash, setExportAuthHash] = useState(defaults.authHash || 'Bcrypt')
  // exporta também os casos de uso Usuários, Grupos de Acesso e Permissões de Telas (e aplica as permissões no app)
  const [exportAccessAdmin, setExportAccessAdmin] = useState(prefill.accessAdmin === true)

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

  const canRunDev = isTauri() && typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent)

  const handleRunDev = async () => {
    // Java: o Next.js fica em frontend/ e o backend Spring Boot em backend/ (sobe com o Maven, em outra janela minimizada)
    const dir = backendStack === 'java-spring' && modalState.savedDir ? modalState.savedDir + '\\frontend' : modalState.savedDir
    if (!dir) return
    setDevError('')
    try {
      const { Command } = await import('@tauri-apps/plugin-shell')
      const isJava = backendStack === 'java-spring'
      const pids: number[] = []
      if (isJava) {
        // o backend Spring roda com o Maven Wrapper da pasta (baixa o Maven sozinho). Java: o JDK portátil da IDE, o do PATH, ou oferece baixar o portátil
        if ((await detectJava()) === 'none') {
          if (!(await askUser(t('export_modal.java_download_confirm', 'O Java (JDK 21) não foi encontrado nesta máquina. Baixar o JDK 21 portátil (Eclipse Temurin, cerca de 200 MB) para a pasta .metabuilder do seu usuário? Não altera o PATH nem instala nada no sistema.')))) {
            setDevError(t('export_modal.java_tools_missing', 'Para rodar o backend Java é preciso ter o JDK 21. Instale-o (ou aceite o download do JDK portátil) e tente de novo.'))
            return
          }
          setDevPreparing(t('export_modal.java_downloading', 'Baixando o JDK 21 portátil (cerca de 200 MB)... pode levar alguns minutos.'))
          const installed = await installPortableJdk()
          setDevPreparing('')
          if (!installed) {
            setDevError(t('export_modal.java_download_failed', 'Não foi possível baixar o JDK 21. Verifique a internet ou instale o JDK 21 manualmente e tente de novo.'))
            return
          }
        }
        const be = await Command.create('powershell', ['-NoProfile', '-NonInteractive', '-Command', startBackendCommand(modalState.savedDir + '\\backend')]).execute()
        if (be.code !== 0) { setDevError(String(be.stderr || '').trim().slice(0, 200)); return }
        const bePid = Number(String(be.stdout || '').trim().split(/\s+/).pop())
        if (Number.isInteger(bePid) && bePid > 0) pids.push(bePid)
      }
      // abre uma janela de terminal própria, MINIMIZADA (não cobre a IDE; fica na barra de tarefas com o log do app e viva mesmo se a IDE fechar); o PowerShell é o comando liberado para isso
      const safeDir = dir.replace(/'/g, "''")
      const out = await Command.create('powershell', ['-NoProfile', '-NonInteractive', '-Command', "$p = Start-Process cmd -WindowStyle Minimized -ArgumentList '/k','npm run dev' -WorkingDirectory '" + safeDir + "' -PassThru; $p.Id"]).execute()
      const fePid = Number(String(out.stdout || '').trim().split(/\s+/).pop())
      if (Number.isInteger(fePid) && fePid > 0) pids.push(fePid)
      if (out.code === 0) { setDevPids(pids); setDevStarted(true) }
      else setDevError(String(out.stderr || '').trim().slice(0, 200))
    } catch (e: any) {
      setDevPreparing('')
      setDevError(String(e?.message || e).slice(0, 200))
    }
  }

  const handleStopDev = async () => {
    setDevStopping(true)
    setDevError('')
    try {
      const { Command } = await import('@tauri-apps/plugin-shell')
      // taskkill /T encerra a janela e os processos filhos (npm, node, Java); se a janela já foi fechada à mão, o erro é ignorado
      const ids = devPids.filter(n => Number.isInteger(n) && n > 0)
      if (ids.length > 0) {
        await Command.create('powershell', ['-NoProfile', '-NonInteractive', '-Command', 'foreach ($id in @(' + ids.join(',') + ')) { taskkill /PID $id /T /F 2>$null | Out-Null }']).execute()
      }
      setDevPids([])
      setDevReady(false)
      setDevStarted(false)
    } catch (e: any) {
      setDevError(String(e?.message || e).slice(0, 200))
    } finally {
      setDevStopping(false)
    }
  }

  // sonda a URL do app até ele responder: só então os botões de abrir são liberados (o terminal fica minimizado, o usuário não vê o "Ready")
  const [devReady, setDevReady] = useState(false)
  React.useEffect(() => {
    if (!devStarted) return
    setDevReady(false)
    let stop = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const up = async (url: string) => {
      const ctrl = new AbortController()
      const abort = setTimeout(() => ctrl.abort(), 2500)
      try {
        // no-cors: basta a conexão ser aceita (a resposta é opaca, mesmo 401/403); recusada = ainda não subiu
        await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal })
        return true
      } catch { return false } finally { clearTimeout(abort) }
    }
    const probe = async () => {
      const feUp = await up(devUrl)
      // no Java o frontend só funciona com o backend (Spring) no ar: a primeira subida baixa dependências e leva alguns minutos
      const beUp = backendStack === 'java-spring' ? await up('http://localhost:' + javaPort + '/') : true
      if (stop) return
      if (feUp && beUp) { setDevReady(true); return }
      timer = setTimeout(probe, 1500)
    }
    probe()
    return () => { stop = true; if (timer) clearTimeout(timer) }
  }, [devStarted, devUrl, backendStack, javaPort])

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
        : exportDataMode === 'oracle' || exportDataMode === 'mysql' || exportDataMode === 'sqlserver'
        ? { connectionString: buildNativeConnection(exportDataMode) }
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
        : null,
      backendStack,
      javaGroupId,
      javaPort,
      exportAuthStrategy === 'legacy' && exportAccessAdmin,
      backendStack === 'java-spring'
        ? {
            jwtEnabled: javaOpts.jwt,
            generateMigrations: javaOpts.migrations,
            generateServiceTests: javaOpts.tests,
            generateControllerTests: javaOpts.tests,
            generateDockerfile: javaOpts.docker,
            generateDockerCompose: javaOpts.docker,
            generateEnvExample: javaOpts.env,
            generateOpenApi: javaOpts.swagger,
            generateReadme: javaOpts.readme,
          }
        : undefined
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
            ) : modalState.phase === 'processing' ? (
              <Loader2 className="w-7 h-7 text-white animate-spin" />
            ) : modalState.phase === 'done' ? (
              <CheckCircle className="w-7 h-7 text-white" />
            ) : modalState.phase === 'error' ? (
              <X className="w-7 h-7 text-white" />
            ) : (
              <Download className="w-7 h-7 text-white" />
            )}
          </div>
          <h3 className="text-lg font-black">
            {modalState.phase === 'selecting' && t('export_modal.title_selecting', "Configurar Exportação")}
            {modalState.phase === 'downloading' && t('export_modal.title_downloading', "Baixando Código Fonte...")}
            {modalState.phase === 'processing' && t('export_modal.title_processing', "Preparando o projeto...")}
            {modalState.phase === 'done' && (isTauri() ? t('export_modal.title_done_desktop', "Exportação Concluída!") : t('export_modal.title_done', "Download Concluído!"))}
            {modalState.phase === 'error' && t('export_modal.title_error', "Erro no Download")}
          </h3>
          <p className="text-indigo-100 text-sm mt-1 truncate max-w-xs mx-auto">{isTauri() ? modalState.fileName.replace(/-source-code\.zip$/, '') : modalState.fileName}</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Selecting Database Option */}
          {modalState.phase === 'selecting' && (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex border-b border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setExportTab('backend')}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
                    exportTab === 'backend'
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                  }`}
                >
                  {t('export_modal.tab_backend', "Backend & API")}
                </button>
                <button
                  type="button"
                  onClick={() => setExportTab('database')}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
                    exportTab === 'database'
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                  }`}
                >
                  {t('export_modal.tab_database', "Banco de Dados")}
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
                  {t('export_modal.tab_auth', "Autenticação (Login)")}
                </button>
              </div>

              {/* Backend Tab */}
              {exportTab === 'backend' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setBackendStack('nodejs')}
                      className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ${
                        backendStack === 'nodejs'
                          ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10'
                          : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${backendStack === 'nodejs' ? 'border-indigo-500' : 'border-neutral-300 dark:border-neutral-700'}`}>
                        {backendStack === 'nodejs' && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                      </div>
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-neutral-900 dark:text-white">Next.js Full-Stack (Node.js)</p>
                          <span className="text-green-400 font-bold text-xs">Node</span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {t('export_modal.nodejs_desc', "App Router + React Server Components + Server Actions diretas ao banco.")}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBackendStack('java-spring')}
                      className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ${
                        backendStack === 'java-spring'
                          ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10'
                          : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${backendStack === 'java-spring' ? 'border-indigo-500' : 'border-neutral-300 dark:border-neutral-700'}`}>
                        {backendStack === 'java-spring' && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                      </div>
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-neutral-900 dark:text-white">Next.js + Spring Boot 3 (Java 21)</p>
                          <Coffee className="w-4 h-4 text-amber-400" />
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {t('export_modal.java_desc', "Frontend Next.js chamando API REST Spring Boot — estrutura dual frontend/backend.")}
                        </p>
                      </div>
                    </button>
                  </div>

                  {backendStack === 'java-spring' && (
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3 font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
                      <p className="font-bold text-neutral-500 uppercase tracking-widest text-[9px]">{t('export_modal.maven_config', "Configuração Maven / Spring")}</p>
                      <div className="space-y-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-neutral-500 font-sans text-xs">Maven Group ID</span>
                          <input
                            type="text"
                            value={javaGroupId}
                            onChange={(e) => setJavaGroupId(e.target.value)}
                            className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-500"
                            placeholder="com.app"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-neutral-500 font-sans text-xs">{t('export_modal.spring_port', "Porta Spring Boot")}</span>
                          <input
                            type="number"
                            value={javaPort}
                            onChange={(e) => setJavaPort(Number(e.target.value))}
                            className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-500"
                            placeholder="8080"
                          />
                        </div>
                      </div>
                      <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-1.5">
                        <p className="font-bold text-neutral-500 uppercase tracking-widest text-[9px]">{t('export_modal.java_options', "Opções do backend Java")}</p>
                        {([
                          ['jwt', t('export_modal.java_jwt', "Autenticação JWT")],
                          ['migrations', t('export_modal.java_migrations', "Migrations SQL (Flyway)")],
                          ['tests', t('export_modal.java_tests', "Testes unitários (Service e Controller)")],
                          ['docker', t('export_modal.java_docker', "Dockerfile e docker-compose")],
                          ['env', t('export_modal.java_env', ".env.example")],
                          ['swagger', t('export_modal.java_swagger', "Swagger / OpenAPI")],
                          ['readme', t('export_modal.java_readme', "README do backend")],
                        ] as const).map(([k, label]) => (
                          <label key={k} className="flex items-center gap-2 font-sans text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                            <input type="checkbox" checked={javaOpts[k]} onChange={() => toggleJava(k)} className="accent-indigo-600 w-3.5 h-3.5" />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                          {t('export_modal.tunnel_desc', "Conecta via Websocket ao servidor online. Ideal para Frontend Desacoplado.")}
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
                        <p className="text-sm font-bold text-neutral-900 dark:text-white">Supabase ({t('export_modal.native', "Nativo")})</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {t('export_modal.supabase_desc', "Conecta via SDK oficial do Supabase. Ideal para infraestrutura serverless na nuvem.")}
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
                        <p className="text-sm font-bold text-neutral-900 dark:text-white">PostgreSQL ({t('export_modal.native', "Nativo")} - pg)</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {t('export_modal.pg_desc', "Gera queries SQL diretas via driver `pg`. Ideal para hospedar localmente (on-premise) no servidor do cliente.")}
                        </p>
                      </div>
                    </button>
                    {nativeDb && (
                      <button
                        type="button"
                        onClick={() => setExportDataMode(nativeDb)}
                        className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ${
                          exportDataMode === nativeDb
                            ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10'
                            : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${exportDataMode === nativeDb ? 'border-indigo-500' : 'border-neutral-300 dark:border-neutral-700'}`}>
                          {exportDataMode === nativeDb && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-neutral-900 dark:text-white">{NATIVE_INFO[nativeDb].label}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">{t('export_modal.native_desc', "O mesmo banco deste projeto. Gera o acesso direto, para hospedar no servidor do cliente.")}</p>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Configuração do banco nativo do projeto (Oracle, MySQL, SQL Server) */}
                  {nativeDb && exportDataMode === nativeDb && (
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3 text-xs text-neutral-600 dark:text-neutral-400">
                      <p className="font-bold text-neutral-500 uppercase tracking-widest text-[9px]">{t('export_modal.conn_config', "Configuração da Conexão")}</p>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          [t('export_modal.user', "Usuário"), exportDbUser, setExportDbUser],
                          [t('export_modal.password', "Senha"), exportDbPassword, setExportDbPassword],
                          ['Host', exportDbHost, setExportDbHost],
                          [t('export_modal.port', "Porta"), exportDbPort, setExportDbPort],
                          [NATIVE_INFO[nativeDb].dbLabel, exportDbName, setExportDbName],
                        ] as const).map(([label, value, setter]) => (
                          <label key={label} className="flex flex-col gap-1">
                            <span className="text-neutral-500">{label}</span>
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => setter(e.target.value)}
                              className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500 font-mono"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Configuração Supabase Data */}
                  {exportDataMode === 'supabase' && (
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3 font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
                      <p className="font-bold text-neutral-500 uppercase tracking-widest text-[9px]">{t('export_modal.supabase_config', "Configuração do Supabase")}</p>
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
                      <p className="font-bold text-neutral-500 uppercase tracking-widest text-[9px]">{t('export_modal.url_config', "Configuração da URL de Conexão")}</p>
                      <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-neutral-950 p-3 rounded-xl border border-neutral-200/60 dark:border-neutral-800/80 leading-relaxed text-xs">
                        <span className="text-neutral-500">postgresql://</span>
                        <input
                          type="text"
                          value={exportDbUser}
                          onChange={(e) => setExportDbUser(e.target.value)}
                          placeholder="user"
                          className="px-2 py-0.5 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded text-center text-neutral-900 dark:text-white outline-none focus:border-indigo-500 w-16"
                          title={t('export_modal.user', "Usuário")}
                        />
                        <span className="text-neutral-500">:</span>
                        <input
                          type="text"
                          value={exportDbPassword}
                          onChange={(e) => setExportDbPassword(e.target.value)}
                          placeholder="password"
                          className="px-2 py-0.5 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded text-center text-neutral-900 dark:text-white outline-none focus:border-indigo-500 w-16"
                          title={t('export_modal.password', "Senha")}
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
                          title={t('export_modal.port', "Porta")}
                        />
                        <span className="text-neutral-500">/</span>
                        <input
                          type="text"
                          value={exportDbName}
                          onChange={(e) => setExportDbName(e.target.value)}
                          placeholder="dataBase"
                          className="px-2 py-0.5 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded text-center text-neutral-900 dark:text-white outline-none focus:border-indigo-500 w-32"
                          title={t('export_modal.database_full', "Nome do Banco de Dados")}
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
                      <span className="font-medium">{t('export_modal.none_title', "Sem Autenticação")}</span>
                    </div>
                    <p className="text-sm text-gray-400 ml-7">
                      {t('export_modal.none_desc', "O app exportado não exigirá login. Middlewares de proteção serão removidos.")}
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
                      <span className="font-medium">{t('export_modal.legacy_title', "Via Banco de Dados Legado")}</span>
                    </div>
                    <p className="text-sm text-gray-400 ml-7 mb-4">
                      {t('export_modal.legacy_desc', "O app exportado validará o login comparando com SUA tabela de usuários sincronizada.")}
                    </p>

                    {exportAuthStrategy === 'legacy' && (
                      <div className="ml-7 space-y-4 border-t border-white/10 pt-4">
                        {/* o login usa o mesmo driver escolhido na aba Banco de Dados (a escolha própria de driver aqui não era usada na geração) */}
                        <p className="text-xs text-gray-400">
                          {t('access_admin.driver_note', 'O login consulta sua tabela de usuários pelo mesmo banco escolhido na aba Banco de Dados ({db}).').replace('{db}', ({ tunnel: 'MetaBuilder Tunnel', supabase: 'Supabase SDK', postgres: 'PostgreSQL (pg)', oracle: 'Oracle (oracledb)', mysql: 'MySQL (mysql2)', sqlserver: 'SQL Server (mssql)' } as const)[exportDataMode])}
                        </p>
                        <div className="mt-4 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                          <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-3 uppercase">{t('export_modal.auth_mapping', "Mapeamento de Autenticação")}</p>
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="flex flex-col gap-1">
                              <span className="text-neutral-500 font-sans text-xs">{t('export_modal.users_table', "Tabela Usuários:")}</span>
                              <select
                                value={exportAuthTableName}
                                onChange={(e) => setExportAuthTableName(e.target.value)}
                                className="w-full px-2 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-900 dark:text-white outline-none focus:border-indigo-500 font-mono"
                              >
                                <option value="">{t('export_modal.select_table', "Selecione a tabela...")}</option>
                                {exportModels.map(m => (
                                  <option key={m.id} value={m.db_table_name}>{m.db_table_name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-neutral-500 font-sans text-xs">{t('export_modal.email_col', "Coluna Email:")}</span>
                              <select
                                value={exportAuthEmailCol}
                                onChange={(e) => setExportAuthEmailCol(e.target.value)}
                                className="w-full px-2 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-900 dark:text-white outline-none focus:border-indigo-500 font-mono"
                              >
                                <option value="">{t('export_modal.select_field', "Selecione o campo...")}</option>
                                {exportModels.find(m => m.db_table_name === exportAuthTableName)?.fields?.map((f: any) => (
                                  <option key={f.id || f.db_column_name} value={f.db_column_name}>{f.db_column_name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-neutral-500 font-sans text-xs">{t('export_modal.pass_col', "Coluna Senha:")}</span>
                              <select
                                value={exportAuthPassCol}
                                onChange={(e) => setExportAuthPassCol(e.target.value)}
                                className="w-full px-2 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-900 dark:text-white outline-none focus:border-indigo-500 font-mono"
                              >
                                <option value="">{t('export_modal.select_field', "Selecione o campo...")}</option>
                                {exportModels.find(m => m.db_table_name === exportAuthTableName)?.fields?.map((f: any) => (
                                  <option key={f.id || f.db_column_name} value={f.db_column_name}>{f.db_column_name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-neutral-500 font-sans text-xs">{t('export_modal.hash_format', "Formato Hash:")}</span>
                              <select
                                value={exportAuthHash}
                                onChange={(e) => setExportAuthHash(e.target.value)}
                                className="w-full px-2 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-900 dark:text-white outline-none focus:border-indigo-500 font-mono"
                              >
                                <option value="Bcrypt">Bcrypt</option>
                                <option value="Plain">{t('export_modal.plain_text', "Texto Puro")}</option>
                                <option value="MD5">MD5</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Gestão de acesso: os 3 casos de uso + permissões nenhum/leitura/escrita aplicadas no app exportado */}
                        <div
                          onClick={(e) => { e.stopPropagation(); setExportAccessAdmin(v => !v) }}
                          className={cn(
                            'flex items-start justify-between gap-4 p-3 rounded-lg border cursor-pointer transition-all',
                            exportAccessAdmin ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900'
                          )}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-neutral-900 dark:text-white">{t('access_admin.toggle_title', 'Exportar gestão de acesso')}</p>
                            <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                              {t('access_admin.toggle_desc', 'Gera as telas Usuários, Grupos de Acesso e Permissões de Telas num menu próprio e aplica o acesso de cada grupo (nenhum, leitura ou escrita). Cria as tabelas de acesso: o script SQL vai em db/access-control.sql.')}
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={exportAccessAdmin}
                            className={cn('relative w-11 h-6 rounded-full shrink-0 transition-colors', exportAccessAdmin ? 'bg-indigo-600' : 'bg-neutral-300 dark:bg-neutral-700')}
                          >
                            <span className={cn('absolute top-1 w-4 h-4 rounded-full bg-white transition-all', exportAccessAdmin ? 'left-6' : 'left-1')} />
                          </button>
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
                      {t('export_modal.ldap_desc', "Integração corporativa nativa. O app gerado validará no Active Directory do cliente.")}
                    </p>
                    {exportAuthStrategy === 'ldap' && (
                      <div className="ml-7 mt-4 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
                          {t('export_modal.ldap_note_a', "Por questões de segurança corporativa, você precisará configurar as variáveis do LDAP diretamente nas propriedades do projeto exportado. No fonte exportado, preencha as variáveis em seu arquivo")} <code className="bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded">.env.local</code> {t('export_modal.ldap_note_b', "da seguinte forma:")}
                        </p>
                        <div className="relative group">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigator.clipboard.writeText(
                                `# ${t('export_modal.ldap_comment', 'Configurações do Active Directory (LDAP)')}\nLDAP_URL="ldap://10.0.0.15:389"\nLDAP_BASE_DN="dc=empresa,dc=local"\nLDAP_BIND_DN="cn=metabuilder_service,ou=Services,dc=empresa,dc=local"\nLDAP_BIND_PASSWORD="senha_secreta_do_bind"\nLDAP_SEARCH_FILTER="(sAMAccountName={{username}})"`
                              )
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            title={t('export_modal.copy', "Copiar")}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <pre className="text-[10px] text-indigo-400 bg-neutral-950 p-3 rounded border border-neutral-800 overflow-x-auto font-mono leading-tight whitespace-pre">
                            {`# ${t('export_modal.ldap_comment', 'Configurações do Active Directory (LDAP)')}
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
                  {t('export_modal.start', "Iniciar Exportação")}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-950 dark:text-white rounded-xl text-sm font-bold transition-colors"
                >
                  {t('export_modal.cancel', "Cancelar")}
                </button>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {modalState.phase === 'downloading' && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-neutral-500">
                <span>{t('export_modal.progress', "Progresso")}</span>
                <span>{modalState.progress}%</span>
              </div>
              <div className="h-2.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${modalState.progress}%` }}
                />
              </div>
              <p className="text-xs text-center text-neutral-400">
                {isTauri() ? t('export_modal.generating_code', "Gerando o código fonte...") :t('export_modal.preparing_browser', "Preparando arquivo no navegador...")}
              </p>
            </div>
          )}

          {/* Gravando arquivos e instalando dependências: sem botões, a modal só fecha ao terminar */}
          {modalState.phase === 'processing' && (
            <div className="space-y-3">
              <div className="h-2.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full w-1/3 bg-indigo-500 rounded-full animate-pulse" />
              </div>
              <p className="text-xs text-center text-neutral-500">{modalState.statusMessage}</p>
              <p className="text-[11px] text-center text-neutral-400">{t('export_modal.processing_wait', "Isso pode levar alguns minutos. Aguarde até o fim.")}</p>
            </div>
          )}

          {/* Done state */}
          {modalState.phase === 'done' && (
            <div className="space-y-3">
              {modalState.accessTablesExisted !== undefined && (
                <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-900/30 rounded-xl p-3 text-xs text-sky-800 dark:text-sky-300 leading-relaxed">
                  {t('export_modal.access_exists', 'As tabelas de acesso já existem no banco ({n} permissões gravadas) e foram mantidas: nenhum dado foi alterado.').replace('{n}', String(modalState.accessTablesExisted))}
                </div>
              )}
              {backendStack === 'java-spring' && exportAccessAdmin && (
                <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-900/30 rounded-xl p-3 text-xs text-sky-800 dark:text-sky-300 leading-relaxed">
                  {t('export_modal.access_setup_java_note', 'As tabelas de acesso são criadas pelo backend ao subir (db/access-control.sql). Se o usuário do banco não puder criar tabelas, execute esse script no banco com um administrador.')}
                </div>
              )}
              {modalState.accessSetupNote && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  {t('export_modal.access_setup_note', "Antes de entrar no app, crie as tabelas de acesso: na pasta do projeto rode npm run db:setup (ou execute db/access-control.sql no banco).")}
                </div>
              )}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3 text-xs text-emerald-700 dark:text-emerald-400 text-center font-medium">
                {isTauri() ? t('export_modal.project_saved_in', "Projeto salvo em:") : t('export_modal.saved_in', "Arquivo salvo em:")} <span className="font-bold break-all">{isTauri() && modalState.savedDir ? modalState.savedDir : t('export_modal.downloads', "Downloads")}</span>
              </div>

              {/* Rodar o app exportado: terminal próprio + navegador ou navegador da IDE */}
              {canRunDev && (
                <div className="space-y-2">
                  {!devStarted && devPreparing ? (
                    <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 text-xs font-semibold text-amber-700 dark:text-amber-300">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      {devPreparing}
                    </div>
                  ) : !devStarted ? (
                    <button
                      onClick={handleRunDev}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                    >
                      <Play className="w-4 h-4" />
                      {backendStack === 'java-spring'
                        ? t('export_modal.run_dev_java', "Executar o app (backend Java + frontend)")
                        : t('export_modal.run_dev', "Executar o app (npm run dev)")}
                    </button>
                  ) : (
                    <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-900/10 p-3 space-y-2.5">
                      <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">{t('export_modal.dev_started', 'O app está subindo em uma janela de terminal. Quando ela mostrar "Ready", abra no navegador:')}</p>
                      <input
                        value={devUrl}
                        onChange={(e) => setDevUrl(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 rounded-lg outline-none focus:border-indigo-500"
                      />
                      <p className={cn('flex items-center gap-1.5 text-[11px] font-semibold', devReady ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                        {devReady ? <CheckCircle className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {devReady ? t('export_modal.dev_ready', 'App no ar! Abra no navegador:') : (backendStack === 'java-spring' ? t('export_modal.dev_waiting_java', 'Aguardando o backend Java e o frontend subirem (a primeira vez baixa dependências e pode levar alguns minutos)...') : t('export_modal.dev_waiting', 'Aguardando o app subir...'))}
                      </p>
                      <div className="flex gap-2">
                        <button
                          disabled={!devReady}
                          onClick={() => openExternalUrl(devUrl)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-neutral-900"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          {t('export_modal.open_in_browser', "Navegador")}
                        </button>
                        <button
                          disabled={!devReady}
                          onClick={() => openPreview(devUrl, modalState.fileName.replace(/-source-code\.zip$/, ''))}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-neutral-900"
                        >
                          <AppWindow className="w-3.5 h-3.5" />
                          {t('export_modal.open_in_ide', "Navegador da IDE")}
                        </button>
                      </div>
                      <button
                        onClick={handleStopDev}
                        disabled={devStopping}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-red-200 dark:border-red-900/40 bg-white dark:bg-neutral-900 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      >
                        {devStopping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-current" />}
                        {devStopping ? t('export_modal.stopping_dev', 'Parando...') : t('export_modal.stop_dev', 'Parar o servidor')}
                      </button>
                    </div>
                  )}
                  {devError && <p className="text-[11px] text-red-600 dark:text-red-400 text-center">{t('export_modal.dev_failed', "Não foi possível iniciar o npm run dev. Rode manualmente na pasta do projeto.")} {devError}</p>}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2.5">
                {isTauri() ? (
                  <button
                    onClick={() => handleOpenFolder(modalState.savedDir, modalState.savedPath)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <FolderOpen className="w-4 h-4" />
                    {t('export_modal.open_folder', "Abrir Pasta")}
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                  >
                    {t('export_modal.done_btn', "Concluído")}
                  </button>
                )}
              </div>

              {isTauri() && (
                <button
                  onClick={onClose}
                  className="w-full text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 font-bold uppercase tracking-widest py-1 transition-colors"
                >
                  {t('export_modal.close', "Fechar")}
                </button>
              )}
            </div>
          )}

          {/* Error state */}
          {modalState.phase === 'error' && (
            <div className="space-y-3">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl p-3 text-xs text-red-700 dark:text-red-400 text-center font-medium">
                {modalState.errorMessage || t('export_modal.default_error', "Ocorreu um erro ao gerar o arquivo de código fonte.")}
              </div>
              <button
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-xl text-sm font-bold transition-colors"
              >
                {t('export_modal.close', "Fechar")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
