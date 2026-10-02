/**
 * Destino (?next=) para voltar depois do login. Só aceita caminho relativo do próprio site
 * (começa com "/" e não é "//", nem tem protocolo), evitando redirecionamento aberto.
 */
export function getSafeNext(search: string): string | null {
  try {
    const next = new URLSearchParams(search).get('next')
    if (!next) return null
    if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null
    if (next.includes('://')) return null
    if (/\/login(\?|$)/.test(next)) return null
    return next
  } catch {
    return null
  }
}

/** Anexa ?preview=draft ao link interno quando a navegação atual está em modo rascunho. */
export function withPreview(href: string | undefined, isPreview: boolean): string {
  if (!href) return '#'
  if (!isPreview || href === '#' || /^[a-z]+:\/\//i.test(href) || href.includes('preview=draft')) return href
  return href + (href.includes('?') ? '&' : '?') + 'preview=draft'
}
