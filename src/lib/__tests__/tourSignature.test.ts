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
