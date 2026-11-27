import { describe, it, expect } from 'vitest'
import { filterFlows, filterTables, norm, sortFlows, sortTables } from '../hubSort'

const tables = [
  { name: 'pedidos', count: 7 }, { name: 'clientes', count: 0 }, { name: 'Entregas', count: 2 }, { name: 'água', count: 2 }, { name: 'zebra', count: 0 },
]
const names = (l: { name: string }[]) => l.map(x => x.name)

describe('painel de automações: tabelas', () => {
  it('ordena pelo nome, sem diferenciar maiúsculas nem acentos', () => {
    expect(names(sortTables(tables, 'name_asc'))).toEqual(['água', 'clientes', 'Entregas', 'pedidos', 'zebra'])
    expect(names(sortTables(tables, 'name_desc'))).toEqual(['zebra', 'pedidos', 'Entregas', 'clientes', 'água'])
  })

  it('ordena pela quantidade de fluxos; o empate sempre se desfaz pelo nome A-Z', () => {
    expect(names(sortTables(tables, 'count_desc'))).toEqual(['pedidos', 'água', 'Entregas', 'clientes', 'zebra'])
    expect(names(sortTables(tables, 'count_asc'))).toEqual(['clientes', 'zebra', 'água', 'Entregas', 'pedidos'])
  })

  it('não altera a lista original', () => {
    const copy = [...tables]
    sortTables(tables, 'name_desc')
    expect(tables).toEqual(copy)
  })

  it('a busca acha sem acento e sem maiúsculas; vazia devolve tudo', () => {
    expect(names(filterTables(tables, 'AGUA'))).toEqual(['água'])
    expect(names(filterTables(tables, 'ent'))).toEqual(['clientes', 'Entregas'])
    expect(filterTables(tables, '   ')).toHaveLength(5)
    expect(filterTables(tables, 'xyz')).toEqual([])
  })
})

describe('painel de automações: fluxos', () => {
  const flows = [
    { name: 'Exclusão de Pedido', scopes: ['pedidos'] },
    { name: 'Aviso de entrega', scopes: ['entregas'] },
    { name: 'Confirmação', scopes: ['pedidos'] },
    { name: 'Sem tabela', scopes: [] },
    { name: 'Entre tabelas', scopes: ['clientes', 'pedidos'] },
  ]

  it('só pelo nome, nos dois sentidos', () => {
    expect(names(sortFlows(flows, 'name_asc'))).toEqual(['Aviso de entrega', 'Confirmação', 'Entre tabelas', 'Exclusão de Pedido', 'Sem tabela'])
    expect(names(sortFlows(flows, 'name_desc'))).toEqual(['Sem tabela', 'Exclusão de Pedido', 'Entre tabelas', 'Confirmação', 'Aviso de entrega'])
  })

  it('por tabela e depois nome, nos dois sentidos (sem tabela vem primeiro em A-Z)', () => {
    expect(names(sortFlows(flows, 'table_asc'))).toEqual(['Sem tabela', 'Entre tabelas', 'Aviso de entrega', 'Confirmação', 'Exclusão de Pedido'])
    expect(names(sortFlows(flows, 'table_desc'))).toEqual(['Exclusão de Pedido', 'Confirmação', 'Aviso de entrega', 'Entre tabelas', 'Sem tabela'])
  })

  it('a busca acha pelo nome do fluxo ou pelo de qualquer uma das tabelas', () => {
    expect(names(filterFlows(flows, 'pedido'))).toEqual(['Exclusão de Pedido', 'Confirmação', 'Entre tabelas'])
    expect(names(filterFlows(flows, 'CONFIRMACAO'))).toEqual(['Confirmação'])
    expect(filterFlows(flows, '')).toHaveLength(5)
  })

  it('norm tira acento e caixa', () => {
    expect(norm('Ação ÇÃO')).toBe('acao cao')
    expect(norm(undefined as any)).toBe('')
  })
})
