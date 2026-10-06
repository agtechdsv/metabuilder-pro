/**
 * Tabelas que um widget de BI usa (além da principal): valor, fórmula, agrupamento, série, divisor,
 * filtros, período e a tabela do nome legível das chaves estrangeiras.
 */
import { resolveFkLabel, type FkRelation } from './fkLabel'

const FORMULA_REF = /([A-Za-z_][A-Za-z0-9_]*)\.[A-Za-z_][A-Za-z0-9_]*/g

export function widgetReferencedTables(widget: any, mainTable: string, models: any[], relations: FkRelation[]): string[] {
  const tables = new Set<string>()
  const addRef = (ref?: string) => {
    if (ref && String(ref).includes('.')) tables.add(String(ref).split('.')[0])
  }
  if (widget?.use_formula && widget?.field) {
    for (const m of String(widget.field).matchAll(FORMULA_REF)) tables.add(m[1])
  } else {
    addRef(widget?.field)
  }
  addRef(widget?.group_by)
  addRef(widget?.series_by)
  addRef(widget?.divide_by?.field)
  addRef(widget?.period_field)
  ;(widget?.conditions || []).forEach((c: any) => addRef(c?.field))

  // agrupar por chave estrangeira mostra o nome do registro relacionado: essa tabela entra na consulta
  for (const ref of [widget?.group_by, widget?.series_by]) {
    if (!ref || !String(ref).includes('.')) continue
    const [table, column] = String(ref).split('.')
    const fk = resolveFkLabel(models, relations, { table, column })
    if (fk) tables.add(fk.label.table)
  }

  const main = String(mainTable).toLowerCase()
  return [...tables].filter(t => t.toLowerCase() !== main)
}
