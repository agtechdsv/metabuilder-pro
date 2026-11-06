'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ListVideo, Loader2, Pause, Play, PlayCircle, RotateCcw, SkipForward, X } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { resolveHelp } from '@/lib/helpText'
import { encodeDemoSeed, isDemoMode } from '@/lib/demo/demoMode'
import { createDomAdapter, type DomAdapter } from '@/lib/interactiveHelp/domAdapter'
import { buildQueue, toggleId } from '@/lib/interactiveHelp/order'
import { TourPlayer, type PlayerSnapshot } from '@/lib/interactiveHelp/player'
import { hasInteractiveHelp, visibleTours, type Tour, type TourSpeed } from '@/lib/interactiveHelp/types'
import { cn } from '@/lib/utils'
import { HelpFeedbackBar } from './HelpFeedbackBar'

interface Props {
  /** `layout_config.interactive_help` */
  config: unknown
  projectId?: string
  viewId?: string
  /** tabela/modelo e chave primária, para a linha sintética do modo demonstração */
  modelName?: string
  primaryKeyName?: string
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
/** pausa entre um tutorial e o próximo, mostrando "Próximo: ..." */
const TRANSITION_MS = 1600

function InteractiveHelpModal({ config, projectId, viewId, modelName, primaryKeyName, onClose }: Props & { onClose: () => void }) {
  const { t, language } = useI18n()
  // na ordem que o dev definiu no Studio (roteiros ocultos já ficam de fora)
  const tours = useMemo(() => visibleTours(config), [config])
  const [selected, setSelected] = useState<string[]>([])
  const [speed, setSpeed] = useState<TourSpeed>('normal')
  const [stage, setStage] = useState<'choose' | 'play'>('choose')
  const [queue, setQueue] = useState<Tour[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [transition, setTransition] = useState<Tour | null>(null)
  const [runId, setRunId] = useState(0)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [snap, setSnap] = useState<PlayerSnapshot | null>(null)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerRef = useRef<TourPlayer | null>(null)
  const adapterRef = useRef<DomAdapter | null>(null)
  const speedRef = useRef(speed)
  speedRef.current = speed

  const tour: Tour | undefined = queue[qIndex]
  const isLastInQueue = qIndex >= queue.length - 1

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

  // terminou um tutorial e ainda há outros na fila: mostra "Próximo: ..." e segue sozinho
  useEffect(() => {
    if (stage !== 'play' || snap?.state !== 'ended' || isLastInQueue) return
    setTransition(queue[qIndex + 1])
    const timer = setTimeout(() => goTo(qIndex + 1), TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [stage, snap?.state, isLastInQueue, qIndex, queue, goTo])

  const changeSpeed = (s: TourSpeed) => { setSpeed(s); playerRef.current?.setSpeed(s) }
  const restart = () => goTo(qIndex)
  const skip = () => { if (!isLastInQueue) goTo(qIndex + 1) }
  const backToChoose = () => { teardown(); setStage('choose'); setSnap(null) }

  const playing = snap?.state === 'playing'
  const ended = snap?.state === 'ended'
  const finishedAll = ended && isLastInQueue
  const multi = queue.length > 1

  const rowPlay = t('runtime.tour.play_one', 'Reproduzir este')

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
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-widest text-neutral-400">{t('runtime.tour.choose', 'Escolha o que você quer ver')}</p>
              <p className="text-[11px] text-neutral-400">{t('runtime.tour.select_hint', 'Clique para selecionar um ou mais tutoriais; clique de novo para desmarcar.')}</p>
              <ul className="space-y-2">
                {tours.map(x => {
                  const on = selected.includes(x.id)
                  return (
                    <li key={x.id} className="flex items-stretch gap-2">
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setSelected(s => toggleId(s, x.id))}
                        className={cn('flex-1 text-left px-4 py-3 rounded-2xl border text-sm font-bold transition-colors',
                          on ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300' : 'border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800')}
                      >
                        {resolveHelp(x.title, language) || x.id}
                        <span className="ml-2 text-[11px] font-medium text-neutral-400">{x.steps.length} {t('runtime.tour.steps', 'passos')}</span>
                      </button>
                      <button type="button" onClick={() => startQueue([x])} title={rowPlay} aria-label={`${rowPlay}: ${resolveHelp(x.title, language)}`}
                        className="px-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40">
                        <Play className="w-4 h-4" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-widest text-neutral-400">{t('runtime.tour.speed', 'Velocidade')}</p>
              <div className="inline-flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1">
                {SPEEDS.map(s => (
                  <button key={s} type="button" onClick={() => setSpeed(s)}
                    className={cn('px-4 py-1.5 rounded-lg text-xs font-bold transition-colors', speed === s ? 'bg-white dark:bg-neutral-700 text-indigo-600 shadow-sm' : 'text-neutral-500')}>
                    {t(`runtime.tour.${s}`, s === 'slow' ? 'Lento' : s === 'fast' ? 'Rápido' : 'Normal')}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-neutral-400">{t('runtime.tour.demo_note', 'Nada do que aparece na demonstração é gravado de verdade.')}</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => startQueue(buildQueue(tours, selected))} disabled={selected.length === 0}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black tracking-wide disabled:opacity-40 disabled:cursor-not-allowed">
                <Play className="w-4 h-4" /> {t('runtime.tour.play_selected', 'Reproduzir selecionados')}{selected.length > 0 ? ` (${selected.length})` : ''}
              </button>
              <button type="button" onClick={() => startQueue(buildQueue(tours))} disabled={tours.length === 0}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-indigo-200 dark:border-indigo-900 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-black tracking-wide disabled:opacity-40">
                <ListVideo className="w-4 h-4" /> {t('runtime.tour.play_all', 'Reproduzir todos')}
              </button>
            </div>
          </div>
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
              {(loading || failed || transition) && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-neutral-900/80 text-sm font-bold text-neutral-600 dark:text-neutral-300">
                  {failed
                    ? t('runtime.tour.failed', 'Não foi possível preparar a demonstração.')
                    : transition
                      ? <span className="flex items-center gap-2 text-indigo-600"><Loader2 className="w-4 h-4 animate-spin" /> {t('runtime.tour.next_up', 'Próximo: {title}').replace('{title}', resolveHelp(transition.title, language))}</span>
                      : <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {t('runtime.tour.loading', 'Preparando a demonstração…')}</span>}
                </div>
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
                  title={t('runtime.tour.restart', 'Recomeçar')} aria-label={t('runtime.tour.restart', 'Recomeçar')}>
                  <RotateCcw className="w-4 h-4" />
                </button>
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

              <div className="ml-auto flex items-center gap-3">
                {finishedAll && (
                  <button type="button" onClick={backToChoose} className="px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[11px] font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700">
                    {t('runtime.tour.choose_another', 'Escolher outro')}
                  </button>
                )}
                {finishedAll && projectId && viewId && <HelpFeedbackBar feedback={{ projectId, screen: viewId, zone: 'tutorial' }} className="min-w-[14rem]" />}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
