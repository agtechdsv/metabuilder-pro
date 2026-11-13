'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send } from 'lucide-react'
import { submitMyPixKey } from '@/app/actions/partners'
import { useI18n } from '@/i18n/I18nContext'
import { PIX_KEY_TYPES } from '../../../supabase/functions/_shared/partnerCommission'
import type { PartnerErrorCode, PixSubmitInput } from '@/lib/partners'

const P = 'partner_panel.'
const inputCls = 'w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm font-bold dark:border-neutral-700'
const labelCls = 'mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400'

/**
 * Formulário do parceiro para enviar a chave Pix. A chave NÃO vale na hora: o servidor a guarda como pendente e o SuperAdmin confere e aceita
 * (só a chave ativa entra em lote). A validação de verdade é no servidor; aqui é só ajuda para a pessoa.
 */
export default function PartnerPixForm({ onCancel }: { onCancel?: () => void }) {
  const { t } = useI18n()
  const router = useRouter()
  const [f, setF] = useState<PixSubmitInput>({ pixKeyType: 'CPF', pixKey: '', document: '', declaration: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const r = await submitMyPixKey(f)
      if (r.success) { router.refresh(); onCancel?.() }
      else {
        const known: PartnerErrorCode[] = ['pix_invalid', 'document_invalid', 'declaration_required']
        setError(t(P + 'pix_err_' + (known.includes(r.code) ? r.code : 'unknown')))
      }
    } catch { setError(t(P + 'pix_err_unknown')) }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-indigo-200 p-5 dark:border-indigo-900" noValidate>
      <div>
        <h2 className="text-base font-black">{t(P + 'pix_title')}</h2>
        <p className="mt-1 text-xs text-neutral-500">{t(P + 'pix_desc')}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block"><span className={labelCls}>{t(P + 'pix_type')}</span>
          <select className={inputCls} value={f.pixKeyType} onChange={e => setF({ ...f, pixKeyType: e.target.value as PixSubmitInput['pixKeyType'] })}>
            {PIX_KEY_TYPES.map(k => <option key={k} value={k}>{k}</option>)}
          </select></label>
        <label className="block"><span className={labelCls}>{t(P + 'pix_key')}</span>
          <input className={inputCls} value={f.pixKey} onChange={e => setF({ ...f, pixKey: e.target.value })} maxLength={120} autoComplete="off" /></label>
        <label className="block"><span className={labelCls}>{t(P + 'pix_document')}</span>
          <input className={inputCls} value={f.document} onChange={e => setF({ ...f, document: e.target.value })} maxLength={20} autoComplete="off" /></label>
      </div>
      <label className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-300">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={f.declaration} onChange={e => setF({ ...f, declaration: e.target.checked })} />
        <span>{t(P + 'pix_declaration')}</span>
      </label>
      {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-bold text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-500 disabled:opacity-60">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{busy ? t(P + 'pix_sending') : t(P + 'pix_submit')}
        </button>
        {onCancel && <button type="button" disabled={busy} onClick={onCancel} className="rounded-xl bg-neutral-100 px-4 py-2 text-xs font-black text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">{t(P + 'pix_cancel')}</button>}
      </div>
    </form>
  )
}
