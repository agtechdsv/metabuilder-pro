import type { ActiveTour, PlatformTour } from './types'

/** Estado mínimo do tour em andamento, fora do React (o botão do cabeçalho e o balão são componentes diferentes). */
let active: ActiveTour | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

export const subscribePlatformTour = (fn: () => void): (() => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const getActiveTour = (): ActiveTour | null => active

/** Em que passo começar: o da primeira regra de `entry` que vale na tela agora (tela já adiantada), senão o primeiro. */
export function resolveStartIndex(tour: PlatformTour): number {
  if (typeof document === 'undefined' || !tour.entry?.length) return 0
  for (const e of tour.entry) {
    const els = Array.from(document.querySelectorAll(`[data-help-id="${e.rule.id.replace(/["\\]/g, '\\$&')}"]`)) as HTMLElement[]
    const ok = els.some(el => (e.rule.attr ? el.getAttribute(e.rule.attr) === (e.rule.equals ?? '') : true))
    const idx = tour.steps.findIndex(st => st.id === e.step)
    if (ok && idx >= 0) return idx
  }
  return 0
}

export function startPlatformTour(tour: PlatformTour) {
  if (tour.steps.length === 0) return
  const start = resolveStartIndex(tour)
  active = { tour, index: start, from: start, path: typeof window !== 'undefined' ? window.location.pathname : undefined }
  emit()
}

export function goToStep(index: number) {
  if (!active) return
  const clamped = Math.max(0, Math.min(active.tour.steps.length - 1, index))
  if (clamped === active.index) return
  active = { ...active, index: clamped }
  emit()
}

export const nextStep = () => { if (active) goToStep(active.index + 1) }
export const prevStep = () => { if (active) goToStep(active.index - 1) }

/** Encerra o tour. `reason` vai para o console (F12), para entender por que ele fechou se a pessoa não clicou em Fechar. */
export function stopPlatformTour(reason = 'fechado') {
  if (!active) return
  if (typeof console !== 'undefined') console.info(`[ajuda da plataforma] tour "${active.tour.id}" encerrado no passo ${active.index + 1}: ${reason}`)
  active = null
  emit()
}

// ---- tours já vistos (só neste navegador) ----
const SEEN_KEY = 'mb_platform_tours_seen'

function readSeen(): string[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SEEN_KEY) : null
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x: unknown): x is string => typeof x === 'string') : []
  } catch { return [] }
}

export const seenTours = (): string[] => readSeen()

export function markTourSeen(id: string) {
  try {
    const cur = readSeen()
    if (!cur.includes(id)) localStorage.setItem(SEEN_KEY, JSON.stringify([...cur, id]))
  } catch { /* sem armazenamento: só não lembra */ }
}
