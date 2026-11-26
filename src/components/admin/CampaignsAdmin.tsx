'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Flame, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { deleteCampaign, getIClubSettings, listCampaigns, saveCampaign, saveIClubSettings, type CampaignInput } from '@/app/actions/admin'
import { useToast } from '@/components/ui/Toast'
import { askDialog } from '@/utils/askDialog'
import { campaignOffPercent, localizedText } from '@/lib/campaigns'
import { chargeBreakdown, type Cycle } from '../../../supabase/functions/_shared/pricing'
import { getPricingRules } from '@/app/actions/admin'
import { useI18n } from '@/i18n/I18nContext'
import { localeOf, moneyLocale } from '@/lib/billing/localeFormat'

const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const EMPTY: CampaignInput = {
  name: { pt: '', en: '', es: '' }, headline: { pt: '', en: '', es: '' },
  discount_percent: 50, months: 2, starts_at: '', ends_at: '', is_active: true, allowed_emails: [],
}

const inputCls = 'w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm font-bold dark:border-neutral-700'
const labelCls = 'mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400'

function statusOf(c: any, now = Date.now()): { key: string; cls: string } {
  if (!c.is_active) return { key: 'st_off', cls: 'bg-neutral-200 text-neutral-600' }
  if (new Date(c.ends_at).getTime() < now) return { key: 'st_ended', cls: 'bg-neutral-200 text-neutral-600' }
  if (new Date(c.starts_at).getTime() > now) return { key: 'st_scheduled', cls: 'bg-amber-100 text-amber-700' }
  return { key: 'st_live', cls: 'bg-emerald-100 text-emerald-700' }
}

export function CampaignsAdmin() {
  const { toast } = useToast()
  const { t, language } = useI18n()
  const k = (key: string, vars: Record<string, string | number> = {}) => {
    let out = t('admin_campaigns.' + key)
    for (const [name, v] of Object.entries(vars)) out = out.split('{' + name + '}').join(String(v))
    return out
  }
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<(CampaignInput & { emails: string }) | null>(null)
  const [rules, setRules] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listCampaigns()
    if (res.success) setCampaigns((res as any).campaigns || [])
    else toast(res.error || k('t_load_error'), 'error')
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); getPricingRules().then(r => { if (r.success) setRules(r.rules) }) }, [load])

  const edit = (c?: any) => setForm(c
    ? { id: c.id, name: { pt: c.name?.pt || '', en: c.name?.en || '', es: c.name?.es || '' }, headline: { pt: c.headline?.pt || '', en: c.headline?.en || '', es: c.headline?.es || '' },
        discount_percent: Number(c.discount_percent), months: Number(c.months), starts_at: toLocalInput(c.starts_at), ends_at: toLocalInput(c.ends_at),
        is_active: !!c.is_active, allowed_emails: c.allowed_emails || [], emails: (c.allowed_emails || []).join(', ') }
    : { ...EMPTY, emails: '' })

  const save = async () => {
    if (!form) return
    setSaving(true)
    const { emails, ...input } = form
    const res = await saveCampaign({ ...input, allowed_emails: emails.split(/[,\s;]+/).filter(Boolean) })
    setSaving(false)
    if (res.success) { toast(k('t_saved'), 'success'); setForm(null); load() }
    else toast(res.error || k('t_save_error'), 'error')
  }

  const remove = async (c: any) => {
    if (!(await askDialog(k('delete_confirm', { name: localizedText(c.name, language) }), { kind: 'warning', okLabel: k('delete_ok'), cancelLabel: k('cancel') }))) return
    const res = await deleteCampaign(c.id)
    if (res.success) { toast(k('t_deleted'), 'success'); load() } else toast(res.error || k('t_delete_error'), 'error')
  }

  // prévia com a tabela de preços atual: 1 licença em cada ciclo (a mesma conta que o checkout usa)
  const preview = form && rules && Number(form.discount_percent) > 0 && Number(form.months) > 0
    ? (['monthly', 'semiannual', 'yearly'] as Cycle[]).map(cycle => ({
        cycle,
        first: chargeBreakdown({ rules, licenses: 1, cycle, campaign: { percent: Number(form.discount_percent), months: Number(form.months), licenses: 1 } }).total,
        regular: chargeBreakdown({ rules, licenses: 1, cycle }).total,
      }))
    : null
  const money = (n: number) => moneyLocale(n, language)
  const cycleName: Record<string, string> = { monthly: k('cycle_monthly'), semiannual: k('cycle_semiannual'), yearly: k('cycle_yearly') }
  const locale = localeOf(language)

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/40" data-help-id="platform.campaigns">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-500"><Flame className="h-5 w-5" /></div>
          <div className="min-w-0">
            <h3 className="text-base font-black text-neutral-900 dark:text-white">{k('title')}</h3>
            <p className="mt-1 text-xs text-neutral-500">{k('desc')}</p>
          </div>
        </div>
        {!form && (
          <button type="button" onClick={() => edit()} className="flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-500"><Plus className="h-4 w-4" /> {k('new_campaign')}</button>
        )}
      </div>

      {form && (
        <div className="mt-5 space-y-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="grid gap-3 md:grid-cols-3">
            {(['pt', 'en', 'es'] as const).map(l => (
              <label key={l} className="block"><span className={labelCls}>{k('name_lang', { lang: l })}</span>
                <input className={inputCls} value={form.name[l]} onChange={e => setForm({ ...form, name: { ...form.name, [l]: e.target.value } })} placeholder={l === language ? 'Black November' : ''} /></label>
            ))}
            {(['pt', 'en', 'es'] as const).map(l => (
              <label key={'h' + l} className="block"><span className={labelCls}>{k('headline_lang', { lang: l })}</span>
                <input className={inputCls} value={form.headline[l]} onChange={e => setForm({ ...form, headline: { ...form.headline, [l]: e.target.value } })} placeholder={l === language ? k('ph_headline') : ''} /></label>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="block"><span className={labelCls}>{k('pct_charged')}</span>
              <input type="number" min={1} max={100} className={inputCls} value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: Number(e.target.value) })} />
              <span className="mt-1 block text-[10px] text-neutral-400">{k('pct_hint', { off: campaignOffPercent({ discount_percent: form.discount_percent }) })}</span></label>
            <label className="block"><span className={labelCls}>{k('months')}</span>
              <input type="number" min={1} max={36} className={inputCls} value={form.months} onChange={e => setForm({ ...form, months: Number(e.target.value) })} /></label>
            <label className="block"><span className={labelCls}>{k('start')}</span>
              <input type="datetime-local" className={inputCls} value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></label>
            <label className="block"><span className={labelCls}>{k('end')}</span>
              <input type="datetime-local" className={inputCls} value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></label>
          </div>
          <label className="block"><span className={labelCls}>{k('emails_label')}</span>
            <input className={inputCls} value={form.emails} onChange={e => setForm({ ...form, emails: e.target.value })} placeholder={k('emails_ph')} />
            <span className="mt-1 block text-[10px] text-neutral-400">{k('emails_hint')}</span></label>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> {k('active')}</label>

          {preview && (
            <div className="rounded-xl bg-neutral-50 p-3 text-xs dark:bg-neutral-950">
              <p className="mb-1 font-black uppercase tracking-widest text-neutral-400">{k('preview_title')}</p>
              {preview.map(p => (
                <p key={p.cycle} className="font-bold text-neutral-700 dark:text-neutral-200">{cycleName[p.cycle]}: <span className="text-emerald-600">{money(p.first)}</span> <span className="text-neutral-400">({k('without_campaign')}: {money(p.regular)})</span></p>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" disabled={saving} onClick={save} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-500 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {k('save')}
            </button>
            <button type="button" onClick={() => setForm(null)} className="flex items-center gap-2 rounded-xl bg-neutral-100 px-4 py-2 text-xs font-black text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200"><X className="h-4 w-4" /> {k('cancel')}</button>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-2">
        {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-neutral-400" />
          : campaigns.length === 0 ? <p className="py-4 text-center text-sm text-neutral-400">{k('empty')}</p>
          : campaigns.map(c => {
            const st = statusOf(c)
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-neutral-900 dark:text-white">{localizedText(c.name, language)} <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-black ${st.cls}`}>{k(st.key)}</span>
                    {c.allowed_emails?.length > 0 && <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-black text-indigo-700">{k('restricted', { n: c.allowed_emails.length })}</span>}</p>
                  <p className="text-[11px] text-neutral-500">{k('summary', { off: campaignOffPercent(c), months: c.months, from: new Date(c.starts_at).toLocaleString(locale), to: new Date(c.ends_at).toLocaleString(locale) })}</p>
                </div>
                <button type="button" onClick={() => edit(c)} className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-100 hover:text-indigo-600 dark:hover:bg-neutral-800" aria-label={k('edit')}><Pencil className="h-4 w-4" /></button>
                <button type="button" onClick={() => remove(c)} className="rounded-xl p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30" aria-label={k('delete')}><Trash2 className="h-4 w-4" /></button>
              </div>
            )
          })}
      </div>
    </div>
  )
}

/** Teto e carência do desconto de indicação do iClub. */
export function IClubSettingsAdmin() {
  const { toast } = useToast()
  const { t } = useI18n()
  const [cap, setCap] = useState('30')
  const [grace, setGrace] = useState('7')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getIClubSettings().then(r => { if (r.success) { setCap(String((r as any).capPercent)); setGrace(String((r as any).graceDays)) } setLoading(false) })
  }, [])

  const save = async () => {
    setSaving(true)
    const res = await saveIClubSettings(Number(cap), Number(grace))
    setSaving(false)
    if (res.success) toast(t('admin_campaigns.ic_saved'), 'success'); else toast(res.error || t('admin_campaigns.t_save_error'), 'error')
  }

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/40" data-help-id="platform.iclub_settings">
      <h3 className="text-base font-black text-neutral-900 dark:text-white">{t('admin_campaigns.ic_title')}</h3>
      <p className="mt-1 text-xs text-neutral-500">{t('admin_campaigns.ic_desc')}</p>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="block"><span className={labelCls}>{t('admin_campaigns.ic_cap')}</span>
          <input type="number" min={0} max={100} disabled={loading} className={inputCls + ' w-32'} value={cap} onChange={e => setCap(e.target.value)} /></label>
        <label className="block"><span className={labelCls}>{t('admin_campaigns.ic_grace')}</span>
          <input type="number" min={0} max={60} disabled={loading} className={inputCls + ' w-32'} value={grace} onChange={e => setGrace(e.target.value)} /></label>
        <button type="button" disabled={saving || loading} onClick={save} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-500 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('admin_campaigns.ic_save')}
        </button>
      </div>
    </div>
  )
}
