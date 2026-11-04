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
