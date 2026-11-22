'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { adminChargesAction } from '@/app/actions/adminCharges'
import { DEFAULT_FILTERS, type ChargeFilters, type ChargesErrorCode, type ChargesPage } from '@/lib/billing/adminCharges'

/**
 * Carrega a lista de cobranças (só SuperAdmin). Mudar um filtro volta à primeira página; a busca por texto espera o fim da digitação.
 * `refreshKey` vem do botão de atualizar do painel. `enabled` evita consultar enquanto a subaba não foi aberta. O atalho "Cobranças" da linha do
 * cliente chama `update({ userId })`.
 */
export function useAdminCharges(refreshKey = 0, enabled = true) {
  const [filters, setFilters] = useState<ChargeFilters>(DEFAULT_FILTERS)
  const [data, setData] = useState<ChargesPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ChargesErrorCode | null>(null)
  const seq = useRef(0) // resposta atrasada de um filtro antigo não pode sobrescrever a do filtro atual

  const load = useCallback(async (f: ChargeFilters) => {
    const mine = ++seq.current
    setLoading(true)
    const r = await adminChargesAction(f)
    if (mine !== seq.current) return
    if (r.success) { setData(r); setError(null) } else setError(r.code)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!enabled) return
    // a digitação na busca espera um instante; os demais filtros carregam já
    const t = setTimeout(() => { void load(filters) }, 300)
    return () => clearTimeout(t)
  }, [filters, load, refreshKey, enabled])

  /** Muda filtros e volta à primeira página (exceto quando a mudança é a própria página). */
  const update = useCallback((patch: Partial<ChargeFilters>) => {
    setFilters(prev => ({ ...prev, page: 0, ...patch }))
  }, [])
  const reset = useCallback(() => setFilters(DEFAULT_FILTERS), [])
  const reload = useCallback(() => load(filters), [load, filters])

  return { filters, data, loading, error, update, reset, reload }
}

export type AdminChargesHook = ReturnType<typeof useAdminCharges>
