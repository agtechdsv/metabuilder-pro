import type { AppAST } from '../ast'

/**
 * "Isto ajudou?" no app exportado.
 *
 * As páginas geradas trazem, dentro do balão da ajuda, um marcador <HelpFeedback ... /> (ver helpIconJsx).
 * No fim da geração, `finalizeHelpFeedback` decide:
 *   - app Node com PostgreSQL: liga o marcador ao componente e cria a rota /api/help-feedback, que grava na tabela
 *     mb_help_feedback do próprio banco do app (a mesma que o Studio lê pelo Agente CLI, então os votos aparecem no painel);
 *   - qualquer outro caso (Oracle, MySQL, SQL Server, Supabase, front Java): remove os marcadores e a ajuda continua só leitura.
 * O código gerado evita crases e ${} para não precisar de escapes.
 */

export const HELP_FEEDBACK_MARKER_OPEN = '<HelpFeedback'
const MARKER_RE = /<HelpFeedback\b[^>]*\/>/g

const COMPONENT = `'use client'
// ARQUIVO GERADO pelo MetaBuilder — "Isto ajudou?" dentro do balão da ajuda.
import { useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'

type Zone = 'filter' | 'grid' | 'form' | 'screen'
type FeedbackState = 'idle' | 'comment' | 'sending' | 'done' | 'error'

export function HelpFeedback({ field, screen, zone }: { field?: string; screen?: string; zone: Zone }) {
  const [state, setState] = useState<FeedbackState>('idle')
  const [lastVote, setLastVote] = useState<'up' | 'down'>('down')
  const [comment, setComment] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const send = async (vote: 'up' | 'down', text?: string) => {
    setLastVote(vote)
    setState('sending')
    try {
      const res = await fetch('/api/help-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, screen, zone, vote, comment: text || undefined }),
      })
      if (res.ok) { setState('done'); return }
      const body = await res.json().catch(() => null)
      setErrorMsg(typeof body?.error === 'string' ? body.error : '')
      setState('error')
    } catch {
      setErrorMsg('')
      setState('error')
    }
  }

  const errorLine = state === 'error'
    ? <span className="block text-red-500">Não foi possível enviar agora.{errorMsg ? ' (' + errorMsg + ')' : ''}</span>
    : null

  return (
    <span className="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 block text-[11px] text-neutral-500">
      {state === 'done' ? (
        <span>Obrigado pelo retorno!</span>
      ) : state === 'comment' || (lastVote === 'down' && (state === 'sending' || state === 'error')) ? (
        <span className="block space-y-2">
          <span className="block">O que faltou? (opcional)</span>
          <textarea
            value={comment}
            maxLength={500}
            rows={2}
            onChange={e => setComment(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-2 py-1 text-xs outline-none focus:border-indigo-500"
          />
          {errorLine}
          <button
            type="button"
            disabled={state === 'sending'}
            onClick={() => send('down', comment.trim())}
            className="rounded-lg bg-indigo-600 px-3 py-1 text-[11px] font-bold text-white disabled:opacity-50"
          >
            Enviar
          </button>
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <span className="flex-1">Isto ajudou?{errorLine}</span>
          <button type="button" aria-label="Sim" title="Sim" onClick={() => send('up')} className="p-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-600">
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" aria-label="Não" title="Não" onClick={() => setState('comment')} className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600">
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </span>
      )}
    </span>
  )
}
`

function routeSource(authOn: boolean): string {
  return `// ARQUIVO GERADO pelo MetaBuilder — grava o "Isto ajudou?" da ajuda na tabela mb_help_feedback do banco do app.
import { NextResponse } from 'next/server'
import { query } from '@/app/actions/db'
${authOn ? "import { getSessionUser } from '@/lib/session-server'\n" : ''}
export const dynamic = 'force-dynamic'

const ZONES = ['filter', 'grid', 'form', 'screen']
const SAFE_ID = /^[\\w\\-.:]+$/

// no máximo 20 votos por minuto por pessoa
const hits = new Map<string, number[]>()
function allow(key: string): boolean {
  const now = Date.now()
  const list = (hits.get(key) || []).filter(t => now - t < 60000)
  if (list.length >= 20) { hits.set(key, list); return false }
  list.push(now)
  hits.set(key, list)
  return true
}

const rowsOf = (r: any): any[] => r?.rows || (Array.isArray(r) ? r : [])

const CREATE_SQL = 'CREATE TABLE IF NOT EXISTS mb_help_feedback (' +
  'id BIGSERIAL PRIMARY KEY, screen_id TEXT, field_id TEXT, zone TEXT, ' +
  'vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)), comment TEXT, user_ref TEXT, language TEXT, ' +
  'created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())'

let ready = false
let hasZone = true
async function ensureTable() {
  if (ready) return
  await query(CREATE_SQL)
  try {
    await query('ALTER TABLE mb_help_feedback ADD COLUMN IF NOT EXISTS zone TEXT')
    hasZone = true
  } catch {
    const col = rowsOf(await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'mb_help_feedback' AND column_name = 'zone' AND table_schema = current_schema()"))
    hasZone = col.length > 0
  }
  try { await query('CREATE INDEX IF NOT EXISTS idx_mb_help_feedback_target ON mb_help_feedback (screen_id, field_id, created_at DESC)') } catch { /* só desempenho */ }
  ready = true
}

export async function POST(request: Request) {
  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }
${authOn ? `  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 })
  const userRef = String(user.email || '').slice(0, 120) || null` : '  const userRef = null as string | null'}

  const vote = body?.vote === 'up' ? 1 : body?.vote === 'down' ? -1 : 0
  if (!vote) return NextResponse.json({ error: 'Voto inválido.' }, { status: 400 })
  const id = (v: unknown): string | null | undefined => {
    if (v === undefined || v === null || v === '') return null
    if (typeof v !== 'string' || v.length > 120 || !SAFE_ID.test(v)) return undefined
    return v
  }
  const screen = id(body?.screen)
  const field = id(body?.field)
  if (screen === undefined || field === undefined) return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 })
  if (!screen && !field) return NextResponse.json({ error: 'Informe a tela ou o campo.' }, { status: 400 })
  const zone = ZONES.includes(body?.zone) ? body.zone : null
  const comment = typeof body?.comment === 'string' ? body.comment.trim().slice(0, 500) || null : null

  if (!allow(userRef || 'anon')) return NextResponse.json({ error: 'Muitos envios. Aguarde um instante.' }, { status: 429 })

  try {
    await ensureTable()
    if (hasZone) {
      await query(
        'INSERT INTO mb_help_feedback (screen_id, field_id, zone, vote, comment, user_ref, language) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [screen, field, zone, vote, comment, userRef, 'pt'],
      )
    } else {
      await query(
        'INSERT INTO mb_help_feedback (screen_id, field_id, vote, comment, user_ref, language) VALUES ($1, $2, $3, $4, $5, $6)',
        [screen, field, vote, comment, userRef, 'pt'],
      )
    }
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[help-feedback] erro:', error?.message)
    return NextResponse.json({ error: 'Não foi possível gravar o feedback.' }, { status: 500 })
  }
}
`
}

/** Liga (Node + PostgreSQL) ou remove os marcadores de feedback. Chamar depois de todas as camadas, sobre os arquivos finais. */
export function finalizeHelpFeedback(ast: AppAST, files: Map<string, string>, enabled: boolean): void {
  const withMarker: string[] = []
  for (const [path, content] of files) {
    if (typeof content === 'string' && content.includes(HELP_FEEDBACK_MARKER_OPEN)) withMarker.push(path)
  }
  if (withMarker.length === 0) return

  if (!enabled) {
    for (const path of withMarker) files.set(path, files.get(path)!.replace(MARKER_RE, ''))
    return
  }

  const imp = "import { HelpFeedback } from '@/components/HelpFeedback'\n"
  for (const path of withMarker) {
    const content = files.get(path)!
    if (content.includes(imp)) continue
    const head = content.match(/^((?:\/\/[^\n]*\n)*)((?:'use client'|"use client"|'use server'|"use server");?\r?\n)?/)
    const at = head ? head[0].length : 0
    files.set(path, content.slice(0, at) + imp + content.slice(at))
  }
  files.set('components/HelpFeedback.tsx', COMPONENT)
  const authOn = !!ast.authConfig && ast.authConfig.authType !== 'none'
  files.set('app/api/help-feedback/route.ts', routeSource(authOn))
}
