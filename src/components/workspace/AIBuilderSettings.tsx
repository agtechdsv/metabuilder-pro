'use client'

import { useState, useEffect } from 'react'
import { Bot, Key, Check, X, AlertCircle, Loader2, Zap } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface AIBuilderSettingsProps {
  workspaceId: string
  isPro: boolean
}

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { value: 'anthropic', label: 'Anthropic (Claude)', models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-3-5-sonnet-20241022'] },
  { value: 'gemini', label: 'Google Gemini', models: ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-3.5-flash', 'gemma-4-31b-it'] },
  { value: 'custom', label: 'Personalizado (Ollama / Outro)', models: [] },
]

export function AIBuilderSettings({ workspaceId, isPro }: AIBuilderSettingsProps) {
  const [config, setConfig] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const [provider, setProvider] = useState('openai')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o')
  const [baseUrl, setBaseUrl] = useState('')

  const { toast } = useToast()
  const selectedProvider = PROVIDERS.find((p) => p.value === provider)

  useEffect(() => {
    fetchConfig()
  }, [workspaceId])


  const fetchConfig = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/ai-builder/config?workspace_id=${workspaceId}`)
      const data = await res.json()
      if (data.config) {
        setConfig(data.config)
        setProvider(data.config.provider || 'openai')
        setModel(data.config.model || '')
        setBaseUrl(data.config.base_url || '')
      }
    } catch {
      // sem config ainda
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!apiKey && !config) {
      toast('Informe a chave de API.', 'error')
      return
    }
    setIsSaving(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/ai-builder/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          provider,
          api_key: apiKey || undefined,
          model,
          base_url: baseUrl || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast('Configuração de IA salva!', 'success')
        setApiKey('')
        fetchConfig()
      } else {
        toast(data.error || 'Erro ao salvar.', 'error')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = async () => {
    if (!config && !apiKey) {
      toast('Salve a configuração antes de testar.', 'error')
      return
    }
    setIsTesting(true)
    setTestResult(null)

    // Cria uma sessão temporária de teste
    try {
      const res = await fetch('/api/ai-builder/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: 'test-' + Date.now(),
          message: 'Responda apenas: "OK"',
          workspace_id: workspaceId,
        }),
      })

      if (res.ok) {
        // Consome o stream para verificar
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let received = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          received += decoder.decode(value)
          if (received.includes('[DONE]')) break
        }
        setTestResult({ ok: true, message: 'Conexão bem-sucedida! Sua chave está funcionando.' })
      } else {
        const data = await res.json()
        setTestResult({ ok: false, message: data.error || 'Falha na conexão.' })
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'Erro de rede.' })
    } finally {
      setIsTesting(false)
    }
  }

  if (!isPro) {
    return (
      <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Bot className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-black text-neutral-900 dark:text-white mb-2">AI Builder</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 max-w-sm mx-auto">
          Gere casos de uso completos usando a IA de sua preferência. Recurso exclusivo do plano PRO.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-500 rounded-xl text-sm font-bold cursor-not-allowed">
          🔒 Disponível no Plano PRO
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/20">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-black text-neutral-900 dark:text-white">AI Builder</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Configure sua chave de API para gerar casos de uso com IA
          </p>
        </div>
        {config && (
          <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-bold">
            <Check className="w-3 h-3" /> Configurado — {PROVIDERS.find(p => p.value === config.provider)?.label}
          </span>
        )}
      </div>

      {/* Formulário */}
      <div className="bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 space-y-5">
        {/* Provedor */}
        <div>
          <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-2">
            Provedor de IA
          </label>
          <select
            value={provider}
            onChange={(e) => {
              const newProvider = e.target.value
              setProvider(newProvider)
              const p = PROVIDERS.find((prov) => prov.value === newProvider)
              if (p && p.models.length > 0) {
                setModel(p.models[0])
              } else {
                setModel('')
              }
              setTestResult(null)
            }}
            className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* URL Base (apenas para custom) */}
        {provider === 'custom' && (
          <div>
            <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-2">
              URL Base (ex: http://localhost:11434/v1)
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://seu-servidor.com/v1"
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
        )}

        {/* Modelo */}
        <div>
          <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-2">
            Modelo Padrão
          </label>
          {selectedProvider && selectedProvider.models.length > 0 ? (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            >
              {selectedProvider.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Ex: llama3, mistral, etc."
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          )}
        </div>

        {/* Chave de API */}
        <div>
          <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-2">
            <Key className="w-3 h-3 inline mr-1" />
            Chave de API {config ? '(deixe em branco para manter a atual)' : ''}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config ? '••••••••••••••••••••' : 'sk-... ou sua chave de API'}
            className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 font-mono"
          />
          <p className="text-xs text-neutral-400 mt-1.5">
            🔒 Sua chave é armazenada de forma segura e nunca é exposta no frontend.
          </p>
        </div>

        {/* Resultado do teste */}
        {testResult && (
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${
            testResult.ok
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400'
          }`}>
            {testResult.ok ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <X className="w-4 h-4 mt-0.5 shrink-0" />}
            <p className="text-sm font-medium">{testResult.message}</p>
          </div>
        )}

        {/* Botões */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-violet-600/20 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Salvar Configuração
          </button>
          {config && (
            <button
              onClick={handleTest}
              disabled={isTesting}
              className="flex items-center gap-2 px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Testar Conexão
            </button>
          )}
        </div>
      </div>

      {/* Nota informativa */}
      <div className="flex items-start gap-3 p-4 bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 rounded-xl">
        <AlertCircle className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
        <p className="text-xs text-violet-700 dark:text-violet-300 leading-relaxed">
          <strong>Dica de modelo:</strong> Para geração de código React, recomendamos <strong>GPT-4o</strong>, <strong>Claude Opus</strong> ou <strong>Gemini 2.0</strong> para melhores resultados. Modelos menores podem gerar código com erros.
        </p>
      </div>
    </div>
  )
}
