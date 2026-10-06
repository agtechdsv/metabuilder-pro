'use client'

import React, { useMemo, useState } from 'react'
import { ChevronDown, ShieldCheck, Gauge, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { CACHE_OPTIONS, REFRESH_OPTIONS, TIMEOUT_OPTIONS } from '@/lib/bi/perf'
import type { RlsRule, RlsSource } from '@/lib/bi/access'

interface Props {
  /** analytics_config atual do caso de uso */
  analytics: any
  /** grava campos no analytics_config (mesmo padrão dos grupos) */
  setAnalytics: (patch: any) => void
  models: any[]
}

const selectCls = 'w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-2 text-[10px] font-bold text-neutral-900 dark:text-white'
const inputCls = selectCls + ' placeholder:text-neutral-400 placeholder:font-medium'
const labelCls = 'text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1'

/** Desempenho (cache, atualização automática, tempo limite) e acesso por linha (RLS) do painel de BI. */
export function AnalyticsAccessPanel({ analytics, setAnalytics, models }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const rules: RlsRule[] = Array.isArray(analytics?.rls) ? analytics.rls : []

  // "tabela.coluna" de todas as tabelas do projeto; a coluna dos usuários também vira sugestão para o atributo
  const fieldOptions = useMemo(
    () => (models || []).flatMap((m: any) => (m.fields || []).map((f: any) => `${m.db_table_name}.${f.db_column_name}`)),
    [models],
  )
  const columnNames = useMemo(
    () => [...new Set((models || []).flatMap((m: any) => (m.fields || []).map((f: any) => String(f.db_column_name))))].sort(),
    [models],
  )

  const unit = (seconds: number) =>
    seconds >= 3600 ? t('bi_access.unit_h').replace('{n}', String(seconds / 3600))
      : seconds >= 60 ? t('bi_access.unit_min').replace('{n}', String(seconds / 60))
        : t('bi_access.unit_s').replace('{n}', String(seconds))

  const setRules = (next: RlsRule[]) => setAnalytics({ rls: next })
  const patchRule = (i: number, patch: Partial<RlsRule>) => setRules(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const addRule = () => setRules([...rules, { id: `rls_${Date.now().toString(36)}`, field: '', op: 'eq', source: 'user.attr', attr: '' }])
  const summary = [
    analytics?.cache_seconds ? `${t('bi_access.cache_short')} ${unit(analytics.cache_seconds)}` : null,
    analytics?.refresh_seconds ? `${t('bi_access.refresh_short')} ${unit(analytics.refresh_seconds)}` : null,
    rules.length ? `${rules.length} ${rules.length === 1 ? t('bi_access.rule_one') : t('bi_access.rule_many')}` : null,
  ].filter(Boolean).join(' · ')

  const seconds = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

  return (
    <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-white/70 dark:bg-neutral-950/40">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-200">{t('bi_access.title')}</span>
        {summary && <span className="text-[9px] font-bold text-neutral-400 truncate">{summary}</span>}
        <ChevronDown className={cn('w-4 h-4 ml-auto text-neutral-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-5">
          {/* Desempenho */}
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-indigo-600"><Gauge className="w-3.5 h-3.5" /> {t('bi_access.perf_title')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls}>{t('bi_access.cache_label')}</label>
                <select className={selectCls} value={seconds(analytics?.cache_seconds, 0)} onChange={e => setAnalytics({ cache_seconds: Number(e.target.value) })}>
                  {CACHE_OPTIONS.map(s => <option key={s} value={s}>{s === 0 ? t('bi_access.cache_off') : unit(s)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>{t('bi_access.refresh_label')}</label>
                <select className={selectCls} value={seconds(analytics?.refresh_seconds, 0)} onChange={e => setAnalytics({ refresh_seconds: Number(e.target.value) })}>
                  {REFRESH_OPTIONS.map(s => <option key={s} value={s}>{s === 0 ? t('bi_access.refresh_off') : unit(s)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>{t('bi_access.timeout_label')}</label>
                <select className={selectCls} value={seconds(analytics?.timeout_seconds, 30)} onChange={e => setAnalytics({ timeout_seconds: Number(e.target.value) })}>
                  {TIMEOUT_OPTIONS.map(s => <option key={s} value={s}>{unit(s)}</option>)}
                </select>
              </div>
            </div>
            <p className="text-[9px] font-bold text-neutral-400 leading-relaxed">{t('bi_access.perf_hint')}</p>
          </div>

          {/* Acesso por linha */}
          <div className="space-y-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-indigo-600"><ShieldCheck className="w-3.5 h-3.5" /> {t('bi_access.rls_title')}</p>
              <button type="button" onClick={addRule} className="flex items-center gap-1 text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full border bg-neutral-100 border-neutral-200 text-neutral-500 hover:bg-neutral-200 transition-all">
                <Plus className="w-3 h-3" /> {t('bi_access.rls_add')}
              </button>
            </div>
            <p className="text-[9px] font-bold text-neutral-400 leading-relaxed">{t('bi_access.rls_desc')}</p>
            {rules.length === 0 && <p className="text-[9px] font-bold text-neutral-400">{t('bi_access.rls_empty')}</p>}

            {rules.map((r, i) => (
              <div key={r.id || i} className="space-y-3 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <label className={labelCls}>{t('bi_access.rls_field')}</label>
                    <select className={selectCls} value={r.field} onChange={e => patchRule(i, { field: e.target.value })}>
                      <option value="">{t('bi_access.rls_select_field')}</option>
                      {r.field && !fieldOptions.includes(r.field) && <option value={r.field}>⚠ {r.field}</option>}
                      {fieldOptions.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <label className={labelCls}>{t('bi_access.rls_op')}</label>
                    <select className={selectCls} value={r.op} onChange={e => patchRule(i, { op: e.target.value === 'in' ? 'in' : 'eq' })}>
                      <option value="eq">{t('bi_access.rls_op_eq')}</option>
                      <option value="in">{t('bi_access.rls_op_in')}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <label className={labelCls}>{t('bi_access.rls_source')}</label>
                    <select
                      className={selectCls}
                      value={r.source}
                      onChange={e => {
                        const source = e.target.value as RlsSource
                        patchRule(i, { source, attr: source === 'user.attr' ? r.attr || '' : undefined })
                      }}
                    >
                      <option value="user.email">{t('bi_access.rls_src_email')}</option>
                      <option value="user.name">{t('bi_access.rls_src_name')}</option>
                      <option value="user.attr">{t('bi_access.rls_src_attr')}</option>
                    </select>
                  </div>
                  {r.source === 'user.attr' && (
                    <div className="space-y-1.5 min-w-0">
                      <label className={labelCls}>{t('bi_access.rls_attr')}</label>
                      <input className={inputCls} list="bi-rls-columns" value={r.attr || ''} placeholder={t('bi_access.rls_attr_ph')} onChange={e => patchRule(i, { attr: e.target.value.trim() })} />
                    </div>
                  )}
                </div>

                {/* exceção: quem não sofre esta regra (ex.: perfil admin) */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-neutral-600 dark:text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                      checked={!!r.bypass}
                      onChange={e => patchRule(i, { bypass: e.target.checked ? { source: 'user.attr', attr: '', values: [] } : undefined })}
                    />
                    {t('bi_access.rls_bypass')}
                  </label>
                  {r.bypass && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-6">
                      <select className={selectCls} value={r.bypass.source} onChange={e => patchRule(i, { bypass: { ...r.bypass!, source: e.target.value as RlsSource } })}>
                        <option value="user.email">{t('bi_access.rls_src_email')}</option>
                        <option value="user.name">{t('bi_access.rls_src_name')}</option>
                        <option value="user.attr">{t('bi_access.rls_src_attr')}</option>
                      </select>
                      {r.bypass.source === 'user.attr' ? (
                        <input className={inputCls} list="bi-rls-columns" value={r.bypass.attr || ''} placeholder={t('bi_access.rls_bypass_attr_ph')} onChange={e => patchRule(i, { bypass: { ...r.bypass!, attr: e.target.value.trim() } })} />
                      ) : <span />}
                      <input
                        className={inputCls}
                        value={r.bypass.values.join(', ')}
                        placeholder={t('bi_access.rls_bypass_values_ph')}
                        onChange={e => patchRule(i, { bypass: { ...r.bypass!, values: e.target.value.split(',').map(v => v.trim()).filter(Boolean) } })}
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button type="button" onClick={() => setRules(rules.filter((_, idx) => idx !== i))} className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-neutral-400 hover:text-red-500">
                    <Trash2 className="w-3 h-3" /> {t('bi_access.rls_remove')}
                  </button>
                </div>
              </div>
            ))}

            <datalist id="bi-rls-columns">{columnNames.map(c => <option key={c} value={c} />)}</datalist>

            <div className="space-y-1 text-[9px] font-bold leading-relaxed">
              <p className="text-emerald-600 dark:text-emerald-400">✓ {t('bi_access.rls_note_export')}</p>
              <p className="text-amber-600 dark:text-amber-400">⚠ {t('bi_access.rls_note_panel')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
