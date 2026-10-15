import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// A IDE Local usa classes escuras fixas; o tema claro (styles/ide-skin.css) troca cada uma. Este teste avisa quando alguém
// usa numa tela da IDE uma cor escura que o tema claro ainda não conhece (ela ficaria escura num app claro).
const ROOT = join(__dirname, '..', '..')
const css = readFileSync(join(ROOT, 'styles', 'ide-skin.css'), 'utf8')
const esc = (c: string) => c.replace(/([\[\]#:\/.%])/g, '\\$1')

const files = [
  ...readdirSync(join(ROOT, 'components', 'ide')).filter(f => f.endsWith('.tsx')).map(f => join(ROOT, 'components', 'ide', f)),
  join(ROOT, 'contexts', 'IDESyncContext.tsx'),
]
const source = files.map(f => readFileSync(f, 'utf8')).join('\n')

// fundos e bordas escuros: hex escuro ou neutral 700-950
const DARK = /\b(?:hover:)?(?:bg|border)-(?:\[#(?:0|1|2)[0-9a-fA-F]{5}\]|neutral-(?:600|700|800|900|950)(?:\/[0-9]+)?)\b/g

describe('tema claro da IDE Local', () => {
  it('toda cor escura de fundo/borda usada nas telas da IDE tem a equivalente clara', () => {
    const used = new Set(source.match(DARK) || [])
    // overlays (bg-black/60) e cores de realce não entram: o teste olha só fundos/bordas escuros
    const missing = [...used].filter(c => !css.includes('.' + esc(c)))
    expect(missing).toEqual([])
  })

  it('o CSS só vale no tema claro e fora do console', () => {
    const rules = css.split('\n').filter(l => l.startsWith('html'))
    expect(rules.length).toBeGreaterThan(40)
    expect(rules.every(l => l.startsWith('html.light .ide-skin'))).toBe(true)
  })
})
