import { describe, it, expect } from 'vitest'
import { formatBiValue, biPrimaryColor, BI_PALETTES } from '../format'

// Intl usa espaços não separáveis; normaliza para comparar
const f = (v: any, o: any, axis = false) => formatBiValue(v, { locale: 'pt-BR', ...o }, axis).replace(/\s/g, ' ')

describe('formatBiValue', () => {
  it('vazio e nulo viram string vazia; texto não numérico é devolvido', () => {
    expect(f(null, {})).toBe('')
    expect(f(undefined, {})).toBe('')
    expect(f('', {})).toBe('')
    expect(f('abc', {})).toBe('abc')
  })

  it('número, moeda e percentual em pt-BR', () => {
    expect(f(1234.5, { format: 'number' })).toBe('1.234,5')
    expect(f(1234.5, { format: 'currency' })).toBe('R$ 1.234,50')
    expect(f(12.5, { format: 'percent' })).toBe('12,5%')
  })

  it('respeita casas decimais e limita a 0–6', () => {
    expect(f(1.23456, { format: 'number', decimals: 3 })).toBe('1,235')
    expect(f(1.5, { format: 'currency', decimals: 0 })).toBe('R$ 2')
    expect(f(1.1234567891, { format: 'number', decimals: 99 })).toBe('1,123457')
  })

  it('formatos abreviados', () => {
    expect(f(23_300_000, { format: 'compact' })).toMatch(/23,3/)
    expect(f(23_300_000, { format: 'currency_compact' })).toMatch(/R\$ 23,3/)
  })

  it('eixo sempre abreviado', () => {
    expect(f(28_000_000, { format: 'currency' }, true)).toMatch(/R\$ 28/)
    expect(f(28_000_000, { format: 'currency' }, true)).not.toMatch(/000\.000/)
    expect(f(28_000_000, { format: 'number' }, true)).not.toMatch(/\./)
  })

  it('moeda padrão por idioma', () => {
    expect(formatBiValue(10, { locale: 'en-US', format: 'currency' })).toBe('$10.00')
  })
})

describe('biPrimaryColor', () => {
  it('usa a paleta e cai no índigo', () => {
    expect(biPrimaryColor('emerald')).toBe(BI_PALETTES.emerald.color)
    expect(biPrimaryColor('nao-existe')).toBe(BI_PALETTES.indigo.color)
    expect(biPrimaryColor()).toBe(BI_PALETTES.indigo.color)
  })
})
