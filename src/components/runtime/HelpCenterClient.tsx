'use client'

import React, { useMemo, useState } from 'react'
import { HelpCircle, Search } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { HelpFeedbackBar } from '@/components/runtime/HelpFeedbackBar'
import { helpZoneName, searchHelpCenter, type HelpCenterEntry } from '@/lib/helpText'

interface Props {
  entries: HelpCenterEntry[]
  baseHref: string
  projectName?: string
  /** com o projeto, cada item da Central pergunta "Isto ajudou?" (o voto vai para a zona central) */
  projectId?: string
}

export function HelpCenterClient({ entries, baseHref, projectName, projectId }: Props) {
  const { t, language } = useI18n()
  const [query, setQuery] = useState('')
  const shown = useMemo(() => searchHelpCenter(entries, query, language), [entries, query, language])

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950 px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-1">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-6 h-6 text-indigo-500" />
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">{t('runtime.help.center', 'Central de Ajuda')}</h1>
          </div>
          {projectName && <p className="text-xs text-neutral-400 font-bold">{projectName}</p>}
        </header>

        <label className="relative block">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('runtime.help.search', 'Buscar nas ajudas...')}
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm outline-none focus:border-indigo-500"
          />
        </label>

        {shown.length === 0 && (
          <p className="text-sm text-neutral-400 italic text-center py-10">
            {entries.length === 0 ? t('runtime.help.none', 'Ainda não há ajuda cadastrada.') : t('runtime.help.no_results', 'Nada encontrado para essa busca.')}
          </p>
        )}

        {shown.map(e => (
          <section key={e.id} className="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-3">
            <h2 className="text-sm font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-200">
              <a href={`${baseHref}/${e.slug}`} className="hover:text-indigo-500">{e.name}</a>
            </h2>
            {e.screen && (
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-300 whitespace-pre-line">{e.screen}</p>
                {projectId && <HelpFeedbackBar feedback={{ projectId, screen: e.id, zone: 'central' }} className="mt-2 max-w-[16rem]" />}
              </div>
            )}
            {e.fields.length > 0 && (
              <dl className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                {e.fields.map((f, i) => (
                  <div key={`${f.id}-${i}`}>
                    <dt className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-black text-neutral-500">
                      {f.label}
                      {f.zones.map(z => (
                        <span key={z} className="rounded-md bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                          {helpZoneName(z, language)}
                        </span>
                      ))}
                    </dt>
                    <dd className="text-sm text-neutral-600 dark:text-neutral-300 whitespace-pre-line">{f.text}</dd>
                    {projectId && <HelpFeedbackBar feedback={{ projectId, screen: e.id, field: f.id, zone: 'central' }} className="mt-1 max-w-[16rem]" />}
                  </div>
                ))}
              </dl>
            )}
          </section>
        ))}
      </div>
    </main>
  )
}
