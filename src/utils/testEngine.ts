/**
 * Motor de testes instalado pela IDE (IDE Desktop): os arquivos do pacote (src/lib/testing/engineBundle.generated.ts) são gravados em
 * C:\Users\<usuário>\.metabuilder\testes\engine e as dependências são instaladas ali (npm install). Assim o painel não depende da pasta e2e do repositório.
 * Tudo fica dentro da pasta do usuário: o Tauri sempre libera esse caminho.
 */
import { workDir } from '@/utils/testRunner'

const PS = ['-NoProfile', '-NonInteractive', '-Command']
/** O console do PowerShell do Windows usa a página de código OEM; sem isto, acentos na saída (caminhos, textos de .env) chegam como bytes inválidos e o Tauri recusa decodificar. */
const UTF8 = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; '
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
  const r = await Command.create('powershell', [...PS, UTF8 + script]).execute()
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

export type DbTipo = 'postgres' | 'oracle'
const PADRAO_PORTA: Record<DbTipo, string> = { postgres: '5432', oracle: '1521' }

/** Tipo de banco do projeto (manifest.dbStack): só PostgreSQL e Oracle têm suporte nos testes. null = ainda sem suporte. */
export const dbTipoDoProjeto = (dbStack?: string): DbTipo | null => {
  const s = String(dbStack || '').toLowerCase()
  return s.startsWith('oracle') ? 'oracle' : s.startsWith('postgres') || s === 'pg' ? 'postgres' : null
}

const lerPropriedade = (texto: string, chave: string): string => {
  const linha = texto.split(/\r?\n/).find(l => l.trim().startsWith(chave + '='))
  return linha ? linha.slice(linha.indexOf('=') + 1).trim() : ''
}
const lerVariavel = (texto: string, chave: string): string => lerPropriedade(texto, chave).replace(/^"|"$/g, '')

/**
 * Conexão que o app exportado usa por conta própria, no formato do motor (postgres://... ou oracle://...), a partir dos arquivos dele:
 * Java: backend/src/main/resources/application.properties (spring.datasource.*); Node: .env.local (DATABASE_URL, ou DB_CONNECTION_STRING + DB_USER + DB_PASSWORD no Oracle).
 */
export function dbUrlDoApp(arquivos: { props?: string; env?: string }): string | null {
  const enc = encodeURIComponent
  if (arquivos.props) {
    const jdbc = lerPropriedade(arquivos.props, 'spring.datasource.url')
    const user = lerPropriedade(arquivos.props, 'spring.datasource.username')
    const pass = lerPropriedade(arquivos.props, 'spring.datasource.password')
    const pg = /^jdbc:postgresql:\/\/([^:/\s]+)(?::(\d+))?\/([^\s?]+)/.exec(jdbc)
    if (pg) return `postgres://${enc(user)}:${enc(pass)}@${pg[1]}:${pg[2] || '5432'}/${pg[3]}`
    const ora = /^jdbc:oracle:thin:@(?:\/\/)?([^:/\s]+)(?::(\d+))?\/([^\s?]+)/.exec(jdbc)
    if (ora) return `oracle://${enc(user)}:${enc(pass)}@${ora[1]}:${ora[2] || '1521'}/${ora[3]}`
    return null
  }
  if (arquivos.env) {
    const cs = lerVariavel(arquivos.env, 'DB_CONNECTION_STRING')
    if (cs) {
      const m = /^(?:\/\/)?([^:/]+)(?::(\d+))?\/(.+)$/.exec(cs)
      return m ? `oracle://${enc(lerVariavel(arquivos.env, 'DB_USER'))}:${enc(lerVariavel(arquivos.env, 'DB_PASSWORD'))}@${m[1]}:${m[2] || '1521'}/${m[3]}` : null
    }
    return lerVariavel(arquivos.env, 'DATABASE_URL') || null
  }
  return null
}

/** Conexão que o app exportado usa (lida pelo PowerShell: a pasta do app pode estar fora do perfil do usuário). null = não achei. */
export async function readAppDbUrl(appDir: string): Promise<string | null> {
  const script = `$d = '${q(appDir)}'; foreach ($f in @('backend\\src\\main\\resources\\application.properties', '.env.local', 'frontend\\.env.local')) { $p = Join-Path $d $f; if (Test-Path -LiteralPath $p) { '@@FILE:' + $f; Get-Content -LiteralPath $p -Encoding UTF8 } }`
  const saida = (await powershell(script)).out
  const arquivos: Record<string, string> = {}
  for (const bloco of saida.split('@@FILE:').slice(1)) { const i = bloco.indexOf('\n'); arquivos[bloco.slice(0, i).trim()] = bloco.slice(i + 1) }
  return dbUrlDoApp({ props: arquivos['backend\\src\\main\\resources\\application.properties'], env: arquivos['.env.local'] ?? arquivos['frontend\\.env.local'] })
}

/** O app é Java (backend/ + frontend/) ou Node (uma pasta)? */
export async function detectAppKind(appDir: string): Promise<'java' | 'node'> {
  const r = await powershell(`if ((Test-Path -LiteralPath (Join-Path '${q(appDir)}' 'backend\\pom.xml')) -and (Test-Path -LiteralPath (Join-Path '${q(appDir)}' 'frontend\\package.json'))) { 'JAVA' } else { 'NODE' }`)
  return r.out.includes('JAVA') ? 'java' : 'node'
}

/** O JDK está disponível? O portátil que a IDE baixa em .metabuilder\jdk21, ou um Java instalado no sistema. */
export async function hasJdk(): Promise<boolean> {
  const r = await powershell(`if (Test-Path -LiteralPath (Join-Path $env:USERPROFILE '.metabuilder\\jdk21\\bin\\java.exe')) { 'OK' } elseif (Get-Command java -ErrorAction SilentlyContinue) { 'OK' } else { 'NO' }`)
  return r.out.includes('OK')
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

/** URL do banco de teste informado: postgres://usuario:senha@host:5432/banco ou oracle://usuario:senha@host:1521/SERVICO (no Oracle o "banco" é o serviço). */
export const buildDbUrl = (s: Pick<DbSettings, 'host' | 'port' | 'database' | 'user' | 'password'>, tipo: DbTipo = 'postgres'): string =>
  `${tipo}://${encodeURIComponent(s.user)}:${encodeURIComponent(s.password)}@${s.host.trim()}:${s.port.trim() || PADRAO_PORTA[tipo]}/${encodeURIComponent(s.database.trim())}`

/** host:porta/banco: identifica o banco de um usuário de teste (se o banco muda, o usuário é criado de novo). */
export const dbKey = (url: string): string => { try { const u = new URL(url); return `${u.hostname}:${u.port || (url.startsWith('oracle') ? '1521' : '5432')}${u.pathname}` } catch { return url } }

async function settingsFile(slug: string): Promise<string> {
  const { join } = await import('@tauri-apps/api/path')
  return join(await workDir('config'), `${safeSlug(slug)}.db.json`)
}

export async function loadDbSettings(slug: string): Promise<DbSettings> {
  try {
    const { exists, readTextFile } = await import('@tauri-apps/plugin-fs')
    const f = await settingsFile(slug)
    // a escolha de rodar no banco original (e o consentimento) não é lembrada: toda vez que o painel abre, começa na cópia do banco
    if (await exists(f)) return { ...emptyDbSettings(), ...(JSON.parse(await readTextFile(f)) as Partial<DbSettings>), mode: 'copy', consentOriginal: false }
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
  try {
    const u = new URL(url)
    // Oracle: a cópia é outro schema (usuário) no mesmo serviço; Postgres: outro banco
    const base = url.startsWith('oracle') ? decodeURIComponent(u.username) : decodeURIComponent(u.pathname.slice(1))
    return `${base.toLowerCase().replace(/[^a-z0-9_]/g, '_')}_teste`.slice(0, 63)
  } catch { return 'banco_teste' }
}

/** Script para o administrador do banco criar a cópia, com os dados do banco original; a senha nunca vai no texto. */
export function buildCopyScript(url: string, newName: string): string {
  let host = 'SERVIDOR', port = url.startsWith('oracle') ? '1521' : '5432', db = 'BANCO', user = 'USUARIO'
  try { const u = new URL(url); host = u.hostname; port = u.port || port; db = decodeURIComponent(u.pathname.slice(1)); user = decodeURIComponent(u.username) } catch { /* mantém os marcadores */ }
  if (url.startsWith('oracle')) {
    const novo = newName.toUpperCase()
    return [
      '-- Cópia do schema para os testes automáticos do MetaBuilder (Oracle Data Pump). Rode como administrador do banco; a senha não está aqui.',
      `-- 1) No servidor, exporte o schema ${user.toUpperCase()}:`,
      `--    expdp system@//${host}:${port}/${db} schemas=${user.toUpperCase()} directory=DATA_PUMP_DIR dumpfile=${user.toLowerCase()}.dmp logfile=${user.toLowerCase()}_exp.log`,
      '-- 2) No SQL*Plus / SQL Developer (como administrador), crie o schema de teste:',
      `CREATE USER ${novo} IDENTIFIED BY "SENHA_DO_TESTE" QUOTA UNLIMITED ON USERS;`,
      `GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE, CREATE VIEW, CREATE PROCEDURE, CREATE TRIGGER TO ${novo};`,
      '-- 3) Importe trocando o schema:',
      `--    impdp system@//${host}:${port}/${db} remap_schema=${user.toUpperCase()}:${novo} directory=DATA_PUMP_DIR dumpfile=${user.toLowerCase()}.dmp logfile=${user.toLowerCase()}_imp.log`,
      `-- Depois, na IDE (Ambiente de Testes > Banco de dados de teste > Uma cópia do banco), informe o servidor, a porta, o serviço "${db}", o usuário "${novo}" e a senha.`,
    ].join('\n')
  }
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
