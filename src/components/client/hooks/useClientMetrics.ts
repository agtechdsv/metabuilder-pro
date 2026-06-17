import { useMemo } from 'react'

const LOGIC_TYPE_LABELS: Record<string, string> = {
  pesquisa: 'Pesquisa',
  cadastro: 'Cadastro',
  pesquisa_cadastro: 'Pesquisa + Cadastro',
  master_detail: 'Mestre-Detalhe',
  analytics: 'Analytics',
  kanban: 'Kanban',
  timeline: 'Linha do Tempo',
  map: 'Mapa',
  gantt: 'Gantt',
  blueprint: 'Fluxograma',
  scheduler: 'Calendário',
  mapa_mental: 'Mapa Mental',
  personalizado: 'Personalizado',
  galeria: 'Galeria',
  agenda: 'Agenda',
  dashboard: 'Dashboard',
}

interface UseClientMetricsProps {
  profile: any
  ownerGuests: any[]
  workspaces: any[]
  projects: any[]
  useCases: any[]
  payments: any[]
  rules: any
}

export function useClientMetrics({
  profile,
  ownerGuests,
  workspaces,
  projects,
  useCases,
  payments,
  rules
}: UseClientMetricsProps) {
  const licensesUsed = useMemo(() => {
    const uniqueUsers = new Set<string>()
    if (profile?.id) uniqueUsers.add(profile.id)
    ownerGuests.forEach(g => uniqueUsers.add(g.user_id))
    return uniqueUsers.size
  }, [profile, ownerGuests])

  const projectsByWorkspace = useMemo(() => {
    return workspaces.map(ws => ({
      name: ws.name,
      count: projects.filter(p => p.workspace_id === ws.id).length,
    }))
  }, [workspaces, projects])

  const useCasesByProject = useMemo(() => {
    return projects.map(proj => ({
      name: proj.name,
      count: useCases.filter(uc => uc.project_id === proj.id).length,
    })).filter(p => p.count > 0)
  }, [projects, useCases])

  const useCasesByType = useMemo(() => {
    const counts: Record<string, number> = {}
    useCases.forEach(uc => {
      const key = uc.logic_type || 'outros'
      counts[key] = (counts[key] || 0) + 1
    })
    const colors = [
      'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-blue-500',
      'bg-rose-500', 'bg-purple-500', 'bg-cyan-500', 'bg-orange-500',
    ]
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count], i) => ({
        label: LOGIC_TYPE_LABELS[key] || key,
        count,
        color: colors[i % colors.length],
      }))
  }, [useCases])

  const lastSuccessfulPayment = useMemo(() => {
    return payments.find(p => {
      const s = p.status?.toLowerCase()
      return s === 'received' || s === 'confirmed' || s === 'active' || s === 'paid'
    })
  }, [payments])

  const getPlanPrice = () => {
    if (!rules || !profile?.subscription_licenses) return null

    let discountPercent = 0
    const tiers = [...(rules.volume_tiers || [])].sort((a, b) => b.min_licenses - a.min_licenses)
    for (const tier of tiers) {
      if (profile.subscription_licenses >= tier.min_licenses) {
        discountPercent = tier.discount_percent
        break
      }
    }
    
    let baseValue = rules.base_price * profile.subscription_licenses
    let valueWithVolumeDiscount = baseValue * (1 - discountPercent / 100)
    
    const cycle = profile.subscription_cycle || 'monthly'
    let cycleDiscount = 0
    if (cycle === 'quarterly') cycleDiscount = rules.cycle_discounts?.quarterly || 10
    if (cycle === 'semiannual') cycleDiscount = rules.cycle_discounts?.semiannual || 15
    if (cycle === 'yearly') cycleDiscount = rules.cycle_discounts?.yearly || 20
    
    let finalValue = valueWithVolumeDiscount * (1 - cycleDiscount / 100)
    
    if (cycle === 'quarterly') finalValue *= 3
    else if (cycle === 'semiannual') finalValue *= 6
    else if (cycle === 'yearly') finalValue *= 12
    
    return finalValue
  }

  return {
    licensesUsed,
    projectsByWorkspace,
    useCasesByProject,
    useCasesByType,
    lastSuccessfulPayment,
    getPlanPrice
  }
}
