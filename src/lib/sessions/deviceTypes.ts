import type { SlotErrorCode, SlotKind, SlotMode } from './slotCore'

/** Uma sessão (vaga) como aparece em "Meus dispositivos". */
export interface DeviceRowDto {
  id: string
  kind: SlotKind
  label: string | null
  city: string | null
  region: string | null
  country: string | null
  created_at: string
  last_seen_at: string
  revoked_at: string | null
  revoked_reason: string | null
  /** é a sessão que está usando esta tela */
  current: boolean
}

export interface DeviceSettingsDto {
  mode: SlotMode
  idleMinutes: number
  takeoverCap: number
  ttlSeconds: number
}

export const DEFAULT_DEVICE_SETTINGS: DeviceSettingsDto = { mode: 'off', idleMinutes: 15, takeoverCap: 3, ttlSeconds: 60 }

export interface AdminActiveDto extends Omit<DeviceRowDto, 'current'> {
  user_id: string
  email: string | null
  full_name: string | null
}

export interface AdminEventDto {
  id: number
  user_id: string
  email: string | null
  event: string
  kind: string | null
  label: string | null
  city: string | null
  region: string | null
  created_at: string
  meta: Record<string, unknown>
}

export interface AdminSwapperDto {
  user_id: string
  email: string | null
  takeovers: number
  caps: number
  conflicts: number
}

export interface AdminDeviceOverview {
  settings: DeviceSettingsDto
  active: AdminActiveDto[]
  events: AdminEventDto[]
  /** usuários com mais trocas e conflitos nos últimos 7 dias */
  swappers: AdminSwapperDto[]
  totals: { active: number; ide: number; web: number; takeovers7d: number; conflicts7d: number; caps7d: number }
}

export type DeviceErrorCode = SlotErrorCode | 'needs_code' | 'forbidden' | 'cannot_end_current' | 'invalid_settings'

export type DeviceActionResult<T extends object = object> = ({ success: true } & T) | { success: false; code: DeviceErrorCode; error?: string }
