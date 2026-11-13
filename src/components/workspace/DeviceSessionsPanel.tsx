'use client'

import { useCallback, useEffect, useState } from 'react'
import { Laptop, Loader2, MonitorSmartphone, RefreshCw } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast'
import { endMyDeviceAction, listMyDevicesAction } from '@/app/actions/deviceSessions'
import { askDialog } from '@/utils/askDialog'
import { placeText } from '@/lib/sessions/slotCore'
import type { DeviceRowDto } from '@/lib/sessions/deviceTypes'
import type { SlotMode } from '@/lib/sessions/slotCore'

/** "Meus dispositivos": as sessões do próprio usuário (IDE e navegador), com a opção de encerrar as outras. */
export function DeviceSessionsPanel() {
  const { t, language } = useI18n()
  const { toast } = useToast()
  const k = (key: string) => t(`device_sessions.${key}`)
  const [devices, setDevices] = useState<DeviceRowDto[] | null>(null)
  const [mode, setMode] = useState<SlotMode>('off')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await listMyDevicesAction()
    if (r.success) { setDevices(r.devices); setMode(r.mode) } else toast(k('mydev_error'), 'error')
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const end = async (id: string) => {
    if (!(await askDialog(k('mydev_end_confirm'), { kind: 'warning' }))) return
    setBusyId(id)
    const r = await endMyDeviceAction(id)
    setBusyId(null)
    if (r.success) { toast(k('mydev_ended'), 'success'); await load() } else toast(k('mydev_error'), 'error')
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString(language)
  const active = (devices || []).filter(d => !d.revoked_at)
  const history = (devices || []).filter(d => d.revoked_at)

  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-6 flex items-start justify-between gap-4 border-b border-neutral-100 pb-6 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10"><MonitorSmartphone className="h-6 w-6" /></div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-wider text-neutral-900 dark:text-white">{k('mydev_title')}</h3>
            <p className="mt-1 text-xs font-medium text-neutral-500">{k('mydev_desc')}</p>
          </div>
        </div>
        <button type="button" onClick={load} disabled={loading} aria-label={k('mydev_refresh')} title={k('mydev_refresh')} className="rounded-xl p-2 text-neutral-400 transition-colors hover:text-indigo-600 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {mode !== 'enforce' && (
        <p className="mb-4 rounded-xl bg-neutral-100 px-4 py-3 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">{k('mydev_off_note')}</p>
      )}

      {loading && !devices ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" /></div>
      ) : active.length === 0 ? (
        <p className="py-4 text-sm text-neutral-500">{k('mydev_empty')}</p>
      ) : (
        <ul className="space-y-3">
          {active.map(d => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-start gap-3">
                <Laptop className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
                <div className="text-sm">
                  <p className="font-bold text-neutral-900 dark:text-white">
                    {k(d.kind === 'ide' ? 'kind_ide' : 'kind_web')} · {d.label || '-'}
                    {d.current && <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{k('mydev_current')}</span>}
                  </p>
                  <p className="text-xs text-neutral-500">{placeText(d, k('chooser_unknown'))}</p>
                  <p className="text-xs text-neutral-400">{k('mydev_since')} {fmt(d.created_at)} · {k('mydev_last')} {fmt(d.last_seen_at)}</p>
                </div>
              </div>
              {!d.current && (
                <button type="button" onClick={() => end(d.id)} disabled={busyId === d.id} className="rounded-xl border border-red-300 px-4 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:hover:bg-red-500/10">
                  {busyId === d.id ? k('mydev_ending') : k('mydev_end')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {history.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-widest text-neutral-400">{k('mydev_history')}</summary>
          <ul className="mt-3 space-y-2">
            {history.map(d => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                <span>{k(d.kind === 'ide' ? 'kind_ide' : 'kind_web')} · {d.label || '-'} ·{placeText(d, k('chooser_unknown'))}</span>
                <span>{d.revoked_at ? fmt(d.revoked_at) : ''} · {k(`mydev_reason_${d.revoked_reason || 'logout'}`)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
