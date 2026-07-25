import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// POST — Envia mensagem para a IA e responde em streaming (SSE)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { session_id, message, workspace_id, project_id, tables_context, new_tables } = await req.json()
  if (!session_id || !message || !workspace_id) {
    return NextResponse.json({ error: 'session_id, message e workspace_id são obrigatórios' }, { status: 400 })
  }

  // Verifica PRO
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

  if (profile?.subscription_tier !== 'pro') {
    return NextResponse.json({ error: 'Este recurso é exclusivo do plano PRO.' }, { status: 403 })
  }

  // Busca a config de IA (usando service role para ler a chave)
  const { createClient: createAdmin } = await import('@supabase/supabase-js')
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: aiConfig } = await admin
    .from('ai_builder_configs')
    .select('*')
    .eq('workspace_id', workspace_id)
    .maybeSingle()

  if (!aiConfig) {
    return NextResponse.json({ error: 'Nenhuma chave de IA configurada para este workspace.' }, { status: 400 })
  }

  // Busca histórico de mensagens da sessão
  const { data: history } = await admin
    .from('ai_builder_messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true })
    .limit(20)

  // Monta o System Prompt inteligente
  let tablesContextStr = ''
  if (tables_context && tables_context.length > 0) {
    tablesContextStr = '\n\nTABELAS EXISTENTES SELECIONADAS PELO USUÁRIO:\n'
    for (const table of tables_context) {
      tablesContextStr += `\n- Tabela: ${table.name}\n  Colunas: ${table.columns.map((c: any) => `${c.column_name} (${c.data_type})`).join(', ')}`
    }
  }

  let newTablesStr = ''
  if (new_tables && new_tables.length > 0) {
    newTablesStr = '\n\nNOVAS TABELAS QUE DEVEM SER CRIADAS:\n'
    newTablesStr += new_tables.map((t: string) => `- ${t}`).join('\n')
  }

  const systemPrompt = `Você é um gerador especializado de casos de uso para o MetaBuilder PRO.

STACK DO PROJETO:
- Framework: Next.js 16.2 com App Router e TypeScript
- Banco de dados: Supabase (PostgreSQL) com RLS habilitado
- Estilo: Vanilla CSS + CSS Variables (SEM TailwindCSS, SEM Tailwind classes)
- Contextos disponíveis: useI18n(), useToast(), createClient() do '@/utils/supabase/client', e a constante global PROJECT_ID (string)
- Ícones: Lucide React
- Componentes UI disponíveis: Modal de '@/components/ui/Modal', Toast de '@/components/ui/Toast'
- O componente deve ser um 'use client' React funcional exportado como default
${tablesContextStr}${newTablesStr}

REGRAS OBRIGATÓRIAS DE RESPOSTA:
Quando o usuário pedir para GERAR o caso de uso (e não apenas conversar), você DEVE retornar APENAS o seguinte JSON válido (sem markdown, sem explicações fora do JSON):
{
  "use_case_name": "Nome do Caso de Uso",
  "use_case_slug": "slug-em-kebab-case",
  "component_code": "código TSX completo do componente React como string",
  "new_migrations": ["CREATE TABLE sql1...", "CREATE TABLE sql2..."],
  "suggested_navigation": "menu_item",
  "description": "Breve descrição do que foi gerado"
}

IMPORTANTE SOBRE RLS: Todas as tabelas do usuário possuem a coluna 'project_id'. Para que o componente consiga ler ou gravar dados, você DEVE incluir o filtro .eq('project_id', PROJECT_ID) em todas as consultas SELECT, UPDATE e DELETE, e incluir { project_id: PROJECT_ID } nos INSERTs. A constante PROJECT_ID é injetada globalmente no sandbox.

Se o usuário estiver apenas conversando, fazendo perguntas ou refinando requisitos, responda normalmente em texto, sem JSON.

NUNCA retorne texto fora do JSON quando for gerar. NUNCA use markdown fences (\`\`\`).`

  // Salva a mensagem do usuário
  await admin.from('ai_builder_messages').insert({
    session_id,
    role: 'user',
    content: message,
  })

  // Monta os messages para a API da IA
  const messages = [
    ...(history || []).map((h: any) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ]

  // Chama a IA do usuário
  const { provider, api_key_enc, model, base_url } = aiConfig

  let aiResponse: Response

  try {
    if (provider === 'openai' || provider === 'custom') {
      const endpoint = base_url ? `${base_url}/chat/completions` : 'https://api.openai.com/v1/chat/completions'
      aiResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api_key_enc}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o',
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          stream: true,
        }),
      })
    } else if (provider === 'anthropic') {
      aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': api_key_enc,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || 'claude-opus-4-5',
          max_tokens: 8192,
          system: systemPrompt,
          messages,
          stream: true,
        }),
      })
    } else if (provider === 'gemini') {
      const geminiModel = model || 'gemini-2.0-flash'
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${api_key_enc}`
      aiResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: messages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
        }),
      })
    } else {
      return NextResponse.json({ error: `Provedor '${provider}' não suportado.` }, { status: 400 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Falha ao conectar com a IA: ${err.message}` }, { status: 502 })
  }

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text()
    return NextResponse.json({ error: `Erro da IA (${aiResponse.status}): ${errorText}` }, { status: 502 })
  }

  // Faz o streaming de volta para o frontend e coleta a resposta completa para salvar
  const encoder = new TextEncoder()
  let fullAssistantResponse = ''

  const stream = new ReadableStream({
    async start(controller) {
      const reader = aiResponse.body!.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))

          for (const line of lines) {
            const data = line.replace('data: ', '').trim()
            if (data === '[DONE]') continue
            if (!data) continue

            try {
              const parsed = JSON.parse(data)
              let textDelta = ''

              if (provider === 'openai' || provider === 'custom') {
                textDelta = parsed.choices?.[0]?.delta?.content || ''
              } else if (provider === 'anthropic') {
                if (parsed.type === 'content_block_delta') {
                  textDelta = parsed.delta?.text || ''
                }
              } else if (provider === 'gemini') {
                textDelta = parsed.candidates?.[0]?.content?.parts?.[0]?.text || ''
              }

              if (textDelta) {
                fullAssistantResponse += textDelta
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: textDelta })}\n\n`))
              }
            } catch {
              // ignora chunks inválidos
            }
          }
        }
      } finally {
        // Salva a resposta completa no banco
        if (fullAssistantResponse) {
          await admin.from('ai_builder_messages').insert({
            session_id,
            role: 'assistant',
            content: fullAssistantResponse,
          })
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
