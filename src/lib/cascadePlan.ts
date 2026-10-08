/**
 * Exclusão em cascata: quais tabelas filhas (e netas...) têm registros ligados ao registro que será excluído.
 * A MESMA lista serve para excluir (de baixo para cima) e para contar o que será apagado antes de o usuário confirmar.
 */
export interface CascadeStep {
  table: string
  condition: string
}

interface ChildRelation { table: string; fk: string; pk: string }

const lit = (v: unknown) => String(v).replace(/'/g, "''")

export function planCascade(opts: { models: any[]; relations: any[]; rootTable: string; pkKey: string; pkValue: unknown }): CascadeStep[] {
  const { models, relations, rootTable, pkKey, pkValue } = opts
  const childRelations = new Map<string, ChildRelation[]>()

  relations.forEach((r: any) => {
    const parentModelDef = models.find((m: any) => m.id === r.master_model_id || m.id === r.to_model_id)
    const childModelDef = models.find((m: any) => m.id === r.detail_model_id || m.id === r.from_model_id)
    if (!parentModelDef || !childModelDef) return
    const pTable = (parentModelDef.db_table_name || parentModelDef.name).toLowerCase()
    const parentPkField = parentModelDef.fields?.find((f: any) => f.id === (r.referenced_column_id || r.to_field_id))
    const childFkField = childModelDef.fields?.find((f: any) => f.id === (r.foreign_column_id || r.from_field_id))
    if (!parentPkField || !childFkField) return
    if (!childRelations.has(pTable)) childRelations.set(pTable, [])
    childRelations.get(pTable)!.push({
      table: childModelDef.db_table_name || childModelDef.name,
      fk: childFkField.db_column_name || childFkField.name,
      pk: parentPkField.db_column_name || parentPkField.name,
    })
  })

  const steps: CascadeStep[] = []
  const walk = (parentTbl: string, parentCondition: string, path: string[]) => {
    const safeParent = (parentTbl || '').toLowerCase()
    if (!safeParent || path.includes(safeParent)) return // ciclo
    const currentPath = [...path, safeParent]
    for (const child of childRelations.get(safeParent) || []) {
      if (!child.table) continue
      const condition = `${child.fk} IN (SELECT ${child.pk} FROM ${parentTbl} WHERE ${parentCondition})`
      walk(child.table, condition, currentPath)
      steps.push({ table: child.table, condition })
    }
  }
  walk(rootTable, `${pkKey} = '${lit(pkValue)}'`, [])

  const seen = new Set<string>()
  return steps.filter(s => {
    const key = `${s.table}|${s.condition}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Os comandos de exclusão, de baixo para cima (a última linha do registro é acrescentada por quem chama). */
export const cascadeDeleteSql = (steps: CascadeStep[]): string[] => steps.map(s => `DELETE FROM ${s.table} WHERE ${s.condition}`)

/** Uma única consulta que devolve (t, n): quantos registros cada tabela filha perderia. null = não há filhas. */
export function cascadeCountSql(steps: CascadeStep[]): string | null {
  if (steps.length === 0) return null
  return steps.map(s => `SELECT '${lit(s.table)}' AS t, COUNT(*) AS n FROM ${s.table} WHERE ${s.condition}`).join(' UNION ALL ')
}

export interface CascadeCount { table: string; count: number }

/** Lê as linhas devolvidas pela consulta acima (Oracle devolve as colunas em maiúsculas) somando por tabela; ignora as vazias. */
export function parseCascadeCounts(rows: any[]): CascadeCount[] {
  const byTable = new Map<string, number>()
  for (const r of rows || []) {
    const t = r?.t ?? r?.T
    const n = Number(r?.n ?? r?.N ?? 0)
    if (!t || !Number.isFinite(n) || n <= 0) continue
    byTable.set(String(t), (byTable.get(String(t)) || 0) + n)
  }
  return [...byTable.entries()].map(([table, count]) => ({ table, count }))
}
