'use client'

import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { cancelChargeAction, cancelSubscriptionAction, refundChargeAction } from '@/app/actions/adminChargeActions'
import { formatDateBr, moneyBr } from '@/lib/nfse/queue'
import { parseMoneyInput, type ChargeActionKind, type ChargeActionResult } from '@/lib/billing/chargeActions'
import type { ChargeDto } from '@/lib/billing/adminCharges'

type K = (key: string, vars?: Record<string, string | number>) => string

const inputCls = 'w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm font-bold dark:border-neutral-700'
const labelCls = 'mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400'

/** Texto do erro: o código traduzido e, quando o servidor (Asaas) explicou, a explicação dele. */
export function actionErrorText(k: K, r: ChargeActionResult): string {
  const base = k(`err_${r.code || 'unknown'}`)
  return r.error && r.code === 'asaas_failed' ? `${base} ${r.error}` : r.code === 'unknown' && r.error ? r.error : base
}

/**
 * Confirmação das ações do SuperAdmin sobre uma cobrança: cancelar a cobrança, cancelar a assinatura ou estornar. Sempre mostra o que vai
 * acontecer, pede o motivo (obrigatório no estorno) e, no estorno, a palavra de confirmação. Quem confirma de verdade é a Edge Function.
 */
export function ChargeActionModal({ action, charge, k, onClose, onDone }: {
  action: ChargeActionKind
  charge: ChargeDto
  k: K
  onClose: () => void
  onDone: (message: string, warning?: string) => void | Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [valueText, setValueText] = useState('')
  const [cancelCharges, setCancelCharges] = useState(true)
  const [cancelSub, setCancelSub] = useState(false)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const parsed = parseMoneyInput(valueText)
  const valueBad = action === 'refund' && parsed !== null && (Number.isNaN(parsed) || parsed < 0.01 || parsed > charge.amount)
  const needWord = action === 'refund'
  const wordOk = !needWord || word.trim().toUpperCase() === k('refund_word').toUpperCase()
  const reasonOk = action !== 'refund' || reason.trim().length > 0
  const canConfirm = !busy && !valueBad && wordOk && reasonOk

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      let r: ChargeActionResult
      if (action === 'cancel_charge') r = await cancelChargeAction(charge.id, reason)
      else if (action === 'cancel_subscription') r = await cancelSubscriptionAction(charge.userId || '', reason, cancelCharges)
      else r = await refundChargeAction({ paymentId: charge.id, reason, value: parsed, cancelSubscription: cancelSub && charge.subscriptionActive })
      if (!r.ok) { setError(actionErrorText(k, r)); return }
      const warn = action === 'refund' && r.subscription && !r.subscription.ok ? k('ok_refund_sub_failed', { error: r.subscription.error || '' }) : undefined
      await onDone(k(`ok_${action}`), warn)
    } finally {
      setBusy(false)
    }
  }

  const danger = action !== 'cancel_charge'
  return (
    <Modal isOpen onClose={() => { if (!busy) onClose() }} title={k(`${action}_title`)} description={k(`${action}_help`)} size="lg">
      <div className="space-y-5" data-testid={`charge-modal-${action}`}>
        <div className="grid gap-3 rounded-2xl border border-neutral-200 p-4 text-xs dark:border-neutral-700 sm:grid-cols-2">
          <div><span className={labelCls}>{k('lbl_customer')}</span><div className="font-bold">{charge.name || charge.email || k('no_customer')}</div>{charge.name && <div className="text-neutral-500">{charge.email}</div>}</div>
          <div><span className={labelCls}>{k('lbl_amount')}</span><div className="font-black">{moneyBr(charge.amount)}</div></div>
          <div><span className={labelCls}>{k('lbl_due')}</span><div>{formatDateBr(charge.dueDate) || '—'}</div></div>
          <div><span className={labelCls}>{k('lbl_id')}</span><div className="font-mono text-[11px] break-all">{charge.asaasPaymentId || '—'}</div></div>
        </div>

        {action === 'refund' && (
          <div>
            <label className={labelCls} htmlFor="refund-value">{k('refund_value_label', { total: moneyBr(charge.amount) })}</label>
            <input id="refund-value" data-testid="refund-value" className={cn(inputCls, valueBad && 'border-red-400')} inputMode="decimal" placeholder={moneyBr(charge.amount)}
              value={valueText} onChange={e => setValueText(e.target.value)} disabled={busy} />
            {valueBad && <p className="mt-1 text-[11px] font-bold text-red-600">{k('err_value_range', { total: moneyBr(charge.amount) })}</p>}
          </div>
        )}

        {action === 'cancel_subscription' && (
          <label className="flex cursor-pointer items-start gap-2.5 text-xs">
            <input type="checkbox" data-testid="cancel-open-charges" className="mt-0.5" checked={cancelCharges} onChange={e => setCancelCharges(e.target.checked)} disabled={busy} />
            <span>{k('cancel_subscription_charges')}</span>
          </label>
        )}

        {action === 'refund' && charge.subscriptionActive && (
          <label className="flex cursor-pointer items-start gap-2.5 text-xs">
            <input type="checkbox" data-testid="refund-cancel-sub" className="mt-0.5" checked={cancelSub} onChange={e => setCancelSub(e.target.checked)} disabled={busy} />
            <span>{k('refund_cancel_sub')}</span>
          </label>
        )}

        <div>
          <label className={labelCls} htmlFor="charge-reason">{k('reason_label')}{action === 'refund' ? ` *` : ''}</label>
          <textarea id="charge-reason" data-testid="charge-reason" rows={2} maxLength={300} className={inputCls} placeholder={k('reason_ph')} value={reason}
            onChange={e => setReason(e.target.value)} disabled={busy} />
        </div>

        {needWord && (
          <div>
            <label className={labelCls} htmlFor="refund-word">{k('refund_confirm_label', { word: k('refund_word') })}</label>
            <input id="refund-word" data-testid="refund-word" className={inputCls} value={word} onChange={e => setWord(e.target.value)} disabled={busy} autoComplete="off" />
          </div>
        )}

        {error && <p data-testid="charge-modal-error" className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">{k('btn_back')}</button>
          <button type="button" data-testid="charge-modal-confirm" onClick={run} disabled={!canConfirm}
            className={cn('flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black text-white disabled:opacity-40', danger ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500')}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{k(`btn_${action}`)}
          </button>
        </div>
      </div>
    </Modal>
  )
}
