// Utility to resolve BFS relations
export function resolveRelations(projectRelations: any[], models: any[]) {
  const rels: any[] = [];
  projectRelations.forEach(r => {
    rels.push(r);
  });
  return rels;
}

export function resolveAllJoins(relations: any[], fromTable: string, toTables: string[]) {
  // Simple BFS to find the shortest path between tables
  const graph: Record<string, { targetTable: string, sourceColumn: string, targetColumn: string }[]> = {};
  
  relations.forEach(r => {
    if (!graph[r.table_name]) graph[r.table_name] = [];
    if (!graph[r.foreign_table_name]) graph[r.foreign_table_name] = [];
    
    graph[r.table_name].push({
      targetTable: r.foreign_table_name,
      sourceColumn: r.column_name,
      targetColumn: r.foreign_column_name || 'id'
    });
    
    // add reverse edge
    graph[r.foreign_table_name].push({
      targetTable: r.table_name,
      sourceColumn: r.foreign_column_name || 'id',
      targetColumn: r.column_name
    });
  });

  const queue: { table: string, path: any[] }[] = [{ table: fromTable, path: [] }];
  const visited = new Set<string>();
  visited.add(fromTable);

  while (queue.length > 0) {
    const { table, path } = queue.shift()!;
    if (toTables.includes(table)) {
      return path;
    }

    const neighbors = graph[table] || [];
    for (const n of neighbors) {
      if (!visited.has(n.targetTable)) {
        visited.add(n.targetTable);
        queue.push({
          table: n.targetTable,
          path: [...path, { sourceTable: table, sourceColumn: n.sourceColumn, targetTable: n.targetTable, targetColumn: n.targetColumn }]
        });
      }
    }
  }

  return [];
}
