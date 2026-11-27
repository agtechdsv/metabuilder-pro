'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { UserCheck, Loader2, CheckCircle2, XCircle, Ban, Clock, X } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { localeOf } from '@/lib/billing/localeFormat'
import { approvalsCall, type ApprovalEvent } from '@/lib/approvalsClient'

/**
 * Botão "Aprovações" do cabeçalho do registro: abre a linha do tempo (quem pediu, aprovou ou rejeitou, quando e com qual comentário).
 * Só aparece nos apps com o bloco "Aguardar aprovação" em algum fluxo ativo. A janela sai do formulário (portal) porque a gaveta
 * do registro tem transformação e prenderia uma janela fixa.
 */
export function ApprovalHistoryButton({ projectId, table, pk }: { projectId: string; table: string; pk: string | number }) {
  const { t, language } = useI18n()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [events, setEvents] = useState<ApprovalEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  const show = async () => {
    setOpen(true)
    setLoading(true)
    setError(null)
    try {
      const d = await approvalsCall<{ events: ApprovalEvent[] }>(projectId, { op: 'history', table, pk: String(pk) })
      setEvents(d?.events ?? [])
    } catch (e: any) {
      setEvents([])
      setError(e?.message || t('approvals.load_error', 'Não foi possível carregar.'))
    } finally {
      setLoading(false)
    }
  }

  const when = (iso: string) => new Date(iso).toLocaleString(localeOf(language))

  return (
    <>
      <button
        type="button"
        onClick={show}
        title={t('approvals.history_button', 'Histórico de aprovações')}
        className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs tracking-wider text-violet-600 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 transition-colors"
      >
        <UserCheck className="w-4 h-4" />
        {t('approvals.history_button', 'Histórico de aprovações')}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md max-h-[80vh] overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-neutral-900 dark:text-white">{t('approvals.history_button', 'Histórico de aprovações')}</h3>
              <button type="button" onClick={() => setOpen(false)} className="p-1 text-neutral-400 hover:text-neutral-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            {loading && <div className="flex items-center gap-2 text-xs text-neutral-500"><Loader2 className="w-4 h-4 animate-spin" />{t('approvals.loading', 'Carregando...')}</div>}
            {!loading && error && <p className="text-xs text-red-600">{error}</p>}
            {!loading && !error && events.length === 0 && <p className="text-xs text-neutral-500">{t('approvals.no_history', 'Sem histórico.')}</p>}
            {!loading && events.length > 0 && (
              <ul className="space-y-3">
                {events.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    {h.event === 'approved' ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : h.event === 'rejected' ? <XCircle className="w-4 h-4 text-red-500 shrink-0" /> : h.event === 'cancelled' ? <Ban className="w-4 h-4 text-neutral-400 shrink-0" /> : <Clock className="w-4 h-4 text-amber-500 shrink-0" />}
                    <span className="text-neutral-700 dark:text-neutral-300">
                      <b>{t(`approvals.event_${h.event}`, h.event)}</b>{h.by ? ` · ${h.by}` : ''} · {when(h.at)}
                      {h.comment ? <span className="block text-neutral-500 italic">“{h.comment}”</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
