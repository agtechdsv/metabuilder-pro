/**
 * Lixeira de casos de uso. O SQL (tabela mb_trash e as funções mb_*) está em scripts/lixeira-casos-de-uso.sql.
 * Aqui ficam: o prazo (configurado só pelo SuperAdmin), o cálculo de "quanto falta" e o ajuste dos itens de menu.
 * Os itens de menu que apontavam para o caso de uso saem do menu ao excluir e voltam ao restaurar.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export const DEFAULT_TRASH_HOURS = 48
export const MIN_TRASH_HOURS = 1
export const MAX_TRASH_HOURS = 720

/** Prazo válido em horas: inteiro de 1 a 720; qualquer outra coisa vira 48. */
export function clampTrashHours(n: unknown): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return DEFAULT_TRASH_HOURS
  return Math.max(MIN_TRASH_HOURS, Math.min(MAX_TRASH_HOURS, v))
}

/** Quando o item deixa de poder ser restaurado. */
export const trashExpiresAt = (deletedAt: string | Date, hours: number): Date => new Date(new Date(deletedAt).getTime() + clampTrashHours(hours) * 3_600_000)

export const trashRemainingMs = (deletedAt: string | Date, hours: number, now: number = Date.now()): number => trashExpiresAt(deletedAt, hours).getTime() - now

/** Duração para mostrar: múltiplos de 24 h a partir de 48 h viram dias ("2 dias"); o resto fica em horas. */
export function describeDuration(hours: number): { n: number; unit: 'hour' | 'day' } {
  const h = clampTrashHours(hours)
  return h >= 48 && h % 24 === 0 ? { n: h / 24, unit: 'day' } : { n: h, unit: 'hour' }
}

/** O que falta: dias, horas e minutos (minutos só quando falta menos de 1 dia). */
export function splitRemaining(ms: number): { days: number; hours: number; minutes: number } {
  const total = Math.max(0, Math.floor(ms / 60_000))
  return { days: Math.floor(total / 1440), hours: Math.floor((total % 1440) / 60), minutes: total % 60 }
}

// ---- itens de menu (project.navigation) ----

export interface MenuNode { id?: string; type?: string; target?: string; view_id?: string; children?: MenuNode[]; [k: string]: unknown }
/** Onde o item estava: dentro de qual pasta (null = raiz) e em que posição. */
export interface MenuEntry { parent_id: string | null; index: number; item: MenuNode }

const pointsTo = (item: MenuNode, slug: string, viewId: string) => item.type === 'view' && (item.target === slug || (!!item.view_id && item.view_id === viewId))

/** Tira do menu os itens que apontam para o caso de uso e anota onde estavam. */
export function removeMenuEntries(menu: MenuNode[] | null | undefined, slug: string, viewId: string): { menu: MenuNode[]; entries: MenuEntry[] } {
  const entries: MenuEntry[] = []
  const walk = (items: MenuNode[], parentId: string | null): MenuNode[] => {
    const out: MenuNode[] = []
    items.forEach((item, index) => {
      if (pointsTo(item, slug, viewId)) { entries.push({ parent_id: parentId, index, item }); return }
      out.push(item.children ? { ...item, children: walk(item.children, item.id ?? null) } : item)
    })
    return out
  }
  return { menu: walk(Array.isArray(menu) ? menu : [], null), entries }
}

/** Devolve ao menu os itens guardados: na mesma pasta se ela ainda existe (senão na raiz), na posição de antes, sem duplicar. */
export function restoreMenuEntries(menu: MenuNode[] | null | undefined, entries: MenuEntry[] | null | undefined): MenuNode[] {
  let result: MenuNode[] = Array.isArray(menu) ? JSON.parse(JSON.stringify(menu)) : []
  const hasId = (items: MenuNode[], id: string | undefined): boolean => !!id && items.some(i => i.id === id || (i.children ? hasId(i.children, id) : false))
  const insertInto = (items: MenuNode[], parentId: string, entry: MenuEntry): boolean => {
    for (const it of items) {
      if (it.id === parentId) { it.children = it.children || []; it.children.splice(Math.min(entry.index, it.children.length), 0, entry.item); return true }
      if (it.children && insertInto(it.children, parentId, entry)) return true
    }
    return false
  }
  for (const entry of [...(entries || [])].sort((a, b) => a.index - b.index)) {
    if (hasId(result, entry.item.id)) continue
    if (entry.parent_id && insertInto(result, entry.parent_id, entry)) continue
    result = [...result.slice(0, Math.min(entry.index, result.length)), entry.item, ...result.slice(Math.min(entry.index, result.length))]
  }
  return result
}

// ---- acesso ao banco ----

export interface TrashItem {
  id: string
  entity_id: string
  project_id: string
  name: string
  slug: string
  logic_type: string | null
  deleted_at: string
  menu_entries: MenuEntry[]
}

/** Prazo atual da lixeira (configurado pelo SuperAdmin). Se a função ainda não existe no banco, vale o padrão. */
export async function getTrashRetentionHours(supabase: SupabaseClient): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('mb_trash_retention_hours')
    if (error) return DEFAULT_TRASH_HOURS
    return clampTrashHours(data)
  } catch { return DEFAULT_TRASH_HOURS }
}

/** Códigos de erro das funções SQL, para o aviso certo na tela. */
export type TrashErrorCode = 'slug_in_use' | 'trash_expired' | 'trash_not_found' | 'already_exists' | 'use_case_not_found' | 'delete_not_allowed' | 'limit' | 'unknown'
export function trashErrorCode(err: unknown): TrashErrorCode {
  const e = err as { message?: string; code?: string } | null
  const msg = String(e?.message || '')
  for (const c of ['slug_in_use', 'trash_expired', 'trash_not_found', 'already_exists', 'use_case_not_found', 'delete_not_allowed'] as const) if (msg.includes(c)) return c
  if (e?.code === '42501' || /row-level security/i.test(msg)) return 'limit'
  return 'unknown'
}

async function readNavigation(supabase: SupabaseClient, projectId: string): Promise<MenuNode[]> {
  const { data } = await supabase.from('projects').select('navigation').eq('id', projectId).maybeSingle()
  return Array.isArray(data?.navigation) ? (data!.navigation as MenuNode[]) : []
}

/** Manda o caso de uso para a lixeira (cópia + exclusão numa transação) e tira os itens dele do menu. Lança erro se algo falhar. */
export async function moveUseCaseToTrash(supabase: SupabaseClient, view: { id: string; slug: string; project_id?: string }, projectId: string): Promise<string> {
  const navigation = await readNavigation(supabase, projectId)
  const { menu, entries } = removeMenuEntries(navigation, view.slug, view.id)
  const { data, error } = await supabase.rpc('mb_trash_use_case', { p_view_id: view.id, p_menu_entries: entries })
  if (error) throw error
  if (entries.length > 0) await supabase.from('projects').update({ navigation: menu }).eq('id', projectId)
  return data as string
}

export interface RestoreResult { id: string; slug: string; name: string; components_total: number; components_restored: number; model_missing: boolean }

/** Tira da lixeira, recria o caso de uso e devolve os itens ao menu. */
export async function restoreUseCaseFromTrash(supabase: SupabaseClient, trashId: string, projectId: string): Promise<RestoreResult> {
  const { data, error } = await supabase.rpc('mb_restore_use_case', { p_trash_id: trashId })
  if (error) throw error
  const res = data as RestoreResult & { menu_entries: MenuEntry[] }
  if (Array.isArray(res.menu_entries) && res.menu_entries.length > 0) {
    const navigation = await readNavigation(supabase, projectId)
    const next = restoreMenuEntries(navigation, res.menu_entries)
    if (JSON.stringify(next) !== JSON.stringify(navigation)) await supabase.from('projects').update({ navigation: next }).eq('id', projectId)
  }
  return res
}

/** Itens da lixeira do projeto que ainda estão no prazo (os vencidos são apagados nessa chamada). */
export async function listTrash(supabase: SupabaseClient, projectId: string, hours: number): Promise<TrashItem[]> {
  await supabase.rpc('mb_purge_expired_trash') // se a função ainda não existir, só segue
  const { data, error } = await supabase
    .from('mb_trash')
    .select('id, entity_id, project_id, name, slug, logic_type, deleted_at, menu_entries')
    .eq('project_id', projectId)
    .order('deleted_at', { ascending: false })
  if (error) throw error
  return ((data || []) as TrashItem[]).filter(i => trashRemainingMs(i.deleted_at, hours) > 0)
}

export async function deleteTrashForever(supabase: SupabaseClient, trashId: string): Promise<void> {
  const { error } = await supabase.from('mb_trash').delete().eq('id', trashId)
  if (error) throw error
}
