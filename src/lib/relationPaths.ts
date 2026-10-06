/**
 * Caminhos alternativos entre tabelas.
 *
 * O motor (relationPathFinder) sempre liga duas tabelas pelo caminho mais curto. Quando existe mais de uma forma de ligar
 * (duas chaves entre as mesmas tabelas, ou rotas diferentes de mesmo tamanho), o resultado depende de qual foi escolhida
 * e, antes, a escolha era implícita. Aqui listamos as alternativas para o desenvolvedor decidir.
 */
import { getNeighbors, findJoinPath, type ResolvedRelation, type JoinStep } from './relationPathFinder'

export interface PathSearchOptions {
  /** aceita caminhos até N passos mais longos que o mais curto (padrão 1) */
  maxExtraLength?: number
  maxPaths?: number
  maxDepth?: number
}

export const DEFAULT_PATH_OPTIONS: Required<PathSearchOptions> = { maxExtraLength: 1, maxPaths: 8, maxDepth: 5 }

/** Identificador estável de um caminho (é o que o widget guarda). */
export function pathSignature(steps: JoinStep[]): string {
  return steps.map(s => `${s.fromTable}.${s.fromField}>${s.toTable}.${s.toField}`.toLowerCase()).join('|')
}

/** Todos os caminhos simples (sem repetir tabela) de `from` até `to`, do mais curto para o mais longo. */
export function findAlternativePaths(
  relations: ResolvedRelation[],
  from: string,
  to: string,
  options: PathSearchOptions = {},
): JoinStep[][] {
  const { maxExtraLength, maxPaths, maxDepth } = { ...DEFAULT_PATH_OPTIONS, ...options }
  const fromL = from.toLowerCase()
  const toL = to.toLowerCase()
  if (fromL === toL) return []

  const found: JoinStep[][] = []
  const dfs = (table: string, visited: Set<string>, path: JoinStep[]) => {
    if (path.length >= maxDepth) return
    for (const { step, neighborTable } of getNeighbors(relations, table)) {
      if (visited.has(neighborTable)) continue
      const next = [...path, step]
      if (neighborTable === toL) { found.push(next); continue }
      visited.add(neighborTable)
      dfs(neighborTable, visited, next)
      visited.delete(neighborTable)
    }
  }
  dfs(fromL, new Set([fromL]), [])
  if (found.length === 0) return []

  found.sort((a, b) => a.length - b.length)
  const limit = found[0].length + maxExtraLength
  const seen = new Set<string>()
  const out: JoinStep[][] = []
  for (const p of found) {
    if (p.length > limit) break
    const sig = pathSignature(p)
    if (seen.has(sig)) continue
    seen.add(sig)
    out.push(p)
    if (out.length >= maxPaths) break
  }
  return out
}

/** O caminho que o motor usa quando o desenvolvedor não escolhe (o mais curto, por busca em largura). */
export function automaticPath(relations: ResolvedRelation[], from: string, to: string): JoinStep[] | null {
  return findJoinPath(relations, from, to)
}

/** "pedidos.funcionario_id → funcionarios.id › funcionarios.depto_id → departamentos.id" */
export function describePath(steps: JoinStep[], labelOf: (table: string) => string = t => t): string {
  return steps.map(s => `${labelOf(s.fromTable)}.${s.fromField} → ${labelOf(s.toTable)}.${s.toField}`).join('  ›  ')
}

/** Tabelas (além da principal) para as quais existe mais de um caminho possível. */
export function ambiguousTables(
  relations: ResolvedRelation[],
  mainTable: string,
  tables: string[],
  options?: PathSearchOptions,
): { table: string; paths: JoinStep[][] }[] {
  const out: { table: string; paths: JoinStep[][] }[] = []
  for (const t of tables) {
    if (t.toLowerCase() === mainTable.toLowerCase()) continue
    const paths = findAlternativePaths(relations, mainTable, t, options)
    if (paths.length > 1) out.push({ table: t, paths })
  }
  return out
}
