/**
 * Lixeira de projetos e workspaces (Fase 2). O SQL (tabela mb_entity_trash e as funções mb_*) está em scripts/lixeira-projetos-workspaces.sql.
 * As funções SQL conferem a permissão sozinhas (security definer); aqui só chamamos e traduzimos os erros. O prazo é o mesmo da lixeira
 * de casos de uso (ajuste do SuperAdmin), lido por `getTrashRetentionHours` em ./trash.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { trashRemainingMs } from './trash'

export type EntityType = 'project' | 'workspace'

export interface EntityTrashItem {
  id: string
  entity_type: EntityType
  entity_id: string
  workspace_id: string
  name: string
  slug: string
  /** projetos que voltam junto (1 para um projeto; todos os do workspace para um workspace) */
  project_count: number
  deleted_at: string
}

export interface EntityRestoreResult { type: EntityType; id: string; workspace_id: string; slug: string; name: string; projects: number }

export type EntityTrashErrorCode =
  | 'delete_not_allowed' | 'slug_in_use' | 'trash_expired' | 'trash_not_found' | 'already_exists'
  | 'plan_limit' | 'workspace_missing' | 'owner_missing' | 'not_found' | 'unknown'

/** Códigos de erro das funções SQL, para o aviso certo na tela. */
export function entityTrashErrorCode(err: unknown): EntityTrashErrorCode {
  const msg = String((err as { message?: string } | null)?.message || '')
  for (const c of ['delete_not_allowed', 'slug_in_use', 'trash_expired', 'trash_not_found', 'already_exists', 'plan_limit', 'workspace_missing', 'owner_missing'] as const) {
    if (msg.includes(c)) return c
  }
  if (msg.includes('project_not_found') || msg.includes('workspace_not_found')) return 'not_found'
  return 'unknown'
}

/** Manda o projeto para a lixeira (cópia + exclusão numa transação). Lança erro se a pessoa não puder ou se algo falhar. */
export async function moveProjectToTrash(supabase: SupabaseClient, projectId: string): Promise<string> {
  const { data, error } = await supabase.rpc('mb_trash_project', { p_project_id: projectId })
  if (error) throw error
  return data as string
}

/** Manda o workspace inteiro (com todos os projetos) para a lixeira. */
export async function moveWorkspaceToTrash(supabase: SupabaseClient, workspaceId: string): Promise<string> {
  const { data, error } = await supabase.rpc('mb_trash_workspace', { p_workspace_id: workspaceId })
  if (error) throw error
  return data as string
}

/**
 * Itens da lixeira que a pessoa pode restaurar e que ainda estão no prazo (a função SQL já filtra; o filtro daqui acompanha o relógio da tela).
 * Projetos: passe o workspace. Workspaces: sem workspace (lista os excluídos do dono ou de quem tem permissão).
 */
export async function listEntityTrash(supabase: SupabaseClient, type: EntityType, workspaceId: string | null, hours: number): Promise<EntityTrashItem[]> {
  await supabase.rpc('mb_purge_expired_entity_trash') // se a função ainda não existir, o erro aparece na listagem logo abaixo
  const { data, error } = await supabase.rpc('mb_list_entity_trash', { p_entity_type: type, p_workspace_id: workspaceId })
  if (error) throw error
  return ((data || []) as EntityTrashItem[]).filter(i => trashRemainingMs(i.deleted_at, hours) > 0)
}

export async function restoreEntityFromTrash(supabase: SupabaseClient, trashId: string): Promise<EntityRestoreResult> {
  const { data, error } = await supabase.rpc('mb_restore_entity', { p_trash_id: trashId })
  if (error) throw error
  return data as EntityRestoreResult
}

export async function deleteEntityTrashForever(supabase: SupabaseClient, trashId: string): Promise<void> {
  const { error } = await supabase.rpc('mb_delete_entity_trash', { p_trash_id: trashId })
  if (error) throw error
}
