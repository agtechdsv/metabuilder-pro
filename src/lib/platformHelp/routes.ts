import type { PlatformTour } from './types'

const trim = (p: string): string => {
  const base = p.split('?')[0].split('#')[0]
  return base.length > 1 ? base.replace(/\/+$/, '') : base
}

/**
 * O caminho combina com o padrão? `:nome` vale por um trecho qualquer; `*` no fim vale por tudo o que vier depois.
 * Sem barra final e sem query. Ex.: ('/admin/:ws/:proj/studio', '/admin/a/b/studio') → true; ('.../studio', '.../studio/data') → false.
 */
export function matchRoute(pattern: string, pathname: string): boolean {
  const pat = trim(pattern).split('/')
  const path = trim(pathname).split('/')
  for (let i = 0; i < pat.length; i++) {
    if (pat[i] === '*') return true
    if (i >= path.length) return false
    if (pat[i].startsWith(':')) { if (!path[i]) return false; continue }
    if (pat[i] !== path[i]) return false
  }
  return pat.length === path.length
}

/** Tours que valem para este caminho, na ordem do catálogo. */
export function toursForRoute(tours: readonly PlatformTour[], pathname: string): PlatformTour[] {
  return tours.filter(t => matchRoute(t.route, pathname))
}
