'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { BellRing, Loader2, RefreshCw, Save } from 'lucide-react'
import { getBillingNoticesAdmin, saveBillingNoticesSettings } from '@/app/actions/billingNotices'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import { askDialog } from '@/utils/askDialog'
import type { BillingAdminOverview, BillingErrorCode } from '@/lib/billing/notice'

const inputCls = 'w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm font-bold dark:border-neutral-700'
const labelCls = 'mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400'

/** Avisos de cobrança (e-mail e tela) feitos pelo MetaBuilder: interruptor, carência antes de suspender e e-mail dos alertas ao admin. Só o SuperAdmin. */
export function BillingNoticesAdmin({ refreshKey = 0 }: { refreshKey?: number } = {}) {
  const { t, language } = useI18n()
  const { toast } = useToast()
  const k = (key: string) => t(`admin_billing.${key}`)
  const errText = (code: BillingErrorCode) => k(`err_${code}`)
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR'

  const [overview, setOverview] = useState<BillingAdminOverview | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [graceDays, setGraceDays] = useState('3')
  const [adminEmail, setAdminEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await getBillingNoticesAdmin()
    if (r.success) {
      setOverview(r.overview); setEnabled(r.overview.settings.enabled); setGraceDays(String(r.overview.settings.graceDays)); setAdminEmail(r.overview.settings.adminEmail); setError(null)
    } else setError(errText(r.code))
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])
  useEffect(() => { if (refreshKey > 0) load() }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (enabled && !overview?.settings.enabled) {
      const ok = await askDialog(k('enable_confirm'), { kind: 'warning', okLabel: k('enable'), cancelLabel: k('cancel') })
      if (!ok) return
    }
    setBusy(true)
    const r = await saveBillingNoticesSettings({ enabled, graceDays: Number(graceDays), adminEmail })
    setBusy(false)
    if (r.success) { toast(k('saved'), 'success'); await load() } else toast(errText(r.code), 'error')
  }

  return (
    <section className="space-y-5 rounded-[2rem] border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10"><BellRing className="h-6 w-6" /></div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-wider">{k('title')}</h3>
            <p className="mt-1 text-xs font-medium text-neutral-500">{k('subtitle')}</p>
          </div>
        </div>
        <button type="button" onClick={load} disabled={loading} title={k('refresh')} aria-label={k('refresh')} className="rounded-xl p-2 text-neutral-400 hover:text-indigo-600 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {loading && !overview && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" /></div>}

      {overview && (
        <>
          <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm transition-colors ${enabled ? 'border-emerald-500 bg-emerald-500/5' : 'border-neutral-200 dark:border-neutral-800'}`}>
            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
            <span><span className="block font-black">{k(enabled ? 'on' : 'off')}</span><span className="mt-1 block text-xs text-neutral-500">{k(enabled ? 'on_hint' : 'off_hint')}</span></span>
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <div><label className={labelCls}>{k('grace')}</label><input className={inputCls} type="number" min={0} max={30} value={graceDays} onChange={e => setGraceDays(e.target.value)} />
              <p className="mt-1 text-[10px] text-neutral-400">{k('grace_hint')}</p></div>
            <div className="md:col-span-2"><label className={labelCls}>{k('admin_email')}</label><input className={inputCls} type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder={k('admin_email_ph')} />
              <p className="mt-1 text-[10px] text-neutral-400">{k('admin_email_hint')}</p></div>
          </div>

          <button type="button" onClick={save} disabled={busy} className="flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {k('save')}
          </button>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {([['stat_queued', overview.stats.queued], ['stat_sent', overview.stats.sent7d], ['stat_failed', overview.stats.failed]] as [string, number][]).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
                <p className={`text-2xl font-black ${key === 'stat_failed' && value > 0 ? 'text-red-600' : ''}`}>{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{k(key)}</p>
              </div>
            ))}
            <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm font-black">{overview.stats.lastSentAt ? new Date(overview.stats.lastSentAt).toLocaleString(locale) : '-'}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{k('stat_last')}</p>
            </div>
          </div>
          <p className="text-[11px] text-neutral-500">{k('cadence')}</p>
        </>
      )}
    </section>
  )
}
