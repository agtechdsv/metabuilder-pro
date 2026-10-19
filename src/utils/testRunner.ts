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
  const { exists } = await import('@tauri-apps/plugin-fs')
  const { join } = await import('@tauri-apps/api/path')
  const missing: string[] = []
  for (const rel of REQUIRED) {
    if (!(await exists(await join(runnerDir, ...rel.split('/'))))) missing.push(rel)
  }
  return { ok: missing.length === 0, missing }
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
  onEvent: (ev: TestEvent) => void
  /** linha de saída que não é evento (para o log) */
  onLog?: (line: string) => void
  onClose: (code: number | null) => void
}

export interface TestRunHandle { stop: () => Promise<void> }

export async function startTestRun(o: StartTestRunOptions): Promise<TestRunHandle> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const { writeTextFile, mkdir } = await import('@tauri-apps/plugin-fs')
  const { join } = await import('@tauri-apps/api/path')

  const manifestDir = await join(o.runnerDir, 'dynamic', 'manifests')
  try { await mkdir(manifestDir, { recursive: true }) } catch { /* já existe */ }
  const manifestPath = await join(manifestDir, '_ide.json')
  await writeTextFile(manifestPath, JSON.stringify(o.manifest, null, 2))

  const script = [
    `Set-Location '${q(o.runnerDir)}'`,
    `$env:E2E_MANIFEST = '${q(manifestPath)}'`,
    `$env:E2E_REAL_APP_DIR = '${q(o.appDir)}'`,
    `$env:E2E_VIEWS = '${q(o.viewSlugs.join(','))}'`,
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
export async function openTestReport(runnerDir: string): Promise<void> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const file = `${runnerDir.replace(/[\\/]+$/, '')}\\playwright-report-dynamic\\index.html`
  await Command.create('powershell', [...PS, `Start-Process '${q(file)}'`]).execute()
}

/** Último quadro da tela do navegador (modo "navegador interno"): bytes do JPEG, ou null se ainda não há quadro legível. */
export async function readLiveFrame(runnerDir: string): Promise<Uint8Array | null> {
  try {
    const { readFile } = await import('@tauri-apps/plugin-fs')
    const { join } = await import('@tauri-apps/api/path')
    return await readFile(await join(runnerDir, 'dynamic', 'live', 'frame.jpg'))
  } catch { return null }
}
