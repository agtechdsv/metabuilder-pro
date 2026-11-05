'use client'

import React from 'react'
import { HelpTextEditor } from '../../HelpTextEditor'

interface Props {
  config: any
  setConfig: (config: any) => void
  t: (key: string, fallback?: string) => string
}

/** Ajuda da tela (ícone ? no cabeçalho) com a opção de ocultar sem apagar o texto. */
export function ScreenHelpField({ config, setConfig, t }: Props) {
  const lc = config.layout_config || {}
  const set = (patch: Record<string, unknown>) => setConfig({ ...config, layout_config: { ...lc, ...patch } })
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.screen_help', 'Ajuda da tela (ícone ? no cabeçalho)')}</label>
        <label className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-500 cursor-pointer">
          <input
            type="checkbox"
            checked={lc.screen_help_hidden === true}
            onChange={e => set({ screen_help_hidden: e.target.checked ? true : undefined })}
          />
          {t('wizard.layout.help_hide', 'Ocultar')}
        </label>
      </div>
      <div className={lc.screen_help_hidden === true ? 'opacity-60' : undefined}>
        <HelpTextEditor
          value={lc.screen_help}
          onChange={(help) => set({ screen_help: help })}
          placeholder={t('wizard.layout.screen_help_placeholder', 'Explique para que serve esta tela e como usá-la. Deixe em branco para não mostrar o ícone.')}
          rows={4}
        />
      </div>
    </div>
  )
}
