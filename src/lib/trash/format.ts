import { describeDuration, splitRemaining } from './trash'

type T = (key: string, fallback?: string) => string
const P = 'dashboard.projects.studio.trash.'

/** "48 horas", "2 dias", "1 hora": o prazo da lixeira em palavras, no idioma da pessoa. */
export function formatDuration(hours: number, t: T): string {
  const { n, unit } = describeDuration(hours)
  const key = unit === 'day' ? (n === 1 ? 'u_day_one' : 'u_day_other') : (n === 1 ? 'u_hour_one' : 'u_hour_other')
  return `${n} ${t(P + key)}`
}

/** O que falta, curto: "1 d 12 h", "5 h 20 min", "12 min". Nunca mostra menos de 1 min. */
export function formatSpan(ms: number, t: T): string {
  const { days, hours, minutes } = splitRemaining(ms)
  const d = t(P + 'u_d'), h = t(P + 'u_h'), m = t(P + 'u_min')
  if (days > 0) return hours > 0 ? `${days} ${d} ${hours} ${h}` : `${days} ${d}`
  if (hours > 0) return minutes > 0 ? `${hours} ${h} ${minutes} ${m}` : `${hours} ${h}`
  return `${Math.max(1, minutes)} ${m}`
}
