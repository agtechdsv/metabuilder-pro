'use client'

import { useState } from 'react'
import { Laptop, Loader2, Mail, MonitorSmartphone, ShieldAlert } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { signOut } from '@/app/auth/actions'
import { confirmTakeoverCodeAction, requestTakeoverCodeAction, takeOverSlotAction } from '@/app/actions/deviceSessions'
import { placeText, type SlotKind, type SlotOther } from '@/lib/sessions/slotCore'
import type { DeviceErrorCode } from '@/lib/sessions/deviceTypes'

interface Props {
  other: SlotOther
  /** em qual vaga esta sessão tentou entrar */
  kind: SlotKind
  /** e-mail do usuário, já mascarado */
  email: string
  /** para onde ir depois de resolver */
  next: string
}

const ERR_KEYS: Record<string, string> = {
  not_authenticated: 'err_not_authenticated',
  session_revoked: 'err_session_revoked',
  invalid_code: 'err_invalid_code',
  code_expired: 'err_code_expired',
  too_many_attempts: 'err_too_many_attempts',
  too_soon: 'err_too_soon',
  mail_failed: 'err_mail_failed',
  unknown: 'err_unknown',
}

/** Tela que aparece depois de autenticar quando a vaga (IDE ou navegador) já está em uso em outro dispositivo. */
export function ActiveSessionChooser({ other, kind, email, next }: Props) {
  const { t, language } = useI18n()
  const k = (key: string) => t(`device_sessions.${key}`)
  const [step, setStep] = useState<'choose' | 'code'>('choose')
  const [busy, setBusy] = useState<'keep' | 'take' | 'code' | 'resend' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [code, setCode] = useState('')

  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString(language) : '')
  const place = placeText(other, k('chooser_unknown'))
  const showError = (c: DeviceErrorCode | string) => setError(k(ERR_KEYS[c] || 'err_unknown'))

  const keepThere = async () => {
    setBusy('keep'); setError(null)
    try {
      await signOut()
      document.cookie = 'passkey_authenticated=; path=/; max-age=0; SameSite=Lax'
    } finally {
      window.location.href = '/login'
    }
  }

  const sendCode = async (resend = false) => {
    setBusy(resend ? 'resend' : 'take'); setError(null); setInfo(null)
    const r = await requestTakeoverCodeAction()
    setBusy(null)
    if (!r.success) return showError(r.code)
    setStep('code')
    setInfo(k('code_sent').replace('{email}', r.email))
  }

  const takeOver = async () => {
    setBusy('take'); setError(null); setInfo(null)
    const r = await takeOverSlotAction()
    if (r.success) { window.location.href = next; return }
    if (r.code === 'needs_code') { await sendCode(false); return }
    setBusy(null)
    showError(r.code)
  }

  const confirmCode = async () => {
    setBusy('code'); setError(null); setInfo(null)
    const r = await confirmTakeoverCodeAction(code)
    if (r.success) { window.location.href = next; return }
    setBusy(null)
    showError(r.code)
  }

  const deviceLine = [other.label, k(kind === 'ide' ? 'kind_ide' : 'kind_web')].filter(Boolean)[0]

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight">{k('chooser_title')}</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{k(kind === 'ide' ? 'chooser_desc_ide' : 'chooser_desc_web')}</p>
        </div>
      </div>

      <dl className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm dark:border-neutral-800 dark:bg-neutral-900/60">
        <div className="flex items-start gap-3">
          <Laptop className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
          <div><dt className="text-xs uppercase tracking-widest text-neutral-400">{k('chooser_device')}</dt><dd className="font-semibold">{deviceLine}</dd></div>
        </div>
        <div className="flex items-start gap-3">
          <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
          <div><dt className="text-xs uppercase tracking-widest text-neutral-400">{k('chooser_where')}</dt><dd className="font-semibold">{place}</dd></div>
        </div>
        <div className="grid grid-cols-2 gap-3 pl-7">
          <div><dt className="text-xs uppercase tracking-widest text-neutral-400">{k('chooser_since')}</dt><dd>{fmt(other.since)}</dd></div>
          <div><dt className="text-xs uppercase tracking-widest text-neutral-400">{k('chooser_last')}</dt><dd>{fmt(other.last_seen_at)}</dd></div>
        </div>
      </dl>

      {step === 'choose' ? (
        <div className="space-y-3">
          <button
            type="button" onClick={takeOver} disabled={busy !== null}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3.5 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy === 'take' && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy === 'take' ? k('chooser_taking') : k('chooser_take')}
          </button>
          <button
            type="button" onClick={keepThere} disabled={busy !== null}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-300 px-5 py-3.5 text-sm font-bold text-neutral-700 transition-colors hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200"
          >
            {busy === 'keep' && <Loader2 className="h-4 w-4 animate-spin" />}
            {k('chooser_keep')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-sm">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
            <div>
              <p className="font-bold">{k('code_title')}</p>
              <p className="text-neutral-500 dark:text-neutral-400">{k('code_desc').replace('{email}', email)}</p>
            </div>
          </div>
          <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400">
            {k('code_label')}
            <input
              inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-center text-2xl font-black tracking-[0.5em] text-neutral-900 outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            />
          </label>
          <button
            type="button" onClick={confirmCode} disabled={busy !== null || code.length !== 6}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3.5 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy === 'code' && <Loader2 className="h-4 w-4 animate-spin" />}
            {k('code_confirm')}
          </button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={() => sendCode(true)} disabled={busy !== null} className="font-semibold text-indigo-600 hover:underline disabled:opacity-60">
              {busy === 'resend' ? '...' : k('code_resend')}
            </button>
            <button type="button" onClick={keepThere} disabled={busy !== null} className="font-semibold text-neutral-500 hover:underline disabled:opacity-60">
              {k('chooser_keep')}
            </button>
          </div>
        </div>
      )}

      {info && <p role="status" className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{info}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      <p className="text-xs leading-relaxed text-neutral-400">{k('chooser_hint')}</p>
    </div>
  )
}
