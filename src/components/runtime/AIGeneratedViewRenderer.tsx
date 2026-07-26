'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { transform } from 'sucrase'

interface AIGeneratedViewRendererProps {
  componentCode: string
  viewName: string
  projectId?: string
  tunnelChannel?: any
}

/**
 * AIGeneratedViewRenderer
 * Renderiza dinamicamente o código React gerado pelo AI Builder.
 * 
 * Estratégia: Executa o código via Function constructor em um sandbox controlado,
 * injetando as dependências necessárias (React, supabase, toast, lucide-react).
 */
export function AIGeneratedViewRenderer({ componentCode, viewName, projectId, tunnelChannel }: AIGeneratedViewRendererProps) {
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

      // Use sucrase to transpile TypeScript and JSX to standard JavaScript
      try {
        code = transform(code, {
          transforms: ['typescript', 'jsx', 'imports'],
          jsxRuntime: 'classic' // Uses React.createElement
        }).code
      } catch (transpileErr: any) {
        throw new Error(`Erro na transpilação TypeScript/JSX: ${transpileErr.message}`)
      }

      // Build require-like shim for known imports
      const lucideIcons: Record<string, React.FC<any>> = {}
      try {
        // Dynamically pull lucide icons referenced in code
        const lucideMatches = code.match(/\b([A-Z][A-Za-z]+)\b/g) || []
        const uniqueNames = [...new Set(lucideMatches)]
        // We'll do a best-effort dynamic import approach below
      } catch {}

      // Create the Function with require and exports
      // eslint-disable-next-line no-new-func
      const factory = new Function(
        'require',
        'exports',
        'PROJECT_ID',
        'TUNNEL_CHANNEL',
        code
      )

      // Dynamic import lucide for icons
      import('lucide-react').then((lucide: any) => {
        const customRequire = (modName: string) => {
          if (modName === 'react') return React
          if (modName === 'lucide-react') return lucide
          if (modName === '@/utils/supabase/client') return { createClient: () => supabase }
          if (modName === '@/components/ui/Toast') return { useToast: () => ({ toast: (msg: string, type?: string) => toast(msg, (type as any) || 'success') }) }
          if (modName.includes('i18n')) return { useI18n: () => ({ t: (key: string) => key }) }
          return {}
        }

        const exportsObj: any = {}
        
        try {
          factory(customRequire, exportsObj, projectId, tunnelChannel)
        } catch (execErr: any) {
          setError(`Erro na execução do código gerado: ${execErr.message}`)
          setIsLoading(false)
          return
        }

        const Component = exportsObj.default || exportsObj.Component || exportsObj[Object.keys(exportsObj)[0]]

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
