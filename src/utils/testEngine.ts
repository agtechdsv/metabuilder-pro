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

export interface EngineRunConfig { appDir: string; dbUrl: string; user: string; password: string; port?: number; allowRemote?: boolean }

/** Grava a configuração da rodada (um arquivo por projeto, na pasta do usuário) e devolve o caminho para o E2E_CONFIG. */
export async function writeEngineConfig(projectSlug: string, cfg: EngineRunConfig): Promise<string> {
  const { mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs')
  const { join } = await import('@tauri-apps/api/path')
  const dir = await workDir('config')
  await mkdir(dir, { recursive: true }).catch(() => {})
  const file = await join(dir, `${(projectSlug || 'projeto').replace(/[^a-zA-Z0-9_-]+/g, '_')}.json`)
  await writeTextFile(file, JSON.stringify({ port: 3102, allowRemote: false, allowedDbs: [], ...cfg }, null, 2))
  return file
}
