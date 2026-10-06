import { describe, it, expect } from 'vitest'
import { compileError, repairJsxAttributeQuotes, prepareComponentCode } from '../aiComponentCode'

const comp = (attr: string) => `'use client';\nimport React from 'react';\nexport default function A() {\n  return (\n    <div>\n      <input\n        ${attr}\n        value="x"\n      />\n    </div>\n  );\n}\n`

describe('aiComponentCode', () => {
  it('código válido passa sem alteração', () => {
    const code = comp('placeholder="Ex: Notebook 15"')
    expect(compileError(code)).toBeNull()
    const p = prepareComponentCode(code)
    expect(p).toEqual({ ok: true, code, repaired: false })
  })

  it('aspa escapada em atributo JSX: não compila, mas o reparo conserta', () => {
    const code = comp('placeholder="Ex: Notebook Ultra Pro 15\\""')
    expect(compileError(code)).not.toBeNull()
    const p = prepareComponentCode(code)
    expect(p.ok).toBe(true)
    if (p.ok) {
      expect(p.repaired).toBe(true)
      expect(p.code).toContain('placeholder="Ex: Notebook Ultra Pro 15&quot;"')
      expect(compileError(p.code)).toBeNull()
    }
  })

  it('o reparo só mexe em atributos que têm \\" (não altera o resto)', () => {
    const code = comp('placeholder="normal"')
    expect(repairJsxAttributeQuotes(code)).toBe(code)
  })

  it('erro que o reparo não resolve devolve a mensagem de compilação', () => {
    const p = prepareComponentCode("export default function A() { return (<div>) }")
    expect(p.ok).toBe(false)
    if (!p.ok) expect(p.error.length).toBeGreaterThan(0)
  })
})
