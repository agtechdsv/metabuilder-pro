import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/^(page|layout|template|not-found|error)\.tsx$/.test(name)) out.push(p)
  }
  return out
}

/**
 * Página de servidor (sem 'use client') que chama o hook useI18n quebra em produção com erro 500 ("hooks só funcionam em Client Components").
 * Foi o que derrubou /terms, /privacy e /agtech. Quem usa o hook precisa ser Client Component.
 */
describe('páginas e layouts que usam hooks de cliente', () => {
  it('quem chama useI18n() declara use client', () => {
    const offenders = walk('src/app').filter(f => {
      const src = readFileSync(f, 'utf8')
      const isClient = /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(src)
      return !isClient && /\buseI18n\s*\(/.test(src)
    })
    expect(offenders).toEqual([])
  })
})
