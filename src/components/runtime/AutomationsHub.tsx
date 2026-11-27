'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown10, ArrowDownAZ, ArrowLeft, ArrowUp01, ArrowUpZA, ChevronDown, ChevronRight, Clock, Database, Search, Workflow } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { filterFlows, filterTables, sortFlows, sortTables, type FlowSort, type TableSort } from '@/lib/bpm/hubSort'

interface HubTable { id: string; name: string; count: number; href: string }
interface HubFlow { id: string; name: string; status: 'published' | 'pending' | 'draft'; scopes: string[]; href: string }

const STATUS_STYLE: Record<HubFlow['status'], string> = {
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  draft: 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
}

const BOX = 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl'

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  )
}

/** Grupo de botões de ordenação (um por opção; o ativo fica destacado). */
function SortButtons<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; icon: React.ReactNode; label: string }[] }) {
  return (
    <div className="inline-flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-0.5" role="group">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          title={o.label}
          aria-label={o.label}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`p-1.5 rounded-md transition-colors ${value === o.id ? 'bg-white dark:bg-neutral-700 text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}
        >
          {o.icon}
        </button>
      ))}
    </div>
  )
}

function FlowRow({ f, label }: { f: HubFlow; label: string }) {
  return (
    <li>
      <Link href={f.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
        <div className="min-w-0">
          <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{f.name}</p>
          {f.scopes.length > 0 && <p className="text-[11px] text-neutral-500 truncate">{f.scopes.join(', ')}</p>}
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[f.status]}`}>{label}</span>
      </Link>
    </li>
  )
}

function GroupHeader({ open, onToggle, title, n, toggleLabel, children }: { open: boolean; onToggle: () => void; title: string; n: number; toggleLabel: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <button type="button" onClick={onToggle} aria-expanded={open} title={toggleLabel} className="flex items-center gap-2 text-left min-w-0">
        {open ? <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />}
        <span className="text-sm font-black text-neutral-900 dark:text-white">{title}</span>
        <span className="text-[11px] font-bold text-neutral-400">({n})</span>
      </button>
      {open && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  )
}

/**
 * Porta de entrada da "Automação de processos": o fluxo é da TABELA (o motor dispara por tabela + evento), ou "Geral" quando não tem
 * tabela (agendado e webhook). Escolhe-se o escopo e abre o editor só com os fluxos dele. "Por tabela" e "Todos os fluxos" têm busca
 * própria (filtra na hora) e ordenação; "Todos os fluxos" vem agrupado em Geral e Por tabela, cada grupo recolhível.
 */
export function AutomationsHub({ general, generalHref, tables, flows, backHref }: {
  general: number
  generalHref: string
  tables: HubTable[]
  flows: HubFlow[]
  backHref: string
}) {
  const { t, language } = useI18n()

  const [tableQuery, setTableQuery] = useState('')
  const [tableSort, setTableSort] = useState<TableSort>('count_desc')

  const [flowQuery, setFlowQuery] = useState('')
  const [generalDir, setGeneralDir] = useState<'asc' | 'desc'>('asc')
  const [tableFlowBy, setTableFlowBy] = useState<'table' | 'name'>('table')
  const [tableFlowDir, setTableFlowDir] = useState<'asc' | 'desc'>('asc')
  const [generalOpen, setGeneralOpen] = useState(true)
  const [tablesOpen, setTablesOpen] = useState(true)

  const shownTables = useMemo(() => sortTables(filterTables(tables, tableQuery), tableSort, language), [tables, tableQuery, tableSort, language])

  const matchedFlows = useMemo(() => filterFlows(flows, flowQuery), [flows, flowQuery])
  const generalFlows = useMemo(
    () => sortFlows(matchedFlows.filter(f => f.scopes.length === 0), generalDir === 'asc' ? 'name_asc' : 'name_desc', language),
    [matchedFlows, generalDir, language],
  )
  const tableFlows = useMemo(
    () => sortFlows(matchedFlows.filter(f => f.scopes.length > 0), tableFlowBy === 'table' ? `table_${tableFlowDir}` : `name_${tableFlowDir}` as FlowSort, language),
    [matchedFlows, tableFlowBy, tableFlowDir, language],
  )
  const searching = flowQuery.trim() !== ''

  const count = (n: number) => t('bpm.hub.flows_count', '{count} fluxo(s)').replace('{count}', String(n))
  const status = (s: HubFlow['status']) => t(`bpm.hub.status_${s}`, s)
  const icon = 'w-4 h-4'

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

        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('bpm.hub.general_title', 'Geral')}</h2>
          <Link href={generalHref} className={`block max-w-md ${BOX} p-5 hover:border-indigo-400 transition-colors`}>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('bpm.hub.tables_title', 'Por tabela')}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox value={tableQuery} onChange={setTableQuery} placeholder={t('bpm.hub.search_tables', 'Buscar tabela')} />
              <SortButtons
                value={tableSort}
                onChange={setTableSort}
                options={[
                  { id: 'name_asc', icon: <ArrowDownAZ className={icon} />, label: t('bpm.hub.sort_name_asc', 'Nome A-Z') },
                  { id: 'name_desc', icon: <ArrowUpZA className={icon} />, label: t('bpm.hub.sort_name_desc', 'Nome Z-A') },
                  { id: 'count_desc', icon: <ArrowDown10 className={icon} />, label: t('bpm.hub.sort_count_desc', 'Mais fluxos primeiro') },
                  { id: 'count_asc', icon: <ArrowUp01 className={icon} />, label: t('bpm.hub.sort_count_asc', 'Menos fluxos primeiro') },
                ]}
              />
            </div>
          </div>
          {shownTables.length === 0 ? (
            <p className="text-xs text-neutral-500">{t('bpm.hub.no_tables', 'Nenhuma tabela encontrada.')}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shownTables.map(x => (
                <Link
                  key={x.id}
                  href={x.href}
                  className={`${BOX} p-4 hover:border-indigo-400 transition-colors flex items-center gap-3 ${x.count === 0 ? 'opacity-70' : ''}`}
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('bpm.hub.all_flows', 'Todos os fluxos')}</h2>
            <SearchBox value={flowQuery} onChange={setFlowQuery} placeholder={t('bpm.hub.search_flows', 'Buscar fluxo ou tabela')} />
          </div>

          {matchedFlows.length === 0 ? (
            <p className="text-xs text-neutral-500">{t('bpm.hub.no_flows', 'Nenhum fluxo encontrado.')}</p>
          ) : (
            <div className="space-y-3">
              {(!searching || generalFlows.length > 0) && (
                <div className={BOX}>
                  <GroupHeader toggleLabel={generalOpen ? t('bpm.hub.collapse', 'Recolher') : t('bpm.hub.expand', 'Expandir')} open={searching || generalOpen} onToggle={() => setGeneralOpen(o => !o)} title={t('bpm.hub.group_general', 'Geral (sem tabela)')} n={generalFlows.length}>
                    <SortButtons
                      value={generalDir}
                      onChange={setGeneralDir}
                      options={[
                        { id: 'asc', icon: <ArrowDownAZ className={icon} />, label: t('bpm.hub.sort_name_asc', 'Nome A-Z') },
                        { id: 'desc', icon: <ArrowUpZA className={icon} />, label: t('bpm.hub.sort_name_desc', 'Nome Z-A') },
                      ]}
                    />
                  </GroupHeader>
                  {(searching || generalOpen) && (
                    generalFlows.length === 0
                      ? <p className="px-4 pb-3 text-xs text-neutral-500">{t('bpm.hub.no_flows', 'Nenhum fluxo encontrado.')}</p>
                      : <ul className="divide-y divide-neutral-100 dark:divide-neutral-800 border-t border-neutral-100 dark:border-neutral-800">{generalFlows.map(f => <FlowRow key={f.id} f={f} label={status(f.status)} />)}</ul>
                  )}
                </div>
              )}

              {(!searching || tableFlows.length > 0) && (
                <div className={BOX}>
                  <GroupHeader toggleLabel={tablesOpen ? t('bpm.hub.collapse', 'Recolher') : t('bpm.hub.expand', 'Expandir')} open={searching || tablesOpen} onToggle={() => setTablesOpen(o => !o)} title={t('bpm.hub.tables_title', 'Por tabela')} n={tableFlows.length}>
                    <select
                      value={tableFlowBy}
                      onChange={e => setTableFlowBy(e.target.value as 'table' | 'name')}
                      aria-label={t('bpm.hub.sort_by_label', 'Ordenar por')}
                      className="bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg text-xs font-bold py-1.5 pl-2 pr-7 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="table">{t('bpm.hub.sort_by_table', 'Tabela e nome')}</option>
                      <option value="name">{t('bpm.hub.sort_by_name', 'Só nome')}</option>
                    </select>
                    <SortButtons
                      value={tableFlowDir}
                      onChange={setTableFlowDir}
                      options={[
                        { id: 'asc', icon: <ArrowDownAZ className={icon} />, label: t('bpm.hub.sort_name_asc', 'Nome A-Z') },
                        { id: 'desc', icon: <ArrowUpZA className={icon} />, label: t('bpm.hub.sort_name_desc', 'Nome Z-A') },
                      ]}
                    />
                  </GroupHeader>
                  {(searching || tablesOpen) && (
                    tableFlows.length === 0
                      ? <p className="px-4 pb-3 text-xs text-neutral-500">{t('bpm.hub.no_flows', 'Nenhum fluxo encontrado.')}</p>
                      : <ul className="divide-y divide-neutral-100 dark:divide-neutral-800 border-t border-neutral-100 dark:border-neutral-800">{tableFlows.map(f => <FlowRow key={f.id} f={f} label={status(f.status)} />)}</ul>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
