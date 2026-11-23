import { describe, it, expect } from 'vitest'
// @ts-ignore — script .mjs sem tipos
import { render, BPM_RUNTIME_FILES as SOURCES } from '../../../../scripts/gen-bpm-runtime.mjs'
import { BPM_RUNTIME_FILES } from '../bpmRuntimeFiles.generated'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('núcleo do BPM embutido no gerador', () => {
  it('o arquivo gerado está em dia com as fontes (rode `npm run gen:bpm`)', () => {
    const generated = readFileSync(join(__dirname, '..', 'bpmRuntimeFiles.generated.ts'), 'utf8').replace(/\r\n/g, '\n')
    expect(generated).toBe(render())
    expect(SOURCES.length).toBe(Object.keys(BPM_RUNTIME_FILES).length)
  })

  it('o núcleo só usa módulos nativos do Node (roda no app exportado sem dependências)', () => {
    const core = BPM_RUNTIME_FILES['lib/bpm/core.js']
    for (const m of core.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) expect(m[1], 'require no núcleo').toBe('async_hooks')
    const mail = BPM_RUNTIME_FILES['lib/bpm/emailTemplates.js']
    expect(mail).not.toMatch(/require\(/)
  })
})
