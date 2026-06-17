import { useState, useMemo } from 'react'

export function useDashboardAdmin(
  mappedWorkspaces: any[],
  payments: any[],
  profiles: any[],
  workspaceMembers: any[],
  ownerGuests: any[]
) {
  const [dashboardPeriod, setDashboardPeriod] = useState<'all' | 'today' | '7days' | '15days' | '30days' | 'custom'>('all')
  const [dashboardCustomStart, setDashboardCustomStart] = useState('')
  const [dashboardCustomEnd, setDashboardCustomEnd] = useState('')
  const [dashboardClient, setDashboardClient] = useState<string>('all')

  const filteredDashboardData = useMemo(() => {
    const customerWorkspaces = mappedWorkspaces.filter(w => !w.ownerIsSuperAdmin)

    const isDateInPeriod = (dateStr: string) => {
      if (dashboardPeriod === 'all') return true
      const d = new Date(dateStr)
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      if (dashboardPeriod === 'today') return d >= startOfToday
      if (dashboardPeriod === '7days') return d >= new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000)
      if (dashboardPeriod === '15days') return d >= new Date(startOfToday.getTime() - 14 * 24 * 60 * 60 * 1000)
      if (dashboardPeriod === '30days') return d >= new Date(startOfToday.getTime() - 29 * 24 * 60 * 60 * 1000)
      if (dashboardPeriod === 'custom') {
        if (!dashboardCustomStart) return true
        const start = new Date(dashboardCustomStart + 'T00:00:00')
        if (d < start) return false
        if (dashboardCustomEnd) {
          const end = new Date(dashboardCustomEnd + 'T23:59:59')
          if (d > end) return false
        }
        return true
      }
      return true
    }

    const workspacesFiltered = customerWorkspaces.filter(w => {
      if (!isDateInPeriod(w.created_at)) return false
      if (dashboardClient !== 'all' && w.id !== dashboardClient) return false
      return true
    })

    const paymentsFiltered = payments.filter(p => {
      if (!isDateInPeriod(p.created_at)) return false
      if (dashboardClient !== 'all' && p.workspace_id !== dashboardClient) return false
      return true
    })

    return {
      workspaces: workspacesFiltered,
      payments: paymentsFiltered
    }
  }, [mappedWorkspaces, payments, dashboardPeriod, dashboardCustomStart, dashboardCustomEnd, dashboardClient])

  const metrics = useMemo(() => {
    const { workspaces: filteredWorkspaces, payments: filteredPayments } = filteredDashboardData

    const ownerIds = new Set(filteredWorkspaces.map(w => w.owner_id))
    const totalClients = ownerIds.size

    const activeUserIds = new Set<string>()
    filteredWorkspaces.forEach(w => {
      activeUserIds.add(w.owner_id)
      const clientGuests = ownerGuests.filter(g => g.owner_id === w.owner_id)
      clientGuests.forEach(g => {
        if (profiles.some(p => p.id === g.user_id)) {
          activeUserIds.add(g.user_id)
        }
      })
    })
    const totalUsers = activeUserIds.size

    const activeMRR = filteredWorkspaces
      .filter(w => !w.is_blocked && w.ownerLicenses > 0)
      .reduce((acc, w) => acc + Number(w.planPrice), 0)

    const faturamento = filteredPayments
      .filter(p => {
        const s = p.status?.toLowerCase()
        return s === 'received' || s === 'confirmed' || s === 'active' || s === 'paid'
      })
      .reduce((acc, p) => acc + Number(p.amount), 0)

    const clientsWithPlan = new Set(filteredWorkspaces.filter(w => w.ownerLicenses > 0).map(w => w.owner_id)).size
    const conversionRate = totalClients > 0 ? (clientsWithPlan / totalClients) * 100 : 0

    return {
      activeMRR,
      faturamento,
      totalClients,
      totalUsers,
      conversionRate
    }
  }, [filteredDashboardData, profiles, ownerGuests])

  return {
    dashboardPeriod,
    setDashboardPeriod,
    dashboardCustomStart,
    setDashboardCustomStart,
    dashboardCustomEnd,
    setDashboardCustomEnd,
    dashboardClient,
    setDashboardClient,
    filteredDashboardData,
    metrics
  }
}
