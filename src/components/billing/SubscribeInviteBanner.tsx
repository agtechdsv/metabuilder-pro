'use client'

import React from 'react'
import { Sparkles } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { SUBSCRIBE_INVITE_HREF } from '@/lib/billing/subscribeInvite'

const P = 'subscribe_invite.'

/** Convite para assinar, para quem ainda não tem plano (o servidor decide se mostra; ver shouldShowSubscribeInvite). */
export default function SubscribeInviteBanner() {
  const { t } = useI18n()
  return (
    <div role="status" className="flex flex-wrap items-center gap-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
      <Sparkles className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black">{t(P + 'title')}</p>
        <p className="mt-0.5 text-xs">{t(P + 'desc')}</p>
      </div>
      <a href={SUBSCRIBE_INVITE_HREF}
        className="rounded-xl bg-neutral-900 px-4 py-2 text-xs font-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black">
        {t(P + 'button')}
      </a>
    </div>
  )
}
