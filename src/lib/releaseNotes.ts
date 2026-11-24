/**
 * Release notes escritas à mão no painel de Releases.
 *
 * O texto pode vir em um idioma só (vale para os três) ou separado por marcadores
 * em linha própria: `=== pt ===`, `=== en ===`, `=== es ===`.
 * Markdown e emojis passam como estão: o Histórico de Atualizações da IDE renderiza Markdown.
 */
export type ReleaseNotesByLang = { pt: string; en: string; es: string }

const MARKER = /^\s*={3,}\s*(pt|en|es)\s*={3,}\s*$/i

export function hasLangMarkers(text: string): boolean {
  return String(text || '').split(/\r?\n/).some((l) => MARKER.test(l))
}

export function parseReleaseNotes(raw: string): ReleaseNotesByLang {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim()
  if (!text) return { pt: '', en: '', es: '' }

  const sections: Partial<ReleaseNotesByLang> = {}
  let current: 'pt' | 'en' | 'es' | null = null
  const buffer: Record<string, string[]> = { pt: [], en: [], es: [] }
  const intro: string[] = []

  for (const line of text.split('\n')) {
    const m = line.match(MARKER)
    if (m) { current = m[1].toLowerCase() as 'pt' | 'en' | 'es'; continue }
    if (current) buffer[current].push(line)
    else intro.push(line)
  }

  if (!current && !Object.values(buffer).some((b) => b.length)) {
    // sem marcadores: o mesmo texto vale para os três idiomas
    return { pt: text, en: text, es: text }
  }

  for (const k of ['pt', 'en', 'es'] as const) {
    const v = buffer[k].join('\n').trim()
    if (v) sections[k] = v
  }
  // idioma que faltou usa o português (ou o primeiro que veio): nunca fica vazio
  const fallback = sections.pt || sections.en || sections.es || intro.join('\n').trim()
  return { pt: sections.pt || fallback, en: sections.en || fallback, es: sections.es || fallback }
}
