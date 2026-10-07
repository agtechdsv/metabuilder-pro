import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceClient } from '@/lib/tunnel/server'
import { dialectOf, type BiServerContext } from './serverQuery'
import type { BiAnalyticsConfig } from './widget'

/**
 * O que o servidor precisa saber do projeto para planejar uma consulta de BI: o painel salvo, as tabelas com campos,
 * as relações e o banco. Lido com a chave de serviço (o usuário final não tem sessão no Supabase) e guardado por
 * poucos segundos: um painel dispara dezenas de consultas de uma vez.
 */
export interface LoadedBiContext {
  config: BiAnalyticsConfig | null
  ctx: BiServerContext
}

export type LoadResult = { ok: true; value: LoadedBiContext } | { ok: false; status: number; code: string; message: string }

const cache = new Map<string, { value: LoadedBiContext; until: number }>()
const TTL_MS = 15_000

export function clearBiContextCache() { cache.clear() }

export async function loadBiContext(
  projectId: string,
  viewId: string,
  opts: { draft?: boolean } = {},
  deps: { client?: Pick<SupabaseClient, 'from'>; now?: () => number } = {},
): Promise<LoadResult> {
  const now = (deps.now ?? Date.now)()
  const key = `${projectId}|${viewId}|${opts.draft ? 'd' : 'p'}`
  const hit = cache.get(key)
  if (hit && hit.until > now) return { ok: true, value: hit.value }

  const client = deps.client ?? serviceClient()
  const { data: view } = await client.from('ui_views').select('id, project_id, layout_config, draft_config').eq('id', viewId).maybeSingle()
  // a tela precisa ser DESTE projeto: um pedido não pode usar o painel de outro projeto
  if (!view || String((view as any).project_id) !== projectId) return { ok: false, status: 404, code: 'view_not_found', message: 'Tela não encontrada.' }

  const v = view as any
  const layout = opts.draft && v.draft_config ? (v.draft_config.layout_config || {}) : (v.layout_config || {})

  let { data: project, error: projectError } = await client.from('projects').select('slug, db_type').eq('id', projectId).maybeSingle()
  if (projectError) ({ data: project } = await client.from('projects').select('slug').eq('id', projectId).maybeSingle())

  const [{ data: models }, { data: rawRelations }] = await Promise.all([
    client.from('models').select('*, fields(*)').eq('project_id', projectId),
    client.from('relations').select('*').eq('project_id', projectId),
  ])
  const allModels: any[] = (models as any[]) || []
  const relations = ((rawRelations as any[]) || []).map(r => {
    const child = allModels.find(m => m.id === r.from_model_id)
    const fk = child?.fields?.find((f: any) => f.id === r.from_field_id)
    return { ...r, master_model_id: r.to_model_id, detail_model_id: r.from_model_id, foreign_key: fk?.db_column_name || '' }
  })

  const value: LoadedBiContext = {
    config: (layout.analytics_config as BiAnalyticsConfig | undefined) ?? null,
    ctx: {
      models: allModels,
      relations,
      joins: Array.isArray(layout.joins) ? layout.joins : [],
      dialect: dialectOf((project as any)?.db_type),
      projectSlug: (project as any)?.slug,
    },
  }
  cache.set(key, { value, until: now + TTL_MS })
  if (cache.size > 200) for (const [k, c] of cache) if (c.until < now) cache.delete(k)
  return { ok: true, value }
}
