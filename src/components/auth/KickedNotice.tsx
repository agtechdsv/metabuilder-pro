'use client'

import { LogOut } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

/** Aviso na tela de entrada: "sua sessão foi encerrada porque você entrou em outro lugar". */
export function KickedNotice({ city, time }: { city?: string; time?: string }) {
  const { t, language } = useI18n()
  const k = (key: string) => t(`device_sessions.${key}`)
  const when = time && !Number.isNaN(new Date(time).getTime()) ? new Date(time).toLocaleString(language) : ''
  const message = city && when ? k('kicked_desc_place').replace('{place}', city).replace('{time}', when) : k('kicked_desc')
  return (
    <div role="status" className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
      <LogOut className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div>
        <p className="font-bold text-amber-900 dark:text-amber-200">{k('kicked_title')}</p>
        <p className="text-amber-800 dark:text-amber-300/80">{message}</p>
      </div>
    </div>
  )
}
