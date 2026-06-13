/**
 * Santo Graal — Biblioteca de Path-Finding por BFS
 *
 * Resolve automaticamente o caminho de JOINs entre quaisquer duas tabelas
 * usando o grafo de relações do projeto (tabela `relations` do Supabase).
 *
 * Algoritmo: BFS (Busca em Largura) — garante o caminho mais curto.
 * Suporta ciclos (nós visitados), múltiplos caminhos (BFS escolhe o mais curto)
 * e relações bidirecionais.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ResolvedRelation {
  id: string
  from_table: string   // db_table_name já resolvido
  from_field: string   // db_column_name já resolvido
  to_table: string
  to_field: string
  relation_type?: string
  source?: 'cli' | 'manual'
}

export interface JoinStep {
  fromTable: string
  fromField: string
  toTable: string
  toField: string
}

// ─── Resolução de Relações ────────────────────────────────────────────────────

/**
 * Converte a estrutura raw da tabela `relations` (com UUIDs de model/field)
 * para `ResolvedRelation` com nomes reais de tabela e coluna.
 * Deve ser chamada UMA vez ao carregar o projeto.
 */
export function resolveRelations(
  rawRelations: any[],
  models: any[]
): ResolvedRelation[] {
  const resolved: ResolvedRelation[] = []

  for (const rel of rawRelations) {
    // Resolve modelo de origem
    const fromModel = models.find((m: any) =>
      String(m.id) === String(rel.from_model_id)
    )
    // Resolve modelo de destino
    const toModel = models.find((m: any) =>
      String(m.id) === String(rel.to_model_id)
    )

    if (!fromModel || !toModel) continue

    // Resolve campo de origem (FK)
    const fromFields = Array.isArray(fromModel.fields)
      ? fromModel.fields
      : Object.values(fromModel.fields || {})
    const fromField = fromFields.find((f: any) =>
      String(f.id) === String(rel.from_field_id)
    )

    // Resolve campo de destino (PK referenciada)
    const toFields = Array.isArray(toModel.fields)
      ? toModel.fields
      : Object.values(toModel.fields || {})
    const toField = toFields.find((f: any) =>
      String(f.id) === String(rel.to_field_id)
    )

    if (!fromField || !toField) continue

    resolved.push({
      id: rel.id,
      from_table: fromModel.db_table_name,
      from_field: fromField.db_column_name,
      to_table: toModel.db_table_name,
      to_field: toField.db_column_name,
      relation_type: rel.relation_type,
      source: rel.source || 'cli',
    })
  }

  return resolved
}

// ─── BFS: Caminho entre Duas Tabelas ─────────────────────────────────────────

/**
 * Encontra o caminho de JOINs mais curto entre `fromTable` e `toTable`
 * usando BFS no grafo de relações.
 *
 * @returns Array de JoinStep em ordem, ou null se não há caminho.
 */
export function findJoinPath(
  relations: ResolvedRelation[],
  fromTable: string,
  toTable: string
): JoinStep[] | null {
  if (fromTable.toLowerCase() === toTable.toLowerCase()) return []

  // Cada entrada na fila é o caminho percorrido até aqui
  const queue: Array<{ table: string; path: JoinStep[] }> = [
    { table: fromTable.toLowerCase(), path: [] },
  ]
  const visited = new Set<string>([fromTable.toLowerCase()])

  while (queue.length > 0) {
    const { table: current, path } = queue.shift()!

    // Busca todas as relações onde `current` aparece (em qualquer lado)
    const neighbors = getNeighbors(relations, current)

    for (const { step, neighborTable } of neighbors) {
      if (visited.has(neighborTable)) continue
      visited.add(neighborTable)

      const newPath = [...path, step]

      if (neighborTable === toTable.toLowerCase()) {
        return newPath
      }

      queue.push({ table: neighborTable, path: newPath })
    }
  }

  return null // Sem caminho
}

/**
 * Retorna os vizinhos de uma tabela no grafo de relações (bidirecional).
 */
function getNeighbors(
  relations: ResolvedRelation[],
  tableName: string
): Array<{ step: JoinStep; neighborTable: string }> {
  const result: Array<{ step: JoinStep; neighborTable: string }> = []
  const lower = tableName.toLowerCase()

  for (const rel of relations) {
    const fromLower = rel.from_table.toLowerCase()
    const toLower = rel.to_table.toLowerCase()

    if (fromLower === lower) {
      // Relação direta: from_table → to_table
      result.push({
        neighborTable: toLower,
        step: {
          fromTable: rel.from_table,
          fromField: rel.from_field,
          toTable: rel.to_table,
          toField: rel.to_field,
        },
      })
    } else if (toLower === lower) {
      // Relação inversa: to_table → from_table
      result.push({
        neighborTable: fromLower,
        step: {
          fromTable: rel.to_table,
          fromField: rel.to_field,
          toTable: rel.from_table,
          toField: rel.from_field,
        },
      })
    }
  }

  return result
}

// ─── Resolve Múltiplas Tabelas (Spanning Tree) ────────────────────────────────

/**
 * Dado um conjunto de tabelas que precisam estar no SELECT,
 * encontra todos os JOINs necessários para conectá-las à tabela raiz.
 *
 * Usa uma abordagem de spanning tree: começa com `rootTable` e vai
 * adicionando joins para cada tabela adicional, usando o grafo de relações.
 *
 * @param relations - Relações resolvidas do projeto
 * @param rootTable - Tabela principal da query (FROM)
 * @param additionalTables - Demais tabelas que precisam ser incluídas
 * @returns Array de JoinStep sem duplicatas, em ordem de dependência
 */
export function resolveAllJoins(
  relations: ResolvedRelation[],
  rootTable: string,
  additionalTables: string[]
): JoinStep[] {
  const joinedTables = new Set<string>([rootTable.toLowerCase()])
  const allSteps: JoinStep[] = []
  const seenJoinKeys = new Set<string>()

  // Tabelas únicas e diferentes da raiz
  const uniqueTables = [
    ...new Set(
      additionalTables
        .map(t => t.toLowerCase())
        .filter(t => t && t !== rootTable.toLowerCase())
    ),
  ]

  // Tenta adicionar cada tabela necessária usando BFS
  // Iteração em loop para suportar dependências transitivas
  let changed = true
  let safety = 0

  while (changed && uniqueTables.some(t => !joinedTables.has(t)) && safety < 20) {
    changed = false
    safety++

    for (const targetTable of uniqueTables) {
      if (joinedTables.has(targetTable)) continue

      // Tenta encontrar um caminho de qualquer tabela já joined para targetTable
      let bestPath: JoinStep[] | null = null

      for (const joinedTable of Array.from(joinedTables)) {
        const path = findJoinPath(relations, joinedTable, targetTable)
        if (path && path.length > 0) {
          if (!bestPath || path.length < bestPath.length) {
            bestPath = path
          }
        }
      }

      if (bestPath) {
        // Adiciona apenas os passos que ainda não foram adicionados
        for (const step of bestPath) {
          const key = `${step.fromTable}.${step.fromField}→${step.toTable}.${step.toField}`
          const reverseKey = `${step.toTable}.${step.toField}→${step.fromTable}.${step.fromField}`

          if (!seenJoinKeys.has(key) && !seenJoinKeys.has(reverseKey)) {
            allSteps.push(step)
            seenJoinKeys.add(key)
          }

          joinedTables.add(step.fromTable.toLowerCase())
          joinedTables.add(step.toTable.toLowerCase())
        }
        changed = true
      }
    }
  }

  return allSteps
}

// ─── Geração de SQL ────────────────────────────────────────────────────────────

/**
 * Converte um array de JoinStep em cláusula SQL de LEFT JOINs.
 */
export function buildJoinSql(steps: JoinStep[], filterTables?: Set<string>): string {
  return steps
    .map(s => {
      const joinType = filterTables?.has(s.toTable.toLowerCase()) ? 'INNER JOIN' : 'LEFT JOIN'
      return ` ${joinType} "${s.toTable}" ON "${s.fromTable}"."${s.fromField}" = "${s.toTable}"."${s.toField}"`
    })
    .join('')
}

/**
 * Extrai os nomes de tabela únicos de uma lista de campos no formato "tabela.campo".
 * Ignora campos sem ponto (que são da tabela raiz).
 */
export function extractTableNames(fieldExpressions: string[]): string[] {
  const tables = new Set<string>()
  for (const expr of fieldExpressions) {
    if (expr && expr.includes('.')) {
      const table = expr.split('.')[0].replace(/"/g, '')
      if (table) tables.add(table)
    }
  }
  return Array.from(tables)
}

/**
 * Verificação rápida: retorna true se existe um caminho entre duas tabelas.
 */
export function hasPath(
  relations: ResolvedRelation[],
  fromTable: string,
  toTable: string
): boolean {
  return findJoinPath(relations, fromTable, toTable) !== null
}
