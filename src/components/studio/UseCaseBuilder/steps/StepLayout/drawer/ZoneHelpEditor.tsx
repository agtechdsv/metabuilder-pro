'use client'

import React from 'react'
import { HelpTextEditor } from '../../HelpTextEditor'
import { HELP_ZONES, HelpText, HelpZone, clearZoneHelp, getZoneHelp, normalizeHelp, setFieldHelp, setZoneHelp, zonesOfField } from '@/lib/helpText'

interface Props {
  config: any
  setConfig: (config: any) => void
  fieldId: string
  zone: string
  t: (key: string, fallback?: string) => string
}

/**
 * Dica de ajuda do campo na zona que está sendo editada. Por padrão a dica vale em todas as zonas onde o campo aparece;
 * quando ele está em mais de uma, dá para escrever um texto próprio só desta zona (e voltar a herdar depois).
 */
export function ZoneHelpEditor({ config, setConfig, fieldId, zone, t }: Props) {
  if (!(HELP_ZONES as readonly string[]).includes(zone)) return null
  const z = zone as HelpZone
  const meta: Record<string, any> = config.layout_config?.fields_metadata || {}
  const zones = zonesOfField(config.layout_config, fieldId)
  const multi = zones.length > 1
  const { help, custom } = getZoneHelp(meta, fieldId, z)
  const zoneName = (x: HelpZone) => (x === 'filter' ? t('wizard.layout.zone_filter', 'Filtro') : x === 'grid' ? t('wizard.layout.zone_grid', 'Grid') : t('wizard.layout.zone_form', 'Formulário'))

  const save = (next: Record<string, any>) => setConfig({ ...config, layout_config: { ...config.layout_config, fields_metadata: next } })

  return (
    <div className="space-y-2">
      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
        {t('wizard.layout.drawer.help_text', 'Dica de ajuda (ícone ? ao lado do campo)')}
      </label>
      {multi && (
        <label className="flex items-start gap-2 text-[10px] font-bold text-neutral-500 cursor-pointer ml-1">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={custom}
            onChange={(e) => save(e.target.checked ? setZoneHelp(meta, fieldId, z, normalizeHelp(help)) : clearZoneHelp(meta, fieldId, z))}
          />
          <span>
            {t('wizard.layout.help_custom_zone', 'Texto próprio nesta zona')} ({zoneName(z)})
            <span className="block font-medium text-neutral-400">
              {custom
                ? t('wizard.layout.help_custom_on', 'As outras zonas continuam com o texto padrão.')
                : `${t('wizard.layout.help_inherited', 'Este texto vale também em')}: ${zones.filter(x => x !== z).map(zoneName).join(', ')}.`}
            </span>
          </span>
        </label>
      )}
      <HelpTextEditor
        value={help}
        onChange={(next: HelpText) => save(custom ? setZoneHelp(meta, fieldId, z, next) : setFieldHelp(meta, fieldId, next))}
        placeholder={t('wizard.layout.drawer.help_text_placeholder', 'Explique o que preencher neste campo. Deixe em branco para não mostrar o ícone.')}
      />
    </div>
  )
}
