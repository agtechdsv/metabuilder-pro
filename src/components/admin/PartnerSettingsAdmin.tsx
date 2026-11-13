'use client'

import React, { useEffect, useState } from 'react'
import { ArrowRight, Handshake, Loader2, Save } from 'lucide-react'
import { getPartnerSettings, savePartnerSettings } from '@/app/actions/partners'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import { DEFAULT_PARTNER_SETTINGS, type PartnerSettings } from '@/lib/partners'

// Tela só do SuperAdmin (pt, en e es). Aqui ficam só as REGRAS da comissão (aba Regras de Preços);
// quem são os parceiros, os interessados e os pagamentos ficam na aba Parceiros.

const inputCls = 'w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm font-bold dark:border-neutral-700'
const labelCls = 'mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400'

export function PartnerSettingsAdmin({ onOpenPartnersTab, refreshKey = 0 }: { onOpenPartnersTab: () => void; refreshKey?: number }) {
  const { toast } = useToast()
  const { t } = useI18n()
  const k = (key: string) => t(`admin_partners.${key}`)
  const [settings, setSettings] = useState<PartnerSettings>(DEFAULT_PARTNER_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getPartnerSettings().then(r => {
      if (r.success) setSettings(r.settings)
      else toast(k('err_not_authorized'), 'error')
      setLoading(false)
    })
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true)
    const r = await savePartnerSettings(settings)
    setBusy(false)
    toast(r.success ? k('settings_saved') : k('err_percent_invalid'), r.success ? 'success' : 'error')
  }

  const num = (v: string) => (v === '' ? ('' as unknown as number) : Number(v))

  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/40">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-black"><Handshake className="h-5 w-5 text-indigo-500" />{k('settings_title')}</h3>
        <button type="button" onClick={onOpenPartnersTab} className="flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:underline">{k('settings_link')}<ArrowRight className="h-3.5 w-3.5" /></button>
      </div>
      {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" /></div> : (
        <div className="grid gap-3 rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-950 md:grid-cols-5">
          <label className="block"><span className={labelCls}>{k('settings_percent')}</span>
            <input type="number" min={0} max={100} className={inputCls} value={settings.defaultPercent} onChange={e => setSettings({ ...settings, defaultPercent: num(e.target.value) })} /></label>
          <label className="block"><span className={labelCls}>{k('settings_grace')}</span>
            <input type="number" min={0} max={90} className={inputCls} value={settings.graceDays} onChange={e => setSettings({ ...settings, graceDays: num(e.target.value) })} /></label>
          <label className="block"><span className={labelCls}>{k('settings_min')}</span>
            <input type="number" min={1} className={inputCls} value={settings.minPayout} onChange={e => setSettings({ ...settings, minPayout: num(e.target.value) })} /></label>
          <label className="block"><span className={labelCls}>{k('settings_cap')}</span>
            <input type="number" min={1} className={inputCls} value={settings.payoutCap} onChange={e => setSettings({ ...settings, payoutCap: num(e.target.value) })} /></label>
          <div className="flex items-end"><button type="button" disabled={busy} onClick={save} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-black text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-700"><Save className="h-3.5 w-3.5" />{k('settings_save')}</button></div>
          <p className="text-[10px] text-neutral-400 md:col-span-5">{k('settings_note')}</p>
        </div>
      )}
    </section>
  )
}
