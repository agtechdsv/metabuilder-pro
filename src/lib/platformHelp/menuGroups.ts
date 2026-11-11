/**
 * Ordem e separadores do menu de tours. Só o Studio tem grupos; as outras telas mostram a lista direta, na ordem do catálogo.
 * Um tour fora de qualquer grupo vai para o fim, sem separador (assim um tour novo nunca some do menu).
 */

import type { HelpText } from '../helpText'
import type { PlatformTour } from './types'

export interface MenuSection { title?: HelpText; tours: PlatformTour[] }

const h = (pt: string, en: string, es: string): HelpText => ({ pt, en, es })

const STUDIO_SECTIONS: { title: HelpText; ids: string[] }[] = [
  { title: h('Studio', 'Studio', 'Studio'), ids: ['studio-barra-lateral', 'studio-visao-geral'] },
  {
    title: h('Casos de Uso', 'Use Cases', 'Casos de Uso'),
    ids: [
      'studio-criar-caso-de-uso', 'studio-logica-kanban', 'studio-logica-scheduler', 'studio-logica-timeline', 'studio-logica-gantt',
      'studio-logica-blueprint', 'studio-logica-mapa-mental', 'studio-logica-map', 'studio-logica-analytics', 'studio-logica-galeria',
      'studio-logica-personalizado', 'studio-excluir-caso-de-uso',
    ],
  },
  { title: h('Navegação', 'Navigation', 'Navegación'), ids: ['studio-navegacao'] },
  { title: h('Enums', 'Enums', 'Enums'), ids: ['studio-enums'] },
  { title: h('Gerenciador do Túnel', 'Tunnel Manager', 'Gestor del Túnel'), ids: ['studio-tunel'] },
  { title: h('Bancos Sincronizados', 'Synced Databases', 'Bases Sincronizadas'), ids: ['studio-bancos-sincronizados'] },
  { title: h('Central de Ajuda', 'Help Center', 'Centro de Ayuda'), ids: ['studio-central-ajuda'] },
]

/** Divide os tours da tela em seções com título; sem nenhum tour agrupado, devolve uma seção só, sem título. */
export function menuSections(tours: readonly PlatformTour[]): MenuSection[] {
  const byId = new Map(tours.map(t => [t.id, t]))
  const used = new Set<string>()
  const sections: MenuSection[] = []
  for (const g of STUDIO_SECTIONS) {
    const list = g.ids.map(id => byId.get(id)).filter((t): t is PlatformTour => !!t)
    if (!list.length) continue
    list.forEach(t => used.add(t.id))
    sections.push({ title: g.title, tours: list })
  }
  if (!sections.length) return [{ tours: [...tours] }]
  const rest = tours.filter(t => !used.has(t.id))
  if (rest.length) sections.push({ tours: rest })
  return sections
}
