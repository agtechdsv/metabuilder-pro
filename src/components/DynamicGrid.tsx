'use client'

import { Pencil, Trash2, Search } from 'lucide-react'

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
        <tr key={rowIndex} className="hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors border-b border-neutral-100 dark:border-neutral-800/50 last:border-0">
          <td className="px-8 py-5 whitespace-nowrap w-12 text-center">
            <input type="checkbox" className="rounded-md bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-indigo-600 focus:ring-indigo-500" />
          </td>
          {fields.map((field) => (
            <td key={field.id} className="px-6 py-5 whitespace-nowrap text-sm font-medium text-neutral-900 dark:text-neutral-300">
              {typeof row[field.db_column_name] === 'object' 
                ? JSON.stringify(row[field.db_column_name]) 
                : String(row[field.db_column_name] ?? '')}
            </td>
          ))}
          <td className="px-8 py-5 text-right whitespace-nowrap text-sm font-bold">
            <div className="flex items-center justify-end gap-2">
              {canView && (
                <button 
                  title="Visualizar"
                  onClick={() => onView?.(row)}
                  className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800/50 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all active:scale-90"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}
              {canEdit && (
                <button 
                  title="Editar"
                  onClick={() => onEdit?.(row)}
                  className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all active:scale-90"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {canDelete && (
                <button 
                  title="Excluir"
                  onClick={() => onDelete?.(row)}
                  className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all active:scale-90"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </td>
        </tr>
      ))}
    </>
  )
}
