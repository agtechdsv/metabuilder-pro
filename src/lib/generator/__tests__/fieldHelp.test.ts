import { describe, it, expect } from 'vitest'
import { renderFormField, helpIconJsx } from '../layers/routes/helpers'
import { generateListPage } from '../layers/routes/list-page'
import type { ResolvedField } from '../ast'

const field = (label: any): ResolvedField => ({
  id: 'f1', dbColumn: 'cnpj', sqlExpression: undefined, label: 'CNPJ', dataType: 'varchar',
  isPrimaryKey: false, notNull: false, isSortable: false, isVirtual: false, isByoc: false,
  config: { label },
} as any)

describe('dica de ajuda do campo no app exportado', () => {
  it('sem dica o campo sai exatamente como antes', () => {
    const plain = renderFormField(field({ text: 'CNPJ' }), false)
    expect(plain).not.toContain('<details')
    expect(plain).toContain('<label')
  })

  it('com dica, o ícone ? entra ao lado do rótulo, em <details> (sem JavaScript)', () => {
    const html = renderFormField(field({ text: 'CNPJ', help: { pt: 'Só números', en: 'Digits only' } }), false)
    expect(html).toContain('<details')
    expect(html).toContain('{"Só números"}')
    expect(html).not.toContain('Digits only')
    // o ícone fica ao lado do rótulo, dentro do mesmo bloco
    const wrapped = html.match(/<div className="flex items-center gap-1\.5">(<label[\s\S]*?<\/label>)(<details[\s\S]*?<\/details>)<\/div>/)
    expect(wrapped).not.toBeNull()
  })

  it('o texto vira expressão JSX segura (aspas, chaves e tags não quebram o código gerado)', () => {
    const icon = helpIconJsx({ pt: 'Use "aspas", {chaves} e <tags>' })
    expect(icon).toContain('{"Use \\"aspas\\", {chaves} e <tags>"}')
  })

  it('sem texto, nenhum ícone', () => {
    expect(helpIconJsx({})).toBe('')
    expect(helpIconJsx(undefined)).toBe('')
  })
})

describe('dica de ajuda no filtro e no cabeçalho da coluna (app exportado)', () => {
  const page = (filterHelp: any, gridHelp: any) => generateListPage({
    title: 'Clientes', slug: 'clientes', modelName: 'Cliente', tableName: 'clientes',
    filterFields: [field({ text: 'CNPJ', help: filterHelp })],
    gridFields: [field({ text: 'CNPJ', help: gridHelp })],
    formFields: [], detailRelations: [], actions: [], buttons: [], customActions: [], exportFormats: [], primaryKey: 'id', logicType: 'cadastro',
  } as any)

  it('cada zona mostra o seu próprio texto', () => {
    const out = page({ pt: 'Digite parte do CNPJ' }, { pt: 'CNPJ da empresa' })
    expect(out).toContain('{"Digite parte do CNPJ"}')
    expect(out).toContain('{"CNPJ da empresa"}')
  })

  it('sem dica, nada muda', () => {
    const out = page(undefined, undefined)
    expect(out).not.toContain('<details')
  })
})
