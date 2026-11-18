'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { MAX_ASAAS_APPS, MAX_ASAAS_APP_NAME, parseAsaasApps, type AsaasAppsSettings } from '../../../supabase/functions/_shared/asaasApps'

export type AsaasAppsErrorCode = 'not_authorized' | 'invalid_apps' | 'unknown'

/** Quem age vem da SESSÃO. Só o SuperAdmin mexe nos apps cadastrados da conta do Asaas. */
async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('not_authorized')
  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  if (!profile?.is_super_admin) throw new Error('not_authorized')
  return { admin: createAdminClient(), user }
}

/** Apps que usam a mesma conta do Asaas (cadastrados pelo nome da chave de API). */
export async function getAsaasApps(): Promise<{ success: true; settings: AsaasAppsSettings } | { success: false; code: AsaasAppsErrorCode }> {
  try {
    const { admin } = await requireSuperAdmin()
    const { data } = await admin.from('platform_settings').select('value').eq('key', 'asaas_apps').maybeSingle()
    return { success: true, settings: parseAsaasApps(data?.value) }
  } catch (e) { return { success: false, code: (e as Error).message === 'not_authorized' ? 'not_authorized' : 'unknown' } }
}

export async function saveAsaasApps(input: AsaasAppsSettings): Promise<{ success: true } | { success: false; code: AsaasAppsErrorCode }> {
  try {
    const { admin, user } = await requireSuperAdmin()
    const apps = Array.isArray(input?.apps) ? input.apps : []
    // recusa o que o leitor descartaria sem avisar: nome vazio, longo demais, repetido ou passando do limite
    const names = apps.map(a => (typeof a?.name === 'string' ? a.name.trim() : ''))
    const keys = names.map(n => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())
    if (apps.length > MAX_ASAAS_APPS || names.some(n => !n || n.length > MAX_ASAAS_APP_NAME) || new Set(keys).size !== keys.length) return { success: false, code: 'invalid_apps' }
    const value = parseAsaasApps({ apps, otherKeyAlerts: input.otherKeyAlerts })
    const { error } = await admin.from('platform_settings').upsert(
      { key: 'asaas_apps', value, updated_at: new Date().toISOString(), updated_by: user.id },
      { onConflict: 'key' },
    )
    if (error) return { success: false, code: 'unknown' }
    revalidatePath('/admin/platform')
    return { success: true }
  } catch (e) { return { success: false, code: (e as Error).message === 'not_authorized' ? 'not_authorized' : 'unknown' } }
}
