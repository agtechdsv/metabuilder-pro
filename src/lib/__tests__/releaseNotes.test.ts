import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseReleaseNotes, hasLangMarkers } from '../releaseNotes'

describe('release notes manuais', () => {
  it('sem marcadores, o mesmo texto vale para os três idiomas (Markdown e emojis intactos)', () => {
    const t = '## 🚀 Novidades\n\n- **BPM:** De/Para'
    expect(parseReleaseNotes(t)).toEqual({ pt: t, en: t, es: t })
    expect(hasLangMarkers(t)).toBe(false)
  })

  it('com marcadores, separa pt, en e es', () => {
    const r = parseReleaseNotes('=== pt ===\n## Olá\n- a\n=== en ===\n## Hi\n- b\n=== es ===\n## Hola\n- c')
    expect(r).toEqual({ pt: '## Olá\n- a', en: '## Hi\n- b', es: '## Hola\n- c' })
  })

  it('aceita CRLF e marcadores em maiúsculas', () => {
    const r = parseReleaseNotes('=== PT ===\r\nA\r\n=== EN ===\r\nB')
    expect(r.pt).toBe('A')
    expect(r.en).toBe('B')
  })

  it('idioma que faltou usa o português, nunca vazio', () => {
    const r = parseReleaseNotes('=== pt ===\nSó português')
    expect(r).toEqual({ pt: 'Só português', en: 'Só português', es: 'Só português' })
  })

  it('texto vazio devolve vazio', () => {
    expect(parseReleaseNotes('  ')).toEqual({ pt: '', en: '', es: '' })
  })

  it('a rota usa as notas escritas como estão (sem Gemini) e envia só o português ao GitHub', () => {
    const route = readFileSync('src/app/api/admin/release/route.ts', 'utf8')
    expect(route).toContain('parseReleaseNotes(releaseNotes)')
    expect(route).toContain('!manualNotes && process.env.GEMINI_API_KEY')
    expect(route).toContain('release_notes: generateReleaseNotes ? \'\' : (manualNotes ? manualNotes.pt')
  })
})
