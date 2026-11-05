import { describe, it, expect } from 'vitest'
import ts from 'typescript'
import { finalizeHelpFeedback } from '../layers/helpFeedback'
import { helpIconJsx, renderFormField } from '../layers/routes/helpers'

const syntaxErrors = (name: string, src: string) =>
  ts.transpileModule(src, { reportDiagnostics: true, fileName: name, compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2020 } })
    .diagnostics?.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')) ?? []

const formField = {
  id: 'f1', dbColumn: 'cnpj', sqlExpression: undefined, label: 'CNPJ', dataType: 'varchar',
  isPrimaryKey: false, notNull: false, isSortable: false, isVirtual: false, isByoc: false,
  config: { label: { text: 'CNPJ', help: { pt: 'Só números' } } },
} as any

const ast = (over: any = {}) => ({ dbStack: 'postgres', authConfig: null, ...over }) as any

describe('feedback da ajuda no app exportado', () => {
  it('o balão da ajuda leva o marcador com campo e zona', () => {
    const icon = helpIconJsx({ pt: 'x' }, { field: 'f1', zone: 'grid' })
    expect(icon).toContain('<HelpFeedback field="f1" zone="grid" />')
    expect(helpIconJsx({ pt: 'x' }, { screen: 'v1', zone: 'screen' })).toContain('<HelpFeedback screen="v1" zone="screen" />')
    expect(helpIconJsx({ pt: 'x' })).not.toContain('HelpFeedback')
    expect(renderFormField(formField, false)).toContain('zone="form"')
  })

  it('Node + Postgres: importa o componente depois da diretiva e cria rota e componente', () => {
    const files = new Map<string, string>([
      ['app/(protected)/clientes/page.tsx', "'use client'\nimport React from 'react'\nexport default function P() { return <div>" + helpIconJsx({ pt: 'x' }, { field: 'f1', zone: 'form' }) + '</div> }\n'],
      ['app/(protected)/outra/page.tsx', "// ARQUIVO GERADO\nimport x from 'x'\n" + helpIconJsx({ pt: 'y' }, { field: 'f2', zone: 'grid' }) + '\n'],
    ])
    finalizeHelpFeedback(ast(), files, true)
    const a = files.get('app/(protected)/clientes/page.tsx')!
    expect(a.startsWith("'use client'\nimport { HelpFeedback } from '@/components/HelpFeedback'\n")).toBe(true)
    expect(files.get('app/(protected)/outra/page.tsx')!.startsWith("// ARQUIVO GERADO\nimport { HelpFeedback }")).toBe(true)
    expect(files.has('components/HelpFeedback.tsx')).toBe(true)
    const route = files.get('app/api/help-feedback/route.ts')!
    expect(route).toContain("import { query } from '@/app/actions/db'")
    expect(route).not.toContain('getSessionUser')
    expect(syntaxErrors('route.ts', route)).toEqual([])
    expect(syntaxErrors('HelpFeedback.tsx', files.get('components/HelpFeedback.tsx')!)).toEqual([])
  })

  it('com login, a rota exige sessão e grava quem votou', () => {
    const files = new Map<string, string>([['app/p/page.tsx', helpIconJsx({ pt: 'x' }, { field: 'f', zone: 'form' })]])
    finalizeHelpFeedback(ast({ authConfig: { authType: 'database', tableName: 'usuarios' } }), files, true)
    const route = files.get('app/api/help-feedback/route.ts')!
    expect(route).toContain("import { getSessionUser } from '@/lib/session-server'")
    expect(route).toContain('401')
    expect(syntaxErrors('route.ts', route)).toEqual([])
  })

  it('outros bancos e front Java: tira os marcadores e não cria nada', () => {
    const files = new Map<string, string>([['app/p/page.tsx', 'a' + helpIconJsx({ pt: 'x' }, { field: 'f', zone: 'form' }) + 'b']])
    finalizeHelpFeedback(ast({ dbStack: 'oracle' }), files, false)
    expect(files.get('app/p/page.tsx')).not.toContain('HelpFeedback')
    expect(files.get('app/p/page.tsx')).toContain('{"x"}')
    expect(files.has('components/HelpFeedback.tsx')).toBe(false)
    expect(files.has('app/api/help-feedback/route.ts')).toBe(false)
  })

  it('app sem ajuda nenhuma não ganha arquivo extra', () => {
    const files = new Map<string, string>([['app/p/page.tsx', '<div/>']])
    finalizeHelpFeedback(ast(), files, true)
    expect([...files.keys()]).toEqual(['app/p/page.tsx'])
  })
})
