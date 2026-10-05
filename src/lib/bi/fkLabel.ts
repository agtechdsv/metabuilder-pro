/**
 * Agrupar por uma chave estrangeira (ex.: pedidos.cliente_id) mostrava o UUID no gráfico.
 * Aqui descobrimos, pelas relações do projeto, qual é o registro relacionado e qual coluna o descreve
 * (o primeiro campo de texto visível que não seja chave primária nem chave estrangeira, como no restante do produto).
 */
import type { BiColRef } from './queryBuilder'

export interface FkRelation { from_table: string; from_field: string; to_table: string; to_field: string }

const TEXT_TYPE = /(char|text|string|citext)/i
const eq = (a?: string | null, b?: string | null) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase()

/** Coluna que descreve o registro de uma tabela, ou null se não houver campo de texto adequado. */
export function pickLabelColumn(model: any, relations: FkRelation[]): string | null {
  if (!model) return null
  const table = model.db_table_name
  const fkColumns = new Set(relations.filter(r => eq(r.from_table, table)).map(r => String(r.from_field).toLowerCase()))
  const fields: any[] = (Array.isArray(model.fields) ? model.fields : Object.values(model.fields || {}))
    .slice()
    .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
  const f = fields.find(x =>
    !x.is_primary_key &&
    !fkColumns.has(String(x.db_column_name).toLowerCase()) &&
    x.is_visible_in_list !== false &&
    TEXT_TYPE.test(String(x.db_data_type || x.data_type || '')),
  )
  return f?.db_column_name ?? null
}

/** Se `ref` é uma chave estrangeira com campo descritivo no registro relacionado: { label, key }; senão null. */
export function resolveFkLabel(models: any[], relations: FkRelation[], ref: BiColRef): { label: BiColRef; key: BiColRef } | null {
  const rel = relations.find(r => eq(r.from_table, ref.table) && eq(r.from_field, ref.column) && r.to_table && r.to_field)
  if (!rel) return null
  const target = models.find(m => eq(m.db_table_name, rel.to_table))
  const labelCol = pickLabelColumn(target, relations)
  if (!labelCol) return null
  return { label: { table: rel.to_table, column: labelCol }, key: { table: rel.to_table, column: rel.to_field } }
}
