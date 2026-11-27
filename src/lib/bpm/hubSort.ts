/** Ordenação e busca do painel de escolha da Automação de processos (puras, para testar sem tela). */

export type TableSort = 'count_desc' | 'count_asc' | 'name_asc' | 'name_desc'
/** Fluxos de "Geral": só pelo nome. Fluxos "Por tabela": pelo nome, ou por tabela e depois nome. */
export type FlowSort = 'name_asc' | 'name_desc' | 'table_asc' | 'table_desc'

/** Texto comparável: sem acentos e sem diferenciar maiúsculas. */
export const norm = (s: string): string => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const cmp = (a: string, b: string, locale: string): number => a.localeCompare(b, locale, { sensitivity: 'base', numeric: true })

export interface HubTableItem { name: string; count: number }

export function sortTables<T extends HubTableItem>(items: T[], mode: TableSort, locale = 'pt'): T[] {
  const byName = (a: T, b: T) => cmp(a.name, b.name, locale)
  const out = [...items]
  if (mode === 'name_asc') return out.sort(byName)
  if (mode === 'name_desc') return out.sort((a, b) => byName(b, a))
  // quantidade: o empate se desfaz pelo nome (sempre A-Z), para a ordem não "pular" entre cliques
  if (mode === 'count_asc') return out.sort((a, b) => a.count - b.count || byName(a, b))
  return out.sort((a, b) => b.count - a.count || byName(a, b))
}

export function filterTables<T extends HubTableItem>(items: T[], query: string): T[] {
  const q = norm(query.trim())
  return q ? items.filter(i => norm(i.name).includes(q)) : items
}

export interface HubFlowItem { name: string; scopes: string[] }

export function sortFlows<T extends HubFlowItem>(items: T[], mode: FlowSort, locale = 'pt'): T[] {
  const byName = (a: T, b: T) => cmp(a.name, b.name, locale)
  const byTable = (a: T, b: T) => cmp(a.scopes[0] ?? '', b.scopes[0] ?? '', locale) || byName(a, b)
  const out = [...items]
  switch (mode) {
    case 'name_desc': return out.sort((a, b) => byName(b, a))
    case 'table_asc': return out.sort(byTable)
    case 'table_desc': return out.sort((a, b) => byTable(b, a))
    default: return out.sort(byName)
  }
}

/** Acha pelo nome do fluxo ou pelo nome de uma das tabelas dele. */
export function filterFlows<T extends HubFlowItem>(items: T[], query: string): T[] {
  const q = norm(query.trim())
  return q ? items.filter(i => norm(i.name).includes(q) || i.scopes.some(s => norm(s).includes(q))) : items
}
