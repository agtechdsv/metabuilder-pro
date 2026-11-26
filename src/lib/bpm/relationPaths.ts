/**
 * Caminhos de relacionamento da ação "Consultar dados" (Studio). Um campo de outra tabela é alcançado por uma cadeia de saltos
 * "chave estrangeira -> chave da tabela seguinte", sempre no sentido "muitos para um" (nunca multiplica as linhas), com no máximo
 * MAX_JOIN_DEPTH níveis. Os relacionamentos vêm da tabela `relations` do projeto (Santo Graal), nunca do nome da coluna.
 *
 * O motor (cli/bpmCore.js, runQueryAction) lê `queryJoins[chaveDoCampo] = { path: [{ fk, modelId, pk }, ...], field }`;
 * o formato antigo de um salto ({ fk, modelId, field, pk }) continua valendo.
 */

export const MAX_JOIN_DEPTH = 4

export interface RelationCtx {
  relations: any[]
  dbFields: any[]
  dbModels: any[]
}

/** Um salto já resolvido: de onde sai (fk), a tabela de chegada (modelo) e a chave dela (pk). */
export interface PathHop {
  fk: string
  fkLabel: string
  modelId: string
  modelLabel: string
  pk: string
}

export interface JoinSpec {
  path: { fk: string; modelId: string; pk: string }[]
  field: string
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export const fieldLabelOf = (f: any): string => f?.widget_options?.label?.text || f?.display_name || f?.db_column_name || f?.name
export const modelLabelOf = (m: any): string => m?.display_name || m?.db_table_name || m?.name
export const columnNameOf = (f: any): string => f?.db_column_name || f?.name

/** Colunas que guardam segredos: não são oferecidas para ir a e-mail ou planilha. */
export const isSensitiveField = (name: string): boolean => /(hash|senha|password|passwd|secret|token|api_?key|segredo)/i.test(String(name || ''))

/** Colunas de controle (quem e quando criou ou mudou o registro): ficam recolhidas. */
export const isControlField = (name: string): boolean => /^(criado|atualizado|created|updated)_(em|por|at|by)$/i.test(String(name || ''))

export function fieldsOfModel(ctx: RelationCtx, modelId: string): { field: string; label: string; type: string }[] {
  return ctx.dbFields
    .filter((f) => f.model_id === modelId)
    .map((f) => ({ field: columnNameOf(f), label: fieldLabelOf(f), type: f.data_type || 'text' }))
}

/** Relacionamentos que SAEM da tabela (muitos para um): cada um é um salto possível. */
export function outgoingHops(ctx: RelationCtx, modelId: string): PathHop[] {
  const hops: PathHop[] = []
  for (const r of ctx.relations || []) {
    if ((r.from_model_id || r.detail_model_id) !== modelId) continue
    const fk = ctx.dbFields.find((f) => f.id === (r.from_field_id || r.foreign_column_id))
    const target = ctx.dbModels.find((m) => m.id === (r.to_model_id || r.master_model_id))
    const pk = ctx.dbFields.find((f) => f.id === (r.to_field_id || r.referenced_column_id))
    if (!fk || !target || !pk) continue
    hops.push({ fk: columnNameOf(fk), fkLabel: fieldLabelOf(fk), modelId: target.id, modelLabel: modelLabelOf(target), pk: columnNameOf(pk) })
  }
  return hops
}

/** Saltos que ainda podem ser dados a partir do fim do caminho: respeita o limite de níveis e não volta a uma tabela já visitada. */
export function nextHops(ctx: RelationCtx, baseModelId: string, path: PathHop[]): PathHop[] {
  if (path.length >= MAX_JOIN_DEPTH) return []
  const last = path.length ? path[path.length - 1].modelId : baseModelId
  const visited = new Set([baseModelId, ...path.map((h) => h.modelId)])
  return outgoingHops(ctx, last).filter((h) => !visited.has(h.modelId))
}

/** Chave do campo no nó: rel_<fk1>__<fk2>__<campo>. Com um salto é igual à chave do formato antigo (rel_<fk>__<campo>). */
export const relatedKey = (path: PathHop[], field: string): string => `rel_${path.map((h) => h.fk).join('__')}__${field}`

export const joinSpecOf = (path: PathHop[], field: string): JoinSpec => ({
  path: path.map((h) => ({ fk: h.fk, modelId: h.modelId, pk: h.pk })),
  field,
})

/** Título padrão da coluna (cabeçalho da planilha): "Cliente › Nome". */
export const defaultColumnLabel = (path: PathHop[], fieldLabel: string): string =>
  path.length ? `${path[path.length - 1].fkLabel} › ${fieldLabel}` : fieldLabel

/** Passos do caminho de uma junção gravada, nos dois formatos (um salto antigo ou lista de saltos). */
export function hopsOfJoin(join: any): { fk: string; modelId: string; pk: string }[] {
  if (!join) return []
  if (Array.isArray(join.path) && join.path.length > 0) return join.path
  return join.fk && join.modelId ? [{ fk: join.fk, modelId: join.modelId, pk: join.pk || 'id' }] : []
}

/** "Pedidos › Clientes › Nome empresa": o caminho completo até o campo de uma coluna relacionada. */
export function describePath(ctx: RelationCtx, baseModelId: string, join: any): string {
  const hops = hopsOfJoin(join)
  const names = [modelLabelOf(ctx.dbModels.find((m) => m.id === baseModelId))]
  for (const h of hops) names.push(modelLabelOf(ctx.dbModels.find((m) => m.id === h.modelId)) || h.modelId)
  const lastModel = hops.length ? hops[hops.length - 1].modelId : baseModelId
  const f = ctx.dbFields.find((x) => x.model_id === lastModel && columnNameOf(x) === join?.field)
  names.push(f ? fieldLabelOf(f) : String(join?.field ?? ''))
  return names.filter(Boolean).join(' › ')
}

export interface PathNode {
  path: PathHop[]
  modelId: string
}

/** Todas as tabelas alcançáveis a partir da base (até o limite de níveis), para a busca. `cap` evita explosão em modelos muito ligados. */
export function reachableTables(ctx: RelationCtx, baseModelId: string, cap = 3000): PathNode[] {
  const out: PathNode[] = [{ path: [], modelId: baseModelId }]
  for (let i = 0; i < out.length && out.length < cap; i++) {
    for (const h of nextHops(ctx, baseModelId, out[i].path)) {
      out.push({ path: [...out[i].path, h], modelId: h.modelId })
      if (out.length >= cap) break
    }
  }
  return out
}

export interface FieldHit {
  path: PathHop[]
  field: string
  label: string
  type: string
  key: string
}

/** Busca um campo (pelo título ou pelo nome da coluna) em todos os níveis; sem segredos. Os mais próximos da base vêm primeiro. */
export function searchFields(ctx: RelationCtx, baseModelId: string, text: string, limit = 60): FieldHit[] {
  const q = norm(text).trim()
  if (q.length < 2) return []
  const hits: FieldHit[] = []
  for (const node of reachableTables(ctx, baseModelId)) {
    for (const f of fieldsOfModel(ctx, node.modelId)) {
      if (isSensitiveField(f.field)) continue
      if (!norm(f.label).includes(q) && !norm(f.field).includes(q)) continue
      hits.push({ path: node.path, field: f.field, label: f.label, type: f.type, key: node.path.length ? relatedKey(node.path, f.field) : f.field })
      if (hits.length >= limit) return hits
    }
  }
  return hits
}
