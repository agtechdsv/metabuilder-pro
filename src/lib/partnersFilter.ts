import type { PartnerRow } from './partners'

/** Filtros da lista de parceiros do SuperAdmin (quem entra no lote de pagamento, quem tem saldo, quem precisa de atenção). */
export type PartnerFilter = 'all' | 'to_pay' | 'balance' | 'waiting' | 'no_pix' | 'pending_pix' | 'suspended'

export const PARTNER_FILTERS: PartnerFilter[] = ['all', 'to_pay', 'balance', 'waiting', 'no_pix', 'pending_pix', 'suspended']

/** Motivo de o parceiro ficar de fora do lote (mesma regra da tela e do SQL); null = entra no lote. */
export function payoutSkipReason(p: Pick<PartnerRow, 'status' | 'pixKey' | 'summary'>, minPayout: number): 'suspended' | 'no_pix' | 'below_min' | null {
  if (p.status !== 'active') return 'suspended'
  if (!p.pixKey) return 'no_pix'
  if (p.summary.payable < minPayout) return 'below_min'
  return null
}

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function filterPartners(partners: PartnerRow[], filter: PartnerFilter, query: string, minPayout: number): PartnerRow[] {
  const q = norm(query.trim())
  return partners.filter(p => {
    if (q && !norm(`${p.name} ${p.userEmail} ${p.code}`).includes(q)) return false
    switch (filter) {
      case 'to_pay': return payoutSkipReason(p, minPayout) === null
      case 'balance': return p.summary.payable > 0
      case 'waiting': return p.summary.waiting > 0
      case 'no_pix': return !p.pixKey
      case 'pending_pix': return !!p.pendingPix
      case 'suspended': return p.status === 'suspended'
      default: return true
    }
  })
}

/** Marca (ou desmarca) todos os visíveis, sem mexer nos selecionados que estão fora do filtro. */
export function toggleAllVisible(selected: Set<string>, visibleIds: string[]): Set<string> {
  const next = new Set(selected)
  const allOn = visibleIds.length > 0 && visibleIds.every(id => next.has(id))
  for (const id of visibleIds) { if (allOn) next.delete(id); else next.add(id) }
  return next
}
