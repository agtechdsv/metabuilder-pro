/**
 * Gravador de roteiros da Ajuda Interativa.
 *
 * O dev usa a tela de verdade (em modo demonstração, nada é gravado) e o gravador converte o que ele faz em passos do roteiro:
 * clique em botão, digitar num campo, escolher numa lista, marcar, buscar e escolher num autocomplete.
 *
 * A parte de "o que esse elemento é?" e "o que esse evento vira?" é pura (testável sem navegador); só `attachRecorder` mexe no DOM.
 * O mapeamento é o inverso do `queryTarget` do adaptador: um elemento marcado (`data-tour*`) vira o mesmo alvo que o player sabe achar.
 * O que não tem marca vira um alvo por TEXTO visível (botão, link, aba), que o player também sabe achar.
 */

import type { HelpText } from '../helpText'
import type { TourButtonRef, TourRowAction, TourStep, TourTarget } from './types'

/** O mínimo de um elemento que o mapeamento precisa (um Element do navegador serve; nos testes, um objeto simples). */
export interface RecNode {
  tagName?: string
  getAttribute(name: string): string | null
  parentElement: RecNode | null
  textContent?: string | null
}

const BUTTON_REFS: ReadonlySet<string> = new Set<TourButtonRef>([
  'new', 'save', 'back', 'search', 'clear', 'confirm', 'cancel',
  'kanban-add', 'kanban-edit', 'kanban-delete', 'kanban-card', 'scheduler-add', 'scheduler-event', 'scheduler-delete',
  'widget', 'widget-expand', 'widget-collapse', 'item-view', 'item-edit', 'item-delete', 'map-marker', 'map-cluster',
])
const ROW_ACTIONS: ReadonlySet<string> = new Set<TourRowAction>(['view', 'edit', 'delete'])
const CLICKABLE_TAGS = new Set(['BUTTON', 'A', 'SUMMARY'])
const CLICKABLE_ROLES = new Set(['button', 'tab', 'menuitem'])
const FORM_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'LABEL', 'OPTION'])

const clean = (s: string | null | undefined, max = 60) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

export interface DescribedTarget { target: TourTarget; label: string }

/** Que alvo do roteiro é este elemento (ou o ancestral marcado mais próximo)? `null` = nada que o player saiba achar. */
export function targetFromNode(start: RecNode | null): DescribedTarget | null {
  const labelOf = (n: RecNode) => clean(n.getAttribute('title') || n.getAttribute('aria-label') || n.textContent)
  for (let n: RecNode | null = start; n; n = n.parentElement) {
    const field = n.getAttribute('data-tour-field')
    if (field) return { target: { type: 'field', ref: field }, label: labelOf(n) }
    const filter = n.getAttribute('data-tour-filter')
    if (filter) return { target: { type: 'filter', ref: filter }, label: labelOf(n) }
    const tab = n.getAttribute('data-tour-detail')
    if (tab) return { target: { type: 'tab', ref: tab }, label: labelOf(n) }
    const add = n.getAttribute('data-tour-add')
    if (add) return { target: { type: 'detail-add', ref: add }, label: labelOf(n) }
    const expand = n.getAttribute('data-tour-expand')
    if (expand) return { target: { type: 'detail-expand', ref: expand }, label: labelOf(n) }
    const tour = n.getAttribute('data-tour')
    if (tour) {
      if (tour.startsWith('row-') && ROW_ACTIONS.has(tour.slice(4))) return { target: { type: 'row', ref: 'first', action: tour.slice(4) as TourRowAction }, label: labelOf(n) }
      if (BUTTON_REFS.has(tour)) return { target: { type: 'button', ref: tour as TourButtonRef }, label: labelOf(n) }
    }
  }
  // sem marca: o botão, link ou aba mais próximo, achado depois pelo texto visível
  for (let n: RecNode | null = start; n; n = n.parentElement) {
    const tag = String(n.tagName || '').toUpperCase()
    const role = n.getAttribute('role')
    if (CLICKABLE_TAGS.has(tag) || (role && CLICKABLE_ROLES.has(role))) {
      const text = labelOf(n)
      return text ? { target: { type: 'text', ref: text }, label: text } : null
    }
  }
  return null
}

/** O elemento é um controle de formulário (clicar nele só dá foco: não vira passo de clique)? */
export const isFormControl = (node: RecNode | null): boolean => !!node && FORM_TAGS.has(String(node.tagName || '').toUpperCase())

// ---- eventos normalizados e a máquina de estados ----

export type RecEvent =
  | { kind: 'click'; node: RecNode }
  /** digitando num campo de texto (ou busca): `label` é o rótulo visível do campo */
  | { kind: 'input'; node: RecNode; value: string; label?: string; autocomplete?: boolean }
  /** o campo perdeu o foco com um valor (texto, data) */
  | { kind: 'commit'; node: RecNode; value: string; label?: string; autocomplete?: boolean }
  | { kind: 'select'; node: RecNode; optionText: string; label?: string }
  | { kind: 'check'; node: RecNode; checked: boolean; label?: string }
  /** escolheu uma sugestão do autocomplete: `node` é o campo de busca, `term` o que estava digitado */
  | { kind: 'option'; node: RecNode; term: string; label?: string }

interface Pending { target: TourTarget; label: string; value: string; autocomplete: boolean }
export interface RecState { pending?: Pending }

const cap = (pt: string, en: string, es: string): HelpText => ({ pt, en, es })
let seq = 0
const newId = () => `rec-${++seq}-${Math.random().toString(36).slice(2, 6)}`

const sameTarget = (a: TourTarget, b: TourTarget) => a.type === b.type && 'ref' in a && 'ref' in b && a.ref === b.ref

const clickCaption = (label: string): HelpText =>
  label ? cap(`Clique em "${label}".`, `Click "${label}".`, `Haga clic en "${label}".`) : cap('Clique aqui.', 'Click here.', 'Haga clic aquí.')

function flush(state: RecState): { state: RecState; steps: TourStep[] } {
  const p = state.pending
  if (!p) return { state, steps: [] }
  const out: RecState = {}
  // autocomplete: o termo só vira passo quando a sugestão é escolhida; sem valor, não há o que ensinar
  if (p.autocomplete || p.value === '') return { state: out, steps: [] }
  const label = p.label || 'campo'
  return {
    state: out,
    steps: [{ id: newId(), kind: 'type', target: p.target, value: p.value, caption: cap(`Preencha "${label}".`, `Fill in "${label}".`, `Complete "${label}".`), auto: false, liveCaption: true }],
  }
}

/** Aplica um evento: devolve o novo estado e os passos que ele fechou (pode ser nenhum). */
export function applyEvent(state: RecState, ev: RecEvent): { state: RecState; steps: TourStep[] } {
  if (ev.kind === 'input' || ev.kind === 'commit') {
    const d = targetFromNode(ev.node)
    if (!d || (d.target.type !== 'field' && d.target.type !== 'filter')) return { state, steps: [] }
    let steps: TourStep[] = []
    let next = state
    if (state.pending && !sameTarget(state.pending.target, d.target)) { const f = flush(state); steps = f.steps; next = f.state }
    next = { pending: { target: d.target, label: ev.label || d.label, value: ev.value, autocomplete: ev.autocomplete === true } }
    if (ev.kind === 'commit') { const f = flush(next); return { state: f.state, steps: [...steps, ...f.steps] } }
    return { state: next, steps }
  }

  const f = flush(state)
  const steps = [...f.steps]
  const base: RecState = f.state

  if (ev.kind === 'option') {
    const d = targetFromNode(ev.node)
    if (!d || (d.target.type !== 'field' && d.target.type !== 'filter')) return { state: base, steps }
    const label = ev.label || d.label || 'campo'
    const term = ev.term.trim()
    if (term) steps.push({ id: newId(), kind: 'select', target: d.target, value: term, caption: cap(`Busque e escolha "${label}".`, `Search and pick "${label}".`, `Busque y elija "${label}".`), auto: false, liveCaption: true })
    return { state: base, steps }
  }

  if (ev.kind === 'select') {
    const d = targetFromNode(ev.node)
    if (!d || (d.target.type !== 'field' && d.target.type !== 'filter') || !ev.optionText.trim()) return { state: base, steps }
    const label = ev.label || d.label || 'campo'
    steps.push({ id: newId(), kind: 'select', target: d.target, value: ev.optionText.trim(), caption: cap(`Escolha uma opção em "${label}".`, `Pick an option in "${label}".`, `Elija una opción en "${label}".`), auto: false, liveCaption: true })
    return { state: base, steps }
  }

  if (ev.kind === 'check') {
    const d = targetFromNode(ev.node)
    if (!d || (d.target.type !== 'field' && d.target.type !== 'filter') || !ev.checked) return { state: base, steps }
    const label = ev.label || d.label || 'campo'
    steps.push({ id: newId(), kind: 'check', target: d.target, caption: cap(`Marque "${label}".`, `Check "${label}".`, `Marque "${label}".`), auto: false, liveCaption: true })
    return { state: base, steps }
  }

  // clique: foco em controle de formulário e opção de sugestão não são passos
  if (isFormControl(ev.node)) return { state: base, steps }
  const d = targetFromNode(ev.node)
  if (!d || d.target.type === 'field' || d.target.type === 'filter') return { state: base, steps }
  steps.push({ id: newId(), kind: 'click', target: d.target, caption: clickCaption(d.label), auto: false })
  return { state: base, steps }
}

/** Fim da gravação: fecha o que ainda estava sendo digitado. */
export function finishRecording(state: RecState): TourStep[] {
  return flush(state).steps
}

// ---- DOM ----

/** Rótulo visível de um campo: o <label> do bloco, o placeholder ou o aria-label. */
function labelOfControl(el: Element): string {
  let p: Element | null = el.parentElement
  for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
    const l = p.querySelector('label')
    const t = clean(l?.textContent)
    if (t) return t
  }
  return clean(el.getAttribute('aria-label') || el.getAttribute('placeholder'))
}

export interface RecorderHandle { detach(): void; flush(): void }

/** Liga o gravador a um documento (o da demonstração, num iframe). `onStep` recebe cada passo fechado. */
export function attachRecorder(doc: Document, onStep: (step: TourStep) => void): RecorderHandle {
  let state: RecState = {}
  const feed = (ev: RecEvent) => {
    const r = applyEvent(state, ev)
    state = r.state
    r.steps.forEach(onStep)
  }
  const isAc = (el: Element) => el.hasAttribute('data-tour-autocomplete')

  const onClick = (e: Event) => {
    const el = e.target as Element | null
    if (!el || !el.closest || el.closest('[data-tour-option]')) return
    feed({ kind: 'click', node: el as unknown as RecNode })
  }
  const onMouseDown = (e: Event) => {
    const el = e.target as Element | null
    if (!el?.closest?.('[data-tour-option]')) return
    const input = el.closest('[data-tour-ac]')?.querySelector('input[data-tour-autocomplete]') as HTMLInputElement | null
    if (input) feed({ kind: 'option', node: input as unknown as RecNode, term: input.value, label: labelOfControl(input) })
  }
  const onInput = (e: Event) => {
    const el = e.target as HTMLInputElement | HTMLTextAreaElement | null
    if (!el || !('value' in el)) return
    const tag = el.tagName
    if (tag === 'SELECT' || (tag === 'INPUT' && ['checkbox', 'radio', 'file'].includes((el as HTMLInputElement).type))) return
    feed({ kind: 'input', node: el as unknown as RecNode, value: el.value, label: labelOfControl(el), autocomplete: isAc(el) })
  }
  const onChange = (e: Event) => {
    const el = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
    if (!el) return
    const label = labelOfControl(el)
    if (el.tagName === 'SELECT') {
      const sel = el as HTMLSelectElement
      feed({ kind: 'select', node: el as unknown as RecNode, optionText: sel.options[sel.selectedIndex]?.text || '', label })
    } else if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'checkbox') {
      feed({ kind: 'check', node: el as unknown as RecNode, checked: (el as HTMLInputElement).checked, label })
    } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if ((el as HTMLInputElement).type === 'file' || (el as HTMLInputElement).type === 'radio') return
      feed({ kind: 'commit', node: el as unknown as RecNode, value: (el as HTMLInputElement).value, label, autocomplete: isAc(el) })
    }
  }

  doc.addEventListener('click', onClick, true)
  doc.addEventListener('mousedown', onMouseDown, true)
  doc.addEventListener('input', onInput, true)
  doc.addEventListener('change', onChange, true)
  return {
    detach() {
      doc.removeEventListener('click', onClick, true)
      doc.removeEventListener('mousedown', onMouseDown, true)
      doc.removeEventListener('input', onInput, true)
      doc.removeEventListener('change', onChange, true)
    },
    flush() {
      finishRecording(state).forEach(onStep)
      state = {}
    },
  }
}
