'use client'

import React, { useState } from 'react'
import { Save, Palette, Type, Layout } from 'lucide-react'
import { IconPicker } from './IconPicker'
import { DynamicIcon } from '@/components/runtime/DynamicIcon'
import { cn } from '@/lib/utils'

interface BrandingConfigProps {
  project: any
  onSave: (data: any) => Promise<void>
}

export function BrandingConfig({ project, onSave }: BrandingConfigProps) {
  const [name, setName] = useState(project.name || '')
  const [description, setDescription] = useState(project.description || '')
  const [icon, setIcon] = useState(project.icon || 'Box')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [enableDownloads, setEnableDownloads] = useState(project.theme_config?.enable_downloads !== false)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave({ 
        name, 
        description, 
        icon,
        theme_config: {
          ...(project.theme_config || {}),
          enable_downloads: enableDownloads
        }
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-black/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight uppercase">Identidade do Projeto</h3>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Configure o nome, descrição e o ícone global</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8">
          
          {/* Nome e Descrição */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Nome do Projeto</label>
              <input 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-neutral-100 dark:bg-neutral-950 border border-transparent focus:border-indigo-500 rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all"
                placeholder="Ex: CRM Vendas"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Slogan / Descrição Curta</label>
              <input 
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full bg-neutral-100 dark:bg-neutral-950 border border-transparent focus:border-indigo-500 rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all"
                placeholder="Ex: Gestão inteligente de leads"
              />
            </div>
          </div>

          {/* Seletor de Ícone Global */}
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Ícone / Logo do Projeto</label>
            <div className="flex items-center gap-6 p-6 bg-neutral-50 dark:bg-black/20 rounded-[2rem] border border-neutral-100 dark:border-neutral-800">
              <div className="w-20 h-20 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-500/30 shrink-0">
                <DynamicIcon icon={icon} size={40} />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-tight">Ícone Principal</p>
                  <p className="text-[10px] text-neutral-400 font-medium leading-relaxed">Este ícone será usado na barra lateral, no dashboard principal e como identidade visual do seu projeto.</p>
                </div>
                <button 
                  onClick={() => setShowIconPicker(true)}
                  className="px-6 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all shadow-sm"
                >
                  Alterar Ícone
                </button>
              </div>
            </div>
          </div>

          {showIconPicker && (
            <IconPicker 
              currentIcon={icon}
              onSelect={setIcon}
              onClose={() => setShowIconPicker(false)}
            />
          )}

          {/* Preview no Sidebar */}
          <div className="p-6 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-3xl border border-indigo-100 dark:border-indigo-900/20">
             <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                  <DynamicIcon icon={icon} size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black uppercase tracking-widest text-neutral-900 dark:text-white leading-none">{name || 'Projeto'}</span>
                  <span className="text-[8px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mt-0.5">MetaBuilder Pro</span>
                </div>
                <div className="ml-auto">
                   <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Preview na Sidebar</span>
                </div>
             </div>
          </div>

          {/* Configuração de Recursos Globais */}
          <div className="space-y-4 pt-4 border-t border-neutral-100 dark:border-neutral-800/50">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Recursos Globais do Projeto</label>
            <div className="flex items-center justify-between p-6 bg-neutral-50 dark:bg-black/20 rounded-[2rem] border border-neutral-100 dark:border-neutral-800">
              <div className="space-y-1">
                <p className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-tight">Central de Downloads (Exportações Assíncronas)</p>
                <p className="text-[10px] text-neutral-400 font-medium leading-relaxed max-w-xl">
                  Habilita a exportação de dados em segundo plano (XLSX, CSV, JSON) com notificações de progresso em tempo real e um gerenciador de downloads.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnableDownloads(!enableDownloads)}
                className={cn(
                  "w-14 h-8 rounded-full transition-all relative flex items-center shrink-0 border border-neutral-200 dark:border-neutral-800",
                  enableDownloads ? "bg-indigo-600 border-indigo-600" : "bg-neutral-200 dark:bg-neutral-800"
                )}
              >
                <div 
                  className={cn(
                    "w-6 h-6 bg-white rounded-full transition-all shadow-md absolute",
                    enableDownloads ? "right-1" : "left-1"
                  )} 
                />
              </button>
            </div>
          </div>

        </div>

        <div className="p-8 bg-neutral-50 dark:bg-black/40 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
          >
            {isSaving ? 'Salvando...' : <><Save className="w-4 h-4" /> Salvar Identidade</>}
          </button>
        </div>
      </div>
    </div>
  )
}
