'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { registerAskHost, type AskRequest } from '@/utils/askDialog'

/** Modal único das perguntas sim/não (askDialog). Atende uma por vez, na ordem em que chegam. */
export function AskDialogHost() {
  const { t } = useI18n()
  const [queue, setQueue] = useState<AskRequest[]>([])
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => registerAskHost(req => setQueue(q => [...q, req])), [])

  const current = queue[0]
  const answer = (ok: boolean) => {
    if (!current) return
    current.resolve(ok)
    setQueue(q => q.slice(1))
  }

  useEffect(() => {
    if (!current) return
    okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); answer(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null
  const { message, options } = current
  const danger = options.kind === 'warning' || options.kind === 'error'
  const Icon = danger ? AlertTriangle : HelpCircle

  return (
    <div className="fixed inset-0 z-[1000010] flex items-center justify-center bg-black/70 p-4" onMouseDown={e => { if (e.target === e.currentTarget) answer(false) }}>
      <div role="alertdialog" aria-modal="true" aria-label={options.title || 'MetaBuilder PRO'}
        className="w-full max-w-md rounded-2xl border shadow-2xl bg-white border-neutral-200 [html:not(.light)_&]:bg-neutral-900 [html:not(.light)_&]:border-neutral-700">
        <div className="flex items-start gap-3 px-5 pt-5">
          <div className={`p-2 rounded-xl ${danger ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-500'}`}><Icon className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-neutral-900 [html:not(.light)_&]:text-white">{options.title || 'MetaBuilder PRO'}</h3>
            <p className="mt-1 text-sm whitespace-pre-line break-words text-neutral-600 [html:not(.light)_&]:text-neutral-300">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-5">
          <button onClick={() => answer(false)} className="px-4 py-2 text-sm font-semibold text-neutral-500 hover:text-neutral-900 [html:not(.light)_&]:text-neutral-400 [html:not(.light)_&]:hover:text-white">
            {options.cancelLabel || t('common.cancel', 'Cancelar')}
          </button>
          <button ref={okRef} onClick={() => answer(true)}
            className={`px-5 py-2 rounded-lg text-sm font-bold text-white ${danger ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
            {options.okLabel || t('common.ok', 'OK')}
          </button>
        </div>
      </div>
    </div>
  )
}
