'use client'

import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HelpFeedbackPanel } from './HelpFeedbackPanel'
import {
  HELP_LANGS, HELP_ZONES, HelpLang, HelpText, HelpZone,
  clearZoneHelp, getFieldHelp, getZoneHelp, hasHelp, helpCoverage, normalizeHelp, setFieldHelp, setZoneHelp, zonesOfField,
} from '@/lib/helpText'

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

const idsOf = (list: any): string[] =>
  (Array.isArray(list) ? list : []).map((f: any) => (typeof f === 'string' ? f : f?.id)).filter(Boolean)

/**
 * Visão geral da ajuda: os campos de cada zona (filtro, grid, formulário), uma aba por idioma, para escrever em lote.
 * Um campo em mais de uma zona herda a mesma dica; "Personalizar" dá a uma zona o seu próprio texto.
 */
export function HelpOverview({ config, setConfig, models, t }: HelpOverviewProps) {
  const [open, setOpen] = useState(false)
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [lang, setLang] = useState<HelpLang>('pt')
  const fieldsMetadata: Record<string, any> = config.layout_config?.fields_metadata || {}

  const byZone = useMemo(() => {
    const lc = config.layout_config || {}
    return HELP_ZONES.map(zone => ({ zone, ids: idsOf(lc[`${zone}_fields`]) })).filter(z => z.ids.length > 0)
  }, [config.layout_config])

  const formIds = byZone.find(z => z.zone === 'form')?.ids || []
  if (byZone.length === 0) return null

  const { withHelp, total } = helpCoverage(formIds, fieldsMetadata)
  const zoneName = (z: HelpZone) =>
    z === 'filter' ? t('wizard.layout.zone_filter', 'Filtro de busca') : z === 'grid' ? t('wizard.layout.zone_grid', 'Grid de dados') : t('wizard.layout.zone_form', 'Formulário')

  const save = (next: Record<string, any>) =>
    setConfig({ ...config, layout_config: { ...config.layout_config, fields_metadata: next } })

  const rawOf = (id: string, zone: HelpZone) => getZoneHelp(fieldsMetadata, id, zone).help
  const cellValue = (id: string, zone: HelpZone): string => {
    const raw = rawOf(id, zone)
    if (raw && typeof raw === 'object') return (raw as Record<string, string>)[lang] ?? ''
    return lang === 'pt' && typeof raw === 'string' ? raw : ''
  }

  const update = (id: string, zone: HelpZone, text: string) => {
    const raw = rawOf(id, zone)
    const current: HelpText = raw && typeof raw === 'object' ? { ...(raw as HelpText) } : { ...normalizeHelp(raw) }
    ;(current as any)[lang] = text
    save(getZoneHelp(fieldsMetadata, id, zone).custom ? setZoneHelp(fieldsMetadata, id, zone, current) : setFieldHelp(fieldsMetadata, id, current))
  }

  const filledInLang = (l: HelpLang) => formIds.filter(id => !!normalizeHelp(rawOf(id, 'form'))[l]).length

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
            fieldIds={formIds}
            fieldName={(id) => fieldLabel(id, models, fieldsMetadata)}
            t={t}
          />

          <label className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 cursor-pointer">
            <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} />
            {t('wizard.layout.help_only_missing', 'Mostrar só os campos sem dica')}
          </label>

          <div className="flex items-center gap-1">
            {HELP_LANGS.map(l => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest transition-colors',
                  lang === l ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700'
                )}
              >
                {l.toUpperCase()}{formIds.length > 0 ? ` (${filledInLang(l)}/${formIds.length})` : ''}
              </button>
            ))}
          </div>

          {byZone.map(({ zone, ids }) => {
            const visible = onlyMissing ? ids.filter(id => !hasHelp(rawOf(id, zone))) : ids
            return (
              <div key={zone} className="space-y-1.5">
                <h5 className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{zoneName(zone)} ({ids.length})</h5>
                <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 divide-y divide-neutral-100 dark:divide-neutral-800">
                  {visible.map(id => {
                    const { help, custom } = getZoneHelp(fieldsMetadata, id, zone)
                    const multi = zonesOfField(config.layout_config, id).length > 1
                    return (
                      <div key={id} className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-2 px-3 py-2">
                        <div className="pt-1.5 space-y-1">
                          <span className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                            <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-2', hasHelp(help) ? 'bg-emerald-500' : 'bg-neutral-300')} />
                            {fieldLabel(id, models, fieldsMetadata)}
                          </span>
                          {multi && (
                            <button
                              type="button"
                              onClick={() => save(custom ? clearZoneHelp(fieldsMetadata, id, zone) : setZoneHelp(fieldsMetadata, id, zone, normalizeHelp(getFieldHelp(fieldsMetadata, id))))}
                              className="text-[9px] font-bold text-indigo-600 hover:underline"
                            >
                              {custom ? t('wizard.layout.help_use_default', 'Usar o texto padrão') : t('wizard.layout.help_customize', 'Personalizar nesta zona')}
                            </button>
                          )}
                          {multi && custom && <span className="block text-[9px] font-black uppercase tracking-widest text-amber-600">{t('wizard.layout.help_own', 'Texto próprio')}</span>}
                        </div>
                        <textarea
                          value={cellValue(id, zone)}
                          rows={2}
                          maxLength={2000}
                          onChange={e => update(id, zone, e.target.value)}
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
            )
          })}
        </div>
      )}
    </div>
  )
}
