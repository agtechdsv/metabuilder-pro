'use client'

import React, { useState } from 'react'
import { DownloadCloud, Loader2, Code2, Database, CheckCircle2, Server, Coffee, Shield, TestTube, Container, BookOpen } from 'lucide-react'
import { DbType, BackendStack } from '@/lib/generator/ast'
import { useToast } from '@/components/ui/Toast'
import { isTauri } from '@/utils/tauriUtils'

interface NativeExportModalProps {
  isOpen: boolean
  onClose: () => void
  projectSlug: string
  projectId: string
}

const DB_OPTIONS: { value: DbType; label: string; description: string }[] = [
  { value: 'postgres', label: 'PostgreSQL (pg)', description: 'Queries parametrizadas diretas ($1, $2...)' },
  { value: 'supabase', label: 'Supabase SDK', description: 'Client @supabase/ssr com RLS' },
  { value: 'mysql', label: 'MySQL / MariaDB', description: 'Driver mysql2/promise com pool' },
  { value: 'sqlserver', label: 'SQL Server (mssql)', description: 'Bindings nomeados @param' },
  { value: 'oracle', label: 'Oracle DB', description: 'Bindings nomeados :param + connection pool' },
]

const BACKEND_OPTIONS: { value: BackendStack; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'nodejs',
    label: 'Next.js Full-Stack (Node.js)',
    description: 'App Router + React Server Components + Server Actions diretas ao banco',
    icon: <span className="text-green-400 font-bold text-xs">Node</span>,
  },
  {
    value: 'java-spring',
    label: 'Next.js + Spring Boot 3 (Java 21)',
    description: 'Frontend Next.js chamando API REST Spring Boot — estrutura dual frontend/backend',
    icon: <Coffee className="w-4 h-4 text-amber-400" />,
  },
]

export function NativeExportModal({ isOpen, onClose, projectSlug, projectId }: NativeExportModalProps) {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)
  const [dbStack, setDbStack] = useState<DbType>('postgres')
  const [backendStack, setBackendStack] = useState<BackendStack>('nodejs')
  const [javaGroupId, setJavaGroupId] = useState('com.app')
  const [javaPort, setJavaPort] = useState(8080)
  const [done, setDone] = useState(false)

  // Eject Options - Novas configurações dinâmicas
  const [jwtEnabled, setJwtEnabled] = useState(false)
  const [passwordHashAlgorithm, setPasswordHashAlgorithm] = useState<'bcrypt' | 'sha256'>('bcrypt')
  const [generateMigrations, setGenerateMigrations] = useState(true)
  const [migrationEngine, setMigrationEngine] = useState<'flyway' | 'liquibase'>('flyway')
  const [generateServiceTests, setGenerateServiceTests] = useState(false)
  const [generateControllerTests, setGenerateControllerTests] = useState(false)
  const [generateDockerfile, setGenerateDockerfile] = useState(true)
  const [generateDockerCompose, setGenerateDockerCompose] = useState(true)
  const [generateEnvExample, setGenerateEnvExample] = useState(true)

  if (!isOpen) return null

  // GAP fix: reset state on every open so re-opens start clean
  const handleClose = () => {
    setDone(false)
    setBackendStack('nodejs')
    setDbStack('postgres')
    setJavaGroupId('com.app')
    setJavaPort(8080)
    setJwtEnabled(false)
    setPasswordHashAlgorithm('bcrypt')
    setGenerateMigrations(true)
    setMigrationEngine('flyway')
    setGenerateServiceTests(false)
    setGenerateControllerTests(false)
    setGenerateDockerfile(true)
    setGenerateDockerCompose(true)
    setGenerateEnvExample(true)
    onClose()
  }

  const handleEject = async () => {
    setIsExporting(true)
    try {
      const res = await fetch('/api/export-native', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          dbStack,
          backendStack,
          javaGroupId: backendStack === 'java-spring' ? javaGroupId : undefined,
          javaPort: backendStack === 'java-spring' ? javaPort : undefined,
          javaVersion: 21,
          jwtEnabled: backendStack === 'java-spring' ? jwtEnabled : false,
          passwordHashAlgorithm: (backendStack === 'java-spring' && jwtEnabled) ? passwordHashAlgorithm : undefined,
          generateMigrations: backendStack === 'java-spring' ? generateMigrations : false,
          migrationEngine: (backendStack === 'java-spring' && generateMigrations) ? migrationEngine : undefined,
          generateServiceTests: backendStack === 'java-spring' ? generateServiceTests : false,
          generateControllerTests: backendStack === 'java-spring' ? generateControllerTests : false,
          generateDockerfile: backendStack === 'java-spring' ? generateDockerfile : false,
          generateDockerCompose: backendStack === 'java-spring' ? generateDockerCompose : false,
          generateEnvExample: backendStack === 'java-spring' ? generateEnvExample : false,
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao gerar código')
      }

      const buffer = await res.arrayBuffer()
      const merged = new Uint8Array(buffer)
      const zipName = `${projectSlug}-${backendStack === 'java-spring' ? 'java-spring' : 'nodejs'}-source.zip`

      if (isTauri()) {
        const { open } = await import('@tauri-apps/plugin-dialog')
        const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs')
        const { join, dirname } = await import('@tauri-apps/api/path')
        const JSZip = (await import('jszip')).default

        const selectedDir = await open({ directory: true, title: 'Escolha a pasta de destino do projeto' })
        if (!selectedDir || typeof selectedDir !== 'string') {
          setIsExporting(false)
          return
        }

        const zip = await JSZip.loadAsync(merged)
        for (const relativePath of Object.keys(zip.files)) {
          const zipEntry = zip.files[relativePath]
          if (zipEntry.dir) continue

          const fullPath = await join(selectedDir, relativePath)
          const dirPath = await dirname(fullPath)

          try { await mkdir(dirPath, { recursive: true }) } catch (_) { /* pasta já existe */ }

          const fileBytes = await zipEntry.async('uint8array')
          await writeFile(fullPath, fileBytes)
        }

        setDone(true)
        toast(`Projeto ejetado com sucesso em ${selectedDir}!`, 'success')
      } else {
        const blob = new Blob([merged], { type: 'application/zip' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = zipName
        a.click()
        URL.revokeObjectURL(url)
        setDone(true)
        toast('Download iniciado!', 'success')
      }
    } catch (err: any) {
      toast('Erro ao ejetar: ' + err.message, 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const isJava = backendStack === 'java-spring'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-indigo-600 px-6 py-5 flex items-center gap-3 shrink-0">
          <Code2 className="text-white w-6 h-6" />
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Ejetar Código-Fonte Nativo</h2>
            <p className="text-indigo-200 text-xs mt-0.5">{projectSlug}</p>
          </div>
        </div>

        {/* Body — scrollável */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400" />
              <p className="text-white font-semibold">Código ejetado com sucesso!</p>
              {isJava ? (
                <p className="text-neutral-400 text-sm">
                  Estrutura dual gerada: <strong className="text-white">frontend/</strong> (Next.js) e{' '}
                  <strong className="text-white">backend/</strong> (Spring Boot). Leia os{' '}
                  <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-indigo-300">README.md</code> em
                  cada pasta para iniciar.
                </p>
              ) : (
                <p className="text-neutral-400 text-sm">
                  Projeto Next.js gerado com driver <strong className="text-white">{dbStack}</strong>. Rode{' '}
                  <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-indigo-300">npm install</code> e{' '}
                  <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-indigo-300">npm run dev</code>.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* ── Seção 1: Backend Stack ── */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-neutral-200 mb-3">
                  <Server className="w-4 h-4 text-indigo-400" />
                  Stack de Backend
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {BACKEND_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 cursor-pointer border rounded-lg p-3 transition-colors ${
                        backendStack === opt.value
                          ? 'border-indigo-500 bg-indigo-600/10'
                          : 'border-neutral-700 hover:border-neutral-500 bg-neutral-800/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="backendStack"
                        checked={backendStack === opt.value}
                        onChange={() => setBackendStack(opt.value)}
                        className="w-4 h-4 accent-indigo-500 shrink-0"
                      />
                      <div className="flex items-center gap-2 shrink-0">{opt.icon}</div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-neutral-100 text-sm">{opt.label}</span>
                        <span className="text-xs text-neutral-500">{opt.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* ── Seção 2: Campos Java (só quando java-spring) ── */}
              {isJava && (
                <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-500/5 space-y-3">
                  <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Configurações Spring Boot</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs text-neutral-400 mb-1">Maven groupId</label>
                      <input
                        type="text"
                        value={javaGroupId}
                        onChange={e => setJavaGroupId(e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, '.'))}
                        placeholder="com.empresa"
                        className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                      <p className="text-xs text-neutral-600 mt-0.5">ex: com.empresa — usado como package Java base</p>
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Porta Spring Boot</label>
                      <input
                        type="number"
                        min={1}
                        max={65535}
                        value={javaPort}
                        onChange={e => setJavaPort(Number(e.target.value))}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Java Version</label>
                      <div className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-400 cursor-not-allowed">
                        Java 21 (LTS)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Seção 3: DB Stack ── */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-neutral-200 mb-3">
                  <Database className="w-4 h-4 text-indigo-400" />
                  {isJava ? 'Banco de Dados (Spring Boot)' : 'Stack de Banco de Dados'}
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {DB_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 cursor-pointer border rounded-lg p-3 transition-colors ${
                        dbStack === opt.value
                          ? 'border-indigo-500 bg-indigo-600/10'
                          : 'border-neutral-700 hover:border-neutral-500 bg-neutral-800/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="dbStack"
                        checked={dbStack === opt.value}
                        onChange={() => setDbStack(opt.value)}
                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 accent-indigo-500"
                      />
                      <div className="flex flex-col">
                        <span className="font-semibold text-neutral-100 text-sm">{opt.label}</span>
                        <span className="text-xs text-neutral-500">
                          {isJava
                            ? opt.value === 'supabase'
                              ? 'Supabase é PostgreSQL — usará driver JDBC PostgreSQL'
                              : opt.description.replace('Driver', 'Driver JDBC')
                            : opt.description}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* ── Seções específicas para Spring Boot ── */}
              {isJava && (
                <>
                  {/* ── Seção 4: Segurança & Autenticação ── */}
                  <div className="border border-neutral-700/60 rounded-lg p-4 bg-neutral-800/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm font-semibold text-neutral-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={jwtEnabled}
                          onChange={e => setJwtEnabled(e.target.checked)}
                          className="w-4 h-4 rounded accent-indigo-500"
                        />
                        <Shield className="w-4 h-4 text-emerald-400" />
                        Autenticação JWT (Stateless)
                      </label>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Recomendado
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 pl-6">
                      Gera SecurityConfig, JwtUtil, JwtFilter e AuthController com endpoints /api/auth/login e /me.
                    </p>

                    {jwtEnabled && (
                      <div className="ml-6 pl-3 border-l-2 border-indigo-500/40 pt-1 space-y-2">
                        <label className="block text-xs text-neutral-400 font-medium">Algoritmo de Hash de Senha:</label>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                            <input
                              type="radio"
                              name="passwordHash"
                              value="bcrypt"
                              checked={passwordHashAlgorithm === 'bcrypt'}
                              onChange={() => setPasswordHashAlgorithm('bcrypt')}
                              className="accent-indigo-500"
                            />
                            BCrypt (Recomendado)
                          </label>
                          <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                            <input
                              type="radio"
                              name="passwordHash"
                              value="sha256"
                              checked={passwordHashAlgorithm === 'sha256'}
                              onChange={() => setPasswordHashAlgorithm('sha256')}
                              className="accent-indigo-500"
                            />
                            SHA-256
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Seção 5: Migrations de Banco de Dados ── */}
                  <div className="border border-neutral-700/60 rounded-lg p-4 bg-neutral-800/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm font-semibold text-neutral-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={generateMigrations}
                          onChange={e => setGenerateMigrations(e.target.checked)}
                          className="w-4 h-4 rounded accent-indigo-500"
                        />
                        <Database className="w-4 h-4 text-blue-400" />
                        Gerar Migrations SQL
                      </label>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Padrão
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 pl-6">
                      Versionamento de schema com DDL automático para todas as tabelas e relacionamentos.
                    </p>

                    {generateMigrations && (
                      <div className="ml-6 pl-3 border-l-2 border-indigo-500/40 pt-1 space-y-2">
                        <label className="block text-xs text-neutral-400 font-medium">Engine de Migration:</label>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                            <input
                              type="radio"
                              name="migrationEngine"
                              value="flyway"
                              checked={migrationEngine === 'flyway'}
                              onChange={() => setMigrationEngine('flyway')}
                              className="accent-indigo-500"
                            />
                            Flyway (V1__init.sql)
                          </label>
                          <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                            <input
                              type="radio"
                              name="migrationEngine"
                              value="liquibase"
                              checked={migrationEngine === 'liquibase'}
                              onChange={() => setMigrationEngine('liquibase')}
                              className="accent-indigo-500"
                            />
                            Liquibase (YAML changelog)
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Seção 6: Testes Automatizados ── */}
                  <div className="border border-neutral-700/60 rounded-lg p-4 bg-neutral-800/30 space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
                      <TestTube className="w-4 h-4 text-purple-400" />
                      Testes Automatizados (JUnit 5 + Mockito)
                    </label>
                    <div className="space-y-2 pl-6">
                      <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={generateServiceTests}
                          onChange={e => setGenerateServiceTests(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-indigo-500"
                        />
                        <span>Gerar Testes Unitários de Service (<code>*ServiceTest.java</code>)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={generateControllerTests}
                          onChange={e => setGenerateControllerTests(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-indigo-500"
                        />
                        <span>Gerar Testes de Integração de Controller (<code>*ControllerTest.java</code> com MockMvc)</span>
                      </label>
                    </div>
                  </div>

                  {/* ── Seção 7: DevOps & Containerização ── */}
                  <div className="border border-neutral-700/60 rounded-lg p-4 bg-neutral-800/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
                        <Container className="w-4 h-4 text-cyan-400" />
                        DevOps & Containerização
                      </label>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        Padrão
                      </span>
                    </div>
                    <div className="space-y-2 pl-6">
                      <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={generateDockerfile}
                          onChange={e => setGenerateDockerfile(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-indigo-500"
                        />
                        <span>Dockerfile multi-stage (Eclipse Temurin JDK + JRE Alpine)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={generateDockerCompose}
                          onChange={e => setGenerateDockerCompose(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-indigo-500"
                        />
                        <span>docker-compose.yml (Backend Spring + Banco {dbStack})</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={generateEnvExample}
                          onChange={e => setGenerateEnvExample(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-indigo-500"
                        />
                        <span>Arquivo backend/.env.example documentado</span>
                      </label>
                    </div>
                  </div>

                  {/* ── Seção 8: Documentação Completa ── */}
                  <div className="border border-neutral-700/60 rounded-lg p-4 bg-neutral-800/30 space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
                      <BookOpen className="w-4 h-4 text-amber-400" />
                      Documentação Completa (Inclusa)
                    </label>
                    <div className="grid grid-cols-1 gap-1.5 pl-6 text-xs text-neutral-400">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Swagger / OpenAPI 3.0 interativo em <code>/swagger-ui.html</code></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>READMEs profissionais completos com Badges, Quickstart, Tabelas de Endpoints e Troubleshooting</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-3 border-t border-neutral-800 bg-neutral-900/50 shrink-0">
          <button
            onClick={handleClose}
            disabled={isExporting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            {done ? 'Fechar' : 'Cancelar'}
          </button>
          {!done && (
            <button
              onClick={handleEject}
              disabled={isExporting}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-500 shadow-sm transition-colors disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
              {isExporting ? 'Gerando projeto...' : 'Ejetar na Pasta Local'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
