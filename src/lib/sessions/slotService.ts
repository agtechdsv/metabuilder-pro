import { createClient } from '@supabase/supabase-js'
import {
  DEVICE_COOKIE, KIND_COOKIE, clientIp, describeClient, geoFromHeaders, hashIp, isUuid, parseKind, sessionIdFromJwt, slotSecret,
  type SlotInput, type SlotOther, type SlotResult,
} from './slotCore'

/**
 * Fala com o banco (funções mb_* de scripts/sessoes-dispositivos.sql). Só roda no servidor: usa a chave de serviço.
 * Qualquer falha devolve null e o chamador deixa o usuário passar: nunca travamos alguém por erro nosso.
 */
function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

const args = (i: SlotInput) => ({
  p_user: i.userId, p_kind: i.kind, p_device: i.deviceId, p_session: i.sessionId, p_label: i.label,
  p_city: i.city, p_region: i.region, p_country: i.country, p_ip_hash: i.ipHash,
})

const isResult = (d: unknown): d is SlotResult => !!d && typeof d === 'object' && typeof (d as SlotResult).status === 'string'

export interface BuiltSlotInput {
  input: SlotInput
  /** o navegador ainda não tinha o cookie do dispositivo: o chamador precisa gravá-lo */
  isNewDevice: boolean
}

/** Junta tudo que a vaga precisa saber desta requisição. Devolve null se não der para identificar a sessão. */
export async function buildSlotInput(a: {
  userId: string
  accessToken: string | null | undefined
  cookie: (name: string) => string | null | undefined
  header: (name: string) => string | null | undefined
}): Promise<BuiltSlotInput | null> {
  const sessionId = sessionIdFromJwt(a.accessToken)
  if (!sessionId || !a.userId) return null
  const existing = a.cookie(DEVICE_COOKIE)
  const isNewDevice = !isUuid(existing)
  const deviceId = isNewDevice ? crypto.randomUUID() : (existing as string)
  const kind = parseKind(a.cookie(KIND_COOKIE))
  const geo = geoFromHeaders(a.header)
  return {
    isNewDevice,
    input: {
      userId: a.userId,
      kind,
      deviceId,
      sessionId,
      label: describeClient(a.header('user-agent'), kind),
      city: geo.city,
      region: geo.region,
      country: geo.country,
      ipHash: await hashIp(clientIp(a.header), slotSecret()),
    },
  }
}

/** Tenta ocupar a vaga (ou renova a que já é desta sessão). */
export async function claimSlot(input: SlotInput): Promise<SlotResult | null> {
  const db = adminDb()
  if (!db) return null
  try {
    const { data, error } = await db.rpc('mb_claim_device_slot', args(input))
    if (error) { console.error('[vagas] mb_claim_device_slot:', error.message); return null }
    return isResult(data) ? data : null
  } catch (e) {
    console.error('[vagas] falha ao conferir a vaga:', (e as Error)?.message)
    return null
  }
}

export type TakeOverOutcome =
  | { ok: true; status: 'ok' | 'claimed'; ttl: number; kicked?: SlotOther }
  | { ok: false; code: 'needs_code'; count: number; cap: number }
  | { ok: false; code: 'session_revoked' | 'unknown' }

/** O usuário escolheu "encerrar a outra e entrar aqui". `confirmed` = já provou o código do e-mail. */
export async function takeOverSlot(input: SlotInput, confirmed: boolean): Promise<TakeOverOutcome> {
  const db = adminDb()
  if (!db) return { ok: false, code: 'unknown' }
  try {
    const { data, error } = await db.rpc('mb_take_over_slot', { ...args(input), p_confirmed: confirmed })
    if (error) {
      if (String(error.message).includes('session_revoked')) return { ok: false, code: 'session_revoked' }
      console.error('[vagas] mb_take_over_slot:', error.message)
      return { ok: false, code: 'unknown' }
    }
    const d = data as { status?: string; ttl?: number; kicked?: SlotOther; count?: number; cap?: number } | null
    if (d?.status === 'needs_code') return { ok: false, code: 'needs_code', count: Number(d.count ?? 0), cap: Number(d.cap ?? 0) }
    if (d?.status === 'ok' || d?.status === 'claimed') {
      // limpa, sem esperar, as sessões do Supabase Auth das vagas encerradas há mais de 15 minutos
      void db.rpc('mb_purge_revoked_auth_sessions', { p_minutes: 15 }).then(() => undefined, () => undefined)
      return { ok: true, status: d.status, ttl: Number(d.ttl ?? 60), kicked: d.kicked }
    }
    return { ok: false, code: 'unknown' }
  } catch (e) {
    console.error('[vagas] falha na troca de vaga:', (e as Error)?.message)
    return { ok: false, code: 'unknown' }
  }
}

/** Logout libera a vaga na hora (sem falhar o logout se o banco não responder). */
export async function releaseSlot(sessionId: string | null, reason: 'logout' | 'user' | 'admin' = 'logout'): Promise<void> {
  if (!sessionId) return
  const db = adminDb()
  if (!db) return
  try {
    await db.rpc('mb_release_device_slot', { p_session: sessionId, p_reason: reason })
  } catch (e) {
    console.error('[vagas] falha ao liberar a vaga:', (e as Error)?.message)
  }
}

export { adminDb as slotAdminDb }
