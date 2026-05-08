'use client'

import { Pencil, Trash2, Calendar, Hash, Type, Search } from 'lucide-react'

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
    <>
      {data.map((row, index) => (
        <div
          key={index}
          className="group relative bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-500/30 transition-all duration-300 flex flex-col"
        >
          {/* Badge de ID ou Principal */}
          <div className="flex items-start justify-between mb-6">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <Type className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2">
              {canView && (
                <button 
                  onClick={() => onView?.(row)}
                  className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800/50 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all active:scale-90"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}
              {canEdit && (
                <button 
                  onClick={() => onEdit?.(row)}
                  className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all active:scale-90"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {canDelete && (
                <button 
                  onClick={() => onDelete?.(row)}
                  className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all active:scale-90"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Dados do Card */}
          <div className="space-y-4 flex-1">
            {fields.map((field, fIdx) => {
              const val = row[field.db_column_name]
              const isFirst = fIdx === 0

              if (isFirst) {
                return (
                  <h4 key={field.id} className="text-lg font-bold text-neutral-900 dark:text-white line-clamp-2 leading-tight">
                    {String(val ?? '')}
                  </h4>
                )
              }

              return (
                <div key={field.id} className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                    {field.display_name}
                  </span>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3">
                    {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer do Card */}
          <div className="mt-8 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-tighter">
            <div className="flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              <span>Atualizado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Hash className="w-3 h-3 text-indigo-500" />
              <span>#{index + 1}</span>
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
