/**
 * Legenda AO VIVO da Ajuda Interativa: em vez de uma cópia da ajuda do campo (que envelhece quando o dev a edita), o passo usa a
 * ajuda ATUAL do campo, lida da própria tela na hora de reproduzir. A ajuda oculta (help_hidden) não entra.
 */

import { normalizeHelp, visibleHelp, type HelpText } from '../helpText'
import type { Tour } from './types'

export type LiveHelp = Record<string, HelpText>

export const liveHelpKey = (zone: 'form' | 'filter', fieldId: string) => `${zone}:${fieldId}`

/** A ajuda atual dos campos do formulário e do filtro, como a tela os recebe (`field.config.<zona>_config.label.help`). */
export function buildLiveHelp(formFields: any[] | undefined, filterFields: any[] | undefined): LiveHelp {
  const out: LiveHelp = {}
  const add = (zone: 'form' | 'filter', fields: any[] | undefined) => {
    for (const f of Array.isArray(fields) ? fields : []) {
      if (!f || typeof f.id !== 'string') continue
      const zoneConfig = f.config?.[`${zone}_config`] || f.config
      const help = normalizeHelp(visibleHelp(zoneConfig?.label))
      if (Object.keys(help).length) out[liveHelpKey(zone, f.id)] = help
    }
  }
  add('form', formFields)
  add('filter', filterFields)
  return out
}

/** Troca a legenda dos passos "ao vivo" pela ajuda atual do campo; sem ajuda, fica a frase de reserva. Não altera os originais. */
export function applyLiveHelp(tours: Tour[], live: LiveHelp | undefined): Tour[] {
  if (!live || Object.keys(live).length === 0) return tours
  return tours.map(tour => ({
    ...tour,
    steps: tour.steps.map(s => {
      if (!s.liveCaption || !s.target || (s.target.type !== 'field' && s.target.type !== 'filter')) return s
      const help = live[liveHelpKey(s.target.type === 'filter' ? 'filter' : 'form', s.target.ref)]
      return help ? { ...s, caption: help } : s
    }),
  }))
}
