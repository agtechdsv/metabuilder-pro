import { describe, it, expect } from 'vitest'
import ts from 'typescript'
import { generateAiPage } from '../layers/routes/ai-page'

const route = (code: string) => ({ componentCode: code, title: 'Gerenciamento de Produtos', viewSlug: 'gerenciamento-produtos' }) as any
const ast = { projectId: 'p1', dbStack: 'postgres' } as any

const syntaxOk = (src: string) =>
  (ts.transpileModule(src, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.Preserve, module: ts.ModuleKind.ESNext } }).diagnostics || []).length === 0

describe('tela gerada por IA no app exportado', () => {
  // o modelo escreveu aspas escapadas dentro de um atributo JSX: JavaScript válido, JSX inválido
  const broken = `import React from 'react'\nexport default function P() {\n  return <input placeholder="Ex: Notebook Ultra Pro 15\\"" value="x" onChange={() => {}} />\n}\n`

  it('repara o JSX que a plataforma já repara ao renderizar (a exportação não quebra o build)', () => {
    const out = generateAiPage(route(broken), ast)
    expect(out).toContain('placeholder="Ex: Notebook Ultra Pro 15&quot;"')
    expect(out).not.toContain('15\\""')
    expect(syntaxOk(out)).toBe(true)
  })

  it('código sem reparo possível vira uma tela com o erro, em vez de derrubar o build do app todo', () => {
    const out = generateAiPage(route('export default function P() { return <div> }'), ast)
    expect(out).toContain('AiViewError')
    expect(out).toContain('Gerenciamento de Produtos')
    expect(syntaxOk(out)).toBe(true)
  })

  it('código válido segue como antes', () => {
    const out = generateAiPage(route(`export default function P() { return <div className="a">ok</div> }`), ast)
    expect(out.startsWith('"use client";')).toBe(true)
    expect(out).toContain('ok')
  })
})
