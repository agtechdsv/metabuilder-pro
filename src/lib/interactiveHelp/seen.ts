/**
 * Tutoriais já vistos da Ajuda Interativa, guardados SÓ no navegador da pessoa (localStorage), por projeto e por tela.
 * É uma conveniência: sem armazenamento (janela anônima, bloqueado, cota cheia) tudo continua funcionando, só sem a memória.
 * O armazenamento é injetado, para os testes não dependerem do navegador.
 */

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const seenStorageKey = (projectId?: string, viewId?: string) => `mb_tour_seen:${projectId || '-'}:${viewId || '-'}`

/** O localStorage do navegador, ou null quando não dá para usá-lo (acessar já pode lançar). */
export function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

/** Ids dos tutoriais vistos. Nunca lança e ignora lixo no valor guardado. */
export function readSeen(storage: KeyValueStorage | null | undefined, key: string): string[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Marca como visto e devolve a lista nova (mesmo sem armazenamento, a lista devolvida vale para a sessão da tela). */
export function markSeen(storage: KeyValueStorage | null | undefined, key: string, id: string, current?: readonly string[]): string[] {
  const base = current ?? readSeen(storage, key)
  const next = base.includes(id) ? [...base] : [...base, id]
  try { storage?.setItem(key, JSON.stringify(next)) } catch { /* sem armazenamento: segue sem a memória */ }
  return next
}

export function clearSeen(storage: KeyValueStorage | null | undefined, key: string): void {
  try { storage?.removeItem(key) } catch { /* nada a limpar */ }
}

/** Os que faltam ver, na ordem do dev ("Continuar de onde parei"). */
export function unseenTours<T extends { id: string }>(tours: readonly T[], seen: readonly string[]): T[] {
  return tours.filter(t => !seen.includes(t.id))
}
