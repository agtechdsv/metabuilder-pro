import type { AppAST, ResolvedField } from '../ast'
import { getGeneratorDictionary } from '../i18n'

/**
 * Campo "Autocomplete (Busca Dinâmica)" do Studio no app gerado.
 *
 * O dev escolhe o componente do campo no Studio e configura a tabela de consulta (rel_table), a coluna que aparece (rel_label), a
 * que vale (rel_value), o mínimo de caracteres (min_chars), a espera da digitação (debounce_ms), o limite de resultados e o texto
 * de busca. O app gerado lê tudo isso: a lista NÃO é carregada inteira; cada busca vai ao servidor do app, que consulta a tabela
 * (pelas mesmas ações de leitura, com as mesmas regras de acesso) e devolve só os resultados.
 */

const AUTOCOMPLETE_TYPES = ['autocomplete', 'autocomplete (busca dinâmica)', 'autocomplete (busca dinamica)']

export interface AutocompleteConfig {
  table: string
  labelCol: string
  valueCol: string
  minChars: number
  debounceMs: number
  limit: number
  placeholder: string
}

const componentOf = (f: ResolvedField) => f.config?.form_config?.component || f.config?.component || {}

/** O campo é um autocomplete configurado no Studio? */
export function isAutocompleteField(f: ResolvedField): boolean {
  if (f.isPrimaryKey) return false
  const t = String(componentOf(f).type || f.config?.type || '').toLowerCase()
  return AUTOCOMPLETE_TYPES.includes(t)
}

/** Configuração lida do campo (tabela, colunas, mínimo de caracteres, espera, limite e texto). */
export function autocompleteConfig(f: ResolvedField): AutocompleteConfig {
  const comp = componentOf(f)
  const rel: any = f.config?.relation || {}
  const table = String(comp.rel_table || rel.targetTable || f.config?.rel_table || (f.dbColumn.endsWith('_id') ? f.dbColumn.slice(0, -3) + 's' : '')).split('.').pop() || ''
  return {
    table: table.toLowerCase(),
    labelCol: String(comp.rel_label || rel.displayColumn || f.config?.rel_label || ''),
    valueCol: String(comp.rel_value || rel.valueColumn || f.config?.rel_value || 'id'),
    minChars: Number(comp.min_chars ?? 2) || 2,
    debounceMs: Number(comp.debounce_ms ?? 300) || 300,
    limit: Number(comp.limit) > 0 ? Number(comp.limit) : 20,
    placeholder: String(comp.search_placeholder || ''),
  }
}

/** Propriedades do componente para este campo (texto JSX). */
export function autocompleteProps(f: ResolvedField): string {
  const c = autocompleteConfig(f)
  return `table=${JSON.stringify(c.table)} labelCol=${JSON.stringify(c.labelCol)} valueCol=${JSON.stringify(c.valueCol)} minChars={${c.minChars}} debounceMs={${c.debounceMs}} limit={${c.limit}}${c.placeholder ? ` placeholder=${JSON.stringify(c.placeholder)}` : ''}`
}

/** O componente de aba de relacionamento (sempre gerado) usa o autocomplete: basta o app ter tabelas. */
export function appNeedsAutocomplete(ast: AppAST): boolean {
  return ast.models.length > 0
}

const ACTION = (ast: AppAST) => {
  const models = ast.models.filter(m => m.dbTable)
  const lower = (m: { name: string }) => m.name.toLowerCase()
  const java = ast.backendStack === 'java-spring'
  const serverFilter = !java && (ast.dbStack === 'postgres' || ast.dbStack === 'supabase')
  return `'use server'
// ARQUIVO GERADO pelo MetaBuilder — busca dos campos Autocomplete: devolve só os resultados da pesquisa, nunca a tabela inteira.
${models.map(m => `import { get${m.name}List, get${m.name}ByField } from '@/app/actions/${lower(m)}'`).join('\n')}

type Source = { list: (opts?: any) => Promise<any>; byField: (field: string, value: any) => Promise<any> }
const SOURCES: Record<string, Source> = {
${models.map(m => `  ${JSON.stringify(m.dbTable.split('.').pop()!.toLowerCase())}: { list: get${m.name}List, byField: get${m.name}ByField },`).join('\n')}
}

export interface AutocompleteOption { label: string; value: any; [key: string]: any }

const SAFE = /^[A-Za-z0-9_.]+$/
const rowsOf = (res: any): any[] => (Array.isArray(res) ? res : (res?.content ?? []))
const pick = (row: any, col: string) => row?.[col] ?? row?.[col.toLowerCase()] ?? row?.[col.toUpperCase()] ?? row?.[col.replace(/_([a-z])/g, (_m, c) => c.toUpperCase())]
const toOption = (row: any, labelCol: string, valueCol: string): AutocompleteOption => {
  const value = pick(row, valueCol) ?? pick(row, 'id')
  const label = (labelCol ? pick(row, labelCol) : undefined) ?? row?.display_label ?? Object.values(row || {})[1] ?? value
  return { ...row, label: String(label ?? ''), value }
}

/** Pesquisa na tabela de consulta pelo texto digitado (parte do rótulo ou do valor). */
export async function searchOptions(table: string, labelCol: string, valueCol: string, text: string, limit = 20): Promise<AutocompleteOption[]> {
  const source = SOURCES[String(table || '').toLowerCase()]
  const q = String(text || '').trim()
  if (!source || !q || !SAFE.test(labelCol || 'id') || !SAFE.test(valueCol || 'id')) return []
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 100)
  const col = labelCol || valueCol || 'id'
${java
    ? `  // backend Java: o filtro por coluna da API é por parte do texto; devolve só a página pedida
  const res = await source.list({ page: 1, limit: lim, filters: { [col]: q } })`
    : serverFilter
      ? `  // o banco filtra por parte do texto (coluna_filter) e limita os resultados
  const res = await source.list({ limit: lim, filters: { [col + '_filter']: q } })`
      : `  // este banco ainda não filtra por parte do texto na leitura: lê no servidor (até 5000 linhas) e filtra aqui; o navegador recebe só os resultados
  const res = await source.list({ limit: 5000 })`}
  const needle = q.toLowerCase()
  return rowsOf(res)
    .map(r => toOption(r, labelCol, valueCol))
    .filter(o => o.label.toLowerCase().includes(needle) || String(o.value ?? '').toLowerCase().includes(needle))
    .slice(0, lim)
}

/** Texto do item já escolhido (para mostrar no campo ao abrir um registro). */
export async function getOptionByValue(table: string, labelCol: string, valueCol: string, value: any): Promise<AutocompleteOption | null> {
  const source = SOURCES[String(table || '').toLowerCase()]
  if (!source || value === undefined || value === null || value === '' || !SAFE.test(valueCol || 'id')) return null
  const res = rowsOf(await source.byField(valueCol || 'id', value))
  const hit = res.find(r => String(pick(r, valueCol || 'id') ?? '') === String(value)) ?? res[0]
  return hit ? toOption(hit, labelCol, valueCol) : null
}
`
}

const COMPONENT = (t: { hint: string; empty: string; loading: string; placeholder: string }) => `'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { searchOptions, getOptionByValue, type AutocompleteOption } from '@/app/actions/autocomplete'

/**
 * Campo de busca dinâmica: digita, espera, e a pesquisa vai ao servidor (nada de carregar a tabela inteira).
 * O valor escolhido vai num campo oculto com o nome da coluna (os formulários leem pelo nome).
 */
export function AutocompleteInput({
  name, value, defaultValue, table, labelCol, valueCol, minChars = 2, debounceMs = 300, limit = 20,
  placeholder, disabled = false, options = [], onChange, className,
}: {
  name?: string
  value?: any
  defaultValue?: any
  table: string
  labelCol: string
  valueCol: string
  minChars?: number
  debounceMs?: number
  limit?: number
  placeholder?: string
  disabled?: boolean
  /** itens já conhecidos (ex.: lista carregada com a tela): mostram o texto do valor sem ir ao servidor */
  options?: Array<{ value: any; label: string }>
  onChange?: (value: string, item: AutocompleteOption | null) => void
  className?: string
}) {
  const controlled = value !== undefined
  const [inner, setInner] = useState<string>(String(defaultValue ?? ''))
  const current = String(controlled ? (value ?? '') : inner)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<AutocompleteOption[]>([])
  const [active, setActive] = useState(-1)
  const [typed, setTyped] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seq = useRef(0)

  // texto do valor atual: das opções já conhecidas ou, se não houver, uma consulta pelo valor
  useEffect(() => {
    if (typed) return
    if (!current) { setText(''); return }
    const known = options.find(o => String(o.value) === current)
    if (known) { setText(known.label); return }
    let alive = true
    getOptionByValue(table, labelCol, valueCol, current).then(o => { if (alive) setText(o?.label ?? current) }).catch(() => { if (alive) setText(current) })
    return () => { alive = false }
  }, [current, options, table, labelCol, valueCol, typed])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setTyped(false) }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const commit = useCallback((v: string, item: AutocompleteOption | null) => {
    if (!controlled) setInner(v)
    setTyped(false)
    setOpen(false)
    setText(item?.label ?? '')
    onChange?.(v, item)
  }, [controlled, onChange])

  const search = (q: string) => {
    if (timer.current) clearTimeout(timer.current)
    const mine = ++seq.current
    if (q.trim().length < minChars) { setResults([]); setLoading(false); return }
    setLoading(true)
    timer.current = setTimeout(async () => {
      try {
        const found = await searchOptions(table, labelCol, valueCol, q, limit)
        if (mine === seq.current) { setResults(found); setActive(found.length > 0 ? 0 : -1) }
      } catch {
        if (mine === seq.current) setResults([])
      } finally {
        if (mine === seq.current) setLoading(false)
      }
    }, debounceMs)
  }

  const hint = typed && text.trim().length < minChars

  return (
    <div className={'relative ' + (className || '')} ref={box}>
      {name && <input type="hidden" name={name} value={current} readOnly />}
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          disabled={disabled}
          value={text}
          placeholder={placeholder || ${JSON.stringify(t.placeholder)}}
          autoComplete="off"
          onFocus={() => { if (!disabled) setOpen(true) }}
          onChange={e => { setTyped(true); setText(e.target.value); setOpen(true); search(e.target.value) }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(results.length - 1, a + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
            else if (e.key === 'Enter' && open && active >= 0 && results[active]) { e.preventDefault(); commit(String(results[active].value ?? ''), results[active]) }
            else if (e.key === 'Escape') { setOpen(false); setTyped(false) }
          }}
          className={'w-full border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl pl-10 pr-10 py-2.5 text-sm outline-none transition-all ' + (disabled ? 'bg-neutral-100/80 dark:bg-neutral-800/80 cursor-not-allowed opacity-90' : 'bg-slate-50 dark:bg-neutral-800 focus:ring-2 focus:ring-indigo-500/50')}
        />
        {loading ? (
          <Loader2 className="w-4 h-4 text-indigo-500 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
        ) : (current && !disabled) ? (
          <button type="button" onClick={() => commit('', null)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200" aria-label="clear">
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
      {open && !disabled && (
        <div className="absolute left-0 right-0 mt-1.5 z-50 max-h-64 overflow-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl py-1">
          {hint && <p className="px-4 py-3 text-xs text-neutral-400">{${JSON.stringify(t.hint)}.replace('{n}', String(minChars))}</p>}
          {!hint && loading && <p className="px-4 py-3 text-xs text-neutral-400">{${JSON.stringify(t.loading)}}</p>}
          {!hint && !loading && typed && results.length === 0 && <p className="px-4 py-3 text-xs text-neutral-400">{${JSON.stringify(t.empty)}}</p>}
          {!hint && !loading && results.map((o, i) => (
            <button
              key={String(o.value) + '-' + i}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => commit(String(o.value ?? ''), o)}
              className={'w-full text-left px-4 py-2.5 text-sm transition-colors ' + (i === active ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800')}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
`

/** Gera o componente e a ação de busca quando o app usa o autocomplete. */
export function generateAutocomplete(ast: AppAST, files: Map<string, string>) {
  if (!appNeedsAutocomplete(ast)) return
  const d = getGeneratorDictionary(ast.targetLanguage).form as any
  files.set('app/actions/autocomplete.ts', ACTION(ast))
  files.set('components/AutocompleteInput.tsx', COMPONENT({
    hint: d.autocomplete_hint, empty: d.autocomplete_empty, loading: d.autocomplete_loading, placeholder: d.autocomplete_placeholder,
  }))
}
