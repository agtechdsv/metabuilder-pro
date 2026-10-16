import { describe, it, expect } from 'vitest'
import ts from 'typescript'
import { generateRelationSectionComponent } from '../layers/components/relation-section'

const syntax = (src: string) => (ts.transpileModule(src, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.Preserve, module: ts.ModuleKind.ESNext } }).diagnostics || []).length === 0

describe('subdetalhe (ex.: itens do pedido) nas abas do app gerado', () => {
  const files = new Map<string, string>()
  generateRelationSectionComponent(files, 'pt')
  const src = files.get('components/DetailRelationSection.tsx')!

  it('o + do subdetalhe adiciona uma linha na própria lista (já aberta), como na plataforma; o ↗ abre a modal do item', () => {
    expect(syntax(src)).toBe(true)
    const at = src.indexOf('// nova linha na própria lista, já aberta para preencher')
    expect(at).toBeGreaterThan(0)
    const plus = src.slice(at, at + 1100)
    expect(plus).toContain('_isNew: true')
    expect(plus).toContain('setLocalItems(prev => prev.map(')
    expect(plus).toContain('setExpandedSubItems(prev =>')
    // não abre mais a modal ao clicar no +
    expect(plus).not.toContain('setEditingSubItem')
    // o ícone de modal do subdetalhe abre a modal do ITEM (e não a do pedido)
    const modal = src.indexOf('// modal do registro do subdetalhe (um item novo)')
    expect(modal).toBeGreaterThan(at)
    expect(src.slice(modal, modal + 400)).toContain('setEditingSubItem({ subItem: newSub')
  })

  it('itens preenchidos em um pedido ainda não gravado aparecem na lista (não ficam escondidos)', () => {
    expect(src).not.toContain('{isNew || itemChildRecords.length === 0 ? (')
    expect(src).toContain('{itemChildRecords.length === 0 ? (')
  })
})
