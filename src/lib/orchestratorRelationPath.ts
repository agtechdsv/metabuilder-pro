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
  from_field_id?: string
  /** marcada na tela de relacionamentos como relação só de auditoria (quem criou/alterou) */
  audit_only?: boolean | null
  [k: string]: unknown
}

/** As duas pontas de uma relação (a tela e o runtime aceitam os dois nomes de campo). */
export function relationEnds(rel: RawRelation): { a: string; b: string } {
  return { a: String(rel.from_model_id ?? rel.detail_model_id ?? ''), b: String(rel.to_model_id ?? rel.master_model_id ?? '') }
}

/**
 * Nomes de coluna que guardam QUEM criou/alterou o registro (auditoria), sem sentido de negócio:
 * created_by, updated_by, criado_por, usuario_criacao... Comparação sem maiúsculas, sublinhados e hifens.
 */
const AUDIT_COLUMN = /^(created|updated|deleted|modified|inserted|changed|criado|atualizado|alterado|excluido|deletado|cadastrado|incluido|modificado)(by|por)$|^(usuario|user|usr)(criacao|alteracao|atualizacao|exclusao|cadastro|inclusao|insercao|create|created|update|updated|delete|deleted|modify|modified)$|^(creator|criador|alterador)(id|user|usuario)?$/

export function isAuditColumnName(name: string | undefined | null): boolean {
  const n = String(name || '').toLowerCase().replace(/[\s_-]/g, '')
  if (!n) return false
  return AUDIT_COLUMN.test(n) || AUDIT_COLUMN.test(n.replace(/id$/, ''))
}

/** Ids das relações de auditoria: marcadas à mão (audit_only) ou cuja coluna de chave tem nome de auditoria. */
export function auditRelationIds(
  relations: RawRelation[],
  models: { id: string; fields?: unknown }[] | undefined,
): Set<string> {
  const columnOf = new Map<string, string>()
  for (const m of models || []) {
    const list = Array.isArray(m.fields) ? m.fields : Object.values((m.fields as object) || {})
    for (const f of list as { id?: string; db_column_name?: string }[]) if (f?.id) columnOf.set(String(f.id), String(f.db_column_name || ''))
  }
  const out = new Set<string>()
  for (const r of relations || []) {
    if (r.audit_only === true || isAuditColumnName(columnOf.get(String(r.from_field_id || '')))) out.add(String(r.id))
  }
  return out
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
export function suggestRelationPath(relations: RawRelation[], fromModelId: string, toModelId: string, maxHops = 4, auditIds?: Set<string>): string[] | null {
  const from = String(fromModelId || ''); const to = String(toModelId || '')
  if (!from || !to) return null
  if (from === to) return []
  const queue: { model: string; path: string[] }[] = [{ model: from, path: [] }]
  const seen = new Set<string>([from])
  while (queue.length > 0) {
    const { model, path } = queue.shift()!
    if (path.length >= maxHops) continue
    for (const rel of relations) {
      if (auditIds?.has(String(rel.id))) continue // auditoria (criado_por...) não é vínculo de negócio
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
  | { kind: 'audit'; suggestion: string[] | null } // caminho guardado passa por relação de auditoria (criado_por...): não é vínculo de negócio
  | { kind: 'no_route'; hadPath: boolean; onlyAudit: boolean } // não há relação de negócio entre as tabelas: a aba mostraria tudo

export function checkTabLink(args: {
  relations: RawRelation[]
  path: string[] | undefined
  tabModelId: string | undefined
  masterModelId: string | undefined
  linkedToMaster: boolean
  /** relações de auditoria (ver auditRelationIds): ficam fora da sugestão e fazem o caminho guardado ser avisado */
  auditIds?: Set<string>
}): LinkStatus {
  const { relations, linkedToMaster, auditIds } = args
  const path = (args.path || []).filter(x => x !== undefined)
  const tab = String(args.tabModelId || ''); const master = String(args.masterModelId || '')
  if (!linkedToMaster || !tab || !master || tab === master) return { kind: 'skip' }
  const suggestion = suggestRelationPath(relations, tab, master, 4, auditIds)
  const hasSuggestion = !!suggestion && suggestion.length > 0
  if (path.length > 0 && isPathValid(relations, path, tab, master)) {
    if (auditIds && path.some(id => auditIds.has(String(id)))) return { kind: 'audit', suggestion: hasSuggestion ? suggestion : null }
    return { kind: 'ok' }
  }
  if (hasSuggestion) return path.length === 0 ? { kind: 'empty', suggestion: suggestion! } : { kind: 'invalid', suggestion: suggestion! }
  const onlyAudit = !!auditIds && auditIds.size > 0 && suggestRelationPath(relations, tab, master) !== null
  return { kind: 'no_route', hadPath: path.length > 0, onlyAudit }
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
