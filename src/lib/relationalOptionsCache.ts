/**
 * Cache das listas usadas nos combos relacionais (ex.: Cliente, Funcionário).
 *
 * Estratégia "stale-while-revalidate": o cache só serve para a tela não abrir com ids crus / "Selecione...";
 * quem consome SEMPRE revalida em segundo plano. Além disso deduplica buscas idênticas em andamento
 * (vários campos apontando para a mesma tabela geram uma única consulta pelo túnel).
 *
 * Chave: projeto + tabela + colunas (assim Postgres/Oracle e projetos diferentes nunca se misturam).
 */

const mem = new Map<string, any[]>()
const inflight = new Map<string, Promise<any[]>>()
const STORAGE_PREFIX = 'mb_relopts:'

export function relOptionsKey(projectId: string, table: string, columns: string): string {
  return `${projectId}|${(table || '').toLowerCase()}|${(columns || '').toLowerCase()}`
}

export function getCachedRelOptions(key: string): any[] | null {
  const hit = mem.get(key)
  if (hit) return hit
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_PREFIX + key) : null
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        mem.set(key, parsed)
        return parsed
      }
    }
  } catch (_) {}
  return null
}

export function setCachedRelOptions(key: string, data: any[]): void {
  mem.set(key, data)
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data))
  } catch (_) {}
}

/** Executa `fetcher` uma única vez por chave enquanto houver uma busca idêntica em andamento. */
export function dedupeRelFetch(key: string, fetcher: () => Promise<any[]>): Promise<any[]> {
  const existing = inflight.get(key)
  if (existing) return existing
  const p = fetcher().finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

/** Descarta as listas em cache de uma tabela (chamar após salvar/excluir registros dela). */
export function invalidateRelOptions(projectId: string, table: string): void {
  const prefix = `${projectId}|${(table || '').toLowerCase()}|`
  for (const k of Array.from(mem.keys())) {
    if (k.startsWith(prefix)) mem.delete(k)
  }
  try {
    if (typeof sessionStorage === 'undefined') return
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const sk = sessionStorage.key(i)
      if (sk && sk.startsWith(STORAGE_PREFIX + prefix)) sessionStorage.removeItem(sk)
    }
  } catch (_) {}
}
