// Utility to resolve BFS relations
// projectRelations: raw relations from DB (table 'relations')
// Structure: { from_model_id, from_field_id, to_model_id, to_field_id, relation_type, ... }
// models: array of project models with { id, db_table_name, fields: [{ id, db_column_name }] }
export function resolveRelations(projectRelations: any[], models: any[]) {
  // Build lookup maps: model_id → db_table_name, field_id → db_column_name
  const modelMap: Record<string, string> = {}
  const fieldMap: Record<string, string> = {}
  
  for (const m of (models || [])) {
    if (m.id && m.db_table_name) {
      modelMap[String(m.id)] = m.db_table_name
    }
    for (const f of (m.fields || [])) {
      if (f.id && f.db_column_name) {
        fieldMap[String(f.id)] = f.db_column_name
      }
    }
  }

  const resolved: any[] = []
  for (const r of (projectRelations || [])) {
    // Already has table names (pre-resolved or legacy format)
    if (r.table_name && r.foreign_table_name) {
      resolved.push(r)
      continue
    }
    
    // Format from 'relations' table: from_model_id → to_model_id
    const fromTable = modelMap[String(r.from_model_id)]
    const toTable = modelMap[String(r.to_model_id)]
    const fromCol = fieldMap[String(r.from_field_id)] || 'id'
    const toCol = fieldMap[String(r.to_field_id)] || 'id'
    
    if (fromTable && toTable) {
      resolved.push({
        ...r,
        table_name: fromTable,
        column_name: fromCol,
        foreign_table_name: toTable,
        foreign_column_name: toCol,
      })
    }
  }
  return resolved
}

export function resolveAllJoins(relations: any[], fromTable: string, toTables: string[]) {
  // BFS to find the shortest path between fromTable and any table in toTables
  const graph: Record<string, { targetTable: string, sourceColumn: string, targetColumn: string }[]> = {}
  
  for (const r of relations) {
    const tName = r.table_name
    const fName = r.foreign_table_name
    const colName = r.column_name || 'id'
    const fColName = r.foreign_column_name || 'id'

    if (!tName || !fName) continue

    if (!graph[tName]) graph[tName] = []
    if (!graph[fName]) graph[fName] = []
    
    // Forward edge: fromTable.fromCol → toTable.toCol
    graph[tName].push({ targetTable: fName, sourceColumn: colName, targetColumn: fColName })
    // Reverse edge: toTable.toCol → fromTable.fromCol
    graph[fName].push({ targetTable: tName, sourceColumn: fColName, targetColumn: colName })
  }

  const queue: { table: string, path: any[] }[] = [{ table: fromTable, path: [] }]
  const visited = new Set<string>()
  visited.add(fromTable)

  while (queue.length > 0) {
    const { table, path } = queue.shift()!
    if (toTables.includes(table)) {
      return path
    }

    for (const n of (graph[table] || [])) {
      if (!visited.has(n.targetTable)) {
        visited.add(n.targetTable)
        queue.push({
          table: n.targetTable,
          path: [
            ...path,
            {
              sourceTable: table,
              sourceColumn: n.sourceColumn,
              targetTable: n.targetTable,
              targetColumn: n.targetColumn
            }
          ]
        })
      }
    }
  }

  return []
}
