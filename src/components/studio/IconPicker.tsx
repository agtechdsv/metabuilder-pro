'use client'

import React, { useState } from 'react'
import * as LucideIcons from 'lucide-react'
import { Search, X, Code, Grid, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DynamicIcon } from '@/components/runtime/DynamicIcon'

interface IconPickerProps {
  currentIcon: string
  onSelect: (icon: string) => void
  onClose: () => void
}

const ICON_CATEGORIES = [
  {
    name: 'Negócios & CRM',
    icons: ['Users', 'UserPlus', 'UserCheck', 'Briefcase', 'Contact', 'Building2', 'Target', 'Handshake']
  },
  {
    name: 'Financeiro',
    icons: ['DollarSign', 'CreditCard', 'PieChart', 'BarChart3', 'TrendingUp', 'Wallet', 'Calculator', 'PiggyBank']
  },
  {
    name: 'Navegação',
    icons: ['Home', 'Layout', 'Layers', 'Grid', 'Menu', 'Map', 'Compass', 'Navigation']
  },
  {
    name: 'Dados & Tecnologia',
    icons: ['Database', 'HardDrive', 'Cpu', 'Cloud', 'Zap', 'Shield', 'Code', 'Terminal']
  },
  {
    name: 'Comunicação',
    icons: ['Mail', 'MessageSquare', 'Phone', 'Send', 'Share2', 'Bell', 'Announce', 'AtSign']
  },
  {
    name: 'Operações',
    icons: ['Package', 'ShoppingCart', 'Truck', 'Tag', 'ClipboardList', 'Calendar', 'Clock', 'Settings']
  }
]

export function IconPicker({ currentIcon, onSelect, onClose }: IconPickerProps) {
  const [activeTab, setActiveTab] = useState<'library' | 'custom'>('library')
  const [search, setSearch] = useState('')
  const [customSvg, setCustomSvg] = useState(currentIcon.startsWith('<svg') ? currentIcon : '')

  const filteredCategories = ICON_CATEGORIES.map(cat => ({
    ...cat,
    icons: cat.icons.filter(icon => 
      icon.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(cat => cat.icons.length > 0)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black uppercase tracking-[0.2em] text-neutral-900 dark:text-white">Biblioteca de Ícones</h3>
            <p className="text-[10px] text-neutral-400 font-medium mt-1 uppercase tracking-widest">Escolha um ícone profissional para seu menu</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors text-neutral-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-black/20">
          <button
            onClick={() => setActiveTab('library')}
            className={cn(
              "px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative",
              activeTab === 'library' ? "text-indigo-600" : "text-neutral-400 hover:text-neutral-600"
            )}
          >
            Galeria Curada
            {activeTab === 'library' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={cn(
              "px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative",
              activeTab === 'custom' ? "text-indigo-600" : "text-neutral-400 hover:text-neutral-600"
            )}
          >
            SVG Customizado
            {activeTab === 'custom' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {activeTab === 'library' ? (
            <div className="space-y-8">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Pesquisar ícones..."
                  className="w-full bg-neutral-100 dark:bg-neutral-950 border border-transparent focus:border-indigo-500 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none transition-all"
                />
              </div>

              {/* Grid */}
              {filteredCategories.map((category, idx) => (
                <div key={idx} className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{category.name}</h4>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                    {category.icons.map(iconName => {
                      const isSelected = currentIcon === iconName
                      return (
                        <button
                          key={iconName}
                          onClick={() => {
                            onSelect(iconName)
                            onClose()
                          }}
                          className={cn(
                            "aspect-square flex flex-col items-center justify-center gap-2 rounded-2xl border transition-all group",
                            isSelected 
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-500/20" 
                              : "bg-white dark:bg-neutral-950 border-neutral-100 dark:border-neutral-800 hover:border-indigo-500 hover:shadow-lg"
                          )}
                        >
                          <DynamicIcon icon={iconName} size={20} />
                          <span className={cn(
                            "text-[8px] font-medium truncate w-full px-1",
                            isSelected ? "text-white/80" : "text-neutral-400 group-hover:text-neutral-600"
                          )}>
                            {iconName}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-3xl border border-indigo-100 dark:border-indigo-900/20">
                <div className="flex items-start gap-4 text-indigo-600 dark:text-indigo-400">
                  <Code className="w-5 h-5 shrink-0 mt-1" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold">Importe seus próprios ícones</p>
                    <p className="text-[10px] opacity-70 leading-relaxed">Cole abaixo o código SVG completo. Certifique-se de que o SVG use `fill="currentColor"` ou `stroke="currentColor"` para respeitar as cores do tema.</p>
                  </div>
                </div>
              </div>

              <textarea
                value={customSvg}
                onChange={e => setCustomSvg(e.target.value)}
                placeholder="<svg ...> ... </svg>"
                rows={10}
                className="w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 text-[10px] font-mono outline-none focus:border-indigo-500 transition-all resize-none"
              />

              <button
                disabled={!customSvg.trim().startsWith('<svg')}
                onClick={() => {
                  onSelect(customSvg)
                  onClose()
                }}
                className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20"
              >
                <Check className="w-4 h-4" /> Aplicar SVG Customizado
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
