import { describe, it, expect, vi } from 'vitest'
import { buildProjectSource } from '../projectSource'

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const f = (id: string, model: string, col: string, type: string, pk = false) =>
  ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, is_primary_key: pk })
function fakeSupabase(data: Record<string, any>) {
  return { from: (table: string) => { const rows = data[table]; const chain: any = {
    select: () => chain, eq: () => chain, in: () => chain, order: () => chain,
    single: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
    maybeSingle: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
    then: (res: any) => res({ data: Array.isArray(rows) ? rows : rows ? [rows] : [], error: null }) }; return chain } } as any
}
const world = (over: Record<string, any> = {}) => fakeSupabase({
  projects: { id: 'p1', slug: 'vendas', name: 'Vendas', db_type: 'postgres' },
  models: [
    { id: 'mc', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public', fields: [f('a', 'mc', 'id', 'integer', true), f('b', 'mc', 'nome', 'varchar')] },
    { id: 'mp', db_table_name: 'pedidos', display_name: 'Pedidos', db_schema_name: 'public', fields: [f('p1', 'mp', 'id', 'integer', true), f('p2', 'mp', 'cliente_id', 'integer'), f('p3', 'mp', 'total', 'numeric'), f('p4', 'mp', 'data', 'date')] },
    { id: 'mi', db_table_name: 'itens_pedido', display_name: 'ItensPedido', db_schema_name: 'public', fields: [f('i1', 'mi', 'pedido_id', 'integer', true), f('i2', 'mi', 'produto_id', 'integer', true), f('i3', 'mi', 'qtd', 'smallint')] },
    { id: 'mn', db_table_name: 'notas', display_name: 'Notas', db_schema_name: 'public', fields: [f('n1', 'mn', 'codigo', 'varchar'), f('n2', 'mn', 'cliente_id', 'bigint')] },
    { id: 'mu', db_table_name: 'usuarios', display_name: 'Usuarios', db_schema_name: 'public', fields: [f('c', 'mu', 'id', 'integer', true), f('d', 'mu', 'email', 'varchar'), f('e', 'mu', 'hash_senha', 'varchar')] },
  ],
  ui_views: [{ id: 'v1', slug: 'clientes', name: 'Clientes', logic_type: 'list', model_id: 'mc', layout_config: {}, ui_components: [] }],
  relations: [],
  project_enumerations: [],
  project_auth_config: { auth_type: 'database', db_table_name: 'usuarios', db_email_column: 'email', db_password_column: 'hash_senha', db_password_hash_type: 'bcrypt', ui_config: {} },
  ...over,
})

const gen = async (extra: Record<string, unknown> = {}) =>
  (await buildProjectSource(world(), { projectId: 'p1', backendStack: 'java-spring', javaGroupId: 'com.vendas', dbStack: 'postgres', dbConnectionString: 'postgresql://crm:p%40ss@localhost:5432/crm', jwtEnabled: true, ...extra } as any)).files
const java = (files: Map<string, string>, p: string) => files.get(`backend/src/main/java/com/vendas/${p}`)!
const secretOf = (files: Map<string, string>) => /jwt\.secret=\$\{JWT_SECRET:([^}]+)\}/.exec(files.get('backend/src/main/resources/application.properties')!)![1]

describe('backend Java gerado', () => {
  it('coluna de chave estrangeira é um atributo comum (JSON e gravação); a relação é só leitura e fora do JSON', async () => {
    const f2 = await gen()
    const e = java(f2, 'entities/Pedidos.java')
    expect(e).toContain('@JsonProperty("cliente_id")')
    expect(e).toContain('private Integer clienteId;')
    expect(e).toMatch(/insertable = false, updatable = false\)\s+@JsonIgnore/)
    // sem relações inversas (cascata de exclusão e laço no toString)
    expect(java(f2, 'entities/Clientes.java')).not.toContain('@OneToMany')
  })

  it('chave de texto não usa IDENTITY; numérica usa; sem PK declarada o primeiro campo vira @Id', async () => {
    const f2 = await gen()
    expect(java(f2, 'entities/Pedidos.java')).toContain('GenerationType.IDENTITY')
    const notas = java(f2, 'entities/Notas.java')
    expect(notas).toContain('@Id')
    expect(notas).not.toContain('GeneratedValue')
    expect(java(f2, 'repositories/NotasRepository.java')).toContain('JpaRepository<Notas, String>')
  })

  it('chave composta: JSON solto, id lido da URL e consultas derivadas pelo caminho id.coluna', async () => {
    const f2 = await gen()
    expect(java(f2, 'entities/ItensPedido.java')).toContain('@com.fasterxml.jackson.annotation.JsonUnwrapped')
    expect(java(f2, 'entities/ItensPedidoId.java')).toContain('public static ItensPedidoId parse(String raw)')
    const repo = java(f2, 'repositories/ItensPedidoRepository.java')
    expect(repo).not.toMatch(/findByPedidoIdIn|findByIdIn/)
    expect(java(f2, 'controllers/ItensPedidoController.java')).toContain('ItensPedidoId.parse(id)')
    expect(java(f2, 'specifications/ItensPedidoSpec.java')).toContain('root.get("id").get("pedidoId")')
  })

  it('atualização parcial pela chave da URL e filtros com o tipo certo (Long, smallint)', async () => {
    const f2 = await gen()
    const ctl = java(f2, 'controllers/PedidosController.java')
    expect(ctl).toContain('readerForUpdating')
    expect(ctl).toContain('patch.remove("id");')
    expect(java(f2, 'specifications/NotasSpec.java')).toContain('Long.valueOf(')
    expect(java(f2, 'entities/ItensPedido.java')).toContain('private Integer qtd;')
  })

  it('pom sem preview e com o módulo do Flyway para o banco', async () => {
    const pom = (await gen({ generateMigrations: true })).get('backend/pom.xml')!
    expect(pom).not.toContain('enable-preview')
    expect(pom).toContain('flyway-database-postgresql')
    expect(pom).toContain('annotationProcessorPaths')
    const ora = (await gen({ generateMigrations: true, dbStack: 'oracle', dbConnectionString: 'oracle://u:p@h:1521/FREEPDB1' })).get('backend/pom.xml')!
    expect(ora).toContain('flyway-database-oracle')
  })

  it('application.properties: sem validar o esquema, senha decodificada, URL do SQL Server e Oracle', async () => {
    const props = (await gen()).get('backend/src/main/resources/application.properties')!
    expect(props).toContain('spring.jpa.hibernate.ddl-auto=none')
    expect(props).toContain('spring.datasource.password=p@ss')
    const sql = (await gen({ dbStack: 'sqlserver', dbConnectionString: 'Server=h,1433;Database=vendas;User Id=sa;Password=x1' })).get('backend/src/main/resources/application.properties')!
    expect(sql).toContain('jdbc:sqlserver://h:1433;databaseName=vendas;')
    expect(sql).toContain('spring.datasource.username=sa')
    const ora = (await gen({ dbStack: 'oracle', dbConnectionString: 'oracle://crm:pw@192.168.0.201:1521/FREEPDB1' })).get('backend/src/main/resources/application.properties')!
    expect(ora).toContain('jdbc:oracle:thin:@//192.168.0.201:1521/FREEPDB1')
  })

  it('JWT: o frontend assina com o MESMO segredo do backend e a API não emite token em /login', async () => {
    const f2 = await gen()
    const secret = secretOf(f2)
    expect(secret.length).toBeGreaterThanOrEqual(32)
    expect(f2.get('frontend/.env.local')).toContain(`JWT_SECRET=${secret}`)
    expect(f2.get('backend/.env.example')).toBeUndefined()
    const api = f2.get('frontend/lib/api-client.ts')!
    expect(api).toContain('SignJWT')
    expect(api).toContain("Authorization: 'Bearer '")
    const auth = java(f2, 'controllers/AuthController.java')
    expect(auth).toContain('status(501)')
    expect(auth).not.toContain('generateToken')
    // outra exportação, outro segredo
    expect(secretOf(await gen())).not.toBe(secret)
    // o exemplo de ambiente leva o mesmo segredo
    expect((await gen({ generateEnvExample: true })).get('backend/.env.example')).toMatch(/JWT_SECRET=\S{32,}/)
  })

  it('lista do frontend traz todos os registros (a API pagina de 50 em 50) e não repassa a paginação da URL como filtro', async () => {
    const act = (await gen()).get('frontend/app/actions/pedidos.ts')!
    expect(act).toContain("new Set(['page', 'limit', 'size', 'sort', 'sort_by', 'sort_order', 'embedded'])")
    expect(act).toContain('size: 500')
    expect(act).toContain('totalPages')
    expect(act).toContain("{ [field]: value, size: 500 }")
  })

  it('o projeto leva o Maven Wrapper (rodar não exige Maven instalado) e o README explica', async () => {
    const f2 = await gen()
    expect(f2.get('backend/mvnw.cmd')).toContain('MVNW')
    expect(f2.get('backend/mvnw')).toBeTruthy()
    expect(f2.get('backend/.mvn/wrapper/maven-wrapper.properties')).toContain('distributionUrl')
    expect(f2.get('backend/README.md')).toContain('Rodando sem instalar o Maven')
  })

  it('sem JWT o frontend não leva segredo e não há filtro de token', async () => {
    const f2 = await gen({ jwtEnabled: false })
    expect(f2.get('frontend/.env.local')).not.toContain('JWT_SECRET')
    expect([...f2.keys()].some(k => k.endsWith('JwtFilter.java'))).toBe(false)
  })

  it('gestão de acesso: o backend cria as tabelas ao subir com o mesmo script', async () => {
    const f2 = await gen({ accessAdmin: true })
    expect(f2.get('backend/src/main/resources/application.properties')).toContain('spring.sql.init.schema-locations=classpath:db/access-control.sql')
    expect(f2.get('backend/src/main/resources/db/access-control.sql')).toBe(f2.get('db/access-control.sql'))
    expect(f2.get('backend/src/main/resources/db/access-control.sql')).toContain('CREATE TABLE IF NOT EXISTS mb_role_permissions')
    // chave de texto em mb_roles: sem IDENTITY (era um erro ao criar grupo)
    expect(java(f2, 'entities/MbRoles.java')).not.toContain('GeneratedValue')
    expect((await gen()).get('backend/src/main/resources/application.properties')).not.toContain('spring.sql.init')
  })
})
