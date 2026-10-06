/**
 * Períodos do BI (filtro do painel, período fixo e seletor próprio de cada widget).
 * Datas em YYYY-MM-DD; o fim é inclusivo (o SQL usa "< dia seguinte").
 */

export interface PeriodRange { from: string; to: string }

export const PERIOD_PRESETS: { id: string; label: string }[] = [
  { id: 'all', label: 'Tudo' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: '90d', label: '90 dias' },
  { id: 'month', label: 'Mês atual' },
  { id: 'prev_month', label: 'Mês anterior' },
  { id: '12m', label: '12 meses' },
  { id: 'year', label: 'Ano atual' },
  { id: 'prev_year', label: 'Ano anterior' },
]

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Intervalo de um período pré-definido (ou 'custom' com datas). 'all' ou dados incompletos → null (sem filtro). */
export function resolvePeriod(preset: string | undefined, custom?: { from?: string; to?: string }, today: Date = new Date()): PeriodRange | null {
  const y = today.getFullYear()
  const m = today.getMonth()
  const back = (days: number) => { const d = new Date(today); d.setDate(d.getDate() - days); return iso(d) }
  switch (preset) {
    case '7d': return { from: back(6), to: iso(today) }
    case '30d': return { from: back(29), to: iso(today) }
    case '90d': return { from: back(89), to: iso(today) }
    case 'month': return { from: iso(new Date(y, m, 1)), to: iso(today) }
    case 'prev_month': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) }
    case '12m': return { from: iso(new Date(y, m - 11, 1)), to: iso(today) }
    case 'year': return { from: `${y}-01-01`, to: iso(today) }
    case 'prev_year': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
    case 'custom': {
      const f = custom?.from ?? ''
      const t = custom?.to ?? ''
      return DATE_RE.test(f) && DATE_RE.test(t) && f <= t ? { from: f, to: t } : null
    }
    default: return null
  }
}

/** "2026-03-31" → "31/03/2026" */
export function formatPeriodDay(d: string): string {
  return d.split('-').reverse().join('/')
}

/**
 * Período de comparação ("vs período anterior"):
 *  - do dia 1 até um dia do mesmo mês → mesmo trecho do mês anterior (limitado ao tamanho dele);
 *  - 1º de janeiro até uma data do mesmo ano → mesmo trecho do ano anterior;
 *  - qualquer outro → o mesmo número de dias imediatamente antes.
 */
export function previousRange(r: PeriodRange): PeriodRange {
  const [fy, fm, fd] = r.from.split('-').map(Number)
  const [ty, tm, td] = r.to.split('-').map(Number)
  if (fd === 1 && fy === ty && fm === tm) {
    const pm = new Date(fy, fm - 2, 1)
    const last = new Date(pm.getFullYear(), pm.getMonth() + 1, 0).getDate()
    return { from: iso(pm), to: iso(new Date(pm.getFullYear(), pm.getMonth(), Math.min(td, last))) }
  }
  if (fm === 1 && fd === 1 && fy === ty) {
    const last = new Date(fy - 1, tm, 0).getDate()
    return { from: `${fy - 1}-01-01`, to: iso(new Date(fy - 1, tm - 1, Math.min(td, last))) }
  }
  const from = new Date(fy, fm - 1, fd)
  const to = new Date(ty, tm - 1, td)
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1
  const prevTo = new Date(from)
  prevTo.setDate(prevTo.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - (days - 1))
  return { from: iso(prevFrom), to: iso(prevTo) }
}

/** Dia seguinte (YYYY-MM-DD), em UTC para não depender do fuso. */
export function nextDay(d: string): string {
  const [y, m, dd] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10)
}
