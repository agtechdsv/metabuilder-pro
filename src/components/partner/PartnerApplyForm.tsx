'use client'

import React, { useRef, useState } from 'react'
import { LegalModal } from '@/components/legal/LegalModal'
import { PrivacyContent } from '@/components/legal/PrivacyContent'
import { CheckCircle2, Loader2, Send } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { submitPartnerApplication } from '@/app/actions/partnerApplications'
import { APPLICATION_CHANNELS, type ApplicationErrorCode } from '@/lib/partnerApplications'

const inputCls = 'w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white'
const labelCls = 'mb-1.5 block text-[11px] font-black uppercase tracking-widest text-neutral-500'

const ERR_KEY: Record<ApplicationErrorCode, string> = {
  name_invalid: 'err_name', email_invalid: 'err_email', phone_invalid: 'err_phone', channel_invalid: 'err_channel', text_too_long: 'err_long',
  consent_required: 'err_consent', too_fast: 'err_fast', rate_limited: 'err_rate', unknown: 'err_unknown',
}

/** Formulário público de candidatura a parceiro. A validação de verdade é no servidor; aqui é só ajuda para a pessoa. */
export default function PartnerApplyForm() {
  const { t, language } = useI18n()
  const k = (key: string) => t(`partner_apply.${key}`)
  // quando o formulário abriu: o servidor recusa envio rápido demais (robô)
  const openedAt = useRef(Date.now())
  const [f, setF] = useState({ name: '', email: '', phone: '', company: '', channel: '', audience: '', message: '', website: '' })
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [legalOpen, setLegalOpen] = useState(false)
  const set = (key: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF(prev => ({ ...prev, [key]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const r = await submitPartnerApplication({ ...f, consent, lang: String(language || 'pt'), openedAt: openedAt.current })
      if (r.success) setDone(true)
      else setError(k(ERR_KEY[r.code] || 'err_unknown'))
    } catch { setError(k('err_unknown')) }
    setBusy(false)
  }

  if (done) {
    return (
      <div role="status" className="rounded-[2.5rem] border border-emerald-500/30 bg-emerald-500/5 p-10 text-center space-y-4">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <h3 className="text-2xl font-black dark:text-white">{k('done_title')}</h3>
        <p className="mx-auto max-w-xl text-neutral-600 dark:text-neutral-300 leading-relaxed">{k('done_desc')}</p>
      </div>
    )
  }

  return (
    <>
    <form onSubmit={submit} className="rounded-[2.5rem] border border-neutral-200 bg-white p-8 md:p-10 dark:border-neutral-800 dark:bg-neutral-900 space-y-5" noValidate>
      <div className="space-y-2">
        <h3 className="text-2xl font-black dark:text-white">{k('title')}</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{k('desc')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block"><span className={labelCls}>{k('name')}</span>
          <input className={inputCls} value={f.name} onChange={set('name')} maxLength={120} autoComplete="name" required /></label>
        <label className="block"><span className={labelCls}>{k('email')}</span>
          <input type="email" className={inputCls} value={f.email} onChange={set('email')} maxLength={200} autoComplete="email" required /></label>
        <label className="block"><span className={labelCls}>{k('phone')}</span>
          <input type="tel" className={inputCls} value={f.phone} onChange={set('phone')} maxLength={40} autoComplete="tel" /></label>
        <label className="block"><span className={labelCls}>{k('company')}</span>
          <input className={inputCls} value={f.company} onChange={set('company')} maxLength={120} autoComplete="organization" /></label>
        <label className="block md:col-span-2"><span className={labelCls}>{k('channel')}</span>
          <select className={inputCls} value={f.channel} onChange={set('channel')} required>
            <option value="">{k('channel_pick')}</option>
            {APPLICATION_CHANNELS.map(c => <option key={c} value={c}>{k(`channel_${c}`)}</option>)}
          </select></label>
        <label className="block md:col-span-2"><span className={labelCls}>{k('audience')}</span>
          <textarea className={inputCls} rows={3} value={f.audience} onChange={set('audience')} maxLength={600} /></label>
        <label className="block md:col-span-2"><span className={labelCls}>{k('message')}</span>
          <textarea className={inputCls} rows={3} value={f.message} onChange={set('message')} maxLength={2000} /></label>
      </div>

      {/* campo isca: invisível e fora do teclado; quem preenche é robô */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></label>
      </div>

      <label className="flex items-start gap-3 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={consent} onChange={e => setConsent(e.target.checked)} />
        <span>{k('consent')} <button type="button" onClick={() => setLegalOpen(true)} className="font-bold text-indigo-600 hover:underline">({t('footer.privacy')})</button></span>
      </label>

      {error && <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-600">{error}</p>}

      <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-8 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-500/25 transition-all hover:bg-indigo-700 disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{busy ? k('sending') : k('submit')}
      </button>
    </form>
    {/* fora do <form>: o botão "Entendido e aceito" da modal não pode enviar a candidatura */}
    <LegalModal isOpen={legalOpen} onClose={() => setLegalOpen(false)} title={t('privacy.title')}>
      <PrivacyContent />
    </LegalModal>
    </>
  )
}
