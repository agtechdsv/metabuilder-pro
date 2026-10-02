/**
 * Grupos do Personalizado: uma aba que contém vários casos de uso.
 *
 * Um grupo tem BLOCOS; cada bloco é "tabs" (subabas, um caso de uso por vez) ou "grid" (quadros, todos visíveis).
 * Assim um mesmo grupo mistura os dois modos (ex.: 2 quadros lado a lado em cima + subabas embaixo).
 *
 * Compatibilidade: grupos criados na fase 1 (campos `children` + `group_mode`, sem `blocks`) são lidos como UM bloco.
 */

export type GroupBlockMode = 'tabs' | 'grid'

export interface GroupBlock {
  id: string
  mode: GroupBlockMode
  children: any[]
}

export function getGroupBlocks(group: any): GroupBlock[] {
  if (Array.isArray(group?.blocks)) {
    return group.blocks.map((b: any, i: number) => ({
      id: b?.id || `${group?.id || 'group'}-b${i + 1}`,
      mode: b?.mode === 'grid' ? 'grid' : 'tabs',
      children: Array.isArray(b?.children) ? b.children : [],
    }))
  }
  return [{
    id: `${group?.id || 'group'}-b1`,
    mode: group?.group_mode === 'grid' ? 'grid' : 'tabs',
    children: Array.isArray(group?.children) ? group.children : [],
  }]
}

/** Todos os casos de uso (filhos) de um grupo, de todos os blocos. */
export function flattenGroupChildren(group: any): any[] {
  return getGroupBlocks(group).flatMap((b) => b.children)
}

/** Slots de primeiro nível + grupos + filhos dos grupos (para buscas por id/slug). */
export function flattenSlots(slots: any[] = []): any[] {
  return slots.flatMap((s: any) => (s?.type === 'group' ? [s, ...flattenGroupChildren(s)] : [s]))
}
