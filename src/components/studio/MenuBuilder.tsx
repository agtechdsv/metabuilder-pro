'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Plus,
  Trash2,
  GripVertical,
  FolderPlus,
  Link as LinkIcon,
  ChevronDown,
  ChevronRight,
  Save,
  Loader2,
  Box,
  Layers,
  Layout,
  Settings,
  Database,
  Search,
  Globe,
  MoreVertical
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { IconPicker } from './IconPicker'
import { DynamicIcon } from '@/components/runtime/DynamicIcon'

interface MenuItem {
  id: string
  label: string
  description?: string
  icon: string
  type: 'view' | 'link' | 'folder'
  target: string
  show_dashboard?: boolean
  children?: MenuItem[]
}

interface MenuBuilderProps {
  project: any
  views: any[]
  onSave: (menu: MenuItem[]) => Promise<void>
}

export function MenuBuilder({ project, views, onSave }: MenuBuilderProps) {
  const { t } = useI18n()
  const [menu, setMenu] = useState<MenuItem[]>(project.navigation || [])
  const [isSaving, setIsSaving] = useState(false)
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)

  const addItem = (parentId: string | null = null, type: 'view' | 'link' | 'folder' = 'view') => {
    const newId = Math.random().toString(36).substr(2, 9)
    const newItem: MenuItem = {
      id: newId,
      label: '', 
      description: '',
      icon: type === 'folder' ? 'Layers' : 'Layout',
      type,
      target: '',
      show_dashboard: true,
      children: type === 'folder' ? [] : undefined
    }

    setLastAddedId(newId)

    if (!parentId) {
      setMenu([...menu, newItem])
    } else {
      const updateChildren = (items: MenuItem[]): MenuItem[] => {
        return items.map(item => {
          if (item.id === parentId) {
            return { ...item, children: [...(item.children || []), newItem] }
          }
          if (item.children) {
            return { ...item, children: updateChildren(item.children) }
          }
          return item
        })
      }
      setMenu(updateChildren(menu))
    }
  }

  const removeItem = (id: string) => {
    const filterItems = (items: MenuItem[]): MenuItem[] => {
      return items
        .filter(item => item.id !== id)
        .map(item => ({
          ...item,
          children: item.children ? filterItems(item.children) : undefined
        }))
    }
    setMenu(filterItems(menu))
  }

  const updateItem = (id: string, updates: Partial<MenuItem>) => {
    const updateItems = (items: MenuItem[]): MenuItem[] => {
      return items.map(item => {
        if (item.id === id) {
          return { ...item, ...updates }
        }
        if (item.children) {
          return { ...item, children: updateItems(item.children) }
        }
        return item
      })
    }
    setMenu(updateItems(menu))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(menu)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] overflow-hidden shadow-sm">
      <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-neutral-900 dark:text-white">Gerador de Menu de Navegação</h3>
          <p className="text-[10px] text-neutral-400 font-medium mt-1 uppercase tracking-widest">Organize como seus usuários navegarão no App</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Salvar Estrutura
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        <div className="space-y-3">
          {menu.map((item) => (
            <MenuNode
              key={item.id}
              item={item}
              views={views}
              onUpdate={updateItem}
              onRemove={removeItem}
              onAddChild={addItem}
              lastAddedId={lastAddedId}
            />
          ))}

          {menu.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-neutral-100 dark:border-neutral-800 rounded-[2rem] text-neutral-300">
              <Layout className="w-12 h-12 opacity-10 mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">Nenhum item no menu</p>
            </div>
          )}
        </div>

        <div className="pt-6 flex gap-3">
          <button
            onClick={() => addItem(null, 'view')}
            className="flex-1 flex items-center justify-center gap-2 py-4 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:border-indigo-500 hover:text-indigo-600 transition-all group"
          >
            <LinkIcon className="w-4 h-4 group-hover:scale-110 transition-transform" /> Adicionar Link
          </button>
          <button
            onClick={() => addItem(null, 'folder')}
            className="flex-1 flex items-center justify-center gap-2 py-4 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:border-emerald-500 hover:text-emerald-600 transition-all group"
          >
            <FolderPlus className="w-4 h-4 group-hover:scale-110 transition-transform" /> Criar Menu
          </button>
        </div>
      </div>
    </div>
  )
}

function MenuNode({ item, views, onUpdate, onRemove, onAddChild, lastAddedId }: any) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (lastAddedId === item.id && inputRef.current) {
      inputRef.current.focus()
    }
  }, [lastAddedId, item.id])

  return (
    <div className="space-y-2">
      <div className={cn(
        "group flex items-center gap-4 p-4 rounded-2xl border transition-all relative",
        item.type === 'folder'
          ? "bg-emerald-500/5 border-emerald-500/10 dark:bg-emerald-500/10 dark:border-emerald-500/20"
          : "bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800"
      )}>
        <GripVertical className="w-4 h-4 text-neutral-300 cursor-grab active:cursor-grabbing shrink-0" />

        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => setShowIconPicker(true)}
            className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group/icon"
            title="Alterar Ícone"
          >
            <DynamicIcon icon={item.icon} size={16} className="group-hover/icon:scale-110 transition-transform" />
          </button>
        </div>

        {showIconPicker && (
          <IconPicker 
            currentIcon={item.icon}
            onSelect={(icon) => onUpdate(item.id, { icon })}
            onClose={() => setShowIconPicker(false)}
          />
        )}

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="flex flex-col gap-1">
            <input
              ref={inputRef}
              value={item.label}
              onChange={e => onUpdate(item.id, { label: e.target.value })}
              placeholder={item.type === 'folder' ? 'Nome do Menu...' : 'Nome do Menu...'}
              className="bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-sm font-bold text-neutral-900 dark:text-white"
            />
            <input
              value={item.description || ''}
              onChange={e => onUpdate(item.id, { description: e.target.value })}
              placeholder="Descrição curta..."
              className="bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-[9px] font-medium text-neutral-400"
            />
          </div>

          {item.type === 'view' && (
            <select
              value={item.target}
              onChange={e => {
                const selectedSlug = e.target.value
                const selectedView = views.find(v => v.slug === selectedSlug)
                const updates: any = { target: selectedSlug }
                
                // Se o label estiver vazio, sugere o nome do caso de uso
                if (!item.label && selectedView) {
                  updates.label = selectedView.name
                }
                
                onUpdate(item.id, updates)
              }}
              className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
            >
              <option value="">Selecionar Caso de Uso...</option>
              {views.map((v: any) => (
                <option key={v.id} value={v.slug}>{v.name}</option>
              ))}
            </select>
          )}

          {item.type === 'link' && (
            <input
              value={item.target}
              onChange={e => onUpdate(item.id, { target: e.target.value })}
              placeholder="https://..."
              className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
            />
          )}

          <div className="flex items-center gap-2 justify-end relative">
            {item.type === 'folder' && (
              <div className="relative">
                <button
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className={cn(
                    "p-2 rounded-xl transition-all flex items-center gap-1",
                    showAddMenu ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-neutral-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                  )}
                  title="Adicionar..."
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest pr-1">Adicionar</span>
                </button>

                {showAddMenu && (
                  <div className="absolute top-full right-0 mt-2 w-32 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl z-[100] p-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={() => {
                        onAddChild(item.id, 'view')
                        setShowAddMenu(false)
                        setIsExpanded(true)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-left transition-colors"
                    >
                      <LinkIcon className="w-3 h-3 text-indigo-500" />
                      <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300">Link/View</span>
                    </button>
                    <button
                      onClick={() => {
                        onAddChild(item.id, 'folder')
                        setShowAddMenu(false)
                        setIsExpanded(true)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-left transition-colors"
                    >
                      <Layers className="w-3 h-3 text-emerald-500" />
                      <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300">Menu</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <input 
                type="checkbox" 
                checked={item.show_dashboard !== false}
                onChange={e => onUpdate(item.id, { show_dashboard: e.target.checked })}
                className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
                id={`dash-${item.id}`}
              />
              <label htmlFor={`dash-${item.id}`} className="text-[9px] font-black uppercase tracking-widest text-neutral-400 cursor-pointer select-none">Dash</label>
            </div>

            <button
              onClick={() => onRemove(item.id)}
              className="p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {item.type === 'folder' && (
              <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {item.type === 'folder' && isExpanded && (
        <div className="ml-10 border-l-2 border-neutral-100 dark:border-neutral-800 pl-4 space-y-2">
          {item.children?.map((child: any) => (
            <MenuNode
              key={child.id}
              item={child}
              views={views}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onAddChild={onAddChild}
              lastAddedId={lastAddedId}
            />
          ))}
          {item.children?.length === 0 && (
            <p className="text-[10px] text-neutral-400 italic py-2">Menu vazio</p>
          )}
        </div>
      )}
    </div>
  )
}
