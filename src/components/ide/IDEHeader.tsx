'use client'

import React, { useState } from 'react'
import {
  FolderGit2, XCircle, Loader2, CheckCircle2, DownloadCloud,
  Save, UploadCloud, Download, History, Settings, Package,
  PanelBottomOpen, PanelLeftOpen, Minimize2, X,
  Server, Coffee, Lock, Clock, ChevronRight,
  Database, ShieldCheck, FileCode2, FlaskConical, Box, FileText, Check
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/i18n'

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
    <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
      {children}
    </h4>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-neutral-300 mb-1.5">{children}</label>
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#141414] border border-neutral-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder-neutral-600"
    />
  )
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-[#141414] border border-neutral-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
    >
      {options.map(o => <option key={o.value} value={o.value} className="bg-neutral-900">{o.label}</option>)}
    </select>
  )
}

function CheckboxRow({
  label,
  description,
  checked,
  onChange,
  badge,
  children
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
  badge?: string
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <label className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer group select-none ${
        checked
          ? 'bg-indigo-500/5 border-indigo-500/30'
          : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/40'
      }`}>
        <div className="pt-0.5">
          <input
            type="checkbox"
            checked={checked}
            onChange={e => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 focus:ring-offset-transparent cursor-pointer accent-indigo-600 shrink-0"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold transition-colors ${checked ? 'text-white' : 'text-neutral-300 group-hover:text-white'}`}>
              {label}
            </span>
            {badge && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-neutral-400 group-hover:text-neutral-300 mt-1 font-mono">
              {description}
            </p>
          )}
        </div>
      </label>
      {checked && children && (
        <div className="ml-7 pl-3 border-l-2 border-indigo-500/40 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
          {children}
        </div>
      )}
    </div>
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
    <div className="flex flex-wrap gap-4">
      {options.map(o => (
        <label key={o.value} className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-300 hover:text-white transition-colors">
          <input type="radio" checked={value === o.value} onChange={() => onChange(o.value)} className="accent-indigo-500 w-3.5 h-3.5" />
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
    <div className="space-y-6">
      {/* Informative Database Card */}
      <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white">Banco de Dados Vinculado</h4>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                Auto-detectado
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              O driver e a connection string configurados no projeto são injetados diretamente no código gerado durante a sincronização.
            </p>
          </div>
        </div>
      </div>

      {/* Autenticação */}
      <div className="bg-neutral-900/50 p-5 rounded-xl border border-neutral-800 space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span>Autenticação</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Tipo de Autenticação</FieldLabel>
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
            <FieldLabel>Hash de Senha</FieldLabel>
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

      {/* Projeto */}
      <div className="bg-neutral-900/50 p-5 rounded-xl border border-neutral-800 space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <Package className="w-4 h-4 text-sky-400" />
          <span>Metadados do Projeto</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Nome do Projeto</FieldLabel>
            <TextInput value={config.projectName} onChange={v => set('projectName', v)} placeholder="Meu CRM" />
          </div>
          <div>
            <FieldLabel>Slug do Projeto</FieldLabel>
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
    <div className="space-y-6">
      {/* Informative Database Card */}
      <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white">Banco de Dados & Conexão do Projeto</h4>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                Sincronizado
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              O driver e a connection string configurados no projeto são injetados automaticamente no <code className="text-neutral-300 font-mono text-[11px]">src/main/resources/application.properties</code> durante o Eject.
            </p>
          </div>
        </div>
      </div>

      {/* Configurações Base */}
      <div className="bg-neutral-900/50 p-5 rounded-xl border border-neutral-800 space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <Coffee className="w-4 h-4 text-amber-400" />
          <span>Configurações Base (Spring Boot)</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Versão do JDK</FieldLabel>
            <RadioGroup
              value={config.jdkVersion}
              onChange={v => set('jdkVersion', v)}
              options={[
                { value: '17', label: 'Java 17 (LTS)' },
                { value: '21', label: 'Java 21 (LTS)' }
              ]}
            />
          </div>
          <div>
            <FieldLabel>Porta do Servidor</FieldLabel>
            <input
              type="number"
              value={config.port}
              onChange={e => set('port', Number(e.target.value))}
              className="w-full bg-[#141414] border border-neutral-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
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
        </div>
      </div>

      {/* Segurança */}
      <div className="bg-neutral-900/50 p-5 rounded-xl border border-neutral-800 space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span>Segurança</span>
        </div>
        <CheckboxRow
          label="Autenticação JWT"
          description="Gera SecurityConfig.java, JwtUtil.java, JwtFilter.java e AuthController.java"
          checked={config.jwt}
          onChange={v => set('jwt', v)}
          badge="Recomendado"
        >
          <div>
            <FieldLabel>Algoritmo de Hash da Senha</FieldLabel>
            <RadioGroup
              value={config.jwtHash}
              onChange={v => set('jwtHash', v)}
              options={[
                { value: 'bcrypt', label: 'BCrypt (Recomendado)' },
                { value: 'sha256', label: 'SHA-256' }
              ]}
            />
          </div>
        </CheckboxRow>
      </div>

      {/* Migrations */}
      <div className="bg-neutral-900/50 p-5 rounded-xl border border-neutral-800 space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <FileCode2 className="w-4 h-4 text-emerald-400" />
          <span>Migrations</span>
        </div>
        <CheckboxRow
          label="Gerar Migrations SQL"
          description="Cria V1__init.sql em resources/db/migration/ baseado nas entidades do projeto"
          checked={config.migrations}
          onChange={v => set('migrations', v)}
        >
          <div>
            <FieldLabel>Engine de Migration</FieldLabel>
            <RadioGroup
              value={config.migrationEngine}
              onChange={v => set('migrationEngine', v)}
              options={[
                { value: 'flyway', label: 'Flyway (Padrão Spring Boot)' },
                { value: 'liquibase', label: 'Liquibase' }
              ]}
            />
          </div>
        </CheckboxRow>
      </div>

      {/* Testes */}
      <div className="bg-neutral-900/50 p-5 rounded-xl border border-neutral-800 space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <FlaskConical className="w-4 h-4 text-amber-400" />
          <span>Testes Automatizados</span>
        </div>
        <div className="space-y-3">
          <CheckboxRow
            label="Gerar Testes Unitários de Service"
            description="{Model}ServiceTest.java com @SpringBootTest + JUnit 5 + Mockito"
            checked={config.testService}
            onChange={v => set('testService', v)}
          />
          <CheckboxRow
            label="Gerar Testes de Controller"
            description="{Model}ControllerTest.java com MockMvc"
            checked={config.testController}
            onChange={v => set('testController', v)}
          />
        </div>
      </div>

      {/* DevOps / Containerização */}
      <div className="bg-neutral-900/50 p-5 rounded-xl border border-neutral-800 space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <Box className="w-4 h-4 text-sky-400" />
          <span>DevOps / Containerização</span>
        </div>
        <div className="space-y-3">
          <CheckboxRow
            label="Gerar Dockerfile"
            description="Multi-stage build otimizado para produção com Eclipse Temurin"
            checked={config.dockerfile}
            onChange={v => set('dockerfile', v)}
            badge="Padrão"
          />
          <CheckboxRow
            label="Gerar docker-compose.yml"
            description="Configuração pronta de App Spring Boot + banco de dados integrado via containers"
            checked={config.dockerCompose}
            onChange={v => set('dockerCompose', v)}
            badge="Padrão"
          />
          <CheckboxRow
            label="Gerar .env.example"
            description="Variáveis de ambiente do Spring documentadas com valores de exemplo"
            checked={config.envExample}
            onChange={v => set('envExample', v)}
            badge="Padrão"
          />
        </div>
      </div>

      {/* Documentação / API */}
      <div className="bg-neutral-900/50 p-5 rounded-xl border border-neutral-800 space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <FileText className="w-4 h-4 text-purple-400" />
          <span>Documentação / API</span>
        </div>
        <div className="space-y-3">
          <CheckboxRow
            label="Swagger / OpenAPI"
            description="OpenApiConfig.java com interface Swagger UI interativa habilitada"
            checked={config.swagger}
            onChange={v => set('swagger', v)}
            badge="Padrão"
          />
          <CheckboxRow
            label="Gerar README"
            description="backend/README.md com documentação completa de setup, build e execução"
            checked={config.readme}
            onChange={v => set('readme', v)}
            badge="Padrão"
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
      <div className="text-5xl p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 shadow-inner">{icon}</div>
      <div>
        <p className="text-lg font-bold text-white">{label}</p>
        <p className="text-sm text-neutral-400 mt-1">Em breve disponível para Eject & Sync no MetaBuilder PRO</p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center mt-2 max-w-md">
        {features.map(f => (
          <span key={f} className="px-2.5 py-1 text-xs bg-neutral-900 text-neutral-400 border border-neutral-800 rounded-full font-mono">{f}</span>
        ))}
      </div>
      <div className="mt-2 px-3.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs font-semibold text-amber-400 flex items-center gap-2">
        <Clock className="w-3.5 h-3.5" /> Roadmap — aguarde novidades nas próximas releases!
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
    jwt: true,
    jwtHash: 'bcrypt',
    migrations: true,
    migrationEngine: 'flyway',
    testService: false,
    testController: false,
    dockerfile: true,
    dockerCompose: true,
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

      {/* ── Eject & Sync Modal (Enterprise Layout) ── */}
      <AnimatePresence>
        {isSyncModalOpen && (
          <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-4xl bg-[#1e1e1e] border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-[#151515] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                    <DownloadCloud className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Configuração de Eject & Sincronização</h2>
                    <p className="text-xs text-neutral-400">Configure os parâmetros da stack, componentes e arquitetura do backend</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSyncModalOpen(false)}
                  className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tab Bar */}
              <div className="flex px-6 pt-4 border-b border-neutral-800 gap-6 bg-[#151515] overflow-x-auto scrollbar-none shrink-0">
                {TABS.map(tab => {
                  const isActive = activeTab === tab.id
                  const isLocked = tab.status === 'roadmap'
                  const isSoon   = tab.status === 'soon'

                  return (
                    <button
                      key={tab.id}
                      onClick={() => !isLocked && setActiveTab(tab.id)}
                      disabled={isLocked}
                      className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors shrink-0 ${
                        isActive
                          ? 'border-indigo-500 text-white'
                          : isLocked
                            ? 'border-transparent text-neutral-600 cursor-not-allowed'
                            : 'border-transparent text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <span className="text-base">{tab.icon}</span>
                      <span>{tab.label}</span>
                      {isSoon && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full leading-none">
                          EM BREVE
                        </span>
                      )}
                      {isLocked && (
                        <Lock className="w-3 h-3 text-neutral-600 ml-0.5" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Content Area */}
              <div className="p-6 bg-[#1a1a1a] flex-1 overflow-y-auto max-h-[65vh]">
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
              <div className="p-4 bg-[#151515] border-t border-neutral-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <span className="text-lg">{activeTabDef.icon}</span>
                  <span>
                    {canSync
                      ? `Sincronizando projeto como: ${activeTabDef.label}`
                      : 'Selecione uma stack disponível para sincronizar'
                    }
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsSyncModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold text-neutral-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmSync}
                    disabled={!canSync}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <DownloadCloud className="w-4 h-4" />
                    Sincronizar Repositório
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
