'use client'

import React, { useState } from 'react'
import { Loader2, Radio, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

type Outcome =
  | { ok: true; ms: number; privileges?: { level: string; findings: string[] } }
  | { ok: false; reason: string; detail?: string }

/** Teste do caminho servidor → túnel → Agente CLI → banco (o comando vai assinado, o token nunca passa pelo canal). */
export function RelayDiagnostics({ projectId }: { projectId?: string }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const run = async () => {
    if (!projectId) return
    setBusy(true)
    setOutcome(null)
    try {
      const res = await fetch('/api/tunnel/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) setOutcome({ ok: false, reason: 'unauthorized' })
      else setOutcome(data?.ok
        ? { ok: true, ms: data.ms, privileges: data.privileges }
        : { ok: false, reason: data?.reason || 'transport', detail: data?.detail })
    } catch {
      setOutcome({ ok: false, reason: 'transport' })
    } finally {
      setBusy(false)
    }
  }

  const failure = outcome && !outcome.ok
    ? t('tunnel_relay.fail_' + outcome.reason) + (outcome.detail ? ` (${outcome.detail})` : '')
    : ''

  return (
    <div>
      <h3 className="font-bold text-lg mb-1 flex items-center gap-2"><Radio className="w-5 h-5 text-indigo-500" /> {t('tunnel_relay.title')}</h3>
      <p className="text-sm text-neutral-500 mb-4">{t('tunnel_relay.desc')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy || !projectId}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50 transition-colors"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
          {busy ? t('tunnel_relay.testing') : t('tunnel_relay.test')}
        </button>

        {outcome?.ok && (
          <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" /> {t('tunnel_relay.ok_signed').replace('{ms}', String(outcome.ms))}
          </span>
        )}
        {outcome?.ok && outcome.privileges && outcome.privileges.level !== 'unknown' && (
          outcome.privileges.level === 'ok' ? (
            <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> {t('tunnel_relay.priv_ok')}
            </span>
          ) : (
            <div className="basis-full text-sm text-amber-700 dark:text-amber-400 space-y-1">
              <p className="font-bold flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> {t(outcome.privileges.level === 'danger' ? 'tunnel_relay.priv_danger' : 'tunnel_relay.priv_warn')}</p>
              <ul className="list-disc pl-6 text-xs">
                {outcome.privileges.findings.map(f => <li key={f}>{t('tunnel_relay.priv_' + f)}</li>)}
              </ul>
              <p className="text-xs">{t('tunnel_relay.priv_fix')}</p>
            </div>
          )
        )}
        {outcome && !outcome.ok && (
          <span className="flex items-center gap-1.5 text-sm font-bold text-red-600 dark:text-red-400">
            <XCircle className="w-4 h-4" /> {failure}
          </span>
        )}
      </div>
    </div>
  )
}
