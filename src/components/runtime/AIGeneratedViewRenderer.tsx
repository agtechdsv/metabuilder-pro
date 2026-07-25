'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'

interface AIGeneratedViewRendererProps {
  componentCode: string
  viewName: string
}

/**
 * AIGeneratedViewRenderer
 * Renderiza dinamicamente o código React gerado pelo AI Builder.
 * 
 * Estratégia: Executa o código via Function constructor em um sandbox controlado,
 * injetando as dependências necessárias (React, supabase, toast, lucide-react).
 */
export function AIGeneratedViewRenderer({ componentCode, viewName }: AIGeneratedViewRendererProps) {
  const [RenderedComponent, setRenderedComponent] = useState<React.ComponentType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    if (!componentCode) {
      setError('Nenhum código de componente encontrado.')
      setIsLoading(false)
      return
    }

    try {
      // Normalize: strip 'use client' directive (not needed in runtime eval)
      let code = componentCode
        .replace(/^['"]use client['"];?\s*/m, '')
        .trim()

      // Strip TS-specific syntax that breaks the Function constructor
      // Remove type annotations inline: : TypeName  | : { ... }  | <TypeParam>
      // We use a simple approach: transform common patterns
      code = code
        // Remove TypeScript type assertions: (x as Type) -> x
        .replace(/\s+as\s+[A-Z][A-Za-z<>\[\]|&, ]*(?=[,)\s;])/g, '')
        // Remove generic type params on function calls: foo<Type>( -> foo(
        .replace(/<[A-Z][A-Za-z<>\[\]|&, ]*>\s*\(/g, '(')
        // Remove interface declarations
        .replace(/^interface\s+\w+\s*\{[^}]*\}/gm, '')
        // Remove type alias declarations
        .replace(/^type\s+\w+\s*=\s*[^;]+;/gm, '')
        // Remove TypeScript parameter type annotations: (x: Type) -> (x)
        .replace(/(\w+)\s*:\s*[A-Z][A-Za-z<>\[\]|&, .]*(?=[,)=\s])/g, '$1')
        // Remove return type annotations: ): ReturnType { -> ) {
        .replace(/\)\s*:\s*[A-Z][A-Za-z<>\[\]|&, .]*\s*\{/g, ') {')
        // Remove useState<Type> generics: useState<Foo>( -> useState(
        .replace(/useState<[^>]+>/g, 'useState')
        // Remove useRef<Type> generics
        .replace(/useRef<[^>]+>/g, 'useRef')
        // Remove React.FC<Props> type
        .replace(/:\s*React\.FC<[^>]+>/g, '')
        // Remove simple : string, : number, : boolean, : any in params
        .replace(/:\s*(string|number|boolean|any|void|null|undefined)(?=[,);\s=])/g, '')

      // Build require-like shim for known imports
      const lucideIcons: Record<string, React.FC<any>> = {}
      try {
        // Dynamically pull lucide icons referenced in code
        const lucideMatches = code.match(/\b([A-Z][A-Za-z]+)\b/g) || []
        const uniqueNames = [...new Set(lucideMatches)]
        // We'll do a best-effort dynamic import approach below
      } catch {}

      // Build a module sandbox
      // We replace import statements with variable assignments from our injected scope
      let transformedCode = code
        // Remove all import statements (we inject deps ourselves)
        .replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*/gm, '')
        // Replace export default function → just the function
        .replace(/export\s+default\s+function\s+(\w+)/, 'var __DefaultExport = function $1')
        // Replace export default → __DefaultExport
        .replace(/export\s+default\s+/, 'var __DefaultExport = ')
        // Remove named exports
        .replace(/^export\s+/gm, '')

      transformedCode += '\n; return __DefaultExport;'

      // Create the Function with all deps injected
      // eslint-disable-next-line no-new-func
      const factory = new Function(
        'React',
        'useState',
        'useEffect',
        'useRef',
        'useCallback',
        'useMemo',
        'supabase',
        'toast',
        // Lucide icons (common ones)
        'Search', 'Plus', 'Trash2', 'Tag', 'ShoppingBag', 'DollarSign',
        'Package', 'Loader2', 'FolderPlus', 'Info', 'Edit', 'Save',
        'X', 'Check', 'ChevronDown', 'ChevronUp', 'ChevronLeft', 'ChevronRight',
        'Filter', 'RefreshCw', 'Download', 'Upload', 'Settings', 'User',
        'Users', 'Mail', 'Phone', 'MapPin', 'Calendar', 'Clock',
        'Star', 'Heart', 'Bell', 'Lock', 'Unlock', 'Eye', 'EyeOff',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'Grid', 'List', 'Table', 'LayoutGrid', 'Layers',
        'FileText', 'File', 'Folder', 'Image', 'Link', 'Archive',
        'Percent', 'DollarSign', 'TrendingUp', 'TrendingDown', 'BarChart',
        'AlertCircle', 'AlertTriangle', 'CheckCircle', 'XCircle',
        transformedCode
      )

      // Dynamic import lucide for icons
      import('lucide-react').then((lucide: any) => {
        const Component = factory(
          React,
          React.useState,
          React.useEffect,
          React.useRef,
          React.useCallback,
          React.useMemo,
          supabase,
          (msg: string, type?: string) => toast(msg, (type as any) || 'success'),
          // Lucide icons
          lucide.Search, lucide.Plus, lucide.Trash2, lucide.Tag, lucide.ShoppingBag, lucide.DollarSign,
          lucide.Package, lucide.Loader2, lucide.FolderPlus, lucide.Info, lucide.Edit, lucide.Save,
          lucide.X, lucide.Check, lucide.ChevronDown, lucide.ChevronUp, lucide.ChevronLeft, lucide.ChevronRight,
          lucide.Filter, lucide.RefreshCw, lucide.Download, lucide.Upload, lucide.Settings, lucide.User,
          lucide.Users, lucide.Mail, lucide.Phone, lucide.MapPin, lucide.Calendar, lucide.Clock,
          lucide.Star, lucide.Heart, lucide.Bell, lucide.Lock, lucide.Unlock, lucide.Eye, lucide.EyeOff,
          lucide.ArrowLeft, lucide.ArrowRight, lucide.ArrowUp, lucide.ArrowDown,
          lucide.Home, lucide.Grid, lucide.List, lucide.Table2, lucide.LayoutGrid, lucide.Layers,
          lucide.FileText, lucide.File, lucide.Folder, lucide.Image, lucide.Link, lucide.Archive,
          lucide.Percent, lucide.DollarSign, lucide.TrendingUp, lucide.TrendingDown, lucide.BarChart2,
          lucide.AlertCircle, lucide.AlertTriangle, lucide.CheckCircle, lucide.XCircle,
        )

        if (typeof Component === 'function') {
          setRenderedComponent(() => Component)
        } else {
          setError('O componente gerado não retornou uma função válida.')
        }
        setIsLoading(false)
      }).catch((err) => {
        setError(`Erro ao carregar ícones: ${err.message}`)
        setIsLoading(false)
      })

    } catch (err: any) {
      console.error('Erro ao compilar componente AI:', err)
      setError(`Erro ao compilar o componente: ${err.message}`)
      setIsLoading(false)
    }
  }, [componentCode])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16 text-neutral-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Carregando componente...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 m-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
        <h3 className="text-red-700 dark:text-red-400 font-bold text-sm mb-2">
          ⚠️ Erro ao renderizar componente gerado por IA
        </h3>
        <pre className="text-red-600 dark:text-red-400 text-xs whitespace-pre-wrap font-mono bg-red-100 dark:bg-red-950/40 p-3 rounded-lg">
          {error}
        </pre>
        <p className="text-red-500 dark:text-red-500 text-xs mt-3">
          Sugestão: Volte ao AI Builder, edite o componente e reaplique ao projeto.
        </p>
      </div>
    )
  }

  if (!RenderedComponent) {
    return (
      <div className="p-8 text-center text-neutral-400">
        <p>Componente não encontrado.</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <RenderedComponent />
    </div>
  )
}
