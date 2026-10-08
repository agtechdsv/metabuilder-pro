'use client'

import { useEffect, useMemo, useState } from 'react'
import { Lock, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useI18n } from '@/i18n/I18nContext'
import type { RowPolicyRule, PolicyOp } from '@/lib/rowPolicy/policy'
import type { RlsSource } from '@/lib/bi/access'
import { useAuthTable } from './useAuthTable'

/**
 * Acesso por linha de UMA tabela (Dados & Schemas). As regras valem para o usuário final em todas as telas, no BI e nas
 * exportações; o Agente CLI as aplica ao SQL (veja lib/rowPolicy). Sem regra, todos veem todas as linhas.
 */
interface Props {
  project: any
  models: any[]
  /** colunas da tabela que está sendo editada */
  columns: string[]
  rules: RowPolicyRule[]
  onChange: (rules: RowPolicyRule[]) => void
  /** coluna de "criado por" da auditoria desta tabela (se houver): habilita o atalho "só os registros que eu criei" */
  createdBy?: { column: string; by: { source: RlsSource; attr?: string } }
}

const t0 = 'dashboard.projects.studio.metadata.row_policy_'
const inputCls = 'w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 transition-colors'
const labelCls = 'text-[10px] font-black uppercase tracking-widest text-neutral-500'

function Select({ value, onChangeValue, children }: { value: string; onChangeValue: (v: string) => void; children: React.ReactNode }) {
  return <select className={inputCls} value={value} onChange={e => onChangeValue(e.target.value)}>{children}</select>
}

let seq = 0
const newId = () => `rp_${Date.now().toString(36)}_${seq++}`

export function RowPolicyEditor({ project, models, columns, rules, onChange, createdBy }: Props) {
  const { t } = useI18n()
  const supabase = useMemo(() => createClient(), [])

  // tabela de usuários do login: de onde vêm os dados do usuário que a regra compara
  const { table: authTable, columns: authColumns } = useAuthTable(project, models)
  const [relatedCols, setRelatedCols] = useState<Record<string, string[]>>({})

  const colsOfTable = async (table: string): Promise<string[]> => {
    const model = models.find(m => String(m.db_table_name).toLowerCase() === table.toLowerCase())
    if (!model) return []
    const { data } = await supabase.from('fields').select('db_column_name').eq('model_id', model.id)
    return ((data as any[]) || []).map(f => String(f.db_column_name)).filter(Boolean).sort()
  }

  // colunas das tabelas relacionadas escolhidas (carregadas sob demanda)
  const wanted = Array.from(new Set(rules.map(r => r.related?.table).filter(Boolean) as string[]))
  useEffect(() => {
    wanted.forEach(async table => {
      if (relatedCols[table]) return
      const cols = await colsOfTable(table)
      setRelatedCols(prev => ({ ...prev, [table]: cols }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted.join('|')])

  const patch = (i: number, p: Partial<RowPolicyRule>) => onChange(rules.map((r, idx) => (idx === i ? { ...r, ...p } : r)))
  const add = () => onChange([...rules, { id: newId(), column: '', op: 'eq', source: 'user.attr', attr: '' }])
  const remove = (i: number) => onChange(rules.filter((_, idx) => idx !== i))
  const tableNames = models.map(m => String(m.db_table_name)).filter(Boolean).sort()

  return (
    <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800/80 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <span className={`${labelCls} flex items-center gap-1.5`}>
            <Lock className="w-4 h-4 text-indigo-500" /> {t(t0 + 'title')}
          </span>
          <p className="text-[11px] text-neutral-500 leading-relaxed max-w-3xl">{t(t0 + 'desc')}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {createdBy && !rules.some(r => r.column.toLowerCase() === createdBy.column.toLowerCase() && r.op === 'eq') && (
            <button
              type="button"
              title={t('dashboard.projects.studio.metadata.audit_mine_hint')}
              onClick={() => onChange([...rules, { id: newId(), column: createdBy.column, op: 'eq', source: createdBy.by.source, ...(createdBy.by.attr ? { attr: createdBy.by.attr } : {}) }])}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all"
            >
              {t('dashboard.projects.studio.metadata.audit_mine_rule')}
            </button>
          )}
          <button
            type="button"
            onClick={add}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-indigo-600 hover:border-indigo-400 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> {t(t0 + 'add')}
          </button>
        </div>
      </div>

      {rules.length === 0 && <p className="text-[11px] text-neutral-400">{t(t0 + 'none')}</p>}

      {authTable === null && rules.length > 0 && (
        <p className="flex items-start gap-2 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {t(t0 + 'warn_no_auth')}
        </p>
      )}

      {rules.map((rule, i) => {
        const relCols = rule.related ? relatedCols[rule.related.table] || [] : []
        const attrMissing = rule.source === 'user.attr' && !!rule.attr && authColumns.length > 0 && !authColumns.some(c => c.toLowerCase() === rule.attr!.toLowerCase())
        const bypassMissing = !!rule.bypass && rule.bypass.source === 'user.attr' && !!rule.bypass.attr && authColumns.length > 0 && !authColumns.some(c => c.toLowerCase() === rule.bypass!.attr!.toLowerCase())
        return (
          <div key={rule.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelCls}>{t(t0 + 'column')}</label>
                <Select value={rule.column} onChangeValue={v => patch(i, { column: v })}>
                  <option value="">{t(t0 + 'select_column')}</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <label className={labelCls}>{t(t0 + 'condition')}</label>
                <Select
                  value={rule.op}
                  onChangeValue={v => patch(i, { op: v as PolicyOp, ...(v === 'related' ? { related: rule.related || { table: '', key: '', column: '' } } : {}) })}
                >
                  <option value="eq">{t(t0 + 'op_eq')}</option>
                  <option value="in">{t(t0 + 'op_in')}</option>
                  <option value="related">{t(t0 + 'op_related')}</option>
                </Select>
              </div>

              {rule.op === 'related' && (
                <>
                  <div className="space-y-1">
                    <label className={labelCls}>{t(t0 + 'related_table')}</label>
                    <Select value={rule.related?.table || ''} onChangeValue={v => patch(i, { related: { table: v, key: '', column: '' } })}>
                      <option value="">{t(t0 + 'select_column')}</option>
                      {tableNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={labelCls}>{t(t0 + 'related_key')}</label>
                      <Select value={rule.related?.key || ''} onChangeValue={v => patch(i, { related: { ...(rule.related as any), key: v } })}>
                        <option value="">{t(t0 + 'select_column')}</option>
                        {relCols.map(c => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className={labelCls}>{t(t0 + 'related_column')}</label>
                      <Select value={rule.related?.column || ''} onChangeValue={v => patch(i, { related: { ...(rule.related as any), column: v } })}>
                        <option value="">{t(t0 + 'select_column')}</option>
                        {relCols.map(c => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1">
                <label className={labelCls}>{t(t0 + 'user_value')}</label>
                <Select value={rule.source} onChangeValue={v => patch(i, { source: v as any, ...(v === 'user.attr' ? {} : { attr: undefined }) })}>
                  <option value="user.email">{t(t0 + 'src_email')}</option>
                  <option value="user.name">{t(t0 + 'src_name')}</option>
                  <option value="user.attr">{t(t0 + 'src_attr')}</option>
                </Select>
              </div>
              {rule.source === 'user.attr' && (
                <div className="space-y-1">
                  <label className={labelCls}>{t(t0 + 'attr_column')}</label>
                  {authColumns.length > 0 ? (
                    <Select value={rule.attr || ''} onChangeValue={v => patch(i, { attr: v })}>
                      <option value="">{t(t0 + 'select_column')}</option>
                      {authColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  ) : (
                    <input className={inputCls} value={rule.attr || ''} placeholder="ex.: funcionario_id" onChange={e => patch(i, { attr: e.target.value })} />
                  )}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-neutral-600 dark:text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-indigo-600"
                checked={!!rule.bypass}
                onChange={e => patch(i, { bypass: e.target.checked ? { source: 'user.attr', attr: '', values: [] } : undefined })}
              />
              {t(t0 + 'bypass')}
            </label>

            {rule.bypass && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pl-6">
                <Select value={rule.bypass.source} onChangeValue={v => patch(i, { bypass: { ...rule.bypass!, source: v as any, ...(v === 'user.attr' ? {} : { attr: undefined }) } })}>
                  <option value="user.email">{t(t0 + 'src_email')}</option>
                  <option value="user.name">{t(t0 + 'src_name')}</option>
                  <option value="user.attr">{t(t0 + 'src_attr')}</option>
                </Select>
                {rule.bypass.source === 'user.attr' ? (
                  authColumns.length > 0 ? (
                    <Select value={rule.bypass.attr || ''} onChangeValue={v => patch(i, { bypass: { ...rule.bypass!, attr: v } })}>
                      <option value="">{t(t0 + 'select_column')}</option>
                      {authColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  ) : (
                    <input className={inputCls} value={rule.bypass.attr || ''} placeholder="ex.: perfil" onChange={e => patch(i, { bypass: { ...rule.bypass!, attr: e.target.value } })} />
                  )
                ) : <span />}
                <input
                  className={inputCls}
                  value={rule.bypass.values.join(', ')}
                  placeholder={t(t0 + 'bypass_hint')}
                  title={t(t0 + 'bypass_values')}
                  onChange={e => patch(i, { bypass: { ...rule.bypass!, values: e.target.value.split(',').map(v => v.trim()).filter(Boolean) } })}
                />
              </div>
            )}

            {(attrMissing || bypassMissing) && (
              <p className="flex items-center gap-2 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {t(t0 + 'warn_attr').replace('{attr}', attrMissing ? rule.attr || '' : rule.bypass?.attr || '')}
              </p>
            )}

            <div className="flex justify-end">
              <button type="button" onClick={() => remove(i)} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> {t(t0 + 'remove')}
              </button>
            </div>
          </div>
        )
      })}

      {rules.length > 0 && <p className="text-[10px] text-neutral-400">{t(t0 + 'fail_closed')}</p>}
    </div>
  )
}
