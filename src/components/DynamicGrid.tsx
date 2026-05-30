'use client'

import { Pencil, Trash2, Search, Zap, Link, Database, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DynamicIcon } from '@/components/runtime/DynamicIcon'

interface DynamicGridProps {
  fields: any[]
  data: any[]
  buttonsConfig?: any[]
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => void
  customActions?: any[]
  onCustomAction?: (action: any, row: any) => void
  relationalOptions?: Record<string, any[]>
}

const getActionColorClasses = (color: string) => {
  const normalized = color?.toLowerCase() || 'indigo'
  switch (normalized) {
    case 'emerald':
      return {
        text: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        border: 'border-emerald-200 dark:border-emerald-800/50',
        hover: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-300'
      }
    case 'amber':
      return {
        text: 'text-amber-650 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        border: 'border-amber-200 dark:border-amber-800/50',
        hover: 'hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-305'
      }
    case 'red':
      return {
        text: 'text-red-655 dark:text-red-405',
        bg: 'bg-red-50 dark:bg-red-950/30',
        border: 'border-red-200 dark:border-red-800/50',
        hover: 'hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-305'
      }
    case 'blue':
      return {
        text: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        border: 'border-blue-200 dark:border-blue-800/50',
        hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-350'
      }
    case 'violet':
      return {
        text: 'text-violet-650 dark:text-violet-400',
        bg: 'bg-violet-50 dark:bg-violet-950/30',
        border: 'border-violet-200 dark:border-violet-800/50',
        hover: 'hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-700 dark:hover:text-violet-305'
      }
    case 'pink':
      return {
        text: 'text-pink-655 dark:text-pink-400',
        bg: 'bg-pink-50 dark:bg-pink-950/30',
        border: 'border-pink-200 dark:border-pink-800/50',
        hover: 'hover:bg-pink-100 dark:hover:bg-pink-900/30 hover:text-pink-700 dark:hover:text-pink-305'
      }
    case 'rose':
      return {
        text: 'text-rose-600 dark:text-rose-400',
        bg: 'bg-rose-50 dark:bg-rose-950/30',
        border: 'border-rose-200 dark:border-rose-800/50',
        hover: 'hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-700 dark:hover:text-rose-350'
      }
    case 'neutral':
    case 'gray':
      return {
        text: 'text-neutral-600 dark:text-neutral-400',
        bg: 'bg-neutral-50 dark:bg-neutral-950/30',
        border: 'border-neutral-200 dark:border-neutral-800/50',
        hover: 'hover:bg-neutral-100 dark:hover:bg-neutral-900/30 hover:text-neutral-700 dark:hover:text-neutral-300'
      }
    case 'indigo':
    default:
      return {
        text: 'text-indigo-650 dark:text-indigo-400',
        bg: 'bg-indigo-50 dark:bg-indigo-950/30',
        border: 'border-indigo-200 dark:border-indigo-800/50',
        hover: 'hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-305'
      }
  }
}

const getFontFamily = (font?: string) => {
  if (!font) return undefined;
  const cleanFont = font.replace(' (Padrão)', '');
  if (cleanFont.includes('Mono')) return `"${cleanFont}", monospace`;
  return `"${cleanFont}", sans-serif`;
}

const getFontSize = (size?: string) => {
  if (!size) return undefined;
  if (!isNaN(Number(size))) return `${size}px`;
  return size;
}

export default function DynamicGrid({ 
  fields, 
  data, 
  buttonsConfig = [],
  onView,
  onEdit,
  onDelete,
  customActions = [],
  onCustomAction,
  relationalOptions = {}
}: DynamicGridProps) {
  const canView = buttonsConfig.find((b: any) => b.id === 'view')?.visible === true
  const canEdit = buttonsConfig.find((b: any) => b.id === 'edit')?.visible === true
  const canDelete = buttonsConfig.find((b: any) => b.id === 'delete')?.visible === true

  const btnView = buttonsConfig?.find((b: any) => b.id === 'view')
  const btnEdit = buttonsConfig?.find((b: any) => b.id === 'edit')
  const btnDelete = buttonsConfig?.find((b: any) => b.id === 'delete')

  const getButtonStyles = (btn: any) => {
    if (!btn) return {}
    const styles: React.CSSProperties = {}
    if (btn.font_family && btn.font_family !== 'Inter (Padrão)') {
      styles.fontFamily = btn.font_family
    }
    if (btn.font_size) {
      styles.fontSize = btn.font_size
    }
    if (btn.text_color) {
      styles.color = btn.text_color
    }
    if (btn.bg_color) {
      styles.backgroundColor = btn.bg_color
      styles.borderColor = btn.bg_color
    }
    return styles
  }

  const getNestedValue = (obj: any, path: string) => {
    if (!obj || !path) return undefined
    
    // 1. Tenta acesso direto (caso a chave tenha pontos mas o objeto seja flat no JSON)
    if (obj[path] !== undefined) return obj[path]
    
    // 2. Tenta acesso aninhado real (ex: row.user.name)
    const nested = path.split('.').reduce((acc, part) => acc && acc[part], obj)
    if (nested !== undefined) return nested

    // 3. Tenta apenas a última parte (caso o backend retorne sem prefixo de tabela, ex: 'fields.name' -> 'name')
    if (path.includes('.')) {
      const parts = path.split('.')
      const lastPart = parts[parts.length - 1]
      if (obj[lastPart] !== undefined) return obj[lastPart]
    }
    
    // 4. Tenta com underscore no lugar do ponto (algumas bibliotecas/drivers fazem essa conversão)
    if (path.includes('.')) {
      const underscorePath = path.replace(/\./g, '_')
      if (obj[underscorePath] !== undefined) return obj[underscorePath]
    }
    
    return undefined
  }

  if (data.length === 0) {
    return (
      <tr>
        <td colSpan={fields.length + 2} className="px-6 py-16 text-center text-neutral-500">
          Nenhum registro encontrado nesta tabela.
        </td>
      </tr>
    )
  }

  return (
    <>
      {data.map((row, rowIndex) => (
        <tr key={rowIndex} className="group border-b border-neutral-100 dark:border-neutral-800/50 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
          <td className={cn(
            "sticky left-0 z-10 px-4 py-4 whitespace-nowrap w-[60px] text-center border-r border-neutral-200/50 dark:border-neutral-700/50 shadow-[4px_0_10px_rgba(0,0,0,0.03)] transition-colors",
            rowIndex % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-neutral-100/90 dark:bg-neutral-800"
          )}>
            <input type="checkbox" className="rounded-md bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-indigo-600 focus:ring-indigo-500" />
          </td>
          {fields.map((field) => {
            const rawVal = getNestedValue(row, field.db_column_name)
            
            // Resolve label if it is a relational combo
            const comp = field.config?.grid_config?.component || field.config?.component || {}
            let finalVal = rawVal
            if (comp.type === 'select' || comp.type === 'Combo (Select)' || comp.options_type === 'relational') {
               const opts = relationalOptions[field.id]
               if (opts && opts.length > 0) {
                 // Convert both to string to avoid mismatch between number and string IDs
                 const found = opts.find((o: any) => String(o.value) === String(rawVal))
                 if (found) {
                   finalVal = found.label
                 }
               }
            }

            const val = typeof finalVal === 'object' && finalVal !== null
              ? JSON.stringify(finalVal) 
              : String(finalVal ?? '')
            
            const zoneConfig = field.config?.grid_config || field.config || {}
            
            return (
              <td 
                key={field.id} 
                title={val}
                style={{
                  fontFamily: getFontFamily(zoneConfig.content?.font),
                  fontSize: getFontSize(zoneConfig.content?.size),
                  color: zoneConfig.content?.color,
                }}
                className={cn(
                  "px-6 py-4 whitespace-nowrap text-sm font-medium transition-colors max-w-[300px] truncate cursor-help",
                  !zoneConfig.content?.color && "text-neutral-900 dark:text-neutral-300",
                  rowIndex % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-neutral-100/90 dark:bg-neutral-800"
                )}
              >
                {val}
              </td>
            )
          })}
          <td className={cn(
            "sticky right-0 z-10 px-4 py-4 text-right whitespace-nowrap text-sm font-bold border-l border-neutral-200/50 dark:border-neutral-700/50 shadow-[-4px_0_10px_rgba(0,0,0,0.03)] transition-colors",
            rowIndex % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-neutral-100/90 dark:bg-neutral-800"
          )}>
            <div className="flex items-center justify-end gap-1.5">
              {canView && (
                <button 
                  title={btnView?.custom_label !== undefined && btnView.custom_label !== '' ? btnView.custom_label : "Visualizar"}
                  onClick={() => onView?.(row)}
                  style={getButtonStyles(btnView)}
                  className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all active:scale-90 shadow-sm"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              )}
              {canEdit && (
                <button 
                  title={btnEdit?.custom_label !== undefined && btnEdit.custom_label !== '' ? btnEdit.custom_label : "Editar"}
                  onClick={() => onEdit?.(row)}
                  style={getButtonStyles(btnEdit)}
                  className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 border border-neutral-200 dark:border-neutral-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all active:scale-90 shadow-sm"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {canDelete && (
                <button 
                  title={btnDelete?.custom_label !== undefined && btnDelete.custom_label !== '' ? btnDelete.custom_label : "Excluir"}
                  onClick={() => onDelete?.(row)}
                  style={getButtonStyles(btnDelete)}
                  className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 text-red-500 border border-neutral-200 dark:border-neutral-700 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all active:scale-90 shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {customActions.filter(a => (a.contexts ? (Array.isArray(a.contexts) ? a.contexts : [a.contexts]) : [a.context]).includes('row')).map(action => {
                const colors = getActionColorClasses(action.color)
                return (
                  <button
                    key={action.id}
                    title={action.label}
                    onClick={() => onCustomAction?.(action, row)}
                    className={cn(
                      "p-1.5 rounded-lg border transition-all active:scale-90 shadow-sm bg-white dark:bg-neutral-850 border-neutral-200 dark:border-neutral-700",
                      colors.text,
                      colors.hover
                    )}
                  >
                    <DynamicIcon icon={action.icon || 'Zap'} className="w-3.5 h-3.5" />
                  </button>
                )
              })}
            </div>
          </td>
        </tr>
      ))}
    </>
  )
}
