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

import { useState, useTransition } from 'react'
import { Trash2, AlertCircle, X, Loader2 } from 'lucide-react'

interface DeleteButtonProps {
  recordName?: string
  onDelete: () => Promise<void>
}

export function DeleteButton({ recordName, onDelete }: DeleteButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        await onDelete()
        setIsOpen(false)
      } catch (err) {
        console.error('Erro ao excluir registro:', err)
        setIsOpen(false)
      }
    })
  }

  return (
    <>
      <button 
        type="button" 
        onClick={() => setIsOpen(true)}
        className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 text-red-500 border border-neutral-200 dark:border-neutral-700 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all active:scale-90 shadow-sm flex items-center justify-center" 
        title="Excluir" 
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                  Excluir Registro
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Esta ação não pode ser desfeita e removerá permanentemente os dados do banco.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-400">
              <div className="p-2 bg-red-500/20 rounded-xl shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold">Você tem certeza?</p>
                <p className="text-xs opacity-80 mt-0.5">
                  Você está prestes a excluir {recordName ? \`"\${recordName}"\` : 'este registro'}.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirm}
                className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-red-500/20 active:scale-95 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {isPending ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
`)

  files.set('components/ui/limit-selector.tsx', `'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export function LimitSelector({ currentLimit }: { currentLimit: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleChange = (newLimit: string) => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : '')
    params.set('limit', newLimit)
    params.set('page', '1')
    router.push(\`?\${params.toString()}\`)
  }

  return (
    <select
      value={currentLimit}
      onChange={(e) => handleChange(e.target.value)}
      className="bg-transparent border-none outline-none text-indigo-600 font-bold focus:ring-0 cursor-pointer text-[11px] uppercase tracking-widest"
    >
      <option value={10}>10 Linhas</option>
      <option value={15}>15 Linhas</option>
      <option value={25}>25 Linhas</option>
      <option value={50}>50 Linhas</option>
    </select>
  )
}
`)

  files.set('components/DetailRelationSection.tsx', `'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Plus,
  Maximize2,
  Minimize2,
  X,
  Save,
  AlertTriangle,
  ExternalLink,
  Layers,
  CheckCircle,
  Loader2
} from 'lucide-react'

export interface DetailFieldConfig {
  id: string
  label: string
  dbColumn: string
  dataType?: string
  isPrimaryKey?: boolean
  config?: any
}

export interface SubRelationConfig {
  relatedTable: string
  relatedModelName: string
  foreignKey: string
  label: string
  fields: DetailFieldConfig[]
}

export interface DetailRelationSectionProps {
  label: string
  relatedTable: string
  foreignKey: string
  parentId: string
  items: any[]
  fields: DetailFieldConfig[]
  subDetails?: SubRelationConfig[]
  backPath?: string
  createAction: (formData: FormData | Record<string, any>) => Promise<any>
  updateAction: (id: string, formData: FormData | Record<string, any>) => Promise<any>
  deleteAction: (id: string) => Promise<any>
  createSubAction?: (formData: FormData | Record<string, any>) => Promise<any>
  updateSubAction?: (id: string, formData: FormData | Record<string, any>) => Promise<any>
  deleteSubAction?: (id: string) => Promise<any>
}

const SubItemAccordion = React.forwardRef(({
  subItem,
  sIdx,
  subKey,
  isSubExpanded,
  subFields,
  toggleSubItem,
  formatDateForInput,
  onEditSubItem,
  onDeleteSubItem,
}: {
  subItem: any
  sIdx: number
  subKey: string
  isSubExpanded: boolean
  subFields: DetailFieldConfig[]
  toggleSubItem: (k: string) => void
  formatDateForInput: (v: any) => string
  onEditSubItem?: (item: any, sIdx: number) => void
  onDeleteSubItem?: (item: any, sIdx: number) => void
}, ref: any) => {
  const getSubVal = (col: string) => {
    if (!subItem) return ''
    if (subItem[col] !== undefined && subItem[col] !== null) return subItem[col]
    const colOnly = col.includes('.') ? col.split('.').pop()! : col
    if (subItem[colOnly] !== undefined && subItem[colOnly] !== null) return subItem[colOnly]
    const targetKeys = [col.toLowerCase(), colOnly.toLowerCase()]
    for (const k of Object.keys(subItem)) {
      if (targetKeys.includes(k.toLowerCase())) return subItem[k]
    }
    return ''
  }

  const rawQtd = getSubVal('quantidade') || getSubVal('qtd') || 1
  const rawPreco = getSubVal('preco_unitario') || getSubVal('valor_unitario') || getSubVal('preco') || 0
  const parsedPreco = typeof rawPreco === 'number' ? rawPreco : (Number(String(rawPreco).replace(',', '.')) || 0)

  const [qtd, setQtd] = useState<number>(Number(rawQtd) || 1)
  const [preco, setPreco] = useState<number>(parsedPreco)

  const total = qtd * preco

  let subTitle = ''
  for (const sf of subFields) {
    const val = getSubVal(sf.dbColumn)
    if (sf.config?.options && sf.config.options.length > 0) {
      const opt = sf.config.options.find((o: any) => String(o.value) === String(val))
      if (opt?.label) {
        subTitle = opt.label
        break
      }
    }
  }
  if (!subTitle) {
    subTitle = String(subItem.produto_nome || subItem.produto || subItem.nome || subItem.descricao || subItem.name || \`Item #\${sIdx + 1}\`)
  }

  return (
    <div data-sub-item={subKey} className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 shadow-sm transition-all">
      {/* Barra do Cabeçalho do Sub-Item */}
      <div className="py-2.5 px-4 flex items-center justify-between bg-neutral-50/60 dark:bg-neutral-800/40">
        <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
          {subTitle}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => toggleSubItem(subKey)}
            className="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors shadow-sm"
          >
            {isSubExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => onEditSubItem && onEditSubItem(subItem, sIdx)}
            className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            title="Editar Item"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteSubItem && onDeleteSubItem(subItem, sIdx)}
            className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            title="Excluir Item"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Campos do Sub-Item Expandido */}
      {isSubExpanded && subFields.length > 0 && (
        <div className="p-5 border-t border-neutral-100 dark:border-neutral-800 grid grid-cols-12 gap-4 animate-in slide-in-from-top-2 duration-200 bg-white dark:bg-neutral-900">
          {subFields.map((sf: any) => {
            const val = getSubVal(sf.dbColumn)
            const dt = (sf.dataType || '').toLowerCase()
            const isDate = dt === 'date' || sf.dbColumn.includes('data') || sf.dbColumn.includes('date')
            const isNumber = dt.includes('int') || dt.includes('num') || dt.includes('float') || dt.includes('decimal') || dt.includes('double')
            const isSelect = sf.config?.options && sf.config.options.length > 0
            const isQtdField = sf.dbColumn.includes('quant') || sf.label.toLowerCase().includes('quant')
            const isPrecoField = sf.dbColumn.includes('preco') || sf.dbColumn.includes('valor') || sf.label.toLowerCase().includes('preço') || sf.label.toLowerCase().includes('preco')
            const isTotalField = sf.dbColumn.includes('total') || sf.label.toLowerCase().includes('total')

            const rawCols = sf.config?.gridSpan ?? sf.config?.modalGridSpan ?? sf.config?.columns ?? sf.config?.col_span ?? sf.config?.component?.gridSpan ?? sf.config?.component?.modalGridSpan ?? sf.config?.component?.columns ?? sf.config?.component?.col_span ?? sf.config?.colSpan
            const numCols = typeof rawCols === 'number' ? rawCols : (typeof rawCols === 'string' && rawCols.match(/\d+/) ? parseInt(rawCols.match(/\d+/)![0], 10) : null)
            const widthVal = sf.config?.width || sf.config?.component?.width || ''
            
            let colSpanClass = 'col-span-12 sm:col-span-6 lg:col-span-3'
            if (numCols) {
              if (numCols >= 12) colSpanClass = 'col-span-12'
              else if (numCols === 9) colSpanClass = 'col-span-12 md:col-span-9'
              else if (numCols === 8) colSpanClass = 'col-span-12 md:col-span-8'
              else if (numCols === 7) colSpanClass = 'col-span-12 md:col-span-7'
              else if (numCols === 6) colSpanClass = 'col-span-12 md:col-span-6'
              else if (numCols === 5) colSpanClass = 'col-span-12 md:col-span-5'
              else if (numCols === 4) colSpanClass = 'col-span-12 md:col-span-4'
              else if (numCols === 3) colSpanClass = 'col-span-12 md:col-span-3'
              else if (numCols === 2) colSpanClass = 'col-span-12 md:col-span-2'
              else if (numCols === 1) colSpanClass = 'col-span-12 md:col-span-1'
            } else if (widthVal === '75%') {
              colSpanClass = 'col-span-12 md:col-span-9'
            } else if (widthVal.includes('66')) {
              colSpanClass = 'col-span-12 md:col-span-8'
            } else if (widthVal === '50%' || widthVal === 'w-1/2' || sf.dbColumn.includes('produto')) {
              colSpanClass = 'col-span-12 md:col-span-6'
            } else if (widthVal === '33%' || widthVal === '33.33%') {
              colSpanClass = 'col-span-12 md:col-span-4'
            } else if (widthVal === '25%' || widthVal === 'w-1/4') {
              colSpanClass = 'col-span-12 md:col-span-3'
            } else if (widthVal.includes('16') || isQtdField || isPrecoField || isTotalField) {
              colSpanClass = 'col-span-12 md:col-span-2'
            }

            if (isSelect) {
              return (
                <div key={sf.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                    {sf.label}
                  </label>
                  <select
                    name={sf.dbColumn}
                    defaultValue={String(val ?? '')}
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    {sf.config.options.map((opt: any, oIdx: number) => {
                      const optVal = typeof opt === 'object' ? (opt.value ?? opt.id) : opt
                      const optLabel = typeof opt === 'object' ? (opt.label || opt.value) : opt
                      return <option key={oIdx} value={String(optVal)}>{String(optLabel)}</option>
                    })}
                  </select>
                </div>
              )
            }

            if (isTotalField) {
              return (
                <div key={sf.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                    {sf.label}
                  </label>
                  <input
                    name={sf.dbColumn}
                    type="text"
                    readOnly
                    value={total > 0 ? total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (val ? Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00')}
                    className="w-full bg-neutral-100/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 font-semibold rounded-xl px-4 py-2.5 text-sm outline-none cursor-not-allowed"
                  />
                </div>
              )
            }

            let initialFormatted = isDate ? formatDateForInput(val) : String(val ?? '')
            if (isPrecoField && val !== undefined && val !== null && val !== '') {
              const numP = typeof val === 'number' ? val : Number(String(val).replace(',', '.'))
              if (!isNaN(numP)) {
                initialFormatted = numP.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              }
            }

            return (
              <div key={sf.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                  {sf.label}
                </label>
                <input
                  name={sf.dbColumn}
                  type={isDate ? 'date' : isNumber && !isPrecoField ? 'number' : 'text'}
                  defaultValue={initialFormatted}
                  onChange={(e) => {
                    if (isQtdField) setQtd(Number(e.target.value) || 0)
                    if (isPrecoField) {
                      const cleanVal = e.target.value.replace(/\./g, '').replace(',', '.')
                      setPreco(Number(cleanVal) || 0)
                    }
                  }}
                  placeholder={sf.config?.placeholder || \`Digite o valor para \${sf.label}...\`}
                  className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

export function DetailRelationSection({
  label,
  relatedTable,
  foreignKey,
  parentId,
  items = [],
  fields = [],
  subDetails = [],
  backPath,
  createAction,
  updateAction,
  deleteAction,
  createSubAction,
  updateSubAction,
  deleteSubAction,
}: DetailRelationSectionProps) {
  const [localItems, setLocalItems] = useState<any[]>(items)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalActiveTab, setModalActiveTab] = useState<'master' | 'items'>('master')
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [deletingItem, setDeletingItem] = useState<any | null>(null)
  const [editingSubItem, setEditingSubItem] = useState<{ subItem: any; sIdx: number; parentId: string; subFields: DetailFieldConfig[] } | null>(null)
  const [deletingSubItem, setDeletingSubItem] = useState<{ subItem: any; sIdx: number; parentId: string } | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedSubItems, setExpandedSubItems] = useState<Record<string, boolean>>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  const toggleSubItem = (key: string) => {
    setExpandedSubItems(prev => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    setLocalItems(items)
  }, [items])

  const allExpanded = localItems.length > 0 && localItems.every((_, idx) => expandedRows[idx])

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedRows({})
    } else {
      const next: Record<string, boolean> = {}
      localItems.forEach((_, idx) => { next[idx] = true })
      setExpandedRows(next)
    }
  }

  const toggleRow = (idx: number) => {
    setExpandedRows(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  const handleAddInline = () => {
    const tempItem: any = {
      _isNew: true,
      id: \`temp-\${Date.now()}\`,
    }
    editableFields.forEach(f => {
      tempItem[f.dbColumn] = ''
    })
    setLocalItems([tempItem, ...localItems])
    setExpandedRows(prev => ({ ...prev, 0: true }))
  }

  const handleOpenAddModal = () => {
    setEditingItem(null)
    setModalActiveTab('master')
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (item: any) => {
    setEditingItem(item)
    setModalActiveTab('master')
    setIsModalOpen(true)
  }

  const handleSaveAll = async () => {
    setIsSubmitting(true)
    window.dispatchEvent(new CustomEvent('page-progress-start'))
    try {
      const sectionEl = document.querySelector('.relation-section-container')

      for (let idx = 0; idx < localItems.length; idx++) {
        const item = localItems[idx]
        const rowKey = String(item.id || item.codigo || \`idx-\${idx}\`)
        const rowContainer = sectionEl?.querySelector(\`[data-relation-row="\${rowKey}"]\`) || document.querySelector(\`[data-relation-row="\${rowKey}"]\`)

        const rowData: Record<string, any> = { [foreignKey]: parentId }
        if (rowContainer) {
          const parentInputs = rowContainer.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.relation-parent-fields input, .relation-parent-fields select')
          parentInputs.forEach(inp => {
            if (inp.name && !inp.name.startsWith('$') && !inp.name.startsWith('_')) {
              rowData[inp.name] = inp.value
            }
          })
        } else {
          editableFields.forEach(f => {
            if (item[f.dbColumn] !== undefined) rowData[f.dbColumn] = item[f.dbColumn]
          })
        }

        let savedParentId = item.id || item.codigo
        const isNewParent = !savedParentId || String(savedParentId).startsWith('temp-')
        if (isNewParent) {
          const created = await createAction(rowData)
          if (created?.id || created?.codigo) {
            savedParentId = created.id || created.codigo
          }
        } else if (Object.keys(rowData).length > 1) {
          await updateAction(savedParentId, rowData)
        }

        if (subConfig && (updateSubAction || createSubAction)) {
          const itemChildRecords: any[] = item.items || item.itens_pedido || item._details || []
          for (let sIdx = 0; sIdx < itemChildRecords.length; sIdx++) {
            const subItem = itemChildRecords[sIdx]
            const subKey = \`\${item.id || item.codigo || idx}-\${sIdx}\`
            const subContainer = rowContainer?.querySelector(\`[data-sub-item="\${subKey}"]\`)

            const subData: Record<string, any> = {}
            if (subConfig.foreignKey) {
              subData[subConfig.foreignKey] = savedParentId
            }

            if (subContainer) {
              const subInputs = subContainer.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')
              subInputs.forEach(inp => {
                if (inp.name && !inp.name.startsWith('$') && !inp.name.startsWith('_')) {
                  subData[inp.name] = inp.value
                }
              })
            } else {
              subFields.forEach((sf: any) => {
                if (subItem[sf.dbColumn] !== undefined) subData[sf.dbColumn] = subItem[sf.dbColumn]
              })
            }

            const isNewSub = !subItem.id || String(subItem.id).startsWith('temp-')
            if (isNewSub && createSubAction) {
              await createSubAction(subData)
            } else if (!isNewSub && updateSubAction && subItem.id) {
              await updateSubAction(subItem.id, subData)
            }
          }
        }
      }

      setToastType('success')
      setToastMessage('Alterações salvas com sucesso!')
    } catch (err: any) {
      console.error('Erro ao salvar alterações:', err)
      setToastType('error')
      setToastMessage(err?.message || 'Erro ao salvar alterações.')
    } finally {
      setIsSubmitting(false)
      window.dispatchEvent(new CustomEvent('page-progress-complete'))
    }
  }

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    window.dispatchEvent(new CustomEvent('page-progress-start'))
    try {
      const formData = new FormData(e.currentTarget)
      if (!formData.get(foreignKey)) {
        formData.set(foreignKey, parentId)
      }
      const updatedFields = Object.fromEntries(formData.entries())
      if (editingItem && (editingItem.id || editingItem.codigo) && !String(editingItem.id).startsWith('temp-')) {
        await updateAction(editingItem.id || editingItem.codigo, formData)
        setLocalItems(prev => prev.map(it => (it.id || it.codigo) === (editingItem.id || editingItem.codigo) ? { ...it, ...updatedFields } : it))
      } else {
        const created = await createAction(formData)
        setLocalItems(prev => [{ ...updatedFields, id: created?.id || \`item-\${Date.now()}\` }, ...prev])
      }
      setToastType('success')
      setToastMessage(\`\${detailSingular} salvo com sucesso!\`)
      setIsModalOpen(false)
      setEditingItem(null)
    } catch (err: any) {
      console.error('Erro ao salvar:', err)
      setToastType('error')
      setToastMessage(err?.message || \`Erro ao salvar \${detailSingular.toLowerCase()}.\`)
    } finally {
      setIsSubmitting(false)
      window.dispatchEvent(new CustomEvent('page-progress-complete'))
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingItem) return
    setIsSubmitting(true)
    window.dispatchEvent(new CustomEvent('page-progress-start'))
    try {
      if (String(deletingItem.id).startsWith('temp-')) {
        setLocalItems(localItems.filter(i => i.id !== deletingItem.id))
      } else {
        await deleteAction(deletingItem.id || deletingItem.codigo)
        setLocalItems(localItems.filter(i => (i.id || i.codigo) !== (deletingItem.id || deletingItem.codigo)))
      }
      setToastType('success')
      setToastMessage(\`\${detailSingular} excluído com sucesso!\`)
      setDeletingItem(null)
    } catch (err: any) {
      console.error('Erro ao excluir:', err)
      setToastType('error')
      setToastMessage(err?.message || \`Erro ao excluir \${detailSingular.toLowerCase()}.\`)
    } finally {
      setIsSubmitting(false)
      window.dispatchEvent(new CustomEvent('page-progress-complete'))
    }
  }

  const handleSubItemFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingSubItem) return
    setIsSubmitting(true)
    window.dispatchEvent(new CustomEvent('page-progress-start'))
    try {
      const formData = new FormData(e.currentTarget)
      const updatedSub: Record<string, any> = { ...editingSubItem.subItem }
      formData.forEach((v, k) => {
        updatedSub[k] = v
      })
      if (subConfig?.foreignKey && !updatedSub[subConfig.foreignKey]) {
        updatedSub[subConfig.foreignKey] = editingSubItem.parentId
      }

      if (updateSubAction && updatedSub.id && !String(updatedSub.id).startsWith('temp-')) {
        await updateSubAction(updatedSub.id, formData)
      } else if (createSubAction && (!updatedSub.id || String(updatedSub.id).startsWith('temp-'))) {
        const created = await createSubAction(formData)
        if (created?.id) updatedSub.id = created.id
      }

      setLocalItems(prev => prev.map(it => {
        const itId = it.id || it.codigo
        if (itId === editingSubItem.parentId) {
          const children = it.items || it.itens_pedido || []
          const nextChildren = children.map((sub: any, idx: number) => idx === editingSubItem.sIdx ? updatedSub : sub)
          return { ...it, items: nextChildren, itens_pedido: nextChildren }
        }
        return it
      }))
      if (editingItem) {
        const itId = editingItem.id || editingItem.codigo
        if (itId === editingSubItem.parentId) {
          const children = editingItem.items || editingItem.itens_pedido || []
          const nextChildren = children.map((sub: any, idx: number) => idx === editingSubItem.sIdx ? updatedSub : sub)
          setEditingItem({ ...editingItem, items: nextChildren, itens_pedido: nextChildren })
        }
      }
      setToastType('success')
      setToastMessage('Item salvo com sucesso!')
      setEditingSubItem(null)
    } catch (err: any) {
      console.error(err)
      setToastType('error')
      setToastMessage(err?.message || 'Erro ao salvar item.')
    } finally {
      setIsSubmitting(false)
      window.dispatchEvent(new CustomEvent('page-progress-complete'))
    }
  }

  const handleConfirmDeleteSubItem = async () => {
    if (!deletingSubItem) return
    setIsSubmitting(true)
    window.dispatchEvent(new CustomEvent('page-progress-start'))
    try {
      if (deleteSubAction && deletingSubItem.subItem.id && !String(deletingSubItem.subItem.id).startsWith('temp-')) {
        await deleteSubAction(deletingSubItem.subItem.id)
      }

      setLocalItems(prev => prev.map(it => {
        const itId = it.id || it.codigo
        if (itId === deletingSubItem.parentId) {
          const children = it.items || it.itens_pedido || []
          const nextChildren = children.filter((_: any, idx: number) => idx !== deletingSubItem.sIdx)
          return { ...it, items: nextChildren, itens_pedido: nextChildren }
        }
        return it
      }))
      if (editingItem) {
        const itId = editingItem.id || editingItem.codigo
        if (itId === deletingSubItem.parentId) {
          const children = editingItem.items || editingItem.itens_pedido || []
          const nextChildren = children.filter((_: any, idx: number) => idx !== deletingSubItem.sIdx)
          setEditingItem({ ...editingItem, items: nextChildren, itens_pedido: nextChildren })
        }
      }
      setToastType('success')
      setToastMessage('Item excluído com sucesso!')
      setDeletingSubItem(null)
    } catch (err: any) {
      console.error(err)
      setToastType('error')
      setToastMessage(err?.message || 'Erro ao excluir item.')
    } finally {
      setIsSubmitting(false)
      window.dispatchEvent(new CustomEvent('page-progress-complete'))
    }
  }

  const formatDateForInput = (v: any) => {
    if (!v) return ''
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
    try {
      const d = new Date(v)
      if (!isNaN(d.getTime())) {
        const year = d.getUTCFullYear()
        const month = String(d.getUTCMonth() + 1).padStart(2, '0')
        const day = String(d.getUTCDate()).padStart(2, '0')
        return \`\${year}-\${month}-\${day}\`
      }
    } catch (e) {}
    return String(v).slice(0, 10)
  }

  const getFieldValue = (obj: any, dbCol: string) => {
    if (!obj) return ''
    if (obj[dbCol] !== undefined && obj[dbCol] !== null) return obj[dbCol]
    const under = dbCol.replace(/\\./g, '_')
    if (obj[under] !== undefined && obj[under] !== null) return obj[under]
    const colOnly = dbCol.includes('.') ? dbCol.split('.').pop()! : dbCol
    if (obj[colOnly] !== undefined && obj[colOnly] !== null) return obj[colOnly]
    const targetKeys = [dbCol.toLowerCase(), under.toLowerCase(), colOnly.toLowerCase()]
    for (const k of Object.keys(obj)) {
      const kLower = k.toLowerCase()
      if (targetKeys.includes(kLower)) {
        return obj[k]
      }
    }
    return ''
  }

  const editableFields = fields.filter(f => !f.isPrimaryKey && f.dbColumn !== foreignKey)
  const detailSingular = label.endsWith('s') ? label.slice(0, -1) : label
  const subConfig = (subDetails && subDetails[0]) || null
  const subFields = subConfig?.fields?.filter((f: any) => !f.isPrimaryKey && f.dbColumn !== subConfig.foreignKey) || []

  return (
    <div className={\`relation-section-container relative z-10 transition-all \${isMaximized ? 'fixed inset-4 z-50 bg-white dark:bg-neutral-900 p-8 rounded-[2rem] shadow-2xl overflow-y-auto' : 'space-y-4'}\`}>
      {/* Barra Superior de Ações da Aba */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
        <div>
          <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 capitalize">{label}</h3>
          <p className="text-xs text-neutral-400">Total de {localItems.length} {localItems.length === 1 ? 'registro' : 'registros'}</p>
        </div>

        {/* Toolbar no Topo à Direita: Expandir/Recolher, Adicionar, Abrir Modal */}
        <div className="flex items-center gap-2">
          {/* Pill de Expandir/Recolher Tudo */}
          <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                const next: Record<string, boolean> = {}
                localItems.forEach((_, idx) => { next[idx] = true })
                setExpandedRows(next)
              }}
              className="p-1 rounded-lg text-neutral-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-neutral-700 transition-all"
              title="Expandir Todos"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setExpandedRows({})}
              className="p-1 rounded-lg text-neutral-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-neutral-700 transition-all"
              title="Recolher Todos"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Adicionar Registro (+) */}
          <button
            type="button"
            onClick={handleAddInline}
            className="p-2 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl transition-all active:scale-95 shadow-sm flex items-center justify-center"
            title={\`Adicionar \${label}\`}
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Abrir Modal (ExternalLink) */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="p-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-xl transition-all active:scale-95 flex items-center justify-center"
            title="Abrir em Modal"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lista de Registros Filhos */}
      {localItems.length === 0 ? (
        <div className="bg-neutral-50/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 text-center">
          <p className="text-sm text-neutral-400 dark:text-neutral-500 py-4">
            Nenhum registro de <strong>{label}</strong> vinculado a este registro.
          </p>
          <div className="flex items-center justify-center gap-3 mt-2">
            <button
              type="button"
              onClick={handleAddInline}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar na Lista
            </button>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold rounded-xl text-xs hover:bg-neutral-50 transition-colors shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Abrir Modal
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {localItems.map((item, idx) => {
            const isExpanded = !!expandedRows[idx]
            const isNew = item._isNew || String(item.id || '').startsWith('temp-')
            const itemId = String(item.id || item.codigo || \`idx-\${idx}\`)
            const itemTitle = isNew
              ? 'Novo Registro'
              : String(item.nome || item.name || item.titulo || item.title || item.id || item.codigo || \`Registro #\${idx + 1}\`)
            const itemChildRecords: any[] = item.items || item.itens_pedido || item._details || []

            return (
              <div key={itemId} data-relation-row={itemId} className="relation-row-container flex flex-col rounded-2xl transition-all duration-300">
                {/* Linha do Registro (Pill) */}
                <div className={\`py-2.5 px-4 rounded-xl border flex items-center justify-between transition-all \${
                  isExpanded
                    ? 'bg-white dark:bg-neutral-900 border-indigo-200 dark:border-indigo-800 shadow-md ring-1 ring-indigo-500/10'
                    : 'bg-white dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-sm'
                }\`}>
                  <div className="flex items-center gap-3">
                    <span className={\`text-xs font-mono transition-colors \${
                      isNew
                        ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                        : isExpanded
                          ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                          : 'text-neutral-700 dark:text-neutral-300 font-semibold'
                    }\`}>
                      {itemTitle}
                    </span>
                  </div>

                  {/* Ações da Linha: Expandir, Editar na Modal, Excluir */}
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
                      onClick={() => handleOpenEditModal(item)}
                      className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-500 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 shadow-sm transition-all"
                      title="Editar na Modal (Mestre/Detalhe)"
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
                    <div className="relation-parent-fields grid grid-cols-12 gap-4">
                      {editableFields.map(f => {
                        const val = getFieldValue(item, f.dbColumn)
                        const isDate = f.dataType === 'date' || f.dataType === 'timestamp' || f.dataType === 'datetime' || f.dbColumn.includes('data')
                        const isNumber = f.dataType === 'integer' || f.dataType === 'numeric' || f.dataType === 'float' || f.dataType === 'decimal'
                        const hasOptions = f.config?.options && Array.isArray(f.config.options) && f.config.options.length > 0
                        const isCalculatedTotal = f.dbColumn.includes('total') || f.label.toLowerCase().includes('total')
                        const isReadOnly = Boolean(f.config?.readOnly || f.config?.content?.readonly || f.config?.readonly || isCalculatedTotal)

                        const widthVal = f.config?.width || f.config?.component?.width || ''
                        const rawCols = f.config?.gridSpan ?? f.config?.modalGridSpan ?? f.config?.component?.gridSpan ?? f.config?.component?.modalGridSpan ?? f.config?.columns ?? f.config?.col_span ?? f.config?.component?.columns ?? f.config?.component?.col_span ?? f.config?.colSpan
                        const numCols = typeof rawCols === 'number' ? rawCols : (typeof rawCols === 'string' && rawCols.match(/\d+/) ? parseInt(rawCols.match(/\d+/)![0], 10) : null)
                        let colSpanClass = 'col-span-12 md:col-span-6'
                        if (numCols) {
                          if (numCols >= 12) colSpanClass = 'col-span-12'
                          else if (numCols === 9) colSpanClass = 'col-span-12 md:col-span-9'
                          else if (numCols === 8) colSpanClass = 'col-span-12 md:col-span-8'
                          else if (numCols === 7) colSpanClass = 'col-span-12 md:col-span-7'
                          else if (numCols === 6) colSpanClass = 'col-span-12 md:col-span-6'
                          else if (numCols === 5) colSpanClass = 'col-span-12 md:col-span-5'
                          else if (numCols === 4) colSpanClass = 'col-span-12 md:col-span-4'
                          else if (numCols === 3) colSpanClass = 'col-span-12 md:col-span-3'
                          else if (numCols === 2) colSpanClass = 'col-span-12 md:col-span-2'
                          else if (numCols === 1) colSpanClass = 'col-span-12 md:col-span-1'
                        } else if (f.config?.multiline || f.config?.component?.type === 'textarea') {
                          colSpanClass = 'col-span-12'
                        } else if (widthVal === '75%') {
                          colSpanClass = 'col-span-12 md:col-span-9'
                        } else if (widthVal.includes('66')) {
                          colSpanClass = 'col-span-12 md:col-span-8'
                        } else if (widthVal === '50%' || widthVal === 'w-1/2') {
                          colSpanClass = 'col-span-12 md:col-span-6'
                        } else if (widthVal === '33%' || widthVal === '33.33%') {
                          colSpanClass = 'col-span-12 md:col-span-4'
                        } else if (widthVal === '25%' || widthVal === 'w-1/4') {
                          colSpanClass = 'col-span-12 md:col-span-3'
                        } else if (widthVal.includes('16')) {
                          colSpanClass = 'col-span-12 md:col-span-2'
                        }

                        let displayVal = isDate ? formatDateForInput(val) : String(val ?? '')
                        if (isCalculatedTotal && itemChildRecords && itemChildRecords.length > 0) {
                          const sum = itemChildRecords.reduce((acc: number, sub: any) => {
                            const q = Number(sub.quantidade || 1)
                            const p = Number(sub.preco_unitario || sub.valor_unitario || 0)
                            return acc + (q * p)
                          }, 0)
                          if (sum > 0) {
                            displayVal = sum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          } else if (val && !isNaN(Number(val))) {
                            displayVal = Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          }
                        } else if (isNumber && val && !isNaN(Number(val)) && (f.dbColumn.includes('preco') || f.dbColumn.includes('valor') || f.dbColumn.includes('total'))) {
                          displayVal = Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        }

                        if (hasOptions) {
                          const selectedOpt = f.config!.options!.find((o: any) => {
                            const oV = typeof o === 'object' ? String(o.value) : String(o)
                            const oL = typeof o === 'object' ? String(o.label) : String(o)
                            return oV === String(val) || oL === String(val)
                          })
                          const defVal = selectedOpt ? (typeof selectedOpt === 'object' ? String(selectedOpt.value) : String(selectedOpt)) : String(val || '')

                          return (
                            <div key={f.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                                {f.label}
                              </label>
                              <select
                                name={f.dbColumn}
                                defaultValue={defVal}
                                disabled={isReadOnly}
                                className={\`w-full \${isReadOnly ? 'bg-neutral-100/80 dark:bg-neutral-800/80 cursor-not-allowed opacity-90' : 'bg-white dark:bg-neutral-900'} border border-neutral-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all\`}
                              >
                                <option value="">Selecione...</option>
                                {val && !f.config!.options!.some((o: any) => (o.value || o) === String(val) || (o.label || o) === String(val)) && (
                                  <option value={String(val)}>{String(val)}</option>
                                )}
                                {f.config!.options!.map((opt: any, oIdx: number) => {
                                  const optVal = typeof opt === 'object' ? opt.value : opt
                                  const optLabel = typeof opt === 'object' ? (opt.label || opt.value) : opt
                                  return <option key={oIdx} value={String(optVal)}>{String(optLabel)}</option>
                                })}
                              </select>
                            </div>
                          )
                        }

                        return (
                          <div key={f.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                              {f.label}
                            </label>
                            <input
                              name={f.dbColumn}
                              type={isDate ? 'date' : (isNumber && !isCalculatedTotal) ? 'number' : 'text'}
                              readOnly={isReadOnly}
                              placeholder={f.config?.placeholder || \`Digite o valor para \${f.label}...\`}
                              defaultValue={displayVal}
                              className={\`w-full \${isReadOnly ? 'bg-neutral-100/80 dark:bg-neutral-800/80 font-semibold cursor-not-allowed text-neutral-800 dark:text-neutral-200 opacity-90' : 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-neutral-200'} border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all\`}
                            />
                          </div>
                        )
                      })}
                    </div>
                    {/* Sub-detalhes inline (ex: ITENS DO DETALHE) */}
                    <div className="pt-4 border-t border-neutral-200/60 dark:border-neutral-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-600" />
                          <span className="text-xs font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-300">
                            ITENS DE {detailSingular.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shadow-sm"
                            title="Adicionar"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            className="p-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-indigo-600 rounded-lg transition-colors"
                            title="Abrir Modal"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {isNew || itemChildRecords.length === 0 ? (
                        <div className="border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 text-center bg-neutral-50/20 dark:bg-neutral-900/10">
                          <p className="text-xs italic text-neutral-400 dark:text-neutral-500">
                            Nenhum registro de Itens encontrado.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {itemChildRecords.map((subItem: any, sIdx: number) => {
                            const subKey = \`\${item.id || idx}-\${sIdx}\`
                            const isSubExpanded = !!expandedSubItems[subKey]

                            return (
                              <SubItemAccordion
                                key={sIdx}
                                subItem={subItem}
                                sIdx={sIdx}
                                subKey={subKey}
                                isSubExpanded={isSubExpanded}
                                subFields={subFields}
                                toggleSubItem={toggleSubItem}
                                formatDateForInput={formatDateForInput}
                                onEditSubItem={(sub, sIndex) => setEditingSubItem({ subItem: sub, sIdx: sIndex, parentId: item.id || idx, subFields })}
                                onDeleteSubItem={(sub, sIndex) => setDeletingSubItem({ subItem: sub, sIdx: sIndex, parentId: item.id || idx })}
                              />
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Footer Global Persistente com Botões Cancelar e Salvar Alterações */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t border-neutral-200 dark:border-neutral-800 mt-8">
        <Link
          href={backPath || '#'}
          className="px-6 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          Cancelar
        </Link>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleSaveAll}
          className="inline-flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs tracking-wide transition-colors shadow-lg shadow-indigo-500/20 active:scale-95"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      {/* Modal Mestre-Detalhe de Criação / Edição (com Abas) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-8 max-w-2xl w-full shadow-2xl relative space-y-6 animate-in zoom-in-95">
            {/* Header da Modal */}
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center">
                  {editingItem ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                    {editingItem ? 'Editar Registro' : 'Novo Registro'}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {editingItem ? \`Registro \${editingItem.id || editingItem.codigo || ''}\` : 'Novo Item'}
                  </p>
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

            {/* Abas da Modal: [Mestre] e [Itens do Mestre] */}
            <div className="flex items-center gap-6 border-b border-neutral-100 dark:border-neutral-800 pb-2">
              <button
                type="button"
                onClick={() => setModalActiveTab('master')}
                className={\`text-xs font-bold pb-2 -mb-2.5 transition-all \${
                  modalActiveTab === 'master'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                }\`}
              >
                {label}
              </button>
              <button
                type="button"
                onClick={() => setModalActiveTab('items')}
                className={\`text-xs font-bold pb-2 -mb-2.5 transition-all \${
                  modalActiveTab === 'items'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                }\`}
              >
                {\`Itens de \${detailSingular}\`}
              </button>
            </div>

            {/* Conteúdo da Aba Mestre na Modal */}
            {modalActiveTab === 'master' && (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <input type="hidden" name={foreignKey} value={parentId} />
                
                <div className="grid grid-cols-12 gap-4 max-h-[50vh] overflow-y-auto px-1 py-1">
                  {editableFields.map(f => {
                    const val = getFieldValue(editingItem, f.dbColumn)
                    const isDate = f.dataType === 'date' || f.dataType === 'timestamp' || f.dataType === 'datetime' || f.dbColumn.includes('data')
                    const isNumber = f.dataType === 'integer' || f.dataType === 'numeric' || f.dataType === 'float' || f.dataType === 'decimal'
                    const hasOptions = f.config?.options && Array.isArray(f.config.options) && f.config.options.length > 0
                    const isCalculatedTotal = f.dbColumn.includes('total') || f.label.toLowerCase().includes('total')
                    const isReadOnly = Boolean(f.config?.readOnly || f.config?.content?.readonly || f.config?.readonly || isCalculatedTotal)

                    const widthVal = f.config?.width || f.config?.component?.width || ''
                    const rawCols = f.config?.modalGridSpan ?? f.config?.gridSpan ?? f.config?.component?.modalGridSpan ?? f.config?.component?.gridSpan ?? f.config?.columns ?? f.config?.col_span ?? f.config?.component?.columns ?? f.config?.component?.col_span ?? f.config?.colSpan
                    const numCols = typeof rawCols === 'number' ? rawCols : (typeof rawCols === 'string' && rawCols.match(/\d+/) ? parseInt(rawCols.match(/\d+/)![0], 10) : null)
                    let colSpanClass = 'col-span-12 md:col-span-6'
                    if (numCols) {
                      if (numCols >= 12) colSpanClass = 'col-span-12'
                      else if (numCols === 9) colSpanClass = 'col-span-12 md:col-span-9'
                      else if (numCols === 8) colSpanClass = 'col-span-12 md:col-span-8'
                      else if (numCols === 7) colSpanClass = 'col-span-12 md:col-span-7'
                      else if (numCols === 6) colSpanClass = 'col-span-12 md:col-span-6'
                      else if (numCols === 5) colSpanClass = 'col-span-12 md:col-span-5'
                      else if (numCols === 4) colSpanClass = 'col-span-12 md:col-span-4'
                      else if (numCols === 3) colSpanClass = 'col-span-12 md:col-span-3'
                      else if (numCols === 2) colSpanClass = 'col-span-12 md:col-span-2'
                      else if (numCols === 1) colSpanClass = 'col-span-12 md:col-span-1'
                    } else if (f.config?.multiline || f.config?.component?.type === 'textarea') {
                      colSpanClass = 'col-span-12'
                    } else if (widthVal === '75%') {
                      colSpanClass = 'col-span-12 md:col-span-9'
                    } else if (widthVal.includes('66')) {
                      colSpanClass = 'col-span-12 md:col-span-8'
                    } else if (widthVal === '50%' || widthVal === 'w-1/2') {
                      colSpanClass = 'col-span-12 md:col-span-6'
                    } else if (widthVal === '33%' || widthVal === '33.33%') {
                      colSpanClass = 'col-span-12 md:col-span-4'
                    } else if (widthVal === '25%' || widthVal === 'w-1/4') {
                      colSpanClass = 'col-span-12 md:col-span-3'
                    } else if (widthVal.includes('16')) {
                      colSpanClass = 'col-span-12 md:col-span-2'
                    }

                    const editChildRecords = editingItem ? (editingItem.items || editingItem.itens_pedido || []) : []
                    let displayVal = isDate ? formatDateForInput(val) : String(val ?? '')
                    if (isCalculatedTotal && editChildRecords && editChildRecords.length > 0) {
                      const sum = editChildRecords.reduce((acc: number, sub: any) => {
                        const q = Number(sub.quantidade || 1)
                        const p = Number(sub.preco_unitario || sub.valor_unitario || 0)
                        return acc + (q * p)
                      }, 0)
                      if (sum > 0) {
                        displayVal = sum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      } else if (val && !isNaN(Number(val))) {
                        displayVal = Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      }
                    } else if (isNumber && val && !isNaN(Number(val)) && (f.dbColumn.includes('preco') || f.dbColumn.includes('valor') || f.dbColumn.includes('total'))) {
                      displayVal = Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    }

                    if (hasOptions) {
                      const selectedOpt = f.config!.options!.find((o: any) => {
                        const oV = typeof o === 'object' ? String(o.value) : String(o)
                        const oL = typeof o === 'object' ? String(o.label) : String(o)
                        return oV === String(val) || oL === String(val)
                      })
                      const defVal = selectedOpt ? (typeof selectedOpt === 'object' ? String(selectedOpt.value) : String(selectedOpt)) : String(val || '')

                      return (
                        <div key={f.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                          <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                            {f.label}
                          </label>
                          <select
                            name={f.dbColumn}
                            defaultValue={defVal}
                            disabled={isReadOnly}
                            className={\`w-full \${isReadOnly ? 'bg-neutral-100/80 dark:bg-neutral-800/80 cursor-not-allowed opacity-90' : 'bg-slate-50 dark:bg-neutral-800'} border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all\`}
                          >
                            <option value="">Selecione...</option>
                            {val && !f.config!.options!.some((o: any) => (o.value || o) === String(val) || (o.label || o) === String(val)) && (
                              <option value={String(val)}>{String(val)}</option>
                            )}
                            {f.config!.options!.map((opt: any, oIdx: number) => {
                              const optVal = typeof opt === 'object' ? opt.value : opt
                              const optLabel = typeof opt === 'object' ? (opt.label || opt.value) : opt
                              return <option key={oIdx} value={String(optVal)}>{String(optLabel)}</option>
                            })}
                          </select>
                        </div>
                      )
                    }

                    return (
                      <div key={f.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                        <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                          {f.label}
                        </label>
                        <input
                          name={f.dbColumn}
                          type={isDate ? 'date' : (isNumber && !isCalculatedTotal) ? 'number' : 'text'}
                          readOnly={isReadOnly}
                          placeholder={f.config?.placeholder || \`Digite o valor para \${f.label}...\`}
                          defaultValue={displayVal}
                          className={\`w-full \${isReadOnly ? 'bg-neutral-100/80 dark:bg-neutral-800/80 font-semibold cursor-not-allowed text-neutral-800 dark:text-neutral-200 opacity-90' : 'bg-slate-50 dark:bg-neutral-800'} border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all\`}
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
            )}

            {/* Conteúdo da Aba Itens do Detalhe na Modal */}
            {modalActiveTab === 'items' && (
              <div className="space-y-4 max-h-[55vh] overflow-y-auto px-1">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-xs font-bold text-neutral-500">Lista de Itens</span>
                  <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/80 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <button type="button" className="p-1 text-neutral-400 hover:text-indigo-600"><Plus className="w-3.5 h-3.5" /></button>
                    <button type="button" className="p-1 text-neutral-400 hover:text-neutral-600"><Maximize2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                {!editingItem || !editingItem.items || editingItem.items.length === 0 ? (
                  <div className="border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl p-10 text-center bg-neutral-50/20 dark:bg-neutral-900/10">
                    <p className="text-xs italic text-neutral-400 dark:text-neutral-500">
                      Nenhum registro de Itens encontrado.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(editingItem.items || editingItem.itens_pedido || []).map((sub: any, sIdx: number) => {
                      const subKey = \`modal-\${editingItem.id || 'edit'}-\${sIdx}\`
                      const isSubExpanded = !!expandedSubItems[subKey]

                      return (
                        <SubItemAccordion
                          key={sIdx}
                          subItem={sub}
                          sIdx={sIdx}
                          subKey={subKey}
                          isSubExpanded={isSubExpanded}
                          subFields={subFields}
                          toggleSubItem={toggleSubItem}
                          formatDateForInput={formatDateForInput}
                          onEditSubItem={(sub, sIndex) => setEditingSubItem({ subItem: sub, sIdx: sIndex, parentId: editingItem.id || editingItem.codigo || 'edit', subFields })}
                          onDeleteSubItem={(sub, sIndex) => setDeletingSubItem({ subItem: sub, sIdx: sIndex, parentId: editingItem.id || editingItem.codigo || 'edit' })}
                        />
                      )
                    })}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs tracking-wide transition-colors shadow-lg shadow-indigo-500/20"
                  >
                    <Save className="w-4 h-4" /> Salvar Alterações
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão do Item Principal fiel à Web Produção (Imagem 3) */}
      {deletingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-start justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                  Excluir Registro
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Esta ação não pode ser desfeita e removerá permanentemente os dados do banco.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-400">
              <div className="p-2 bg-red-500/20 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold">Você tem certeza?</p>
                <p className="text-xs opacity-80 mt-0.5">
                  Você está prestes a excluir "\${String(deletingItem.id || deletingItem.codigo || deletingItem.nome || deletingItem.produto || 'este registro')}".
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-6 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
              >
                CANCELAR
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-colors shadow-lg shadow-red-500/20"
              >
                <Trash2 className="w-4 h-4" /> {isSubmitting ? 'Excluindo...' : 'CONFIRMAR EXCLUSÃO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Sub-Item (Imagem 3 topo) */}
      {editingSubItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-8 max-w-2xl w-full shadow-2xl relative space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                    Editar Registro
                  </h3>
                  <p className="text-xs text-neutral-400 font-mono">
                    Registro #\${editingSubItem.subItem.id || editingSubItem.subItem.codigo || ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSubItem(null)}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubItemFormSubmit} className="space-y-4">
              <div className="grid grid-cols-12 gap-4 max-h-[50vh] overflow-y-auto px-1 py-1">
                {editingSubItem.subFields.map(sf => {
                  const val = editingSubItem.subItem[sf.dbColumn] ?? editingSubItem.subItem[sf.dbColumn.split('.').pop()!]
                  const dt = (sf.dataType || '').toLowerCase()
                  const isDate = dt === 'date' || sf.dbColumn.includes('data') || sf.dbColumn.includes('date')
                  const isNumber = dt.includes('int') || dt.includes('num') || dt.includes('float') || dt.includes('decimal') || dt.includes('double')
                  const isSelect = sf.config?.options && sf.config.options.length > 0
                  const isTotalField = sf.dbColumn.includes('total') || sf.label.toLowerCase().includes('total')

                  const rawCols = sf.config?.modalGridSpan ?? sf.config?.gridSpan ?? sf.config?.columns ?? sf.config?.col_span ?? sf.config?.component?.modalGridSpan ?? sf.config?.component?.gridSpan ?? sf.config?.component?.columns ?? sf.config?.component?.col_span ?? sf.config?.colSpan
                  const numCols = typeof rawCols === 'number' ? rawCols : (typeof rawCols === 'string' && rawCols.match(/\d+/) ? parseInt(rawCols.match(/\d+/)![0], 10) : null)
                  const widthVal = sf.config?.width || sf.config?.component?.width || ''
                  
                  let colSpanClass = 'col-span-12 sm:col-span-6 lg:col-span-3'
                  if (numCols) {
                    if (numCols >= 12) colSpanClass = 'col-span-12'
                    else if (numCols === 9) colSpanClass = 'col-span-12 md:col-span-9'
                    else if (numCols === 8) colSpanClass = 'col-span-12 md:col-span-8'
                    else if (numCols === 7) colSpanClass = 'col-span-12 md:col-span-7'
                    else if (numCols === 6) colSpanClass = 'col-span-12 md:col-span-6'
                    else if (numCols === 5) colSpanClass = 'col-span-12 md:col-span-5'
                    else if (numCols === 4) colSpanClass = 'col-span-12 md:col-span-4'
                    else if (numCols === 3) colSpanClass = 'col-span-12 md:col-span-3'
                    else if (numCols === 2) colSpanClass = 'col-span-12 md:col-span-2'
                    else if (numCols === 1) colSpanClass = 'col-span-12 md:col-span-1'
                  } else if (widthVal === '75%') {
                    colSpanClass = 'col-span-12 md:col-span-9'
                  } else if (widthVal.includes('66')) {
                    colSpanClass = 'col-span-12 md:col-span-8'
                  } else if (widthVal === '50%' || widthVal === 'w-1/2' || sf.dbColumn.includes('produto')) {
                    colSpanClass = 'col-span-12 md:col-span-6'
                  } else if (widthVal === '33%' || widthVal === '33.33%') {
                    colSpanClass = 'col-span-12 md:col-span-4'
                  } else if (widthVal === '25%' || widthVal === 'w-1/4') {
                    colSpanClass = 'col-span-12 md:col-span-3'
                  } else if (widthVal.includes('16')) {
                    colSpanClass = 'col-span-12 md:col-span-2'
                  }

                  if (isSelect) {
                    return (
                      <div key={sf.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                        <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                          {sf.label}
                        </label>
                        <select
                          name={sf.dbColumn}
                          defaultValue={String(val ?? '')}
                          className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all appearance-none cursor-pointer"
                        >
                          <option value="">Selecione...</option>
                          {sf.config.options.map((opt: any, oIdx: number) => {
                            const optVal = typeof opt === 'object' ? (opt.value ?? opt.id) : opt
                            const optLabel = typeof opt === 'object' ? (opt.label || opt.value) : opt
                            return <option key={oIdx} value={String(optVal)}>{String(optLabel)}</option>
                          })}
                        </select>
                      </div>
                    )
                  }

                  return (
                    <div key={sf.dbColumn} className={\`space-y-1.5 \${colSpanClass}\`}>
                      <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                        {sf.label}
                      </label>
                      <input
                        name={sf.dbColumn}
                        type={isDate ? 'date' : (isNumber && !isTotalField) ? 'number' : 'text'}
                        readOnly={isTotalField}
                        defaultValue={isDate ? formatDateForInput(val) : String(val ?? '')}
                        placeholder={sf.config?.placeholder || \`Digite o valor para \${sf.label}...\`}
                        className={\`w-full \${isTotalField ? 'bg-neutral-100/80 dark:bg-neutral-800/80 font-semibold cursor-not-allowed text-neutral-800 dark:text-neutral-200 opacity-90' : 'bg-slate-50 dark:bg-neutral-800'} border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all\`}
                      />
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditingSubItem(null)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs tracking-wide transition-colors shadow-lg shadow-indigo-500/20"
                >
                  <Save className="w-4 h-4" /> {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Sub-Item (Imagem 3 fundo) */}
      {deletingSubItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-start justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                  Excluir Registro
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Esta ação não pode ser desfeita e removerá permanentemente os dados do banco.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeletingSubItem(null)}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-400">
              <div className="p-2 bg-red-500/20 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold">Você tem certeza?</p>
                <p className="text-xs opacity-80 mt-0.5">
                  Você está prestes a excluir "\${String(deletingSubItem.subItem.id || deletingSubItem.subItem.codigo || deletingSubItem.subItem.produto_nome || deletingSubItem.subItem.produto || 'este registro')}".
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSubItem(null)}
                className="px-6 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
              >
                CANCELAR
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDeleteSubItem}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-colors shadow-lg shadow-red-500/20"
              >
                <Trash2 className="w-4 h-4" /> {isSubmitting ? 'Excluindo...' : 'CONFIRMAR EXCLUSÃO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className={\`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md border animate-in slide-in-from-bottom-5 duration-300 \${
          toastType === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 bg-white/95 dark:bg-neutral-900/95'
            : 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-300 bg-white/95 dark:bg-neutral-900/95'
        }\`}>
          <div className={\`w-7 h-7 rounded-xl flex items-center justify-center \${
            toastType === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          }\`}>
            {toastType === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          </div>
          <span className="text-xs font-bold tracking-wide">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
`)

  // ---------------------------------------------------------------------------
  // DetailMasterForm.tsx — Formulário da Aba Mestre com Feedback Toast
  // ---------------------------------------------------------------------------
  files.set('components/DetailMasterForm.tsx', `'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Save, CheckCircle, AlertTriangle, X, Loader2 } from 'lucide-react'

export interface DetailMasterFormProps {
  id: string
  backPath: string
  title: string
  updateAction: (id: string, payload: Record<string, any>) => Promise<any>
  children: React.ReactNode
}

function formatWithMask(value: string, mask?: string): string {
  if (!value) return ''
  const s = String(value)
  if (mask === '000.000.000-00' || (!mask && (s.length === 11 || /^\\d{11}$/.test(s)))) {
    const d = s.replace(/\\D/g, '').slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 6) return \`\${d.slice(0, 3)}.\${d.slice(3)}\`
    if (d.length <= 9) return \`\${d.slice(0, 3)}.\${d.slice(3, 6)}.\${d.slice(6)}\`
    return \`\${d.slice(0, 3)}.\${d.slice(3, 6)}.\${d.slice(6, 9)}-\${d.slice(9, 11)}\`
  }
  return s
}

export function DetailMasterForm({ id, backPath, title, updateAction, children }: DetailMasterFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  const handleInput = (e: React.FormEvent<HTMLFormElement>) => {
    const target = e.target as HTMLInputElement
    const mask = target?.getAttribute?.('data-mask')
    if (mask) {
      target.value = formatWithMask(target.value, mask)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    window.dispatchEvent(new CustomEvent('page-progress-start'))
    try {
      const formData = new FormData(e.currentTarget)
      const payload: Record<string, any> = {}
      formData.forEach((v, k) => { payload[k] = v })
      await updateAction(id, payload)
      setToastType('success')
      setToastMessage('Registro atualizado com sucesso!')
    } catch (err: any) {
      console.error(err)
      setToastType('error')
      setToastMessage(err?.message || 'Erro ao salvar alterações.')
    } finally {
      setIsSubmitting(false)
      window.dispatchEvent(new CustomEvent('page-progress-complete'))
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} onInput={handleInput} className="relative z-10 space-y-6">
        {children}

        <div className="flex items-center justify-end gap-3 pt-6 border-t border-neutral-200 dark:border-neutral-800 mt-8">
          <Link
            href={backPath}
            className="px-6 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs tracking-wide transition-colors shadow-lg shadow-indigo-500/20"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>

      {/* Toast Notification */}
      {toastMessage && (
        <div className={\`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md border animate-in slide-in-from-bottom-5 duration-300 \${
          toastType === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 bg-white/95 dark:bg-neutral-900/95'
            : 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-300 bg-white/95 dark:bg-neutral-900/95'
        }\`}>
          <div className={\`w-7 h-7 rounded-xl flex items-center justify-center \${
            toastType === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          }\`}>
            {toastType === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          </div>
          <span className="text-xs font-bold tracking-wide">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  )
}
`)

  // ---------------------------------------------------------------------------
  // TopProgressBar.tsx — Barra de Progresso de Navegação e Requisições
  // ---------------------------------------------------------------------------
  files.set('components/TopProgressBar.tsx', `'use client'

import React, { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function TopProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (progress > 0) {
      setProgress(100)
      const timer = setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [pathname, searchParams])

  useEffect(() => {
    let t1: any
    let t2: any
    let tAuto: any

    const handleStart = () => {
      setVisible(true)
      setProgress(25)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(tAuto)
      t1 = setTimeout(() => setProgress(prev => (prev >= 25 && prev < 80 ? 70 : prev)), 200)
      t2 = setTimeout(() => setProgress(prev => (prev >= 70 && prev < 90 ? 88 : prev)), 600)
      tAuto = setTimeout(() => {
        handleComplete()
      }, 2500)
    }

    const handleComplete = () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(tAuto)
      setProgress(100)
      setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 300)
    }

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a')
      if (target && target.href && !target.target && !target.hasAttribute('download')) {
        const url = new URL(target.href, window.location.href)
        if (url.origin === window.location.origin) {
          handleStart()
        }
      }
    }

    const handleSubmit = () => {
      handleStart()
    }

    document.addEventListener('click', handleClick)
    document.addEventListener('submit', handleSubmit)
    window.addEventListener('page-progress-start', handleStart)
    window.addEventListener('page-progress-complete', handleComplete)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(tAuto)
      document.removeEventListener('click', handleClick)
      document.removeEventListener('submit', handleSubmit)
      window.removeEventListener('page-progress-start', handleStart)
      window.removeEventListener('page-progress-complete', handleComplete)
    }
  }, [])

  if (!visible && progress === 0) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] h-[3px] pointer-events-none overflow-hidden bg-transparent">
      <div
        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-pink-500 shadow-[0_0_12px_rgba(99,102,241,0.8)] transition-all duration-300 ease-out"
        style={{
          width: \`\${progress}%\`,
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  )
}
`)

  // ---------------------------------------------------------------------------
  // Componentes BYOC (dinâmicos + templates padrão com suporte a aliases)
  // ---------------------------------------------------------------------------
  const byocNames = new Set<string>()
  byocNames.add('TimelineStatusVendas')
  byocNames.add('Czqngyk4TimelineStatusVendas')

  ;(ast.routes || []).forEach(r => {
    ;(r.formFields || []).forEach(f => {
      if (f.isByoc || f.dataType === 'byoc' || f.id.startsWith('byoc_')) {
        const rawId = f.id.replace(/^byoc_/, '')
        const rawPascal = rawId.replace(/[^a-zA-Z0-9_]/g, '')
        if (rawPascal) byocNames.add(rawPascal)
        if (f.config?.byocName) byocNames.add(f.config.byocName)
        if (f.config?.componentName) byocNames.add(f.config.componentName)
      }
    })
  })

  byocNames.forEach(compName => {
    if (compName.toLowerCase().includes('timeline') || compName.toLowerCase().includes('status')) {
      files.set(`components/${compName}.tsx`, `'use client'

import React, { useState, useEffect } from 'react'
import { Check, Package } from 'lucide-react'

export function ${compName}({ initialStatus = 'Novo', data }: { initialStatus?: string; data?: any }) {
  const rawInit = (data?.status || data?.Status || initialStatus || 'Novo')
  const [status, setStatus] = useState(rawInit)

  useEffect(() => {
    const checkSelect = () => {
      const select = (document.getElementById('status') || document.querySelector('select[name="status"]') || document.querySelector('select[name*="status" i]')) as HTMLSelectElement | null
      if (select && select.value) {
        setStatus(select.value)
      }
    }

    checkSelect()

    const handler = (e: Event) => {
      const target = e.target as HTMLSelectElement | HTMLInputElement | null
      if (target && (target.id === 'status' || target.name === 'status' || target.name?.toLowerCase().includes('status'))) {
        if (target.value) {
          setStatus(target.value)
        }
      }
    }

    document.addEventListener('change', handler)
    document.addEventListener('input', handler)

    const timer = setTimeout(checkSelect, 150)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('change', handler)
      document.removeEventListener('input', handler)
    }
  }, [])

  const steps = ['Novo', 'Contactado', 'Em Negociação', 'Fechado Ganho']
  const normalize = (s: string) => (s || '').toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim()
  const currentNormalized = normalize(status)
  const currentIdx = steps.findIndex(s => normalize(s) === currentNormalized)
  const activeIdx = currentIdx >= 0 ? currentIdx : 0

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
          JORNADA DE NEGOCIAÇÃO
        </span>
        <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 uppercase">
          {status || 'Novo'}
        </span>
      </div>
      <div className="flex items-center justify-between relative py-2">
        {/* Linha de fundo cinza */}
        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full" />
        {/* Linha de progresso preenchida até o step atual */}
        <div
          className="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-indigo-600 rounded-full transition-all duration-500"
          style={{ width: activeIdx === 0 ? '0%' : activeIdx === 1 ? '33%' : activeIdx === 2 ? '66%' : 'calc(100% - 3rem)' }}
        />

        {steps.map((st, i) => {
          const isPassed = i < activeIdx
          const isCurrent = i === activeIdx
          return (
            <div key={st} className="flex flex-col items-center gap-3 relative z-10 transition-all duration-300">
              {isPassed ? (
                <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                  <Check className="w-5 h-5 stroke-[2.5]" />
                </div>
              ) : isCurrent ? (
                <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 flex items-center justify-center ring-4 ring-indigo-500/20 shadow-md">
                  <Package className="w-5 h-5 stroke-[2]" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-700 text-neutral-300 dark:text-neutral-600 flex items-center justify-center">
                  <Check className="w-5 h-5 stroke-[2]" />
                </div>
              )}
              <span className={\`text-xs font-bold transition-colors \${isCurrent ? 'text-neutral-900 dark:text-white' : isPassed ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-400 dark:text-neutral-500'}\`}>
                {st}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
`)
    } else {
      files.set(`components/${compName}.tsx`, `'use client'

import React from 'react'

export function ${compName}({ data }: { data?: any }) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">${compName}</span>
      <p className="text-xs text-neutral-400 mt-1">Componente BYOC personalizado carregado com sucesso.</p>
    </div>
  )
}
`)
    }
  })
}
