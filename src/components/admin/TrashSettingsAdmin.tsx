'use client'

import React, { useEffect, useState } from 'react'
import { Loader2, Save, Trash2 } from 'lucide-react'
import { getTrashRetention, saveTrashRetention } from '@/app/actions/admin'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import { DEFAULT_TRASH_HOURS, MAX_TRASH_HOURS, MIN_TRASH_HOURS } from '@/lib/trash/trash'
import { formatDuration } from '@/lib/trash/format'

const P = 'dashboard.projects.studio.trash.'

/** Prazo da lixeira de casos de uso. Fica no painel da plataforma: só o SuperAdmin chega aqui (e a gravação confere isso no servidor). */
export function TrashSettingsAdmin() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [hours, setHours] = useState<string>(String(DEFAULT_TRASH_HOURS))
  const [saved, setSaved] = useState(DEFAULT_TRASH_HOURS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getTrashRetention().then(res => {
      if (res.success && typeof res.hours === 'number') { setHours(String(res.hours)); setSaved(res.hours) }
      setLoading(false)
    })
  }, [])

  const n = Math.round(Number(hours))
  const valid = Number.isFinite(n) && n >= MIN_TRASH_HOURS && n <= MAX_TRASH_HOURS

  const save = async () => {
    if (!valid) return
    setSaving(true)
    const res = await saveTrashRetention(n)
    setSaving(false)
    if (res.success) { setSaved(n); toast(t(P + 'admin_saved'), 'success') }
    else toast(res.error || t(P + 'err_generic'), 'error')
  }

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/40" data-help-id="platform.trash_settings">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-500"><Trash2 className="h-5 w-5" /></div>
        <div className="min-w-0">
          <h3 className="text-base font-black text-neutral-900 dark:text-white">{t(P + 'admin_title')}</h3>
          <p className="mt-1 text-xs text-neutral-500">{t(P + 'admin_desc')}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400">{t(P + 'admin_label')}</span>
          <input
            type="number"
            min={MIN_TRASH_HOURS}
            max={MAX_TRASH_HOURS}
            step={1}
            value={hours}
            disabled={loading}
            onChange={e => setHours(e.target.value)}
            className="w-32 rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm font-bold dark:border-neutral-700"
          />
        </label>
        <button
          type="button"
          disabled={!valid || saving || loading || n === saved}
          onClick={save}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t(P + 'admin_save')}
        </button>
        <span className="pb-2.5 text-xs text-neutral-500">{valid ? `= ${formatDuration(n, t)}` : ''}</span>
      </div>
      <p className="mt-2 text-[11px] text-neutral-400">{t(P + 'admin_hint')}</p>
    </div>
  )
}
