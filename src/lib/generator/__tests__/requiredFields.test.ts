import { describe, it, expect } from 'vitest'
import { buildProjectSource } from '../projectSource'

/**
 * Colunas NOT NULL sem valor padrão viram campos obrigatórios no formulário (o navegador avisa antes de enviar).
 * Ficam de fora: colunas que aceitam nulo, colunas com valor padrão e colunas de auditoria.
 */
const f = (id: string, col: string, type: string, extra: Record<string, unknown> = {}) =>
  ({ id, model_id: 'm1', db_column_name: col, display_name: col, data_type: type, ...extra })

function fakeSupabase(data: Record<string, any>) {
  return { from: (table: string) => { const rows = data[table]; const chain: any = {
    select: () => chain, eq: () => chain, in: () => chain, order: () => chain,
    single: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
    maybeSingle: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
    then: (res: any) => res({ data: Array.isArray(rows) ? rows : rows ? [rows] : [], error: null }) }; return chain } } as any
}

const comp = (id: string, field: string, i: number) => ({ id, field_id: field, is_visible: true, order_index: i, config: {} })
const world = () => fakeSupabase({
  projects: { id: 'p1', slug: 'vendas', name: 'Vendas', db_type: 'postgres' },
  models: [{
    id: 'm1', db_table_name: 'departamentos', display_name: 'Departamentos', db_schema_name: 'public',
    fields: [
      f('f1', 'id', 'uuid', { is_primary_key: true, is_nullable: false }),
      f('f2', 'nome', 'varchar', { is_nullable: false, default_value: null }),
      f('f3', 'descricao', 'varchar', { is_nullable: true }),
      f('f4', 'situacao', 'varchar', { is_nullable: false, default_value: "'Ativo'" }),
      f('f5', 'sigla', 'varchar', { is_nullable: false, default_value: null }),
      f('f6', 'criado_por', 'uuid', { is_nullable: false, default_value: null }),
    ],
  }],
  ui_views: [{
    id: 'v1', slug: 'departamentos', name: 'Departamentos', logic_type: 'pesquisa_cadastro', model_id: 'm1', layout_config: {},
    ui_components: [comp('u1', 'f2', 0), comp('u2', 'f3', 1), comp('u3', 'f4', 2), comp('u4', 'f5', 3)],
  }],
  relations: [], project_enumerations: [], project_auth_config: null,
})
const opts = { projectId: 'p1', dbStack: 'postgres', dbConnectionString: 'postgresql://u:p@h:5432/d', authStrategy: 'none' }

describe('campos obrigatórios a partir do NOT NULL do banco', () => {
  it('só a coluna NOT NULL sem padrão é obrigatória no formulário de cadastro', async () => {
    const { files } = await buildProjectSource(world(), opts as any)
    const src = [...files.entries()].filter(([p]) => /departamentos\/.*\.tsx$/.test(p)).map(([, c]) => c).join('\n')
    const obrigatorio = (col: string) => new RegExp(`<input[^>]*name="${col}"[^>]*\\brequired\\b|<input[^>]*\\brequired\\b[^>]*name="${col}"`, 's').test(src)
    expect(obrigatorio('nome')).toBe(true)
    expect(obrigatorio('sigla')).toBe(true)
    expect(obrigatorio('descricao')).toBe(false) // aceita nulo
    expect(obrigatorio('situacao')).toBe(false)  // tem valor padrão
  })
})
