import { describe, it, expect } from 'vitest'
// @ts-ignore — script .mjs sem tipos
import { render, BI_RUNTIME_FILES as SOURCES } from '../../../../scripts/gen-bi-runtime.mjs'
import { BI_RUNTIME_FILES } from '../biRuntimeFiles.generated'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('motor de BI embutido no gerador', () => {
  it('o arquivo gerado está em dia com as fontes (rode `npm run gen:bi`)', () => {
    const generated = readFileSync(join(__dirname, '..', 'biRuntimeFiles.generated.ts'), 'utf8').replace(/\r\n/g, '\n')
    expect(generated).toBe(render())
  })

  it('só importa arquivos que também são copiados (sem @/ nem pacotes)', () => {
    const paths = new Set(Object.keys(BI_RUNTIME_FILES))
    for (const [file, src] of Object.entries(BI_RUNTIME_FILES)) {
      for (const m of src.matchAll(/(?:import|export)[^'"]*from\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1]
        expect(spec.startsWith('.'), `${file} importa "${spec}"`).toBe(true)
        const dir = file.split('/').slice(0, -1)
        for (const part of spec.split('/')) { if (part === '..') dir.pop(); else if (part !== '.') dir.push(part) }
        expect(paths.has(dir.join('/') + '.ts'), `${file} importa "${spec}" que não está na lista`).toBe(true)
      }
    }
    expect(SOURCES.length).toBe(Object.keys(BI_RUNTIME_FILES).length)
  })
})
