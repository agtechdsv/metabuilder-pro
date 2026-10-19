import { describe, it, expect } from 'vitest'
import { aplicarMascara, describeName, isSupportedView, mascaraDePadrao, planView } from '../plan'
import { eventLine, parseTestEvent, statusFromPlaywright } from '../results'
import type { ManifestField, ManifestView } from '../manifestTypes'

const campo = (column: string, extra: Partial<ManifestField> = {}): ManifestField =>
  ({ column, label: column, dataType: 'varchar', required: false, readOnly: false, isPrimaryKey: false, hasFormula: false, ...extra })

const view = (over: Partial<ManifestView> = {}): ManifestView => ({
  slug: 'clientes', path: '/clientes', title: 'Clientes', logicType: 'pesquisa_cadastro', table: 'clientes', primaryKey: 'id', displayType: 'list',
  actionInterface: 'page', filter: [], grid: [], form: [campo('id', { isPrimaryKey: true }), campo('nome', { required: true })], buttons: [], exportFormats: [], details: [], ...over,
})

describe('plano de testes de um caso de uso', () => {
  it('Pesquisa + Cadastro: lista e formulário sempre; obrigatórios só se há campo obrigatório', () => {
    const p = planView(view())
    expect(p.map(t => t.kind)).toEqual(['lista', 'formulario', 'obrigatorios'])
    expect(planView(view({ form: [campo('nome')] })).map(t => t.kind)).toEqual(['lista', 'formulario'])
  })

  it('um teste de máscara por campo com máscara de padrão fixo; máscara numérica não entra', () => {
    const p = planView(view({ form: [campo('cnpj', { label: 'CNPJ', mask: '00.000.000/0000-00' }), campo('valor', { mask: '0.000,00' }), campo('cep', { mask: '00000-000' })] }))
    expect(p.filter(t => t.kind === 'mascara').map(t => t.field)).toEqual(['cnpj', 'cep'])
    expect(mascaraDePadrao('0.000,00')).toBe(false)
    expect(mascaraDePadrao('(00) 00000-0000')).toBe(true)
  })

  it('tipos de tela sem gabarito não geram testes (aparecem como "ainda sem teste automático")', () => {
    expect(isSupportedView(view({ logicType: 'kanban' }))).toBe(false)
    expect(planView(view({ logicType: 'kanban' }))).toEqual([])
  })

  it('aplicarMascara: cada 0 consome um dígito e o resto é literal', () => {
    expect(aplicarMascara('12345678901234', '00.000.000/0000-00')).toBe('12.345.678/9012-34')
    expect(aplicarMascara('123', '00000-000')).toBe('123')
    expect(aplicarMascara('1234567', '00000-000')).toBe('12345-67')
  })

  it('o nome do grupo é o mesmo que o teste usa no describe', () => {
    expect(describeName(view())).toBe('Clientes (clientes) · pesquisa_cadastro')
  })
})

describe('leitura dos eventos do relator', () => {
  it('ida e volta de um evento, mesmo no meio de outras linhas da saída', () => {
    const ev = { t: 'end' as const, group: 'Clientes (clientes) · pesquisa_cadastro', title: 'lista: ...', status: 'failed' as const, ms: 1200, error: 'campo "X" não visível' }
    expect(parseTestEvent('  [WebServer] ruído ' + eventLine(ev))).toEqual(ev)
    expect(parseTestEvent(eventLine({ t: 'done', total: 4, passed: 3, failed: 1, skipped: 0 }))).toMatchObject({ t: 'done', total: 4 })
  })

  it('linhas que não são do relator ou estão quebradas viram null', () => {
    expect(parseTestEvent('  ok 1 [dynamic-pg-node] › ...')).toBeNull()
    expect(parseTestEvent('@@MB@@{quebrado')).toBeNull()
    expect(parseTestEvent('@@MB@@{"t":"outra"}')).toBeNull()
  })

  it('status do Playwright → status do painel', () => {
    expect(statusFromPlaywright('passed')).toBe('passed')
    expect(statusFromPlaywright('skipped')).toBe('skipped')
    expect(statusFromPlaywright('timedOut')).toBe('failed')
    expect(statusFromPlaywright('failed')).toBe('failed')
  })
})
