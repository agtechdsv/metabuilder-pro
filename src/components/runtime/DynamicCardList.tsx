'use client'

import { Pencil, Trash2, Calendar, Hash, Type, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DynamicCardListProps {
  fields: any[]
  data: any[]
  buttonsConfig?: any[]
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => void
}

export default function DynamicCardList({ 
  fields, 
  data, 
  buttonsConfig = [],
  onView,
  onEdit,
  onDelete
}: DynamicCardListProps) {
  const canView = buttonsConfig.find((b: any) => b.id === 'view')?.visible === true
  const canEdit = buttonsConfig.find((b: any) => b.id === 'edit')?.visible === true
  const canDelete = buttonsConfig.find((b: any) => b.id === 'delete')?.visible === true

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
                  onClick={() => onView?.(row)}
                  className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/50 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all active:scale-90"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              )}
              {canEdit && (
                <button 
                  onClick={() => onEdit?.(row)}
                  className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all active:scale-90"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {canDelete && (
                <button 
                  onClick={() => onDelete?.(row)}
                  className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all active:scale-90"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Dados do Card - Limitado a 3 campos principais para não ficar gigante */}
          <div className="space-y-3 flex-1">
            {fields.slice(0, 4).map((field, fIdx) => {
              const val = row[field.db_column_name]
              const isFirst = fIdx === 0
              const displayVal = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')

              if (isFirst) {
                return (
                  <h4 
                    key={field.id} 
                    title={displayVal}
                    style={{
                      fontFamily: field.config?.content?.font,
                      fontSize: field.config?.content?.size,
                      color: field.config?.content?.color,
                    }}
                    className={cn(
                      "text-sm font-bold line-clamp-1 leading-tight mb-2 min-h-[1.2rem] cursor-help",
                      !field.config?.content?.color && "text-neutral-900 dark:text-white"
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
                      fontFamily: field.config?.label?.font,
                      fontSize: field.config?.label?.size,
                      color: field.config?.label?.color,
                    }}
                    className={cn(
                      "text-[9px] font-black tracking-widest ml-1",
                      !field.config?.label?.color && "text-neutral-400",
                      !field.config?.label?.font && "uppercase"
                    )}
                  >
                    {field.display_name}
                  </span>
                  <div 
                    title={displayVal}
                    style={{
                      fontFamily: field.config?.content?.font,
                      fontSize: field.config?.content?.size,
                      color: field.config?.content?.color,
                    }}
                    className={cn(
                      "text-xs line-clamp-2 min-h-[2rem] cursor-help",
                      !field.config?.content?.color && "text-neutral-600 dark:text-neutral-400"
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
