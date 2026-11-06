'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Pause, Play, PlayCircle, RotateCcw, SkipForward, X } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { resolveHelp } from '@/lib/helpText'
import { encodeDemoSeed, isDemoMode } from '@/lib/demo/demoMode'
import { createDomAdapter, type DomAdapter } from '@/lib/interactiveHelp/domAdapter'
import { TourPlayer, type PlayerSnapshot } from '@/lib/interactiveHelp/player'
import { hasInteractiveHelp, normalizeInteractiveHelp, type Tour, type TourSpeed } from '@/lib/interactiveHelp/types'
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

function InteractiveHelpModal({ config, projectId, viewId, modelName, primaryKeyName, onClose }: Props & { onClose: () => void }) {
  const { t, language } = useI18n()
  const tours = useMemo(() => normalizeInteractiveHelp(config).tours.filter(x => x.steps.length > 0), [config])
  const [tourId, setTourId] = useState(tours[0]?.id || '')
  const [speed, setSpeed] = useState<TourSpeed>('normal')
  const [stage, setStage] = useState<'choose' | 'play'>('choose')
  const [runId, setRunId] = useState(0)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [snap, setSnap] = useState<PlayerSnapshot | null>(null)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerRef = useRef<TourPlayer | null>(null)
  const adapterRef = useRef<DomAdapter | null>(null)
  const speedRef = useRef(speed)
  speedRef.current = speed

  const tour: Tour | undefined = tours.find(x => x.id === tourId) || tours[0]

  // a página da demonstração é a própria tela, aberta no modo demonstração, já com a linha sintética (se o roteiro precisar)
  const src = useMemo(() => {
    if (stage !== 'play' || !tour || typeof window === 'undefined') return ''
    const params = new URLSearchParams({ mb_demo: '1' })
    if (tour.seed && Object.keys(tour.seed).length && modelName) {
      params.set('mb_seed', encodeDemoSeed({ table: modelName, pk: primaryKeyName || 'id', row: tour.seed }))
    }
    return `${window.location.pathname}?${params.toString()}`
    // runId força a recarga (Recomeçar)
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

  const changeSpeed = (s: TourSpeed) => { setSpeed(s); playerRef.current?.setSpeed(s) }
  const start = () => { teardown(); setStage('play'); setRunId(n => n + 1) }
  const restart = () => { teardown(); setRunId(n => n + 1) }

  const playing = snap?.state === 'playing'
  const ended = snap?.state === 'ended'

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
              <ul className="space-y-2">
                {tours.map(x => (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => setTourId(x.id)}
                      className={cn('w-full text-left px-4 py-3 rounded-2xl border text-sm font-bold transition-colors',
                        tourId === x.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300' : 'border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800')}
                    >
                      {resolveHelp(x.title, language) || x.id}
                      <span className="ml-2 text-[11px] font-medium text-neutral-400">{x.steps.length} {t('runtime.tour.steps', 'passos')}</span>
                    </button>
                  </li>
                ))}
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
            <button type="button" onClick={start} disabled={!tour} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black tracking-wide disabled:opacity-50">
              <Play className="w-4 h-4" /> {t('runtime.tour.play', 'Reproduzir')}
            </button>
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
              {(loading || failed) && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-neutral-900/80 text-sm font-bold text-neutral-600 dark:text-neutral-300">
                  {failed
                    ? t('runtime.tour.failed', 'Não foi possível preparar a demonstração.')
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
                {snap && !ended
                  ? t('runtime.tour.progress', 'Passo {current} de {total}').replace('{current}', String(Math.min(snap.index + 1, snap.total))).replace('{total}', String(snap.total))
                  : ended ? t('runtime.tour.ended', 'Fim do tutorial.') : ''}
              </span>
              {snap && snap.skipped > 0 && <span className="text-[11px] text-amber-600">{t('runtime.tour.skipped', 'Alguns passos foram pulados: não se aplicam à sua tela.')}</span>}

              <div className="ml-auto">
                {ended && projectId && viewId && <HelpFeedbackBar feedback={{ projectId, screen: viewId, zone: 'tutorial' }} className="min-w-[14rem]" />}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
