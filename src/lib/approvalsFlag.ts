import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * O projeto tem algum fluxo ATIVO com o bloco "Aguardar aprovação"? Decide se o app mostra "Minhas tarefas" e o histórico de
 * aprovações no registro (nos demais apps nada muda). Guardado por 30 s: o layout e cada tela perguntam a cada abertura.
 */
const cache = new Map<string, { value: boolean; until: number }>()
const TTL_MS = 30_000

export function clearApprovalsFlagCache() { cache.clear() }

export async function projectHasApprovals(
  client: Pick<SupabaseClient, 'from'>,
  projectId: string,
  now: () => number = Date.now,
): Promise<boolean> {
  const t = now()
  const hit = cache.get(projectId)
  if (hit && hit.until > t) return hit.value
  let value = false
  try {
    const { count } = await client
      .from('bpm_workflows')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('is_active', true)
      .contains('flow_data', { nodes: [{ type: 'approval' }] })
    value = (count ?? 0) > 0
  } catch {
    return false // falha só esconde o atalho; não guarda, para tentar de novo na próxima
  }
  cache.set(projectId, { value, until: t + TTL_MS })
  if (cache.size > 500) for (const [k, v] of cache) if (v.until < t) cache.delete(k)
  return value
}
