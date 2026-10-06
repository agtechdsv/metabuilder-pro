import { describe, it, expect } from 'vitest'
import pt from '../translations/pt.json'
import en from '../translations/en.json'
import es from '../translations/es.json'

// chaves em notação de ponto ("runtime.bi_all") de todas as folhas de texto
function leaves(obj: any, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? leaves(v, prefix + k + '.') : [prefix + k],
  )
}

const keys = { pt: new Set(leaves(pt)), en: new Set(leaves(en)), es: new Set(leaves(es)) }
const diff = (a: Set<string>, b: Set<string>) => [...a].filter(k => !b.has(k))

// Toda chave que existe em PT ou EN precisa existir nos três idiomas (chave faltando aparece como "a.b.c" na tela).
// O ES tem chaves a mais de versões antigas; isso não quebra nada e não é checado.
const GUARDED = ['']

describe('traduções PT / EN / ES', () => {
  for (const [a, b] of [['pt', 'en'], ['pt', 'es'], ['en', 'es'], ['en', 'pt']] as const) {
    it(`toda chave protegida de ${a} existe em ${b}`, () => {
      const missing = diff(keys[a], keys[b]).filter(k => GUARDED.some(g => k.startsWith(g)))
      expect(missing).toEqual([])
    })
  }

  it('nenhum texto protegido está vazio e os marcadores {…} batem entre os idiomas', () => {
    const get = (o: any, k: string) => k.split('.').reduce((x, p) => x?.[p], o) as string
    const bad: string[] = []
    for (const k of keys.pt) {
      if (!GUARDED.some(g => k.startsWith(g))) continue
      const marks = (s: string) => (s.match(/\{[a-z]+\}/g) || []).sort().join(',')
      const [p, e, s] = [get(pt, k), get(en, k), get(es, k)]
      if (!p || !e || !s) bad.push(`${k}: vazio`)
      else if (marks(p) !== marks(e) || marks(p) !== marks(s)) bad.push(`${k}: marcadores diferentes`)
    }
    expect(bad).toEqual([])
  })
})
