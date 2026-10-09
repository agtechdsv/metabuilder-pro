import { describe, it, expect } from 'vitest'
import { parseMetaBuilderJSON } from '../parser'
import { generateSpringBootBackend } from '../emitter/java-spring-backend'

// O backend Java exportado não pode sair com uma chave JWT conhecida (igual em todos os projetos).
const raw = {
  project: { id: 'p1', name: 'Vendas', slug: 'vendas' },
  models: [{ id: 'm1', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'vendas' }],
  fields: [{ id: 'f1', model_id: 'm1', db_column_name: 'id', display_name: 'id', data_type: 'integer', is_primary_key: true }],
  relations: [],
  views: [],
}

const generate = () => {
  const ast = parseMetaBuilderJSON(raw, 'postgres', { backendStack: 'java-spring', jwtEnabled: true } as any)
  const files = new Map<string, string>()
  generateSpringBootBackend(ast, files)
  return files
}

describe('backend Java: chave JWT', () => {
  it('nenhum arquivo leva a chave padrão antiga; a de application.properties é única por exportação', () => {
    const a = generate(), b = generate()
    for (const [path, text] of a) expect(text, path).not.toContain('minha-chave-secreta')
    const key = (f: Map<string, string>) => /jwt\.secret=\$\{JWT_SECRET:([^}]+)\}/.exec(f.get('backend/src/main/resources/application.properties')!)?.[1]
    expect(key(a)).toBeTruthy()
    expect(key(a)!.length).toBeGreaterThanOrEqual(32)
    expect(key(a)).not.toBe(key(b))
  })

  it('o código recusa subir sem chave ou com chave curta (não completa com zeros)', () => {
    const util = [...generate()].find(([p]) => p.endsWith('security/JwtUtil.java'))![1]
    expect(util).toContain('@Value("${jwt.secret}")')
    expect(util).toContain('IllegalStateException')
    expect(util).not.toContain('padded')
  })
})
