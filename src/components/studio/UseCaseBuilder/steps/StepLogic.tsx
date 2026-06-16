'use client'

import { useState } from 'react'
import {
  Settings2, Database, Layout, MousePointer2,
  ChevronUp, ChevronDown, CheckCircle2,
  Calendar, Share2, LayoutGrid, Settings,
  Columns, History, BarChartHorizontal, Activity
} from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'
import { slugify } from '../utils'
import type { StepBaseProps } from '../types'

export function StepLogic({ config, setConfig }: StepBaseProps) {
  const { t } = useI18n()

  const categories = [
    {
      id: 'dados',
      title: t('wizard.logic.categories.dados.title'),
      description: t('wizard.logic.categories.dados.desc'),
      icon: Database,
      items: [
        {
          id: 'pesquisa_cadastro',
          title: t('wizard.logic.types.pesquisa_cadastro.title', 'Pesquisa / Cadastro (Canvas)'),
          desc: t('wizard.logic.types.pesquisa_cadastro.desc', 'Telas completas gerenciadas por layout. Oculte as zonas que não desejar (Ex: "Apenas Cadastro").'),
          icon: Layout
        }
      ]
    },
    {
      id: 'projetos',
      title: t('wizard.logic.categories.projetos.title'),
      description: t('wizard.logic.categories.projetos.desc'),
      icon: Calendar,
      items: [
        { id: 'kanban',    title: t('wizard.logic.types.kanban.title'),    desc: t('wizard.logic.types.kanban.desc'),    icon: Columns },
        { id: 'timeline',  title: t('wizard.logic.types.timeline.title',  'Linha do Tempo / Feed'),  desc: t('wizard.logic.types.timeline.desc',  'Visualize registros em uma linha do tempo cronológica com base em uma data.'),  icon: History },
        { id: 'gantt',     title: t('wizard.logic.types.gantt.title',     'Gráfico de Gantt'),       desc: t('wizard.logic.types.gantt.desc',     'Gerencie cronogramas e projetos com um gráfico de Gantt.'),       icon: BarChartHorizontal },
        { id: 'scheduler', title: t('wizard.logic.types.scheduler.title', 'Agenda / Calendário'),    desc: t('wizard.logic.types.scheduler.desc', 'Agendamentos, prazos, compromissos e tarefas em calendário.'),    icon: Calendar }
      ]
    },
    {
      id: 'mapas',
      title: t('wizard.logic.categories.mapas.title'),
      description: t('wizard.logic.categories.mapas.desc'),
      icon: Share2,
      items: [
        { id: 'blueprint',  title: t('wizard.logic.types.blueprint.title',  'Fluxograma (Blueprint)'),    desc: t('wizard.logic.types.blueprint.desc',  'Mapeie processos e fluxos de trabalho interligados dinamicamente.'), icon: Activity },
        { id: 'mapa_mental', title: t('wizard.logic.types.mapa_mental.title'), desc: t('wizard.logic.types.mapa_mental.desc'), icon: Share2 },
        { id: 'map',        title: t('wizard.logic.types.map.title',        'Visão de Mapa (Geospatial)'), desc: t('wizard.logic.types.map.desc',        'Visualize registros através de marcadores e coordenadas interativas no mapa.'), icon: Share2 }
      ]
    },
    {
      id: 'outros',
      title: t('wizard.logic.categories.outros.title'),
      description: t('wizard.logic.categories.outros.desc'),
      icon: LayoutGrid,
      items: [
        { id: 'analytics', title: t('wizard.logic.types.analytics.title', 'Dashboard (BI)'),     desc: t('wizard.logic.types.analytics.desc', 'Indicadores de desempenho, gráficos e KPIs.'),                                            icon: Layout },
        { id: 'galeria',   title: t('wizard.logic.types.galeria.title',   'Galeria / Assets'),   desc: t('wizard.logic.types.galeria.desc',   'Galeria de mídias, imagens e documentos com download e redirecionamentos.'), icon: LayoutGrid }
      ]
    },
    {
      id: 'avancado',
      title: t('wizard.logic.categories.avancado.title', 'Avançado e Híbrido'),
      description: t('wizard.logic.categories.avancado.desc', 'Lógicas personalizadas unindo múltiplos componentes e views.'),
      icon: Settings,
      items: [
        { id: 'personalizado', title: t('wizard.logic.types.personalizado.title'), desc: t('wizard.logic.types.personalizado.desc'), icon: Settings }
      ]
    }
  ]

  const [expandedCategory, setExpandedCategory] = useState<string | null>(() => {
    if (config.name && config.logic_type) {
      const found = categories.find(c => c.items.some(i => i.id === config.logic_type))
      if (found) return found.id
    }
    return null
  })

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="space-y-2">
        <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white">{t('wizard.logic.title')}</h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('wizard.logic.subtitle')}</p>
      </div>

      {/* Name & Slug */}
      <div className="p-4 bg-neutral-50/50 dark:bg-neutral-900/30 rounded-[1.5rem] border border-neutral-200 dark:border-neutral-800 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.logic.screen_name')}</label>
            <input
              required
              autoFocus
              type="text"
              value={config.name}
              onChange={e => {
                const val = e.target.value
                const suggestedSlug = slugify(val)
                setConfig({
                  ...config,
                  name: val,
                  slug: (!config.slug || config.slug === slugify(config.name)) ? suggestedSlug : config.slug
                })
              }}
              placeholder={t('wizard.logic.screen_name_placeholder')}
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.logic.slug_label')}</label>
            <div className="flex items-center bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus-within:border-indigo-600 transition-all shadow-sm">
              <span className="text-neutral-400 mr-2 font-bold">/</span>
              <input
                type="text"
                value={config.slug}
                onChange={e => setConfig({ ...config, slug: e.target.value.toLowerCase().replace(/\s/g, '-') })}
                placeholder={t('wizard.logic.slug_placeholder')}
                className="w-full bg-transparent outline-none text-sm font-bold"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Logic type selector */}
      <div className="space-y-4">
        {categories.map(cat => {
          const isExpanded = expandedCategory === cat.id
          const hasSelectedLogic = cat.items.some(i => i.id === config.logic_type)

          return (
            <div key={cat.id} className={cn(
              "rounded-[1.5rem] border-2 overflow-hidden transition-all duration-300",
              isExpanded
                ? "border-indigo-600 bg-white dark:bg-neutral-950 shadow-xl"
                : "border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 hover:border-neutral-300 dark:hover:border-neutral-700 cursor-pointer"
            )}>
              {/* Category header */}
              <div
                className={cn("p-4 flex items-center justify-between", !isExpanded && "cursor-pointer")}
                onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                    isExpanded || hasSelectedLogic
                      ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                      : "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-500"
                  )}>
                    <cat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-neutral-900 dark:text-white text-sm">{cat.title}</h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{cat.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {hasSelectedLogic && !isExpanded && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md">
                      Selecionado
                    </span>
                  )}
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-neutral-400" /> : <ChevronDown className="w-5 h-5 text-neutral-400" />}
                </div>
              </div>

              {/* Logic type grid */}
              {isExpanded && (
                <div className="p-4 pt-0 border-t border-neutral-100 dark:border-neutral-800/50 mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-4">
                    {cat.items.map(item => (
                      <button
                        key={item.id}
                        onClick={e => { e.stopPropagation(); setConfig({ ...config, logic_type: item.id }) }}
                        className={cn(
                          "p-4 rounded-[1.25rem] border-2 text-left transition-all group relative overflow-hidden",
                          config.logic_type === item.id
                            ? 'border-indigo-600 bg-indigo-600/5 shadow-md shadow-indigo-500/10 scale-[1.02]'
                            : 'border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 bg-white dark:bg-neutral-950/50'
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center mb-3 transition-all shadow-sm",
                          config.logic_type === item.id
                            ? 'bg-indigo-600 text-white'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30'
                        )}>
                          <item.icon className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-sm mb-1 text-neutral-900 dark:text-white">{item.title}</h4>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium line-clamp-2">{item.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* has_arguments toggle */}
      {(config.logic_type.includes('pesquisa') || config.logic_type === 'kanban') && (
        <div
          className="flex items-center gap-4 p-6 bg-white dark:bg-neutral-950/50 rounded-2xl border border-neutral-200 dark:border-neutral-800 group cursor-pointer hover:border-indigo-500/30 transition-all"
          onClick={() => setConfig({ ...config, has_arguments: !config.has_arguments })}
        >
          <div className={cn(
            "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
            config.has_arguments ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-neutral-200 dark:border-neutral-800'
          )}>
            {config.has_arguments && <CheckCircle2 className="w-4 h-4" />}
          </div>
          <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">{t('wizard.logic.enable_args')}</span>
        </div>
      )}
    </div>
  )
}
