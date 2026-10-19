import { describe, it, expect } from 'vitest'
import { parseMetaBuilderJSON } from '../parser'
import { generateJavaSpringProject } from '../emitter/java-spring-project'

/**
 * O backend Java de um projeto Oracle com tabela de chave NUMBER (BigDecimal) não compilava: o Repository, o Service e o Controller citavam
 * `BigDecimal` na assinatura sem importar java.math.BigDecimal ("cannot find symbol"). Achado ao compilar o Vendas ORA ejetado pelo motor de testes.
 */
const f = (id: string, model: string, col: string, type: string, extra: Record<string, unknown> = {}) =>
  ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, ...extra })

const raw = () => ({
  project: { id: 'p1', name: 'Vendas', slug: 'vendas' },
  models: [
    { id: 'm1', db_table_name: 'LOGS', display_name: 'LOGS', db_schema_name: 'CRM' },
    { id: 'm2', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public' },
    { id: 'm3', db_table_name: 'contadores', display_name: 'Contadores', db_schema_name: 'public' },
  ],
  fields: [
    f('a1', 'm1', 'ID', 'NUMBER', { is_primary_key: true }), f('a2', 'm1', 'MENSAGEM', 'VARCHAR2'),
    f('b1', 'm2', 'id', 'uuid', { is_primary_key: true, default_value: 'gen_random_uuid()' }), f('b2', 'm2', 'nome', 'text'),
    f('c1', 'm3', 'id', 'integer', { is_primary_key: true }), f('c2', 'm3', 'nome', 'text'),
  ],
  relations: [], views: [],
})

describe('backend Java: import do tipo da chave primária', () => {
  const files = generateJavaSpringProject(parseMetaBuilderJSON(raw(), 'oracle', { backendStack: 'java-spring', javaGroupId: 'com.vendas' } as any))
  const src = (pasta: string, n: string) => files.get(`backend/src/main/java/com/vendas/${pasta}/${n}.java`)!

  it('chave NUMBER (BigDecimal): Repository, Service e Controller importam java.math.BigDecimal', () => {
    for (const [pasta, nome] of [['repositories', 'LOGSRepository'], ['services', 'LOGSService'], ['controllers', 'LOGSController']]) {
      expect(src(pasta, nome), `${nome} cita BigDecimal`).toContain('BigDecimal')
      expect(src(pasta, nome), `${nome} importa BigDecimal`).toContain('import java.math.BigDecimal;')
    }
  })

  it('chave UUID continua importando UUID e a inteira (java.lang) não importa nada a mais', () => {
    expect(src('repositories', 'ClientesRepository')).toContain('import java.util.UUID;')
    expect(src('repositories', 'ContadoresRepository')).not.toMatch(/import java\.(math|util\.UUID)/)
  })
})

/**
 * No Oracle as colunas ficam em MAIÚSCULAS com "_" (CLIENTE_ID). O Spring Data lê o "_" do nome do método como separador de propriedade:
 * findByCLIENTE_ID procurava a propriedade CLIENTE e o backend nem subia ("No property 'CLIENTE' found for type 'PEDIDOS'"). Achado ao subir o Vendas ORA ejetado.
 */
import { buildProjectSource } from '../projectSource'

const campo = (id: string, model: string, col: string, type: string, pk = false) => ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, ...(pk ? { is_primary_key: true } : {}) })
const comp = (id: string, field: string, i: number) => ({ id, field_id: field, is_visible: true, order_index: i, config: {} })
const fake = (data: Record<string, any>) => ({ from: (t: string) => { const rows = data[t]; const c: any = {
  select: () => c, eq: () => c, in: () => c, order: () => c,
  single: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
  maybeSingle: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
  then: (res: any) => res({ data: Array.isArray(rows) ? rows : rows ? [rows] : [], error: null }) }; return c } }) as any

describe('backend Java Oracle: consulta por chave estrangeira com "_" no nome da coluna', () => {
  const mundo = fake({
    projects: { id: 'p1', slug: 'vendas', name: 'Vendas', db_type: 'oracle' },
    models: [
      { id: 'mc', db_table_name: 'CLIENTES', display_name: 'CLIENTES', db_schema_name: 'CRM', fields: [campo('a', 'mc', 'ID', 'VARCHAR2', true), campo('b', 'mc', 'NOME_EMPRESA', 'VARCHAR2')] },
      { id: 'mp', db_table_name: 'PEDIDOS', display_name: 'PEDIDOS', db_schema_name: 'CRM', fields: [campo('p1', 'mp', 'ID', 'VARCHAR2', true), campo('p2', 'mp', 'CLIENTE_ID', 'VARCHAR2'), campo('p3', 'mp', 'STATUS', 'VARCHAR2')] },
    ],
    ui_views: [{ id: 'v1', slug: 'clientes', name: 'Clientes', logic_type: 'pesquisa_cadastro', model_id: 'mc', layout_config: { form_fields: ['b', 'p3'] }, buttons_config: [], ui_components: [comp('u0', 'b', 0), comp('d1', 'p3', 20)] }],
    relations: [{ id: 'r1', from_model_id: 'mp', to_model_id: 'mc', from_field_id: 'p2', to_field_id: 'a' }],
    project_enumerations: [], project_auth_config: null,
  })

  it('o repositório usa @Query (não o método derivado findByCLIENTE_ID) e importa Query e Param', async () => {
    const { files } = await buildProjectSource(mundo, { projectId: 'p1', dbStack: 'oracle', backendStack: 'java-spring', authStrategy: 'none', javaGroupId: 'com.vendas' } as any)
    const repo = [...files.entries()].find(([p]) => p.endsWith('/repositories/PEDIDOSRepository.java'))?.[1] as string
    expect(repo, 'PEDIDOSRepository gerado').toBeTruthy()
    expect(repo).toContain('@Query("select e from PEDIDOS e where e.CLIENTE_ID = :id")')
    expect(repo).toContain('Page<PEDIDOS> findByCLIENTE_ID(@Param("id") String id, Pageable pageable);')
    expect(repo).toContain('import org.springframework.data.jpa.repository.Query;')
    expect(repo).toContain('import org.springframework.data.repository.query.Param;')
  })
})
