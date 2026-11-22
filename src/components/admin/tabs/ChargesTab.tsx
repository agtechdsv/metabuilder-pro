'use client'

import React, { useState } from 'react'
import { Check, Copy, ExternalLink, Loader2, RefreshCw, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { formatDateBr, moneyBr } from '@/lib/nfse/queue'
import { invoiceLinkKind } from '@/lib/billing/invoiceLink'
import { availableActions, type ChargeActionKind } from '@/lib/billing/chargeActions'
import { useToast } from '@/components/ui/Toast'
import { ChargeActionModal } from './ChargeActionModal'
import { CHARGE_GROUPS, type ChargeDto, type ChargeGroup, type ChargeMethodFilter, type ChargeStatusFilter } from '@/lib/billing/adminCharges'
import type { AdminChargesHook } from '../hooks/useAdminCharges'

const inputCls = 'rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-xs font-bold dark:border-neutral-700'
const labelCls = 'mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400'
const pillOn = 'bg-white dark:bg-neutral-850 text-indigo-500 dark:text-indigo-400 shadow-sm'
const pillOff = 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'

const BADGE: Record<ChargeGroup, string> = {
  upcoming: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  canceled: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  refunded: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
}

const METHODS: ChargeMethodFilter[] = ['all', 'PIX', 'CREDIT_CARD', 'BOLETO']

function CopyId({ id }: { id: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(id); setDone(true); setTimeout(() => setDone(false), 1200) } catch { /* sem área de transferência: ignora */ }
  }
  return (
    <button type="button" onClick={copy} title={id} className="inline-flex items-center gap-1 font-mono text-[10px] text-neutral-400 hover:text-indigo-500">
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{id.slice(0, 14)}…
    </button>
  )
}

/** Subaba Clientes > Cobranças: lista de todas as cobranças da plataforma, com busca, filtros e totais. Só leitura (fase 1). */
export function ChargesTab({ hook, userLabel, onClearUser }: { hook: AdminChargesHook; userLabel: string; onClearUser: () => void }) {
  const { t } = useI18n()
  const k = (key: string, vars?: Record<string, string | number>) => {
    let s = t(`admin_charges.${key}`)
    for (const [name, v] of Object.entries(vars || {})) s = s.split(`{${name}}`).join(String(v))
    return s
  }
  const { filters, data, loading, error, update, reset, reload } = hook
  const { toast } = useToast()
  const [act, setAct] = useState<{ action: ChargeActionKind; charge: ChargeDto } | null>(null)
  const summary = data?.summary
  const allCount = summary ? CHARGE_GROUPS.reduce((n, g) => n + summary[g].count, 0) : 0

  const dirty = filters.status !== 'all' || filters.from || filters.to || filters.userId || filters.q || filters.method !== 'all' || filters.dateField !== 'due'
  const first = data && data.total > 0 ? data.page * data.pageSize + 1 : 0
  const last = data ? Math.min(data.total, (data.page + 1) * data.pageSize) : 0
  const maxPage = data ? Math.max(0, Math.ceil(data.total / data.pageSize) - 1) : 0

  const cards: { group: ChargeGroup; tone: string }[] = [
    { group: 'upcoming', tone: 'text-sky-600 dark:text-sky-300' },
    { group: 'overdue', tone: 'text-red-600 dark:text-red-300' },
    { group: 'paid', tone: 'text-emerald-600 dark:text-emerald-300' },
  ]

  const STATUS_OF: Record<ChargeGroup, string> = { upcoming: 'pending', overdue: 'overdue', paid: 'paid', canceled: 'canceled', refunded: 'refunded' }
  const methodText = (m: string | null) => (m && (METHODS as string[]).includes(m) ? k(`method_${m}`) : m || '—')
  const linkFor = (c: ChargeDto) => {
    const kind = invoiceLinkKind(STATUS_OF[c.group]) // paga = Recibo; em aberto = a mesma página serve para pagar; cancelada/estornada = sem link
    if (!kind || !c.invoiceUrl) return null
    return (
      <a href={c.invoiceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400">
        {kind === 'receipt' ? k('link_receipt') : k('link_invoice')}<ExternalLink className="h-3 w-3" />
      </a>
    )
  }

  return (
    <div className="space-y-6" data-testid="charges-tab">
      {/* totais (clicar filtra pela situação) */}
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ group, tone }) => (
          <button key={group} type="button" data-testid={`charges-card-${group}`} onClick={() => update({ status: group })}
            className={cn('rounded-2xl border bg-white p-5 text-left shadow-sm transition-all hover:border-indigo-300 dark:bg-neutral-900/40',
              filters.status === group ? 'border-indigo-400 dark:border-indigo-600' : 'border-neutral-200 dark:border-neutral-800')}>
            <span className={labelCls}>{k(`card_${group}`)}</span>
            <div className={cn('text-2xl font-black', tone)}>{summary ? moneyBr(summary[group].sum) : '—'}</div>
            <div className="text-[11px] text-neutral-500">{summary ? k('count', { n: summary[group].count }) : ''}</div>
          </button>
        ))}
      </div>

      {/* filtros */}
      <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
        <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-950" role="tablist">
          {(['all', ...CHARGE_GROUPS] as ChargeStatusFilter[]).map(s => (
            <button key={s} type="button" role="tab" aria-selected={filters.status === s} data-testid={`charges-filter-${s}`} onClick={() => update({ status: s })}
              className={cn('rounded-lg px-4 py-1.5 text-[10px] font-bold transition-all', filters.status === s ? pillOn : pillOff)}>
              {k(`filter_${s}`)} <span className="opacity-60">({summary ? (s === 'all' ? allCount : summary[s].count) : '…'})</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className={labelCls} htmlFor="charges-q">{k('search_label')}</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input id="charges-q" data-testid="charges-search" className={cn(inputCls, 'w-full pl-9')} placeholder={k('search_ph')} value={filters.q}
                onChange={e => update({ q: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="charges-date-field">{k('date_label')}</label>
            <select id="charges-date-field" data-testid="charges-date-field" className={inputCls} value={filters.dateField} onChange={e => update({ dateField: e.target.value === 'paid' ? 'paid' : 'due' })}>
              <option value="due">{k('date_due')}</option>
              <option value="paid">{k('date_paid')}</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="charges-from">{k('from')}</label>
            <input id="charges-from" data-testid="charges-from" type="date" className={inputCls} value={filters.from} onChange={e => update({ from: e.target.value })} />
          </div>
          <div>
            <label className={labelCls} htmlFor="charges-to">{k('to')}</label>
            <input id="charges-to" data-testid="charges-to" type="date" className={inputCls} value={filters.to} onChange={e => update({ to: e.target.value })} />
          </div>
          <div>
            <label className={labelCls} htmlFor="charges-method">{k('method_label')}</label>
            <select id="charges-method" data-testid="charges-method" className={inputCls} value={filters.method} onChange={e => update({ method: e.target.value as ChargeMethodFilter })}>
              {METHODS.map(m => <option key={m} value={m}>{k(`method_${m}`)}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => reload()} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-black text-indigo-600 dark:text-indigo-300">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />{k('refresh')}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {filters.userId && (
            <span data-testid="charges-user-chip" className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
              {k('client_chip', { name: userLabel || filters.userId.slice(0, 8) })}
              <button type="button" aria-label={k('clear_client')} onClick={() => { onClearUser(); update({ userId: '' }) }}><X className="h-3 w-3" /></button>
            </span>
          )}
          {filters.dateField === 'paid' && <span className="text-[11px] text-neutral-400">{k('paid_note')}</span>}
          {dirty && (
            <button type="button" data-testid="charges-reset" onClick={() => { onClearUser(); reset() }} className="text-[11px] font-black text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200">
              {k('clear_filters')}
            </button>
          )}
        </div>
      </div>

      {/* lista */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
        {error ? (
          <p className="p-6 text-sm font-bold text-amber-600 dark:text-amber-400">{k(`err_${error}`)}</p>
        ) : loading && !data ? (
          <p className="flex items-center gap-2 p-6 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" />{k('loading')}</p>
        ) : !data || data.items.length === 0 ? (
          <p data-testid="charges-empty" className="p-6 text-sm text-neutral-500">{k('empty')}</p>
        ) : (
          <div className={cn('overflow-x-auto transition-opacity', loading && 'opacity-60')}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-neutral-150 bg-neutral-50/50 text-[10px] font-black uppercase tracking-wider text-neutral-400 dark:border-neutral-850 dark:bg-neutral-950/40">
                  <th className="px-6 py-4">{k('col_customer')}</th>
                  <th className="px-6 py-4">{k('col_value')}</th>
                  <th className="px-6 py-4">{k('col_due')}</th>
                  <th className="px-6 py-4">{k('col_paid')}</th>
                  <th className="px-6 py-4">{k('col_status')}</th>
                  <th className="px-6 py-4">{k('col_method')}</th>
                  <th className="px-6 py-4 text-right">{k('col_invoice')}</th>
                  <th className="px-6 py-4 text-right">{k('col_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850/60">
                {data.items.map(c => (
                  <tr key={c.id} data-testid="charges-row" className="text-xs">
                    <td className="px-6 py-4">
                      <div className="font-bold text-neutral-800 dark:text-neutral-100">{c.name || c.email || k('no_customer')}</div>
                      {c.name && <div className="text-[11px] text-neutral-500">{c.email}</div>}
                      {c.asaasPaymentId && <CopyId id={c.asaasPaymentId} />}
                    </td>
                    <td className="px-6 py-4 font-black">{moneyBr(c.amount)}</td>
                    <td className="px-6 py-4 text-neutral-500">{formatDateBr(c.dueDate) || '—'}</td>
                    <td className="px-6 py-4 text-neutral-500">{formatDateBr(c.paidOn) || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black', BADGE[c.group])}>{k(`status_${c.group}`)}</span>
                      {c.refundRequested && <span data-testid="charges-refund-pending" className="ml-1.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">{k('refund_pending')}</span>}
                    </td>
                    <td className="px-6 py-4 text-neutral-500">{methodText(c.method)}</td>
                    <td className="px-6 py-4 text-right">{linkFor(c)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {availableActions(c).map(a => (
                          <button key={a} type="button" data-testid={`charge-action-${a}`} onClick={() => setAct({ action: a, charge: c })}
                            className={cn('rounded-lg px-2.5 py-1 text-[10px] font-black transition-all',
                              a === 'refund' ? 'bg-amber-500/10 text-amber-700 hover:bg-amber-500 hover:text-white dark:text-amber-300'
                                : 'bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white dark:text-red-300')}>
                            {k(`act_${a}`)}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-6 py-3 text-[11px] text-neutral-500 dark:border-neutral-850">
            <span data-testid="charges-range">{k('page_info', { from: first, to: last, total: data.total })}</span>
            <div className="flex gap-2">
              <button type="button" data-testid="charges-prev" disabled={data.page <= 0 || loading} onClick={() => update({ page: data.page - 1 })}
                className="rounded-xl border border-neutral-200 px-3 py-1.5 font-bold hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800">{k('prev')}</button>
              <button type="button" data-testid="charges-next" disabled={data.page >= maxPage || loading} onClick={() => update({ page: data.page + 1 })}
                className="rounded-xl border border-neutral-200 px-3 py-1.5 font-bold hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800">{k('next')}</button>
            </div>
          </div>
        )}
      </div>
      {summary?.truncated && <p className="text-[11px] text-neutral-400">{k('truncated_note')}</p>}

      {act && (
        <ChargeActionModal action={act.action} charge={act.charge} k={k} onClose={() => setAct(null)}
          onDone={async (message, warning) => { setAct(null); toast(message, 'success'); if (warning) toast(warning, 'error'); await reload() }} />
      )}
    </div>
  )
}
