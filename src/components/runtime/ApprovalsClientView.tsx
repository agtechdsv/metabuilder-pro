'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Clock, Ban, Loader2, UserCheck, ArrowLeft } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast'
import { localeOf } from '@/lib/billing/localeFormat'
import { approvalsCall, type ApprovalEvent, type ApprovalTask } from '@/lib/approvalsClient'

type Tab = 'pending' | 'requested' | 'decided' | 'all'

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  cancelled: 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
}

/**
 * "Minhas tarefas": as aprovações que dependem do usuário (e o andamento dos pedidos dele). Quem decide vem da sessão no servidor;
 * o dono do projeto vê ainda a aba "Todas", onde pode cancelar uma tarefa travada.
 */
export function ApprovalsClientView({ projectId, backHref, isAdmin }: { projectId: string; backHref: string; isAdmin: boolean }) {
  const { t, language } = useI18n()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('pending')
  const [tasks, setTasks] = useState<ApprovalTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ApprovalTask | null>(null)
  const [history, setHistory] = useState<ApprovalEvent[]>([])
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(localeOf(language)) : '')
  const statusLabel = (s: string) => t(`approvals.status_${s}`, s)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = tab === 'all'
        ? await approvalsCall<{ tasks: ApprovalTask[] }>(projectId, { op: 'admin_list' })
        : await approvalsCall<{ tasks: ApprovalTask[] }>(projectId, { op: 'list', view: tab })
      setTasks(data?.tasks ?? [])
    } catch (e: any) {
      setTasks([])
      setError(e?.message || t('approvals.load_error', 'Não foi possível carregar as tarefas.'))
    } finally {
      setLoading(false)
    }
  }, [projectId, tab, t])

  useEffect(() => { void load() }, [load])

  const open = async (task: ApprovalTask) => {
    setOpenId(task.id)
    setDetail(task)
    setHistory([])
    setComment('')
    try {
      const d = await approvalsCall<{ tasks: ApprovalTask[] }>(projectId, { op: 'list', taskId: task.id })
      if (d?.tasks?.[0]) setDetail(d.tasks[0])
      if (task.recordPk) {
        const h = await approvalsCall<{ events: ApprovalEvent[] }>(projectId, { op: 'history', table: task.table, pk: task.recordPk })
        setHistory(h?.events ?? [])
      }
    } catch {
      // o resumo da lista já está na tela; o detalhe é um extra
    }
  }

  const close = () => { setOpenId(null); setDetail(null) }

  const decide = async (decision: 'approved' | 'rejected') => {
    if (!detail) return
    if (decision === 'rejected' && !comment.trim()) {
      toast(t('approvals.reject_needs_comment', 'Explique o motivo da rejeição.'), 'error')
      return
    }
    setBusy(true)
    try {
      const r = await approvalsCall<{ warning?: string }>(projectId, { op: 'decide', taskId: detail.id, decision, comment: comment.trim() || undefined })
      toast(decision === 'approved' ? t('approvals.decided_ok_approved', 'Aprovado.') : t('approvals.decided_ok_rejected', 'Rejeitado.'), 'success')
      if (r?.warning) toast(r.warning, 'info')
      close()
      await load()
    } catch (e: any) {
      toast(e?.message || t('approvals.load_error', 'Não foi possível concluir.'), 'error')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (!detail || !window.confirm(t('approvals.cancel_confirm', 'Cancelar esta tarefa? O fluxo não continuará.'))) return
    setBusy(true)
    try {
      await approvalsCall(projectId, { op: 'cancel', taskId: detail.id })
      toast(t('approvals.cancelled_ok', 'Tarefa cancelada.'), 'success')
      close()
      await load()
    } catch (e: any) {
      toast(e?.message || t('approvals.load_error', 'Não foi possível concluir.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'pending', label: t('approvals.tab_pending', 'A decidir') },
    { id: 'requested', label: t('approvals.tab_requested', 'Meus pedidos') },
    { id: 'decided', label: t('approvals.tab_decided', 'Que decidi') },
    ...(isAdmin ? [{ id: 'all' as Tab, label: t('approvals.tab_all', 'Todas (administrador)') }] : []),
  ]
  const canDecide = detail?.status === 'pending' && tab === 'pending'
  const canCancel = detail?.status === 'pending' && tab === 'all'

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-violet-500" />
              {t('approvals.title', 'Minhas tarefas')}
            </h1>
            <p className="text-xs text-neutral-500 mt-1">{t('approvals.subtitle', 'Aprovações que dependem de você e o andamento dos seus pedidos.')}</p>
          </div>
          <a href={backHref} className="text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 shrink-0">
            <ArrowLeft className="w-4 h-4" />
            {t('approvals.back', 'Voltar ao início')}
          </a>
        </div>

        <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-900 p-1 rounded-xl w-fit max-w-full overflow-x-auto">
          {tabs.map(x => (
            <button
              key={x.id}
              onClick={() => { setTab(x.id); close() }}
              className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${tab === x.id ? 'bg-white dark:bg-neutral-800 text-violet-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            {loading && (
              <div className="flex items-center gap-2 text-xs text-neutral-500 p-4"><Loader2 className="w-4 h-4 animate-spin" />{t('approvals.loading', 'Carregando...')}</div>
            )}
            {!loading && error && <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl p-4">{error}</div>}
            {!loading && !error && tasks.length === 0 && (
              <div className="text-xs text-neutral-500 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 text-center">
                {tab === 'pending' ? t('approvals.empty_pending', 'Nenhuma aprovação aguardando você.') : t('approvals.empty_other', 'Nada por aqui.')}
              </div>
            )}
            {!loading && tasks.map(task => (
              <button
                key={task.id}
                onClick={() => open(task)}
                className={`w-full text-left bg-white dark:bg-neutral-900 border rounded-xl p-4 transition-colors hover:border-violet-400 ${openId === task.id ? 'border-violet-500 ring-2 ring-violet-500/20' : 'border-neutral-200 dark:border-neutral-800'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white leading-snug">{task.title}</h3>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[task.status] || ''}`}>{statusLabel(task.status)}</span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  {t('approvals.requested_by', 'Pedido por')} {task.requestedBy || '—'} · {when(task.createdAt)}
                </p>
                {task.summary.length > 0 && (
                  <p className="text-[11px] text-neutral-400 mt-1 truncate">{task.summary.slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
                )}
              </button>
            ))}
          </div>

          {detail && (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-4 h-fit lg:sticky lg:top-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-neutral-900 dark:text-white leading-snug">{detail.title}</h2>
                  <p className="text-[11px] text-neutral-500 mt-1">{t('approvals.requested_by', 'Pedido por')} {detail.requestedBy || '—'} · {when(detail.createdAt)}</p>
                </div>
                <button onClick={close} className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 shrink-0">{t('approvals.close', 'Fechar')}</button>
              </div>

              {detail.status !== 'pending' && (
                <p className="text-xs text-neutral-600 dark:text-neutral-300">
                  <span className={`font-black uppercase tracking-widest text-[10px] px-2 py-0.5 rounded-full mr-2 ${STATUS_STYLE[detail.status] || ''}`}>{statusLabel(detail.status)}</span>
                  {detail.decidedBy ? `${t('approvals.decided_by', 'Decidido por')} ${detail.decidedBy} · ${when(detail.decidedAt)}` : ''}
                  {detail.comment ? <span className="block mt-1 italic">“{detail.comment}”</span> : null}
                </p>
              )}

              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">{t('approvals.record', 'Registro')} · {detail.table}</h4>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs max-h-64 overflow-y-auto">
                  {Object.entries(detail.record ?? Object.fromEntries(detail.summary)).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-neutral-400">{k}</dt>
                      <dd className="text-neutral-800 dark:text-neutral-200 break-words">{v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">{t('approvals.history', 'Histórico')}</h4>
                {history.length === 0 ? (
                  <p className="text-[11px] text-neutral-400">{t('approvals.no_history', 'Sem histórico.')}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {history.map((h, i) => (
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

              {canDecide && (
                <div className="space-y-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">{t('approvals.comment_label', 'Comentário')}</label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder={t('approvals.comment_placeholder', 'Escreva um comentário (obrigatório ao rejeitar)')}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-violet-500 resize-none"
                  />
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={() => decide('approved')} className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2">
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}{t('approvals.approve', 'Aprovar')}
                    </button>
                    <button disabled={busy} onClick={() => decide('rejected')} className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2">
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}{t('approvals.reject', 'Rejeitar')}
                    </button>
                  </div>
                </div>
              )}

              {canCancel && (
                <button disabled={busy} onClick={cancel} className="w-full h-10 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 text-xs font-black uppercase tracking-widest hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50">
                  {t('approvals.cancel_task', 'Cancelar tarefa')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
