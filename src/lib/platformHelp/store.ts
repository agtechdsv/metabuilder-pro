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

/** O assistente está editando um caso de uso salvo de OUTRA lógica que a deste tour? (então o tour de criação não pode rodar) */
export function tourWrongLogic(tour: PlatformTour): boolean {
  if (!tour.onlyLogic || typeof document === 'undefined') return false
  const mode = document.querySelector('[data-help-id="wizard.mode"]')
  return mode?.getAttribute('data-help-state') === 'edit' && mode.getAttribute('data-help-logic') !== tour.onlyLogic
}

export const WRONG_LOGIC_HINT = {
  pt: 'Este caso de uso é de outra lógica. Use um caso de uso novo, ou um desta mesma lógica.',
  en: 'This use case has a different logic. Use a new use case, or one of this same logic.',
  es: 'Este caso de uso es de otra lógica. Use un caso de uso nuevo, o uno de esta misma lógica.',
}

/** O tour pode começar nesta tela? (alguns só valem na lista do Studio, não dentro do assistente) */
export function tourAvailable(tour: PlatformTour): boolean {
  if (tourWrongLogic(tour)) return false
  if (!tour.needs || typeof document === 'undefined') return true
  const els = Array.from(document.querySelectorAll(`[data-help-id="${tour.needs}"]`)) as HTMLElement[]
  return els.some(el => el.getClientRects().length > 0)
}

export function startPlatformTour(tour: PlatformTour) {
  if (tour.steps.length === 0) return
  if (!tourAvailable(tour)) return
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
  const cleanup = active.tour.cleanupClick
  active = null
  if (cleanup?.length && typeof document !== 'undefined') {
    // fecha o que o tour deixou aberto (ex.: a janela de confirmação de exclusão), pelo botão seguro
    for (const id of cleanup) (document.querySelector(`[data-help-id="${id.replace(/["\\]/g, '\\$&')}"]`) as HTMLElement | null)?.click()
  }
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
