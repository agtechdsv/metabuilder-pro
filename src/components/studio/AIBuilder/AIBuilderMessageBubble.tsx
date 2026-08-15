'use client'

import { Bot, User, Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  isStreaming?: boolean
  parsedSuccessfully?: boolean
}

interface AIBuilderMessageBubbleProps {
  message: Message
}

// Markdown muito simples — negrito, inline code e quebras de linha
function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        // Título H3 ##
        if (line.startsWith('### ')) {
          return (
            <p key={i} className="font-black text-sm mt-2">
              {line.replace('### ', '')}
            </p>
          )
        }
        // Título H2 ##
        if (line.startsWith('## ')) {
          return (
            <p key={i} className="font-black text-base mt-3">
              {line.replace('## ', '')}
            </p>
          )
        }
        // Lista com -
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current shrink-0 opacity-60" />
              <InlineText text={line.replace(/^[-*] /, '')} />
            </div>
          )
        }
        // Linha vazia
        if (!line.trim()) return <br key={i} />
        // Parágrafo normal
        return <p key={i}><InlineText text={line} /></p>
      })}
    </div>
  )
}

function InlineText({ text }: { text: string }) {
  // Processa **negrito** e `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="px-1 py-0.5 bg-black/10 dark:bg-white/10 rounded text-xs font-mono">
              {part.slice(1, -1)}
            </code>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export function AIBuilderMessageBubble({ message }: AIBuilderMessageBubbleProps) {
  const { t } = useI18n()
  const isUser = message.role === 'user'
  const isJson = message.parsedSuccessfully === true
  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
        isUser
          ? 'bg-indigo-600 text-white'
          : 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white'
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isUser
          ? 'bg-indigo-600 text-white rounded-tr-sm'
          : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-white rounded-tl-sm border border-neutral-200 dark:border-neutral-800'
      }`}>
        {message.isStreaming && !message.content ? (
          <div className="flex items-center gap-2 text-neutral-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="text-xs">{t('ai_builder.generating', 'Gerando...')}</span>
          </div>
        ) : isJson ? (
          <div className="text-xs text-neutral-500 dark:text-neutral-400 italic">
            {t('ai_builder.code_generated_success', '✅ Código gerado! A tela de revisão foi aberta automaticamente.')}
          </div>
        ) : (
          <SimpleMarkdown text={message.content} />
        )}
        {message.isStreaming && message.content && (
          <span className="inline-block w-1 h-4 bg-violet-500 animate-pulse ml-0.5 align-middle" />
        )}
      </div>
    </div>
  )
}
