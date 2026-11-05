'use client'

import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HelpFeedbackPanel } from './HelpFeedbackPanel'
import { HELP_LANGS, HelpLang, HelpText, getFieldHelp, hasHelp, helpCoverage, normalizeHelp, setFieldHelp } from '@/lib/helpText'

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
  const [lang, setLang] = useState<HelpLang>('pt')
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
          <HelpFeedbackPanel
            projectId={(Array.isArray(models) ? models : []).find((m: any) => m?.project_id)?.project_id}
            screenId={config.id}
            fieldIds={ids}
            fieldName={(id) => fieldLabel(id, models, fieldsMetadata)}
            t={t}
          />

          <label className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 cursor-pointer">
            <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} />
            {t('wizard.layout.help_only_missing', 'Mostrar só os campos sem dica')}
          </label>

          <div className="flex items-center gap-1">
            {HELP_LANGS.map(l => {
              const filled = ids.filter(id => !!normalizeHelp(getFieldHelp(fieldsMetadata, id))[l]).length
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest transition-colors',
                    lang === l ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700'
                  )}
                >
                  {l.toUpperCase()} ({filled}/{ids.length})
                </button>
              )
            })}
          </div>

          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 divide-y divide-neutral-100 dark:divide-neutral-800">
            {visible.map(id => {
              const missing = !hasHelp(getFieldHelp(fieldsMetadata, id))
              return (
                <div key={id} className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-2 px-3 py-2">
                  <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 pt-1.5">
                    <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-2', missing ? 'bg-neutral-300' : 'bg-emerald-500')} />
                    {fieldLabel(id, models, fieldsMetadata)}
                  </span>
                  <textarea
                    value={cellValue(id, lang)}
                    rows={2}
                    maxLength={2000}
                    onChange={e => update(id, lang, e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-xs font-medium focus:border-indigo-500 outline-none resize-y"
                  />
                </div>
              )
            })}
            {visible.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-neutral-400 italic">{t('wizard.layout.help_all_done', 'Todos os campos têm dica.')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
