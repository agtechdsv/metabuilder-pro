import { NextRequest, NextResponse } from 'next/server'
import { clearEndUserCookies } from '@/lib/tunnel/loginRoute'

export const dynamic = 'force-dynamic'

/** POST /api/runtime/logout  { projectId } — apaga a sessão assinada (que o navegador não consegue apagar sozinho: é httpOnly). */
export async function POST(request: NextRequest) {
  let body: any = {}
  try { body = await request.json() } catch { /* sem corpo */ }
  const projectId = typeof body?.projectId === 'string' ? body.projectId : ''
  if (!projectId) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const res = NextResponse.json({ ok: true })
  clearEndUserCookies(res, projectId)
  return res
}
