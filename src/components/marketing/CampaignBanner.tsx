'use client'

import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { createClient } from '@/utils/supabase/client'
import { campaignOffPercent, campaignTimeLeft, fetchActiveCampaign, localizedText, type PricingCampaign } from '@/lib/campaigns'

const P = 'campaign.'

/** "2d 5h", "5h 20min" ou "12min": quanto falta para a campanha acabar. */
export function formatTimeLeft(endsAt: string, now: number = Date.now()): string {
  const { days, hours, minutes } = campaignTimeLeft(endsAt, now)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}min`
  return `${Math.max(1, minutes)}min`
}

/** Faixa da campanha: chamada, desconto e contagem regressiva. Não aparece se não houver campanha vigente. */
export function CampaignBanner({ campaign, className = '' }: { campaign: PricingCampaign | null; className?: string }) {
  const { t, language } = useI18n()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!campaign) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [campaign])
  if (!campaign || new Date(campaign.ends_at).getTime() <= now) return null

  const headline = localizedText(campaign.headline, language) || localizedText(campaign.name, language)
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-4 py-2.5 text-center text-white ${className}`} data-help-id="marketing.campaign_banner">
      <Flame className="h-4 w-4 shrink-0" />
      <span className="text-sm font-black tracking-tight">{headline}</span>
      <span className="text-xs font-bold opacity-90">
        {t(P + 'banner_detail').replace('{off}', String(campaignOffPercent(campaign))).replace('{months}', String(campaign.months))}
      </span>
      <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest">
        {t(P + 'banner_ends').replace('{time}', formatTimeLeft(campaign.ends_at, now))}
      </span>
    </div>
  )
}

/** Faixa no topo do site: busca a campanha vigente sozinha. */
export function CampaignTopBar() {
  const [campaign, setCampaign] = useState<PricingCampaign | null>(null)
  useEffect(() => { fetchActiveCampaign(createClient()).then(setCampaign) }, [])
  return <CampaignBanner campaign={campaign} />
}
