import { NextResponse } from 'next/server'
import { currentSlot, writeSlotCookies } from '@/lib/sessions/currentSlot'
import { claimSlot } from '@/lib/sessions/slotService'

export const dynamic = 'force-dynamic'

/**
 * Batimento das vagas de sessão: o navegador e a IDE chamam a cada ~60 s e ao voltar o foco da aba.
 * Mantém a vaga viva (atividade) e avisa se esta sessão foi encerrada por outro login.
 * Respostas: anonymous | unknown | off | exempt | ok | claimed | occupied | revoked.
 */
export async function GET() {
  const slot = await currentSlot()
  if (!slot) return NextResponse.json({ status: 'anonymous' }, { headers: { 'Cache-Control': 'no-store' } })

  const result = await claimSlot(slot.input)
  if (!result) return NextResponse.json({ status: 'unknown' }, { headers: { 'Cache-Control': 'no-store' } })

  if (result.status !== 'occupied' && result.status !== 'revoked') {
    try { await writeSlotCookies(slot, result.ttl) } catch { /* o cookie é só um atalho; sem ele o próximo pedido vai ao banco */ }
  }
  return NextResponse.json(
    { status: result.status, mode: result.mode, other: result.other ?? null, by: result.by ?? null, reason: result.reason ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
