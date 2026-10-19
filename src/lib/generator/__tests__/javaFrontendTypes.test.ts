import { describe, it, expect } from 'vitest'
import { parseMetaBuilderJSON } from '../parser'
import { generateJavaSpringProject } from '../emitter/java-spring-project'

/**
 * O frontend do projeto Java precisa passar no `next build` (que confere os tipos; o `npm run dev` não confere).
 * Achados ao compilar uma exportação real: as chamadas à API sem tipo viravam `{}` (listas inteiras com erro de tipo), apiDelete devolvia
 * `void` (as telas testam `res && res.success === false`) e o cliente de IA importava @supabase/ssr, que o package.json Java não tem.
 */
const f = (id: string, col: string, type: string, pk = false) => ({ id, model_id: 'm1', db_column_name: col, display_name: col, data_type: type, is_primary_key: pk })
const raw = () => ({
  project: { id: 'p1', name: 'Vendas', slug: 'vendas' },
  models: [{ id: 'm1', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public' }],
  fields: [f('a', 'id', 'uuid', true), f('b', 'nome', 'text')],
  relations: [], views: [],
})

describe('frontend do projeto Java: tipos que passam no next build', () => {
  const files = generateJavaSpringProject(parseMetaBuilderJSON(raw(), 'postgres', { backendStack: 'java-spring', javaGroupId: 'com.vendas' } as any))

  it('as chamadas à API têm tipo padrão any (sem isso viram {} e quebram as listas)', () => {
    const api = files.get('frontend/lib/api-client.ts')!
    expect(api).toContain('export async function apiGet<T = any>(')
    expect(api).toContain('export async function apiPost<T = any>(')
    expect(api).toContain('export async function apiPut<T = any>(')
  })

  it('apiDelete devolve any (as telas testam o resultado da exclusão)', () => {
    expect(files.get('frontend/lib/api-client.ts')!).toContain('export async function apiDelete(path: string): Promise<any>')
  })

  it('o package.json do frontend não declara @supabase/ssr e nenhum arquivo o importa fora do Supabase', () => {
    expect(files.get('frontend/package.json')!).not.toContain('@supabase/ssr')
    for (const [path, src] of files) if (path.startsWith('frontend/')) expect(src, path).not.toContain("from '@supabase/ssr'")
  })
  it('as ações de criar/atualizar convertem o que o formulário manda (números pt-BR, vazio = null)', () => {
    const acoes = files.get('frontend/app/actions/clientes.ts')!
    expect(acoes).toContain('function normalizeBody(')
    expect(acoes).toContain('const body = normalizeBody(')
    expect(acoes).toContain(String.raw`replace(/\./g, '').replace(',', '.')`)
    expect(acoes).toContain('const columnTypes: Record<string, string> = {"id":"uuid","nome":"text"}')
  })

  it('getXByField nunca devolve os registros que não casam (o "failsafe" devolvia a tabela inteira quando nada casava)', () => {
    const acoes = files.get('frontend/app/actions/clientes.ts')!
    expect(acoes).not.toContain('filtered.length > 0 ? filtered : items')
    expect(acoes).toContain('return items.filter((item: any) => {')
  })

  it('o backend aceita data só com o dia ou sem fuso em colunas de data e hora', () => {
    const j = [...files.entries()].find(([p]) => p.endsWith('/config/JacksonConfig.java'))![1]
    expect(j).toContain('lenientDateTimeModule')
    expect(j).toContain('LocalDate.parse(t).atStartOfDay()')
  })
  it('o Tailwind do frontend varre components/ e usa darkMode class (como no app Node): sem isso as telas ficam sem estilo', () => {
    const tw = files.get('frontend/tailwind.config.ts')!
    expect(tw).toContain("'./components/**/*.{js,ts,jsx,tsx,mdx}'")
    expect(tw).toContain("darkMode: 'class'")
  })
})
