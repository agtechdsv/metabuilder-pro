'use client'

import React, { useState } from 'react'
import { ThumbsDown, ThumbsUp, RefreshCw } from 'lucide-react'

interface Props {
  projectId?: string
  /** id da tela (caso de uso) e dos campos do formulário, para mostrar só o que é desta tela */
  screenId?: string
  fieldIds: string[]
  fieldName: (id: string) => string
  t: (key: string, fallback?: string) => string
}

interface Summary { screen_id: string | null; field_id: string | null; up: number; down: number }
interface Comment { screen_id: string | null; field_id: string | null; comment: string; created_at: string }

/** Feedback dos usuários sobre as dicas desta tela: campos com mais 👎 primeiro, e os comentários mais recentes. */
export function HelpFeedbackPanel({ projectId, screenId, fieldIds, fieldName, t }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<{ summary: Summary[]; comments: Comment[] } | null>(null)

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

  const mine = (r: { screen_id: string | null; field_id: string | null }) =>
    r.field_id ? fieldIds.includes(r.field_id) : !!screenId && r.screen_id === screenId
  const nameOf = (r: { field_id: string | null }) => (r.field_id ? fieldName(r.field_id) : t('wizard.layout.help_screen', 'Ajuda da tela'))
  const summary = (data?.summary || []).filter(mine)
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
      {data && summary.length === 0 && <p className="text-[11px] text-neutral-400 italic">{t('wizard.layout.help_feedback_empty', 'Ninguém votou nas dicas desta tela ainda.')}</p>}
      {summary.length > 0 && (
        <ul className="space-y-1">
          {summary.map(r => (
            <li key={`${r.screen_id}-${r.field_id}`} className="flex items-center gap-3 text-xs">
              <span className="flex-1 font-bold text-neutral-700 dark:text-neutral-300 truncate">{nameOf(r)}</span>
              <span className="flex items-center gap-1 text-emerald-600"><ThumbsUp className="w-3 h-3" />{r.up}</span>
              <span className="flex items-center gap-1 text-red-500"><ThumbsDown className="w-3 h-3" />{r.down}</span>
            </li>
          ))}
        </ul>
      )}
      {comments.length > 0 && (
        <ul className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          {comments.map((c, i) => (
            <li key={i} className="text-xs">
              <span className="font-bold text-neutral-600 dark:text-neutral-400">{nameOf(c)}</span>
              <span className="text-neutral-400"> · {new Date(c.created_at).toLocaleDateString()}</span>
              <p className="whitespace-pre-line text-neutral-700 dark:text-neutral-300">{c.comment}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
