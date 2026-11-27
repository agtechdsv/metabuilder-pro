'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, Database, Search, Workflow } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

interface HubTable { id: string; name: string; count: number; href: string }
interface HubFlow { id: string; name: string; status: 'published' | 'pending' | 'draft'; scopes: string[]; href: string }

const STATUS_STYLE: Record<HubFlow['status'], string> = {
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  draft: 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
}

/**
 * Porta de entrada da "Automação de processos": o fluxo é da TABELA (o motor dispara por tabela + evento), ou "Geral" quando não tem
 * tabela (agendado e webhook). Escolhe-se o escopo e abre o editor só com os fluxos dele; "todos os fluxos" serve para achar um pelo nome.
 */
export function AutomationsHub({ general, generalHref, tables, flows, backHref }: {
  general: number
  generalHref: string
  tables: HubTable[]
  flows: HubFlow[]
  backHref: string
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')

  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = norm(query.trim())
  const shownTables = useMemo(() => (q ? tables.filter(x => norm(x.name).includes(q)) : tables), [tables, q])
  const shownFlows = useMemo(
    () => (q ? flows.filter(f => norm(f.name).includes(q) || f.scopes.some(s => norm(s).includes(q))) : flows),
    [flows, q],
  )
  const count = (n: number) => t('bpm.hub.flows_count', '{count} fluxo(s)').replace('{count}', String(n))
  const status = (s: HubFlow['status']) => t(`bpm.hub.status_${s}`, s)

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
              <Workflow className="w-6 h-6 text-indigo-500" />
              {t('bpm.hub.title', 'Automação de processos')}
            </h1>
            <p className="text-xs text-neutral-500 mt-1 max-w-2xl">
              {t('bpm.hub.subtitle', 'Os fluxos são da tabela: valem para qualquer tela que use a tabela. Escolha onde trabalhar.')}
            </p>
          </div>
          <Link href={backHref} className="text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 shrink-0">
            <ArrowLeft className="w-4 h-4" />
            {t('approvals.back', 'Voltar ao início')}
          </Link>
        </div>

        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('bpm.hub.search_placeholder', 'Buscar tabela ou fluxo')}
            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('bpm.hub.general_title', 'Geral')}</h2>
          <Link
            href={generalHref}
            className="block max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 hover:border-indigo-400 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center"><Clock className="w-5 h-5" /></div>
              <div>
                <p className="text-sm font-bold text-neutral-900 dark:text-white">{t('bpm.hub.general_name', 'Geral (sem tabela)')}</p>
                <p className="text-[11px] text-neutral-500">{count(general)}</p>
              </div>
            </div>
            <p className="text-xs text-neutral-500 mt-3 leading-relaxed">{t('bpm.hub.general_desc', 'Fluxos agendados e webhooks de entrada: não dependem de uma tabela.')}</p>
          </Link>
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('bpm.hub.tables_title', 'Por tabela')}</h2>
          {shownTables.length === 0 ? (
            <p className="text-xs text-neutral-500">{t('bpm.hub.no_tables', 'Nenhuma tabela encontrada.')}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shownTables.map(x => (
                <Link
                  key={x.id}
                  href={x.href}
                  className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 hover:border-indigo-400 transition-colors flex items-center gap-3 ${x.count === 0 ? 'opacity-70' : ''}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 flex items-center justify-center shrink-0"><Database className="w-5 h-5" /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{x.name}</p>
                    <p className="text-[11px] text-neutral-500">{count(x.count)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('bpm.hub.all_flows', 'Todos os fluxos')}</h2>
          {shownFlows.length === 0 ? (
            <p className="text-xs text-neutral-500">{t('bpm.hub.no_flows', 'Nenhum fluxo encontrado.')}</p>
          ) : (
            <ul className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl divide-y divide-neutral-100 dark:divide-neutral-800">
              {shownFlows.map(f => (
                <li key={f.id}>
                  <Link href={f.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{f.name}</p>
                      <p className="text-[11px] text-neutral-500 truncate">{f.scopes.length ? f.scopes.join(', ') : t('bpm.hub.general_name', 'Geral (sem tabela)')}</p>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[f.status]}`}>{status(f.status)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
