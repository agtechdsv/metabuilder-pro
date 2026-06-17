import { useState, useEffect } from 'react'
import { getIClubDashboardData, IClubRule, IClubReferral, IClubReward } from '@/app/actions/iclub'

interface UseClientIClubProps {
  activeTab: string
  toast: (msg: string, type: 'success' | 'error' | 'info') => void
}

export function useClientIClub({
  activeTab,
  toast
}: UseClientIClubProps) {
  const [iclubData, setIclubData] = useState<{
    referralCode: string | null;
    rules: IClubRule[];
    referrals: IClubReferral[];
    rewards: IClubReward[];
  } | null>(null)
  const [loadingIClub, setLoadingIClub] = useState(false)

  const fetchIClubData = async () => {
    setLoadingIClub(true)
    const res = await getIClubDashboardData()
    if (res.success) {
      setIclubData({
        referralCode: res.referralCode || null,
        rules: res.rules || [],
        referrals: res.referrals || [],
        rewards: res.rewards || [],
      })
    } else {
      toast(res.error || 'Erro ao carregar dados do iClub.', 'error')
    }
    setLoadingIClub(false)
  }

  useEffect(() => {
    if (activeTab === 'iclub') {
      fetchIClubData()
    }
  }, [activeTab])

  return {
    iclubData,
    loadingIClub,
    fetchIClubData
  }
}
