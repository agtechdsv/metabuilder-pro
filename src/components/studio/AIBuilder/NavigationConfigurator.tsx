'use client'

import { Menu, MousePointer2, Layers, Link } from 'lucide-react'

interface NavigationConfiguratorProps {
  name: string
  slug: string
  navigation: string
  description: string
  onChangeName: (v: string) => void
  onChangeSlug: (v: string) => void
  onChangeNavigation: (v: string) => void
}

const NAV_OPTIONS = [
  {
    value: 'menu_item',
    label: 'Item de Menu Lateral',
    icon: Menu,
    description: 'Aparece no menu de navegação principal do app'
  },
  {
    value: 'floating_button',
    label: 'Botão Flutuante (FAB)',
    icon: MousePointer2,
    description: 'Botão de ação rápida flutuante na interface'
  },
  {
    value: 'tab',
    label: 'Aba (dentro de outro caso de uso)',
    icon: Layers,
    description: 'Acessível como sub-aba de outro caso de uso'
  },
  {
    value: 'url_only',
    label: 'Apenas via URL',
    icon: Link,
    description: 'Sem entrada no menu — acessível só pelo link direto'
  },
]

export function NavigationConfigurator({
  name,
  slug,
  navigation,
  description,
  onChangeName,
  onChangeSlug,
  onChangeNavigation,
}: NavigationConfiguratorProps) {

  const handleNameChange = (value: string) => {
    onChangeName(value)
    // Auto-gera o slug a partir do nome
    const autoSlug = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
    onChangeSlug(autoSlug)
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Descrição gerada pela IA */}
      {description && (
        <div className="p-4 bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 rounded-xl">
          <p className="text-xs font-bold text-violet-700 dark:text-violet-400 mb-1">Descrição gerada pela IA</p>
          <p className="text-sm text-violet-700 dark:text-violet-300">{description}</p>
        </div>
      )}

      {/* Nome */}
      <div>
        <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-2">
          Nome do Caso de Uso
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          placeholder="Ex: Gestão de Clientes"
        />
      </div>

      {/* Slug */}
      <div>
        <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-2">
          Slug (URL do caso de uso)
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400 shrink-0">/{'{workspace}'}/{'{projeto}'}/</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => onChangeSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            className="flex-grow px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 font-mono"
            placeholder="gestao-de-clientes"
          />
        </div>
      </div>

      {/* Navegação */}
      <div>
        <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-3">
          Como será acessado?
        </label>
        <div className="grid grid-cols-1 gap-3">
          {NAV_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const selected = navigation === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => onChangeNavigation(opt.value)}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                  selected
                    ? 'border-violet-600 bg-violet-50 dark:bg-violet-500/10'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900/40'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  selected ? 'bg-violet-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className={`text-sm font-bold ${selected ? 'text-violet-700 dark:text-violet-300' : 'text-neutral-700 dark:text-neutral-300'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">{opt.description}</p>
                </div>
                <div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selected ? 'border-violet-600 bg-violet-600' : 'border-neutral-300 dark:border-neutral-700'
                }`}>
                  {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
