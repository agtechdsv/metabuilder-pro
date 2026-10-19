'use client'

import React, { useState } from 'react'
import { Trash2, GitCompare, Loader2, FolderOpen, ChevronRight } from 'lucide-react'
import { useI18n } from '@/i18n'
import { runTotals, type HistoryRun } from '@/lib/testing/history'

interface Props {
  runs: HistoryRun[]
  loading: boolean
  error: string
  dir: string
  selected: Record<string, boolean>
  setSelected: (s: Record<string, boolean>) => void
  onOpen: (r: HistoryRun) => void
  onDelete: (ids: string[]) => Promise<void>
  onCompare: (a: HistoryRun, b: HistoryRun) => void
}

/** Aba "Histórico": lista as execuções gravadas no disco, com seleção (uma, várias, todas), exclusão e comparativo de duas. */
export function IdeTestHistory({ runs, loading, error, dir, selected, setSelected, onOpen, onDelete, onCompare }: Props) {
  const { t, language } = useI18n()
  const [confirm, setConfirm] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const ids = runs.map(r => r.id)
  const chosen = ids.filter(id => selected[id])
  const all = runs.length > 0 && chosen.length === runs.length
  const locale = language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US'
  const modeLabel: Record<string, string> = {
    internal: t('ide_tests.mode_internal_short', 'Navegador interno'),
    external: t('ide_tests.mode_external_short', 'Navegador do sistema'),
    background: t('ide_tests.mode_background_short', 'Segundo plano'),
  }

  const doDelete = async () => {
    if (!confirm) return
    setBusy(true)
    try { await onDelete(confirm) } finally { setBusy(false); setConfirm(null) }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
          <input type="checkbox" className="accent-indigo-500" checked={all} disabled={runs.length === 0}
            onChange={e => setSelected(e.target.checked ? Object.fromEntries(ids.map(id => [id, true])) : {})} />
          {t('ide_tests.hist_select_all', 'Selecionar todas')}
        </label>
        <span className="text-xs text-neutral-500">{chosen.length}/{runs.length}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button disabled={chosen.length !== 2} onClick={() => { const [a, b] = runs.filter(r => selected[r.id]); onCompare(a, b) }}
            title={t('ide_tests.hist_compare_hint', 'Marque exatamente duas execuções')}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"><GitCompare className="w-3.5 h-3.5" /> {t('ide_tests.hist_compare', 'Comparar')}</button>
          <button disabled={chosen.length === 0} onClick={() => setConfirm(chosen)}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /> {t('ide_tests.hist_delete_selected', 'Excluir selecionadas')}</button>
          <button disabled={runs.length === 0} onClick={() => setConfirm(ids)}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40">{t('ide_tests.hist_delete_all', 'Excluir todas')}</button>
        </div>
      </div>

      {confirm && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          <span className="flex-1">{t('ide_tests.hist_confirm', 'Excluir definitivamente {n} execução(ões) do histórico? Isso não pode ser desfeito.').replace('{n}', String(confirm.length))}</span>
          <button onClick={doDelete} disabled={busy} className="rounded-lg bg-red-600 hover:bg-red-500 px-3 py-1.5 font-bold text-white disabled:opacity-50">{busy ? '...' : t('ide_tests.hist_confirm_yes', 'Excluir')}</button>
          <button onClick={() => setConfirm(null)} disabled={busy} className="rounded-lg border border-neutral-600 px-3 py-1.5 text-neutral-200">{t('ide_tests.cancel', 'Cancelar')}</button>
        </div>
      )}

      {loading && <p className="text-sm text-neutral-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {t('ide_tests.hist_loading', 'Lendo o histórico...')}</p>}
      {error && <p className="text-sm text-red-400 whitespace-pre-wrap">{error}</p>}
      {!loading && !error && runs.length === 0 && <p className="text-sm text-neutral-400">{t('ide_tests.hist_empty', 'Nenhuma execução gravada ainda. Cada vez que você executa os testes, o resultado é guardado aqui.')}</p>}

      <div className="space-y-2">
        {runs.map(r => {
          const tt = runTotals(r)
          const views = r.groups.length
          return (
            <div key={r.id} className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${selected[r.id] ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-neutral-700 bg-neutral-800/40'}`}>
              <input type="checkbox" className="accent-indigo-500" checked={!!selected[r.id]} onChange={e => setSelected({ ...selected, [r.id]: e.target.checked })} />
              <button onClick={() => onOpen(r)} className="flex-1 min-w-0 text-left">
                <span className="block text-sm font-semibold text-white">{new Date(r.startedAt).toLocaleString(locale)}</span>
                <span className="block text-[11px] text-neutral-400">
                  {modeLabel[r.mode] || r.mode} · {views} {t('ide_tests.views_selected', 'caso(s) de uso')} · {(tt.ms / 1000).toFixed(0)}s{r.stopped ? ` · ${t('ide_tests.hist_stopped', 'interrompida')}` : ''}
                </span>
              </button>
              <span className="text-xs tabular-nums"><b className="text-emerald-400">{tt.passed}</b> <span className="text-neutral-500">/</span> <b className={tt.failed ? 'text-red-400' : 'text-neutral-500'}>{tt.failed}</b>{tt.other ? <span className="text-neutral-500"> / {tt.other}</span> : null}</span>
              <button onClick={() => onOpen(r)} className="flex items-center gap-1 rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800">{t('ide_tests.hist_open', 'Abrir')} <ChevronRight className="w-3.5 h-3.5" /></button>
              <button onClick={() => setConfirm([r.id])} title={t('ide_tests.hist_delete_one', 'Excluir esta execução')} className="p-1.5 rounded-lg text-neutral-400 hover:text-red-300 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
            </div>
          )
        })}
      </div>
      {dir && <p className="flex items-center gap-1.5 text-[11px] text-neutral-500"><FolderOpen className="w-3.5 h-3.5" /> {t('ide_tests.hist_where', 'Guardado em')} {dir}</p>}
    </div>
  )
}
