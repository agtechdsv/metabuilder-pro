/**
 * Leitura do feedback da ajuda para o Studio: junta os votos por alvo (campo ou tela) e zona,
 * e aponta onde um texto próprio provavelmente ajudaria.
 */

import type { HelpFeedbackZone } from './helpFeedback'

export interface FeedbackSummaryRow {
  screen_id: string | null
  field_id: string | null
  zone: string | null
  up: number
  down: number
}

export interface FeedbackTarget {
  /** id do campo; null = ajuda da tela */
  fieldId: string | null
  zones: { zone: HelpFeedbackZone | null; up: number; down: number }[]
  totalDown: number
}

const ZONE_ORDER: (string | null)[] = ['filter', 'grid', 'form', 'screen', 'central', 'tutorial', null]

/**
 * Agrupa o resumo por alvo, com uma linha por zona. Só entram campos de `fieldIds` e a ajuda desta tela.
 * Alvos com mais 👎 primeiro.
 */
export function groupFeedback(rows: FeedbackSummaryRow[], fieldIds: string[], screenId?: string): FeedbackTarget[] {
  const byTarget = new Map<string, FeedbackTarget>()
  for (const r of rows) {
    const mine = r.field_id ? fieldIds.includes(r.field_id) : !!screenId && r.screen_id === screenId
    if (!mine) continue
    const key = r.field_id || '__screen__'
    let target = byTarget.get(key)
    if (!target) {
      target = { fieldId: r.field_id || null, zones: [], totalDown: 0 }
      byTarget.set(key, target)
    }
    const zone = (r.zone as HelpFeedbackZone | null) || null
    const existing = target.zones.find(z => z.zone === zone)
    if (existing) { existing.up += r.up; existing.down += r.down } else target.zones.push({ zone, up: r.up, down: r.down })
    target.totalDown += r.down
  }
  const out = [...byTarget.values()]
  for (const t of out) t.zones.sort((a, b) => ZONE_ORDER.indexOf(a.zone) - ZONE_ORDER.indexOf(b.zone))
  return out.sort((a, b) => b.totalDown - a.totalDown)
}

/**
 * Esta zona merece um texto próprio? Sim quando ela tem mais 👎 que 👍, o campo aparece em outra zona
 * e a zona ainda usa o texto padrão (se já tem texto próprio, o dev já agiu).
 */
export function suggestsOwnText(
  target: FeedbackTarget,
  zone: HelpFeedbackZone | null,
  opts: { custom: boolean; zoneCount: number },
): boolean {
  if (!target.fieldId || zone === null || zone === 'screen' || zone === 'central' || zone === 'tutorial') return false
  if (opts.custom || opts.zoneCount < 2) return false
  const z = target.zones.find(x => x.zone === zone)
  return !!z && z.down > z.up
}
