'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { currentSlot, writeSlotCookies, type CurrentSlot } from '@/lib/sessions/currentSlot'
import { slotAdminDb, takeOverSlot, type TakeOverOutcome } from '@/lib/sessions/slotService'
import {
  CODE_RESEND_SECONDS, CODE_TTL_MINUTES, MAX_CODE_ATTEMPTS, codeMatches, generateCode, hashCode, parseMode, placeText, slotSecret,
  type SlotOther,
} from '@/lib/sessions/slotCore'
import {
  DEFAULT_DEVICE_SETTINGS, type AdminActiveDto, type AdminDeviceOverview, type AdminEventDto, type AdminSwapperDto, type DeviceActionResult,
  type DeviceErrorCode, type DeviceRowDto, type DeviceSettingsDto,
} from '@/lib/sessions/deviceTypes'
import { resolveMailLang } from '@/lib/security/securityMailText'
import { sendSlotCodeEmail, sendSlotKickedEmail } from '@/lib/security/securityMail'
import { maskEmail } from '../../../supabase/functions/_shared/partnerCommission'

const fail = (code: DeviceErrorCode, error?: string): { success: false; code: DeviceErrorCode; error?: string } => ({ success: false, code, error })

async function mailLang() {
  return resolveMailLang((await cookies()).get('app-language')?.value)
}

// --- troca de dispositivo (tela "Você já está conectado em outro lugar") --------------------------------------------------------------

async function finishTakeOver(slot: CurrentSlot, out: TakeOverOutcome): Promise<DeviceActionResult> {
  if (!out.ok) return fail(out.code)
  await writeSlotCookies(slot, out.ttl)
  if (out.kicked) await notifyKicked(slot, out.kicked)
  return { success: true }
}

/** Avisa por e-mail o dono do login que a sessão dele foi encerrada (sem falhar a troca se o e-mail não sair). */
async function notifyKicked(slot: CurrentSlot, kicked: SlotOther) {
  try {
    await sendSlotKickedEmail(slot.user.email, await mailLang(), {
      kicked: { label: kicked.label, place: placeText(kicked), since: kicked.since },
      by: { label: slot.input.label, place: placeText(slot.input) },
      at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[vagas] aviso por e-mail falhou:', (e as Error)?.message)
  }
}

/** "Encerrar a outra sessão e entrar aqui". Se o usuário já trocou demais hoje, devolve `needs_code`. */
export async function takeOverSlotAction(): Promise<DeviceActionResult> {
  const slot = await currentSlot()
  if (!slot) return fail('not_authenticated')
  return finishTakeOver(slot, await takeOverSlot(slot.input, false))
}

/** Envia o código de 6 dígitos por e-mail (limite de trocas por dia). */
export async function requestTakeoverCodeAction(): Promise<DeviceActionResult<{ email: string }>> {
  const slot = await currentSlot()
  const db = slotAdminDb()
  const secret = slotSecret()
  if (!slot) return fail('not_authenticated')
  if (!db || !secret || !slot.user.email) return fail('unknown')

  const sid = slot.input.sessionId
  const { data: existing } = await db.from('mb_slot_challenges').select('created_at').eq('auth_session_id', sid).maybeSingle()
  if (existing && Date.now() - new Date(existing.created_at as string).getTime() < CODE_RESEND_SECONDS * 1000) return fail('too_soon')

  const code = generateCode()
  const { error } = await db.from('mb_slot_challenges').upsert({
    user_id: slot.user.id,
    auth_session_id: sid,
    code_hash: await hashCode(code, sid, secret),
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
    attempts: 0,
    created_at: new Date().toISOString(),
  }, { onConflict: 'auth_session_id' })
  if (error) return fail('unknown')

  const sent = await sendSlotCodeEmail(slot.user.email, await mailLang(), code, CODE_TTL_MINUTES)
  if (!sent) {
    await db.from('mb_slot_challenges').delete().eq('auth_session_id', sid)
    return fail('mail_failed')
  }
  await db.rpc('mb_device_log', {
    p_user: slot.user.id, p_event: 'code_sent', p_kind: slot.input.kind, p_device: slot.input.deviceId, p_session: sid,
    p_label: slot.input.label, p_city: slot.input.city, p_region: slot.input.region, p_country: slot.input.country, p_meta: {},
  })
  return { success: true, email: maskEmail(slot.user.email) }
}

/** Confere o código e, se estiver certo, faz a troca. */
export async function confirmTakeoverCodeAction(code: string): Promise<DeviceActionResult> {
  const slot = await currentSlot()
  const db = slotAdminDb()
  const secret = slotSecret()
  if (!slot) return fail('not_authenticated')
  if (!db || !secret) return fail('unknown')

  const sid = slot.input.sessionId
  const { data: row } = await db.from('mb_slot_challenges').select('code_hash, expires_at, attempts').eq('auth_session_id', sid).maybeSingle()
  if (!row) return fail('code_expired')
  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    await db.from('mb_slot_challenges').delete().eq('auth_session_id', sid)
    return fail('code_expired')
  }
  const attempts = Number(row.attempts) || 0
  if (attempts >= MAX_CODE_ATTEMPTS) {
    await db.from('mb_slot_challenges').delete().eq('auth_session_id', sid)
    return fail('too_many_attempts')
  }
  if (!(await codeMatches(code, sid, secret, row.code_hash as string))) {
    if (attempts + 1 >= MAX_CODE_ATTEMPTS) {
      await db.from('mb_slot_challenges').delete().eq('auth_session_id', sid)
      await db.rpc('mb_device_log', {
        p_user: slot.user.id, p_event: 'code_failed', p_kind: slot.input.kind, p_device: slot.input.deviceId, p_session: sid,
        p_label: slot.input.label, p_city: slot.input.city, p_region: slot.input.region, p_country: slot.input.country, p_meta: {},
      })
      return fail('too_many_attempts')
    }
    await db.from('mb_slot_challenges').update({ attempts: attempts + 1 }).eq('auth_session_id', sid)
    return fail('invalid_code')
  }
  await db.from('mb_slot_challenges').delete().eq('auth_session_id', sid)
  return finishTakeOver(slot, await takeOverSlot(slot.input, true))
}

// --- "Meus dispositivos" ----------------------------------------------------------------------------------------------------------------

const DEVICE_COLS = 'id, kind, label, city, region, country, created_at, last_seen_at, revoked_at, revoked_reason, auth_session_id'

export async function listMyDevicesAction(): Promise<DeviceActionResult<{ devices: DeviceRowDto[]; mode: DeviceSettingsDto['mode'] }>> {
  const slot = await currentSlot()
  const db = slotAdminDb()
  if (!slot) return fail('not_authenticated')
  if (!db) return fail('unknown')
  const [{ data }, settings] = await Promise.all([
    db.from('mb_device_sessions').select(DEVICE_COLS).eq('user_id', slot.user.id).order('created_at', { ascending: false }).limit(20),
    db.rpc('mb_device_settings'),
  ])
  const devices: DeviceRowDto[] = (data || []).map((r: any) => {
    const { auth_session_id, ...rest } = r
    return { ...rest, current: auth_session_id === slot.input.sessionId } as DeviceRowDto
  })
  return { success: true, devices, mode: parseMode((settings.data as { mode?: string } | null)?.mode) }
}

/** O usuário encerra uma de suas outras sessões. A atual sai pelo botão normal de sair. */
export async function endMyDeviceAction(id: string): Promise<DeviceActionResult> {
  const slot = await currentSlot()
  const db = slotAdminDb()
  if (!slot) return fail('not_authenticated')
  if (!db) return fail('unknown')
  const { data: row } = await db.from('mb_device_sessions').select('id, user_id, auth_session_id').eq('id', id).maybeSingle()
  if (!row || row.user_id !== slot.user.id) return fail('forbidden')
  if (row.auth_session_id === slot.input.sessionId) return fail('cannot_end_current')
  const { error } = await db.rpc('mb_revoke_device_session', { p_id: id, p_reason: 'user' })
  return error ? fail('unknown') : { success: true }
}

// --- SuperAdmin -------------------------------------------------------------------------------------------------------------------------

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const db = slotAdminDb()
  if (!user || !db) return null
  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  return profile?.is_super_admin ? { db, userId: user.id } : null
}

const SETTING_ROWS = (s: DeviceSettingsDto) => [
  { key: 'device_slot_mode', value: { mode: s.mode } },
  { key: 'device_idle_minutes', value: { minutes: s.idleMinutes } },
  { key: 'device_takeover_daily_cap', value: { count: s.takeoverCap } },
  { key: 'device_check_ttl_seconds', value: { seconds: s.ttlSeconds } },
]

function validSettings(s: DeviceSettingsDto): boolean {
  const inRange = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max
  return ['off', 'observe', 'enforce'].includes(s.mode) && inRange(s.idleMinutes, 1, 1440) && inRange(s.takeoverCap, 1, 50) && inRange(s.ttlSeconds, 10, 600)
}

export async function adminDeviceOverviewAction(): Promise<DeviceActionResult<{ overview: AdminDeviceOverview }>> {
  const ctx = await requireSuperAdmin()
  if (!ctx) return fail('forbidden')
  const { db } = ctx
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [settingsRes, activeRes, eventsRes] = await Promise.all([
    db.rpc('mb_device_settings'),
    db.from('mb_device_sessions').select(DEVICE_COLS + ', user_id').is('revoked_at', null).order('last_seen_at', { ascending: false }).limit(300),
    db.from('mb_device_events').select('id, user_id, event, kind, label, city, region, created_at, meta')
      .in('event', ['takeover', 'conflict', 'cap_reached', 'code_failed']).gte('created_at', since).order('created_at', { ascending: false }).limit(400),
  ])
  const s = (settingsRes.data || {}) as { mode?: string; idle?: number; cap?: number; ttl?: number }
  const settings: DeviceSettingsDto = {
    mode: parseMode(s.mode),
    idleMinutes: Number(s.idle) || DEFAULT_DEVICE_SETTINGS.idleMinutes,
    takeoverCap: Number(s.cap) || DEFAULT_DEVICE_SETTINGS.takeoverCap,
    ttlSeconds: Number(s.ttl) || DEFAULT_DEVICE_SETTINGS.ttlSeconds,
  }

  const activeRows = (activeRes.data || []) as any[]
  const eventRows = (eventsRes.data || []) as any[]
  const ids = [...new Set([...activeRows.map(r => r.user_id), ...eventRows.map(r => r.user_id)])] as string[]
  const profiles = ids.length ? (await db.from('profiles').select('id, email, full_name').in('id', ids)).data || [] : []
  const byId = new Map<string, { email: string | null; full_name: string | null }>(profiles.map((p: any) => [p.id as string, { email: p.email ?? null, full_name: p.full_name ?? null }]))

  const active: AdminActiveDto[] = activeRows.map(({ auth_session_id: _drop, ...r }) => ({
    ...r, email: byId.get(r.user_id)?.email ?? null, full_name: byId.get(r.user_id)?.full_name ?? null,
  }))
  const events: AdminEventDto[] = eventRows.map(r => ({ ...r, email: byId.get(r.user_id)?.email ?? null, meta: (r.meta || {}) as Record<string, unknown> }))

  const swap = new Map<string, AdminSwapperDto>()
  for (const e of events) {
    const row = swap.get(e.user_id) ?? { user_id: e.user_id, email: e.email, takeovers: 0, caps: 0, conflicts: 0 }
    if (e.event === 'takeover') row.takeovers++
    else if (e.event === 'cap_reached') row.caps++
    else if (e.event === 'conflict') row.conflicts++
    swap.set(e.user_id, row)
  }
  const swappers = [...swap.values()].filter(r => r.takeovers + r.caps + r.conflicts > 0)
    .sort((a, b) => (b.caps - a.caps) || (b.takeovers + b.conflicts) - (a.takeovers + a.conflicts)).slice(0, 20)

  return {
    success: true,
    overview: {
      settings,
      active,
      events: events.slice(0, 100),
      swappers,
      totals: {
        active: active.length,
        ide: active.filter(a => a.kind === 'ide').length,
        web: active.filter(a => a.kind === 'web').length,
        takeovers7d: events.filter(e => e.event === 'takeover').length,
        conflicts7d: events.filter(e => e.event === 'conflict').length,
        caps7d: events.filter(e => e.event === 'cap_reached').length,
      },
    },
  }
}

export async function adminSaveDeviceSettingsAction(input: DeviceSettingsDto): Promise<DeviceActionResult> {
  const ctx = await requireSuperAdmin()
  if (!ctx) return fail('forbidden')
  if (!validSettings(input)) return fail('invalid_settings')
  const now = new Date().toISOString()
  const { error } = await ctx.db.from('platform_settings').upsert(
    SETTING_ROWS(input).map(r => ({ ...r, updated_at: now, updated_by: ctx.userId })), { onConflict: 'key' },
  )
  return error ? fail('unknown', error.message) : { success: true }
}

export async function adminRevokeDeviceAction(id: string): Promise<DeviceActionResult> {
  const ctx = await requireSuperAdmin()
  if (!ctx) return fail('forbidden')
  const { error } = await ctx.db.rpc('mb_revoke_device_session', { p_id: id, p_reason: 'admin' })
  return error ? fail('unknown', error.message) : { success: true }
}
