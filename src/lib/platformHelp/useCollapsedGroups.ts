import { useState } from 'react'

const KEY = 'mb.tourMenu.collapsed'

/**
 * Grupos recolhidos dos menus de tours (o do Studio e o da IDE Local compartilham a lista). É só conveniência: fica guardado neste navegador
 * e, sem armazenamento, o menu funciona do mesmo jeito (só não lembra).
 */
export function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } })
  const save = (next: string[]) => {
    setCollapsed(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* sem armazenamento: vale só nesta sessão */ }
  }
  const toggle = (key: string) => save(collapsed.includes(key) ? collapsed.filter(k => k !== key) : [...collapsed, key])
  return { collapsed, save, toggle }
}
