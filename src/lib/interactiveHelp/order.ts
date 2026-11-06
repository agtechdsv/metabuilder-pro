/**
 * Ordem e fila de reprodução da Ajuda Interativa (funções puras).
 * A ordem da lista de roteiros é a que o dev definiu no Studio; ela vale na modal do usuário, em "Reproduzir selecionados" e em "Reproduzir todos".
 */

import type { Tour } from './types'

/** Move o item uma posição para cima (delta -1) ou para baixo (+1). Fora dos limites devolve a lista como está. */
export function moveItem<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [...list]
  const next = [...list]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}

/** Marca ou desmarca (clicar de novo desmarca). Não altera a lista original. */
export function toggleId(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]
}

/**
 * Fila de reprodução: os roteiros escolhidos, SEMPRE na ordem do dev (e não na ordem em que o usuário clicou).
 * Sem `selectedIds`, é a lista toda ("Reproduzir todos").
 */
export function buildQueue(tours: readonly Tour[], selectedIds?: readonly string[]): Tour[] {
  if (!selectedIds) return [...tours]
  return tours.filter(t => selectedIds.includes(t.id))
}
