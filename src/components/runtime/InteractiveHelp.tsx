'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ListVideo, Loader2, Pause, Play, PlayCircle, Repeat, RotateCcw, SkipForward, X } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { resolveHelp } from '@/lib/helpText'
import { encodeDemoSeed, isDemoMode } from '@/lib/demo/demoMode'
import { createDomAdapter, type DomAdapter } from '@/lib/interactiveHelp/domAdapter'
import { buildQueue, shortTitle, toggleId } from '@/lib/interactiveHelp/order'
import { browserStorage, clearSeen, markSeen, readSeen, seenStorageKey, unseenTours } from '@/lib/interactiveHelp/seen'
import { estimateQueueMs, estimateTourMs, formatDuration, TourPlayer, TRANSITION_SECONDS, type PlayerSnapshot } from '@/lib/interactiveHelp/player'
import { hasInteractiveHelp, visibleTours, type Tour, type TourSpeed } from '@/lib/interactiveHelp/types'
import { cn } from '@/lib/utils'
import { ACTION_ICON, DoneCard, UpNextCard } from './InteractiveHelpCards'

interface Props {
  /** `layout_config.interactive_help` */
  config: unknown
  projectId?: string
  viewId?: string
  /** tabela/modelo e chave primária, para a linha sintética do modo demonstração */
  modelName?: string
  primaryKeyName?: string
  /** nome da tela, para o título do tour completo */
  screenName?: string
}

/** Ícone ▶ ao lado do "?" do cabeçalho. Só aparece com roteiro válido, e nunca dentro da própria demonstração. */
export function InteractiveHelpButton(props: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [inDemo, setInDemo] = useState(false)
  useEffect(() => { setInDemo(isDemoMode()) }, [])
  if (inDemo || !hasInteractiveHelp(props.config)) return null
  const label = t('runtime.tour.open', 'Ajuda interativa')
  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <PlayCircle className="w-4 h-4" />
      </button>
      {open && <InteractiveHelpModal {...props} onClose={() => setOpen(false)} />}
    </>
  )
}

const SPEEDS: TourSpeed[] = ['slow', 'normal', 'fast']

function InteractiveHelpModal({ config, projectId, viewId, modelName, primaryKeyName, screenName, onClose }: Props & { onClose: () => void }) {
  const { t, language } = useI18n()
  // na ordem que o dev definiu no Studio (roteiros ocultos já ficam de fora)
  const tours = useMemo(() => visibleTours(config), [config])
  const [selected, setSelected] = useState<string[]>([])
  const [speed, setSpeed] = useState<TourSpeed>('normal')
  const [stage, setStage] = useState<'choose' | 'play'>('choose')
  const [queue, setQueue] = useState<Tour[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [transition, setTransition] = useState<Tour | null>(null)
  const [held, setHeld] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [countTotal, setCountTotal] = useState(5)
  const [runId, setRunId] = useState(0)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [snap, setSnap] = useState<PlayerSnapshot | null>(null)

  // tutoriais já vistos (só neste navegador): ✓ nos cartões, progresso e "Continuar de onde parei"
  const storage = useMemo(() => browserStorage(), [])
  const seenKey = seenStorageKey(projectId, viewId)
  const [seen, setSeen] = useState<string[]>(() => readSeen(browserStorage(), seenStorageKey(projectId, viewId)))

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<TourPlayer | null>(null)
  const adapterRef = useRef<DomAdapter | null>(null)
  const speedRef = useRef(speed)
  speedRef.current = speed

  const tour: Tour | undefined = queue[qIndex]
  const isLastInQueue = qIndex >= queue.length - 1

  // terminou um tutorial: fica marcado como visto
  const tourId = tour?.id
  useEffect(() => {
    if (stage === 'play' && snap?.state === 'ended' && tourId) setSeen(prev => markSeen(storage, seenKey, tourId, prev))
  }, [stage, snap?.state, tourId, storage, seenKey])

  // a página da demonstração é a própria tela, aberta no modo demonstração, já com a linha sintética (se o roteiro precisar)
  const src = useMemo(() => {
    if (stage !== 'play' || !tour || typeof window === 'undefined') return ''
    const params = new URLSearchParams({ mb_demo: '1' })
    if (tour.seed && Object.keys(tour.seed).length && modelName) {
      params.set('mb_seed', encodeDemoSeed({ table: modelName, pk: primaryKeyName || 'id', row: tour.seed }))
    }
    return `${window.location.pathname}?${params.toString()}`
    // runId força a recarga (Recomeçar e troca de tutorial): cada um começa do zero, com a própria linha de exemplo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, tour, modelName, primaryKeyName, runId])

  const teardown = useCallback(() => {
    playerRef.current?.stop()
    playerRef.current = null
    adapterRef.current?.dispose()
    adapterRef.current = null
  }, [])

  useEffect(() => () => teardown(), [teardown])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // espera a tela da demonstração ficar pronta e então liga o player
  const handleLoad = useCallback(async () => {
    const frame = iframeRef.current
    const doc = frame?.contentDocument
    if (!frame || !doc || !tour) return
    teardown()
    setLoading(true); setFailed(false); setSnap(null)
    const needsRow = tour.steps[0]?.target?.type === 'row'
    const started = Date.now()
    const ready = () => {
      if (needsRow) return Array.from(doc.querySelectorAll('tbody tr')).some(r => r.querySelectorAll('td').length > 1)
      return !!(doc.querySelector('[data-tour="new"], [data-tour="search"], [data-tour-field]') || Array.from(doc.querySelectorAll('tbody tr')).length)
    }
    while (!ready()) {
      if (Date.now() - started > 25_000 || !frame.isConnected) { setFailed(true); setLoading(false); return }
      await new Promise(r => setTimeout(r, 250))
    }
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const adapter = createDomAdapter(doc, language)
    adapterRef.current = adapter
    const player = new TourPlayer(tour, adapter, { language, speed: speedRef.current, reducedMotion: reduced, onChange: setSnap })
    playerRef.current = player
    setLoading(false)
    setSnap(player.snapshot)
    player.play()
  }, [tour, language, teardown])

  /** Passa para o tutorial `index` da fila: recarrega a demonstração do zero. */
  const goTo = useCallback((index: number) => {
    teardown()
    setTransition(null)
    setHeld(false)
    setQIndex(index)
    setSnap(null)
    setLoading(true)
    setFailed(false)
    setRunId(n => n + 1)
  }, [teardown])

  const startQueue = (list: Tour[]) => {
    if (!list.length) return
    teardown()
    setQueue(list)
    setStage('play')
    goTo(0)
  }

  // terminou um tutorial e ainda há outros na fila: mostra o cartão "A seguir" com contagem regressiva
  useEffect(() => {
    if (stage !== 'play' || snap?.state !== 'ended' || isLastInQueue) return
    const seconds = TRANSITION_SECONDS[speedRef.current]
    setTransition(queue[qIndex + 1])
    setHeld(false)
    setCountTotal(seconds)
    setRemaining(seconds)
  }, [stage, snap?.state, isLastInQueue, qIndex, queue])

  // a contagem anda de segundo em segundo (parada quando o usuário cancela) e, ao zerar, começa o próximo
  useEffect(() => {
    if (!transition || held) return
    if (remaining <= 0) { goTo(qIndex + 1); return }
    const timer = setTimeout(() => setRemaining(r => r - 1), 1000)
    return () => clearTimeout(timer)
  }, [transition, held, remaining, qIndex, goTo])

  const changeSpeed = (s: TourSpeed) => { setSpeed(s); playerRef.current?.setSpeed(s) }
  // "Recomeçar": o tutorial atual; ao fim da fila, ou pelo botão "tudo", a fila inteira desde o primeiro
  const restart = () => goTo(finishedAllRef.current ? 0 : qIndex)
  const restartAll = () => goTo(0)
  const skip = () => { if (!isLastInQueue) goTo(qIndex + 1) }
  const backToChoose = () => { teardown(); setTransition(null); setHeld(false); setStage('choose'); setSnap(null) }

  const playing = snap?.state === 'playing'
  const ended = snap?.state === 'ended'
  const finishedAll = ended && isLastInQueue
  const finishedAllRef = useRef(false)
  finishedAllRef.current = finishedAll
  const multi = queue.length > 1

  const rowPlay = t('runtime.tour.play_one', 'Reproduzir este')

  // duração estimada (muda com a velocidade): de cada cartão, do que está selecionado e do tour completo
  const selectedQueue = useMemo(() => buildQueue(tours, selected), [tours, selected])
  const selectedMs = estimateQueueMs(selectedQueue, speed, language)
  const allMs = estimateQueueMs(tours, speed, language)
  const about = (ms: number) => t('runtime.tour.about', 'cerca de {time}').replace('{time}', formatDuration(ms))
  const seenCount = tours.filter(x => seen.includes(x.id)).length
  const unseen = unseenTours(tours, seen)
  const partial = seenCount > 0 && unseen.length > 0

  // teclado: setas andam entre os cartões, Enter reproduz o cartão, Espaço marca/desmarca (nativo do botão)
  const onCardKey = (x: Tour) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); startQueue([x]); return }
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const cards = Array.from(gridRef.current?.querySelectorAll<HTMLButtonElement>('[data-tour-card]') || [])
    const i = cards.indexOf(e.currentTarget)
    cards[(i + dir + cards.length) % cards.length]?.focus()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={t('runtime.tour.title', 'Ajuda interativa')}>
      <div className="flex flex-col w-full max-w-[1500px] h-[90vh] rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2 min-w-0">
            <PlayCircle className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2 className="text-sm font-black text-neutral-900 dark:text-white truncate">
              {tour && stage === 'play' ? resolveHelp(tour.title, language) : t('runtime.tour.title', 'Ajuda interativa')}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t('runtime.tour.close', 'Fechar')} className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {stage === 'choose' ? (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <p className="text-xs text-neutral-500">{t('runtime.tour.subtitle', 'Veja o sistema em ação, passo a passo. Nada é gravado de verdade.')}</p>

              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/30 p-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white"><ListVideo className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-indigo-900 dark:text-indigo-200">
                    {screenName ? t('runtime.tour.full_tour_named', 'Tour completo: {name}').replace('{name}', screenName) : t('runtime.tour.full_tour', 'Tour completo')}
                  </p>
                  <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80">{tours.length} {tours.length === 1 ? t('runtime.tour.tutorial', 'tutorial') : t('runtime.tour.tutorials', 'tutoriais')} · {about(allMs)}</p>
                  {seenCount > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="h-1.5 w-32 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-900/60">
                        <span className="block h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round((seenCount / tours.length) * 100)}%` }} />
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                        {t('runtime.tour.seen_progress', '{seen} de {total} vistos').replace('{seen}', String(seenCount)).replace('{total}', String(tours.length))}
                      </span>
                      <button type="button" onClick={() => { clearSeen(storage, seenKey); setSeen([]) }} className="text-[11px] text-indigo-600 underline hover:no-underline">
                        {t('runtime.tour.reset_progress', 'Zerar progresso')}
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {partial && (
                    <button type="button" onClick={() => startQueue(unseen)}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black tracking-wide text-white hover:bg-indigo-500">
                      <Play className="h-4 w-4" /> {t('runtime.tour.continue', 'Continuar de onde parei')} ({unseen.length})
                    </button>
                  )}
                  <button type="button" onClick={() => startQueue(buildQueue(tours))} disabled={tours.length === 0}
                    className={cn('inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black tracking-wide disabled:opacity-40',
                      partial ? 'border border-indigo-300 text-indigo-600 hover:bg-indigo-100 dark:border-indigo-800 dark:hover:bg-indigo-950/60' : 'bg-indigo-600 text-white hover:bg-indigo-500')}>
                    {partial ? <ListVideo className="h-4 w-4" /> : <Play className="h-4 w-4" />} {t('runtime.tour.play_all', 'Reproduzir todos')}
                  </button>
                </div>
              </div>

              <div ref={gridRef} role="group" aria-label={t('runtime.tour.choose', 'Escolha o que você quer ver')} className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
                {tours.map(x => {
                  const pos = selectedQueue.findIndex(q => q.id === x.id) + 1
                  const on = pos > 0
                  const Icon = ACTION_ICON[x.action]
                  const title = shortTitle(resolveHelp(x.title, language) || x.id)
                  const summary = resolveHelp(x.summary, language) || t(`runtime.tour.summary_${x.action}`, '')
                  return (
                    <div key={x.id} className="relative">
                      <button
                        type="button"
                        data-tour-card
                        aria-pressed={on}
                        onClick={() => setSelected(s => toggleId(s, x.id))}
                        onKeyDown={onCardKey(x)}
                        className={cn('flex h-full w-full flex-col gap-1.5 rounded-2xl border-2 p-3.5 pb-10 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                          on ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800')}
                      >
                        <span className="flex items-center justify-between">
                          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', on ? 'bg-indigo-600 text-white' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800')}><Icon className="h-4 w-4" /></span>
                          {on
                            ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-black text-white" title={t('runtime.tour.order', 'Ordem de reprodução')}>{pos}</span>
                            : <span className="h-5 w-5 rounded-full border border-neutral-300 dark:border-neutral-600" aria-hidden="true" />}
                        </span>
                        <span className={cn('text-sm font-black', on ? 'text-indigo-700 dark:text-indigo-300' : 'text-neutral-900 dark:text-white')}>{title}</span>
                        {summary && <span className={cn('text-xs leading-snug', on ? 'text-indigo-700/90 dark:text-indigo-300/90' : 'text-neutral-500')}>{summary}</span>}
                        <span className="mt-auto flex items-center gap-2 pt-1 text-[11px] text-neutral-400">
                          <span>{x.steps.length} {t('runtime.tour.steps', 'passos')} · {formatDuration(estimateTourMs(x, speed, language))}</span>
                          {seen.includes(x.id) && <span className="inline-flex items-center gap-0.5 font-bold text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" />{t('runtime.tour.seen', 'Visto')}</span>}
                        </span>
                      </button>
                      <button type="button" onClick={() => startQueue([x])} title={rowPlay} aria-label={`${rowPlay}: ${title}`}
                        className="absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-950/60">
                        <Play className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] text-neutral-400">{t('runtime.tour.select_hint', 'Clique para selecionar um ou mais tutoriais; clique de novo para desmarcar.')}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 dark:border-neutral-800 px-5 py-3">
              <div className="flex items-center gap-3 text-xs">
                <span className="text-neutral-500" aria-live="polite">
                  {selected.length === 0
                    ? t('runtime.tour.pick_hint', 'Clique nos cartões para escolher')
                    : `${selected.length === 1 ? t('runtime.tour.selected_one', '1 selecionado') : t('runtime.tour.selected_many', '{count} selecionados').replace('{count}', String(selected.length))} · ${about(selectedMs)}`}
                </span>
                {selected.length > 0 && (
                  <button type="button" onClick={() => setSelected([])} className="font-bold text-indigo-600 underline hover:no-underline">{t('runtime.tour.clear', 'Limpar')}</button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="inline-flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-0.5">
                  {SPEEDS.map(s => (
                    <button key={s} type="button" onClick={() => setSpeed(s)}
                      className={cn('rounded-md px-3 py-1 text-[11px] font-bold transition-colors', speed === s ? 'bg-white text-indigo-600 shadow-sm dark:bg-neutral-700' : 'text-neutral-500')}>
                      {t(`runtime.tour.${s}`, s === 'slow' ? 'Lento' : s === 'fast' ? 'Rápido' : 'Normal')}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => startQueue(selectedQueue)} disabled={selected.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 dark:border-indigo-800 px-5 py-2.5 text-xs font-black tracking-wide text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 disabled:opacity-40 disabled:cursor-not-allowed">
                  <Check className="h-4 w-4" /> {t('runtime.tour.play_selected', 'Reproduzir selecionados')}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="relative flex-1 bg-neutral-100 dark:bg-neutral-950">
              <iframe
                key={runId}
                ref={iframeRef}
                src={src}
                title={t('runtime.tour.title', 'Ajuda interativa')}
                onLoad={() => { void handleLoad() }}
                className="absolute inset-0 w-full h-full border-0"
              />
              {(loading || failed) && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-neutral-900/80 text-sm font-bold text-neutral-600 dark:text-neutral-300">
                  {failed
                    ? t('runtime.tour.failed', 'Não foi possível preparar a demonstração.')
                    : <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {t('runtime.tour.loading', 'Preparando a demonstração…')}</span>}
                </div>
              )}

              {transition && tour && !failed && (
                <UpNextCard
                  finished={tour}
                  next={transition}
                  queue={queue}
                  index={qIndex}
                  remaining={remaining}
                  total={countTotal}
                  held={held}
                  language={language}
                  t={t}
                  onPlayNow={() => goTo(qIndex + 1)}
                  onHold={() => setHeld(true)}
                  onResume={() => { setHeld(false); setRemaining(r => Math.max(1, r)) }}
                  onChooseAnother={backToChoose}
                />
              )}

              {finishedAll && !failed && (
                <DoneCard queue={queue} language={language} t={t} projectId={projectId} viewId={viewId} onReplayAll={() => goTo(0)} onChooseAnother={backToChoose} />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-1">
                <button type="button" disabled={!snap || ended} onClick={() => (playing ? playerRef.current?.pause() : playerRef.current?.play())}
                  className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40"
                  title={playing ? t('runtime.tour.pause', 'Pausar') : t('runtime.tour.resume', 'Continuar')} aria-label={playing ? t('runtime.tour.pause', 'Pausar') : t('runtime.tour.resume', 'Continuar')}>
                  {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button type="button" disabled={!snap || ended} onClick={() => playerRef.current?.step()}
                  className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-40"
                  title={t('runtime.tour.step', 'Próximo passo')} aria-label={t('runtime.tour.step', 'Próximo passo')}>
                  <SkipForward className="w-4 h-4" />
                </button>
                <button type="button" onClick={restart}
                  className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  title={multi && !finishedAll ? t('runtime.tour.restart_this', 'Recomeçar este tutorial') : t('runtime.tour.restart', 'Recomeçar')}
                  aria-label={multi && !finishedAll ? t('runtime.tour.restart_this', 'Recomeçar este tutorial') : t('runtime.tour.restart', 'Recomeçar')}>
                  <RotateCcw className="w-4 h-4" />
                </button>
                {multi && (
                  <button type="button" onClick={restartAll}
                    className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    title={t('runtime.tour.restart_all', 'Recomeçar tudo')} aria-label={t('runtime.tour.restart_all', 'Recomeçar tudo')}>
                    <Repeat className="w-4 h-4" />
                  </button>
                )}
                {multi && (
                  <button type="button" disabled={isLastInQueue} onClick={skip}
                    className="ml-1 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[11px] font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-40">
                    {t('runtime.tour.skip', 'Pular tutorial')}
                  </button>
                )}
              </div>

              <div className="inline-flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-0.5">
                {SPEEDS.map(s => (
                  <button key={s} type="button" onClick={() => changeSpeed(s)}
                    className={cn('px-3 py-1 rounded-md text-[11px] font-bold transition-colors', speed === s ? 'bg-white dark:bg-neutral-700 text-indigo-600 shadow-sm' : 'text-neutral-500')}>
                    {t(`runtime.tour.${s}`, s === 'slow' ? 'Lento' : s === 'fast' ? 'Rápido' : 'Normal')}
                  </button>
                ))}
              </div>

              <span className="text-[11px] font-bold text-neutral-500" aria-live="polite">
                {multi && t('runtime.tour.sequence', 'Tutorial {current} de {total}').replace('{current}', String(qIndex + 1)).replace('{total}', String(queue.length))}
                {multi && snap && !ended ? ' · ' : ''}
                {snap && !ended
                  ? t('runtime.tour.progress', 'Passo {current} de {total}').replace('{current}', String(Math.min(snap.index + 1, snap.total))).replace('{total}', String(snap.total))
                  : ended && !multi ? t('runtime.tour.ended', 'Fim do tutorial.') : ''}
                {finishedAll && multi ? ` · ${t('runtime.tour.ended_all', 'Fim dos tutoriais.')}` : ''}
              </span>
              {snap && snap.skipped > 0 && <span className="text-[11px] text-amber-600">{t('runtime.tour.skipped', 'Alguns passos foram pulados: não se aplicam à sua tela.')}</span>}

            </div>
          </>
        )}
      </div>
    </div>
  )
}
