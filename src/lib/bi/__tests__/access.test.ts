import { describe, it, expect } from 'vitest'
import { cleanRlsRules, rlsAccess, rlsAttrColumns, viewerValue, withAccess, type RlsRule } from '../access'

const byVendedor: RlsRule = { id: 'r1', field: 'pedidos.vendedor_id', op: 'eq', source: 'user.attr', attr: 'vendedor_id' }

describe('viewerValue', () => {
  it('lê e-mail, nome e atributos (sem diferenciar maiúsculas no nome da coluna)', () => {
    const v = { email: ' ana@x.com ', name: 'Ana', attrs: { VENDEDOR_ID: 42, vazio: '  ' } }
    expect(viewerValue(v, 'user.email')).toBe('ana@x.com')
    expect(viewerValue(v, 'user.name')).toBe('Ana')
    expect(viewerValue(v, 'user.attr', 'vendedor_id')).toBe('42')
    expect(viewerValue(v, 'user.attr', 'vazio')).toBeNull()
    expect(viewerValue(v, 'user.attr', 'nao_existe')).toBeNull()
    expect(viewerValue(null, 'user.email')).toBeNull()
  })
})

describe('cleanRlsRules', () => {
  it('descarta regras incompletas e normaliza as válidas', () => {
    const rules = cleanRlsRules([
      { field: 'pedidos.vendedor_id', source: 'user.attr', attr: 'vendedor_id' },
      { field: 'pedidos.email', source: 'user.email', op: 'in' },
      { field: '', source: 'user.email' },
      { field: 'a.b', source: 'user.attr' },
      { field: 'a.b', source: 'qualquer' },
      null,
      'lixo',
    ])
    expect(rules).toHaveLength(2)
    expect(rules[0]).toMatchObject({ field: 'pedidos.vendedor_id', op: 'eq', source: 'user.attr', attr: 'vendedor_id' })
    expect(rules[1]).toMatchObject({ op: 'in', source: 'user.email' })
    expect(rules[1].attr).toBeUndefined()
  })

  it('exceção só vale com valores e, para atributo, com a coluna', () => {
    const [r] = cleanRlsRules([{ field: 'a.b', source: 'user.email', bypass: { source: 'user.attr', attr: 'perfil', values: ['admin', ' ', 'gerente'] } }])
    expect(r.bypass).toEqual({ source: 'user.attr', attr: 'perfil', values: ['admin', 'gerente'] })
    const [s] = cleanRlsRules([{ field: 'a.b', source: 'user.email', bypass: { source: 'user.attr', values: ['admin'] } }])
    expect(s.bypass).toBeUndefined()
    expect(cleanRlsRules('não é lista')).toEqual([])
  })
})

describe('rlsAccess', () => {
  it('sem regras não impõe nada (nem exige usuário)', () => {
    expect(rlsAccess([], null)).toEqual({ conditions: [] })
    expect(rlsAccess(undefined, null)).toEqual({ conditions: [] })
  })

  it('vira condição comum com o valor do usuário', () => {
    const r = rlsAccess([byVendedor], { email: 'a@x.com', attrs: { vendedor_id: 7 } })
    expect(r.denied).toBeUndefined()
    expect(r.conditions).toEqual([{ field: 'pedidos.vendedor_id', op: 'eq', value: '7' }])
  })

  it('falha fechada: sem usuário ou sem o atributo, nega', () => {
    expect(rlsAccess([byVendedor], null).denied).toEqual({ code: 'no_viewer' })
    expect(rlsAccess([byVendedor], { email: 'a@x.com', attrs: {} }).denied).toEqual({ code: 'missing_value', detail: 'vendedor_id' })
    expect(rlsAccess([{ ...byVendedor, source: 'user.email', attr: undefined }], { name: 'Ana' }).denied).toEqual({ code: 'missing_value', detail: 'email' })
  })

  it('exceção libera quem tem o perfil (inclusive sem o atributo da regra)', () => {
    const rule: RlsRule = { ...byVendedor, bypass: { source: 'user.attr', attr: 'perfil', values: ['Admin'] } }
    expect(rlsAccess([rule], { attrs: { perfil: 'admin' } })).toEqual({ conditions: [] })
    expect(rlsAccess([rule], { attrs: { perfil: 'vendedor', vendedor_id: 3 } }).conditions).toHaveLength(1)
    expect(rlsAccess([rule], { attrs: { perfil: 'vendedor' } }).denied?.code).toBe('missing_value')
  })

  it('várias regras somam condições (E)', () => {
    const r = rlsAccess(
      [byVendedor, { id: 'r2', field: 'clientes.regiao', op: 'in', source: 'user.attr', attr: 'regioes' }],
      { attrs: { vendedor_id: 1, regioes: 'sul, norte' } },
    )
    expect(r.conditions).toEqual([
      { field: 'pedidos.vendedor_id', op: 'eq', value: '1' },
      { field: 'clientes.regiao', op: 'in', value: 'sul, norte' },
    ])
  })
})

describe('withAccess / rlsAttrColumns', () => {
  it('acrescenta às condições do widget sem alterar o original', () => {
    const w = { id: 'w', conditions: [{ field: 'a.b', op: 'eq', value: '1' }] }
    const out = withAccess(w, { conditions: [{ field: 'c.d', op: 'eq', value: '2' }] })
    expect(out.conditions).toHaveLength(2)
    expect(w.conditions).toHaveLength(1)
    expect(withAccess(w, { conditions: [] })).toBe(w)
  })

  it('lista as colunas de usuário que a sessão precisa guardar', () => {
    const cols = rlsAttrColumns([{ ...byVendedor, bypass: { source: 'user.attr', attr: 'perfil', values: ['admin'] } }, { id: 'x', field: 'a.b', op: 'eq', source: 'user.email' }])
    expect(cols.sort()).toEqual(['perfil', 'vendedor_id'])
  })
})
