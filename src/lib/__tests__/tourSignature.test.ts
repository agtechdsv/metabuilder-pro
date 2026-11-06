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
      'click:tab:m-ped', 'click:button:detail-add', 'type:field:p_data',
      'click:button:save', 'click:button:back', 'note:row:first',
    ])
  })

  it('editar também passa pela aba; excluir, pesquisar e ver não', () => {
    expect(shape(buildAutoTour(input, { action: 'edit' }))).toContain('click:tab:m-ped')
    for (const a of ['delete', 'search', 'view'] as const) expect(shape(buildAutoTour(input, { action: a }))).not.toContain('click:tab:m-ped')
  })

  it('sem campos de detalhe o roteiro não muda', () => {
    const so = { ...input, formFields: input.formFields.slice(0, 1) }
    expect(shape(buildAutoTour(so, { action: 'create' }))).not.toContain('click:button:detail-add')
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
