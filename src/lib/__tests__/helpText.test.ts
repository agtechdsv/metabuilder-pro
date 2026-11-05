import { describe, it, expect } from 'vitest'
import { normalizeHelp, hasHelp, resolveHelp, helpCoverage } from '../helpText'

describe('ajuda contextual (dica de campo e de tela)', () => {
  it('normaliza texto simples como português e descarta o que não é texto', () => {
    expect(normalizeHelp('  Informe o CNPJ  ')).toEqual({ pt: 'Informe o CNPJ' })
    expect(normalizeHelp({ pt: 'a', en: ' b ', es: '', xx: 'z' })).toEqual({ pt: 'a', en: 'b' })
    expect(normalizeHelp({ pt: 12, en: null })).toEqual({})
    expect(normalizeHelp(null)).toEqual({})
    expect(normalizeHelp(['a'])).toEqual({})
    expect(normalizeHelp('   ')).toEqual({})
  })

  it('limita o tamanho do texto', () => {
    expect(normalizeHelp({ pt: 'x'.repeat(5000) }).pt).toHaveLength(2000)
  })

  it('hasHelp só é verdadeiro com algum texto', () => {
    expect(hasHelp({ pt: 'a' })).toBe(true)
    expect(hasHelp({ pt: '  ' })).toBe(false)
    expect(hasHelp(undefined)).toBe(false)
  })

  it('usa o idioma da tela e cai para pt, en, es nessa ordem', () => {
    const help = { pt: 'Português', en: 'English', es: 'Español' }
    expect(resolveHelp(help, 'en')).toBe('English')
    expect(resolveHelp({ pt: 'Português', es: 'Español' }, 'en')).toBe('Português')
    expect(resolveHelp({ en: 'English', es: 'Español' }, 'pt')).toBe('English')
    expect(resolveHelp({ es: 'Español' }, 'pt')).toBe('Español')
    expect(resolveHelp(help, 'fr')).toBe('Português')
    expect(resolveHelp({}, 'pt')).toBe('')
  })

  it('conta os campos do formulário que têm dica; a chave da zona tem prioridade', () => {
    const meta = {
      a: { label: { help: { pt: 'x' } } },
      'form-b': { label: { help: { en: 'y' } } },
      c: { label: { text: 'sem dica' } },
    }
    expect(helpCoverage(['a', 'b', 'c', 'd'], meta)).toEqual({ withHelp: 2, total: 4 })
    expect(helpCoverage([], meta)).toEqual({ withHelp: 0, total: 0 })
    expect(helpCoverage(['a'], undefined)).toEqual({ withHelp: 0, total: 1 })
  })
})

import { setFieldHelp, getFieldHelp } from '../helpText'

describe('edição em lote da dica de campo', () => {
  it('grava na chave base e na do formulário, sem perder o resto', () => {
    const meta = { f1: { label: { text: 'CNPJ' }, component: { type: 'text' } }, 'form-f1': { label: { text: 'CNPJ' }, component: { type: 'mask' } } }
    const out = setFieldHelp(meta, 'f1', { pt: 'Só números' })
    expect(out.f1.label).toEqual({ text: 'CNPJ', help: { pt: 'Só números' } })
    expect(out['form-f1'].component.type).toBe('mask')
    expect(getFieldHelp(out, 'f1')).toEqual({ pt: 'Só números' })
    expect(meta.f1.label).toEqual({ text: 'CNPJ' }) // não altera o original
  })

  it('campo sem metadados ganha a entrada; dica vazia remove só o help', () => {
    const out = setFieldHelp(undefined, 'f2', { en: 'Digits' })
    expect(getFieldHelp(out, 'f2')).toEqual({ en: 'Digits' })
    const cleared = setFieldHelp(out, 'f2', { en: '' })
    expect(getFieldHelp(cleared, 'f2')).toBeUndefined()
    expect(cleared.f2.component.type).toBe('text')
  })
})

import { collectHelpCenter, searchHelpCenter } from '../helpText'

describe('Central de Ajuda', () => {
  const views = [
    { id: 'v2', slug: 'pedidos', name: 'Pedidos', model: { fields: [{ id: 'f9', display_name: 'Cliente' }] },
      layout_config: { screen_help: { pt: 'Lista os pedidos', en: 'Lists orders' }, form_fields: ['f9', 'f8'], fields_metadata: { f9: { label: { help: { pt: 'Quem comprou' } } } } } },
    { id: 'v1', slug: 'sem', name: 'Sem ajuda', layout_config: { form_fields: ['x'] } },
    { id: 'v3', slug: 'cad', name: 'Cadastro', layout_config: { form_fields: [{ id: 'c1' }], fields_metadata: { 'form-c1': { label: { text: 'CNPJ', help: { pt: 'Só números' } } } } } },
  ]

  it('junta só o que tem ajuda, no idioma pedido, com o nome do campo', () => {
    const r = collectHelpCenter(views, 'en')
    expect(r.map(e => e.name)).toEqual(['Cadastro', 'Pedidos'])
    const pedidos = r.find(e => e.slug === 'pedidos')!
    expect(pedidos.screen).toBe('Lists orders')
    expect(pedidos.fields).toEqual([{ id: 'f9', label: 'Cliente', text: 'Quem comprou', zones: ['form'] }]) // cai para português
    expect(r[0].fields[0].label).toBe('CNPJ')
  })

  it('a busca ignora acento e maiúsculas e mantém só os campos que casam', () => {
    const all = collectHelpCenter(views, 'pt')
    expect(searchHelpCenter(all, 'NUMEROS').map(e => e.slug)).toEqual(['cad'])
    expect(searchHelpCenter(all, 'pedidos')[0].fields).toHaveLength(1)
    expect(searchHelpCenter(all, '')).toHaveLength(2)
  })
})

import { setZoneHelp, clearZoneHelp, getZoneHelp } from '../helpText'

describe('ajuda por zona com herança', () => {
  const base = () => ({ f1: { label: { text: 'Nome' }, component: { type: 'text' } }, 'grid-f1': { label: { text: 'Nome' }, component: { type: 'text' } } })

  it('a dica padrão vale em todas as zonas e chega às chaves de zona existentes', () => {
    const m = setFieldHelp(base(), 'f1', { pt: 'Razão social' })
    expect(getZoneHelp(m, 'f1', 'form')).toEqual({ help: { pt: 'Razão social' }, custom: false })
    expect(getZoneHelp(m, 'f1', 'grid')).toEqual({ help: { pt: 'Razão social' }, custom: false })
    expect(m['grid-f1'].label.help).toEqual({ pt: 'Razão social' }) // o app publicado lê a chave da zona
  })

  it('texto próprio da zona não é trocado pela dica padrão e some ao voltar a herdar', () => {
    let m = setFieldHelp(base(), 'f1', { pt: 'Padrão' })
    m = setZoneHelp(m, 'f1', 'form', { pt: 'Só do formulário' })
    expect(getZoneHelp(m, 'f1', 'form')).toEqual({ help: { pt: 'Só do formulário' }, custom: true })
    expect(m['form-f1'].component.type).toBe('text') // criou a chave da zona a partir da base

    m = setFieldHelp(m, 'f1', { pt: 'Padrão novo' })
    expect(getZoneHelp(m, 'f1', 'form').help).toEqual({ pt: 'Só do formulário' })
    expect(getZoneHelp(m, 'f1', 'grid').help).toEqual({ pt: 'Padrão novo' })

    m = clearZoneHelp(m, 'f1', 'form')
    expect(getZoneHelp(m, 'f1', 'form')).toEqual({ help: { pt: 'Padrão novo' }, custom: false })
    expect(m['form-f1'].label.help_custom).toBeUndefined()
  })

  it('dado antigo (texto replicado só nas zonas) conta como padrão', () => {
    const old = { 'form-f1': { label: { help: { pt: 'Velho' } } }, 'grid-f1': { label: { help: { pt: 'Velho' } } } }
    expect(getFieldHelp(old, 'f1')).toEqual({ pt: 'Velho' })
    expect(helpCoverage(['f1'], old)).toEqual({ withHelp: 1, total: 1 })
  })
})
