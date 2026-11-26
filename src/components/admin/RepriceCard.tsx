'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Loader2, Megaphone, X } from 'lucide-react'
import { cancelRepriceAction, getRepriceStateAction, scheduleRepriceAction, type RepriceState } from '@/app/actions/priceChange'
import { MIN_INCREASE_NOTICE_DAYS, addDays, validateReprice } from '@/lib/billing/priceChange'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import { dayLocale, localeOf, moneyLocale } from '@/lib/billing/localeFormat'

const todayBR = () => new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)

/** Troca {nome} do texto por valores (texto ou elementos), para poder pôr um trecho em negrito. */
const rich = (tpl: string, vars: Record<string, React.ReactNode>) =>
  tpl.split(/(\{\w+\})/).map((p, i) => {
    const m = /^\{(\w+)\}$/.exec(p)
    return m && m[1] in vars ? <React.Fragment key={i}>{vars[m[1]]}</React.Fragment> : p
  })

/**
 * Reajuste de preço agendado (Regras de Preços > Reajustar): o SuperAdmin informa o valor base novo e em quantos dias ele passa a valer. Os assinantes
 * são avisados por e-mail na hora; o valor novo vale só nas renovações a partir da data (o período já pago não muda) e a regra é aplicada pela rotina diária.
 */
export function RepriceCard() {
  const { toast } = useToast()
  const { t, language } = useI18n()
  const k = (key: string, vars: Record<string, string | number> = {}) => {
    let s = t(`admin_reprice.${key}`)
    for (const [name, v] of Object.entries(vars)) s = s.split(`{${name}}`).join(String(v))
    return s
  }
  const money = (n: number) => moneyLocale(n, language)
  const dmy = (day: string) => dayLocale(day, language)
  const errorText = (code: string | undefined) => k(`err_${code || 'unknown'}`, { n: MIN_INCREASE_NOTICE_DAYS })

  const [state, setState] = useState<RepriceState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [newBase, setNewBase] = useState('')
  const [days, setDays] = useState(String(MIN_INCREASE_NOTICE_DAYS))
  const [confirming, setConfirming] = useState(false)

  const load = useCallback(async () => {
    const r = await getRepriceStateAction()
    if (r.success) setState(r.state)
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  if (loading) return <div className="flex items-center gap-2 p-4 text-xs text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> {k('loading')}</div>
  if (!state) return null

  // sem assinante a avisar, o aumento pode valer na hora (o servidor confere de novo, com a contagem do banco)
  const check = validateReprice({ currentBase: state.currentBase, newBase, days, subscribers: state.subscribers })
  const effective = check.ok ? addDays(todayBR(), check.days) : null
  const problem = newBase.trim() === '' ? '' : check.ok ? '' : errorText(check.code)

  const schedule = async () => {
    setBusy(true)
    const r = await scheduleRepriceAction({ newBase, days })
    setBusy(false)
    setConfirming(false)
    if (r.success) {
      toast(r.appliedNow
        ? k('ok_now', { n: r.notified })
        : k('ok_scheduled', { date: dmy(r.effectiveOn), n: r.notified }), 'success')
      setNewBase('')
      await load()
    } else toast(errorText(r.code), 'error')
  }

  const cancel = async (id: string) => {
    setBusy(true)
    const r = await cancelRepriceAction(id)
    setBusy(false)
    if (r.success) { toast(k('ok_canceled'), 'success'); await load() } else toast(errorText(r.code), 'error')
  }

  return (
    <div data-testid="reprice-card" className="space-y-4 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
        <div>
          <h3 className="font-bold text-neutral-900 dark:text-white">{k('title')}</h3>
          <p className="mt-1 text-xs text-neutral-500">
            {rich(k('desc', { days: state.minNoticeDays }), { b: <strong>{k('desc_b')}</strong> })}
          </p>
        </div>
      </div>

      {state.scheduled ? (
        <div data-testid="reprice-scheduled" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-sm">
            <p className="font-bold text-amber-900 dark:text-amber-300">
              {k('scheduled', { from: money(state.scheduled.oldBase), to: money(state.scheduled.newBase), date: dmy(state.scheduled.effectiveOn) })}
            </p>
            <p className="text-xs text-amber-800/80 dark:text-amber-400/80">
              {k('scheduled_on', { date: new Date(state.scheduled.createdAt).toLocaleDateString(localeOf(language)), days: state.scheduled.noticeDays })}
              {state.scheduled.notifiedAt ? k('notified') : ''}{k('reminder')}
            </p>
          </div>
          <button type="button" disabled={busy} onClick={() => cancel(state.scheduled!.id)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:bg-transparent">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} {k('cancel_btn')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{k('current')}</span>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2 font-bold dark:border-neutral-800 dark:bg-neutral-950">{money(state.currentBase)}</div>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{k('new_value')}</span>
              <input data-testid="reprice-value" type="number" min={0} step="0.01" value={newBase} onChange={e => { setNewBase(e.target.value); setConfirming(false) }} placeholder={k('ph')}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2 font-bold focus:border-indigo-500 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950" />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{k('days_label')}</span>
              <input data-testid="reprice-days" type="number" min={0} max={365} step={1} value={days} onChange={e => { setDays(e.target.value); setConfirming(false) }}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2 font-bold focus:border-indigo-500 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950" />
            </label>
          </div>

          {problem && <p className="text-xs font-bold text-red-600 dark:text-red-400">{problem}</p>}
          {check.ok && effective && (
            <p data-testid="reprice-preview" className="text-xs text-neutral-600 dark:text-neutral-300">
              {rich(k('preview', { kind: check.increase ? k('increase') : k('decrease'), from: money(state.currentBase), to: money(check.newBase) }), {
                date: <strong>{dmy(effective)}</strong>,
                n: <strong>{state.subscribers}</strong>,
              })}
              {check.noticeWaived && k('waived', { n: state.minNoticeDays })}
            </p>
          )}

          {!confirming ? (
            <button type="button" data-testid="reprice-go" disabled={!check.ok || busy} onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-700 disabled:opacity-40">
              <Megaphone className="h-4 w-4" /> {k('go')}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-500/20 dark:bg-indigo-500/5">
              <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200">{k('confirm_q', { n: state.subscribers })}</p>
              <button type="button" disabled={busy} onClick={schedule} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-700 disabled:opacity-50">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {k('confirm_notify')}
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-600 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-300">{k('back')}</button>
            </div>
          )}
        </div>
      )}

      {state.history.length > 0 && (
        <div className="space-y-1 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{k('history')}</p>
          {state.history.map(h => (
            <p key={h.id} className="text-xs text-neutral-600 dark:text-neutral-300">
              {k('history_row', { from: money(h.oldBase), to: money(h.newBase), date: dmy(h.effectiveOn), status: h.status === 'applied' ? k('applied') : k('canceled') })}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
