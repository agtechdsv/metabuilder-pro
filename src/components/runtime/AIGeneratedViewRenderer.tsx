'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import { AlertCircle } from 'lucide-react'

function AiBoundaryFallback({ message }: { message?: string }) {
  const { t } = useI18n()
  return (
    <div className="p-8 m-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
      <h3 className="text-red-700 dark:text-red-400 font-bold text-sm mb-2 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        {t('ai_renderer.boundary_title')}
      </h3>
      <pre className="text-red-600 dark:text-red-400 text-xs whitespace-pre-wrap font-mono bg-red-100 dark:bg-red-950/40 p-3 rounded-lg overflow-auto max-h-64">
        {message || t('ai_renderer.unknown_error')}
      </pre>
      <p className="text-red-500 dark:text-red-500 text-xs mt-3">
        {t('ai_renderer.boundary_hint')}
      </p>
    </div>
  )
}

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
      return <AiBoundaryFallback message={this.state.error?.message} />
    }

    return this.props.children
  }
}

import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { transform } from 'sucrase'
import { Modal } from '@/components/ui/Modal'
import { createSandboxRequire } from '@/lib/aiSandboxModules'
import { repairJsxAttributeQuotes } from '@/lib/aiComponentCode'
import { createTunnelSupabaseClient } from './TunnelSupabaseProxy'
import { wrapChannelWithChunking } from '@/lib/chunkedChannel'

interface AIGeneratedViewRendererProps {
  componentCode: string
  viewName: string
  projectId: string
  projectSlug?: string
  projectToken?: string
  tunnelChannel?: any
}

/**
 * AIGeneratedViewRenderer
 * Renderiza dinamicamente o código React gerado pelo AI Builder.
 * 
 * Estratégia: Executa o código via Function constructor em um sandbox controlado,
 * injetando as dependências necessárias (React, supabase, toast, lucide-react).
 */
export function AIGeneratedViewRenderer({ componentCode, viewName, projectId, projectSlug, projectToken, tunnelChannel }: AIGeneratedViewRendererProps) {
  const { t } = useI18n()
  const tRef = useRef(t)
  tRef.current = t
  const tr = (key: string, msg?: string) => tRef.current(key).replace('{msg}', msg ?? '')
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
      setError(tr('ai_renderer.no_code'))
      setIsLoading(false)
      return
    }

    try {
      // Normalize: strip 'use client' directive (not needed in runtime eval)
      let code = componentCode
        .replace(/^['"]use client['"];?\s*/m, '')
        .trim()

      // Use sucrase to transpile TypeScript and JSX to standard JavaScript
      const compile = (src: string) => transform(src, {
        transforms: ['typescript', 'jsx', 'imports'],
        jsxRuntime: 'classic' // Uses React.createElement
      }).code
      try {
        code = compile(code)
      } catch (transpileErr: any) {
        // erro conhecido da IA (aspas escapadas em atributos JSX): tenta o reparo antes de desistir
        const repaired = repairJsxAttributeQuotes(code)
        try {
          if (repaired === code) throw transpileErr
          code = compile(repaired)
        } catch {
          throw new Error(tr('ai_renderer.transpile_error', transpileErr.message))
        }
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
        // Identidades ESTÁVEIS: o componente gerado costuma ter useEffect/useCallback que dependem de `supabase` e `toast`.
        // Se cada renderização devolvesse objetos novos, o efeito rodaria de novo a cada render (laço infinito de recargas).
        const sharedClient = createTunnelSupabaseClient(activeTunnel, supabase, projectToken || '', projectSlug)
        const toastFn = (msg: any, type?: string) => {
          if (typeof msg === 'object' && msg !== null) {
            const message = msg.description || msg.title || JSON.stringify(msg)
            // respeita o tipo informado pelo componente (error, warning, success, info); depois a variante
            const declared = ['error', 'warning', 'success', 'info'].includes(msg.type) ? msg.type : null
            const toastType = declared || (msg.variant === 'destructive' ? 'error' : msg.variant === 'default' ? 'info' : 'success')
            toast(message, toastType)
          } else {
            toast(msg, (type as any) || 'success')
          }
        }
        const stableToast = { toast: toastFn, addToast: toastFn }
        const stableI18n = { t: (key: string) => key }
        const customRequire = createSandboxRequire({ React, lucide, Modal, client: sharedClient, toast: stableToast, i18n: stableI18n })

        const exportsObj: any = {}
        
        try {
          factory(customRequire, exportsObj, projectId, activeTunnel)
        } catch (execErr: any) {
          setError(tr('ai_renderer.exec_error', execErr.message))
          setIsLoading(false)
          return
        }

        const Component = exportsObj.default || exportsObj.Component || exportsObj[Object.keys(exportsObj)[0]]

        if (typeof Component === 'function') {
          setRenderedComponent(() => Component)
        } else {
          setError(tr('ai_renderer.invalid_fn'))
        }
        setIsLoading(false)
      }).catch((err) => {
        setError(tr('ai_renderer.icons_error', err.message))
        setIsLoading(false)
      })

    } catch (err: any) {
      console.error('Erro ao compilar componente AI:', err)
      setError(tr('ai_renderer.compile_error', err.message))
      setIsLoading(false)
    }
  }, [componentCode, isConnectingTunnel, internalTunnel, tunnelChannel, projectId])

  if (isLoading || isConnectingTunnel) {
    return (
      <div className="flex items-center justify-center p-16 text-neutral-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">{t('ai_renderer.loading')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 m-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
        <h3 className="text-red-700 dark:text-red-400 font-bold text-sm mb-2">
          ⚠️ {t('ai_renderer.render_title')}
        </h3>
        <pre className="text-red-600 dark:text-red-400 text-xs whitespace-pre-wrap font-mono bg-red-100 dark:bg-red-950/40 p-3 rounded-lg">
          {error}
        </pre>
        <p className="text-red-500 dark:text-red-500 text-xs mt-3">
          {t('ai_renderer.suggestion')}
        </p>
      </div>
    )
  }

  if (!RenderedComponent) {
    return (
      <div className="p-8 text-center text-neutral-400">
        <p>{t('ai_renderer.not_found')}</p>
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
