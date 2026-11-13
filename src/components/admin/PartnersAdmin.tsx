'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Handshake, Inbox, Loader2, Pencil, Plus, Save, Send, Trash2, X } from 'lucide-react'
import {
  decidePartnerApplication, deletePartnerApplication, getPartnerNotifyEmail, listPartnerApplications, rejectPartnerApplication, savePartnerNotifyEmail, sendPartnerWelcome,
} from '@/app/actions/partnerApplications'
import { suggestPartnerCode, type ActionCode, type ApplicationRow } from '@/lib/partnerApplications'
import {
  createPartnerPayout, deletePartner, getPartnerSettings, listPartnerPayouts, listPartners, releaseStuckPayoutItem, savePartner,
} from '@/app/actions/partners'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import { askDialog } from '@/utils/askDialog'
import { DEFAULT_PARTNER_SETTINGS, type PartnerErrorCode, type PartnerInput, type PartnerRow, type PartnerSettings, type PayoutRow } from '@/lib/partners'
import { PIX_KEY_TYPES } from '../../../supabase/functions/_shared/partnerCommission'

// Tela só do SuperAdmin, em pt, en e es (textos em `admin_partners.*`). Quem paga, quanto e quando é decisão do SuperAdmin.

const inputCls = 'w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm font-bold dark:border-neutral-700'
const labelCls = 'mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400'

const EMPTY: PartnerInput = { userEmail: '', name: '', document: '', pixKey: '', pixKeyType: 'CPF', code: '', commissionPercent: null, status: 'active', notes: '' }

export function PartnersAdmin({ onNewApplications }: { onNewApplications?: (count: number) => void } = {}) {
  const { toast } = useToast()
  const { t, language } = useI18n()
  /** texto da tela; {chave} no texto é trocado pelos valores */
  const k = (key: string, vars?: Record<string, string | number>) => {
    let s = t(`admin_partners.${key}`)
    for (const [name, v] of Object.entries(vars || {})) s = s.split(`{${name}}`).join(String(v))
    return s
  }
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR'
  const money = (n: number) => n.toLocaleString(locale, { style: 'currency', currency: 'BRL' })
  const when = (iso: string) => new Date(iso).toLocaleString(locale)
  const errText = (r: { code: PartnerErrorCode | ActionCode; error?: string }) => k(`err_${r.code}`) + (r.code === 'unknown' && r.error ? ` (${r.error})` : '')

  const [settings, setSettings] = useState<PartnerSettings>(DEFAULT_PARTNER_SETTINGS)
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [payouts, setPayouts] = useState<PayoutRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<PartnerInput | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [note, setNote] = useState('')
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [showDecided, setShowDecided] = useState(false)
  const [notifyEmail, setNotifyEmail] = useState('')
  /** candidatura que está sendo aprovada: ao salvar o parceiro, ela é marcada como aprovada */
  const [approvingId, setApprovingId] = useState<string | null>(null)
  /** avisar o parceiro novo por e-mail (marcada de início) */
  const [notifyPartner, setNotifyPartner] = useState(true)
  /** candidatura em recusa: mostra a confirmação com a caixa de avisar (desmarcada de início) */
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [notifyReject, setNotifyReject] = useState(false)

  const saveNotify = async () => {
    setBusy(true)
    const r = await savePartnerNotifyEmail(notifyEmail)
    setBusy(false)
    toast(r.success ? k(notifyEmail.trim() ? 'notify_saved' : 'notify_reset') : errText(r), r.success ? 'success' : 'error')
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [s, p, o, a, n] = await Promise.all([getPartnerSettings(), listPartners(), listPartnerPayouts(), listPartnerApplications(), getPartnerNotifyEmail()])
    if (n.success) setNotifyEmail(n.email)
    if (s.success) setSettings(s.settings)
    if (p.success) setPartners(p.partners)
    if (o.success) setPayouts(o.payouts)
    if (a.success) setApplications(a.applications)
    if (!s.success) toast(errText(s), 'error')
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const savePartnerForm = async () => {
    if (!form) return
    setBusy(true)
    const r = await savePartner(form)
    setBusy(false)
    if (!r.success) { toast(errText(r), 'error'); return }
    if (approvingId) await decidePartnerApplication(approvingId, 'approved', r.id)
    // parceiro novo: manda o e-mail de boas-vindas (se a caixa estiver marcada). Se o e-mail falhar, o parceiro já está salvo.
    if (!form.id && notifyPartner) {
      const w = await sendPartnerWelcome(r.id, approvingId)
      toast(w.success && w.mailed ? k('partner_saved_mailed') : k('partner_saved_mail_failed'), w.success && w.mailed ? 'success' : 'info')
    } else toast(k('partner_saved'), 'success')
    setForm(null)
    setApprovingId(null)
    load()
  }

  // aprovar = abrir o cadastro do parceiro já preenchido com o que a pessoa informou (conferir, ajustar e salvar)
  const approve = (a: ApplicationRow) => {
    setApprovingId(a.id)
    setNotifyPartner(true)
    setForm({ ...EMPTY, userEmail: a.email, name: a.name, code: suggestPartnerCode(a.name), notes: [a.company, a.audience].filter(Boolean).join(' | ') })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const decide = async (id: string, status: 'new') => {
    const r = await decidePartnerApplication(id, status)
    toast(r.success ? k('app_reopened') : errText(r), r.success ? 'success' : 'error')
    load()
  }
  const removePartner = async (p: PartnerRow) => {
    if (!(await askDialog(k('delete_partner_confirm', { name: p.name }), { kind: 'warning', okLabel: k('delete'), cancelLabel: k('cancel') }))) return
    setBusy(true)
    const r = await deletePartner(p.id)
    setBusy(false)
    if (!r.success) { toast(errText(r), 'error'); load(); return }
    toast(k('partner_deleted'), 'success')
    setForm(null); setApprovingId(null)
    load()
  }
  const confirmReject = async (id: string) => {
    setBusy(true)
    const r = await rejectPartnerApplication(id, notifyReject)
    setBusy(false)
    setRejectingId(null)
    if (!r.success) { toast(errText(r), 'error'); return }
    toast(!notifyReject ? k('app_rejected') : k(r.mailed ? 'app_rejected_mailed' : 'app_rejected_mail_failed'), notifyReject && !r.mailed ? 'info' : 'success')
    load()
  }
  const removeApplication = async (a: ApplicationRow) => {
    if (!(await askDialog(k('app_delete_confirm', { name: a.name }), { kind: 'warning', okLabel: k('delete'), cancelLabel: k('cancel') }))) return
    const r = await deletePartnerApplication(a.id)
    toast(r.success ? k('app_deleted') : errText(r), r.success ? 'success' : 'error')
    load()
  }
  const newApps = applications.filter(a => a.status === 'new')
  // avisa a aba "Parceiros" quantas candidaturas novas existem (contador no rótulo da aba)
  useEffect(() => { onNewApplications?.(newApps.length) }, [newApps.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const shownApps = showDecided ? applications : newApps

  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  // o que o lote pagaria agora (mesma conta do SQL; a função SQL é quem decide de verdade)
  const plan = useMemo(() => partners.filter(p => selected.has(p.id)).map(p => {
    const reason = p.status !== 'active' ? 'suspended' : !p.pixKey ? 'no_pix' : p.summary.payable < settings.minPayout ? 'below_min' : null
    return { p, reason }
  }), [partners, selected, settings.minPayout])
  const payable = plan.filter(x => !x.reason)
  const total = payable.reduce((s, x) => s + x.p.summary.payable, 0)

  const send = async () => {
    setBusy(true)
    const r = await createPartnerPayout(payable.map(x => x.p.id), note)
    setBusy(false)
    setConfirming(false)
    if (!r.success) { toast(errText(r), 'error'); load(); return }
    toast(k('batch_created', { total: money(r.total), sent: r.sent, failed: r.failed ? k('batch_failed_part', { n: r.failed }) : '' }), r.failed ? 'info' : 'success')
    setSelected(new Set()); setNote('')
    load()
  }

  const release = async (itemId: string) => {
    if (!(await askDialog(k('release_confirm'), { kind: 'warning', okLabel: k('release_ok'), cancelLabel: k('cancel') }))) return
    const r = await releaseStuckPayoutItem(itemId)
    toast(r.success ? k('released') : errText(r), r.success ? 'success' : 'error')
    load()
  }

  const batchStatus = (s: string) => k(s === 'done' ? 'batch_done' : s === 'partial' ? 'batch_partial' : s === 'failed' ? 'batch_failed' : 'batch_processing')
  const th = 'px-2 py-2'

  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/40">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-black"><Handshake className="h-5 w-5 text-indigo-500" />{k('title')}</h3>
        <button type="button" onClick={() => { setApprovingId(null); setNotifyPartner(true); setForm({ ...EMPTY }) }} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-500"><Plus className="h-3.5 w-3.5" />{k('new_partner')}</button>
      </div>

      <p className="mb-5 rounded-2xl bg-neutral-50 px-4 py-3 text-xs text-neutral-500 dark:bg-neutral-950">
        {k('conditions', { percent: settings.defaultPercent, days: settings.graceDays, min: money(settings.minPayout), cap: money(settings.payoutCap) })}
      </p>

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-950">
        <label className="block min-w-[260px] flex-1"><span className={labelCls}>{k('notify_label')}</span>
          <input type="email" className={inputCls} value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)} placeholder={k('notify_placeholder')} /></label>
        <button type="button" disabled={busy} onClick={saveNotify} className="flex items-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-black text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-700"><Save className="h-3.5 w-3.5" />{k('notify_save')}</button>
        <p className="w-full text-[10px] text-neutral-400">{k('notify_hint')}</p>
      </div>

      {applications.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-200 p-4 dark:border-amber-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-black"><Inbox className="h-4 w-4 text-amber-500" />{k('apps_title')}{newApps.length > 0 && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white">{k('apps_new_count', { n: newApps.length })}</span>}</p>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-500"><input type="checkbox" checked={showDecided} onChange={e => setShowDecided(e.target.checked)} />{k('apps_show_decided')}</label>
          </div>
          {shownApps.length === 0 ? <p className="text-xs text-neutral-400">{k('apps_none')}</p> : (
            <ul className="space-y-3">{shownApps.map(a => (
              <li key={a.id} className="rounded-xl bg-neutral-50 p-3 text-xs dark:bg-neutral-950">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black">{a.name} <span className="font-normal text-neutral-400">· {a.email}{a.phone ? ` · ${a.phone}` : ''}{a.company ? ` · ${a.company}` : ''}</span></p>
                  <span className="text-[10px] text-neutral-400">{when(a.createdAt)}</span>
                </div>
                <p className="mt-1 text-neutral-500"><b>{k('profile')}:</b> {t(`admin_partners.channel_${a.channel}`) || a.channel}{a.audience ? <> · <b>{k('promotion')}:</b> {a.audience}</> : null}</p>
                {a.message && <p className="mt-1 whitespace-pre-wrap text-neutral-500"><b>{k('message')}:</b> {a.message}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {a.status === 'new' ? (<>
                    <button type="button" onClick={() => approve(a)} className="rounded-lg bg-indigo-600 px-3 py-1 font-black text-white hover:bg-indigo-500">{k('approve')}</button>
                    <button type="button" onClick={() => { setRejectingId(a.id); setNotifyReject(false) }} className="rounded-lg border border-neutral-300 px-3 py-1 font-black text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300">{k('reject')}</button>
                  </>) : (<>
                    <span className={a.status === 'approved' ? 'font-black text-emerald-600' : 'font-black text-neutral-500'}>{k(a.status === 'approved' ? 'approved' : 'rejected')}</span>
                    <button type="button" onClick={() => decide(a.id, 'new')} className="rounded-lg border border-neutral-300 px-3 py-1 font-black text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300">{k('reopen')}</button>
                  </>)}
                  <button type="button" onClick={() => removeApplication(a)} aria-label={k('delete_aria', { name: a.name })} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                {rejectingId === a.id && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
                    <label className="flex items-center gap-1.5 font-bold text-neutral-600 dark:text-neutral-300"><input type="checkbox" checked={notifyReject} onChange={e => setNotifyReject(e.target.checked)} />{k('notify_reject')}</label>
                    <button type="button" disabled={busy} onClick={() => confirmReject(a.id)} className="rounded-lg bg-neutral-900 px-3 py-1 font-black text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-700">{k('reject_confirm')}</button>
                    <button type="button" disabled={busy} onClick={() => setRejectingId(null)} className="rounded-lg border border-neutral-300 px-3 py-1 font-black text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">{k('cancel')}</button>
                  </div>
                )}
              </li>))}</ul>
          )}
          <p className="mt-3 text-[10px] text-neutral-400">{k('apps_note')}</p>
        </div>
      )}

      {form && (
        <div className="mb-5 space-y-3 rounded-2xl border border-indigo-200 p-4 dark:border-indigo-900">
          <div className="flex items-center justify-between"><p className="text-sm font-black">{k(form.id ? 'form_edit' : 'form_new')}</p><button type="button" onClick={() => { setForm(null); setApprovingId(null) }} aria-label={k('close')}><X className="h-4 w-4" /></button></div>
          <div className="grid gap-3 md:grid-cols-3">
            {!form.id && <label className="block md:col-span-3"><span className={labelCls}>{k('f_email')}</span>
              <input className={inputCls} value={form.userEmail} onChange={e => setForm({ ...form, userEmail: e.target.value })} placeholder="partner@company.com" /></label>}
            <label className="block"><span className={labelCls}>{k('f_name')}</span><input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
            <label className="block"><span className={labelCls}>{k('f_document')}</span><input className={inputCls} value={form.document} onChange={e => setForm({ ...form, document: e.target.value })} /></label>
            <label className="block"><span className={labelCls}>{k('f_code')}</span><input className={inputCls + ' uppercase'} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="PAULO10" /></label>
            <label className="block"><span className={labelCls}>{k('f_pix_type')}</span>
              <select className={inputCls} value={form.pixKeyType} onChange={e => setForm({ ...form, pixKeyType: e.target.value as PartnerInput['pixKeyType'] })}>{PIX_KEY_TYPES.map(pk => <option key={pk} value={pk}>{pk}</option>)}</select></label>
            <label className="block"><span className={labelCls}>{k('f_pix_key')}</span><input className={inputCls} value={form.pixKey} onChange={e => setForm({ ...form, pixKey: e.target.value })} /></label>
            <label className="block"><span className={labelCls}>{k('f_percent')}</span>
              <input type="number" min={0} max={100} className={inputCls} value={form.commissionPercent ?? ''} onChange={e => setForm({ ...form, commissionPercent: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <label className="block"><span className={labelCls}>{k('f_status')}</span>
              <select className={inputCls} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'active' | 'suspended' })}><option value="active">{k('f_status_active')}</option><option value="suspended">{k('f_status_suspended')}</option></select></label>
            <label className="block md:col-span-2"><span className={labelCls}>{k('f_notes')}</span><input className={inputCls} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
            {!form.id && <label className="flex items-center gap-2 text-xs font-bold text-neutral-600 dark:text-neutral-300 md:col-span-3"><input type="checkbox" checked={notifyPartner} onChange={e => setNotifyPartner(e.target.checked)} />{k('notify_candidate')}</label>}
          </div>
          <button type="button" disabled={busy} onClick={savePartnerForm} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-500 disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}{k('save_partner')}</button>
          {form.id && (() => {
            const current = partners.find(x => x.id === form.id)
            if (!current) return null
            return (
              <div className="mt-1 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <button type="button" disabled={busy || current.hasHistory} onClick={() => removePartner(current)} className="flex items-center gap-1.5 rounded-xl border border-red-300 px-4 py-2 text-xs font-black text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-500/40 dark:hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" />{k('delete_partner')}</button>
                {current.hasHistory && <span className="text-[11px] text-neutral-500">{k('delete_partner_disabled')}</span>}
              </div>
            )
          })()}
        </div>
      )}

      {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" /></div> : partners.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-200 py-8 text-center text-sm text-neutral-400 dark:border-neutral-800">{k('empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
              <th className={th} /><th className={th}>{k('th_partner')}</th><th className={th}>{k('th_code')}</th><th className={th}>%</th><th className={th}>{k('th_referred')}</th>
              <th className={th}>{k('th_payable')}</th><th className={th}>{k('th_waiting')}</th><th className={th}>{k('th_in_batch')}</th><th className={th}>{k('th_paid')}</th><th className={th}>{k('th_pix')}</th><th className={th} />
            </tr></thead>
            <tbody>{partners.map(p => (
              <tr key={p.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-2 py-2"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={k('select_aria', { name: p.name })} /></td>
                <td className="px-2 py-2"><p className="font-bold">{p.name}{p.status === 'suspended' && <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-[9px] font-black text-neutral-600">{k('suspended_badge')}</span>}{p.pendingAccount && <span title={k('pending_account_hint')} className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-700">{k('pending_account_badge')}</span>}</p><p className="text-[11px] text-neutral-400">{p.userEmail}</p></td>
                <td className="px-2 py-2 font-mono text-xs">{p.code}</td>
                <td className="px-2 py-2">{p.commissionPercent ?? settings.defaultPercent}%{p.commissionPercent == null && <span className="text-[10px] text-neutral-400"> {k('default_tag')}</span>}</td>
                <td className="px-2 py-2">{p.subscribed}/{p.referrals}</td>
                <td className="px-2 py-2 font-black text-emerald-600">{money(p.summary.payable)}{p.summary.clawback > 0 && <span className="block text-[10px] font-bold text-red-500">{k('clawback', { amount: money(p.summary.clawback) })}</span>}</td>
                <td className="px-2 py-2 text-amber-600">{money(p.summary.waiting)}</td>
                <td className="px-2 py-2 text-sky-600">{money(p.summary.inPayout)}</td>
                <td className="px-2 py-2">{money(p.summary.paid)}</td>
                <td className="px-2 py-2 text-[11px]">{p.pixKey ? <span className="font-mono">{p.pixKeyType}: {p.pixKey}</span> : <span className="font-bold text-amber-600">{k('no_key')}</span>}</td>
                <td className="px-2 py-2"><button type="button" aria-label={k('edit_aria', { name: p.name })} onClick={() => setForm({ id: p.id, name: p.name, document: p.document || '', pixKey: p.pixKey || '', pixKeyType: p.pixKeyType || 'CPF', code: p.code, commissionPercent: p.commissionPercent, status: p.status, notes: p.notes || '' })} className="rounded-lg p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"><Pencil className="h-3.5 w-3.5" /></button></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}

      {selected.size > 0 && (
        <div className="mt-4 rounded-2xl border border-emerald-200 p-4 dark:border-emerald-900">
          {!confirming ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold">{k('batch_summary', { selected: selected.size, count: payable.length, total: money(total) })}{plan.length - payable.length > 0 && <span className="text-neutral-400"> {k('batch_out', { n: plan.length - payable.length, list: plan.filter(x => x.reason).map(x => `${x.p.name} (${k(`skip_${x.reason}`)})`).join(', ') })}</span>}</p>
              <button type="button" disabled={payable.length === 0 || busy} onClick={() => setConfirming(true)} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-50"><Send className="h-3.5 w-3.5" />{k('pay_button')}</button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-black text-red-600">{k('batch_confirm', { total: money(total) })}</p>
              <ul className="space-y-1 text-xs">{payable.map(x => <li key={x.p.id}><b>{x.p.name}</b>: {money(x.p.summary.payable)} {k('batch_to')} {x.p.pixKeyType} <span className="font-mono">{x.p.pixKey}</span></li>)}</ul>
              <input className={inputCls} value={note} onChange={e => setNote(e.target.value)} placeholder={k('batch_note_placeholder')} />
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={send} className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-500 disabled:opacity-50">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{k('send_yes')}</button>
                <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="rounded-xl bg-neutral-100 px-4 py-2 text-xs font-black text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">{k('cancel')}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {payouts.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-neutral-400">{k('last_batches')}</p>
          <div className="space-y-3">{payouts.map(o => (
            <div key={o.id} className="rounded-2xl border border-neutral-200 p-3 text-xs dark:border-neutral-800">
              <p className="font-black">{when(o.createdAt)} · {money(o.total)} · {batchStatus(o.status)}{o.note ? ` · ${o.note}` : ''}</p>
              <ul className="mt-1 space-y-1">{o.items.map(i => (
                <li key={i.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{i.partnerName}</span><span>{money(i.amount)}</span><span className="font-mono text-neutral-400">{i.pixKeyType}: {i.pixKey}</span>
                  <span className={i.status === 'done' ? 'font-black text-emerald-600' : i.status === 'failed' ? 'font-black text-red-600' : 'font-black text-amber-600'}>{['pending', 'sending', 'sent', 'done', 'failed'].includes(i.status) ? k(`item_${i.status}`) : i.status}</span>
                  {i.failReason && <span className="text-red-500">{i.failReason}</span>}
                  {i.receiptUrl && <a href={i.receiptUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{k('receipt')}</a>}
                  {i.status === 'sending' && !i.asaasTransferId && <button type="button" onClick={() => release(i.id)} className="rounded-lg border border-amber-300 px-2 py-0.5 font-black text-amber-700 hover:bg-amber-50">{k('release_btn')}</button>}
                </li>))}</ul>
            </div>))}</div>
        </div>
      )}
    </section>
  )
}
