'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bot, Send, Paperclip, Loader2, X, Sparkles, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import { AIBuilderMessageBubble } from './AIBuilderMessageBubble'
import { TableSelector } from './TableSelector'
import { AIBuilderReviewPanel } from './AIBuilderReviewPanel'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  isStreaming?: boolean
}

interface AIBuilderChatProps {
  workspaceId: string
  workspaceSlug: string
  projectId: string
  projectSlug: string
  projectSecretToken: string
  // Modo edição: caso de uso existente a ser editado
  initialView?: {
    id: string
    name: string
    slug: string
    layout_config: any
    tables_config: any
  }
  onClose?: () => void
}

export function AIBuilderChat({
  workspaceId,
  workspaceSlug,
  projectId,
  projectSlug,
  projectSecretToken,
  initialView,
  onClose,
}: AIBuilderChatProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTables, setSelectedTables] = useState<any[]>([])
  const [newTables, setNewTables] = useState<string[]>([])
  const [reviewData, setReviewData] = useState<any | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [attachments, setAttachments] = useState<{ name: string; content: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    if (initialView) {
      // Modo edição: popula reviewData a partir da view existente e abre painel de revisão
      const lc = initialView.layout_config || {}
      let tablesConfig: string[] = []
      try {
        const parsed = typeof initialView.tables_config === 'string'
          ? JSON.parse(initialView.tables_config)
          : (initialView.tables_config || [])
        const rawArray = Array.isArray(parsed) ? parsed : []
        tablesConfig = rawArray.map((t: any) => typeof t === 'string' ? t : (t.db_table_name || t.name || ''))
      } catch { tablesConfig = [] }

      // Fetch and set selected tables for edit mode
      fetch(`/api/ai-builder/tables?project_id=${projectId}`, { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
          if (data && data.models) {
            const matchedTables = data.models.filter((m: any) => tablesConfig.includes(m.db_table_name) || tablesConfig.includes(m.name))
            setSelectedTables(matchedTables)
          }
        })
        .catch(console.error)

      setReviewData({
        use_case_name: initialView.name,
        use_case_slug: initialView.slug,
        component_code: lc.component_code || '',
        new_migrations: lc.suggested_migrations || lc.applied_migrations || [],
        approved_migrations: lc.approved_migrations || (lc.applied_migrations ? lc.applied_migrations.map((_: any, i: number) => i) : []),
        suggested_navigation: lc.navigation_type || 'menu_item',
        description: lc.description || '',
        selected_tables: tablesConfig,
        new_tables: [],
      })
      setShowReview(true)

      const existingSessionId = lc.ai_session_id
      if (existingSessionId) {
        setSessionId(existingSessionId)
        // Fetch chat history
        supabase.from('ai_builder_messages').select('id, role, content').eq('session_id', existingSessionId).order('created_at', { ascending: true }).then(({ data: history }) => {
          if (history && history.length > 0) {
            const mappedHistory = history.map((m: any) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content,
            }))
            setMessages([
              {
                id: 'edit-welcome',
                role: 'assistant',
                content: `✏️ **Modo Edição** — Você está editando **"${initialView.name}"**.\n\nSeu histórico de conversas anterior foi restaurado. Você pode continuar enviando mensagens para que eu faça alterações, ou editar o código manualmente na aba **Componente**.\n\nQuando estiver pronto, clique em **Atualizar Projeto**.`,
              },
              ...mappedHistory
            ])
          } else {
            setMessages([{
              id: 'edit-welcome',
              role: 'assistant',
              content: `✏️ **Modo Edição** — Você está editando **"${initialView.name}"**.\n\nO código atual foi carregado na aba **Componente**. Você pode:\n- Editar o código diretamente\n- Enviar uma mensagem pedindo que eu faça alterações\n- Ajustar as Configurações na aba correspondente\n\nQuando estiver pronto, clique em **Atualizar Projeto**.`,
            }])
          }
        })
      } else {
        setMessages([{
          id: 'edit-welcome',
          role: 'assistant',
          content: `✏️ **Modo Edição** — Você está editando **"${initialView.name}"**.\n\nO código atual foi carregado na aba **Componente**. Você pode:\n- Editar o código diretamente\n- Enviar uma mensagem pedindo que eu faça alterações\n- Ajustar as Configurações na aba correspondente\n\nQuando estiver pronto, clique em **Atualizar Projeto**.`,
        }])
        // Cria uma sessão de edição se não tinha uma anterior
        supabase.auth.getUser().then(async ({ data: { user } }) => {
          if (!user) return
          const { data: session } = await supabase.from('ai_builder_sessions').insert({
            project_id: projectId,
            user_id: user.id,
            title: `Edição: ${initialView.name}`,
            status: 'draft',
          }).select().single()
          if (session) setSessionId(session.id)
        })
      }
    } else {
      initSession()
    }
  }, [projectId, initialView?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const initSession = async () => {
    const { data: session, error } = await supabase
      .from('ai_builder_sessions')
      .insert({
        project_id: projectId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        title: 'Nova Sessão',
        status: 'draft',
      })
      .select()
      .single()

    if (!error && session) {
      setSessionId(session.id)
    }

    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: '👋 Olá! Sou seu assistente de geração de casos de uso.\n\nDescreva o que você precisa e eu vou gerar o componente React completo, pronto para usar no seu projeto!\n\n**Dicas:**\n- Selecione as tabelas que o caso de uso vai usar no painel à esquerda\n- Você pode enviar um arquivo de especificação (PDF, TXT, MD)\n- Quando estiver satisfeito com o resultado, clique em **Gerar** para eu produzir o código',
    }])
  }

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || !sessionId) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input + (attachments.length > 0 ? `\n\n[Arquivos anexados: ${attachments.map(a => a.name).join(', ')}]` : ''),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setAttachments([])
    setIsLoading(true)

    const assistantMessageId = (Date.now() + 1).toString()
    setMessages((prev) => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }])

    try {
      const res = await fetch('/api/ai-builder/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: userMessage.content,
          workspace_id: workspaceId,
          project_id: projectId,
          tables_context: selectedTables.map((t) => ({
            name: t.db_table_name,
            columns: t.fields?.map((f: any) => ({
              column_name: f.db_column_name || f.name,
              data_type: f.field_type,
            })) || [],
          })),
          new_tables: newTables,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro desconhecido')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        
        // A última linha pode estar incompleta (cortada no meio do chunk), então guardamos no buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.replace('data: ', '').trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.delta) {
              fullContent += parsed.delta
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: fullContent, isStreaming: true }
                    : m
                )
              )
            }
          } catch { /* ignora erros de parse de chunks malformados (raro com buffer) */ }
        }
      }

      let parsedJson: any = null
      try {
        let jsonStr = fullContent.trim()
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '')
        else if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '')
        
        const firstBrace = jsonStr.indexOf('{')
        const lastBrace = jsonStr.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)
        }
        
        if (jsonStr.startsWith('{')) {
          // Função para sanitizar o JSON (corrige quebras de linha não escapadas dentro de strings, problema comum em IAs)
          const sanitizeJsonString = (str: string) => {
            let isInsideString = false;
            let isEscaped = false;
            let result = '';
            for (let i = 0; i < str.length; i++) {
              const char = str[i];
              if (char === '\\' && !isEscaped) {
                isEscaped = true;
                result += char;
                continue;
              }
              if (char === '"' && !isEscaped) {
                isInsideString = !isInsideString;
                result += char;
                continue;
              }
              isEscaped = false;
              if (isInsideString && char === '\n') {
                result += '\\n';
              } else if (isInsideString && char === '\r') {
                result += '\\r';
              } else if (isInsideString && char === '\t') {
                result += '\\t';
              } else {
                result += char;
              }
            }
            return result;
          }

          const sanitizedJson = sanitizeJsonString(jsonStr)
          parsedJson = JSON.parse(sanitizedJson)
        }
      } catch (e) { 
        console.error('Falha ao fazer parse do JSON da IA:', e)
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? { ...m, content: fullContent, isStreaming: false }
            : m
        )
      )

      if (parsedJson?.component_code) {
        setReviewData({
          ...parsedJson,
          selected_tables: selectedTables.map((t: any) => t.db_table_name),
          new_tables: newTables,
        })
        setShowReview(true)
      }
    } catch (err: any) {
      toast(err.message || 'Erro ao comunicar com a IA', 'error')
      setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId))
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, sessionId, selectedTables, newTables, workspaceId, projectId, attachments, toast])

  // Ctrl+Enter para enviar
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      if (file.size > 500 * 1024) {
        toast(`Arquivo "${file.name}" muito grande (máx 500KB)`, 'error')
        continue
      }
      const text = await file.text()
      setAttachments((prev) => [...prev, { name: file.name, content: text }])
    }
    e.target.value = ''
  }

  if (showReview && reviewData) {
    return (
      <AIBuilderReviewPanel
        reviewData={reviewData}
        sessionId={sessionId!}
        projectId={projectId}
        workspaceSlug={workspaceSlug}
        projectSlug={projectSlug}
        selectedTables={selectedTables}
        newTables={newTables}
        onBack={() => setShowReview(false)}
        viewId={initialView?.id}
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Sidebar — Seletor de Tabelas */}
      <div className={`shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 transition-all duration-300 overflow-hidden flex flex-col ${sidebarOpen ? 'w-72' : 'w-0'}`}>
        <div className="p-4 overflow-y-auto flex-grow">
          <TableSelector
            projectId={projectId}
            selectedTables={selectedTables}
            onSelectTable={setSelectedTables}
            newTables={newTables}
            onChangeNewTables={setNewTables}
          />
        </div>
      </div>

      {/* Toggle Sidebar */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="shrink-0 flex items-center justify-center w-5 bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-800 transition-colors"
        title={sidebarOpen ? 'Fechar painel' : 'Abrir seletor de tabelas'}
      >
        {sidebarOpen ? (
          <ChevronLeft className="w-3 h-3 text-neutral-400" />
        ) : (
          <ChevronRight className="w-3 h-3 text-neutral-400" />
        )}
      </button>

      {/* Chat Area */}
      <div className="flex-grow flex flex-col min-w-0">
        {/* Header no modo Chat */}
        {onClose && (
          <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/50">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white text-sm font-bold transition-colors"
            >
              ← Voltar ao Studio
            </button>
            <span className="text-neutral-300 dark:text-neutral-700">/</span>
            <span className="flex items-center gap-1.5 text-sm font-bold text-violet-600 dark:text-violet-400">
              <Sparkles className="w-3.5 h-3.5" /> Editando: {initialView?.name}
            </span>
          </div>
        )}

        {/* Context pills */}
        {(selectedTables.length > 0 || newTables.length > 0) && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-violet-50 dark:bg-violet-500/5 shrink-0 flex-wrap">
            <span className="text-xs font-bold text-violet-600 dark:text-violet-400">Contexto:</span>
            {selectedTables.map((t) => (
              <span key={t.id} className="px-2 py-0.5 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 rounded-full text-xs font-medium">
                📋 {t.db_table_name}
              </span>
            ))}
            {newTables.map((t, i) => (
              <span key={i} className="px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium">
                ✨ {t} (nova)
              </span>
            ))}
          </div>
        )}

        {/* Banner Ir para Revisão */}
        {reviewData && !showReview && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/50 p-3 flex items-center justify-between shrink-0">
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Você tem um código gerado pronto para revisão.</span>
            <button
              onClick={() => setShowReview(true)}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-2"
            >
              Ir para Revisão
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <AIBuilderMessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-950/50">
          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 py-1 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 rounded-full text-xs">
                  <Paperclip className="w-3 h-3" />
                  {a.name}
                  <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}>
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-3">
            <div className="flex-grow relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Descreva o caso de uso que você quer gerar... (Ctrl+Enter para enviar)"
                rows={3}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
              />
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".txt,.md,.pdf,.docx"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-500 transition-colors"
                title="Anexar arquivo"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="w-10 h-10 flex items-center justify-center bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-lg shadow-violet-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <p className="text-xs text-neutral-400 mt-2 text-center">
            Ctrl+Enter para enviar • Quando a IA gerar o código, uma tela de revisão será aberta automaticamente
          </p>
        </div>
      </div>
    </div>
  )
}
