import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { OUT, buildBundleSource, ENGINE_FILES } from '../../../../scripts/engine-bundle-lib.mjs'

describe('pacote do motor de testes (entregue ao cliente pela IDE)', () => {
  it('o arquivo gerado está em dia com os arquivos do motor (rode: node scripts/build-engine-bundle.mjs)', () => {
    const esperado = buildBundleSource()
    expect(esperado, 'código-fonte do motor presente').not.toBeNull()
    expect(fs.readFileSync(OUT, 'utf8')).toBe(esperado)
  })

  it('não leva segredos nem caminhos desta máquina e não depende de arquivos fora do pacote', () => {
    const src = fs.readFileSync(OUT, 'utf8')
    expect(src).not.toMatch(/E2E_REAL_PASSWORD\s*=|C:\\\\Users\\\\Alexandre/)
    // todo import relativo dos arquivos do motor aponta para um arquivo que está no pacote
    const dentro = new Set(Object.keys(ENGINE_FILES as Record<string, string>))
    for (const [dest, texto] of Object.entries(JSON.parse(src.slice(src.indexOf('= {') + 2)) as Record<string, string>)) {
      if (!/\.(ts|mjs)$/.test(dest)) continue
      for (const m of texto.matchAll(/(?:from|import)\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
        const alvo = new URL(m[1], 'file:///' + dest).pathname.slice(1)
        const ok = [alvo, alvo + '.ts', alvo + '.mjs', alvo + '/index.ts'].some(c => dentro.has(c))
        expect(ok, `${dest} importa ${m[1]}, que não está no pacote`).toBe(true)
      }
    }
  })
})
