/**
 * Pastas do projeto na IDE Local. A base é fixa (<pasta do usuário>\AGTech\MetaBuilderPRO\) e o dev dá o NOME da subpasta: uma por pilha
 * (Node e Java do mesmo projeto), uma cópia de teste, etc. Ficar sempre dentro da pasta do usuário evita permissões extras e limita o que a
 * IDE pode apagar. Cada pasta guarda, dentro do .git (fora do que vai para o repositório), de qual projeto ela é: .git/mb-project.json.
 */

export type Pilha = 'node' | 'java'
export type PilhaDaPasta = Pilha | 'vazia' | 'desconhecida'
export type FolderNameError = 'empty' | 'long' | 'chars' | 'reserved'

export const BASE_REL_DIR = 'AGTech/MetaBuilderPRO'
export const MAX_FOLDER_NAME = 60

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

/** O nome é válido para uma pasta do projeto? null = sim. */
export function validateFolderName(raw: string): FolderNameError | null {
  const name = raw.trim()
  if (!name) return 'empty'
  if (name.length > MAX_FOLDER_NAME) return 'long'
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) || name.includes('..') || name.endsWith('.')) return 'chars'
  if (RESERVED.test(name)) return 'reserved'
  return null
}

export const otherStack = (s: PilhaDaPasta): Pilha | null => (s === 'node' ? 'java' : s === 'java' ? 'node' : null)

/**
 * Nome sugerido para uma pasta nova: <slug>-java ou <slug>-node (a pilha que falta), ou <slug>-2 quando não se sabe.
 * Se o nome já existe (sem diferenciar maiúsculas), acrescenta -2, -3...
 */
export function suggestFolderName(slug: string, stack: Pilha | null, taken: string[]): string {
  const base = stack ? `${slug}-${stack}` : `${slug}-2`
  const used = new Set(taken.map(t => t.toLowerCase()))
  if (!used.has(base.toLowerCase())) return base
  for (let n = 2; n < 100; n++) { const c = `${base}-${n}`; if (!used.has(c.toLowerCase())) return c }
  return `${base}-${Date.now() % 10000}`
}

/** Que pilha uma pasta tem, pelos nomes do que há na raiz dela (em minúsculas). */
export function stackOfEntries(names: string[]): PilhaDaPasta {
  const n = new Set(names.map(x => x.toLowerCase()))
  if (n.has('backend') && (n.has('frontend') || n.has('pom.xml'))) return 'java'
  if (n.has('package.json')) return 'node'
  const trabalho = ['.git', '.gitignore', '.metabuilder', '.trash']
  if ([...n].every(x => trabalho.includes(x))) return 'vazia'
  return 'desconhecida'
}

export interface ProjectMarker { projectId: string; slug: string }

/** De quem é uma pasta que já existe: deste projeto, de outro, ou não existe (livre). */
export type Dono = 'this' | 'other' | 'free'

export function ownerOfFolder(existe: boolean, marker: ProjectMarker | null, folderName: string, projectId: string, slug: string): Dono {
  if (!existe) return 'free'
  if (marker) return marker.projectId === projectId ? 'this' : 'other'
  // pasta antiga, sem marcador: só a que tem o nome do slug (a padrão de sempre) é deste projeto
  return folderName.toLowerCase() === slug.toLowerCase() ? 'this' : 'other'
}

// ───────────────────────────────────────────────────────────────────────────
// Escolha do dev (por login e projeto) e acesso às pastas (IDE Desktop)
// ───────────────────────────────────────────────────────────────────────────

const lsGet = (k: string) => { try { return localStorage.getItem(k) || '' } catch { return '' } }
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sem armazenamento */ } }
const pickKey = (devId: string, projectId: string) => `mb_ide_folder_pick_${devId}_${projectId}`

/** A pasta que este login escolheu para o projeto ('' = nenhuma ainda). */
export const getPickedFolder = (devId: string, projectId: string): string => {
  const v = lsGet(pickKey(devId, projectId))
  return v && validateFolderName(v) === null ? v : ''
}
export const setPickedFolder = (devId: string, projectId: string, name: string) => lsSet(pickKey(devId, projectId), name)

export async function baseFolderPath(): Promise<string> {
  const { homeDir, join } = await import('@tauri-apps/api/path')
  return join(await homeDir(), 'AGTech', 'MetaBuilderPRO')
}

async function lerMarcador(dir: string): Promise<ProjectMarker | null> {
  try {
    const fs = await import('@tauri-apps/plugin-fs')
    const { join } = await import('@tauri-apps/api/path')
    const j = JSON.parse(await fs.readTextFile(await join(dir, '.git', 'mb-project.json')))
    return j && typeof j.projectId === 'string' ? { projectId: j.projectId, slug: String(j.slug || '') } : null
  } catch { return null }
}

/** Registra de qual projeto a pasta é (só se ainda não houver marcador). */
export async function writeProjectMarker(folderName: string, projectId: string, slug: string): Promise<void> {
  try {
    const fs = await import('@tauri-apps/plugin-fs')
    const { join } = await import('@tauri-apps/api/path')
    const dir = await join(await baseFolderPath(), folderName)
    if (await lerMarcador(dir)) return
    await fs.writeTextFile(await join(dir, '.git', 'mb-project.json'), JSON.stringify({ projectId, slug, createdAt: new Date().toISOString() }))
  } catch { /* sem o .git ainda ou sem permissão: o marcador é uma proteção, não uma exigência */ }
}

export async function detectFolderStack(folderName: string): Promise<PilhaDaPasta> {
  try {
    const { readDir, exists } = await import('@tauri-apps/plugin-fs')
    const { join } = await import('@tauri-apps/api/path')
    const dir = await join(await baseFolderPath(), folderName)
    if (!(await exists(dir))) return 'vazia'
    return stackOfEntries((await readDir(dir)).map(e => e.name))
  } catch { return 'desconhecida' }
}

export interface ProjectFolderInfo { name: string; stack: PilhaDaPasta }

/** Todas as pastas deste projeto (pelo marcador; a pasta antiga com o nome do slug também conta). */
export async function listProjectFolders(projectId: string, slug: string): Promise<ProjectFolderInfo[]> {
  try {
    const { readDir } = await import('@tauri-apps/plugin-fs')
    const { join } = await import('@tauri-apps/api/path')
    const base = await baseFolderPath()
    const out: ProjectFolderInfo[] = []
    for (const e of await readDir(base)) {
      if (!e.isDirectory) continue
      const dir = await join(base, e.name)
      const dono = ownerOfFolder(true, await lerMarcador(dir), e.name, projectId, slug)
      if (dono === 'this') out.push({ name: e.name, stack: stackOfEntries((await readDir(dir)).map(x => x.name)) })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  } catch { return [] }
}

/** De quem é a pasta com esse nome (livre se não existe). */
export async function folderOwner(folderName: string, projectId: string, slug: string): Promise<Dono> {
  try {
    const { exists } = await import('@tauri-apps/plugin-fs')
    const { join } = await import('@tauri-apps/api/path')
    const dir = await join(await baseFolderPath(), folderName)
    return ownerOfFolder(await exists(dir), await lerMarcador(dir), folderName, projectId, slug)
  } catch { return 'free' }
}
