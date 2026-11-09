import type { SupabaseClient } from '@supabase/supabase-js'

/** Campanha de preço (ex.: Black November). A tabela e as regras estão em scripts/iclub-campanhas.sql; o cálculo, em supabase/functions/_shared/pricing.ts. */
export interface PricingCampaign {
  id: string
  name: Record<string, string> | string
  headline: Record<string, string> | string
  /** % da tabela cobrado por licença nos meses da campanha (50 = metade) */
  discount_percent: number
  months: number
  starts_at: string
  ends_at: string
  is_active?: boolean
  allowed_emails?: string[]
}

/** Texto no idioma da pessoa (pt, en, es), com pt como reserva. */
export function localizedText(value: Record<string, string> | string | null | undefined, language: string): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value[language] || value.pt || value.en || value.es || ''
}

/** "% de desconto" que a campanha representa (cobra 50% da tabela = 50% de desconto). */
export const campaignOffPercent = (c: Pick<PricingCampaign, 'discount_percent'>): number => Math.round((100 - Number(c.discount_percent)) * 100) / 100

/** Tempo que falta até o fim da campanha, em partes (dias, horas, minutos). */
export function campaignTimeLeft(endsAt: string | Date, now: number = Date.now()): { ms: number; days: number; hours: number; minutes: number } {
  const ms = Math.max(0, new Date(endsAt).getTime() - now)
  const total = Math.floor(ms / 60_000)
  return { ms, days: Math.floor(total / 1440), hours: Math.floor((total % 1440) / 60), minutes: total % 60 }
}

/** Campanha vigente que esta pessoa pode ver (a regra de segurança do banco já esconde as restritas a outros e-mails). Sem campanha, null. */
export async function fetchActiveCampaign(supabase: SupabaseClient): Promise<PricingCampaign | null> {
  try {
    const iso = new Date().toISOString()
    const { data, error } = await supabase
      .from('pricing_campaigns')
      .select('id, name, headline, discount_percent, months, starts_at, ends_at')
      .eq('is_active', true)
      .lte('starts_at', iso)
      .gte('ends_at', iso)
      .order('created_at', { ascending: false })
      .limit(1)
    if (error || !data?.length) return null
    return data[0] as PricingCampaign
  } catch { return null }
}
