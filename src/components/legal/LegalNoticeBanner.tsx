'use client'

import React, { useEffect, useState } from 'react'
import { FileText, Loader2, X } from 'lucide-react'
import { acceptLegalAction, myLegalStatusAction } from '@/app/actions/legalAcceptance'
import { useI18n } from '@/i18n/I18nContext'
import { LegalModal } from '@/components/legal/LegalModal'
import { TermsContent } from '@/components/legal/TermsContent'
import { PrivacyContent } from '@/components/legal/PrivacyContent'

/**
 * Aviso para quem já era cliente quando os Termos de Serviço e a Política de Privacidade mudaram (versão em src/lib/legal/legalVersions.ts): pede o aceite
 * da versão vigente. "Depois" só esconde nesta visita; o aceite grava no servidor (tabela terms_acceptances) e o aviso some de vez. Quem já aceitou, ou se a
 * consulta falhar, não vê nada: o aviso nunca atrapalha o painel.
 */
export function LegalNoticeBanner() {
  const { t } = useI18n()
  const [needs, setNeeds] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [doc, setDoc] = useState<'terms' | 'privacy' | null>(null)

  useEffect(() => {
    let alive = true
    void myLegalStatusAction().then(s => { if (alive) setNeeds(s.needsAcceptance) }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (!needs || hidden) return null

  const accept = async () => {
    setSaving(true)
    setError(false)
    const r = await acceptLegalAction('notice')
    setSaving(false)
    if (r.success) setHidden(true); else setError(true)
  }

  return (
    <div role="status" data-testid="legal-notice" className="flex flex-wrap items-center gap-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
      <FileText className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black">{t('legal.notice_title', 'Atualizamos os Termos de Serviço e a Política de Privacidade')}</p>
        <p className="mt-0.5 text-xs">{t('legal.notice_desc', 'Incluímos regras de cobrança, renovação, reajuste, cancelamento e reembolso, e informações sobre os dados de cobrança. Leia e confirme o seu aceite.')}</p>
        <p className="mt-1 flex flex-wrap gap-x-4 text-xs font-bold">
          <button type="button" onClick={() => setDoc('terms')} className="underline hover:opacity-80">{t('terms.title', 'Termos de Serviço')}</button>
          <button type="button" onClick={() => setDoc('privacy')} className="underline hover:opacity-80">{t('privacy.title', 'Política de Privacidade')}</button>
        </p>
        {error && <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">{t('legal.accept_error', 'Não foi possível registrar o seu aceite. Tente novamente.')}</p>}
      </div>
      <button type="button" data-testid="legal-notice-accept" disabled={saving} onClick={accept}
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-60">
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {saving ? t('legal.notice_accepting', 'Registrando...') : t('legal.notice_accept', 'Li e aceito')}
      </button>
      <button type="button" aria-label={t('legal.notice_dismiss', 'Depois')} title={t('legal.notice_dismiss', 'Depois')} onClick={() => setHidden(true)}
        className="rounded-lg p-1.5 text-indigo-700/70 hover:bg-indigo-100 dark:text-indigo-300/70 dark:hover:bg-indigo-900/40">
        <X className="h-4 w-4" />
      </button>
      <LegalModal isOpen={doc !== null} onClose={() => setDoc(null)} title={doc === 'privacy' ? t('privacy.title') : t('terms.title')}>
        {doc === 'privacy' ? <PrivacyContent /> : <TermsContent />}
      </LegalModal>
    </div>
  )
}
