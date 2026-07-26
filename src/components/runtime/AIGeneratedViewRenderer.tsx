'use client'

import React, { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary capturou um erro no componente da IA:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 m-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
          <h3 className="text-red-700 dark:text-red-400 font-bold text-sm mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Erro de execução no componente
          </h3>
          <pre className="text-red-600 dark:text-red-400 text-xs whitespace-pre-wrap font-mono bg-red-100 dark:bg-red-950/40 p-3 rounded-lg overflow-auto max-h-64">
            {this.state.error?.message || 'Erro desconhecido.'}
          </pre>
          <p className="text-red-500 dark:text-red-500 text-xs mt-3">
            O componente gerado pela IA tentou executar uma operação inválida (ex: acessar dados vazios devido à falta da tabela).
          </p>
        </div>
      )
    }

    return this.props.children
  }
}

import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { transform } from 'sucrase'
import { createTunnelSupabaseClient } from './TunnelSupabaseProxy'
import { wrapChannelWithChunking } from '@/lib/chunkedChannel'

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
  const [internalTunnel, setInternalTunnel] = useState<any>(null)
  const [isConnectingTunnel, setIsConnectingTunnel] = useState(true)
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    if (tunnelChannel || !projectId) {
      setIsConnectingTunnel(false)
      return
    }

    const channelName = `tunnel:${projectId}`
    const channel = wrapChannelWithChunking(supabase.channel(channelName))
    
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[AI Renderer] ✅ Túnel conectado: ${channelName}`)
        setInternalTunnel(channel)
        setIsConnectingTunnel(false)
      }
    })

    return () => {
      try {
        channel.unsubscribe()
        supabase.removeChannel(channel._channel || channel)
      } catch (e) {}
    }
  }, [projectId, tunnelChannel, supabase])

  useEffect(() => {
    if (isConnectingTunnel) return

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
        const activeTunnel = tunnelChannel || internalTunnel
        const customRequire = (modName: string) => {
          if (modName === 'react') return React
          if (modName === 'lucide-react') return lucide
          if (modName === '@/utils/supabase/client') return { createClient: () => createTunnelSupabaseClient(activeTunnel, supabase) }
          if (modName === '@/components/ui/Toast') return { 
            useToast: () => ({ 
              toast: (msg: any, type?: string) => {
                if (typeof msg === 'object' && msg !== null) {
                  const message = msg.description || msg.title || JSON.stringify(msg)
                  const toastType = msg.variant === 'destructive' ? 'error' : (msg.variant === 'default' ? 'info' : 'success')
                  toast(message, toastType)
                } else {
                  toast(msg, (type as any) || 'success')
                }
              } 
            }) 
          }
          if (modName.includes('i18n')) return { useI18n: () => ({ t: (key: string) => key }) }
          return {}
        }

        const exportsObj: any = {}
        
        try {
          factory(customRequire, exportsObj, projectId, activeTunnel)
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
  }, [componentCode, isConnectingTunnel, internalTunnel, tunnelChannel, projectId])

  if (isLoading || isConnectingTunnel) {
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
    <div className="w-full h-full">
      <ErrorBoundary>
        <RenderedComponent />
      </ErrorBoundary>
    </div>
  )
}
