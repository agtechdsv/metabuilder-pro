export function generateUiPrimitives(files: Map<string, string>) {
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

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, AlertCircle, X, Loader2 } from 'lucide-react'

interface DeleteButtonProps {
  recordName?: string
  onDelete: () => Promise<void>
}

export function DeleteButton({ recordName, onDelete }: DeleteButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setMounted(true)
  }, [])

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

      {mounted && isOpen && createPortal(
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
                  Você está prestes a excluir {recordName ? '"' + recordName + '"' : 'este registro'}.
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
        </div>,
        document.body
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
    router.push('?' + params.toString())
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
          width: progress + '%',
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  )
}
`)

  files.set('components/ui/custom-action-button.tsx', `'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { DynamicIcon } from '@/app/components/DynamicIcon'
import { X } from 'lucide-react'

export interface CustomActionParam {
  source: string
  target: string
}

export interface CustomActionConfig {
  id: string
  label: string
  icon?: string
  style?: string
  triggerType?: string
  usecaseSlug?: string
  usecaseOpenMode?: 'page' | 'modal' | 'drawer'
  usecaseModalSize?: 'sm' | 'md' | 'lg' | 'full' | 'custom'
  usecaseModalWidth?: string
  usecaseModalHeight?: string
  usecaseSelectedFields?: Array<CustomActionParam | string>
  usecaseParams?: string
  linkTarget?: string
}

export function CustomActionButton({
  action,
  item,
  variant = 'icon',
}: {
  action: CustomActionConfig
  item?: any
  variant?: 'icon' | 'header'
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const handleMsg = (event: MessageEvent) => {
      if (event.data?.type === 'CLOSE_MODAL') {
        setIsOpen(false)
        router.refresh()
      }
    }
    window.addEventListener('message', handleMsg)
    return () => window.removeEventListener('message', handleMsg)
  }, [isOpen, router])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const buildUrl = (isEmbedded: boolean) => {
    const slug = action.usecaseSlug || (action.linkTarget ? action.linkTarget.replace(/^\\//, '') : '')
    if (!slug) return '#'

    const selectedFields = action.usecaseSelectedFields || []
    const fieldParamParts = selectedFields.map(f => {
      if (typeof f === 'string') {
        const cleanKey = f.includes('.') ? f.split('.').pop()! : f
        let val = item?.[f] !== undefined ? item[f] : item?.[cleanKey]
        if (val === undefined && item) {
          const lKey = cleanKey.toLowerCase()
          for (const k of Object.keys(item)) {
            if (k.toLowerCase() === lKey) {
              val = item[k]
              break
            }
          }
        }
        if (val === undefined || val === null || val === '') return ''
        return \`\${encodeURIComponent(cleanKey)}=\${encodeURIComponent(val)}\`
      } else if (f && typeof f === 'object' && f.source && f.target) {
        const cleanSource = f.source.includes('.') ? f.source.split('.').pop()! : f.source
        let val = item?.[f.source] !== undefined ? item[f.source] : item?.[cleanSource]
        if (val === undefined && item) {
          const lSource = f.source.toLowerCase()
          const lClean = cleanSource.toLowerCase()
          for (const k of Object.keys(item)) {
            const lk = k.toLowerCase()
            if (lk === lSource || lk === lClean) {
              val = item[k]
              break
            }
          }
        }
        if (val === undefined || val === null || val === '') return ''
        return \`\${encodeURIComponent(f.target)}=\${encodeURIComponent(val)}\`
      }
      return ''
    }).filter(Boolean)

    const extraParams = (action.usecaseParams || '').trim()
    const allParts = [...fieldParamParts]
    if (extraParams) {
      allParts.push(extraParams)
    }
    if (isEmbedded) {
      allParts.push('embedded=true')
    }

    const qs = allParts.join('&')
    return \`/\${slug}\${qs ? '?' + qs : ''}\`
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const openMode = action.usecaseOpenMode || 'modal'

    if (openMode === 'page') {
      const url = buildUrl(false)
      if (url && url !== '#') {
        router.push(url)
      }
      return
    }

    setIsOpen(true)
  }

  const openMode = action.usecaseOpenMode || 'modal'
  const modalSize = action.usecaseModalSize || 'full'
  const iframeUrl = buildUrl(true)

  let sizeClasses = 'w-[95vw] h-[90vh] max-w-[95vw]'
  if (modalSize === 'sm') sizeClasses = 'w-[90vw] max-w-md h-[500px]'
  else if (modalSize === 'md') sizeClasses = 'w-[90vw] max-w-2xl h-[650px]'
  else if (modalSize === 'lg') sizeClasses = 'w-[92vw] max-w-5xl h-[80vh]'
  else if (modalSize === 'full') sizeClasses = 'w-[95vw] h-[90vh] max-w-[95vw]'

  const customStyle: React.CSSProperties = {}
  if (modalSize === 'custom') {
    if (action.usecaseModalWidth) customStyle.width = action.usecaseModalWidth
    if (action.usecaseModalHeight) customStyle.height = action.usecaseModalHeight
  }

  return (
    <>
      {variant === 'header' ? (
        <button
          type="button"
          onClick={handleClick}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95 cursor-pointer"
          title={action.label}
        >
          <DynamicIcon icon={action.icon || 'Zap'} size={16} className="text-neutral-400" />
          <span>{action.label}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 hover:text-indigo-600 hover:border-indigo-500 transition-all active:scale-90 shadow-sm flex items-center justify-center cursor-pointer"
          title={action.label}
        >
          <DynamicIcon icon={action.icon || 'Receipt'} size={14} />
        </button>
      )}

      {mounted && isOpen && openMode === 'drawer' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="w-full max-w-2xl h-full bg-white dark:bg-neutral-950 shadow-2xl border-l border-neutral-200 dark:border-neutral-800 flex flex-col animate-in slide-in-from-right duration-300 relative"
            onClick={e => e.stopPropagation()}
          >
            <iframe src={iframeUrl} className="w-full h-full border-none" />
          </div>
        </div>,
        document.body
      )}

      {mounted && isOpen && openMode === 'modal' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className={\`relative \${sizeClasses} bg-white dark:bg-neutral-950 rounded-[2.5rem] overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95 duration-200 flex flex-col\`}
            style={customStyle}
            onClick={e => e.stopPropagation()}
          >
            <iframe src={iframeUrl} className="w-full h-full border-none rounded-[2.5rem]" />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export function CloseModalButton() {
  return (
    <button
      type="button"
      onClick={() => window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*')}
      className="p-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-xl transition-all text-neutral-500 hover:text-neutral-900 dark:hover:text-white shrink-0 ml-1 cursor-pointer"
      title="Fechar"
    >
      <X className="w-5 h-5" />
    </button>
  )
}
`)
}
