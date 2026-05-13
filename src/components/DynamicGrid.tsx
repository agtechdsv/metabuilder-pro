'use client'

import { Pencil, Trash2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DynamicGridProps {
  fields: any[]
  data: any[]
  buttonsConfig?: any[]
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => void
}

export default function DynamicGrid({ 
  fields, 
  data, 
  buttonsConfig = [],
  onView,
  onEdit,
  onDelete
}: DynamicGridProps) {
  const canView = buttonsConfig.find((b: any) => b.id === 'view')?.visible === true
  const canEdit = buttonsConfig.find((b: any) => b.id === 'edit')?.visible === true
  const canDelete = buttonsConfig.find((b: any) => b.id === 'delete')?.visible === true

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj)
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
            const val = typeof rawVal === 'object' && rawVal !== null
              ? JSON.stringify(rawVal) 
              : String(rawVal ?? '')
            
            const zoneConfig = field.config?.grid_config || field.config || {}
            
            return (
              <td 
                key={field.id} 
                title={val}
                style={{
                  fontFamily: zoneConfig.content?.font,
                  fontSize: zoneConfig.content?.size,
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
                  title="Visualizar"
                  onClick={() => onView?.(row)}
                  className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all active:scale-90 shadow-sm"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              )}
              {canEdit && (
                <button 
                  title="Editar"
                  onClick={() => onEdit?.(row)}
                  className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 border border-neutral-200 dark:border-neutral-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all active:scale-90 shadow-sm"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {canDelete && (
                <button 
                  title="Excluir"
                  onClick={() => onDelete?.(row)}
                  className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 text-red-500 border border-neutral-200 dark:border-neutral-700 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all active:scale-90 shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </td>
        </tr>
      ))}
    </>
  )
}
