import { describe, it, expect } from 'vitest'
import { SCALE_PRESETS, presetOf, spanFor, widthKey, widthOfSpan } from '../scaleLayout'

describe('scaleLayout', () => {
  it('cinco tamanhos, na ordem Pequeno → Extra Grande', () => {
    expect(SCALE_PRESETS.map(p => p.key)).toEqual(['small', 'medium', 'normal', 'large', 'xl'])
  })

  it('Normal mantém a grade de sempre (3 por linha para "third")', () => {
    expect(spanFor('third', 'normal')).toBe(4)
    expect(spanFor('half', 'normal')).toBe(6)
    expect(spanFor('quarter', 'normal')).toBe(3)
    expect(spanFor('full', 'normal')).toBe(12)
  })

  it('Médio fica entre Pequeno e Normal: 4 cards por linha', () => {
    expect(12 / spanFor('third', 'medium')).toBe(4)
  })

  it('Pequeno cabe mais cards por linha e Extra Grande, menos', () => {
    expect(12 / spanFor('third', 'small')).toBe(6)
    expect(12 / spanFor('third', 'large')).toBe(2)
    expect(12 / spanFor('third', 'xl')).toBe(1)
  })

  it('quanto maior a escala, maior (ou igual) o espaço de cada widget', () => {
    for (const w of ['full', 'half', 'third', 'quarter'] as const) {
      const spans = SCALE_PRESETS.map(p => p.spans[w])
      expect([...spans].sort((a, b) => a - b)).toEqual(spans)
    }
    const heights = SCALE_PRESETS.map(p => p.chartHeight)
    expect([...heights].sort((a, b) => a - b)).toEqual(heights)
  })

  it('largura desconhecida vira "third" e escala desconhecida vira Normal', () => {
    expect(widthKey(undefined)).toBe('third')
    expect(widthKey('xyz')).toBe('third')
    expect(presetOf('nada').key).toBe('normal')
  })

  it('largura efetiva acompanha o espaço', () => {
    expect(widthOfSpan(12)).toBe('full')
    expect(widthOfSpan(6)).toBe('half')
    expect(widthOfSpan(4)).toBe('third')
    expect(widthOfSpan(2)).toBe('quarter')
  })
})
