/**
 * Executor do "Ambiente de Testes" da IDE Desktop: grava o manifesto na pasta do motor de testes (a pasta e2e) e roda o Playwright nela, pelo PowerShell
 * liberado nas permissões do desktop. A saída traz uma linha por teste (relator e2e/dynamic/ide-reporter.ts); quem chama recebe cada evento já lido.
 *
 * Nesta versão o motor é uma pasta escolhida pelo dev (a pasta e2e do projeto). Entregar o motor pronto ao cliente (copiar os arquivos para
 * %USERPROFILE%\.metabuilder\testes e instalar) é o passo seguinte.
 */
import type { TestManifest } from '@/lib/testing/manifestTypes'
import { parseTestEvent, type TestEvent } from '@/lib/testing/results'

const PS = ['-NoProfile', '-NonInteractive', '-Command']
const q = (s: string) => s.replace(/'/g, "''")

/** Arquivos que a pasta do motor precisa ter. */
const REQUIRED = ['playwright.dynamic.config.ts', 'dynamic/tests/manifest.spec.ts', 'dynamic/ide-reporter.ts', 'node_modules']

/** A pasta é um motor de testes utilizável? Devolve o que falta. */
export async function checkRunnerDir(runnerDir: string): Promise<{ ok: boolean; missing: string[] }> {
  // pelo PowerShell (e não pelo plugin de arquivos): o Tauri só libera pastas fora do perfil do usuário na sessão em que foram escolhidas
  const { Command } = await import('@tauri-apps/plugin-shell')
  const script = `$d = '${q(runnerDir)}'; foreach ($p in @(${REQUIRED.map(r => `'${r}'`).join(',')})) { if (-not (Test-Path -LiteralPath (Join-Path $d $p))) { Write-Output $p } }`
  const out = await Command.create('powershell', [...PS, script]).execute()
  const missing = out.stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  return { ok: missing.length === 0, missing }
}

/** Pasta de trabalho do motor dentro do perfil do usuário (sempre liberada): manifesto da rodada e quadros do navegador interno. */
export async function workDir(...parts: string[]): Promise<string> {
  const { homeDir, join } = await import('@tauri-apps/api/path')
  return join(await homeDir(), '.metabuilder', 'testes', ...parts)
}

export type TestWatchMode = 'internal' | 'external' | 'background'

export interface StartTestRunOptions {
  runnerDir: string
  /** pasta do app exportado (a que contém package.json e .env.local) */
  appDir: string
  manifest: TestManifest
  /** slugs dos casos de uso a testar */
  viewSlugs: string[]
  /** como acompanhar: janela do navegador do sistema (external), imagem dentro do painel (internal) ou em segundo plano */
  mode: TestWatchMode
  /** espera entre as ações no modo ao vivo (ms) */
  slowMoMs?: number
  /** tipos de teste da rodada (funcional lê; integracao grava no banco de teste) */
  types?: string[]
  /** JSON de configuração do motor instalado (E2E_CONFIG); sem ele vale o modo do repositório (e2e/.env.real) */
  configPath?: string
  /** navegador do motor: chrome ou msedge */
  browser?: 'chrome' | 'msedge' | null
  /** pasta onde o motor grava a captura de tela e o vídeo das falhas desta rodada */
  artifactsDir?: string
  onEvent: (ev: TestEvent) => void
  /** linha de saída que não é evento (para o log) */
  onLog?: (line: string) => void
  onClose: (code: number | null) => void
}

export interface TestRunHandle { stop: () => Promise<void> }

/** Grava o manifesto da rodada na pasta de trabalho (dentro do perfil do usuário) e devolve o caminho. */
export async function writeManifest(manifest: TestManifest): Promise<string> {
  const { writeTextFile, mkdir } = await import('@tauri-apps/plugin-fs')
  const { join } = await import('@tauri-apps/api/path')
  const dir = await workDir('manifests')
  try { await mkdir(dir, { recursive: true }) } catch { /* já existe */ }
  const file = await join(dir, '_ide.json')
  await writeTextFile(file, JSON.stringify(manifest, null, 2))
  return file
}

export async function startTestRun(o: StartTestRunOptions): Promise<TestRunHandle> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const { writeTextFile, mkdir } = await import('@tauri-apps/plugin-fs')
  const { join } = await import('@tauri-apps/api/path')

  const manifestPath = await writeManifest(o.manifest)
  const liveDir = await workDir('live')
  try { await mkdir(liveDir, { recursive: true }) } catch { /* já existe */ }

  const script = [
    `Set-Location '${q(o.runnerDir)}'`,
    `$env:E2E_MANIFEST = '${q(manifestPath)}'`,
    `$env:E2E_REAL_APP_DIR = '${q(o.appDir)}'`,
    `$env:E2E_VIEWS = '${q(o.viewSlugs.join(','))}'`,
    `$env:E2E_LIVE_DIR = '${q(liveDir)}'`,
    o.artifactsDir ? `$env:E2E_ARTIFACTS_DIR = '${q(o.artifactsDir)}'` : '',
    o.types?.length ? `$env:E2E_TYPES = '${o.types.join(',')}'` : '',
    o.configPath ? `$env:E2E_CONFIG = '${q(o.configPath)}'` : '',
    o.browser ? `$env:E2E_BROWSER = '${o.browser}'` : '',
    // instala as dependências e compila o app exportado se ainda não foi feito (ou se o código mudou)
    `if (Test-Path 'dynamic/prepare-app.mjs') { node dynamic/prepare-app.mjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }`,
    o.mode === 'external' ? `$env:E2E_HEADED = '1'; $env:E2E_SLOWMO = '${Math.max(0, Math.round(o.slowMoMs ?? 0))}'` : '',
    o.mode === 'internal' ? `$env:E2E_STREAM = '1'; $env:E2E_SLOWMO = '${Math.max(0, Math.round(o.slowMoMs ?? 0))}'` : '',
    'npx playwright test -c playwright.dynamic.config.ts --timeout=60000',
  ].filter(Boolean).join('; ')

  const cmd = Command.create('powershell', [...PS, script])
  const onLine = (line: string) => {
    const ev = parseTestEvent(line)
    if (ev) o.onEvent(ev)
    else if (line.trim()) o.onLog?.(line)
  }
  cmd.stdout.on('data', onLine)
  cmd.stderr.on('data', onLine)
  cmd.on('close', ({ code }) => o.onClose(code))
  cmd.on('error', (err: string) => { o.onLog?.(String(err)); o.onClose(null) })
  const child = await cmd.spawn()

  return {
    // taskkill /T encerra o PowerShell e tudo o que ele abriu (npx, node, navegador)
    stop: async () => {
      try { await Command.create('powershell', [...PS, `taskkill /PID ${child.pid} /T /F`]).execute() } catch { /* já terminou */ }
    },
  }
}

/** Abre o relatório HTML da última rodada no navegador padrão. */
export async function openTestReport(runnerDir: string, savedFile?: string): Promise<void> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const file = savedFile || `${runnerDir.replace(/[\\/]+$/, '')}\\playwright-report-dynamic\\index.html`
  await Command.create('powershell', [...PS, `Start-Process '${q(file)}'`]).execute()
}

/** Último quadro da tela do navegador (modo "navegador interno"): bytes do JPEG, ou null se ainda não há quadro legível. */
export async function readLiveFrame(): Promise<Uint8Array | null> {
  try {
    const { readFile } = await import('@tauri-apps/plugin-fs')
    const { join } = await import('@tauri-apps/api/path')
    return await readFile(await join(await workDir('live'), 'frame.jpg'))
  } catch { return null }
}

/**
 * Gera um PDF de verdade a partir do HTML do relatório: o Chrome do motor de testes abre o arquivo e imprime em PDF (e2e/dynamic/make-pdf.mjs).
 * O arquivo é gravado direto na pasta de destino pelo Node, então não depende da permissão de pastas do Tauri.
 */
export async function makePdf(runnerDir: string, htmlPath: string, pdfPath: string): Promise<void> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const script = `Set-Location '${q(runnerDir)}'; node dynamic/make-pdf.mjs '${q(htmlPath)}' '${q(pdfPath)}'`
  const out = await Command.create('powershell', [...PS, script]).execute()
  if (out.code !== 0) throw new Error((out.stderr || out.stdout || 'falha ao gerar o PDF').trim().split('\n').slice(-3).join(' '))
}

/**
 * O vídeo das falhas precisa do ffmpeg do Playwright (cerca de 1 MB). Sem ele o motor grava só a captura de tela.
 * Verifica pelo PowerShell, na mesma pasta onde o Playwright o instala (PLAYWRIGHT_BROWSERS_PATH ou %LOCALAPPDATA%\ms-playwright).
 */
export async function hasFfmpeg(): Promise<boolean> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const script = `$r = if ($env:PLAYWRIGHT_BROWSERS_PATH -and $env:PLAYWRIGHT_BROWSERS_PATH -ne '0') { $env:PLAYWRIGHT_BROWSERS_PATH } else { Join-Path $env:LOCALAPPDATA 'ms-playwright' }; if (Get-ChildItem -Path $r -Directory -Filter 'ffmpeg-*' -ErrorAction SilentlyContinue | Where-Object { Get-ChildItem $_.FullName -Filter 'ffmpeg*' -ErrorAction SilentlyContinue }) { 'OK' } else { 'MISSING' }`
  const out = await Command.create('powershell', [...PS, script]).execute()
  return out.stdout.includes('OK')
}

/** Baixa o ffmpeg do Playwright (só depois de o usuário aceitar). */
export async function installFfmpeg(runnerDir: string): Promise<void> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const out = await Command.create('powershell', [...PS, `Set-Location '${q(runnerDir)}'; npx playwright install ffmpeg`]).execute()
  if (out.code !== 0) throw new Error((out.stderr || out.stdout || 'falha ao instalar o ffmpeg').trim().split('\n').slice(-3).join(' '))
}

/** Guarda uma cópia do relatório técnico do Playwright junto das evidências da execução (a próxima rodada sobrescreve o original). Devolve o index.html da cópia. */
export async function archiveTechReport(runnerDir: string, destDir: string): Promise<string | undefined> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const script = `$s = Join-Path '${q(runnerDir)}' 'playwright-report-dynamic'; if (Test-Path -LiteralPath $s) { New-Item -ItemType Directory -Force -Path '${q(destDir)}' | Out-Null; $d = Join-Path '${q(destDir)}' 'playwright-report'; if (Test-Path -LiteralPath $d) { Remove-Item -Recurse -Force -LiteralPath $d }; Copy-Item -Recurse -Force -LiteralPath $s -Destination $d; Write-Output (Join-Path $d 'index.html') }`
  const out = await Command.create('powershell', [...PS, script]).execute()
  const file = out.stdout.trim().split(/\r?\n/).pop()?.trim()
  return out.code === 0 && file ? file : undefined
}
