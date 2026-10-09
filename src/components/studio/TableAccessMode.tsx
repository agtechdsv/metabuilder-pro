'use client'

import { Lock } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import type { TableAccessMode as Mode } from '@/lib/rowPolicy/policy'

/**
 * "Bloquear tabelas por padrão" (Configurar Login → Controle de acesso): o que acontece com as tabelas em que o desenvolvedor
 * não configurou nada. Desligado, todas ficam abertas ao usuário final (cada uma com as suas permissões e regras por linha);
 * ligado, só as liberadas aqui. Salvo junto do restante da tela (project_auth_config.ui_config.table_access).
 */
interface Props {
  tables: string[]
  value: Mode
  onChange: (next: Mode) => void
}

const t0 = 'dashboard.projects.studio.auth.'

export function TableAccessMode({ tables, value, onChange }: Props) {
  const { t } = useI18n()
  const names = [...new Set(tables.map(x => String(x)))].sort((a, b) => a.localeCompare(b))
  const isOpen = (name: string) => value.open.includes(name.toLowerCase())
  const toggle = (name: string) => {
    const key = name.toLowerCase()
    onChange({ ...value, open: isOpen(name) ? value.open.filter(x => x !== key) : [...value.open, key] })
  }

  return (
    <div className="mt-10 bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800/80 rounded-2xl p-6 space-y-4">
      <div className="space-y-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-indigo-500" /> {t(t0 + 'ta_title')}
        </span>
        <p className="text-[11px] text-neutral-500 leading-relaxed max-w-3xl">{t(t0 + 'ta_desc')}</p>
      </div>

      <label className="flex items-center gap-3 text-sm font-bold text-neutral-800 dark:text-neutral-200 cursor-pointer">
        <input
          type="checkbox"
          checked={value.closed}
          onChange={e => onChange({ ...value, closed: e.target.checked })}
          className="w-4 h-4 accent-indigo-600"
        />
        {t(t0 + 'ta_closed')}
      </label>

      {!value.closed ? (
        <p className="text-[11px] text-neutral-400">{t(t0 + 'ta_off')}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t(t0 + 'ta_open_list')}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => onChange({ ...value, open: names.map(n => n.toLowerCase()) })} className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-indigo-600 hover:border-indigo-400 transition-all">
                {t(t0 + 'ta_open_all')}
              </button>
              <button type="button" onClick={() => onChange({ ...value, open: [] })} className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-indigo-600 hover:border-indigo-400 transition-all">
                {t(t0 + 'ta_close_all')}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {names.map(name => (
              <label key={name} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 cursor-pointer">
                <input type="checkbox" checked={isOpen(name)} onChange={() => toggle(name)} className="w-4 h-4 accent-indigo-600" />
                {name}
              </label>
            ))}
          </div>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">{t(t0 + 'ta_warn')}</p>
        </div>
      )}
    </div>
  )
}
