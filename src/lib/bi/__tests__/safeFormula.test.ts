import { describe, it, expect } from 'vitest'
import { compileFormula, parseFormulaAst } from '../safeFormula'

describe('safeFormula', () => {
  it('calcula aritmética com precedência e parênteses', () => {
    expect(compileFormula('a + b * 2')({ a: 1, b: 3 })).toBe(7)
    expect(compileFormula('(a + b) * 2')({ a: 1, b: 3 })).toBe(8)
    expect(compileFormula('-a + 10')({ a: 4 })).toBe(6)
  })

  it('aceita prefixo tabela. e ignora maiúsculas no nome da coluna', () => {
    const f = compileFormula('itens.preco * itens.qtd')
    expect(f({ PRECO: 10, QTD: 3 })).toBe(30)
  })

  it('divisão e módulo por zero valem 0', () => {
    expect(compileFormula('a / b')({ a: 5, b: 0 })).toBe(0)
    expect(compileFormula('a % b')({ a: 5, b: 0 })).toBe(0)
  })

  it('nulos e textos não numéricos viram 0', () => {
    expect(compileFormula('a + b')({ a: null, b: 'x' })).toBe(0)
    expect(compileFormula('a + b')({ a: '2.5', b: 1 })).toBe(3.5)
  })

  it('funções ROUND, ABS, MIN, MAX', () => {
    expect(compileFormula('ROUND(a, 1)')({ a: 1.26 })).toBe(1.3)
    expect(compileFormula('round(a)')({ a: 1.6 })).toBe(2)
    expect(compileFormula('ABS(a)')({ a: -3 })).toBe(3)
    expect(compileFormula('MIN(a, b)')({ a: 3, b: 2 })).toBe(2)
    expect(compileFormula('MAX(a, b, 9)')({ a: 3, b: 2 })).toBe(9)
  })

  it.each([
    'process.exit(1)',
    'constructor.constructor("return 1")()',
    'a; b',
    '"abc"',
    'a +',
    '(a + b',
    'EVAL(a)',
    'a b',
    '',
  ])('fórmula inválida %j vale sempre 0 e não gera AST', (src) => {
    expect(compileFormula(src)({ a: 1, b: 2 })).toBe(0)
    expect(parseFormulaAst(src)).toBeNull()
  })

  it('AST guarda a tabela dos campos', () => {
    expect(parseFormulaAst('t.x + y')).toEqual({
      t: 'bin', op: '+',
      a: { t: 'field', table: 't', name: 'x' },
      b: { t: 'field', name: 'y' },
    })
  })
})
