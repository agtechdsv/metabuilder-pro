'use client'

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'
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

const findById = (id: string): HTMLElement | null =>
  (Array.from(document.querySelectorAll(`[data-help-id="${esc(id)}"]`)) as HTMLElement[]).find(isVisible) || null

type Rule = NonNullable<import('@/lib/platformHelp/types').PlatformStep['completeWhen']>

/** A condição do passo vale agora? Lida direto da tela (o app é quem sabe se o campo foi preenchido ou o botão está pronto). */
function evalRule(rule: Rule): boolean {
  const el = (Array.from(document.querySelectorAll(`[data-help-id="${esc(rule.id)}"]`)) as HTMLElement[])[0]
  if (!el) return false
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
  const [missing, setMissing] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [nonce, setNonce] = useState(0)
  const [ready, setReady] = useState(true)
  const recoveredRef = useRef<Set<string>>(new Set())
  useEffect(() => setMounted(true), [])

  const step = active ? active.tour.steps[active.index] : null
  const total = active ? active.tour.steps.length : 0
  const isLast = !!active && active.index === total - 1
  const key = active ? `${active.tour.id}:${active.index}` : ''
  const activeRef = useRef(active)
  activeRef.current = active

  // ao entrar no passo: navega (se for o caso), espera o alvo aparecer e rola até ele
  useEffect(() => {
    setRect(null)
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
      let deadline = Date.now() + 4000
      for (;;) {
        if (cancelled) return
        const el = findById(s.target)
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' })
          setRect(el.getBoundingClientRect())
          // passo que espera texto digitado: já deixa o cursor no campo, para a pessoa ver que é ali
          if (s.completeWhen?.check === 'filled') {
            const input = findById(s.completeWhen.id)
            if (input && typeof input.focus === 'function') input.focus({ preventScroll: true })
          }
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
    const id = setInterval(() => { if (window.location.pathname !== activeRef.current?.path) stopPlatformTour() }, 300)
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
      const until = Date.now() + 1500
      while (Date.now() < until) {
        if (findById(nextTarget)) { nextStep(); return }
        await sleep(100)
      }
      busy = false
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [key, hasRect, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // teclado
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); stopPlatformTour() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); finishOrNext() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prevStep() }
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
    if (a.index >= a.tour.steps.length - 1) { markTourSeen(a.tour.id); stopPlatformTour() } else nextStep()
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
  let top = Math.round(vh / 2 - 90)
  if (rect) {
    left = Math.max(12, Math.min(vw - POPOVER_W - 12, rect.left))
    const below = rect.bottom + PAD + 12
    top = vh - rect.bottom > 230 ? below : Math.max(12, rect.top - PAD - 12 - 190)
    // alvo muito alto (ocupa a tela): o balão fica sobre ele, no canto de baixo
    if (rect.height > vh * 0.7) top = Math.max(12, vh - 230)
  }

  const title = resolveHelp(step.title, language)
  const body = resolveHelp(step.body, language)

  return createPortal(
    <div className="fixed inset-0 z-[1000020]" style={{ pointerEvents: 'none' }}>
      {rect ? (
        <>
          <div
            className="fixed rounded-xl border-2 border-indigo-400 transition-all duration-300"
            style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: '0 0 0 9999px rgba(15,23,42,0.55)', pointerEvents: 'none' }}
          />
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
        role="dialog"
        aria-label={title || resolveHelp(active.tour.title, language)}
        className="fixed rounded-2xl border border-neutral-200 bg-white p-4 text-neutral-800 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        style={{ top, left, width: POPOVER_W, pointerEvents: 'auto' }}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">{resolveHelp(active.tour.title, language)}</span>
          <button type="button" onClick={stopPlatformTour} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white" aria-label={t('platform_help.close', 'Fechar')}><X className="h-4 w-4" /></button>
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
            <button type="button" disabled={active.index === 0} onClick={prevStep} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-neutral-500 hover:text-neutral-900 disabled:opacity-30 dark:hover:text-white">
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
