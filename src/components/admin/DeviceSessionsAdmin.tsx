'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, MonitorSmartphone, RefreshCw, Save } from 'lucide-react'
import { adminDeviceOverviewAction, adminRevokeDeviceAction, adminRevokeDevicesAction, adminSaveDeviceSettingsAction } from '@/app/actions/deviceSessions'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import { askDialog } from '@/utils/askDialog'
import { SectionToggle } from './SectionToggle'
import { placeText } from '@/lib/sessions/slotCore'
import { DEFAULT_DEVICE_SETTINGS, type AdminDeviceOverview, type DeviceErrorCode, type DeviceSettingsDto } from '@/lib/sessions/deviceTypes'

// Tela só do SuperAdmin, em pt, en e es (textos em `admin_devices.*`).

const inputCls = 'w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm font-bold dark:border-neutral-700'
const labelCls = 'mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400'

const MODES: DeviceSettingsDto['mode'][] = ['off', 'observe', 'enforce']

export function DeviceSessionsAdmin({ refreshKey = 0 }: { refreshKey?: number } = {}) {
  const { toast } = useToast()
  const { t, language } = useI18n()
  const k = (key: string, vars?: Record<string, string | number>) => {
    let s = t(`admin_devices.${key}`)
    for (const [name, v] of Object.entries(vars || {})) s = s.split(`{${name}}`).join(String(v))
    return s
  }
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR'
  const when = (iso: string) => new Date(iso).toLocaleString(locale)
  const kindLabel = (kind: string | null) => k(kind === 'ide' ? 'kind_ide' : 'kind_web')
  const errText = (code: DeviceErrorCode) => (code === 'forbidden' || code === 'invalid_settings' ? k(`err_${code}`) : code === 'cannot_end_current' ? k('err_cannot_end') : k('err_unknown'))
  /** O conflito pode ser uma 2ª máquina tentando entrar ou a mesma sessão de login aparecendo em outro dispositivo (cookies copiados?). */
  const eventLabel = (e: { event: string; meta: Record<string, unknown> }) =>
    e.event === 'conflict' && e.meta?.reason === 'same_session_other_device' ? k('ev_same_session')
      : ['takeover', 'conflict', 'cap_reached', 'code_failed'].includes(e.event) ? k(`ev_${e.event}`) : e.event

  const [overview, setOverview] = useState<AdminDeviceOverview | null>(null)
  const [settings, setSettings] = useState<DeviceSettingsDto>(DEFAULT_DEVICE_SETTINGS)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // o grupo do SuperAdmin raramente é mexido: começa recolhido; o dos demais usuários, aberto
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ super: true })

  const load = useCallback(async () => {
    setLoading(true)
    const r = await adminDeviceOverviewAction()
    if (r.success) { setOverview(r.overview); setSettings(r.overview.settings); setError(null) }
    else setError(errText(r.code))
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])
  // botão de atualizar do painel (topo): recarrega esta tela também
  useEffect(() => { if (refreshKey > 0) load() }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (settings.mode === 'enforce' && overview?.settings.mode !== 'enforce') {
      const ok = await askDialog(k('enforce_confirm'), { kind: 'warning', okLabel: k('enable'), cancelLabel: k('cancel') })
      if (!ok) return
    }
    setBusy(true)
    const r = await adminSaveDeviceSettingsAction(settings)
    setBusy(false)
    if (r.success) { toast(k('saved'), 'success'); await load() }
    else toast(errText(r.code), 'error')
  }

  const revoke = async (id: string, who: string) => {
    if (!(await askDialog(k('revoke_confirm', { who }), { kind: 'warning', okLabel: k('end_btn'), cancelLabel: k('cancel') }))) return
    const r = await adminRevokeDeviceAction(id)
    if (r.success) { toast(k('revoked'), 'success'); await load() } else toast(errText(r.code), 'error')
  }

  /** Encerra todas as sessões de um grupo, menos a desta tela. */
  const endAll = async (key: string, rows: { id: string; isCurrent?: boolean }[]) => {
    const ids = rows.filter(r => !r.isCurrent).map(r => r.id)
    if (!ids.length) return
    if (!(await askDialog(k(key === 'super' ? 'end_all_confirm_super' : 'end_all_confirm_users', { n: ids.length }), { kind: 'warning', okLabel: k('end_all_btn'), cancelLabel: k('cancel') }))) return
    const r = await adminRevokeDevicesAction(ids)
    if (r.success) { toast(k('ended_n', { n: r.ended }), 'success'); await load() } else toast(errText(r.code), 'error')
  }

  const num = (v: string) => Math.trunc(Number(v) || 0)

  return (
    <section className="space-y-6 rounded-[2rem] border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-4">
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="device-sessions-body" className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10"><MonitorSmartphone className="h-6 w-6" /></div>
          <div className="min-w-0">
            <h3 className="text-lg font-black uppercase tracking-wider">{k('title')}</h3>
            <p className="mt-1 text-xs font-medium text-neutral-500">{k('subtitle')}</p>
          </div>
        </button>
        {/* resumo só com o cartão recolhido: o modo em vigor e quantas sessões estão ativas, sem abrir */}
        {!open && overview && <span className={`mt-3 shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${overview.settings.mode === 'enforce' ? 'bg-indigo-500/10 text-indigo-600' : 'bg-neutral-500/10 text-neutral-500'}`}>{k(`mode_${overview.settings.mode}`)} · {overview.totals.active} {k('stat_active')}</span>}
        <div className="flex shrink-0 items-center">
          {open && (
            <button type="button" onClick={load} disabled={loading} title={k('refresh')} aria-label={k('refresh')} className="rounded-xl p-2 text-neutral-400 hover:text-indigo-600 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          <SectionToggle open={open} onToggle={() => setOpen(o => !o)} controls="device-sessions-body" />
        </div>
      </div>

      {/* erro de carga aparece mesmo recolhido, para não ficar escondido */}
      {error && <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {open && loading && !overview && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" /></div>}

      {open && overview && (
        <div id="device-sessions-body" className="space-y-6">
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-4">
              <span className={labelCls}>{k('mode')}</span>
              <div className="grid gap-3 md:grid-cols-3">
                {MODES.map(m => (
                  <label key={m} className={`cursor-pointer rounded-2xl border p-4 text-sm transition-colors ${settings.mode === m ? 'border-indigo-500 bg-indigo-500/5' : 'border-neutral-200 dark:border-neutral-800'}`}>
                    <input type="radio" name="device-mode" className="mr-2" checked={settings.mode === m} onChange={() => setSettings(s => ({ ...s, mode: m }))} />
                    <span className="font-black">{k(`mode_${m}`)}</span>
                    <span className="mt-1 block text-xs text-neutral-500">{k(`mode_${m}_hint`)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div><label className={labelCls}>{k('idle')}</label><input className={inputCls} type="number" min={1} max={1440} value={settings.idleMinutes} onChange={e => setSettings(s => ({ ...s, idleMinutes: num(e.target.value) }))} /></div>
            <div><label className={labelCls}>{k('cap')}</label><input className={inputCls} type="number" min={1} max={50} value={settings.takeoverCap} onChange={e => setSettings(s => ({ ...s, takeoverCap: num(e.target.value) }))} /></div>
            <div><label className={labelCls}>{k('ttl')}</label><input className={inputCls} type="number" min={10} max={600} value={settings.ttlSeconds} onChange={e => setSettings(s => ({ ...s, ttlSeconds: num(e.target.value) }))} /></div>
            <div className="flex items-end">
              <button type="button" onClick={save} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {k('save')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {([
              ['stat_active', overview.totals.active], ['stat_ide', overview.totals.ide], ['stat_web', overview.totals.web],
              ['stat_takeovers', overview.totals.takeovers7d], ['stat_conflicts', overview.totals.conflicts7d], ['stat_caps', overview.totals.caps7d],
            ] as [string, number][]).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-2xl font-black">{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{k(key)}</p>
              </div>
            ))}
          </div>

          <div>
            <h4 className="mb-3 text-sm font-black uppercase tracking-widest">{k('swappers_title')}</h4>
            {overview.swappers.length === 0 ? <p className="text-sm text-neutral-500">{k('nothing')}</p> : (
              <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-[10px] uppercase tracking-widest text-neutral-400"><tr><th className="py-2">{k('th_user')}</th><th>{k('th_takeovers')}</th><th>{k('th_conflicts')}</th><th>{k('th_caps')}</th></tr></thead>
                <tbody>{overview.swappers.map(s => (
                  <tr key={s.user_id} className={`border-t border-neutral-100 dark:border-neutral-800 ${s.caps > 0 ? 'bg-amber-500/5' : ''}`}>
                    <td className="py-2 font-semibold">{s.email || s.user_id}</td><td>{s.takeovers}</td><td>{s.conflicts}</td><td>{s.caps}</td>
                  </tr>))}</tbody></table></div>
            )}
          </div>

          <div>
            <h4 className="mb-3 text-sm font-black uppercase tracking-widest">{k('active_title')}</h4>
            {overview.active.length === 0 ? <p className="text-sm text-neutral-500">{k('none_active')}</p> : (
              <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-[10px] uppercase tracking-widest text-neutral-400"><tr><th className="py-2">{k('th_user')}</th><th>{k('th_type')}</th><th>{k('th_device')}</th><th>{k('th_where')}</th><th>{k('th_since')}</th><th>{k('th_last')}</th><th /></tr></thead>
                <tbody>{(() => {
                  const hasSuper = overview.active.some(x => x.exempt)
                  const groups = hasSuper
                    ? [{ key: 'super', rows: overview.active.filter(x => x.exempt) }, { key: 'users', rows: overview.active.filter(x => !x.exempt) }]
                    : [{ key: 'users', rows: overview.active }]
                  return groups.map(g => (
                  <React.Fragment key={g.key}>
                  {hasSuper && (
                    <tr><td colSpan={7} className="pb-1 pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <button type="button" onClick={() => setCollapsed(c => ({ ...c, [g.key]: !c[g.key] }))} aria-expanded={!collapsed[g.key]}
                          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
                          {collapsed[g.key] ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          {k(g.key === 'super' ? 'group_super' : 'group_users')} ({g.rows.length})
                        </button>
                        {g.rows.some(r => !r.isCurrent) && (
                          <button type="button" onClick={() => endAll(g.key, g.rows)}
                            className="rounded-lg border border-red-300 px-3 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:hover:bg-red-500/10">
                            {k('end_all_btn')} ({g.rows.filter(r => !r.isCurrent).length})
                          </button>
                        )}
                      </div>
                    </td></tr>
                  )}
                  {!collapsed[g.key] && g.rows.map(a => (
                  <tr key={a.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="py-2 font-semibold">{a.email || a.user_id}{a.exempt && <span className="ml-2 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-black uppercase text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">{k('super_tag')}</span>}</td><td>{kindLabel(a.kind)}</td><td>{a.label || '-'}</td><td>{placeText(a, '-')}</td><td>{when(a.created_at)}</td><td>{when(a.last_seen_at)}{Date.now() - new Date(a.last_seen_at).getTime() > overview.settings.idleMinutes * 60_000 && <span className="mt-0.5 block text-[10px] font-bold text-amber-600 dark:text-amber-400">{k(a.exempt ? 'idle_tag_super' : 'idle_tag')}</span>}</td>
                    <td className="text-right">{a.isCurrent
                      ? <span className="text-[10px] font-black uppercase text-neutral-400">{k('current_tag')}</span>
                      : <button type="button" onClick={() => revoke(a.id, a.email || a.user_id)} className="rounded-lg border border-red-300 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:hover:bg-red-500/10">{k('end_btn')}</button>}</td>
                  </tr>))}
                  </React.Fragment>))
                })()}</tbody></table></div>
            )}
          </div>

          <div>
            <h4 className="mb-3 text-sm font-black uppercase tracking-widest">{k('events_title')}</h4>
            {overview.events.length === 0 ? <p className="text-sm text-neutral-500">{k('none_events')}</p> : (
              <div className="max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white text-[10px] uppercase tracking-widest text-neutral-400 dark:bg-neutral-900"><tr><th className="py-2">{k('th_when')}</th><th>{k('th_event')}</th><th>{k('th_user')}</th><th>{k('th_type')}</th><th>{k('th_device')}</th><th>{k('th_where')}</th></tr></thead>
                <tbody>{overview.events.map(e => (
                  <tr key={e.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="py-2">{when(e.created_at)}</td><td className="font-semibold">{eventLabel(e)}</td><td>{e.email || e.user_id}</td><td>{kindLabel(e.kind)}</td><td>{e.label || '-'}</td><td>{placeText(e, '-')}</td>
                  </tr>))}</tbody></table></div>
            )}
          </div>
        </>
        </div>
      )}
    </section>
  )
}
