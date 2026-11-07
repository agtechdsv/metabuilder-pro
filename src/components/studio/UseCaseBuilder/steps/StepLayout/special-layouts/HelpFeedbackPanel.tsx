'use client'

import React, { useMemo, useState } from 'react'
import { AlertTriangle, MessageSquare, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FeedbackSummaryRow, groupFeedback, suggestsOwnText } from '@/lib/helpFeedbackSummary'
import type { HelpFeedbackZone } from '@/lib/helpFeedback'

interface Props {
  projectId?: string
  /** id da tela (caso de uso) e dos campos do formulário, para mostrar só o que é desta tela */
  screenId?: string
  fieldIds: string[]
  fieldName: (id: string) => string
  /** quantas zonas (filtro, grid, formulário) usam o campo */
  zoneCount: (id: string) => number
  /** a zona já tem texto próprio? */
  isCustom: (id: string, zone: HelpFeedbackZone) => boolean
  t: (key: string, fallback?: string) => string
}

interface Comment { screen_id: string | null; field_id: string | null; zone: string | null; comment: string; created_at: string }

interface Row { key: string; fieldId: string | null; name: string; zone: string | null; up: number; down: number; suggest: boolean; firstOfField: boolean }

const COMMENTS_SHOWN = 4

/**
 * Feedback dos usuários sobre as dicas desta tela. Em cima, o resumo (aprovação geral e quantas dicas precisam de atenção);
 * no meio, uma linha por campo e zona com a barra de aprovação, as piores primeiro; embaixo, os comentários em cartões.
 */
export function HelpFeedbackPanel({ projectId, screenId, fieldIds, fieldName, zoneCount, isCustom, t }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<{ summary: FeedbackSummaryRow[]; comments: Comment[] } | null>(null)
  const [filter, setFilter] = useState<'all' | 'attention'>('all')
  const [showAllComments, setShowAllComments] = useState(false)

  const zoneName = (z: string | null) =>
    z === 'filter' ? t('wizard.layout.zone_filter', 'Filtro de busca')
      : z === 'grid' ? t('wizard.layout.zone_grid', 'Grid de dados')
      : z === 'form' ? t('wizard.layout.zone_form', 'Formulário')
      : z === 'screen' ? t('wizard.layout.help_screen', 'Ajuda da tela')
      : z === 'central' ? t('wizard.layout.help_zone_central', 'Central de Ajuda')
      : z === 'tutorial' ? t('wizard.layout.help_zone_tutorial', 'Ajuda interativa')
      : t('wizard.layout.help_zone_unknown', 'Sem zona (votos antigos)')

  const mine = (r: { screen_id: string | null; field_id: string | null }) =>
    r.field_id ? fieldIds.includes(r.field_id) : !!screenId && r.screen_id === screenId
  const nameOf = (r: { field_id: string | null }) => (r.field_id ? fieldName(r.field_id) : t('wizard.layout.help_screen', 'Ajuda da tela'))

  const rows: Row[] = useMemo(() => {
    const targets = groupFeedback(data?.summary || [], fieldIds, screenId)
    const out: Row[] = []
    for (const tg of targets) {
      tg.zones.forEach((z, i) => {
        const suggest = !!tg.fieldId && z.zone !== null && suggestsOwnText(tg, z.zone, { custom: isCustom(tg.fieldId, z.zone as HelpFeedbackZone), zoneCount: zoneCount(tg.fieldId) })
        out.push({ key: `${tg.fieldId || '__screen__'}-${z.zone || 'none'}`, fieldId: tg.fieldId, name: nameOf({ field_id: tg.fieldId }), zone: z.zone, up: z.up, down: z.down, suggest, firstOfField: i === 0 })
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, fieldIds, screenId])

  if (!projectId) return null

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/v1/help-feedback?projectId=${encodeURIComponent(projectId)}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Erro ao ler o feedback.')
      setData(json.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const up = rows.reduce((a, r) => a + r.up, 0)
  const down = rows.reduce((a, r) => a + r.down, 0)
  const votes = up + down
  const approval = votes ? Math.round((up / votes) * 100) : 0
  const attention = rows.filter(r => r.down > r.up).length
  const visible = filter === 'attention' ? rows.filter(r => r.down > r.up) : rows
  const comments = (data?.comments || []).filter(mine)
  const shownComments = showAllComments ? comments : comments.slice(0, COMMENTS_SHOWN)

  const pill = (active: boolean) => cn('rounded-full px-3 py-1 text-[10px] font-bold transition-colors', active ? 'bg-indigo-600 text-white' : 'bg-neutral-100 text-neutral-500 hover:text-neutral-800 dark:bg-neutral-800')

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">{t('wizard.layout.help_feedback', 'Feedback dos usuários')}</span>
        <button type="button" onClick={load} disabled={loading} className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 disabled:opacity-50">
          <RefreshCw className={loading ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
          {data ? t('common.refresh', 'Atualizar') : t('wizard.layout.help_feedback_load', 'Carregar')}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      {data && rows.length === 0 && <p className="text-[11px] italic text-neutral-400">{t('wizard.layout.help_feedback_empty', 'Ninguém votou nas dicas desta tela ainda.')}</p>}

      {rows.length > 0 && (
        <>
          {/* resumo */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900/60">
              <div className={cn('text-2xl font-black', approval >= 70 ? 'text-emerald-600' : approval >= 50 ? 'text-amber-600' : 'text-red-500')}>{approval}%</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t('wizard.layout.help_feedback_approval', 'aprovação')}</div>
            </div>
            <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900/60">
              <div className="text-2xl font-black text-neutral-800 dark:text-neutral-100">{votes}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t('wizard.layout.help_feedback_votes', 'votos')}</div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900/60">
              <span className="flex items-center gap-1 text-lg font-black text-emerald-600"><ThumbsUp className="h-4 w-4" />{up}</span>
              <span className="flex items-center gap-1 text-lg font-black text-red-500"><ThumbsDown className="h-4 w-4" />{down}</span>
            </div>
            <div className={cn('rounded-xl p-3', attention > 0 ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-emerald-50 dark:bg-emerald-950/30')}>
              <div className={cn('text-2xl font-black', attention > 0 ? 'text-amber-600' : 'text-emerald-600')}>{attention}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{t('wizard.layout.help_feedback_attention', 'precisam de atenção')}</div>
            </div>
          </div>

          {/* por campo e zona */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setFilter('all')} className={pill(filter === 'all')}>{t('wizard.layout.help_feedback_filter_all', 'Todos')} ({rows.length})</button>
              <button type="button" onClick={() => setFilter('attention')} className={pill(filter === 'attention')}>{t('wizard.layout.help_feedback_filter_attention', 'Precisam de atenção')} ({attention})</button>
            </div>
            <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] gap-3 px-2 text-[9px] font-black uppercase tracking-widest text-neutral-400 sm:grid">
              <span>{t('wizard.layout.help_feedback_col_field', 'Campo')}</span>
              <span>{t('wizard.layout.help_feedback_col_where', 'Onde')}</span>
              <span>{t('wizard.layout.help_feedback_col_approval', 'Aprovação')}</span>
              <span className="w-24 text-right">{t('wizard.layout.help_feedback_votes', 'votos')}</span>
            </div>
            <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-100 dark:divide-neutral-800 dark:border-neutral-800">
              {visible.length === 0 && <li className="p-3 text-[11px] italic text-neutral-400">{t('wizard.layout.help_feedback_none_attention', 'Nenhuma dica precisa de atenção.')}</li>}
              {visible.map(r => {
                const total = r.up + r.down
                const pct = total ? Math.round((r.up / total) * 100) : 0
                const bad = r.down > r.up
                return (
                  <li key={r.key} className={cn('grid grid-cols-1 items-center gap-x-3 gap-y-1 px-2 py-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]', bad && 'bg-red-50/40 dark:bg-red-950/10')}>
                    <span className={cn('truncate text-xs', r.firstOfField ? 'font-bold text-neutral-800 dark:text-neutral-200' : 'text-transparent select-none')} title={r.name}>{r.name}</span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-500 dark:bg-neutral-800">{zoneName(r.zone)}</span>
                      {r.suggest && (
                        <span title={t('wizard.layout.help_suggest_own', 'Esta zona está pior que as outras: considere "Personalizar nesta zona".')} className="flex shrink-0 items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-700 dark:bg-amber-950/40">
                          <AlertTriangle className="h-3 w-3" />{t('wizard.layout.help_suggest_short', 'Personalizar')}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-red-200 dark:bg-red-900/40"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></span>
                      <span className={cn('w-9 text-right text-[10px] font-black', bad ? 'text-red-500' : 'text-emerald-600')}>{pct}%</span>
                    </span>
                    <span className="flex w-24 items-center justify-end gap-3 text-[11px]">
                      <span className="flex items-center gap-1 text-emerald-600"><ThumbsUp className="h-3 w-3" />{r.up}</span>
                      <span className="flex items-center gap-1 text-red-500"><ThumbsDown className="h-3 w-3" />{r.down}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}

      {/* comentários */}
      {comments.length > 0 && (
        <div className="space-y-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400"><MessageSquare className="h-3 w-3" />{t('wizard.layout.help_feedback_comments', 'Comentários')} ({comments.length})</span>
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {shownComments.map((c, i) => (
              <li key={i} className="rounded-xl border border-neutral-100 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
                  <span className="font-black text-neutral-700 dark:text-neutral-300">{nameOf(c)}</span>
                  {c.zone && <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-bold text-neutral-500 dark:bg-neutral-800">{zoneName(c.zone)}</span>}
                  <span className="ml-auto text-neutral-400">{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-line text-xs text-neutral-700 dark:text-neutral-300">{c.comment}</p>
              </li>
            ))}
          </ul>
          {comments.length > COMMENTS_SHOWN && (
            <button type="button" onClick={() => setShowAllComments(v => !v)} className="text-[11px] font-bold text-indigo-600 hover:underline">
              {showAllComments ? t('wizard.layout.help_feedback_less', 'Mostrar menos') : t('wizard.layout.help_feedback_more', 'Ver mais {n}').replace('{n}', String(comments.length - COMMENTS_SHOWN))}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
