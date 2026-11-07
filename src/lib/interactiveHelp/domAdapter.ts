/**
 * Adaptador de DOM do player da Ajuda Interativa: acha os elementos marcados (`data-tour*`) dentro do documento da demonstração
 * (o iframe) e desenha por cima o cursor, o destaque e o balão com a legenda. Só roda no navegador.
 *
 * Os elementos são achados pelo atributo `data-tour` (botões e ações da linha), `data-tour-field` (campo do formulário, pelo id do campo)
 * e `data-tour-filter` (campo do filtro). Campos de componentes especiais não têm atributo e o passo é pulado.
 */

import type { PlayerAdapter } from './player'
import type { TourStep, TourTarget } from './types'

const BANNER: Record<string, string> = {
  pt: 'MODO DEMONSTRAÇÃO — nada é gravado',
  en: 'DEMO MODE — nothing is saved',
  es: 'MODO DEMOSTRACIÓN — no se guarda nada',
}

const esc = (s: string) => s.replace(/["\\]/g, '\\$&')

function isVisible(el: Element, strictX = true): boolean {
  const h = el as HTMLElement
  if (h.getClientRects().length === 0 || h.getAttribute('aria-hidden') === 'true') return false
  if (!strictX) return true
  // a gaveta lateral fecha empurrando o conteúdo (com a cópia do formulário) para fora da tela: não conta como visível
  const r = h.getBoundingClientRect()
  const w = h.ownerDocument.defaultView?.innerWidth || 0
  return !(w > 0 && (r.left >= w || r.right <= 0))
}

/** Acha o elemento do alvo no documento; `null` se ainda não existe ou não está visível. */
export function queryTarget(doc: Document, target: TourTarget | undefined, from?: HTMLElement | null): HTMLElement | null {
  if (!target) return null
  const all = (selector: string, root: ParentNode = doc) => (Array.from(root.querySelectorAll(selector)) as HTMLElement[]).filter(e => isVisible(e))
  // com uma janela (modal) aberta, o alvo é o que está nela; se não houver lá, cai para a página
  const first = (selector: string, root: ParentNode = doc, pred?: (e: HTMLElement) => boolean) => {
    const ok = (e: HTMLElement) => !pred || pred(e)
    if (root === doc) {
      const modals = all('[data-tour-modal]')
      const top = modals[modals.length - 1]
      const inside = top && all(selector, top).find(ok)
      if (inside) return inside
    }
    return all(selector, root).find(ok) || null
  }
  switch (target.type) {
    // roteiros gerados antes dos botões por modelo guardavam o + como botão genérico
    // marcadores do mapa (Leaflet): o marcador único é uma imagem; o agrupamento é uma div
    case 'button': if (target.ref === 'map-marker') return first('img.leaflet-marker-icon'); if (target.ref === 'map-cluster') return first('div.leaflet-marker-icon'); return target.ref === ('detail-add' as string) ? first('[data-tour-add]') : first(`[data-tour="${esc(target.ref)}"]`)
    case 'field': return first(`[data-tour-field="${esc(target.ref)}"]`)
    case 'filter': return first(`[data-tour-filter="${esc(target.ref)}"]`)
    case 'text': {
      const norm = (s: string | null | undefined) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
      const want = norm(target.ref)
      return first('button, a, [role="button"], [role="tab"], [role="menuitem"], summary', doc, e => norm(e.innerText || e.textContent) === want || norm(e.getAttribute('title')) === want || norm(e.getAttribute('aria-label')) === want)
    }
    case 'kanban-column': {
      const cols = (Array.from(doc.querySelectorAll('[data-tour-column]')) as HTMLElement[]).filter(c => isVisible(c, false))
      const own = from?.closest('[data-tour-column]') as HTMLElement | null
      const i = own ? cols.indexOf(own) : -1
      return cols[i + 1] || cols[i - 1] || null
    }
    case 'detail-expand': return first(`[data-tour-expand="${esc(target.ref)}"]`)
    case 'detail-add': return first(`[data-tour-add="${esc(target.ref)}"]`)
    case 'tab': return first(`[data-tour-detail="${esc(target.ref)}"]`)
    case 'row': {
      // primeira linha com dados (a linha de "nenhum registro" tem uma célula só)
      const row = (Array.from(doc.querySelectorAll('tbody tr')) as HTMLElement[]).find(r => isVisible(r) && r.querySelectorAll('td').length > 1)
      if (!row) return null
      return target.action ? first(`[data-tour="row-${target.action}"]`, row) : row
    }
    default: return null
  }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  // o React acompanha o valor pelo setter nativo: atribuir `el.value` direto não dispara o onChange dele
  const proto = Object.getPrototypeOf(el)
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) setter.call(el, value)
  else el.value = value
}

export interface DomAdapter extends PlayerAdapter {
  dispose(): void
}

export function createDomAdapter(doc: Document, language = 'pt'): DomAdapter {
  const win = doc.defaultView as unknown as Window & typeof globalThis
  const lang = BANNER[language] ? language : 'pt'

  const style = doc.createElement('style')
  style.textContent = '[data-tour-active].opacity-0, [data-tour-active] .opacity-0, .opacity-0:has([data-tour-active]) { opacity: 1 !important; visibility: visible !important; }'
  doc.head.appendChild(style)

  const root = doc.createElement('div')
  root.id = 'mb-tour-root'
  // cobre a tela e bloqueia cliques reais: quem opera é o player (os eventos dele vão direto aos elementos)
  Object.assign(root.style, { position: 'fixed', inset: '0', zIndex: '2147483000', pointerEvents: 'auto', cursor: 'default', background: 'transparent' } as Partial<CSSStyleDeclaration>)

  const spotlight = doc.createElement('div')
  Object.assign(spotlight.style, {
    position: 'fixed', pointerEvents: 'none', borderRadius: '12px', border: '2px solid #6366f1', opacity: '0',
    boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.45)', transition: 'all 0.5s ease',
  } as Partial<CSSStyleDeclaration>)

  const cursor = doc.createElement('div')
  cursor.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 8-6.5 1.8L9.7 19 5 3z" fill="#fff" stroke="#4f46e5" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  Object.assign(cursor.style, { position: 'fixed', left: '0', top: '0', pointerEvents: 'none', opacity: '0', transition: 'transform 0.65s cubic-bezier(.22,.8,.3,1), opacity 0.3s', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))' } as Partial<CSSStyleDeclaration>)

  const bubble = doc.createElement('div')
  Object.assign(bubble.style, {
    position: 'fixed', pointerEvents: 'none', maxWidth: '300px', padding: '10px 14px', borderRadius: '14px', background: '#ffffff', color: '#1f2937',
    font: '600 13px/1.4 system-ui, sans-serif', boxShadow: '0 10px 30px rgba(0,0,0,.25)', opacity: '0', transition: 'opacity 0.3s, top 0.5s ease, left 0.5s ease',
  } as Partial<CSSStyleDeclaration>)

  const banner = doc.createElement('div')
  banner.textContent = BANNER[lang]
  Object.assign(banner.style, {
    position: 'fixed', top: '8px', left: '50%', transform: 'translateX(-50%)', padding: '4px 14px', borderRadius: '999px', background: '#f59e0b', color: '#fff',
    font: '800 11px system-ui, sans-serif', letterSpacing: '0.08em', pointerEvents: 'none',
  } as Partial<CSSStyleDeclaration>)

  root.append(spotlight, cursor, bubble, banner)
  doc.body.appendChild(root)

  let current: HTMLElement | null = null
  let raf = 0

  const place = () => {
    const vw = win.innerWidth, vh = win.innerHeight
    if (current && current.isConnected) {
      const r = current.getBoundingClientRect()
      Object.assign(spotlight.style, { left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px`, opacity: '1' })
      cursor.style.opacity = '1'
      cursor.style.transform = `translate(${r.left + Math.min(r.width * 0.6, r.width - 8)}px, ${r.top + r.height * 0.55}px)`
      const bw = bubble.offsetWidth || 280, bh = bubble.offsetHeight || 60
      const below = r.bottom + 14 + bh < vh
      const top = below ? r.bottom + 14 : Math.max(8, r.top - bh - 14)
      const left = Math.max(8, Math.min(r.left, vw - bw - 8))
      Object.assign(bubble.style, { top: `${top}px`, left: `${left}px` })
    } else {
      spotlight.style.opacity = '0'
      cursor.style.opacity = '0'
      Object.assign(bubble.style, { top: `${Math.round(vh * 0.4)}px`, left: `${Math.max(8, Math.round(vw / 2 - 150))}px` })
    }
    raf = win.requestAnimationFrame(place)
  }
  raf = win.requestAnimationFrame(place)

  return {
    async find(step: TourStep, timeoutMs: number) {
      const started = Date.now()
      for (;;) {
        const el = queryTarget(doc, step.target)
        // botão desabilitado (ex.: ainda salvando): espera habilitar
        if (el && !(el as HTMLButtonElement).disabled) return el
        if (Date.now() - started > timeoutMs) return null
        await sleep(100)
      }
    },

    showStep(el, caption) {
      // ícones que só aparecem ao passar o mouse (lápis e lixeira dos cartões, + do dia) ficam visíveis enquanto são o alvo
      current?.removeAttribute?.('data-tour-active')
      current = (el as HTMLElement) || null
      current?.setAttribute?.('data-tour-active', '')
      current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
      bubble.textContent = caption
      bubble.style.opacity = caption ? '1' : '0'
    },

    click(el) {
      const h = el as HTMLElement
      h.focus?.()
      h.click()
    },

    setText(el, text) {
      const input = el as HTMLInputElement | HTMLTextAreaElement
      input.focus?.()
      // data e hora aceitam só valor completo: parcial deixaria o campo inválido
      if (input instanceof win.HTMLInputElement && ['date', 'datetime-local', 'time', 'month', 'week'].includes(input.type)) {
        setNativeValue(input, text.length >= 5 ? text : '')
      } else {
        setNativeValue(input, text)
      }
      input.dispatchEvent(new win.Event('input', { bubbles: true }))
    },

    async selectFirst(el) {
      const select = el as HTMLSelectElement
      const started = Date.now()
      // as opções de listas relacionais chegam depois da tela
      for (;;) {
        const opt = Array.from(select.options).find(o => o.value !== '')
        if (opt) {
          setNativeValue(select, opt.value)
          select.dispatchEvent(new win.Event('change', { bubbles: true }))
          return true
        }
        if (Date.now() - started > 3000) return false
        await sleep(100)
      }
    },

    async selectValue(el, value) {
      const select = el as HTMLSelectElement
      const started = Date.now()
      const norm = (s: string) => s.trim().toLowerCase()
      // as opções de listas relacionais chegam depois da tela
      for (;;) {
        const opt = Array.from(select.options).find(o => o.value === value || norm(o.text) === norm(value))
        if (opt) {
          setNativeValue(select, opt.value)
          select.dispatchEvent(new win.Event('change', { bubbles: true }))
          return true
        }
        if (Date.now() - started > 3000) return false
        await sleep(100)
      }
    },

    isAutocomplete(el) {
      return (el as HTMLElement).hasAttribute?.('data-tour-autocomplete') === true
    },

    async pickSuggestion(el) {
      const box = (el as HTMLElement).closest('[data-tour-ac]')
      const started = Date.now()
      // a busca é dinâmica (espera de digitação + consulta ao banco): aguarda a lista aparecer
      for (;;) {
        const opt = box && (Array.from(box.querySelectorAll('[data-tour-option]')) as HTMLElement[]).find(e => isVisible(e))
        if (opt) {
          opt.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
          return true
        }
        if (Date.now() - started > 6000) return false
        await sleep(150)
      }
    },

    async drag(el, step) {
      const card = el as HTMLElement
      const to = queryTarget(doc, step.to, card)
      if (!to) return false
      const PE = ((win as unknown as { PointerEvent?: typeof PointerEvent }).PointerEvent || win.MouseEvent) as typeof PointerEvent
      const a = card.getBoundingClientRect()
      const b = to.getBoundingClientRect()
      const sx = a.left + a.width / 2, sy = a.top + Math.min(a.height / 2, 40)
      const ex = b.left + b.width / 2, ey = b.top + Math.min(b.height / 2, 160)
      const fire = (type: string, x: number, y: number, target: EventTarget) =>
        target.dispatchEvent(new PE(type, { bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y } as PointerEventInit))
      card.scrollIntoView?.({ block: 'center' })
      fire('pointerdown', sx, sy, card)
      await sleep(120)
      const N = 24
      for (let i = 1; i <= N; i++) {
        fire('pointermove', sx + ((ex - sx) * i) / N, sy + ((ey - sy) * i) / N, doc)
        await sleep(30)
      }
      await sleep(150)
      fire('pointerup', ex, ey, doc)
      return true
    },

    check(el) {
      const box = el as HTMLInputElement
      if (!box.checked) box.click()
    },

    clear() {
      current = null
      bubble.style.opacity = '0'
      spotlight.style.opacity = '0'
      cursor.style.opacity = '0'
    },

    dispose() {
      style.remove()
      win.cancelAnimationFrame(raf)
      root.remove()
    },
  }
}
