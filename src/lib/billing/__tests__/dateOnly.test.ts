import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { formatDateOnly } from '../dateOnly'

describe('data só-dia (vencimento) sem fuso', () => {
  it('16/11 continua 16/11, em qualquer fuso', () => {
    expect(formatDateOnly('2026-11-16')).toBe('16/11/2026')
    expect(formatDateOnly('2026-01-01')).toBe('01/01/2026')
    expect(formatDateOnly(' 2026-12-31 ')).toBe('31/12/2026')
  })

  it('data com hora (ou lixo) não é só-dia: segue o tratamento normal', () => {
    for (const v of ['2026-11-16T00:00:00Z', '2026-11-16T10:00:00-03:00', 'lixo', '', null, undefined]) expect(formatDateOnly(v as any), String(v)).toBeNull()
  })

  it('a tela da assinatura usa o formatador sem fuso', () => {
    const src = readFileSync('src/components/client/ClientSharedComponents.tsx', 'utf8')
    expect(src).toContain("formatDateOnly(dateStr)")
  })
})
