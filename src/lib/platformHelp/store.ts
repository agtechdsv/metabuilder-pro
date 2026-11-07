import type { ActiveTour, PlatformTour } from './types'

/** Estado mínimo do tour em andamento, fora do React (o botão do cabeçalho e o balão são componentes diferentes). */
let active: ActiveTour | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

export const subscribePlatformTour = (fn: () => void): (() => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const getActiveTour = (): ActiveTour | null => active

export function startPlatformTour(tour: PlatformTour) {
  if (tour.steps.length === 0) return
  active = { tour, index: 0, path: typeof window !== 'undefined' ? window.location.pathname : undefined }
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

export function stopPlatformTour() {
  if (!active) return
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
