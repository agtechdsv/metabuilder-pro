/**
 * Orquestrador (lógica "personalizado"): o caminho de relacionamentos de uma aba liga a tabela da aba à tabela do mestre.
 * O runtime guarda uma lista de ids de relações, NA ORDEM, da tabela da aba até a do mestre. Sem caminho, ele só acha uma ligação direta;
 * sem ela, a aba não filtra e mostra todos os registros. Aqui ficam a busca do caminho, a conferência e a descrição, sem tela.
 */

export interface RawRelation {
  id: string
  from_model_id?: string
  to_model_id?: string
  detail_model_id?: string
  master_model_id?: string
  [k: string]: unknown
}

/** As duas pontas de uma relação (a tela e o runtime aceitam os dois nomes de campo). */
export function relationEnds(rel: RawRelation): { a: string; b: string } {
  return { a: String(rel.from_model_id ?? rel.detail_model_id ?? ''), b: String(rel.to_model_id ?? rel.master_model_id ?? '') }
}

/** Outra ponta da relação, partindo de `modelId`; null se a relação não toca nele. */
function otherEnd(rel: RawRelation, modelId: string): string | null {
  const { a, b } = relationEnds(rel)
  if (a === modelId && b) return b
  if (b === modelId && a) return a
  return null
}

/**
 * Caminho mais curto (busca em largura) entre dois modelos, como lista de ids de relações em ordem de `fromModelId` até `toModelId`.
 * null se não há caminho dentro de `maxHops` relações; [] se são o mesmo modelo.
 */
export function suggestRelationPath(relations: RawRelation[], fromModelId: string, toModelId: string, maxHops = 4): string[] | null {
  const from = String(fromModelId || ''); const to = String(toModelId || '')
  if (!from || !to) return null
  if (from === to) return []
  const queue: { model: string; path: string[] }[] = [{ model: from, path: [] }]
  const seen = new Set<string>([from])
  while (queue.length > 0) {
    const { model, path } = queue.shift()!
    if (path.length >= maxHops) continue
    for (const rel of relations) {
      const next = otherEnd(rel, model)
      if (!next || seen.has(next)) continue
      const newPath = [...path, rel.id]
      if (next === to) return newPath
      seen.add(next)
      queue.push({ model: next, path: newPath })
    }
  }
  return null
}

/** O caminho guardado leva mesmo da tabela da aba até a do mestre, relação por relação? (ids vazios ou desconhecidos invalidam) */
export function isPathValid(relations: RawRelation[], path: string[], tabModelId: string, masterModelId: string): boolean {
  if (!path.length) return false
  let cur = String(tabModelId || '')
  for (const id of path) {
    const rel = id ? relations.find(r => r.id === id) : undefined
    if (!rel) return false
    const next = otherEnd(rel, cur)
    if (!next) return false
    cur = next
  }
  return cur === String(masterModelId || '')
}

/** O que mostrar na aba sobre a ligação com o mestre. */
export type LinkStatus =
  | { kind: 'skip' }                              // nada a conferir (sem mestre, sem caso de uso, mesmo modelo, vínculo desligado)
  | { kind: 'ok' }                                // caminho guardado e válido
  | { kind: 'empty'; suggestion: string[] }       // sem caminho, mas há rota: dá para preencher
  | { kind: 'invalid'; suggestion: string[] }     // caminho guardado não chega ao mestre, mas há rota
  | { kind: 'no_route'; hadPath: boolean }        // não há relação entre as tabelas: a aba mostraria tudo

export function checkTabLink(args: {
  relations: RawRelation[]
  path: string[] | undefined
  tabModelId: string | undefined
  masterModelId: string | undefined
  linkedToMaster: boolean
}): LinkStatus {
  const { relations, linkedToMaster } = args
  const path = (args.path || []).filter(x => x !== undefined)
  const tab = String(args.tabModelId || ''); const master = String(args.masterModelId || '')
  if (!linkedToMaster || !tab || !master || tab === master) return { kind: 'skip' }
  if (path.length > 0 && isPathValid(relations, path, tab, master)) return { kind: 'ok' }
  const suggestion = suggestRelationPath(relations, tab, master)
  if (suggestion && suggestion.length > 0) return path.length === 0 ? { kind: 'empty', suggestion } : { kind: 'invalid', suggestion }
  return { kind: 'no_route', hadPath: path.length > 0 }
}

/** "entregas → pedidos → clientes": nomes das tabelas do caminho, a partir da tabela da aba. */
export function describePath(relations: RawRelation[], models: { id: string; db_table_name?: string; display_name?: string }[], path: string[], tabModelId: string): string {
  const nameOf = (id: string) => { const m = models.find(x => String(x.id) === id); return m?.display_name || m?.db_table_name || '?' }
  const names = [nameOf(String(tabModelId))]
  let cur = String(tabModelId)
  for (const id of path) {
    const rel = relations.find(r => r.id === id)
    const next = rel ? otherEnd(rel, cur) : null
    if (!next) break
    names.push(nameOf(next))
    cur = next
  }
  return names.join(' → ')
}
