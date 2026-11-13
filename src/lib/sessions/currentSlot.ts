import { cookies, headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { DEVICE_COOKIE, SLOT_COOKIE, sessionIdFromJwt, signSlotCookie, slotSecret, type SlotInput } from './slotCore'
import { buildSlotInput } from './slotService'

/** A sessão desta requisição (páginas, ações e rotas do servidor): quem é, qual sessão e de qual dispositivo. */
export interface CurrentSlot {
  user: { id: string; email: string }
  input: SlotInput
  isNewDevice: boolean
}

export async function currentSlot(): Promise<CurrentSlot | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: { session } } = await supabase.auth.getSession()
  const cookieStore = await cookies()
  const h = await headers()
  const built = await buildSlotInput({
    userId: user.id,
    accessToken: session?.access_token,
    cookie: n => cookieStore.get(n)?.value,
    header: n => h.get(n),
  })
  if (!built) return null
  return { user: { id: user.id, email: user.email || '' }, input: built.input, isNewDevice: built.isNewDevice }
}

const cookieDomain = () => (process.env.NODE_ENV === 'production' ? '.metabuilderpro.com' : undefined)

/** Grava os cookies da vaga (dispositivo e conferência) numa ação ou rota do servidor. */
export async function writeSlotCookies(slot: CurrentSlot, ttlSeconds: number): Promise<void> {
  const secret = slotSecret()
  const store = await cookies()
  const base = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', domain: cookieDomain() }
  if (slot.isNewDevice) store.set(DEVICE_COOKIE, slot.input.deviceId, { ...base, maxAge: 60 * 60 * 24 * 365 })
  if (secret) {
    const claims = { sessionId: slot.input.sessionId, kind: slot.input.kind, deviceId: slot.input.deviceId }
    store.set(SLOT_COOKIE, await signSlotCookie(claims, Math.max(10, ttlSeconds || 60), secret), { ...base, maxAge: Math.max(10, ttlSeconds || 60) })
  }
}

/** Só o id da sessão atual (para o logout liberar a vaga). */
export async function currentSessionId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return sessionIdFromJwt(session?.access_token)
}
