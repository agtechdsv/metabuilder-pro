'use client'

import { useState } from 'react'
import { Copy, Check, ShieldCheck } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { leastPrivilegeSql } from '@/lib/tunnel/dbRole'

interface Conn { name: string; type: string; database: string; user: string }

/**
 * Recomenda e gera o script do usuário de banco com privilégio mínimo para o Agente CLI (PostgreSQL e Oracle).
 * O MetaBuilder não executa nada no banco do cliente: o administrador copia e aplica.
 */
export function DbRoleCard({ connections }: { connections: Conn[] }) {
  const { t } = useI18n()
  const [index, setIndex] = useState(0)
  const [user, setUser] = useState('mb_agent')
  const [schema, setSchema] = useState('')
  const [copied, setCopied] = useState(false)

  const conn = connections[Math.min(index, connections.length - 1)]
  const engine = conn?.type === 'oracle' ? 'oracle' : conn?.type === 'postgresql' || conn?.type === 'postgres' ? 'postgres' : null
  const sql = engine ? leastPrivilegeSql({ engine, user, database: conn?.database, schema: schema || (engine === 'oracle' ? conn?.user : 'public') }) : ''

  const copy = async () => {
    try { await navigator.clipboard.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* sem permissão de área de transferência */ }
  }
  const input = 'w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black text-sm font-mono'

  return (
    <div>
      <h3 className="font-bold text-lg mb-1 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-indigo-500" /> {t('tunnel_relay.role_title')}</h3>
      <p className="text-sm text-neutral-500 mb-4">{t('tunnel_relay.role_desc')}</p>
      <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 rounded-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-neutral-500 mb-1">{t('tunnel_relay.role_conn')}</label>
            <select value={index} onChange={e => setIndex(Number(e.target.value))} className={input}>
              {connections.map((c, i) => <option key={i} value={i}>{c.name || `#${i + 1}`} ({c.type})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-500 mb-1">{t('tunnel_relay.role_user')}</label>
            <input value={user} onChange={e => setUser(e.target.value)} className={input} />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-500 mb-1">{engine === 'oracle' ? t('tunnel_relay.role_owner') : t('tunnel_relay.role_schema')}</label>
            <input value={schema} onChange={e => setSchema(e.target.value)} placeholder={engine === 'oracle' ? conn?.user : 'public'} className={input} />
          </div>
        </div>

        {engine ? (
          <>
            <textarea readOnly value={sql} rows={14} className="w-full font-mono text-[11px] bg-white dark:bg-black border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 outline-none" />
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] text-neutral-500 leading-relaxed">{engine === 'oracle' ? t('tunnel_relay.role_note_oracle') : t('tunnel_relay.role_note_pg')}</p>
              <button type="button" onClick={copy} className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? t('tunnel_relay.role_copied') : t('tunnel_relay.role_copy')}
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs text-neutral-500">{t('tunnel_relay.role_other')}</p>
        )}
      </div>
    </div>
  )
}
