import { describe, expect, it } from 'vitest'
import { buildAutoTour } from '../interactiveHelp/autoTour'
import { hasLikelyStaleTours, isLikelyStale, layoutSignature } from '../interactiveHelp/signature'

const base = () => ({
  form_fields: ['nome', 'email'],
  grid_fields: ['nome'],
  filter_fields: ['nome'],
  fields_metadata: {
    nome: { label: { text: 'Nome', help: 'Ajuda' }, content: { required: true }, component: { type: 'text' } },
    email: { label: { text: 'E-mail' }, component: { type: 'text' } },
  } as Record<string, any>,
})

describe('layoutSignature', () => {
  it('não muda com texto de ajuda, estilo ou zona que a ação não usa', () => {
    const a = layoutSignature(base(), 'create', 'Clientes')
    const lc: any = base()
    lc.fields_metadata.nome.label.help = 'Outra ajuda'
    lc.fields_metadata.nome.style = { color: 'red' }
    lc.filter_fields = ['nome', 'email']
    lc.grid_fields = ['email']
    expect(layoutSignature(lc, 'create', 'Clientes')).toBe(a)
  })

  it('muda com campo novo, rótulo, obrigatório, ordem e nome da tela', () => {
    const a = layoutSignature(base(), 'create', 'Clientes')
    const novo: any = base(); novo.form_fields.push('cpf')
    const rotulo: any = base(); rotulo.fields_metadata.email.label.text = 'Correio'
    const obrig: any = base(); obrig.fields_metadata.email.content = { required: true }
    const ordem: any = base(); ordem.form_fields = ['email', 'nome']
    for (const lc of [novo, rotulo, obrig, ordem]) expect(layoutSignature(lc, 'create', 'Clientes')).not.toBe(a)
    expect(layoutSignature(base(), 'create', 'Outro')).not.toBe(a)
  })

  it('pesquisar também observa o filtro', () => {
    const a = layoutSignature(base(), 'search', 'Clientes')
    const lc: any = base(); lc.filter_fields = ['nome', 'email']
    expect(layoutSignature(lc, 'search', 'Clientes')).not.toBe(a)
  })

  it('usa os metadados da zona quando existem', () => {
    const a = layoutSignature(base(), 'create', 'Clientes')
    const lc: any = base(); lc.fields_metadata['form-email'] = { label: { text: 'Mail' } }
    expect(layoutSignature(lc, 'create', 'Clientes')).not.toBe(a)
  })
})

describe('roteiro provavelmente desatualizado', () => {
  const input: any = { formFields: [{ id: 'nome', label: 'Nome', required: true, type: 'text' }], filterFields: [], gridFields: [] }

  it('buildAutoTour grava a assinatura quando recebe o layout', () => {
    const lc = base()
    const tour = buildAutoTour(input, { action: 'create', screenName: 'Clientes', layoutConfig: lc })
    expect(tour.sourceSig).toBe(layoutSignature(lc, 'create', 'Clientes'))
    expect(isLikelyStale(tour, lc, 'Clientes')).toBe(false)
  })

  it('detecta mudança depois de gerar e o roteiro antigo (sem assinatura)', () => {
    const lc: any = base()
    const tour = buildAutoTour(input, { action: 'create', screenName: 'Clientes', layoutConfig: lc })
    lc.form_fields.push('cpf')
    expect(isLikelyStale(tour, lc, 'Clientes')).toBe(true)
    const antigo = { ...tour, sourceSig: undefined }
    expect(isLikelyStale(antigo, base(), 'Clientes')).toBe(true)
  })

  it('hasLikelyStaleTours só olha casos de uso que têm roteiros', () => {
    const lc: any = base()
    expect(hasLikelyStaleTours(lc, 'Clientes')).toBe(false)
    const tour = buildAutoTour(input, { action: 'create', screenName: 'Clientes', layoutConfig: lc })
    lc.interactive_help = { tours: [tour] }
    expect(hasLikelyStaleTours(lc, 'Clientes')).toBe(false)
    lc.form_fields.push('cpf')
    expect(hasLikelyStaleTours(lc, 'Clientes')).toBe(true)
  })
})

describe('isTourStale depois de passar pelo jsonb', () => {
  it('não acusa desatualizado quando o banco reordena as chaves dos textos', async () => {
    const { isTourStale } = await import('../interactiveHelp/autoTour')
    const input: any = { formFields: [{ id: 'nome', label: 'Nome', column: 'nome', required: true, type: 'text' }], filterFields: [], gridFields: [] }
    const tour = buildAutoTour(input, { action: 'create', screenName: 'Clientes' })
    const reordenar = (v: any): any => Array.isArray(v) ? v.map(reordenar) : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).sort().reverse().map(k => [k, reordenar(v[k])])) : v
    const voltou = JSON.parse(JSON.stringify(reordenar(tour)))
    expect(isTourStale(voltou, input, { action: 'create', screenName: 'Clientes' })).toBe(false)
  })
})

describe('abas de detalhe no roteiro', () => {
  const f = (id: string, extra: any = {}) => ({ id, label: id, column: id, type: 'text', ...extra })
  const input: any = {
    formFields: [
      f('nome', { required: true }),
      f('p_data', { isDetail: true, detailModelId: 'm-ped', required: true }),
      f('p_obs', { isDetail: true, detailModelId: 'm-ped' }),
      f('p_id', { isDetail: true, detailModelId: 'm-ped', isPrimaryKey: true }),
    ],
    filterFields: [],
    gridFields: [],
  }
  const shape = (t: any) => t.steps.map((s: any) => `${s.kind}:${s.target?.type}:${s.target?.ref}`)

  it('cadastrar: abre a aba, clica em + e preenche o item antes de salvar', () => {
    const steps = shape(buildAutoTour(input, { action: 'create' }))
    expect(steps).toEqual([
      'click:button:new', 'type:field:nome',
      'click:tab:m-ped', 'click:detail-add:m-ped', 'type:field:p_data',
      'click:button:save', 'click:button:back', 'note:row:first',
    ])
  })

  it('editar também passa pela aba; excluir, pesquisar e ver não', () => {
    expect(shape(buildAutoTour(input, { action: 'edit' }))).toContain('click:tab:m-ped')
    for (const a of ['delete', 'search', 'view'] as const) expect(shape(buildAutoTour(input, { action: a }))).not.toContain('click:tab:m-ped')
  })

  it('sem campos de detalhe o roteiro não muda', () => {
    const so = { ...input, formFields: input.formFields.slice(0, 1) }
    expect(shape(buildAutoTour(so, { action: 'create' }))).not.toContain('click:detail-add:m-ped')
  })
})

describe('autocomplete no gerador', () => {
  it('vira passo "buscar e escolher" com termo vazio, e o valor do dev sobrevive ao regenerar', async () => {
    const { regenerateTour } = await import('../interactiveHelp/autoTour')
    const input: any = { formFields: [{ id: 'prod', label: 'Produto', column: 'produto_id', component: 'autocomplete', required: true }], filterFields: [], gridFields: [] }
    const tour = buildAutoTour(input, { action: 'create' })
    const s = tour.steps.find(x => x.target?.type === 'field')!
    expect([s.kind, s.value]).toEqual(['select', ''])
    const editado = { ...tour, steps: tour.steps.map(x => (x.id === s.id ? { ...x, value: 'caneta', edited: true } : x)) }
    const novo = regenerateTour(editado, input, { action: 'create' })
    expect(novo.steps.find(x => x.target?.type === 'field')!.value).toBe('caneta')
  })
})

describe('dois níveis de detalhe (Pedidos e Itens do Pedido)', () => {
  it('cada nível clica no + do seu próprio modelo', () => {
    const f = (id: string, m: string) => ({ id, label: id, column: id, type: 'text', isDetail: true, detailModelId: m, required: true })
    const input: any = { formFields: [{ id: 'n', label: 'n', column: 'n', type: 'text', required: true }, f('data', 'm-ped'), f('qtd', 'm-item')], filterFields: [], gridFields: [] }
    const adds = buildAutoTour(input, { action: 'create' }).steps.filter(s => s.target?.type === 'detail-add').map(s => s.target?.ref)
    expect(adds).toEqual(['m-ped', 'm-item'])
  })
})

describe('editar passa pelo detalhe expandindo o registro existente', () => {
  const f = (id: string, extra: any = {}) => ({ id, label: id, column: id, type: 'text', dataType: 'text', ...extra })
  const input: any = { formFields: [f('nome', { required: true }), f('obs', { isDetail: true, detailModelId: 'm-ped' }), f('qtd', { isDetail: true, detailModelId: 'm-item' })], filterFields: [], gridFields: [] }
  it('aba, seta de expandir e campos alterados, sem adicionar item', () => {
    const steps = buildAutoTour(input, { action: 'edit' }).steps.map(s => `${s.kind}:${s.target?.type}:${s.target?.ref}`)
    expect(steps).toContain('click:detail-expand:m-ped')
    expect(steps).toContain('click:detail-expand:m-item')
    expect(steps.some(s => s.includes('detail-add'))).toBe(false)
    expect(steps.indexOf('click:detail-expand:m-ped')).toBeLessThan(steps.indexOf('type:field:obs'))
  })
})

describe('ajuda interativa de Kanban, agenda e BI', () => {
  const f = (id: string, extra: any = {}) => ({ id, label: id, column: id, type: 'text', dataType: 'text', ...extra })
  const input: any = { formFields: [f('titulo', { required: true }), f('desc')], filterFields: [f('cliente'), f('func')], gridFields: [] }
  const shape = (t: any) => t.steps.map((s: any) => `${s.kind}:${s.target?.type ?? '-'}:${s.target?.ref ?? '-'}`)

  it('quais ações cada tipo suporta', async () => {
    const { tourActionsFor, supportsInteractiveHelp } = await import('../interactiveHelp/types')
    expect([...tourActionsFor('kanban')]).toEqual(['create', 'edit', 'move', 'delete'])
    expect([...tourActionsFor('scheduler')]).toEqual(['create', 'edit', 'delete'])
    expect([...tourActionsFor('analytics')]).toEqual(['search'])
    expect(supportsInteractiveHelp('gantt')).toBe(false)
  })

  it('Kanban: cria pelo + da coluna, edita pelo lápis, exclui pela lixeira e arrasta para outra coluna', () => {
    const v = { viewType: 'kanban' }
    expect(shape(buildAutoTour(input, { action: 'create', ...v }))).toEqual(['click:button:kanban-add', 'type:field:titulo', 'click:button:save', 'note:-:-'])
    expect(shape(buildAutoTour(input, { action: 'edit', ...v }))[0]).toBe('click:button:kanban-edit')
    expect(shape(buildAutoTour(input, { action: 'delete', ...v }))).toEqual(['click:button:kanban-delete', 'click:button:confirm', 'note:-:-'])
    const move = buildAutoTour(input, { action: 'move', ...v })
    expect(move.steps[0]).toMatchObject({ kind: 'drag', target: { ref: 'kanban-card' }, to: { type: 'kanban-column', ref: 'other' } })
    expect(move.seed).toBeUndefined()
  })

  it('agenda: + no dia, clique no evento e lixeira; leva o evento de exemplo com a data de hoje', async () => {
    const { buildSchedulerSeed } = await import('../interactiveHelp/fieldInfo')
    const models = [{ fields: [
      { id: 'd', db_column_name: 'data_entrega', data_type: 'timestamp with time zone' },
      { id: 't', db_column_name: 'descricao', data_type: 'text' },
    ] }]
    const ss = buildSchedulerSeed({ scheduler_config: { start_date_field: 'd', title_field: 't' } }, models, new Date(2026, 10, 6))!
    expect(ss.seed).toEqual({ data_entrega: '2026-11-06T10:00:00', descricao: 'Evento de exemplo' })
    expect(ss.seedToday).toEqual({ data_entrega: 'datetime' })
    const v = { viewType: 'scheduler', schedulerSeed: ss }
    expect(shape(buildAutoTour(input, { action: 'create', ...v }))[0]).toBe('click:button:scheduler-add')
    const edit = buildAutoTour(input, { action: 'edit', ...v })
    expect(shape(edit)[0]).toBe('click:button:scheduler-event')
    expect(edit.seed).toEqual(ss.seed)
    expect(edit.seedToday).toEqual(ss.seedToday)
    expect(buildAutoTour(input, { action: 'create', ...v }).seed).toBeUndefined()
    expect(shape(buildAutoTour(input, { action: 'delete', ...v }))[0]).toBe('click:button:scheduler-delete')
  })

  it('agenda sem campo de início configurado não gera linha de exemplo', async () => {
    const { buildSchedulerSeed } = await import('../interactiveHelp/fieldInfo')
    expect(buildSchedulerSeed({ scheduler_config: {} }, [])).toBeUndefined()
  })

  it('BI: preenche os filtros, pesquisa, observa os gráficos e limpa', () => {
    const steps = shape(buildAutoTour(input, { action: 'search', viewType: 'analytics' }))
    expect(steps).toEqual(['type:filter:cliente', 'type:filter:func', 'click:button:search', 'note:button:widget', 'click:button:clear'])
  })
})
