/**
 * Quem é o dev logado e de quem é a pasta do projeto na IDE Local.
 *
 * O padrão do mercado é cada dev ter o seu clone: a pasta fica em <pasta do usuário>\AGTech\MetaBuilderPRO\<slug> (uma conta do Windows por dev
 * já resolve). O caso fora do comum são dois logins do MetaBuilder na MESMA conta do Windows: sem cuidado, os dois mexeriam na mesma pasta e usariam
 * a mesma credencial do Git. A pasta guarda, dentro do .git (fora do que vai para o repositório), de quem ela é; se outro login a abrir, a IDE avisa
 * e oferece uma pasta própria (<slug>--<início do id do login>).
 */
import type { IDETargetLike } from './folderKey'
import { folderExists, getPickedFolder, setPickedFolder } from './projectFolders'

export interface DevIdentity { id: string; email: string; name: string }

export interface FolderOwner { userId: string; email: string; createdAt: string }

/** Espera no máximo `ms`: se a operação travar (rede, trava de sessão do navegador), segue com `fallback` em vez de deixar a IDE em branco. */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>(resolve => {
    const t = setTimeout(() => resolve(fallback), ms)
    p.then(v => { clearTimeout(t); resolve(v) }, () => { clearTimeout(t); resolve(fallback) })
  })
}

/**
 * O login atual do MetaBuilder: id, e-mail e nome (o nome assina os commits). null = não consegui ler (nunca trava a abertura da IDE).
 * Lê a sessão LOCAL (sem chamada de rede e sem esperar a trava do login que as outras janelas do app disputam).
 */
export async function currentDevIdentity(): Promise<DevIdentity | null> {
  const ler = async (): Promise<DevIdentity | null> => {
    const { createClient } = await import('@/utils/supabase/client')
    const { data } = await createClient().auth.getSession()
    const u = data?.session?.user
    if (!u) return null
    const email = u.email || ''
    const meta = (u.user_metadata || {}) as Record<string, unknown>
    const name = String(meta.full_name || meta.name || '').trim() || email.split('@')[0] || 'Dev'
    return { id: u.id, email, name }
  }
  return withTimeout(ler(), 2500, null)
}

/** Pasta própria do dev: o mesmo projeto, outro nome de pasta. */
export const ownFolderKey = (slug: string, devId: string): string => `${slug}--${devId.replace(/-/g, '').slice(0, 8)}`

export type FolderDecision = 'default' | 'ask' | 'own'

/**
 * O que fazer ao abrir o projeto, dado quem é o dono da pasta padrão e o que este login já escolheu antes:
 *  - sem dono registrado, ou dono é o próprio login: usa a pasta padrão;
 *  - dono é outro login: usa a escolha anterior ('own' = pasta própria, 'shared' = a mesma pasta) ou pergunta.
 */
export function decideFolder(owner: FolderOwner | null, devId: string | null, previousChoice: 'own' | 'shared' | ''): FolderDecision {
  if (!owner || !devId || owner.userId === devId) return 'default'
  if (previousChoice === 'own') return 'own'
  if (previousChoice === 'shared') return 'default'
  return 'ask'
}

const choiceKey = (devId: string, projectId: string) => `mb_ide_folder_choice_${devId}_${projectId}`
const lsGet = (k: string) => { try { return localStorage.getItem(k) || '' } catch { return '' } }
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sem armazenamento */ } }

const ownerFile = (folderKey: string) => `AGTech/MetaBuilderPRO/${folderKey}/.git/mb-owner.json`

export function readFolderOwner(folderKey: string): Promise<FolderOwner | null> {
  return withTimeout(lerDono(folderKey), 2500, null)
}

async function lerDono(folderKey: string): Promise<FolderOwner | null> {
  try {
    const fs = await import('@tauri-apps/plugin-fs')
    const { BaseDirectory } = await import('@tauri-apps/api/path')
    const raw = await fs.readTextFile(ownerFile(folderKey), { baseDir: BaseDirectory.Home })
    const j = JSON.parse(raw)
    return j && typeof j.userId === 'string' ? { userId: j.userId, email: String(j.email || ''), createdAt: String(j.createdAt || '') } : null
  } catch { return null }
}

/** Registra o dono da pasta (só se ainda não houver um: nunca toma a pasta de outro). */
export async function claimFolder(folderKey: string, dev: DevIdentity): Promise<void> {
  try {
    if (await readFolderOwner(folderKey)) return
    const fs = await import('@tauri-apps/plugin-fs')
    const { BaseDirectory } = await import('@tauri-apps/api/path')
    await fs.writeTextFile(ownerFile(folderKey), JSON.stringify({ userId: dev.id, email: dev.email, createdAt: new Date().toISOString() }), { baseDir: BaseDirectory.Home })
  } catch { /* sem o .git ainda ou sem permissão: o registro é uma proteção, não uma exigência */ }
}

/**
 * Descobre qual pasta este login usa neste projeto. Pergunta (uma vez por login e projeto) quando a pasta padrão é de outro login.
 */
export async function resolveFolderKey(target: IDETargetLike, dev: DevIdentity | null, labels: { title: string; message: (ownerEmail: string) => string; own: string; shared: string }): Promise<string> {
  // a pasta que este login escolheu para o projeto (seletor de pasta) vale mais que qualquer regra
  const escolhida = getPickedFolder(dev?.id ?? 'anon', target.id)
  if (escolhida) {
    // a pasta escolhida foi apagada à mão: esquece a escolha em vez de recriá-la vazia ao abrir a IDE
    if ((await folderExists(escolhida)) !== false) return escolhida
    setPickedFolder(dev?.id ?? 'anon', target.id, '')
  }
  if (!dev) return target.slug
  const owner = await readFolderOwner(target.slug)
  const prev = lsGet(choiceKey(dev.id, target.id)) as 'own' | 'shared' | ''
  let decision = decideFolder(owner, dev.id, prev === 'own' || prev === 'shared' ? prev : '')
  if (decision === 'ask') {
    let own = true
    try {
      const { askDialog } = await import('./askDialog')
      own = await askDialog(labels.message(owner?.email || '?'), { title: labels.title, kind: 'info', okLabel: labels.own, cancelLabel: labels.shared })
    } catch { /* sem diálogo: o mais seguro é a pasta própria */ }
    lsSet(choiceKey(dev.id, target.id), own ? 'own' : 'shared')
    decision = own ? 'own' : 'default'
  }
  return decision === 'own' ? ownFolderKey(target.slug, dev.id) : target.slug
}
