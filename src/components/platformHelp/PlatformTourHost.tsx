'use client'

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { resolveHelp } from '@/lib/helpText'
import { useI18n } from '@/i18n/I18nContext'
import { getActiveTour, markTourSeen, nextStep, prevStep, stopPlatformTour, subscribePlatformTour } from '@/lib/platformHelp/store'

const POPOVER_W = 340
const PAD = 6

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const esc = (s: string) => s.replace(/["\\]/g, '\\$&')

function isVisible(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

const findById = (id: string): HTMLElement | null => {
  const all = (Array.from(document.querySelectorAll(`[data-help-id="${esc(id)}"]`)) as HTMLElement[]).filter(isVisible)
  // vários itens com a mesma marca (os detalhes do cadastro): prefere o que já está aberto
  return all.find(el => el.getAttribute('data-help-state') === 'open') || all[0] || null
}

type Rule = NonNullable<import('@/lib/platformHelp/types').PlatformStep['completeWhen']>

/** A condição do passo vale agora? Lida direto da tela (o app é quem sabe se o campo foi preenchido ou o botão está pronto). */
function evalRule(rule: Rule): boolean {
  const els = Array.from(document.querySelectorAll(`[data-help-id="${esc(rule.id)}"]`)) as HTMLElement[]
  const el = els[0]
  if (!el) return false
  // vários itens com a marca (os detalhes): basta um ter o valor esperado
  if (rule.check === 'attr') return !!rule.attr && els.some(e => e.getAttribute(rule.attr as string) === (rule.equals ?? ''))
  if (rule.check === 'filled') return String((el as HTMLInputElement).value ?? '').trim().length > 0
  if (rule.check === 'enabled') return !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true'
  return !!rule.attr && el.getAttribute(rule.attr) === (rule.equals ?? '')
}

const sameRect = (a: DOMRect | null, b: DOMRect) => !!a && Math.abs(a.top - b.top) < 1 && Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1

/**
 * Balão do tour guiado da plataforma: escurece a tela, destaca o elemento do passo e explica. Quem clica é a pessoa: o destaque não
 * bloqueia o elemento (dá para clicar nele), e alguns passos só avançam quando ela clica ali.
 */
export function PlatformTourHost() {
  const { t, language } = useI18n()
  const active = useSyncExternalStore(subscribePlatformTour, getActiveTour, () => null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [rect2, setRect2] = useState<DOMRect | null>(null)
  const [missing, setMissing] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [nonce, setNonce] = useState(0)
  const [ready, setReady] = useState(true)
  const popRef = useRef<HTMLDivElement>(null)
  const [popH, setPopH] = useState(200)
  const recoveredRef = useRef<Set<string>>(new Set())
  useEffect(() => setMounted(true), [])

  const step = active ? active.tour.steps[active.index] : null
  const total = active ? active.tour.steps.length : 0
  const isLast = !!active && active.index === total - 1
  const key = active ? `${active.tour.id}:${active.index}` : ''
  const activeRef = useRef(active)
  activeRef.current = active
  // de onde a pessoa chegou ao passo atual (para um passo pulado seguir na mesma direção)
  const lastIndexRef = useRef(-1)
  const cameFromAfterRef = useRef(false)
  if (active) {
    const prevIdx = lastIndexRef.current
    if (prevIdx !== active.index) { cameFromAfterRef.current = prevIdx > active.index; lastIndexRef.current = active.index }
  } else lastIndexRef.current = -1

  // ao entrar no passo: navega (se for o caso), espera o alvo aparecer e rola até ele
  useEffect(() => {
    setRect(null)
    setRect2(null)
    setMissing(false)
    const a = activeRef.current
    const s = a ? a.tour.steps[a.index] : null
    if (!s) return
    let cancelled = false
    ;(async () => {
      if (s.enterClick) {
        findById(s.enterClick)?.click()
        await sleep(300)
      }
      if (!s.target) return
      let deadline = Date.now() + (s.skipIfMissing ? 1200 : (s.findWaitMs ?? 4000))
      for (;;) {
        if (cancelled) return
        const el = findById(s.target)
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' })
          setRect(el.getBoundingClientRect())
          if (s.alsoTarget) { const el2 = findById(s.alsoTarget); if (el2) setRect2(el2.getBoundingClientRect()) }
          // passo que espera texto digitado: já deixa o cursor no campo, para a pessoa ver que é ali
          if (s.completeWhen?.check === 'filled') {
            const input = findById(s.completeWhen.id)
            if (input && typeof input.focus === 'function') input.focus({ preventScroll: true })
          }
          return
        }
        if (Date.now() > deadline && s.skipIfMissing) {
          // passo opcional sem alvo nesta tela: segue na direção em que a pessoa vinha (para trás, se ela clicou em Voltar)
          if (cameFromAfterRef.current) prevStep(); else nextStep()
          return
        }
        if (Date.now() > deadline) {
          // a pessoa saiu do ponto do tour (abriu o assistente, a IA, outra aba): tenta voltar sozinho uma vez por passo
          const recover = activeRef.current?.tour.recover
          if (recover?.length && !recoveredRef.current.has(key)) {
            recoveredRef.current.add(key)
            const back = recover.map(findById).find(Boolean)
            if (back) { back.click(); await sleep(600); deadline = Date.now() + 4000; continue }
          }
          setMissing(true)
          return
        }
        await sleep(150)
      }
    })()
    return () => { cancelled = true }
  }, [key, nonce])

  // condição para o passo ser cumprido (nome preenchido, lógica escolhida, botão habilitado...)
  useEffect(() => {
    const rule = step?.completeWhen
    if (!rule) { setReady(true); return }
    const check = () => setReady(evalRule(rule))
    check()
    const id = setInterval(check, 150)
    return () => clearInterval(id)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  // navegou para outra página: o tour não faz mais sentido
  useEffect(() => {
    if (!active?.path) return
    let strikes = 0
    const id = setInterval(() => {
      if (window.location.pathname === activeRef.current?.path) { strikes = 0; return }
      if (++strikes >= 2) stopPlatformTour(`a página mudou para ${window.location.pathname}`)
    }, 300)
    return () => clearInterval(id)
  }, [active?.tour.id, active?.path])

  // acompanha o alvo (rolagem, redimensionar, a tela se rearrumando)
  const hasRect = !!rect
  useEffect(() => {
    if (!step?.target || !hasRect) return
    const target = step.target
    const id = setInterval(() => {
      const el = findById(target)
      if (el) { const r = el.getBoundingClientRect(); setRect(prev => (sameRect(prev, r) ? prev : r)) }
      const also = activeRef.current?.tour.steps[activeRef.current.index]?.alsoTarget
      if (also) { const el2 = findById(also); if (el2) { const r2 = el2.getBoundingClientRect(); setRect2(prev => (sameRect(prev, r2) ? prev : r2)) } else setRect2(null) }
    }, 120)
    return () => clearInterval(id)
  }, [key, hasRect]) // eslint-disable-line react-hooks/exhaustive-deps

  // passo que só avança quando a pessoa clica no elemento destacado
  useEffect(() => {
    if (!step?.advanceOnClick || !step.target || !hasRect || !ready) return
    const el = findById(step.target)
    if (!el) return
    let busy = false
    const onClick = async () => {
      if (busy) return
      busy = true
      // o tour só acompanha a tela: avança quando o item do próximo passo aparece (se a tela recusou o clique, o tour fica)
      const a = activeRef.current
      const nextTarget = a ? a.tour.steps[a.index + 1]?.target : undefined
      if (!nextTarget) { nextStep(); return }
      const until = Date.now() + (a?.tour.steps[a.index]?.advanceWaitMs ?? 1500)
      while (Date.now() < until) {
        if (findById(nextTarget)) { nextStep(); return }
        await sleep(100)
      }
      busy = false
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [key, hasRect, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // trava de cliques: o buraco do destaque é um retângulo, e outros botões podem estar por cima dele (ex.: a barra flutuante "Próximo passo").
  // Enquanto o passo não é livre, só vale clique dentro do item do passo ou do balão do tour; o resto é descartado.
  useEffect(() => {
    if (!step || step.freeInteraction) return
    const target = step.target
    const guard = (e: Event) => {
      // cliques do próprio tour (enterClick e recuperação usam .click()) não são da pessoa: passam
      if (!e.isTrusted) return
      const node = e.target as Node | null
      if (!node || !(node instanceof Node)) return
      if (popRef.current?.contains(node)) return
      if (target) {
        const els = Array.from(document.querySelectorAll(`[data-help-id="${esc(target)}"]`)) as HTMLElement[]
        // com o passo bloqueado (esperando condição ou só leitura) nada fora do balão responde; com o passo liberado, só o próprio item
        const open = step.interactive || (step.advanceOnClick && ready)
        if (open && els.some(el => el.contains(node))) return
      }
      e.stopPropagation()
      e.preventDefault()
    }
    const evs = ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'dblclick']
    for (const n of evs) window.addEventListener(n, guard, true)
    return () => { for (const n of evs) window.removeEventListener(n, guard, true) }
  }, [key, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // teclado
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      // quem está digitando (ou usando um painel como o de propriedades do campo) não pode ter as setas e o Esc tomados pelo tour
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      if (e.defaultPrevented) return
      if (e.key === 'Escape') { e.preventDefault(); stopPlatformTour('tecla Esc') }
      else if (e.key === 'ArrowRight') { e.preventDefault(); finishOrNext() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goBack() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const finishOrNext = () => {
    const a = activeRef.current
    if (!a) return
    const cur = a.tour.steps[a.index]
    // passo de clique: só avança clicando no item; passo com condição: só depois que ela vale
    const isFinal = a.index >= a.tour.steps.length - 1
    if (!isFinal && (cur.advanceOnClick || (cur.completeWhen && !evalRule(cur.completeWhen)))) return
    if (a.index >= a.tour.steps.length - 1) { markTourSeen(a.tour.id); stopPlatformTour('concluído') } else nextStep()
  }

  useLayoutEffect(() => {
    const h = popRef.current?.offsetHeight
    if (h && Math.abs(h - popH) > 2) setPopH(h)
  })

  // Voltar: se o passo anterior fica em outra tela do assistente, o tour também volta o app (clica no botão indicado)
  const goBack = () => {
    const a = activeRef.current
    if (!a) return
    const cur = a.tour.steps[a.index]
    if (cur?.noBack) return
    if (cur?.backClick) findById(cur.backClick)?.click()
    prevStep()
  }

  const recoverNow = () => {
    const back = (activeRef.current?.tour.recover || []).map(findById).find(Boolean)
    if (back) back.click()
    setTimeout(() => { recoveredRef.current.delete(key); setNonce(n => n + 1) }, 600)
  }

  if (!mounted || !active || !step) return null

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  let left = Math.round(vw / 2 - POPOVER_W / 2)
  let top = Math.round(vh / 2 - popH / 2)
  if (rect) {
    // o balão nunca cobre o item destacado: abaixo dele, senão acima, senão ao lado (altura medida de verdade, não estimada)
    const gap = PAD + 12
    const clampX = (x: number) => Math.max(12, Math.min(vw - POPOVER_W - 12, x))
    const clampY = (y: number) => Math.max(12, Math.min(vh - popH - 12, y))
    left = clampX(rect.left)
    if (vh - rect.bottom >= popH + gap) top = rect.bottom + gap
    else if (rect.top >= popH + gap) top = rect.top - gap - popH
    else if (rect.left >= POPOVER_W + gap + 12) { left = rect.left - gap - POPOVER_W; top = clampY(rect.top) }
    else if (vw - rect.right >= POPOVER_W + gap + 12) { left = rect.right + gap; top = clampY(rect.top) }
    else top = clampY(vh - popH - 12) // alvo gigante: no canto de baixo, sobre ele
  }

  const title = resolveHelp(step.title, language)
  const body = resolveHelp(step.body, language)

  return createPortal(
    <div className="fixed inset-0 z-[1000020]" style={{ pointerEvents: 'none' }}>
      {rect ? (
        <>
          {rect2 ? (
            <>
              {/* dois itens destacados: o escurecimento vira uma máscara com dois buracos (o box-shadow só abre um) */}
              <svg className="fixed inset-0" width="100%" height="100%" style={{ pointerEvents: 'none' }}>
                <defs>
                  <mask id="mb-tour-mask">
                    <rect width="100%" height="100%" fill="white" />
                    {[rect, rect2].map((r, i) => <rect key={i} x={r.left - PAD} y={r.top - PAD} width={r.width + PAD * 2} height={r.height + PAD * 2} rx={12} fill="black" />)}
                  </mask>
                </defs>
                <rect width="100%" height="100%" fill="rgba(15,23,42,0.55)" mask="url(#mb-tour-mask)" />
              </svg>
              {[rect, rect2].map((r, i) => (
                <div key={i} className="fixed rounded-xl border-2 border-indigo-400" style={{ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2, pointerEvents: 'none' }} />
              ))}
            </>
          ) : (
            <div
              className="fixed rounded-xl border-2 border-indigo-400 transition-all duration-300"
              style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: '0 0 0 9999px rgba(15,23,42,0.55)', pointerEvents: 'none' }}
            />
          )}
          {/* a tela atrás do escurecimento não responde a cliques (senão a pessoa sai do tour sem querer); só o item destacado, e só nos passos que pedem o clique */}
          {step.freeInteraction ? null : (step.advanceOnClick && ready) || step.interactive ? (
            <>
              <div className="fixed left-0 right-0 top-0" style={{ height: Math.max(0, rect.top - PAD), pointerEvents: 'auto' }} />
              <div className="fixed bottom-0 left-0 right-0" style={{ top: rect.bottom + PAD, pointerEvents: 'auto' }} />
              <div className="fixed left-0" style={{ top: rect.top - PAD, height: rect.height + PAD * 2, width: Math.max(0, rect.left - PAD), pointerEvents: 'auto' }} />
              <div className="fixed right-0" style={{ top: rect.top - PAD, height: rect.height + PAD * 2, left: rect.right + PAD, pointerEvents: 'auto' }} />
            </>
          ) : (
            <div className="fixed inset-0" style={{ pointerEvents: 'auto' }} />
          )}
        </>
      ) : (
        <div className="fixed inset-0 bg-slate-900/55" style={{ pointerEvents: 'auto' }} />
      )}

      <div
        ref={popRef}
        role="dialog"
        aria-label={title || resolveHelp(active.tour.title, language)}
        className="fixed rounded-2xl border border-neutral-200 bg-white p-4 text-neutral-800 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        style={{ top, left, width: POPOVER_W, pointerEvents: 'auto' }}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">{resolveHelp(active.tour.title, language)}</span>
          <button type="button" onClick={() => stopPlatformTour('botão Fechar')} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white" aria-label={t('platform_help.close', 'Fechar')}><X className="h-4 w-4" /></button>
        </div>
        {title && <h3 className="text-sm font-black">{title}</h3>}
        <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">{body}</p>
        {missing && (
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] italic text-amber-600">{t('platform_help.target_missing', 'Este item não está visível agora. Continue o tour ou volte depois.')}</p>
            {!!active.tour.recover?.length && <button type="button" onClick={recoverNow} className="text-[11px] font-bold text-indigo-600 hover:underline">{t('platform_help.recover', 'Voltar ao ponto do tour')}</button>}
          </div>
        )}
        {!missing && (step.advanceOnClick || step.completeWhen) && (
          ready
            ? (step.advanceOnClick && <p className="mt-2 text-[11px] font-bold text-indigo-600">{t('platform_help.click_to_continue', 'Clique no item destacado para continuar.')}</p>)
            : <p className="mt-2 text-[11px] font-bold text-amber-600">{resolveHelp(step.waitingHint, language) || t('platform_help.complete_to_continue', 'Complete este passo para continuar.')}</p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] font-bold text-neutral-400">{t('platform_help.step_of', '{n} de {total}').replace('{n}', String(active.index + 1)).replace('{total}', String(total))}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={active.index === 0 || !!step.noBack} onClick={goBack} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-neutral-500 hover:text-neutral-900 disabled:opacity-30 dark:hover:text-white">
              <ArrowLeft className="h-3 w-3" />{t('platform_help.back', 'Voltar')}
            </button>
            <button type="button" onClick={finishOrNext} disabled={!isLast && (!!step.advanceOnClick || (!!step.completeWhen && !ready))} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40">
              {isLast ? <><Check className="h-3 w-3" />{t('platform_help.done', 'Concluir')}</> : <>{t('platform_help.next', 'Próximo')}<ArrowRight className="h-3 w-3" /></>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
