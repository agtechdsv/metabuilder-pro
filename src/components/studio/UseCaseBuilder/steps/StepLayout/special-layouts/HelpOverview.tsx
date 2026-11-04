'use client'

import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HELP_LANGS, HelpText, getFieldHelp, hasHelp, helpCoverage, normalizeHelp, setFieldHelp } from '@/lib/helpText'

interface HelpOverviewProps {
  config: any
  setConfig: (config: any) => void
  models?: any
  t: (key: string, fallback?: string) => string
}

function fieldLabel(id: string, models: any, fieldsMetadata: Record<string, any>): string {
  const meta = fieldsMetadata[`form-${id}`]?.label?.text || fieldsMetadata[id]?.label?.text
  if (meta) return meta
  for (const m of Array.isArray(models) ? models : []) {
    const f = (m.fields || []).find((x: any) => x.id === id)
    if (f) return f.display_name || f.db_column_name || id
  }
  return id
}

/** Visão geral da ajuda: todos os campos do formulário numa tabela, com PT / EN / ES lado a lado, para escrever em lote */
export function HelpOverview({ config, setConfig, models, t }: HelpOverviewProps) {
  const [open, setOpen] = useState(false)
  const [onlyMissing, setOnlyMissing] = useState(false)
  const fieldsMetadata: Record<string, any> = config.layout_config?.fields_metadata || {}

  const ids = useMemo(() => {
    const list: any[] = config.layout_config?.form_fields || []
    return list.map(f => (typeof f === 'string' ? f : f?.id)).filter(Boolean) as string[]
  }, [config.layout_config?.form_fields])

  if (ids.length === 0) return null

  const { withHelp, total } = helpCoverage(ids, fieldsMetadata)
  const visible = onlyMissing ? ids.filter(id => !hasHelp(getFieldHelp(fieldsMetadata, id))) : ids

  const update = (id: string, lang: string, text: string) => {
    const raw = getFieldHelp(fieldsMetadata, id)
    const current: HelpText = raw && typeof raw === 'object' ? { ...(raw as HelpText) } : { ...normalizeHelp(raw) }
    ;(current as any)[lang] = text
    setConfig({
      ...config,
      layout_config: { ...config.layout_config, fields_metadata: setFieldHelp(fieldsMetadata, id, current) },
    })
  }

  const cellValue = (id: string, lang: string): string => {
    const raw = getFieldHelp(fieldsMetadata, id)
    if (raw && typeof raw === 'object') return (raw as Record<string, string>)[lang] ?? ''
    return lang === 'pt' && typeof raw === 'string' ? raw : ''
  }

  return (
    <div className="space-y-3 pt-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 hover:text-indigo-700"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {t('wizard.layout.help_overview', 'Visão geral da ajuda')} ({withHelp} / {total})
      </button>

      {open && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 cursor-pointer">
            <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} />
            {t('wizard.layout.help_only_missing', 'Mostrar só os campos sem dica')}
          </label>

          <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[9px] font-black uppercase tracking-widest text-neutral-400 text-left">
                  <th className="px-3 py-2 w-40">{t('wizard.layout.help_field', 'Campo')}</th>
                  {HELP_LANGS.map(l => <th key={l} className="px-3 py-2 min-w-[200px]">{l.toUpperCase()}</th>)}
                </tr>
              </thead>
              <tbody>
                {visible.map(id => {
                  const missing = !hasHelp(getFieldHelp(fieldsMetadata, id))
                  return (
                    <tr key={id} className="border-t border-neutral-100 dark:border-neutral-800 align-top">
                      <td className="px-3 py-2 font-bold text-neutral-700 dark:text-neutral-300">
                        <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-2', missing ? 'bg-neutral-300' : 'bg-emerald-500')} />
                        {fieldLabel(id, models, fieldsMetadata)}
                      </td>
                      {HELP_LANGS.map(l => (
                        <td key={l} className="px-2 py-1.5">
                          <textarea
                            value={cellValue(id, l)}
                            rows={2}
                            maxLength={2000}
                            onChange={e => update(id, l, e.target.value)}
                            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-xs font-medium focus:border-indigo-500 outline-none resize-y"
                          />
                        </td>
                      ))}
                    </tr>
                  )
                })}
                {visible.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-neutral-400 italic">{t('wizard.layout.help_all_done', 'Todos os campos têm dica.')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
