/**
 * Classifica uma coluna (pelo tipo do banco) em texto, número ou data para os filtros do BI.
 * O tipo vem de `fields.data_type` (PostgreSQL: "timestamp with time zone", "integer"; Oracle: "NUMBER", "DATE", "VARCHAR2").
 */
import type { BiColKind } from './queryBuilder'

const NUMERIC = /^(int[248]?|integer|smallint|bigint|serial\d?|bigserial|smallserial|numeric|decimal|real|double|float\d?|number|money|binary_float|binary_double)(\b|\()/
const DATE = /^(date|time|timestamp|datetime|smalldatetime)/

export function biColumnKind(dataType?: string | null): BiColKind {
  const t = String(dataType ?? '').trim().toLowerCase()
  if (!t) return 'text'
  if (DATE.test(t)) return 'date'
  if (NUMERIC.test(t)) return 'number'
  return 'text'
}

/** Tipo do campo a partir do cadastro do campo (aceita data_type ou db_data_type). */
export function biFieldKind(field: any): BiColKind {
  return biColumnKind(field?.db_data_type || field?.data_type)
}
