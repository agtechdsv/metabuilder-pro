'use client'

import React, { useMemo, useState } from 'react'
import { X, GitCompare } from 'lucide-react'
import { useI18n } from '@/i18n'
import { planTitle } from '@/lib/testing/plan'
import { CHANGE_ORDER, compareRuns, runTotals, type Change, type HistoryRun } from '@/lib/testing/history'
import { StatusIcon } from './IdeTestStatus'

const TONE: Record<Change, string> = {
  regression: 'text-red-300 bg-red-500/10 border-red-500/30',
  still_failing: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
  fixed: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  new: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
  removed: 'text-neutral-300 bg-neutral-500/10 border-neutral-500/30',
  other: 'text-neutral-300 bg-neutral-500/10 border-neutral-500/30',
  same: 'text-neutral-400 bg-neutral-500/5 border-neutral-700',
}

/** Comparativo de duas execuções: a mais antiga (A) contra a mais nova (B), teste a teste. */
export function IdeTestCompareModal({ runs, onClose }: { runs: [HistoryRun, HistoryRun]; onClose: () => void }) {
  const { t, language } = useI18n()
  const [a, b] = useMemo(() => [...runs].sort((x, y) => x.id.localeCompare(y.id)) as [HistoryRun, HistoryRun], [runs])
  const { rows, counts } = useMemo(() => compareRuns(a, b), [a, b])
  const [filter, setFilter] = useState<Change | 'all'>('all')
  const when = (r: HistoryRun) => new Date(r.startedAt).toLocaleString(language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US')
  const label: Record<Change, string> = {
    regression: t('ide_tests.cmp_regression', 'Regressões'),
    still_failing: t('ide_tests.cmp_still_failing', 'Ainda falhando'),
    fixed: t('ide_tests.cmp_fixed', 'Corrigidos'),
    new: t('ide_tests.cmp_new', 'Novos'),
    removed: t('ide_tests.cmp_removed', 'Removidos'),
    other: t('ide_tests.cmp_other', 'Outras mudanças'),
    same: t('ide_tests.cmp_same', 'Sem mudança'),
  }
  const shown = rows.filter(r => filter === 'all' || r.change === filter)
  const ta = runTotals(a)
  const tb = runTotals(b)

  const Side = ({ run, tt, title }: { run: HistoryRun; tt: ReturnType<typeof runTotals>; title: string }) => (
    <div className="flex-1 rounded-xl border border-neutral-700 bg-neutral-800/40 px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-neutral-500">{title}</p>
      <p className="text-sm font-semibold text-white">{when(run)}</p>
      <p className="text-xs mt-1 text-neutral-400"><b className="text-emerald-400">{tt.passed}</b> {t('ide_tests.passed', 'passaram')} · <b className="text-red-400">{tt.failed}</b> {t('ide_tests.failed', 'falharam')} · {tt.rate}% · {(tt.ms / 1000).toFixed(0)}s</p>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[1000002] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-5xl h-[92vh] flex flex-col rounded-2xl bg-neutral-900 border border-neutral-700 text-neutral-200 overflow-hidden shadow-2xl">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-neutral-800">
          <GitCompare className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-bold text-white flex-1">{t('ide_tests.compare_title', 'Comparativo de testes')}</span>
          <button onClick={onClose} className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          <div className="flex flex-col md:flex-row gap-3">
            <Side run={a} tt={ta} title={t('ide_tests.cmp_older', 'Execução anterior (A)')} />
            <Side run={b} tt={tb} title={t('ide_tests.cmp_newer', 'Execução mais recente (B)')} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setFilter('all')} className={`rounded-full border px-3 py-1 text-xs ${filter === 'all' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-neutral-700 text-neutral-300'}`}>{t('ide_tests.cmp_all', 'Todos')} ({rows.length})</button>
            {CHANGE_ORDER.filter(c => counts[c] > 0).map(c => (
              <button key={c} onClick={() => setFilter(c)} className={`rounded-full border px-3 py-1 text-xs ${filter === c ? 'bg-indigo-600 border-indigo-600 text-white' : TONE[c]}`}>{label[c]} ({counts[c]})</button>
            ))}
          </div>
          <div className="rounded-xl border border-neutral-700 overflow-hidden">
            {shown.map((r, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2 border-b border-neutral-800 last:border-0 text-xs">
                <span className={`shrink-0 w-28 text-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${TONE[r.change]}`}>{label[r.change]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-neutral-200 break-words">{planTitle(r.row, language)}</p>
                  <p className="text-[11px] text-neutral-500">{r.group}</p>
                  {r.b?.error && r.change !== 'same' && <pre className="mt-1 whitespace-pre-wrap text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{r.b.error}</pre>}
                </div>
                <div className="flex items-center gap-1 shrink-0 w-24"><span className="text-[10px] text-neutral-500">A</span>{r.a ? <><StatusIcon s={r.a.status} />{r.a.ms != null && <span className="text-neutral-500 tabular-nums">{(r.a.ms / 1000).toFixed(1)}s</span>}</> : <span className="text-neutral-600">—</span>}</div>
                <div className="flex items-center gap-1 shrink-0 w-24"><span className="text-[10px] text-neutral-500">B</span>{r.b ? <><StatusIcon s={r.b.status} />{r.b.ms != null && <span className="text-neutral-500 tabular-nums">{(r.b.ms / 1000).toFixed(1)}s</span>}</> : <span className="text-neutral-600">—</span>}</div>
                <span className={`shrink-0 w-14 text-right tabular-nums ${r.deltaMs == null ? 'text-neutral-600' : r.deltaMs > 500 ? 'text-orange-300' : r.deltaMs < -500 ? 'text-emerald-300' : 'text-neutral-500'}`}>{r.deltaMs == null ? '' : `${r.deltaMs >= 0 ? '+' : ''}${(r.deltaMs / 1000).toFixed(1)}s`}</span>
              </div>
            ))}
            {shown.length === 0 && <p className="px-4 py-6 text-center text-xs text-neutral-500">{t('ide_tests.cmp_empty', 'Nada nesta categoria.')}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
