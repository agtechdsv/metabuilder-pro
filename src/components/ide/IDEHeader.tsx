'use client'

import React from 'react'
import {
  FolderGit2, XCircle, Loader2, CheckCircle2, DownloadCloud,
  Save, UploadCloud, Download, History, Settings, Package,
  PanelBottomOpen, PanelLeftOpen, Minimize2, X,
  Server, Coffee, Lock, Clock, ChevronRight
} from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '@/i18n'
import { Modal } from '@/components/ui/Modal'

export interface IDEHeaderProps {
  target: { type: 'project' | 'workspace'; id: string; name: string; slug: string }
  sandboxMode: boolean
  setShowDiscardConfirm: (show: boolean) => void
  isDiscarding: boolean
  isConfirming: boolean
  handleOpenCommitModal: (mode: 'commit' | 'merge') => void
  handleSyncFromWeb: (backendStack?: string, javaGroupId?: string, javaPort?: number) => void
  isSyncing: boolean
  selectedBranch: string
  handleBranchChange: (branch: string) => void
  branches: string[]
  isCommitLoading: boolean
  isCommitting: boolean
  handlePushToRemote: () => void
  isPushing: boolean
  handlePullFromRemote: () => void
  isPulling: boolean
  handleShowLogs: () => void
  setShowGitSettings: (show: boolean) => void
  setShowNativeExport: (show: boolean) => void
  showConsole: boolean
  setShowConsole: React.Dispatch<React.SetStateAction<boolean>>
  showSidebar: boolean
  setShowSidebar: React.Dispatch<React.SetStateAction<boolean>>
  setIsMinimized: (minimized: boolean) => void
  closeIDE: () => void
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
type StackTab = 'nodejs' | 'nestjs' | 'java' | 'python' | 'csharp' | 'php' | 'go' | 'rails'

interface TabDef {
  id: StackTab
  label: string
  icon: string
  status: 'available' | 'soon' | 'roadmap'
}

const TABS: TabDef[] = [
  { id: 'nodejs',  label: 'Node.js',  icon: '🟢', status: 'available' },
  { id: 'nestjs',  label: 'NestJS',   icon: '🦅', status: 'soon'      },
  { id: 'java',    label: 'Java',     icon: '☕', status: 'available' },
  { id: 'python',  label: 'Python',   icon: '🐍', status: 'roadmap'   },
  { id: 'csharp',  label: 'C#',       icon: '💜', status: 'roadmap'   },
  { id: 'php',     label: 'PHP',      icon: '🐘', status: 'roadmap'   },
  { id: 'go',      label: 'Go',       icon: '🐹', status: 'roadmap'   },
  { id: 'rails',   label: 'Rails',    icon: '💎', status: 'roadmap'   },
]

// ─── Small reusable primitives ────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
      {children}
    </h4>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-neutral-400 mb-1">{children}</label>
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-black/40 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-neutral-600"
    />
  )
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-black/40 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
    >
      {options.map(o => <option key={o.value} value={o.value} className="bg-neutral-900">{o.label}</option>)}
    </select>
  )
}

function ToggleRow({ label, description, checked, onChange, children }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; children?: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-200 font-medium">{label}</p>
          {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
        </div>
        <button
          onClick={() => onChange(!checked)}
          className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-neutral-700'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
        </button>
      </div>
      {checked && children && (
        <div className="ml-3 pl-3 border-l border-neutral-700 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
          {children}
        </div>
      )}
    </div>
  )
}

function RadioGroup({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex gap-3">
      {options.map(o => (
        <label key={o.value} className="flex items-center gap-1.5 cursor-pointer text-xs text-neutral-300">
          <input type="radio" checked={value === o.value} onChange={() => onChange(o.value)} className="accent-indigo-500" />
          {o.label}
        </label>
      ))}
    </div>
  )
}

// ─── Node.js config panel ─────────────────────────────────────────────────────
function NodeJsPanel({ config, onChange }: { config: NodeConfig; onChange: (c: NodeConfig) => void }) {
  const set = <K extends keyof NodeConfig>(k: K, v: NodeConfig[K]) => onChange({ ...config, [k]: v })
  const setAuth = <K extends keyof NodeConfig['auth']>(k: K, v: NodeConfig['auth'][K]) =>
    onChange({ ...config, auth: { ...config.auth, [k]: v } })

  return (
    <div className="space-y-5">
      <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-4">
        <SectionTitle>🗄️ Banco de Dados</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Banco de dados</FieldLabel>
            <SelectInput
              value={config.dbStack}
              onChange={v => set('dbStack', v)}
              options={[
                { value: 'postgresql', label: 'PostgreSQL' },
                { value: 'mysql',      label: 'MySQL' },
                { value: 'sqlserver',  label: 'SQL Server' },
                { value: 'oracle',     label: 'Oracle' },
                { value: 'supabase',   label: 'Supabase' },
              ]}
            />
          </div>
          <div>
            <FieldLabel>Connection String</FieldLabel>
            <TextInput value={config.connectionString} onChange={v => set('connectionString', v)} placeholder="postgresql://user:pass@host/db" />
          </div>
        </div>
      </div>

      <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-4">
        <SectionTitle>🔐 Autenticação</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Tipo de autenticação</FieldLabel>
            <SelectInput
              value={config.auth.authType}
              onChange={v => setAuth('authType', v)}
              options={[
                { value: 'database', label: 'Banco de dados' },
                { value: 'supabase', label: 'Managed (Supabase)' },
                { value: 'ldap',     label: 'LDAP' },
                { value: 'none',     label: 'Nenhum' },
              ]}
            />
          </div>
          <div>
            <FieldLabel>Hash de senha</FieldLabel>
            <SelectInput
              value={config.auth.hashFormat}
              onChange={v => setAuth('hashFormat', v)}
              options={[
                { value: 'bcrypt',  label: 'bcrypt' },
                { value: 'md5',     label: 'MD5' },
                { value: 'sha256',  label: 'SHA-256' },
                { value: 'plain',   label: 'Plain' },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-4">
        <SectionTitle>🔧 Projeto</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Nome do projeto</FieldLabel>
            <TextInput value={config.projectName} onChange={v => set('projectName', v)} placeholder="Meu CRM" />
          </div>
          <div>
            <FieldLabel>Slug</FieldLabel>
            <TextInput value={config.projectSlug} onChange={v => set('projectSlug', v)} placeholder="meu-crm" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Java config panel ────────────────────────────────────────────────────────
function JavaPanel({ config, onChange }: { config: JavaConfig; onChange: (c: JavaConfig) => void }) {
  const set = <K extends keyof JavaConfig>(k: K, v: JavaConfig[K]) => onChange({ ...config, [k]: v })

  return (
    <div className="space-y-5">
      <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-4">
        <SectionTitle>☕ Configurações Base</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Versão do JDK</FieldLabel>
            <RadioGroup value={config.jdkVersion} onChange={v => set('jdkVersion', v)} options={[{ value: '17', label: 'Java 17' }, { value: '21', label: 'Java 21' }]} />
          </div>
          <div>
            <FieldLabel>Porta do servidor</FieldLabel>
            <input
              type="number"
              value={config.port}
              onChange={e => set('port', Number(e.target.value))}
              className="w-full bg-black/40 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
          <div>
            <FieldLabel>Group ID</FieldLabel>
            <TextInput value={config.groupId} onChange={v => set('groupId', v)} placeholder="com.empresa" />
          </div>
          <div>
            <FieldLabel>Artifact ID</FieldLabel>
            <TextInput value={config.artifactId} onChange={v => set('artifactId', v)} placeholder="crm-backend" />
          </div>
          <div>
            <FieldLabel>Banco de dados</FieldLabel>
            <SelectInput
              value={config.dbStack}
              onChange={v => set('dbStack', v)}
              options={[
                { value: 'postgresql', label: 'PostgreSQL' },
                { value: 'mysql',      label: 'MySQL' },
                { value: 'sqlserver',  label: 'SQL Server' },
                { value: 'oracle',     label: 'Oracle' },
              ]}
            />
          </div>
          <div>
            <FieldLabel>Connection String</FieldLabel>
            <TextInput value={config.connectionString} onChange={v => set('connectionString', v)} placeholder="jdbc:postgresql://localhost:5432/db" />
          </div>
        </div>
      </div>

      <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-4">
        <SectionTitle>🔐 Segurança</SectionTitle>
        <ToggleRow
          label="Autenticação JWT"
          description="Gera SecurityConfig.java, JwtUtil.java, JwtFilter.java e AuthController.java"
          checked={config.jwt}
          onChange={v => set('jwt', v)}
        >
          <div>
            <FieldLabel>Tipo de hash</FieldLabel>
            <RadioGroup value={config.jwtHash} onChange={v => set('jwtHash', v)} options={[{ value: 'bcrypt', label: 'BCrypt' }, { value: 'sha256', label: 'SHA-256' }]} />
          </div>
        </ToggleRow>
      </div>

      <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-4">
        <SectionTitle>🗃️ Migrations</SectionTitle>
        <ToggleRow
          label="Gerar migrations SQL"
          description="Cria V1__init.sql em resources/db/migration/"
          checked={config.migrations}
          onChange={v => set('migrations', v)}
        >
          <div>
            <FieldLabel>Engine de migration</FieldLabel>
            <RadioGroup value={config.migrationEngine} onChange={v => set('migrationEngine', v)} options={[{ value: 'flyway', label: 'Flyway' }, { value: 'liquibase', label: 'Liquibase' }]} />
          </div>
        </ToggleRow>
      </div>

      <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-4">
        <SectionTitle>🧪 Testes</SectionTitle>
        <div className="space-y-3">
          <ToggleRow
            label="Gerar testes unitários de Service"
            description="{Model}ServiceTest.java com @SpringBootTest + JUnit 5"
            checked={config.testService}
            onChange={v => set('testService', v)}
          />
          <ToggleRow
            label="Gerar testes de Controller"
            description="{Model}ControllerTest.java com MockMvc"
            checked={config.testController}
            onChange={v => set('testController', v)}
          />
        </div>
      </div>

      <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-4">
        <SectionTitle>🐳 DevOps / Containerização</SectionTitle>
        <div className="space-y-3">
          <ToggleRow
            label="Gerar Dockerfile"
            description="Multi-stage build otimizado para produção"
            checked={config.dockerfile}
            onChange={v => set('dockerfile', v)}
          />
          <ToggleRow
            label="Gerar docker-compose.yml"
            description="App + banco de dados integrado"
            checked={config.dockerCompose}
            onChange={v => set('dockerCompose', v)}
          />
          <ToggleRow
            label="Gerar .env.example"
            description="Variáveis de ambiente do Spring documentadas"
            checked={config.envExample}
            onChange={v => set('envExample', v)}
          />
        </div>
      </div>

      <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-4">
        <SectionTitle>📄 Documentação / API</SectionTitle>
        <div className="space-y-3">
          <ToggleRow
            label="Swagger / OpenAPI"
            description="OpenApiConfig.java com interface interativa"
            checked={config.swagger}
            onChange={v => set('swagger', v)}
          />
          <ToggleRow
            label="Gerar README"
            description="backend/README.md com instruções de setup"
            checked={config.readme}
            onChange={v => set('readme', v)}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Placeholder for upcoming stacks ─────────────────────────────────────────
function ComingSoonPanel({ icon, label, features }: { icon: string; label: string; features: string[] }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4">
      <div className="text-5xl">{icon}</div>
      <div>
        <p className="text-lg font-bold text-neutral-200">{label}</p>
        <p className="text-sm text-neutral-500 mt-1">Em breve disponível no MetaBuilder PRO</p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center mt-2">
        {features.map(f => (
          <span key={f} className="px-2.5 py-1 text-xs bg-neutral-800 text-neutral-400 border border-neutral-700 rounded-full">{f}</span>
        ))}
      </div>
      <div className="mt-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400 flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" /> Roadmap — aguarde novidades!
      </div>
    </div>
  )
}

// ─── Config types ─────────────────────────────────────────────────────────────
interface NodeConfig {
  dbStack: string
  connectionString: string
  auth: { authType: string; hashFormat: string }
  projectName: string
  projectSlug: string
}

interface JavaConfig {
  jdkVersion: string
  groupId: string
  artifactId: string
  port: number
  dbStack: string
  connectionString: string
  jwt: boolean
  jwtHash: string
  migrations: boolean
  migrationEngine: string
  testService: boolean
  testController: boolean
  dockerfile: boolean
  dockerCompose: boolean
  envExample: boolean
  swagger: boolean
  readme: boolean
}

export function IDEHeader({
  target,
  sandboxMode,
  setShowDiscardConfirm,
  isDiscarding,
  isConfirming,
  handleOpenCommitModal,
  handleSyncFromWeb,
  isSyncing,
  selectedBranch,
  handleBranchChange,
  branches,
  isCommitLoading,
  isCommitting,
  handlePushToRemote,
  isPushing,
  handlePullFromRemote,
  isPulling,
  handleShowLogs,
  setShowGitSettings,
  setShowNativeExport,
  showConsole,
  setShowConsole,
  showSidebar,
  setShowSidebar,
  setIsMinimized,
  closeIDE
}: IDEHeaderProps) {
  const { t } = useI18n()
  const defaultGroupId = `com.${target.slug.replace(/-/g, '').toLowerCase() || 'app'}`

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<StackTab>('nodejs')

  const [nodeConfig, setNodeConfig] = useState<NodeConfig>({
    dbStack: 'postgresql',
    connectionString: '',
    auth: { authType: 'database', hashFormat: 'bcrypt' },
    projectName: target.name,
    projectSlug: target.slug,
  })

  const [javaConfig, setJavaConfig] = useState<JavaConfig>({
    jdkVersion: '21',
    groupId: defaultGroupId,
    artifactId: `${target.slug}-backend`,
    port: 8080,
    dbStack: 'postgresql',
    connectionString: '',
    jwt: false,
    jwtHash: 'bcrypt',
    migrations: false,
    migrationEngine: 'flyway',
    testService: false,
    testController: false,
    dockerfile: false,
    dockerCompose: false,
    envExample: true,
    swagger: true,
    readme: true,
  })

  const confirmSync = () => {
    setIsSyncModalOpen(false)
    if (activeTab === 'java') {
      handleSyncFromWeb('java-spring', javaConfig.groupId, javaConfig.port)
    } else {
      handleSyncFromWeb('nodejs')
    }
  }

  const activeTabDef = TABS.find(t => t.id === activeTab)!
  const canSync = activeTab === 'nodejs' || activeTab === 'java'

  return (
    <div className="bg-[#1a1b1e] border-b border-neutral-800 flex items-center justify-between px-4 py-2 shrink-0 shadow-lg relative">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400">
          <FolderGit2 className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white leading-tight">
            {t('workspace_components.ide_local.title', 'IDE Local')}
          </span>
          <span className="text-xs text-neutral-500">
            {target.type === 'workspace' ? 'Workspace' : 'Projeto'}: {target.name}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Botões de Ação da IDE */}
        <div className="flex items-center gap-2 mr-4 border-r border-neutral-800 pr-4">
          {sandboxMode ? (
            <>
              <button
                onClick={() => setShowDiscardConfirm(true)}
                disabled={isDiscarding || isConfirming}
                className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                {isDiscarding ? t('workspace_components.ide_local.discarding', 'Descartando...') : t('workspace_components.ide_local.discard', 'Descartar')}
              </button>
              <button
                onClick={() => handleOpenCommitModal('merge')}
                disabled={isDiscarding || isConfirming}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {isConfirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {isConfirming ? t('workspace_components.ide_local.confirming', 'Confirmando...') : t('workspace_components.ide_local.confirm_merge', 'Confirmar Merge')}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsSyncModalOpen(true)}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              {isSyncing ? t('workspace_components.ide_local.syncing', 'Sincronizando...') : t('workspace_components.ide_local.eject_sync', 'Ejetar & Sincronizar')}
            </button>
          )}

          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden h-8">
            <div className="px-2 bg-neutral-800 text-neutral-400 border-r border-neutral-700 flex items-center h-full">
              <FolderGit2 className="w-3.5 h-3.5" />
            </div>
            <select
              value={selectedBranch}
              onChange={(e) => handleBranchChange(e.target.value)}
              className="bg-transparent text-xs text-neutral-300 font-mono px-2 py-1 outline-none min-w-[120px] h-full"
            >
              <option value="__NEW_BRANCH__" className="text-emerald-400 font-bold bg-neutral-900">
                {t('workspace_components.ide_local.new_branch', '+ Nova Branch...')}
              </option>
              <optgroup label={t('workspace_components.ide_local.branches_group', 'Branches')}>
                {branches.map(b => (
                  <option key={b} value={b} className="bg-neutral-900 text-neutral-300">
                    {b}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <button
            onClick={() => handleOpenCommitModal('commit')}
            disabled={isCommitLoading || isCommitting}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            title="Commit Local"
          >
            {isCommitLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Commit
          </button>

          <button
            onClick={handlePushToRemote}
            disabled={isPushing}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            title={t('workspace_components.ide_local.push_tooltip', 'Push para Remoto (GitHub)')}
          >
            {isPushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />} Push
          </button>

          <button
            onClick={handlePullFromRemote}
            disabled={isPulling}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            title={t('workspace_components.ide_local.pull_tooltip', 'Pull do Remoto (GitHub)')}
          >
            {isPulling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Pull
          </button>

          <button
            onClick={handleShowLogs}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold transition-colors"
            title={t('workspace_components.ide_local.history_tooltip', 'Ver Histórico (Git Log)')}
          >
            <History className="w-3.5 h-3.5" /> {t('workspace_components.ide_local.history_btn', 'Histórico')}
          </button>

          <button
            onClick={() => setShowGitSettings(true)}
            className="flex items-center justify-center w-8 h-8 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-colors border border-neutral-700"
            title={t('workspace_components.ide_local.git_settings_tooltip', 'Configurações Git (Remote & Pipeline)')}
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowNativeExport(true)}
            className="flex items-center justify-center gap-1.5 px-2.5 h-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-xs font-bold border border-indigo-500"
            title="Ejetar código-fonte nativo (Next.js puro)"
          >
            <Package className="w-3.5 h-3.5" />
            Ejetar
          </button>

          {/* Console toggle button */}
          <button
            onClick={() => setShowConsole(v => !v)}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors border ${showConsole
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-700'
              }`}
            title={showConsole ? t('workspace_components.ide_local.hide_console', 'Ocultar Console') : t('workspace_components.ide_local.show_console', 'Mostrar Console')}
          >
            <PanelBottomOpen className="w-4 h-4" />
          </button>

          {/* Sidebar toggle button */}
          <button
            onClick={() => setShowSidebar(v => !v)}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors border ${showSidebar
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-700'
              }`}
            title={showSidebar ? t('workspace_components.ide_local.hide_files', 'Ocultar Arquivos') : t('workspace_components.ide_local.show_files', 'Mostrar Arquivos')}
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => setIsMinimized(true)}
          className="px-3 py-1.5 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all flex items-center gap-2 text-xs font-bold"
          title={t('workspace_components.ide_local.minimize_ide', 'Minimizar IDE')}
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={closeIDE}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-red-500/80 text-neutral-300 hover:text-white transition-colors"
          title={t('workspace_components.ide_local.close_ide', 'Fechar IDE')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Sync Modal ── */}
      <Modal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} title="Configuração de Sincronização">
        <div className="flex flex-col bg-[#1a1b1e] rounded-b-xl" style={{ width: '780px', maxWidth: '96vw', maxHeight: '82vh' }}>

          {/* Tab bar */}
          <div className="flex border-b border-neutral-800 px-4 gap-1 shrink-0 overflow-x-auto scrollbar-none">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id
              const isLocked = tab.status === 'roadmap'
              const isSoon   = tab.status === 'soon'

              return (
                <button
                  key={tab.id}
                  onClick={() => !isLocked && setActiveTab(tab.id)}
                  disabled={isLocked}
                  className={`relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap shrink-0
                    ${isActive
                      ? 'border-indigo-500 text-white'
                      : isLocked
                        ? 'border-transparent text-neutral-600 cursor-not-allowed'
                        : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 cursor-pointer'
                    }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {isSoon && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full leading-none">
                      EM BREVE
                    </span>
                  )}
                  {isLocked && (
                    <Lock className="w-2.5 h-2.5 text-neutral-600" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className="overflow-y-auto flex-1 p-5">
            {activeTab === 'nodejs' && <NodeJsPanel config={nodeConfig} onChange={setNodeConfig} />}
            {activeTab === 'java'   && <JavaPanel   config={javaConfig} onChange={setJavaConfig} />}
            {activeTab === 'nestjs' && (
              <ComingSoonPanel icon="🦅" label="NestJS + Prisma"
                features={['TypeScript nativo', 'Decorators', 'Prisma ORM', 'Swagger integrado', 'Guards & Interceptors']} />
            )}
            {activeTab === 'python' && (
              <ComingSoonPanel icon="🐍" label="Python FastAPI"
                features={['FastAPI', 'SQLAlchemy', 'Pydantic', 'Alembic Migrations', 'Async/await']} />
            )}
            {activeTab === 'csharp' && (
              <ComingSoonPanel icon="💜" label="C# .NET 8"
                features={['.NET 8 Minimal API', 'Entity Framework', 'JWT Auth', 'Swagger', 'Docker ready']} />
            )}
            {activeTab === 'php' && (
              <ComingSoonPanel icon="🐘" label="PHP (Laravel)"
                features={['Laravel 11', 'Eloquent ORM', 'Sanctum Auth', 'Artisan CLI', 'Blade ou API']} />
            )}
            {activeTab === 'go' && (
              <ComingSoonPanel icon="🐹" label="Go (Gin + GORM)"
                features={['Gin Router', 'GORM', 'JWT', 'Air live-reload', 'Docker multi-stage']} />
            )}
            {activeTab === 'rails' && (
              <ComingSoonPanel icon="💎" label="Ruby on Rails"
                features={['Rails 8 API', 'ActiveRecord', 'Devise Auth', 'Swagger', 'RSpec']} />
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-neutral-800 shrink-0">
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <span className="text-lg">{activeTabDef.icon}</span>
              <span>
                {canSync
                  ? `Sincronizando como: ${activeTabDef.label}`
                  : 'Selecione uma stack disponível para sincronizar'
                }
              </span>
            </div>
            <button
              onClick={confirmSync}
              disabled={!canSync}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#1a1b1e] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <DownloadCloud className="w-4 h-4" />
              Sincronizar Repositório
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
