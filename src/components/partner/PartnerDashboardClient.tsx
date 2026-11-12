'use client'

import React, { useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, Handshake, Link2 } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { isAvailable } from '../../../supabase/functions/_shared/partnerCommission'
import type { PartnerDashboard } from '@/lib/partners'

const P = 'partner_panel.'
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—')

type Tab = 'referrals' | 'commissions' | 'payouts'

/** Painel do parceiro (nome do tipo "Indicador com comissão"): resumo em reais, link de indicação e as listas de indicados, comissões e pagamentos. */
export default function PartnerDashboardClient({ dashboard }: { dashboard: PartnerDashboard | null }) {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('commissions')
  const [copied, setCopied] = useState(false)

  const link = useMemo(() => (typeof window !== 'undefined' && dashboard?.partner ? `${window.location.origin}/?ref=${encodeURIComponent(dashboard.partner.code)}` : ''), [dashboard?.partner])

  if (!dashboard) return <p className="text-sm text-red-500">{t(P + 'error')}</p>

  const p = dashboard.partner
  if (!p) {
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-[2rem] border border-neutral-200 p-8 text-center dark:border-neutral-800">
        <Handshake className="mx-auto mb-4 h-10 w-10 text-indigo-500" />
        <h1 className="text-xl font-black">{t(P + 'not_partner_title')}</h1>
        <p className="mt-2 text-sm text-neutral-500">{t(P + 'not_partner_desc')}</p>
      </div>
    )
  }

  const s = dashboard.summary
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* sem área de transferência: a pessoa copia o texto do campo */ }
  }

  const cards: { key: string; label: string; value: number; tone: string }[] = [
    { key: 'payable', label: t(P + 'card_payable'), value: s.payable, tone: 'text-emerald-600' },
    { key: 'available', label: t(P + 'card_available'), value: s.available, tone: 'text-indigo-600' },
    { key: 'waiting', label: t(P + 'card_waiting'), value: s.waiting, tone: 'text-amber-600' },
    { key: 'inPayout', label: t(P + 'card_in_payout'), value: s.inPayout, tone: 'text-sky-600' },
    { key: 'paid', label: t(P + 'card_paid'), value: s.paid, tone: 'text-neutral-900 dark:text-white' },
    { key: 'revoked', label: t(P + 'card_revoked'), value: s.revoked, tone: 'text-neutral-400' },
  ]
  if (s.clawback > 0) cards.push({ key: 'clawback', label: t(P + 'card_clawback'), value: s.clawback, tone: 'text-red-600' })

  const refLabel = (st: string) => t(P + (st === 'subscribed' ? 'ref_subscribed' : st === 'canceled' ? 'ref_canceled' : 'ref_registered'))
  const comLabel = (c: PartnerDashboard['commissions'][number]) => {
    if (c.clawback) return t(P + 'com_clawback')
    if (c.status === 'pending') return t(P + (isAvailable({ status: 'pending', amount: c.amount, release_at: c.releaseAt }) ? 'com_available' : 'com_waiting'))
    return t(P + (c.status === 'in_payout' ? 'com_in_payout' : c.status === 'paid' ? 'com_paid' : 'com_revoked'))
  }
  const payLabel = (st: string) => t(P + ({ pending: 'pay_pending', sending: 'pay_sending', sent: 'pay_sent', done: 'pay_done', failed: 'pay_failed' } as Record<string, string>)[st] || 'pay_pending')

  const th = 'px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest text-neutral-400'
  const td = 'px-3 py-2 text-sm'
  const tabCls = (k: Tab) => `rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${tab === k ? 'bg-indigo-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300'}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-black"><Handshake className="h-6 w-6 text-indigo-500" />{t(P + 'title')}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t(P + 'subtitle')}</p>
      </div>

      {p.status === 'suspended' && <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-700 dark:border-amber-900 dark:bg-amber-950/30">{t(P + 'suspended')}</p>}
      {!p.hasPixKey && <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-700 dark:border-amber-900 dark:bg-amber-950/30">{t(P + 'no_pix')}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(c => (
          <div key={c.key} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{c.label}</p>
            <p className={`mt-1 text-xl font-black ${c.tone}`}>{money(c.value)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-400"><Link2 className="h-3.5 w-3.5" />{t(P + 'your_link')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input readOnly value={link} className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-transparent px-3 py-2 font-mono text-xs dark:border-neutral-700" onFocus={e => e.currentTarget.select()} />
          <button type="button" onClick={copy} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-500">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? t(P + 'copied') : t(P + 'copy')}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-neutral-500">{t(P + 'your_code')}: <b className="font-mono">{p.code}</b></p>
        <ul className="mt-3 space-y-1 text-[11px] text-neutral-500">
          <li>{t(P + 'rate').replace('{percent}', String(p.percent))}</li>
          <li>{t(P + 'grace').replace('{days}', String(dashboard.settings.graceDays))}</li>
          {p.pixKeyMasked && <li>{t(P + 'payout_rule').replace('{key}', p.pixKeyMasked).replace('{min}', String(dashboard.settings.minPayout))}</li>}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['commissions', 'referrals', 'payouts'] as Tab[]).map(k => <button key={k} type="button" className={tabCls(k)} onClick={() => setTab(k)}>{t(P + 'tab_' + k)}</button>)}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
        {tab === 'referrals' && (dashboard.referrals.length === 0 ? <p className="p-6 text-center text-sm text-neutral-400">{t(P + 'empty_referrals')}</p> : (
          <table className="w-full">
            <thead><tr><th className={th}>{t(P + 'col_client')}</th><th className={th}>{t(P + 'col_status')}</th><th className={th}>{t(P + 'col_registered')}</th><th className={th}>{t(P + 'col_paid')}</th></tr></thead>
            <tbody>{dashboard.referrals.map(r => (
              <tr key={r.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className={td + ' font-mono'}>{r.email}</td><td className={td}>{refLabel(r.status)}</td><td className={td}>{day(r.createdAt)}</td><td className={td}>{day(r.paidAt)}</td>
              </tr>))}</tbody>
          </table>
        ))}

        {tab === 'commissions' && (dashboard.commissions.length === 0 ? <p className="p-6 text-center text-sm text-neutral-400">{t(P + 'empty_commissions')}</p> : (
          <table className="w-full">
            <thead><tr><th className={th}>{t(P + 'col_date')}</th><th className={th}>{t(P + 'col_client')}</th><th className={th}>{t(P + 'col_gross')}</th><th className={th}>{t(P + 'col_net')}</th><th className={th}>{t(P + 'col_rate')}</th><th className={th}>{t(P + 'col_commission')}</th><th className={th}>{t(P + 'col_status')}</th><th className={th}>{t(P + 'col_release')}</th></tr></thead>
            <tbody>{dashboard.commissions.map(c => (
              <tr key={c.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className={td}>{day(c.createdAt)}</td><td className={td + ' font-mono'}>{c.referredEmail}</td><td className={td}>{money(c.gross)}</td><td className={td}>{money(c.net)}</td>
                <td className={td}>{c.percent}%</td><td className={td + ' font-bold'}>{money(c.amount)}</td><td className={td}>{comLabel(c)}</td><td className={td}>{day(c.releaseAt)}</td>
              </tr>))}</tbody>
          </table>
        ))}

        {tab === 'payouts' && (dashboard.payouts.length === 0 ? <p className="p-6 text-center text-sm text-neutral-400">{t(P + 'empty_payouts')}</p> : (
          <table className="w-full">
            <thead><tr><th className={th}>{t(P + 'col_date')}</th><th className={th}>{t(P + 'col_amount')}</th><th className={th}>{t(P + 'col_status')}</th><th className={th}>{t(P + 'col_receipt')}</th></tr></thead>
            <tbody>{dashboard.payouts.map(x => (
              <tr key={x.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className={td}>{day(x.createdAt)}</td><td className={td + ' font-bold'}>{money(x.amount)}</td><td className={td}>{payLabel(x.status)}</td>
                <td className={td}>{x.receiptUrl ? <a href={x.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">{t(P + 'receipt_open')}<ExternalLink className="h-3 w-3" /></a> : '—'}</td>
              </tr>))}</tbody>
          </table>
        ))}
      </div>
      <p className="text-[11px] text-neutral-400">{t(P + 'privacy')}</p>
    </div>
  )
}
