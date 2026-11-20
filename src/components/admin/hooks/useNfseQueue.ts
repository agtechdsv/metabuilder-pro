'use client'

import { useCallback, useEffect, useState } from 'react'
import { nfseOverviewAction } from '@/app/actions/nfse'
import type { NfseErrorCode, NfseOverview } from '@/lib/nfse/types'

/** Carrega a fila de notas fiscais (só SuperAdmin). `refreshKey` vem do botão de atualizar do painel. */
export function useNfseQueue(refreshKey = 0) {
  const [overview, setOverview] = useState<NfseOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<NfseErrorCode | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const r = await nfseOverviewAction()
    if (r.success) { setOverview(r.overview); setError(null) } else setError(r.code)
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload, refreshKey])

  return { overview, loading, error, reload }
}

export type NfseQueueHook = ReturnType<typeof useNfseQueue>

/** Quantas notas pedem atenção (atrasadas ou para hoje): vira o selo da subaba. */
export const attentionCount = (o: NfseOverview | null): number =>
  o ? o.items.filter(i => i.status === 'pending' && (i.due.state === 'late' || i.due.state === 'today')).length + o.items.filter(i => i.status === 'issued' && i.refunded).length : 0
