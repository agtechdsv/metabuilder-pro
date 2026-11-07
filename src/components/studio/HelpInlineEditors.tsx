'use client'

import React from 'react'
import { HelpTextEditor } from './UseCaseBuilder/steps/HelpTextEditor'
import {
  HELP_ZONES, HelpZone, clearZoneHelp, getFieldHelp, getZoneHelp, isHelpHidden, normalizeHelp, setFieldHelp, setHelpHidden, setZoneHelp, zonesOfField,
} from '@/lib/helpText'

type T = (key: string, fallback?: string) => string

interface Common { config: any; setConfig: (config: any) => void; t: T }

const isZone = (z: string | null | undefined): z is HelpZone => !!z && (HELP_ZONES as readonly string[]).includes(z)

/** Edita a ajuda da TELA (ícone ? do cabeçalho). */
export function ScreenHelpInline({ config, setConfig, t }: Common) {
  const lc = config.layout_config || {}
  return (
    <HelpTextEditor
      value={lc.screen_help}
      rows={3}
      placeholder={t('wizard.layout.screen_help_placeholder', 'Explique para que serve esta tela e como usá-la.')}
      onChange={help => setConfig({ ...config, layout_config: { ...lc, screen_help: help } })}
    />
  )
}

/** Edita o texto PADRÃO de um campo (vale para todas as zonas que não têm texto próprio). */
export function FieldHelpInline({ config, setConfig, t, fieldId }: Common & { fieldId: string | null }) {
  if (!fieldId) return <ScreenHelpInline config={config} setConfig={setConfig} t={t} />
  const lc = config.layout_config || {}
  const meta: Record<string, any> = lc.fields_metadata || {}
  return (
    <HelpTextEditor
      value={getFieldHelp(meta, fieldId)}
      rows={2}
      placeholder={t('help_center_studio.feedback.field_help_placeholder', 'Texto padrão deste campo (vale para todas as zonas sem texto próprio).')}
      onChange={help => setConfig({ ...config, layout_config: { ...lc, fields_metadata: setFieldHelp(meta, fieldId, help) } })}
    />
  )
}

/** Edita o texto de UMA zona (filtro, grid ou formulário) de um campo: o próprio, ou o padrão se a zona ainda não tem texto próprio. */
export function ZoneHelpInline({ config, setConfig, t, fieldId, zone, showDefaultEditor = true }: Common & { fieldId: string | null; zone: string | null; /** false = o texto padrão já é editado em outra zona aberta do mesmo campo (não repete a caixa) */ showDefaultEditor?: boolean }) {
  const lc = config.layout_config || {}
  const meta: Record<string, any> = lc.fields_metadata || {}
  if (!fieldId || !isZone(zone)) return <ScreenHelpInline config={config} setConfig={setConfig} t={t} />
  const save = (next: Record<string, any>) => setConfig({ ...config, layout_config: { ...lc, fields_metadata: next } })
  const { help, custom } = getZoneHelp(meta, fieldId, zone)
  const multi = zonesOfField(lc, fieldId).length > 1
  const hidden = isHelpHidden(meta, fieldId, zone)
  return (
    <div className="space-y-2">
      {custom || showDefaultEditor || !multi ? (
        <HelpTextEditor
          value={help}
          rows={2}
          placeholder={t('help_center_studio.feedback.zone_help_placeholder', 'Texto desta zona.')}
          onChange={h => save(custom ? setZoneHelp(meta, fieldId, zone, h) : setFieldHelp(meta, fieldId, h))}
        />
      ) : (
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-[11px] italic text-neutral-500 dark:bg-neutral-900">{t('help_center_studio.feedback.default_edited_above', 'Usa o texto padrão do campo, editado na primeira zona sem texto próprio.')}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {multi && (
          <button
            type="button"
            onClick={() => save(custom ? clearZoneHelp(meta, fieldId, zone) : setZoneHelp(meta, fieldId, zone, normalizeHelp(getFieldHelp(meta, fieldId))))}
            className="text-[10px] font-bold text-indigo-600 hover:underline"
          >
            {custom ? t('wizard.layout.help_use_default', 'Usar o texto padrão') : t('wizard.layout.help_customize', 'Personalizar nesta zona')}
          </button>
        )}
        {multi && (
          <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">
            {custom ? t('wizard.layout.help_own', 'Texto próprio') : t('help_center_studio.feedback.uses_default', 'Usa o texto padrão do campo')}
          </span>
        )}
        <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-bold text-neutral-500">
          <input type="checkbox" checked={hidden} onChange={e => save(setHelpHidden(meta, fieldId, zone, e.target.checked))} />
          {t('wizard.layout.help_hide', 'Ocultar')}
        </label>
      </div>
    </div>
  )
}
