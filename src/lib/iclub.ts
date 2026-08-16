export interface IClubRuleName {
  pt: string
  en: string
  es: string
}

export interface IClubRule {
  id?: string
  name: string | IClubRuleName | Record<string, string>
  benefit_type: 'volume_license' | 'referral_discount'
  target_count: number
  reward_type: 'free_license' | 'percent_discount'
  reward_value: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface IClubReferral {
  id: string
  referrer_id: string
  referred_id: string | null
  referred_email: string
  status: 'registered' | 'subscribed' | 'reward_applied'
  created_at: string
  referred_name?: string | null
}

export interface IClubReward {
  id: string
  user_id: string
  reward_type: 'free_license' | 'percent_discount'
  reward_value: number
  status: 'active' | 'applied' | 'expired'
  notes: string | null
  created_at: string
}

/**
 * Returns the localized name of an iClub rule according to the given language ('pt', 'en', 'es').
 */
export function getLocalizedIClubRuleName(
  name: string | IClubRuleName | Record<string, string> | any,
  language: string = 'pt'
): string {
  if (!name) return ''
  
  if (typeof name === 'object') {
    return name[language] || name['pt'] || name['en'] || name['es'] || Object.values(name)[0] || ''
  }
  
  if (typeof name === 'string') {
    const trimmed = name.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed[language] || parsed['pt'] || parsed['en'] || parsed['es'] || Object.values(parsed)[0] || ''
        }
      } catch {
        return name
      }
    }
    return name
  }
  
  return String(name)
}
