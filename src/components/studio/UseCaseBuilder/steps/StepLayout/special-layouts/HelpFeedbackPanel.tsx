'use client'

import React, { useState } from 'react'
import { ThumbsDown, ThumbsUp, RefreshCw } from 'lucide-react'
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

/** Feedback dos usuários sobre as dicas desta tela: por campo e por zona, com os de mais 👎 primeiro, e os comentários. */
export function HelpFeedbackPanel({ projectId, screenId, fieldIds, fieldName, zoneCount, isCustom, t }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<{ summary: FeedbackSummaryRow[]; comments: Comment[] } | null>(null)

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
  const targets = groupFeedback(data?.summary || [], fieldIds, screenId)
  const comments = (data?.comments || []).filter(mine)

  return (
    <div className="space-y-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">{t('wizard.layout.help_feedback', 'Feedback dos usuários')}</span>
        <button type="button" onClick={load} disabled={loading} className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 disabled:opacity-50">
          <RefreshCw className={loading ? 'w-3 h-3 animate-spin' : 'w-3 h-3'} />
          {data ? t('common.refresh', 'Atualizar') : t('wizard.layout.help_feedback_load', 'Carregar')}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      {data && targets.length === 0 && <p className="text-[11px] text-neutral-400 italic">{t('wizard.layout.help_feedback_empty', 'Ninguém votou nas dicas desta tela ainda.')}</p>}
      {targets.length > 0 && (
        <ul className="space-y-2">
          {targets.map(tg => (
            <li key={tg.fieldId || '__screen__'} className="text-xs">
              <span className="block font-bold text-neutral-700 dark:text-neutral-300 truncate">{nameOf({ field_id: tg.fieldId })}</span>
              <ul className="mt-0.5 space-y-0.5 pl-3">
                {tg.zones.map(z => {
                  const hint = tg.fieldId && z.zone && z.zone !== 'screen' && z.zone !== 'central' && z.zone !== 'tutorial' && suggestsOwnText(tg, z.zone, {
                    custom: isCustom(tg.fieldId, z.zone), zoneCount: zoneCount(tg.fieldId),
                  })
                  return (
                    <li key={z.zone || 'none'} className="flex flex-wrap items-center gap-x-3 text-[11px]">
                      <span className="flex-1 text-neutral-500 truncate">{zoneName(z.zone)}</span>
                      <span className="flex items-center gap-1 text-emerald-600"><ThumbsUp className="w-3 h-3" />{z.up}</span>
                      <span className="flex items-center gap-1 text-red-500"><ThumbsDown className="w-3 h-3" />{z.down}</span>
                      {hint && (
                        <span className="basis-full text-[10px] font-bold text-amber-600">
                          {t('wizard.layout.help_suggest_own', 'Esta zona está pior que as outras: considere "Personalizar nesta zona".')}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {comments.length > 0 && (
        <ul className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          {comments.map((c, i) => (
            <li key={i} className="text-xs">
              <span className="font-bold text-neutral-600 dark:text-neutral-400">{nameOf(c)}</span>
              {c.zone && <span className="text-neutral-400"> · {zoneName(c.zone)}</span>}
              <span className="text-neutral-400"> · {new Date(c.created_at).toLocaleDateString()}</span>
              <p className="whitespace-pre-line text-neutral-700 dark:text-neutral-300">{c.comment}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
