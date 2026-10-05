/**
 * Agrupamentos de widgets do painel de BI.
 *
 * Modelo: `analytics_config.groups = [{ id, title }]` (a ordem do array é a ordem dos grupos na tela) e cada
 * widget aponta para o grupo por `group_id`. Widgets sem grupo (ou com grupo que não existe mais) ficam soltos, no topo.
 * A ordem do array `widgets` acompanha a tela: soltos primeiro, depois os grupos na ordem deles.
 */

export interface BiGroup { id: string; title: string }
interface W { id: string; group_id?: string | null }

export interface BiSection<T extends W> { group: BiGroup | null; widgets: T[] }

export function newGroupId(): string {
  return 'grp_' + Math.random().toString(36).slice(2, 9)
}

/** Seções na ordem da tela: [soltos, ...grupos]. A seção dos soltos sempre existe (pode estar vazia). */
export function sectionsOf<T extends W>(widgets: T[], groups: BiGroup[]): BiSection<T>[] {
  const known = new Set(groups.map(g => g.id))
  const loose = widgets.filter(w => !w.group_id || !known.has(w.group_id))
  return [
    { group: null, widgets: loose },
    ...groups.map(g => ({ group: g, widgets: widgets.filter(w => w.group_id === g.id) })),
  ]
}

export function flatten<T extends W>(sections: BiSection<T>[]): T[] {
  return sections.flatMap(s => s.widgets)
}

/**
 * Move um widget para um grupo (null = solto) na posição `toIndex` da lista de destino
 * (o índice vale depois de tirar o widget da origem; 'end' = no fim). Devolve o array de widgets já na ordem da tela.
 */
export function moveWidget<T extends W>(widgets: T[], groups: BiGroup[], widgetId: string, toGroupId: string | null, toIndex: number | 'end'): T[] {
  const moving = widgets.find(w => w.id === widgetId)
  if (!moving) return widgets
  const target = toGroupId && groups.some(g => g.id === toGroupId) ? toGroupId : null
  const sections = sectionsOf(widgets.filter(w => w.id !== widgetId), groups)
  const dest = sections.find(s => (s.group?.id ?? null) === target)
  if (!dest) return widgets
  const updated = { ...moving, group_id: target ?? undefined } as T
  const at = toIndex === 'end' ? dest.widgets.length : Math.max(0, Math.min(toIndex, dest.widgets.length))
  dest.widgets.splice(at, 0, updated)
  return flatten(sections)
}

/** Move um grupo para outra posição na lista de grupos. */
export function moveGroup(groups: BiGroup[], groupId: string, toIndex: number): BiGroup[] {
  const from = groups.findIndex(g => g.id === groupId)
  if (from < 0) return groups
  const next = [...groups]
  const [g] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, g)
  return next
}

/** Cria um grupo; o título pode ficar vazio (a tela mostra uma dica até o usuário digitar). */
export function addGroup(groups: BiGroup[], title: string, id: string = newGroupId()): BiGroup[] {
  return [...groups, { id, title: title.trim() }]
}

/** Renomeia; um nome em branco é ignorado (o grupo mantém o nome atual). */
export function renameGroup(groups: BiGroup[], id: string, title: string): BiGroup[] {
  const t = title.trim()
  if (!t) return groups
  return groups.map(g => (g.id === id ? { ...g, title: t } : g))
}

/** Remove o grupo; os widgets dele ficam soltos (nada é apagado). */
export function removeGroup<T extends W>(groups: BiGroup[], widgets: T[], id: string): { groups: BiGroup[]; widgets: T[] } {
  const nextGroups = groups.filter(g => g.id !== id)
  const nextWidgets = widgets.map(w => (w.group_id === id ? { ...w, group_id: undefined } : w)) as T[]
  return { groups: nextGroups, widgets: flatten(sectionsOf(nextWidgets, nextGroups)) }
}

/** Normaliza o array de widgets para a ordem da tela (útil depois de mexer em group_id). */
export function normalizeOrder<T extends W>(widgets: T[], groups: BiGroup[]): T[] {
  return flatten(sectionsOf(widgets, groups))
}

/** Texto de exibição de um grupo (um grupo recém-criado ainda não tem título). */
export function groupLabel(g: BiGroup): string {
  return g.title || 'Grupo sem nome'
}
