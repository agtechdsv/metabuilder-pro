'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bot, Send, Paperclip, Loader2, X, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
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
}

export function AIBuilderChat({
  workspaceId,
  workspaceSlug,
  projectId,
  projectSlug,
  projectSecretToken,
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
    initSession()
  }, [projectId])

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

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))

        for (const line of lines) {
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
          } catch { /* ignora */ }
        }
      }

      // Verifica se a resposta é um JSON de geração de caso de uso
      let parsedJson: any = null
      try {
        const trimmed = fullContent.trim()
        if (trimmed.startsWith('{')) {
          parsedJson = JSON.parse(trimmed)
        }
      } catch { /* não é JSON */ }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? { ...m, content: fullContent, isStreaming: false }
            : m
        )
      )

      if (parsedJson?.component_code) {
        setReviewData(parsedJson)
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
        onBack={() => setShowReview(false)}
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
