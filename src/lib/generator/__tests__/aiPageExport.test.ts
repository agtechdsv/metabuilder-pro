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

describe('módulos que o código de IA importa existem no app exportado', () => {
  it('Modal, Toast, cliente de dados e utilitários: tudo que o sandbox da plataforma oferece sai no ZIP', async () => {
    const { parseMetaBuilderJSON } = await import('../parser')
    const { generateNodeProject } = await import('../emitter/node-project')
    const code = [
      "import React, { useState } from 'react'",
      "import { createClient } from '@/utils/supabase/client'",
      "import { useToast } from '@/components/ui/Toast'",
      "import Modal from '@/components/ui/Modal'",
      "import { Package } from 'lucide-react'",
      'export default function P() { const [o, setO] = useState(false); return <Modal isOpen={o} onClose={() => setO(false)} title="x"><Package /></Modal> }',
    ].join('\n')
    const files = generateNodeProject(parseMetaBuilderJSON({
      project: { id: 'p', name: 'V', slug: 'v' },
      models: [], fields: [], relations: [],
      views: [{ id: 'v1', slug: 'gerenciamento-produtos', name: 'Gerenciamento', view_type: 'advanced_use_case', layout_config: { generated_by_ai: true, component_code: code } }],
    }, 'postgres'))
    const page = files.get('app/(protected)/gerenciamento-produtos/page.tsx')!
    expect(page).toContain("@/components/ui/Modal")
    // cada importação "@/..." do código de IA aponta para um arquivo gerado
    for (const m of page.matchAll(/from\s+['"]@\/([^'"]+)['"]/g)) {
      const t = m[1]
      expect([`${t}.ts`, `${t}.tsx`].some(p => files.has(p)), t).toBe(true)
    }
    const modal = files.get('components/ui/Modal.tsx')!
    expect(modal).toContain('export default Modal')
    expect(modal).toContain('export function Modal')
  })
})
