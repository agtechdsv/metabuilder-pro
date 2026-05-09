'use client'

import { useState, useEffect } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Loader2, Save, Eye, Pencil, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RecordDrawerProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'edit' | 'view'
  fields: any[]
  initialData?: any
  onSave: (data: any) => Promise<void>
  isLoading?: boolean
}

export default function RecordDrawer({ 
  isOpen, 
  onClose, 
  mode, 
  fields, 
  initialData, 
  onSave,
  isLoading = false
}: RecordDrawerProps) {
  const [formData, setFormData] = useState<any>(initialData || {})

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData || {})
    }
  }, [isOpen, initialData])

  const titles = {
    create: 'Novo Registro',
    edit: 'Editar Registro',
    view: 'Visualizar Detalhes'
  }

  const icons = {
    create: <Plus className="w-5 h-5 text-indigo-500" />,
    edit: <Pencil className="w-5 h-5 text-indigo-500" />,
    view: <Eye className="w-5 h-5 text-indigo-500" />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'view') return
    await onSave(formData)
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="">
      <div className="flex flex-col h-full">
        {/* Header Personalizado dentro do Drawer */}
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
            {icons[mode]}
          </div>
          <div>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{titles[mode]}</h3>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
              {mode === 'create' ? 'Novo Item' : `Registro #${initialData.id || 'N/A'}`}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          <div className="flex-1 space-y-6">
            {fields.map(field => {
              if (!field) return null;
              return (
                <div key={field.id} className="space-y-2">
                <label 
                  style={{
                    fontFamily: field.config?.label?.font,
                    fontSize: field.config?.label?.size,
                    color: field.config?.label?.color,
                  }}
                  className={cn(
                    "text-[10px] font-black tracking-widest ml-1",
                    !field.config?.label?.color && "text-neutral-400",
                    !field.config?.label?.font && "uppercase"
                  )}
                >
                  {field.display_name}
                  {field.is_primary_key && <span className="ml-2 text-indigo-500"># PK</span>}
                  {field.config?.content?.required && <span className="ml-1 text-red-500">*</span>}
                </label>
                
                <div className="relative group">
                  <input 
                    type="text"
                    disabled={mode === 'view' || field.is_primary_key}
                    required={field.config?.content?.required}
                    value={formData[field.db_column_name] ?? ''}
                    onChange={e => setFormData({ ...formData, [field.db_column_name]: e.target.value })}
                    style={{
                      fontFamily: field.config?.content?.font,
                      fontSize: field.config?.content?.size,
                      color: field.config?.content?.color,
                    }}
                    className={cn(
                      "w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-900 border rounded-2xl text-sm outline-none transition-all shadow-sm",
                      mode === 'view' 
                        ? "border-transparent bg-neutral-100/50 dark:bg-neutral-900/50 cursor-default opacity-80" 
                        : "border-neutral-200 dark:border-neutral-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 group-hover:border-neutral-300 dark:group-hover:border-neutral-700",
                      !field.config?.content?.color && "text-neutral-900 dark:text-neutral-300"
                    )}
                    placeholder={mode === 'view' ? '' : `Digite o valor para ${field.display_name}...`}
                  />
                </div>
              </div>
            )
          })}
          </div>

          {/* Footer do Form */}
          <div className="pt-8 mt-auto border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-end gap-3 bg-white dark:bg-neutral-950 sticky bottom-0">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
            >
              {mode === 'view' ? 'Fechar' : 'Cancelar'}
            </button>
            
            {mode !== 'view' && (
              <button 
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isLoading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            )}
          </div>
        </form>
      </div>
    </Drawer>
  )
}
