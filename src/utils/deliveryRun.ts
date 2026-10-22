/**
 * Executa a Entrega: lê a pasta do projeto, gera o que o dev escolheu (código-fonte limpo, pacote Docker e/ou pacote compilado) e grava no
 * destino (pasta ou ZIP) que ele indicou. As regras de cada tipo estão em deliveryPackage.ts; a compilação, em deliveryBuild.ts.
 */
import type { DeliveryFiles, DeliveryKind, DeliveryOptions } from './delivery'
import { DELIVERY_KINDS, detectProjectInfo, filesForCopyKind, hasDockerPack, kindFolder } from './deliveryPackage'
import { buildCompiledPackage, runPowerShell, type BuildCtx, type BuildLabels } from './deliveryBuild'
import { confirmAndClean, pickDestinationFolder, pickDestinationZip, rememberDeliveryFolder, writeFilesToFolder, writeFilesToZip, type DeliveryLabels } from './deliveryIO'

export interface RunLabels extends DeliveryLabels, BuildLabels {
  needSync: string
  noKind: string
}

export interface RunCtx {
  projectId: string
  slug: string
  /** nome da pasta do Sincronizar (ex.: vendas-ora-java): vira o nome sugerido do ZIP e da pasta de destino */
  folderName?: string
  name: string
  labels: RunLabels
  stepLabels: BuildCtx['stepLabels'] & { reading: string; writing: string; publishing: string }
  onStep: (msg: string) => void
  onLog: (line: string) => void
}

export interface KindResult { kind: DeliveryKind; folder: string; count: number | null }

export interface RunResult {
  destination: string
  format: DeliveryOptions['format']
  kinds: KindResult[]
  skipped: string[]
  sanitized: string[]
}

const q = (s: string) => s.replace(/'/g, "''")

const withPrefix = (files: DeliveryFiles, folder: string): DeliveryFiles => {
  if (!folder) return files
  const out: DeliveryFiles = new Map()
  for (const [k, v] of files) out.set(`${folder}/${k}`, v)
  return out
}

/**
 * Gera a Entrega. `raw` são os arquivos da pasta do projeto (antes de tirar os segredos). null = o dev cancelou o destino ou a limpeza.
 * Lança Error com a mensagem para a tela.
 */
export async function deliverProject(raw: DeliveryFiles, opts: DeliveryOptions, ctx: RunCtx): Promise<RunResult | null> {
  const kinds = DELIVERY_KINDS.filter(k => opts.kinds.includes(k))
  if (kinds.length === 0) throw new Error(ctx.labels.noKind)
  if (kinds.includes('docker') && !hasDockerPack(raw)) throw new Error(ctx.labels.needSync)
  const compiled = kinds.includes('compiled')

  const destination = opts.format === 'zip' ? await pickDestinationZip(`${ctx.folderName || ctx.slug || 'app'}-entrega.zip`) : await pickDestinationFolder()
  if (!destination) return null
  if (opts.format === 'folder' && opts.cleanBefore && !(await confirmAndClean(destination, ctx.labels))) return null

  const { join, homeDir } = await import('@tauri-apps/api/path')
  const sub = async (base: string, folder: string) => (folder ? join(base, folder) : base)

  // tipos que são só cópia
  ctx.onStep(ctx.stepLabels.writing)
  const copies = new Map<'source' | 'docker', DeliveryFiles>()
  const skipped = new Set<string>(); const sanitized = new Set<string>()
  for (const k of kinds) {
    if (k === 'compiled') continue
    const r = filesForCopyKind(raw, k, opts.includeSecrets)
    copies.set(k, r.files)
    r.skipped.forEach(x => skipped.add(x)); r.sanitized.forEach(x => sanitized.add(x))
  }
  const results: KindResult[] = []

  if (!compiled) {
    if (opts.format === 'folder') {
      for (const [k, files] of copies) {
        const folder = kindFolder(k, kinds)
        const n = await writeFilesToFolder(files, await sub(destination, folder))
        results.push({ kind: k, folder, count: n })
      }
    } else {
      const merged: DeliveryFiles = new Map()
      for (const [k, files] of copies) {
        const folder = kindFolder(k, kinds)
        for (const [name, content] of withPrefix(files, folder)) merged.set(name, content)
        results.push({ kind: k, folder, count: files.size })
      }
      await writeFilesToZip(merged, destination)
    }
  } else {
    // com pacote compilado tudo é montado numa pasta temporária (sob a pasta do usuário) e só depois vai para o destino
    const tmpRoot = await join(await homeDir(), '.metabuilder', 'entrega-tmp', String(Date.now()))
    const saida = await join(tmpRoot, 'saida')
    try {
      for (const [k, files] of copies) {
        const folder = kindFolder(k, kinds)
        results.push({ kind: k, folder, count: await writeFilesToFolder(files, await sub(saida, folder)) })
      }
      const info = detectProjectInfo(raw, ctx.name, ctx.slug)
      const compiledFolder = kindFolder('compiled', kinds)
      const compiledDir = await sub(saida, compiledFolder)
      await buildCompiledPackage(raw, info, tmpRoot, compiledDir, ctx)
      const lines: string[] = []
      await runPowerShell(`(Get-ChildItem -LiteralPath '${q(compiledDir)}' -Recurse -File | Measure-Object).Count`, undefined, l => lines.push(l))
      const total = Number(lines.find(l => /^\d+$/.test(l.trim())) ?? NaN)
      results.push({ kind: 'compiled', folder: compiledFolder, count: Number.isFinite(total) ? total : null })

      ctx.onStep(ctx.stepLabels.publishing)
      const publish = opts.format === 'zip'
        // .NET (e não o Compress-Archive do PowerShell 5, que grava "\" nos nomes e quebra no Linux)
        ? `Add-Type -AssemblyName System.IO.Compression.FileSystem; if (Test-Path -LiteralPath '${q(destination)}') { Remove-Item -LiteralPath '${q(destination)}' -Force }; [System.IO.Compression.ZipFile]::CreateFromDirectory('${q(saida)}', '${q(destination)}', [System.IO.Compression.CompressionLevel]::Optimal, $false); exit 0`
        : `robocopy '${q(saida)}' '${q(destination)}' /E /NFL /NDL /NJH /NJS /NP | Out-Null; if ($LASTEXITCODE -ge 8) { exit 1 } else { exit 0 }`
      const code = await runPowerShell(publish, undefined, ctx.onLog)
      if (code !== 0) throw new Error(`${ctx.labels.buildFailed} (${ctx.stepLabels.publishing}, código ${code})`)
    } finally {
      await runPowerShell(`Remove-Item -LiteralPath '${q(tmpRoot)}' -Recurse -Force -ErrorAction SilentlyContinue; exit 0`, undefined, () => {}).catch(() => {})
    }
  }

  // a pasta que o Ambiente de Testes pode sugerir: onde ficou o código (fonte ou Docker)
  if (opts.format === 'folder') {
    const where = results.find(r => r.kind === 'docker') ?? results.find(r => r.kind === 'source')
    if (where) rememberDeliveryFolder(ctx.projectId, await sub(destination, where.folder))
  }
  return { destination, format: opts.format, kinds: results, skipped: [...skipped], sanitized: [...sanitized] }
}
