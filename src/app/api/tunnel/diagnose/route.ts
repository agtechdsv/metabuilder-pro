import { NextRequest, NextResponse } from 'next/server'
import { authorizeProjectActor } from '@/lib/tunnel/authorize'
import { diagnoseTunnel } from '@/lib/tunnel/diagnose'
import { relayEnabled } from '@/lib/tunnel/server'
import { signingEnabled } from '@/lib/tunnel/commandSigning'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** POST /api/tunnel/diagnose { projectId } — só para quem é membro do projeto. Funciona com o relay ligado ou desligado. */
export async function POST(request: NextRequest) {
  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'bad_request' }, { status: 400 }) }
  const projectId = typeof body?.projectId === 'string' ? body.projectId : ''
  if (!projectId) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const actor = await authorizeProjectActor(request, projectId)
  if (!actor || actor.kind !== 'member') return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const result = await diagnoseTunnel(projectId)
  return NextResponse.json({ ...result, relay: relayEnabled(), sign: signingEnabled() })
}
