/**
 * Leitura e gravação da Entrega e das pastas do projeto (IDE Desktop). A parte de regras (o que entra, segredos) está em delivery.ts.
 * Pastas fora da pasta pessoal só são acessíveis depois de escolhidas no seletor de pastas do sistema (recursive: true libera a pasta).
 */
import { DELIVERY_EXCLUDED_DIRS, type DeliveryFiles } from './delivery'

const lsGet = (k: string) => { try { return localStorage.getItem(k) || '' } catch { return '' } }
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sem armazenamento */ } }

const MAX_FILES = 20_000

/** Pasta do projeto no Sincronizar: <pasta pessoal>\AGTech\MetaBuilderPRO\<slug> (a mesma que a IDE Local usa). */
export async function syncFolderPath(slug: string): Promise<string> {
  const { homeDir, join } = await import('@tauri-apps/api/path')
  return join(await homeDir(), 'AGTech', 'MetaBuilderPRO', slug)
}

/** A pasta tem um app gerado (package.json na raiz, ou frontend/package.json no Java)? */
export async function folderHasApp(dir: string): Promise<boolean> {
  try {
    const { exists } = await import('@tauri-apps/plugin-fs')
    const { join } = await import('@tauri-apps/api/path')
    return (await exists(await join(dir, 'package.json'))) || (await exists(await join(dir, 'frontend', 'package.json')))
  } catch { return false }
}

/** A pasta tem o pacote de produção (Dockerfile e compose de produção)? Projetos sincronizados antes dele existir não têm. */
export async function folderHasDockerPack(dir: string): Promise<boolean> {
  try {
    const { exists } = await import('@tauri-apps/plugin-fs')
    const { join } = await import('@tauri-apps/api/path')
    if (!(await exists(await join(dir, 'docker-compose.prod.yml')))) return false
    return (await exists(await join(dir, 'Dockerfile'))) || (await exists(await join(dir, 'frontend', 'Dockerfile')))
  } catch { return false }
}

/** A última pasta em que uma Entrega (ou ejeção) gravou o app deste projeto. */
export const lastDeliveryFolder = (projectId: string): string => lsGet(`mb_project_delivery_dir_${projectId}`)
export const rememberDeliveryFolder = (projectId: string, dir: string) => lsSet(`mb_project_delivery_dir_${projectId}`, dir)

export interface AppFolderSuggestion { kind: 'sync' | 'delivery'; dir: string }

/** Pastas do projeto que têm um app pronto para testar: a do Sincronizar e a da última Entrega. */
export async function suggestAppFolders(projectId: string, slug: string): Promise<AppFolderSuggestion[]> {
  const out: AppFolderSuggestion[] = []
  try {
    const sync = await syncFolderPath(slug)
    if (await folderHasApp(sync)) out.push({ kind: 'sync', dir: sync })
  } catch { /* fora do desktop */ }
  const last = lastDeliveryFolder(projectId)
  if (last && !out.some(s => s.dir.toLowerCase() === last.toLowerCase()) && await folderHasApp(last)) out.push({ kind: 'delivery', dir: last })
  return out
}

/** Lê os arquivos de uma pasta (sem descer em .git, node_modules, .next, target...). Chave = caminho relativo com "/". */
export async function readFolderFiles(root: string): Promise<DeliveryFiles> {
  const { readDir, readFile } = await import('@tauri-apps/plugin-fs')
  const { join } = await import('@tauri-apps/api/path')
  const files: DeliveryFiles = new Map()
  const skipDirs = DELIVERY_EXCLUDED_DIRS as readonly string[]
  const walk = async (dir: string, rel: string) => {
    for (const e of await readDir(dir)) {
      if (e.isDirectory) {
        if (skipDirs.includes(e.name)) continue
        await walk(await join(dir, e.name), rel ? `${rel}/${e.name}` : e.name)
      } else if (e.isFile) {
        if (files.size >= MAX_FILES) throw new Error('A pasta tem arquivos demais para uma entrega (mais de 20 mil). Confira se não há dependências ou compilações dentro dela.')
        files.set(rel ? `${rel}/${e.name}` : e.name, await readFile(await join(dir, e.name)))
      }
    }
  }
  await walk(root, '')
  return files
}

/** Os arquivos de um ZIP (bytes) como conjunto de arquivos. */
export async function zipBytesToFiles(zipBytes: Uint8Array): Promise<DeliveryFiles> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(zipBytes)
  const files: DeliveryFiles = new Map()
  for (const name of Object.keys(zip.files)) {
    const entry = zip.files[name]
    if (!entry.dir) files.set(name, await entry.async('uint8array'))
  }
  return files
}

/** Grava o conjunto de arquivos dentro da pasta. Devolve quantos gravou. */
export async function writeFilesToFolder(files: DeliveryFiles, dest: string): Promise<number> {
  const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs')
  const { join, dirname } = await import('@tauri-apps/api/path')
  let n = 0
  for (const [rel, content] of files) {
    const full = await join(dest, ...rel.split('/'))
    try { await mkdir(await dirname(full), { recursive: true }) } catch { /* já existe */ }
    await writeFile(full, typeof content === 'string' ? new TextEncoder().encode(content) : content)
    n++
  }
  return n
}

/** Grava o conjunto de arquivos num ZIP. Devolve quantos arquivos o ZIP tem. */
export async function writeFilesToZip(files: DeliveryFiles, zipPath: string): Promise<number> {
  const { writeFile } = await import('@tauri-apps/plugin-fs')
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  for (const [rel, content] of files) zip.file(rel, content)
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  await writeFile(zipPath, bytes)
  return files.size
}

/** Seletor de pasta de destino (libera a pasta para gravação). null = cancelado. */
export async function pickDestinationFolder(title?: string): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const dir = await open({ directory: true, recursive: true, title })
  return dir && typeof dir === 'string' ? dir : null
}

/** Seletor do arquivo ZIP de destino. null = cancelado. */
export async function pickDestinationZip(defaultName: string): Promise<string | null> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const p = await save({ defaultPath: defaultName, filters: [{ name: 'ZIP', extensions: ['zip'] }] })
  return p || null
}

/** Mostra a pasta ou o arquivo no Explorador do sistema. */
export async function revealPath(p: string): Promise<void> {
  try {
    const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
    await revealItemInDir(p)
  } catch { /* sem o plugin: o caminho aparece na tela */ }
}

export interface DeliveryLabels {
  cleanTitle: string
  cleanMessage: string
  cleanOk: string
  cleanCancel: string
  cleanUnsafe: string
  cleanNotApp: string
  cleanFailed: string
}

/**
 * Limpa a pasta de destino antes da entrega (com travas e confirmação mostrando o que será apagado). false = o dev cancelou.
 * Lança Error com a mensagem para a tela quando a pasta não pode ser limpa.
 */
export async function confirmAndClean(destination: string, labels: DeliveryLabels): Promise<boolean> {
  const { isSafeToClean, planCleanup, cleanFolder, confirmMessage } = await import('./cleanExportFolder')
  const { homeDir } = await import('@tauri-apps/api/path')
  const { askDialog } = await import('./askDialog')
  if (!isSafeToClean(destination, await homeDir().catch(() => ''))) throw new Error(labels.cleanUnsafe)
  const plano = await planCleanup(destination)
  if (!plano) throw new Error(labels.cleanFailed)
  if (plano.existe && plano.arquivos > 0) {
    if (!plano.exportado) throw new Error(labels.cleanNotApp)
    const ok = await askDialog(confirmMessage(destination, plano, labels.cleanMessage), { title: labels.cleanTitle, kind: 'warning', okLabel: labels.cleanOk, cancelLabel: labels.cleanCancel })
    if (!ok) return false
    if (!(await cleanFolder(destination))) throw new Error(labels.cleanFailed)
  }
  return true
}
