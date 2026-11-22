'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarClock, CreditCard } from 'lucide-react'
import { getMyBillingNotice } from '@/app/actions/billingNotices'
import { useI18n } from '@/i18n/I18nContext'
import { BILLING_REFRESH_EVENT, type MyBillingNotice } from '@/lib/billing/notice'

const P = 'billing_banner.'

/**
 * Aviso fixo de cobrança na tela do dono: fatura vencendo, vencida (com a data de suspensão) ou cartão recusado. Some quando não há nada a pagar
 * ou os avisos estão desligados (o servidor decide; aqui só se mostra o que ele devolve).
 */
export default function BillingBanner() {
  const { t, language } = useI18n()
  const router = useRouter()
  const [notice, setNotice] = useState<MyBillingNotice | null>(null)
  const lastRef = useRef<MyBillingNotice | null>(null)

  // Carrega o aviso e, enquanto houver cobrança em aberto, confere de novo a cada 20 s (até 15 min): quem paga pela página do Asaas ou pelo QR
  // não precisa recarregar. Quando o aviso some (pagamento entrou), atualiza o resto da tela. A aba Assinatura também pede a conferência na hora.
  useEffect(() => {
    let alive = true
    let ticks = 0
    const load = () => getMyBillingNotice().then(n => {
      if (!alive) return
      const had = !!lastRef.current
      lastRef.current = n
      setNotice(n)
      if (had && !n) router.refresh()
    }).catch(() => {})
    void load()
    const timer = setInterval(() => { if (lastRef.current && ++ticks <= 45) void load() }, 20_000)
    window.addEventListener(BILLING_REFRESH_EVENT, load)
    return () => { alive = false; clearInterval(timer); window.removeEventListener(BILLING_REFRESH_EVENT, load) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!notice) return null
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR'
  const date = (iso: string | null) => (iso ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00Z' : iso).toLocaleDateString(locale, { timeZone: 'UTC' }) : '-')
  const amount = notice.amount != null ? `R$ ${notice.amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''
  const fill = (s: string) => s.split('{amount}').join(amount).split('{due}').join(date(notice.dueDate)).split('{days}').join(String(Math.max(0, notice.daysToDue ?? 0))).split('{suspend}').join(date(notice.suspendOn))

  const overdue = notice.state === 'overdue'
  const refused = notice.state === 'card_refused'
  const checkout = notice.state === 'checkout_pending'
  const tone = !checkout && (overdue || refused) ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300' : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
  const Icon = checkout ? CreditCard : refused ? CreditCard : overdue ? AlertTriangle : CalendarClock
  const title = checkout ? t(P + 'checkout_title') : refused ? t(P + 'refused_title') : overdue ? t(P + 'overdue_title') : t(P + (notice.daysToDue === 0 ? 'today_title' : 'soon_title'))
  const desc = checkout ? fill(t(P + 'checkout_desc')) : refused ? fill(t(P + 'refused_desc')) : overdue ? fill(t(P + (notice.suspendOn ? 'overdue_desc_grace' : 'overdue_desc'))) : fill(t(P + 'soon_desc'))

  return (
    <div role="status" className={`flex flex-wrap items-center gap-4 rounded-2xl border p-4 ${tone}`}>
      <Icon className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black">{title}</p>
        <p className="mt-0.5 text-xs">{desc}</p>
      </div>
      <a href={checkout ? `/client/dashboard?tab=subscription${/^pay_[A-Za-z0-9]+$/.test(notice.paymentId || '') ? `&pay=${notice.paymentId}` : ''}` : notice.invoiceUrl && !refused ? notice.invoiceUrl : '/client/dashboard'} target={!checkout && notice.invoiceUrl && !refused ? '_blank' : undefined} rel="noreferrer"
        className="rounded-xl bg-neutral-900 px-4 py-2 text-xs font-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black">
        {refused ? t(P + 'update_button') : checkout ? t(P + 'checkout_button') : t(P + 'pay_button')}
      </a>
    </div>
  )
}
