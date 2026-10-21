/**
 * Compilação do pacote da Entrega (IDE Desktop, Windows): monta uma cópia temporária do projeto (sem arquivos de trabalho nem segredos), compila nela
 * (npm e, no Java, o Maven Wrapper com o JDK 21 portátil da IDE) e monta a pasta do pacote: app compilado, scripts de início e manual.
 * A pasta do projeto não é tocada: nada de node_modules nem .next dentro dela.
 */
import { applyDelivery, type DeliveryFiles } from './delivery'
import { compiledReadme, startScripts, type ProjectInfo } from './deliveryPackage'
import { writeFilesToFolder } from './deliveryIO'

const PS = ['-NoProfile', '-NonInteractive', '-Command']
const UTF8 = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; '
const q = (s: string) => s.replace(/'/g, "''")

/** Roda um script PowerShell mostrando a saída linha a linha. Devolve o código de saída. */
export async function runPowerShell(script: string, cwd: string | undefined, onLog: (line: string) => void): Promise<number> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const cmd = Command.create('powershell', [...PS, UTF8 + script], cwd ? { cwd } : undefined)
  const emit = (l: unknown) => { const t = String(l).replace(/\r/g, '').trimEnd(); if (t) onLog(t) }
  cmd.stdout.on('data', emit)
  cmd.stderr.on('data', emit)
  return await new Promise<number>((resolve, reject) => {
    cmd.on('close', e => resolve(typeof e.code === 'number' ? e.code : 1))
    cmd.on('error', err => reject(new Error(String(err))))
    cmd.spawn().catch(reject)
  })
}

export const NPM_BUILD = (dir: string) => `$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath '${q(dir)}'
if (Test-Path package-lock.json) { npm ci --no-audit --no-fund } else { npm install --no-audit --no-fund }
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$env:MB_STANDALONE = '1'; $env:NEXT_TELEMETRY_DISABLED = '1'
npm run build
exit $LASTEXITCODE`

export const MVN_BUILD = (dir: string) => `Set-Location -LiteralPath '${q(dir)}'
$jh = Join-Path $env:USERPROFILE '.metabuilder\\jdk21'; if (Test-Path (Join-Path $jh 'bin\\java.exe')) { $env:JAVA_HOME = $jh }
.\\mvnw.cmd -B -DskipTests package
exit $LASTEXITCODE`

/** Copia o app Next compilado (standalone) de uma pasta de build para a pasta do pacote. O sharp nativo (só do next/image) sai: o pacote serve para Windows e Linux. */
export const ASSEMBLE_NEXT = (buildDir: string, outDir: string, withScripts: boolean) => `$b = '${q(buildDir)}'; $o = '${q(outDir)}'
New-Item -ItemType Directory -Force -Path $o | Out-Null
$flags = @('/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP')
robocopy "$b\\.next\\standalone" "$o" @flags | Out-Null; if ($LASTEXITCODE -ge 8) { exit 1 }
robocopy "$b\\.next\\static" "$o\\.next\\static" @flags | Out-Null; if ($LASTEXITCODE -ge 8) { exit 1 }
if (Test-Path "$b\\public") { robocopy "$b\\public" "$o\\public" @flags | Out-Null; if ($LASTEXITCODE -ge 8) { exit 1 } }
${withScripts ? `foreach ($d in @('scripts', 'db')) { if (Test-Path "$b\\$d") { robocopy "$b\\$d" "$o\\$d" @flags | Out-Null; if ($LASTEXITCODE -ge 8) { exit 1 } } }\n` : ''}Remove-Item -Recurse -Force "$o\\node_modules\\@img" -ErrorAction SilentlyContinue
# o Next copia para o pacote arquivos de código-fonte que "rastreou" e mapas de origem (que embutem o código): o app roda sem eles, e um pacote compilado não deve levá-los
$o = (Get-Item -LiteralPath $o).FullName
Get-ChildItem -LiteralPath $o -Recurse -File -ErrorAction SilentlyContinue | Where-Object { @('.ts', '.tsx', '.map') -contains $_.Extension -and -not $_.FullName.StartsWith("$o\\node_modules\\") -and $_.Name -notlike '*.d.ts' } | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -LiteralPath $o -Directory | Where-Object { @('node_modules', '.next', 'scripts', 'db', 'public') -notcontains $_.Name -and -not (Get-ChildItem -LiteralPath $_.FullName -Recurse -File -ErrorAction SilentlyContinue) } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
if (-not (Test-Path "$o\\server.js")) { exit 2 }
exit 0`

export interface BuildLabels {
  jdkTitle: string
  jdkAsk: string
  jdkInstall: string
  jdkCancel: string
  jdkFailed: string
  buildFailed: string
}

export interface BuildCtx {
  onStep: (msg: string) => void
  onLog: (line: string) => void
  labels: BuildLabels
  stepLabels: { preparing: string; backend: string; frontend: string; assembling: string; docs: string }
}

/** O JDK 21 está disponível (portátil da IDE ou do PATH)? Se não, pergunta antes de baixar o portátil. */
async function ensureJdk(ctx: BuildCtx): Promise<void> {
  const { detectJava, installPortableJdk } = await import('./javaRuntime')
  if ((await detectJava()) !== 'none') return
  const { ask } = await import('@tauri-apps/plugin-dialog')
  const ok = await ask(ctx.labels.jdkAsk, { title: ctx.labels.jdkTitle, kind: 'info', okLabel: ctx.labels.jdkInstall, cancelLabel: ctx.labels.jdkCancel })
  if (!ok) throw new Error(ctx.labels.jdkFailed)
  if (!(await installPortableJdk())) throw new Error(ctx.labels.jdkFailed)
}

/**
 * Compila o projeto e monta a pasta do pacote em `outDir`. `raw` são os arquivos da pasta do projeto (antes de tirar os segredos).
 * `tmpRoot` é uma pasta temporária (sob a pasta do usuário) que quem chama apaga depois.
 */
export async function buildCompiledPackage(raw: DeliveryFiles, info: ProjectInfo, tmpRoot: string, outDir: string, ctx: BuildCtx): Promise<{ jarName: string }> {
  const { join } = await import('@tauri-apps/api/path')
  const fail = (what: string, code: number) => { throw new Error(`${ctx.labels.buildFailed} (${what}, código ${code})`) }

  // 1) cópia temporária limpa: o que o dev vai entregar, sem segredos
  ctx.onStep(ctx.stepLabels.preparing)
  const buildDir = await join(tmpRoot, 'build')
  const cleaned = applyDelivery(raw, { includeSecrets: false }).files
  await writeFilesToFolder(cleaned, buildDir)

  const nextDir = info.stack === 'java' ? await join(buildDir, 'frontend') : buildDir
  let jarName = ''

  // 2) Java: o backend primeiro
  if (info.stack === 'java') {
    await ensureJdk(ctx)
    ctx.onStep(ctx.stepLabels.backend)
    const code = await runPowerShell(MVN_BUILD(await join(buildDir, 'backend')), undefined, ctx.onLog)
    if (code !== 0) fail('backend', code)
  }

  // 3) o app Next (o app Node inteiro, ou o frontend do Java)
  ctx.onStep(ctx.stepLabels.frontend)
  const codeNext = await runPowerShell(NPM_BUILD(nextDir), undefined, ctx.onLog)
  if (codeNext !== 0) fail(info.stack === 'java' ? 'frontend' : 'app', codeNext)

  // 4) montar a pasta do pacote
  ctx.onStep(ctx.stepLabels.assembling)
  const nextOut = info.stack === 'java' ? await join(outDir, 'frontend') : outDir
  const codeAsm = await runPowerShell(ASSEMBLE_NEXT(nextDir, nextOut, info.stack === 'node'), undefined, ctx.onLog)
  if (codeAsm !== 0) fail('montagem', codeAsm)
  if (info.stack === 'java') {
    const { readDir, mkdir, copyFile } = await import('@tauri-apps/plugin-fs')
    const target = await join(buildDir, 'backend', 'target')
    const jar = (await readDir(target)).find(e => e.isFile && e.name.endsWith('.jar') && !e.name.endsWith('.original'))
    if (!jar) fail('backend: jar não encontrado', 3)
    jarName = jar!.name
    const backendOut = await join(outDir, 'backend')
    await mkdir(backendOut, { recursive: true })
    await copyFile(await join(target, jarName), await join(backendOut, jarName))
  }

  // 5) scripts de início, .env.example e manual
  ctx.onStep(ctx.stepLabels.docs)
  const docs: DeliveryFiles = new Map()
  for (const [name, content] of startScripts(info, jarName)) docs.set(name, content)
  const envExample = cleaned.get('.env.example')
  if (envExample !== undefined) docs.set('.env.example', envExample)
  docs.set('LEIA-ME.md', compiledReadme(info, jarName))
  const deploy = cleaned.get('DEPLOY.md')
  if (deploy !== undefined) docs.set('DEPLOY.md', deploy)
  await writeFilesToFolder(docs, outDir)
  return { jarName }
}
