import { AppAST } from '../ast'

/**
 * components.ts
 *
 * Gera os componentes de UI base (padrão shadcn/ui) no projeto ejetado.
 */

export function generateComponents(ast: AppAST, files: Map<string, string>) {
  files.set('lib/utils.ts', `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`)

  files.set('components/ui/button.tsx', `import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variants = {
      default: "bg-zinc-900 text-zinc-50 hover:bg-zinc-900/90 shadow",
      destructive: "bg-red-500 text-zinc-50 hover:bg-red-500/90 shadow-sm",
      outline: "border border-zinc-200 bg-white hover:bg-zinc-100 hover:text-zinc-900",
      secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-100/80",
      ghost: "hover:bg-zinc-100 hover:text-zinc-900",
      link: "text-zinc-900 underline-offset-4 hover:underline",
    }
    const sizes = {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-10 rounded-md px-8",
      icon: "h-9 w-9",
    }
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
`)

  files.set('components/ui/input.tsx', `import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
`)

  files.set('components/ui/label.tsx', `import * as React from "react"
import { cn } from "@/lib/utils"

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          className
        )}
        {...props}
      />
    )
  }
)
Label.displayName = "Label"

export { Label }
`)

  files.set('components/ui/tabs.tsx', `import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root
const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(({ className, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn("inline-flex h-9 items-center justify-center rounded-lg bg-zinc-100 p-1 text-zinc-500", className)} {...props} />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger ref={ref} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-zinc-950 data-[state=active]:shadow", className)} {...props} />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2", className)} {...props} />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
`)

  files.set('components/ui/table.tsx', `import * as React from "react"
import { cn } from "@/lib/utils"

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
))
TableBody.displayName = "TableBody"

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn("border-b transition-colors hover:bg-zinc-100/50 data-[state=selected]:bg-zinc-100", className)} {...props} />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <th ref={ref} className={cn("h-10 px-2 text-left align-middle font-medium text-zinc-500 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", className)} {...props} />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", className)} {...props} />
))
TableCell.displayName = "TableCell"

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell }
`)
  files.set('components/ui/delete-button.tsx', `'use client'

import { Trash2 } from 'lucide-react'

export function DeleteButton() {
  return (
    <button 
      type="submit" 
      className="w-8 h-8 rounded-full flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all" 
      title="Excluir" 
      onClick={(e) => { if (!confirm('Confirmar exclusão?')) e.preventDefault() }}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
`)

  files.set('components/DetailRelationSection.tsx', `'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Pencil, Trash2, Plus, Maximize2, Minimize2, X, Save, AlertTriangle, CheckCircle2 } from 'lucide-react'

export interface DetailFieldConfig {
  id: string
  label: string
  dbColumn: string
  dataType?: string
  isPrimaryKey?: boolean
}

export interface DetailRelationSectionProps {
  label: string
  relatedTable: string
  foreignKey: string
  parentId: string
  items: any[]
  fields: DetailFieldConfig[]
  createAction: (formData: FormData) => Promise<void>
  updateAction: (id: string, formData: FormData) => Promise<void>
  deleteAction: (id: string) => Promise<void>
}

export function DetailRelationSection({
  label,
  relatedTable,
  foreignKey,
  parentId,
  items = [],
  fields = [],
  createAction,
  updateAction,
  deleteAction,
}: DetailRelationSectionProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [deletingItem, setDeletingItem] = useState<any | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const allExpanded = items.length > 0 && items.every((_, idx) => expandedRows[idx])

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedRows({})
    } else {
      const next: Record<string, boolean> = {}
      items.forEach((_, idx) => { next[idx] = true })
      setExpandedRows(next)
    }
  }

  const toggleRow = (idx: number) => {
    setExpandedRows(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  const handleOpenAdd = () => {
    setEditingItem(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (item: any) => {
    setEditingItem(item)
    setIsModalOpen(true)
  }

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const formData = new FormData(e.currentTarget)
      if (!formData.get(foreignKey)) {
        formData.set(foreignKey, parentId)
      }
      if (editingItem && (editingItem.id || editingItem.codigo)) {
        await updateAction(editingItem.id || editingItem.codigo, formData)
      } else {
        await createAction(formData)
      }
      setIsModalOpen(false)
      setEditingItem(null)
    } catch (err) {
      console.error('Erro ao salvar:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingItem) return
    setIsSubmitting(true)
    try {
      await deleteAction(deletingItem.id || deletingItem.codigo)
      setDeletingItem(null)
    } catch (err) {
      console.error('Erro ao excluir:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const editableFields = fields.filter(f => !f.isPrimaryKey && f.dbColumn !== foreignKey)

  return (
    <div className={\`relative z-10 transition-all \${isMaximized ? 'fixed inset-4 z-50 bg-white dark:bg-neutral-900 p-8 rounded-[2rem] shadow-2xl overflow-y-auto' : 'space-y-4'}\`}>
      {/* Barra Superior de Ações da Aba */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
        <div>
          <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 capitalize">{label}</h3>
          <p className="text-xs text-neutral-400">Total de {items.length} {items.length === 1 ? 'registro' : 'registros'}</p>
        </div>

        {/* Toolbar no Topo à Direita */}
        <div className="flex items-center gap-1 bg-neutral-100/80 dark:bg-neutral-800/60 p-1 rounded-xl border border-neutral-200/60 dark:border-neutral-700/50">
          <button
            type="button"
            onClick={toggleExpandAll}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-700 shadow-sm transition-all"
            title={allExpanded ? 'Recolher Todos' : 'Expandir Todos'}
          >
            {allExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="p-1.5 rounded-lg text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:bg-white dark:hover:bg-neutral-700 shadow-sm transition-all"
            title={\`Adicionar \${label}\`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsMaximized(prev => !prev)}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-700 shadow-sm transition-all"
            title={isMaximized ? 'Restaurar' : 'Maximizar'}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Lista de Registros Filhos */}
      {items.length === 0 ? (
        <div className="bg-neutral-50/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 text-center">
          <p className="text-sm text-neutral-400 dark:text-neutral-500 py-4">
            Nenhum registro de <strong>{label}</strong> vinculado a este registro.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm mt-2"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar Primeiro {label}
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, idx) => {
            const isExpanded = !!expandedRows[idx]
            const itemId = String(item.id || item.codigo || \`idx-\${idx}\`)

            return (
              <div key={itemId} className="flex flex-col rounded-2xl transition-all duration-300">
                {/* Linha do Registro (Pill) */}
                <div className={\`py-2.5 px-4 rounded-xl border flex items-center justify-between transition-all \${
                  isExpanded
                    ? 'bg-white dark:bg-neutral-900 border-indigo-200 dark:border-indigo-800 shadow-md ring-1 ring-indigo-500/10'
                    : 'bg-white dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-sm'
                }\`}>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      {String(item.nome || item.name || item.titulo || item.title || item.id || item.codigo || \`Registro #\${idx + 1}\`)}
                    </span>
                  </div>

                  {/* Ações da Linha: Expandir, Editar, Excluir */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleRow(idx)}
                      className={\`p-1.5 rounded-lg shadow-sm transition-all \${
                        isExpanded
                          ? 'bg-indigo-600 text-white'
                          : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
                      }\`}
                      title="Expandir / Recolher"
                    >
                      <ChevronDown className={\`w-3.5 h-3.5 transition-transform duration-300 \${isExpanded ? 'rotate-180' : ''}\`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-500 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 shadow-sm transition-all"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingItem(item)}
                      className="p-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 shadow-sm transition-all"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Efeito Cortina (Expansão In-place) */}
                {isExpanded && (
                  <div className="p-6 bg-slate-50/60 dark:bg-neutral-950/60 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 animate-in slide-in-from-top-2 duration-300 space-y-6 shadow-inner mt-1 mb-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {editableFields.map(f => (
                        <div key={f.dbColumn} className="space-y-1.5">
                          <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                            {f.label}
                          </label>
                          <input
                            readOnly
                            disabled
                            value={String(item[f.dbColumn] ?? item[f.dbColumn.replace(/\\./g, '_')] ?? '')}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-neutral-800 dark:text-neutral-200 outline-none"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Sub-detalhes (ex: ITENS DO PEDIDO) */}
                    {relatedTable.toLowerCase().includes('pedido') && (
                      <div className="pt-4 border-t border-neutral-200/60 dark:border-neutral-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-600" />
                            <span className="text-xs font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-300">
                              ITENS DO PEDIDO
                            </span>
                          </div>
                          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/80 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                            <button type="button" className="p-1 text-neutral-400 hover:text-neutral-600"><ChevronDown className="w-3 h-3" /></button>
                            <button type="button" className="p-1 text-neutral-400 hover:text-indigo-600"><Plus className="w-3 h-3" /></button>
                            <button type="button" className="p-1 text-neutral-400 hover:text-neutral-600"><Maximize2 className="w-3 h-3" /></button>
                          </div>
                        </div>

                        <div className="space-y-1.5 pl-2 border-l-2 border-indigo-200 dark:border-indigo-900/50">
                          {['Servidor Enterprise Rack', 'Switch de Rede 48-portas', 'Suporte Premium 24/7'].map((subItem, sIdx) => (
                            <div key={sIdx} className="py-2 px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between text-xs">
                              <span className="font-semibold text-neutral-700 dark:text-neutral-300">{subItem}</span>
                              <div className="flex items-center gap-1">
                                <span className="p-1 text-blue-500"><Pencil className="w-3 h-3" /></span>
                                <span className="p-1 text-red-400"><Trash2 className="w-3 h-3" /></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Criação / Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-8 max-w-xl w-full shadow-2xl relative space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                    {editingItem ? \`Editar \${label}\` : \`Adicionar \${label}\`}
                  </h3>
                  <p className="text-xs text-neutral-400">Preencha os campos abaixo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <input type="hidden" name={foreignKey} value={parentId} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto px-1 py-1">
                {editableFields.map(f => {
                  const val = editingItem ? (editingItem[f.dbColumn] ?? editingItem[f.dbColumn.replace(/\\./g, '_')] ?? '') : ''
                  const isDate = f.dataType === 'date' || f.dbColumn.includes('data')
                  const isNumber = f.dataType === 'integer' || f.dataType === 'numeric' || f.dataType === 'float'
                  return (
                    <div key={f.dbColumn} className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                        {f.label}
                      </label>
                      <input
                        name={f.dbColumn}
                        type={isDate ? 'date' : isNumber ? 'number' : 'text'}
                        defaultValue={isDate && val ? String(val).slice(0, 10) : String(val)}
                        className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs tracking-wide transition-colors shadow-lg shadow-indigo-500/20"
                >
                  <Save className="w-4 h-4" /> {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deletingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-8 max-w-md w-full shadow-2xl relative space-y-6 animate-in zoom-in-95 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/30 text-red-500 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Excluir Registro</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Tem certeza que deseja excluir permanentemente este registro de <strong>{label}</strong>? Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs tracking-wide transition-colors shadow-lg shadow-red-500/20"
              >
                <Trash2 className="w-4 h-4" /> {isSubmitting ? 'Excluindo...' : 'Sim, Excluir Registro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
`)
}
