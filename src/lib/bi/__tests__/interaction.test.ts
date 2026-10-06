import { describe, it, expect } from 'vitest'
import {
  bucketRange, bucketConditions, nextGranularity, drillTarget, drillInto, applyDrill, drillConditions,
  makeCrossFilter, crossConditionsFor, toggleCrossFilter, type GroupInfo, type DrillLevel,
} from '../interaction'
import type { BiWidget } from '../widget'

const w = (p: Partial<BiWidget> = {}): BiWidget => ({ id: 'w1', title: 'Pedidos', type: 'bar', model_id: 'm', field: '*', calc: 'COUNT', group_by: 'pedidos.data_pedido', date_granularity: 'month', ...p } as BiWidget)

describe('bucketRange — rótulo do grupo → intervalo de datas', () => {
  it('dia, mês (inclusive fevereiro bissexto), ano e trimestre', () => {
    expect(bucketRange('day', '2026-03-05')).toEqual({ from: '2026-03-05', to: '2026-03-05' })
    expect(bucketRange('month', '2026-03')).toEqual({ from: '2026-03-01', to: '2026-03-31' })
    expect(bucketRange('month', '2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(bucketRange('year', '2026')).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(bucketRange('quarter', '2026-T2')).toEqual({ from: '2026-04-01', to: '2026-06-30' })
    expect(bucketRange('quarter', '2026-T4')).toEqual({ from: '2026-10-01', to: '2026-12-31' })
  })
  it('semana ISO: semana 1 de 2026 começa em 29/12/2025; semana 10 de 2026 em 02/03', () => {
    expect(bucketRange('week', '2026-S1')).toEqual({ from: '2025-12-29', to: '2026-01-04' })
    expect(bucketRange('week', '2026-S10')).toEqual({ from: '2026-03-02', to: '2026-03-08' })
    expect(bucketRange('week', '2026-S53')).not.toBeNull()
  })
  it('rótulo que não bate com a granularidade → null', () => {
    expect(bucketRange('month', '2026')).toBeNull()
    expect(bucketRange('quarter', '2026-03')).toBeNull()
    expect(bucketRange('semestre', '2026-1')).toBeNull()
  })
})

describe('bucketConditions', () => {
  it('data com granularidade vira "entre"', () => {
    const g: GroupInfo = { field: 'pedidos.data_pedido', kind: 'date', granularity: 'month' }
    expect(bucketConditions(g, '2026-03')).toEqual([{ field: 'pedidos.data_pedido', op: 'between', value: '2026-03-01', value2: '2026-03-31' }])
  })
  it('data sem granularidade compara o dia (corta a hora)', () => {
    const g: GroupInfo = { field: 'pedidos.data_pedido', kind: 'date' }
    expect(bucketConditions(g, '2026-03-05T10:20:00Z')).toEqual([{ field: 'pedidos.data_pedido', op: 'eq', value: '2026-03-05' }])
    expect(bucketConditions(g, 'ontem')).toEqual([])
  })
  it('texto e número viram igualdade; "N/A" vira vazio', () => {
    expect(bucketConditions({ field: 'pedidos.status', kind: 'text' }, 'Aprovado')).toEqual([{ field: 'pedidos.status', op: 'eq', value: 'Aprovado' }])
    expect(bucketConditions({ field: 'itens.qtd', kind: 'number' }, '5')).toEqual([{ field: 'itens.qtd', op: 'eq', value: '5' }])
    expect(bucketConditions({ field: 'pedidos.status', kind: 'text' }, 'N/A')).toEqual([{ field: 'pedidos.status', op: 'is_null' }])
  })
})

describe('drill-down', () => {
  const dateGroup: GroupInfo = { field: 'pedidos.data_pedido', kind: 'date', granularity: 'month' }
  it('escada de datas: ano → trimestre → mês → dia; semana → dia; dia não desce', () => {
    expect(nextGranularity('year')).toBe('quarter')
    expect(nextGranularity('quarter')).toBe('month')
    expect(nextGranularity('month')).toBe('day')
    expect(nextGranularity('week')).toBe('day')
    expect(nextGranularity('day')).toBeNull()
  })

  it('não detalha se a opção está desligada ou não há agrupamento', () => {
    expect(drillTarget(w(), [], dateGroup)).toBeNull()
    expect(drillTarget(w({ drill_detail: true, group_by: undefined }), [], dateGroup)).toBeNull()
  })

  it('mês → dia: abre o nível com o filtro do mês clicado', () => {
    const widget = w({ drill_detail: true })
    const lvl = drillInto(widget, [], dateGroup, '2026-03')!
    expect(lvl).toMatchObject({ group_by: 'pedidos.data_pedido', date_granularity: 'day', label: '2026-03' })
    expect(lvl.conds).toEqual([{ field: 'pedidos.data_pedido', op: 'between', value: '2026-03-01', value2: '2026-03-31' }])
    const eff = applyDrill(widget, [lvl])
    expect(eff.date_granularity).toBe('day')
    expect(eff.conditions).toEqual(lvl.conds)
    // o original não é alterado
    expect(widget.conditions).toBeUndefined()
  })

  it('no nível do dia não há mais para onde descer (sem drill_by)', () => {
    const widget = w({ drill_detail: true })
    const lvl = drillInto(widget, [], dateGroup, '2026-03')!
    expect(drillTarget(widget, [lvl], { ...dateGroup, granularity: 'day' })).toBeNull()
  })

  it('agrupamento que não é data usa a dimensão drill_by, uma vez só', () => {
    const widget = w({ group_by: 'produtos.categoria_id', date_granularity: undefined, drill_detail: true, drill_by: 'produtos.nome' })
    const g: GroupInfo = { field: 'categorias.nome', kind: 'text' }
    const lvl = drillInto(widget, [], g, 'Hardware')!
    expect(lvl).toMatchObject({ group_by: 'produtos.nome', label: 'Hardware' })
    expect(lvl.conds).toEqual([{ field: 'categorias.nome', op: 'eq', value: 'Hardware' }])
    expect(drillTarget(widget, [lvl], { field: 'produtos.nome', kind: 'text' })).toBeNull()
  })

  it('níveis acumulam os filtros do caminho', () => {
    const widget = w({ drill_detail: true, group_by: 'pedidos.data_pedido', date_granularity: 'year' })
    const l1 = drillInto(widget, [], { field: 'pedidos.data_pedido', kind: 'date', granularity: 'year' }, '2026')!
    const l2 = drillInto(widget, [l1], { field: 'pedidos.data_pedido', kind: 'date', granularity: 'quarter' }, '2026-T1')!
    expect(l2.date_granularity).toBe('month')
    const stack: DrillLevel[] = [l1, l2]
    expect(drillConditions(stack)).toHaveLength(2)
    expect(applyDrill(widget, stack).conditions).toHaveLength(2)
  })

  it('rótulo irreconhecível não abre nível', () => {
    expect(drillInto(w({ drill_detail: true }), [], dateGroup, 'xyz')).toBeNull()
  })
})

describe('filtro cruzado', () => {
  const source = w({ id: 'src', title: 'Pedidos por status', cross_source: true, group_by: 'pedidos.status', date_granularity: undefined })
  const g: GroupInfo = { field: 'pedidos.status', kind: 'text' }

  it('o clique vira filtro; clicar de novo no mesmo valor limpa; outro valor substitui', () => {
    const a = makeCrossFilter(source, g, 'Aprovado')!
    expect(a).toMatchObject({ sourceId: 'src', name: 'Aprovado', sourceTitle: 'Pedidos por status' })
    let state = toggleCrossFilter({}, a)
    expect(Object.keys(state)).toEqual(['src'])
    state = toggleCrossFilter(state, makeCrossFilter(source, g, 'Enviado')!)
    expect(state.src.name).toBe('Enviado')
    state = toggleCrossFilter(state, makeCrossFilter(source, g, 'Enviado')!)
    expect(state).toEqual({})
  })

  it('só os widgets que respondem recebem as condições, e nunca o próprio gráfico clicado', () => {
    const f = makeCrossFilter(source, g, 'Aprovado')!
    expect(crossConditionsFor(w({ id: 'a', cross_target: true }), [f])).toEqual(f.conds)
    expect(crossConditionsFor(w({ id: 'b' }), [f])).toEqual([])
    expect(crossConditionsFor({ ...source, cross_target: true }, [f])).toEqual([])
  })

  it('vários filtros somam (E)', () => {
    const other = w({ id: 'o', title: 'Mês', cross_source: true })
    const f1 = makeCrossFilter(source, g, 'Aprovado')!
    const f2 = makeCrossFilter(other, { field: 'pedidos.data_pedido', kind: 'date', granularity: 'month' }, '2026-03')!
    expect(crossConditionsFor(w({ id: 't', cross_target: true }), [f1, f2])).toHaveLength(2)
  })

  it('grupo sem condição possível não vira filtro', () => {
    expect(makeCrossFilter(source, null, 'x')).toBeNull()
    expect(makeCrossFilter(source, { field: 'p.d', kind: 'date' }, 'ontem')).toBeNull()
  })
})
