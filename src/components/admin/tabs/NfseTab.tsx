'use client'

import React, { useMemo, useRef, useState } from 'react'
import { Check, Copy, ExternalLink, FileUp, Loader2, RefreshCw, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import { askDialog } from '@/utils/askDialog'
import { isTauri, openExternalUrl } from '@/utils/tauriUtils'
import { nfseIssueAction, nfseSaveSettingsAction, nfseSetStatusAction } from '@/app/actions/nfse'
import {
  MAX_PDF_BYTES, MAX_WAIT_DAYS, MIN_WAIT_DAYS, NFSE_LUNIS_URL, NFSE_MODES, formatDateBr, formatDoc, moneyBr, moneyForCopy, onlyDigits,
  type NfseMode,
} from '@/lib/nfse/queue'
import type { NfseErrorCode, NfseItemDto } from '@/lib/nfse/types'
import type { NfseQueueHook } from '../hooks/useNfseQueue'

type Filter = 'pending' | 'issued' | 'canceled' | 'refund'

const inputCls = 'w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm font-bold dark:border-neutral-700'
const labelCls = 'mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400'
const pillOn = 'bg-white dark:bg-neutral-850 text-indigo-500 dark:text-indigo-400 shadow-sm'
const pillOff = 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result).split(',')[1] || '')
  r.onerror = () => reject(r.error)
  r.readAsDataURL(file)
})

function CopyField({ label, value, shown, testId }: { label: string; value: string; shown?: string; testId: string }) {
  const { t } = useI18n()
  const [done, setDone] = useState(false)
  const copy = async () => {
    if (await copyText(value)) { setDone(true); setTimeout(() => setDone(false), 1500) }
  }
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="flex items-center gap-2">
        <div data-testid={`${testId}-value`} className="min-h-[38px] flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-bold dark:border-neutral-700 dark:bg-neutral-950/40 break-all">
          {shown ?? value}
        </div>
        <button type="button" data-testid={`${testId}-copy`} onClick={copy} disabled={!value}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-indigo-200 px-3 py-2 text-[11px] font-black text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-950/40">
          {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {done ? t('admin_nfse.copied') : t('admin_nfse.copy')}
        </button>
      </div>
    </div>
  )
}

export function NfseTab({ hook }: { hook: NfseQueueHook }) {
  const { toast } = useToast()
  const { t } = useI18n()
  const k = (key: string, vars?: Record<string, string | number>) => {
    let s = t(`admin_nfse.${key}`)
    for (const [name, v] of Object.entries(vars || {})) s = s.split(`{${name}}`).join(String(v))
    return s
  }
  const errText = (code: NfseErrorCode) => k(`err_${code}`)
  const { overview, loading, error, reload } = hook

  const [filter, setFilter] = useState<Filter>('pending')
  const [mode, setMode] = useState<NfseMode>('manual')
  const [waitDays, setWaitDays] = useState(8)
  const [loadedFrom, setLoadedFrom] = useState<typeof overview>(null)
  const [saving, setSaving] = useState(false)
  const [current, setCurrent] = useState<NfseItemDto | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // os ajustes do servidor entram nos campos uma vez por carga
  if (overview && overview !== loadedFrom) {
    setLoadedFrom(overview)
    setMode(overview.mode)
    setWaitDays(overview.waitDays)
  }

  const counts = useMemo(() => {
    const c = { late: 0, today: 0, soon: 0, pending: 0, issued: 0, canceled: 0, refund: 0 }
    for (const i of overview?.items || []) {
      if (i.status === 'pending') {
        c.pending++
        if (i.due.state === 'late') c.late++
        else if (i.due.state === 'today') c.today++
        else if (i.due.state === 'soon') c.soon++
      } else if (i.status === 'issued') { c.issued++; if (i.refunded) c.refund++ }
      else c.canceled++
    }
    return c
  }, [overview])

  const rows = useMemo(() => {
    const list = overview?.items || []
    if (filter === 'refund') return list.filter(i => i.status === 'issued' && i.refunded)
    return list.filter(i => i.status === filter)
  }, [overview, filter])

  const saveSettings = async (next: { mode: NfseMode; waitDays: number }) => {
    setSaving(true)
    const r = await nfseSaveSettingsAction(next)
    setSaving(false)
    if (r.success) { toast(k('saved'), 'success'); await reload() } else toast(errText(r.code), 'error')
  }

  const dueLabel = (i: NfseItemDto) =>
    i.due.state === 'late' ? k('due_late', { n: i.due.days }) : i.due.state === 'today' ? k('due_today') : i.due.state === 'soon' ? k('due_soon', { n: i.due.days }) : k('due_future', { n: i.due.days })
  const dueCls = (i: NfseItemDto) =>
    i.due.state === 'late' ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
      : i.due.state === 'today' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
        : i.due.state === 'soon' ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'

  const dismiss = async (i: NfseItemDto) => {
    if (!(await askDialog(k('dismiss_confirm'), { kind: 'warning', okLabel: k('dismiss'), cancelLabel: k('cancel') }))) return
    setBusyId(i.id)
    const r = await nfseSetStatusAction(i.id, 'canceled')
    setBusyId(null)
    if (r.success) { toast(k('dismiss_ok'), 'success'); await reload() } else toast(errText(r.code), 'error')
  }
  const reopen = async (i: NfseItemDto) => {
    if (!(await askDialog(k('reopen_confirm'), { kind: 'info', okLabel: k('reopen'), cancelLabel: k('cancel') }))) return
    setBusyId(i.id)
    const r = await nfseSetStatusAction(i.id, 'pending')
    setBusyId(null)
    if (r.success) { toast(k('reopen_ok'), 'success'); await reload() } else toast(errText(r.code), 'error')
  }
  const markCanceled = async (i: NfseItemDto) => {
    setBusyId(i.id)
    const r = await nfseSetStatusAction(i.id, 'canceled', k('canceled_note'))
    setBusyId(null)
    if (r.success) await reload(); else toast(errText(r.code), 'error')
  }

  const modeHint = mode === 'manual' ? k('mode_manual_hint') : mode === 'hybrid' ? k('mode_hybrid_hint') : k('mode_auto_hint')

  return (
    <div className="space-y-6" data-testid="nfse-tab">
      {/* modo e prazo */}
      <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className={labelCls}>{k('mode_label')}</span>
            <div className="flex gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-950" role="radiogroup" aria-label={k('mode_label')}>
              {NFSE_MODES.map(m => {
                const available = !!overview?.autoAvailable || m === 'manual'
                return (
                  <button key={m} type="button" role="radio" aria-checked={mode === m} data-testid={`nfse-mode-${m}`} disabled={!available || saving}
                    onClick={() => { setMode(m); saveSettings({ mode: m, waitDays }) }}
                    className={cn('rounded-lg px-4 py-1.5 text-[11px] font-bold transition-all', mode === m ? pillOn : pillOff, !available && 'cursor-not-allowed opacity-60')}>
                    {k(`mode_${m}`)}{!available && <span className="ml-1.5 text-[9px] font-black uppercase tracking-wider text-neutral-400">{k('mode_soon')}</span>}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className={labelCls} htmlFor="nfse-wait">{k('wait_label')}</label>
              <input id="nfse-wait" data-testid="nfse-wait" type="number" min={MIN_WAIT_DAYS} max={MAX_WAIT_DAYS} className={cn(inputCls, 'w-28')} value={waitDays}
                onChange={e => setWaitDays(Number(e.target.value))} />
            </div>
            <button type="button" data-testid="nfse-save" disabled={saving || waitDays === overview?.waitDays} onClick={() => saveSettings({ mode, waitDays })}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-500 disabled:opacity-40">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}{k('save')}
            </button>
          </div>
        </div>
        <p className="text-xs text-neutral-500">{modeHint}</p>
        <p className="text-[11px] text-neutral-400">{k('wait_hint')}</p>
        {!overview?.autoAvailable && <p className="text-[11px] text-neutral-400">{k('auto_unavailable')}</p>}
      </div>

      {/* resumo do dia */}
      <div data-testid="nfse-banner" className={cn('flex flex-wrap items-center gap-2 rounded-2xl border p-4 text-xs font-bold',
        counts.late ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'
          : counts.today ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
            : 'border-neutral-200 bg-white text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/40')}>
        {counts.late + counts.today + counts.soon + counts.refund === 0 ? <span>{k('banner_ok')}</span> : (
          <>
            {counts.late > 0 && <span>{k('banner_late', { n: counts.late })}</span>}
            {counts.today > 0 && <span>{k('banner_today', { n: counts.today })}</span>}
            {counts.soon > 0 && <span>{k('banner_soon', { n: counts.soon })}</span>}
            {counts.refund > 0 && <span>{k('filter_refund')}: {counts.refund}</span>}
          </>
        )}
        <button type="button" onClick={() => reload()} className="ml-auto flex items-center gap-1.5 text-[11px] font-black text-indigo-600 dark:text-indigo-300">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />{k('refresh')}
        </button>
      </div>

      {/* filtros */}
      <div className="flex gap-1 self-start rounded-xl bg-neutral-100 p-1 dark:bg-neutral-950 w-fit flex-wrap">
        {(['pending', 'issued', 'canceled', 'refund'] as const).map(f => (
          <button key={f} type="button" data-testid={`nfse-filter-${f}`} onClick={() => setFilter(f)}
            className={cn('rounded-lg px-4 py-1.5 text-[10px] font-bold transition-all', filter === f ? pillOn : pillOff)}>
            {k(`filter_${f}`)} <span className="opacity-60">({counts[f]})</span>
          </button>
        ))}
      </div>

      {/* lista */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
        {error ? (
          <p className="p-6 text-sm font-bold text-amber-600 dark:text-amber-400">{errText(error)}</p>
        ) : loading && !overview ? (
          <p className="flex items-center gap-2 p-6 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" />{k('loading')}</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">{k('empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-neutral-150 bg-neutral-50/50 text-[10px] font-black uppercase tracking-wider text-neutral-400 dark:border-neutral-850 dark:bg-neutral-950/40">
                  <th className="px-6 py-4">{k('col_customer')}</th>
                  <th className="px-6 py-4">{k('col_value')}</th>
                  <th className="px-6 py-4">{k('col_paid')}</th>
                  <th className="px-6 py-4">{k('col_emit')}</th>
                  <th className="px-6 py-4 text-right">{k('col_action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850/60">
                {rows.map(i => (
                  <tr key={i.id} data-testid="nfse-row" className="text-xs">
                    <td className="px-6 py-4">
                      <div className="font-bold text-neutral-800 dark:text-neutral-100">{i.name || '—'}</div>
                      <div className="text-[11px] text-neutral-500">{formatDoc(i.doc) || <span className="text-amber-600 dark:text-amber-400">{k('no_doc')}</span>}</div>
                      {i.status === 'issued' && (
                        <div className="mt-1 text-[11px] text-neutral-500">
                          {k('issued_on', { date: formatDateBr(i.issuedAt) })}{i.nfseNumber ? ` · ${k('number', { n: i.nfseNumber })}` : ''}
                          {' · '}{i.emailedAt ? k('emailed', { date: formatDateBr(i.emailedAt) }) : k('not_emailed')}
                        </div>
                      )}
                      {i.status === 'issued' && i.refunded && <div className="mt-1 text-[11px] font-bold text-red-600 dark:text-red-400">{k('refund_warn')}</div>}
                      {i.status === 'canceled' && i.note && <div className="mt-1 text-[11px] text-neutral-500">{i.note}</div>}
                    </td>
                    <td className="px-6 py-4 font-black">{moneyBr(i.amount)}</td>
                    <td className="px-6 py-4 text-neutral-500">{formatDateBr(i.paidOn)}</td>
                    <td className="px-6 py-4">
                      <div>{formatDateBr(i.emitOn)}</div>
                      {i.status === 'pending' && <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-black', dueCls(i))}>{dueLabel(i)}</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {busyId === i.id && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />}
                        {i.status === 'pending' && (
                          <>
                            <button type="button" data-testid="nfse-issue" disabled={busyId === i.id} onClick={() => setCurrent(i)}
                              className="rounded-xl bg-indigo-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-indigo-500 disabled:opacity-40">{k('issue')}</button>
                            <button type="button" disabled={busyId === i.id} onClick={() => dismiss(i)}
                              className="rounded-xl border border-neutral-200 px-3 py-1.5 text-[11px] font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">{k('dismiss')}</button>
                          </>
                        )}
                        {i.status === 'issued' && i.refunded && (
                          <button type="button" disabled={busyId === i.id} onClick={() => markCanceled(i)}
                            className="rounded-xl bg-red-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-red-500 disabled:opacity-40">{k('mark_canceled')}</button>
                        )}
                        {i.status !== 'pending' && !(i.status === 'issued' && i.refunded) && (
                          <button type="button" disabled={busyId === i.id} onClick={() => reopen(i)}
                            className="rounded-xl border border-neutral-200 px-3 py-1.5 text-[11px] font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">{k('reopen')}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {current && (
        <IssueModal item={current} today={overview?.today || ''} k={k} errText={errText}
          onClose={() => setCurrent(null)}
          onDone={async (sent) => { setCurrent(null); toast(k(sent ? 'issued_sent' : 'issued_ok'), 'success'); await reload() }} />
      )}
    </div>
  )
}

interface IssueModalProps {
  item: NfseItemDto
  today: string
  k: (key: string, vars?: Record<string, string | number>) => string
  errText: (code: NfseErrorCode) => string
  onClose: () => void
  onDone: (sent: boolean) => void | Promise<void>
}

function IssueModal({ item, today, k, errText, onClose, onDone }: IssueModalProps) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [number, setNumber] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [email, setEmail] = useState(item.email)
  const [send, setSend] = useState(true)
  const [busy, setBusy] = useState(false)

  const willSend = send && !!file
  const noDoc = onlyDigits(item.doc).length === 0

  const pickFile = (f: File | null) => {
    if (f && f.size > MAX_PDF_BYTES) { toast(k('err_pdf_too_big'), 'error'); if (fileRef.current) fileRef.current.value = ''; return }
    setFile(f)
  }

  const confirm = async () => {
    setBusy(true)
    try {
      const pdfBase64 = willSend && file ? await fileToBase64(file) : undefined
      const r = await nfseIssueAction({ id: item.id, number, send: willSend, email, pdfBase64, pdfName: file?.name })
      if (r.success) await onDone(r.emailed)
      else toast(errText(r.code), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={k('modal_title')} description={k('modal_intro')} size="2xl">
      <div className="space-y-5" data-testid="nfse-modal">
        <div className="space-y-3">
          <CopyField testId="nfse-f-value" label={k('f_value')} value={moneyForCopy(item.amount)} shown={moneyBr(item.amount)} />
          <CopyField testId="nfse-f-doc" label={k('f_doc')} value={onlyDigits(item.doc)} shown={formatDoc(item.doc)} />
          {noDoc && <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">{k('no_doc')}</p>}
          <CopyField testId="nfse-f-name" label={k('f_name')} value={item.name} />
          <CopyField testId="nfse-f-email" label={k('f_email')} value={item.email} />
          <CopyField testId="nfse-f-competence" label={k('f_competence')} value={formatDateBr(today)} />
        </div>

        {/* Link comum (nao window.open): o Chrome so entrega ao app instalado (PWA) o clique em <a>. No Tauri, abre pelo sistema. */}
        <a data-testid="nfse-open-issuer" href={NFSE_LUNIS_URL} target="_blank"
          onClick={(e) => { if (isTauri()) { e.preventDefault(); void openExternalUrl(NFSE_LUNIS_URL) } }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white hover:bg-indigo-500">
          <ExternalLink className="h-4 w-4" />{k('open_issuer')}
        </a>

        <div className="rounded-xl border border-neutral-200 p-4 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-neutral-400">{k('steps_title')}</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>{k('step1')}</li><li>{k('step2')}</li><li>{k('step3')}</li><li>{k('step4')}</li>
          </ol>
        </div>

        <div className="space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{k('after_title')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="nfse-number">{k('f_number')}</label>
              <input id="nfse-number" data-testid="nfse-number" className={inputCls} value={number} maxLength={40} onChange={e => setNumber(e.target.value)} />
            </div>
            <div>
              <span className={labelCls}>{k('f_pdf')}</span>
              <input ref={fileRef} data-testid="nfse-pdf" type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => pickFile(e.target.files?.[0] || null)} />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-neutral-300 px-3 py-2 text-left text-sm font-bold text-neutral-600 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800">
                <FileUp className="h-4 w-4 shrink-0" /><span className="truncate">{file ? file.name : 'PDF'}</span>
              </button>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold">
            <input type="checkbox" data-testid="nfse-send" checked={send} onChange={e => setSend(e.target.checked)} />{k('send_check')}
          </label>
          {send && (
            <div>
              <label className={labelCls} htmlFor="nfse-email">{k('f_send_to')}</label>
              <input id="nfse-email" data-testid="nfse-email" type="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} />
              {!file && <p className="mt-1 text-[11px] text-neutral-500">{k('send_needs_pdf')}</p>}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-neutral-200 px-4 py-2 text-xs font-bold dark:border-neutral-700">{k('cancel')}</button>
          <button type="button" data-testid="nfse-confirm" disabled={busy} onClick={confirm}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-40">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{willSend ? k('confirm_issue_send') : k('confirm_issue')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
