import { describe, it, expect } from 'vitest'
import { sectionsOf, moveWidget, moveGroup, addGroup, renameGroup, removeGroup, normalizeOrder, type BiGroup } from '../groups'

const w = (id: string, group_id?: string) => ({ id, group_id })
const groups: BiGroup[] = [{ id: 'A', title: 'Visão Geral' }, { id: 'B', title: 'Evolução' }]
const ids = (list: { id: string }[]) => list.map(x => x.id).join(',')

describe('sectionsOf', () => {
  it('soltos primeiro, depois os grupos na ordem; grupo vazio continua existindo', () => {
    const s = sectionsOf([w('1', 'B'), w('2'), w('3', 'A'), w('4', 'A')], groups)
    expect(s.map(x => x.group?.id ?? 'none')).toEqual(['none', 'A', 'B'])
    expect(s.map(x => ids(x.widgets))).toEqual(['2', '3,4', '1'])
    expect(sectionsOf([], groups).map(x => x.widgets.length)).toEqual([0, 0, 0])
  })
  it('widget com grupo inexistente vira solto', () => {
    expect(ids(sectionsOf([w('1', 'ZZZ')], groups)[0].widgets)).toBe('1')
  })
})

describe('moveWidget', () => {
  const base = [w('1'), w('2', 'A'), w('3', 'A'), w('4', 'B')]
  it('reordena dentro do mesmo grupo', () => {
    const r = moveWidget(base, groups, '2', 'A', 1)
    expect(ids(r)).toBe('1,3,2,4')
    expect(r.find(x => x.id === '2')?.group_id).toBe('A')
  })
  it('passa para outro grupo na posição indicada', () => {
    const r = moveWidget(base, groups, '2', 'B', 0)
    expect(ids(r)).toBe('1,3,2,4')
    expect(r.find(x => x.id === '2')?.group_id).toBe('B')
  })
  it('vai para o fim do grupo e para um grupo vazio', () => {
    expect(ids(moveWidget(base, groups, '1', 'B', 'end'))).toBe('2,3,4,1')
    const withEmpty: BiGroup[] = [...groups, { id: 'C', title: 'Vazio' }]
    const r = moveWidget(base, withEmpty, '4', 'C', 'end')
    expect(r.find(x => x.id === '4')?.group_id).toBe('C')
    expect(ids(r)).toBe('1,2,3,4')
  })
  it('para solto (null) tira o group_id e sobe para o topo', () => {
    const r = moveWidget(base, groups, '3', null, 'end')
    expect(r.find(x => x.id === '3')?.group_id).toBeUndefined()
    expect(ids(r)).toBe('1,3,2,4')
  })
  it('grupo de destino desconhecido cai em solto; widget desconhecido não muda nada', () => {
    expect(moveWidget(base, groups, '2', 'ZZZ', 'end').find(x => x.id === '2')?.group_id).toBeUndefined()
    expect(moveWidget(base, groups, 'nope', 'A', 0)).toBe(base)
  })
  it('não perde nem duplica widgets', () => {
    const r = moveWidget(base, groups, '4', 'A', 1)
    expect([...r.map(x => x.id)].sort()).toEqual(['1', '2', '3', '4'])
  })
})

describe('grupos', () => {
  it('moveGroup troca a posição', () => {
    expect(moveGroup(groups, 'B', 0).map(g => g.id)).toEqual(['B', 'A'])
    expect(moveGroup(groups, 'A', 99).map(g => g.id)).toEqual(['B', 'A'])
    expect(moveGroup(groups, 'zz', 0)).toBe(groups)
  })
  it('addGroup e renameGroup', () => {
    expect(addGroup(groups, '  Metas ', 'C')[2]).toEqual({ id: 'C', title: 'Metas' })
    expect(addGroup(groups, '   ', 'C')[2].title).toBe('Novo grupo')
    expect(renameGroup(groups, 'A', ' Resumo ')[0].title).toBe('Resumo')
    expect(renameGroup(groups, 'A', '   ')).toBe(groups)
  })
  it('removeGroup solta os widgets e não apaga nenhum', () => {
    const r = removeGroup(groups, [w('1', 'A'), w('2', 'B'), w('3')], 'A')
    expect(r.groups.map(g => g.id)).toEqual(['B'])
    expect(r.widgets.map(x => `${x.id}:${x.group_id ?? '-'}`)).toEqual(['1:-', '3:-', '2:B'])
  })
  it('normalizeOrder põe o array na ordem da tela', () => {
    expect(ids(normalizeOrder([w('1', 'B'), w('2'), w('3', 'A')], groups))).toBe('2,3,1')
  })
})
