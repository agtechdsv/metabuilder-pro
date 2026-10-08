'use client'

import { useState } from 'react'
import { History, Copy, Check, Power } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { Modal } from '@/components/ui/Modal'
import { auditSql, effectiveAudit, DEFAULT_AUDIT_BY, type AuditColumns, type AuditConfig } from '@/lib/rowPolicy/audit'
import { useAuthTable } from './useAuthTable'

/**
 * Auditoria de UMA tabela (Dados & Schemas): quais colunas guardam quando/por quem o registro foi criado e alterado.
 * Quem preenche é o servidor (Agente CLI ou app exportado), nunca a tela. Sem nada salvo, valem as colunas reconhecidas pelo nome.
 */
interface Props {
  project: any
  models: any[]
  tableName: string
  /** colunas da tabela que está sendo editada */
  columns: string[]
  value: AuditConfig | null
  onChange: (cfg: AuditConfig | null) => void
}

const t0 = 'dashboard.projects.studio.metadata.audit_'
const selectCls = 'w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 transition-colors'
const labelCls = 'text-[10px] font-black uppercase tracking-widest text-neutral-500'

const KEYS: Array<{ key: keyof AuditColumns; label: string }> = [
  { key: 'createdAt', label: 'created_at' },
  { key: 'createdBy', label: 'created_by' },
  { key: 'updatedAt', label: 'updated_at' },
  { key: 'updatedBy', label: 'updated_by' },
]

export function AuditEditor({ project, models, tableName, columns, value, onChange }: Props) {
  const { t } = useI18n()
  const auth = useAuthTable(project, models)
  const [sqlOpen, setSqlOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const effective = effectiveAudit(value, columns)
  const disabled = !!value?.disabled
  const detected = !value && !!effective
  const shown: AuditColumns = effective?.columns || {}
  const by = value?.by || effective?.by || DEFAULT_AUDIT_BY

  // editar uma coluna parte do que está valendo agora (assim as outras reconhecidas pelo nome não se perdem)
  const patch = (p: Partial<AuditConfig>) => onChange({ ...shown, by, ...(value || {}), ...p })
  const setColumn = (key: keyof AuditColumns, col: string) => patch({ [key]: col || undefined } as Partial<AuditConfig>)

  const sql = auditSql({ table: tableName, authTable: auth.table || undefined, existing: columns, names: shown })
  const copy = async () => {
    try { await navigator.clipboard.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* sem permissão de área de transferência */ }
  }

  const byMode = by.source === 'user.attr' ? (by.attr === 'id' ? 'id' : 'attr') : by.source === 'user.email' ? 'email' : 'name'
  const setByMode = (mode: string) => {
    if (mode === 'id') patch({ by: { source: 'user.attr', attr: 'id' } })
    else if (mode === 'email') patch({ by: { source: 'user.email' } })
    else if (mode === 'name') patch({ by: { source: 'user.name' } })
    else patch({ by: { source: 'user.attr', attr: auth.columns.find(c => c !== 'id') || '' } })
  }

  return (
    <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800/80 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <span className={`${labelCls} flex items-center gap-1.5`}>
            <History className="w-4 h-4 text-indigo-500" /> {t(t0 + 'title')}
            {detected && <span className="ml-2 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 text-[9px] tracking-widest">{t(t0 + 'detected')}</span>}
            {!!value && !disabled && <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[9px] tracking-widest">{t(t0 + 'configured')}</span>}
          </span>
          <p className="text-[11px] text-neutral-500 leading-relaxed max-w-3xl">{t(t0 + 'desc')}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {!disabled && (
            <button type="button" onClick={() => setSqlOpen(true)} className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-indigo-600 hover:border-indigo-400 transition-all">
              {t(t0 + 'sql')}
            </button>
          )}
          <button
            type="button"
            onClick={() => onChange(disabled ? null : { disabled: true })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-indigo-600 hover:border-indigo-400 transition-all"
          >
            <Power className="w-3.5 h-3.5" /> {disabled ? t(t0 + 'enable') : t(t0 + 'disable')}
          </button>
        </div>
      </div>

      {disabled ? (
        <p className="text-[11px] text-neutral-400">{t(t0 + 'off')}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {KEYS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <label className={labelCls}>{t(t0 + label)}</label>
                <select className={selectCls} value={shown[key] || ''} onChange={e => setColumn(key, e.target.value)}>
                  <option value="">{t(t0 + 'none')}</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
          </div>

          {(shown.createdBy || shown.updatedBy) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelCls}>{t(t0 + 'by_title')}</label>
                <select className={selectCls} value={byMode} onChange={e => setByMode(e.target.value)}>
                  <option value="id">{t(t0 + 'by_id')}</option>
                  <option value="email">{t(t0 + 'by_email')}</option>
                  <option value="name">{t(t0 + 'by_name')}</option>
                  <option value="attr">{t(t0 + 'by_attr')}</option>
                </select>
              </div>
              {byMode === 'attr' && (
                <div className="space-y-1">
                  <label className={labelCls}>{t('dashboard.projects.studio.metadata.row_policy_attr_column')}</label>
                  {auth.columns.length > 0 ? (
                    <select className={selectCls} value={by.attr || ''} onChange={e => patch({ by: { source: 'user.attr', attr: e.target.value } })}>
                      <option value="">{t('dashboard.projects.studio.metadata.row_policy_select_column')}</option>
                      {auth.columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input className={selectCls} value={by.attr || ''} onChange={e => patch({ by: { source: 'user.attr', attr: e.target.value } })} />
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Modal isOpen={sqlOpen} onClose={() => setSqlOpen(false)} title={t(t0 + 'sql_title')}>
        <div className="space-y-3">
          <p className="text-xs text-neutral-500">{t(t0 + 'sql_hint')}</p>
          <textarea readOnly value={sql} rows={16} className="w-full font-mono text-[11px] bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 outline-none" />
          <div className="flex justify-end">
            <button type="button" onClick={copy} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? t(t0 + 'sql_copied') : t(t0 + 'sql_copy')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
