'use client'

import { Pencil, Trash2, Calendar, Hash, Type, Search, Zap, Link, Database, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DynamicCardListProps {
  fields: any[]
  data: any[]
  buttonsConfig?: any[]
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => void
  customActions?: any[]
  onCustomAction?: (action: any, row: any) => void
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

export default function DynamicCardList({ 
  fields, 
  data, 
  buttonsConfig = [],
  onView,
  onEdit,
  onDelete,
  customActions = [],
  onCustomAction
}: DynamicCardListProps) {
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
    if (btn.text_transform && btn.text_transform !== 'none') {
      styles.textTransform = btn.text_transform
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
      <div className="col-span-full py-20 text-center bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem]">
        <p className="text-neutral-500">Nenhum registro encontrado.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {data.map((row, index) => (
        <div
          key={index}
          className="group relative bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-500/30 transition-all duration-300 flex flex-col h-full min-h-[180px]"
        >
          {/* Badge de ID ou Principal */}
          <div className="flex items-start justify-between mb-3">
            <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <Type className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5">
              {canView && (
                <button 
                  title={btnView?.custom_label !== undefined && btnView.custom_label !== '' ? btnView.custom_label : "Visualizar"}
                  onClick={() => onView?.(row)}
                  style={getButtonStyles(btnView)}
                  className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/50 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all active:scale-90"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              )}
              {canEdit && (
                <button 
                  title={btnEdit?.custom_label !== undefined && btnEdit.custom_label !== '' ? btnEdit.custom_label : "Editar"}
                  onClick={() => onEdit?.(row)}
                  style={getButtonStyles(btnEdit)}
                  className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all active:scale-90"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {canDelete && (
                <button 
                  title={btnDelete?.custom_label !== undefined && btnDelete.custom_label !== '' ? btnDelete.custom_label : "Excluir"}
                  onClick={() => onDelete?.(row)}
                  style={getButtonStyles(btnDelete)}
                  className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all active:scale-90"
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
                      "p-1.5 rounded-lg border transition-all active:scale-90 shadow-sm bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700",
                      colors.text,
                      colors.hover
                    )}
                  >
                    {action.icon === 'Zap' && <Zap className="w-3.5 h-3.5" />}
                    {action.icon === 'Link' && <Link className="w-3.5 h-3.5" />}
                    {action.icon === 'Database' && <Database className="w-3.5 h-3.5" />}
                    {action.icon === 'Globe' && <Globe className="w-3.5 h-3.5" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dados do Card - Limitado a 3 campos principais para não ficar gigante */}
          <div className="space-y-3 flex-1">
            {fields.slice(0, 4).map((field, fIdx) => {
              const rawVal = getNestedValue(row, field.db_column_name)
              const isFirst = fIdx === 0
              const displayVal = typeof rawVal === 'object' && rawVal !== null ? JSON.stringify(rawVal) : String(rawVal ?? '')

              const zoneConfig = field.config?.grid_config || field.config || {}

              if (isFirst) {
                return (
                  <h4 
                    key={field.id} 
                    title={displayVal}
                    style={{
                      fontFamily: zoneConfig.content?.font,
                      fontSize: zoneConfig.content?.size,
                      color: zoneConfig.content?.color,
                    }}
                    className={cn(
                      "text-sm font-bold line-clamp-1 leading-tight mb-2 min-h-[1.2rem] cursor-help",
                      !zoneConfig.content?.color && "text-neutral-900 dark:text-white"
                    )}
                  >
                    {displayVal}
                  </h4>
                )
              }

              return (
                <div key={field.id} className="flex flex-col gap-0.5">
                  <span 
                    style={{
                      fontFamily: zoneConfig.label?.font,
                      fontSize: zoneConfig.label?.size,
                      color: zoneConfig.label?.color,
                    }}
                    className={cn(
                      "text-[9px] font-black tracking-widest ml-1",
                      !zoneConfig.label?.color && "text-neutral-400",
                      !zoneConfig.label?.font && "uppercase"
                    )}
                  >
                    {zoneConfig.label?.text || field.display_name}
                  </span>
                  <div 
                    title={displayVal}
                    style={{
                      fontFamily: zoneConfig.content?.font,
                      fontSize: zoneConfig.content?.size,
                      color: zoneConfig.content?.color,
                    }}
                    className={cn(
                      "text-xs line-clamp-2 min-h-[2rem] cursor-help",
                      !zoneConfig.content?.color && "text-neutral-600 dark:text-neutral-400"
                    )}
                  >
                    {displayVal}
                  </div>
                </div>
              )
            })}
            {fields.length > 4 && (
              <div className="text-[9px] text-indigo-500 font-bold uppercase tracking-widest pt-1 italic opacity-50">
                + {fields.length - 4} outros campos
              </div>
            )}
          </div>

          {/* Footer do Card */}
          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-2.5 h-2.5" />
              <span>Hoje</span>
            </div>
            <div className="flex items-center gap-1">
              <Hash className="w-2.5 h-2.5 text-indigo-500" />
              <span>#{index + 1}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
