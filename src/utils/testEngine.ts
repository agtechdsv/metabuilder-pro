/**
 * Motor de testes instalado pela IDE (IDE Desktop): os arquivos do pacote (src/lib/testing/engineBundle.generated.ts) são gravados em
 * C:\Users\<usuário>\.metabuilder\testes\engine e as dependências são instaladas ali (npm install). Assim o painel não depende da pasta e2e do repositório.
 * Tudo fica dentro da pasta do usuário: o Tauri sempre libera esse caminho.
 */
import { workDir } from '@/utils/testRunner'

const PS = ['-NoProfile', '-NonInteractive', '-Command']
const q = (s: string) => s.replace(/'/g, "''")
const MARCA = '.mb-engine.json'

/** Pasta e2e do motor instalado (é a pasta de trabalho: nela rodam o Playwright e os scripts). */
export async function engineE2eDir(): Promise<string> {
  const { join } = await import('@tauri-apps/api/path')
  return join(await workDir('engine'), 'e2e')
}

export interface EngineStatus { installed: boolean; installedVersion?: string; currentVersion: string; upToDate: boolean }

export async function engineStatus(): Promise<EngineStatus> {
  const { ENGINE_VERSION } = await import('@/lib/testing/engineBundle.generated')
  const { exists, readTextFile } = await import('@tauri-apps/plugin-fs')
  const { join } = await import('@tauri-apps/api/path')
  const root = await workDir('engine')
  let installedVersion: string | undefined
  try {
    const marca = await join(root, MARCA)
    if (await exists(marca)) installedVersion = (JSON.parse(await readTextFile(marca)) as { version?: string }).version
  } catch { /* marca ilegível: trata como não instalado */ }
  const node = await exists(await join(root, 'e2e', 'node_modules', '@playwright', 'test')).catch(() => false)
  const installed = !!installedVersion && node
  return { installed, installedVersion, currentVersion: ENGINE_VERSION, upToDate: installed && installedVersion === ENGINE_VERSION }
}

async function powershell(script: string): Promise<{ code: number | null; out: string }> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const r = await Command.create('powershell', [...PS, script]).execute()
  return { code: r.code, out: `${r.stdout}\n${r.stderr}`.trim() }
}

/** O Node.js (e o npm) está instalado nesta máquina? O app exportado também precisa dele. */
export async function hasNode(): Promise<boolean> {
  const r = await powershell("node -v; npm -v")
  return r.code === 0 && /v\d+\./.test(r.out)
}

/** Navegador que o motor usa: o Chrome, ou o Edge (que já vem no Windows). null se nenhum dos dois foi encontrado. */
export async function detectBrowser(): Promise<'chrome' | 'msedge' | null> {
  const script = `$c = @("$env:ProgramFiles\\Google\\Chrome\\Application\\chrome.exe", "\${env:ProgramFiles(x86)}\\Google\\Chrome\\Application\\chrome.exe", "$env:LOCALAPPDATA\\Google\\Chrome\\Application\\chrome.exe"); $e = @("\${env:ProgramFiles(x86)}\\Microsoft\\Edge\\Application\\msedge.exe", "$env:ProgramFiles\\Microsoft\\Edge\\Application\\msedge.exe"); if ($c | Where-Object { Test-Path -LiteralPath $_ }) { 'chrome' } elseif ($e | Where-Object { Test-Path -LiteralPath $_ }) { 'msedge' } else { 'none' }`
  const out = (await powershell(script)).out
  return out.includes('chrome') ? 'chrome' : out.includes('msedge') ? 'msedge' : null
}

/** Grava os arquivos do pacote e instala as dependências. `onStep` recebe uma frase por etapa. */
export async function installEngine(onStep: (msg: string) => void): Promise<void> {
  const { ENGINE_FILES, ENGINE_VERSION } = await import('@/lib/testing/engineBundle.generated')
  const { mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs')
  const { join, dirname } = await import('@tauri-apps/api/path')
  if (!(await hasNode())) throw new Error('NODE_MISSING')
  const root = await workDir('engine')
  onStep('files')
  await mkdir(root, { recursive: true }).catch(() => {})
  for (const [rel, texto] of Object.entries(ENGINE_FILES)) {
    const dest = await join(root, ...rel.split('/'))
    await mkdir(await dirname(dest), { recursive: true }).catch(() => {})
    await writeTextFile(dest, texto)
  }
  onStep('npm')
  const e2e = await join(root, 'e2e')
  const r = await powershell(`Set-Location '${q(e2e)}'; npm install --no-audit --no-fund --loglevel=error`)
  if (r.code !== 0) throw new Error(r.out.split('\n').slice(-4).join(' '))
  await writeTextFile(await join(root, MARCA), JSON.stringify({ version: ENGINE_VERSION, installedAt: new Date().toISOString() }))
}

/** DATABASE_URL do .env.local do app exportado (lido pelo PowerShell: a pasta do app pode estar fora do perfil do usuário). */
export async function readAppDbUrl(appDir: string): Promise<string | null> {
  const script = `$f = Join-Path '${q(appDir)}' '.env.local'; if (Test-Path -LiteralPath $f) { Get-Content -LiteralPath $f | Where-Object { $_ -match '^DATABASE_URL\\s*=' } | Select-Object -First 1 }`
  const line = (await powershell(script)).out.trim()
  const m = /^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/.exec(line)
  return m ? m[1].trim() : null
}

export interface EngineRunConfig {
  appDir: string; dbUrl: string; user: string; password: string; port?: number
  mode: 'copy' | 'original'; copyConfirmed: boolean; consentOriginal: boolean; noAuth: boolean; allowRemote: boolean
}

/** Grava a configuração da rodada (um arquivo por projeto, na pasta do usuário) e devolve o caminho para o E2E_CONFIG. */
export async function writeEngineConfig(projectSlug: string, cfg: EngineRunConfig & { robotPassword?: string; copyName?: string }): Promise<string> {
  const { mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs')
  const { join } = await import('@tauri-apps/api/path')
  const dir = await workDir('config')
  await mkdir(dir, { recursive: true }).catch(() => {})
  const file = await join(dir, `${safeSlug(projectSlug)}.json`)
  await writeTextFile(file, JSON.stringify({ port: 3102, allowedDbs: [], ...cfg }, null, 2))
  return file
}

const safeSlug = (s: string) => (s || 'projeto').replace(/[^a-zA-Z0-9_-]+/g, '_')

// ---------------------------------------------------------------------------------------------------------------------
// Banco de teste do cliente
// ---------------------------------------------------------------------------------------------------------------------

/** Escolhas do cliente para o banco de teste de um projeto (ficam num arquivo na pasta do usuário, não no navegador: têm senha). */
export interface DbSettings {
  mode: 'copy' | 'original'
  host: string; port: string; database: string; user: string; password: string
  /** confirmou que o banco informado é uma cópia de teste */
  copyConfirmed: boolean
  /** consentiu em rodar no banco original e em criar nele o usuário de teste */
  consentOriginal: boolean
  consentAt?: string
  /** usuário de teste do app já criado, e para qual banco (host:porta/banco) */
  robot?: { user: string; password: string; forDb: string; group?: string | null }
}

export const emptyDbSettings = (): DbSettings => ({ mode: 'copy', host: 'localhost', port: '5432', database: '', user: '', password: '', copyConfirmed: false, consentOriginal: false })

export const buildDbUrl = (s: Pick<DbSettings, 'host' | 'port' | 'database' | 'user' | 'password'>): string =>
  `postgres://${encodeURIComponent(s.user)}:${encodeURIComponent(s.password)}@${s.host.trim()}:${s.port.trim() || '5432'}/${encodeURIComponent(s.database.trim())}`

/** host:porta/banco: identifica o banco de um usuário de teste (se o banco muda, o usuário é criado de novo). */
export const dbKey = (url: string): string => { try { const u = new URL(url); return `${u.hostname}:${u.port || '5432'}${u.pathname}` } catch { return url } }

async function settingsFile(slug: string): Promise<string> {
  const { join } = await import('@tauri-apps/api/path')
  return join(await workDir('config'), `${safeSlug(slug)}.db.json`)
}

export async function loadDbSettings(slug: string): Promise<DbSettings> {
  try {
    const { exists, readTextFile } = await import('@tauri-apps/plugin-fs')
    const f = await settingsFile(slug)
    if (await exists(f)) return { ...emptyDbSettings(), ...(JSON.parse(await readTextFile(f)) as Partial<DbSettings>) }
  } catch { /* arquivo ilegível: começa do zero */ }
  return emptyDbSettings()
}

export async function saveDbSettings(slug: string, s: DbSettings): Promise<void> {
  const { mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs')
  await mkdir(await workDir('config'), { recursive: true }).catch(() => {})
  await writeTextFile(await settingsFile(slug), JSON.stringify(s, null, 2))
}

export interface DbToolResult {
  ok: boolean; error?: string
  database?: string; version?: string; tables?: { expected: number; missing: string[] }; authType?: string | null
  noAuth?: boolean; user?: string; password?: string; created?: boolean; group?: string | null; removed?: boolean
}

/** Roda a ferramenta de banco do motor (e2e/dynamic/db-tool.mjs): check, prepare ou remove. */
export async function runDbTool(action: 'check' | 'prepare' | 'remove' | 'copy', o: { runnerDir: string; configPath: string; manifestPath: string }): Promise<DbToolResult> {
  const script = `Set-Location '${q(o.runnerDir)}'; $env:E2E_CONFIG = '${q(o.configPath)}'; $env:E2E_MANIFEST = '${q(o.manifestPath)}'; node dynamic/db-tool.mjs ${action}`
  const r = await powershell(script)
  const linha = r.out.split(/\r?\n/).find(l => l.includes('@@MB-DB@@'))
  if (!linha) return { ok: false, error: r.out.split('\n').slice(-3).join(' ') || 'A ferramenta de banco não respondeu.' }
  try { return JSON.parse(linha.slice(linha.indexOf('@@MB-DB@@') + 9)) as DbToolResult } catch { return { ok: false, error: 'Resposta ilegível da ferramenta de banco.' } }
}

/** Nome sugerido para a cópia: o do banco original + "_teste". */
export const suggestCopyName = (url: string): string => {
  try { return `${decodeURIComponent(new URL(url).pathname.slice(1)).toLowerCase().replace(/[^a-z0-9_]/g, '_')}_teste`.slice(0, 63) } catch { return 'banco_teste' }
}

/** Script (PowerShell) para o administrador do banco criar a cópia, com os dados do banco original; a senha nunca vai no texto. */
export function buildCopyScript(url: string, newName: string): string {
  let host = 'SERVIDOR', port = '5432', db = 'BANCO', user = 'USUARIO'
  try { const u = new URL(url); host = u.hostname; port = u.port || '5432'; db = decodeURIComponent(u.pathname.slice(1)); user = decodeURIComponent(u.username) } catch { /* mantém os marcadores */ }
  return [
    '# Cópia do banco para os testes automáticos do MetaBuilder (PostgreSQL). Rode UMA das duas opções.',
    '# A senha não está aqui: defina-a antes, na sessão do PowerShell:  $env:PGPASSWORD = "SUA_SENHA"',
    '',
    '# Opção 1 — no mesmo servidor (precisa da permissão CREATEDB e de ninguém conectado ao banco original):',
    `psql -h ${host} -p ${port} -U ${user} -d postgres -c "CREATE DATABASE \\"${newName}\\" TEMPLATE \\"${db}\\";"`,
    '',
    '# Opção 2 — em outro servidor, ou sem permissão para a opção 1 (pg_dump e pg_restore):',
    `pg_dump -Fc -h ${host} -p ${port} -U ${user} -d ${db} -f ${db}.dump`,
    `createdb -h NOVO_SERVIDOR -p ${port} -U NOVO_USUARIO ${newName}`,
    `pg_restore -h NOVO_SERVIDOR -p ${port} -U NOVO_USUARIO -d ${newName} --no-owner --no-privileges ${db}.dump`,
    '',
    `# Depois, na IDE (Ambiente de Testes > Banco de dados de teste > Uma cópia do banco), informe o servidor, a porta, o banco "${newName}", o usuário e a senha.`,
  ].join('\n')
}

/** Cria a cópia no mesmo servidor do banco original. */
export async function createDbCopy(o: { runnerDir: string; configPath: string; manifestPath: string }): Promise<DbToolResult & { name?: string; sizeMb?: number; existed?: boolean }> {
  return runDbTool('copy', o) as Promise<DbToolResult & { name?: string; sizeMb?: number; existed?: boolean }>
}
