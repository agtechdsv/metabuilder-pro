import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { BpmCore } = require('../../../../cli/bpmCore.js') as { BpmCore: new (ports: any) => any }

const core = new BpmCore({ db: { dialect: 'postgres', query: async () => [] }, models: { tableOf: async () => 'pedidos' } })
const cond = (operator: string, value = '', extra: any[] = [], groupLogic = 'AND') => ({
  data: { conditionGroups: [{ id: 'g', logic: groupLogic, groupLogic: 'AND', rules: [{ id: 'r', modelId: 'm', field: 'id', operator, value }, ...extra] }] },
})
const check = (operator: string, data: any, value = '') => core.evaluateCondition(cond(operator, value), 'pedidos', data)

describe('condição "Está vazio" / "Não está vazio"', () => {
  it('registro novo (sem o campo), nulo, texto vazio e só espaços contam como vazio', () => {
    for (const data of [{}, { id: null }, { id: undefined }, { id: '' }, { id: '   ' }]) {
      expect(check('empty', data)).toBe(true)
      expect(check('notEmpty', data)).toBe(false)
    }
  })

  it('valor preenchido (inclusive 0 e false) não é vazio', () => {
    for (const data of [{ id: 5 }, { id: 0 }, { id: false }, { id: 'abc' }, { id: '0' }]) {
      expect(check('empty', data)).toBe(false)
      expect(check('notEmpty', data)).toBe(true)
    }
  })

  it('não depende do valor esperado (que fica em branco na tela)', () => {
    expect(check('empty', {}, 'qualquer coisa')).toBe(true)
    expect(check('notEmpty', { id: 7 }, 'null')).toBe(true)
  })

  it('o caso do pedido: só registro novo (sem id) passa; pedido já gravado não', () => {
    expect(check('empty', { status: 'Aprovado' })).toBe(true)
    expect(check('empty', { id: 42, status: 'Aprovado' })).toBe(false)
  })

  it('combina com outras regras do grupo (E / OU)', () => {
    const other = { id: 'r2', modelId: 'm', field: 'status', operator: '==', value: 'Aprovado' }
    expect(core.evaluateCondition(cond('empty', '', [other], 'AND'), 'pedidos', { status: 'Aprovado' })).toBe(true)
    expect(core.evaluateCondition(cond('empty', '', [other], 'AND'), 'pedidos', { status: 'Novo' })).toBe(false)
    expect(core.evaluateCondition(cond('empty', '', [other], 'OR'), 'pedidos', { id: 1, status: 'Aprovado' })).toBe(true)
  })

  it('os operadores antigos continuam como antes', () => {
    expect(check('==', { id: 5 }, '5')).toBe(true)
    expect(check('!=', { id: 5 }, '6')).toBe(true)
    expect(check('==', {}, 'null')).toBe(false) // o que enganava no fluxo do pedido: ausente vira "undefined", nunca "null"
  })
})
