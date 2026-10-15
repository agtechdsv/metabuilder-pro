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

const usuarios = { id: 'mu', db_table_name: 'usuarios', display_name: 'Usuarios', db_schema_name: 'public', fields: [f('u1', 'mu', 'id', 'integer', true), f('u2', 'mu', 'email', 'varchar'), f('u3', 'mu', 'hash_senha', 'varchar')] }
const world = (models: any[], tableAccess: unknown = null) => fakeSupabase({
  projects: { id: 'p1', slug: 'vendas', name: 'Vendas', db_type: 'postgres' },
  models,
  ui_views: [{ id: 'v1', slug: 'clientes', name: 'Clientes', logic_type: 'list', model_id: 'mc', layout_config: {}, ui_components: [] }],
  relations: [],
  project_enumerations: [],
  project_auth_config: { auth_type: 'database', db_table_name: 'usuarios', db_email_column: 'email', db_password_column: 'hash_senha', db_password_hash_type: 'bcrypt', ui_config: { table_access: tableAccess } },
})
const policyModels = () => [
  { id: 'mc', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public',
    row_policy: { rules: [{ id: 'r1', column: 'vendedor_email', op: 'eq', source: 'user.email', bypass: { source: 'user.attr', attr: 'perfil', values: ['admin'] } }] },
    audit_config: { createdAt: 'criado_em', createdBy: 'criado_por', updatedAt: 'atualizado_em' },
    fields: [f('a', 'mc', 'id', 'integer', true), f('b', 'mc', 'vendedor_email', 'varchar'), f('c', 'mc', 'criado_em', 'timestamp'), f('d', 'mc', 'criado_por', 'integer'), f('e', 'mc', 'atualizado_em', 'timestamp')] },
  { id: 'mp', db_table_name: 'pedidos', display_name: 'Pedidos', db_schema_name: 'public',
    row_policy: { rules: [{ id: 'r2', column: 'cliente_id', op: 'related', source: 'user.email', related: { table: 'clientes', key: 'id', column: 'vendedor_email' } }] },
    fields: [f('p1', 'mp', 'id', 'integer', true), f('p2', 'mp', 'cliente_id', 'integer')] },
  { id: 'mn', db_table_name: 'notas', display_name: 'Notas', db_schema_name: 'public', fields: [f('n1', 'mn', 'id', 'integer', true), f('n2', 'mn', 'texto', 'text')] },
  usuarios,
]
const genP = async (extra: Record<string, unknown> = {}, w = world(policyModels(), { closed: true, open: ['clientes', 'pedidos', 'usuarios'] })) =>
  (await buildProjectSource(w, { projectId: 'p1', backendStack: 'java-spring', javaGroupId: 'com.vendas', dbStack: 'postgres', dbConnectionString: 'postgresql://u:p@h:5432/d', jwtEnabled: true, ...extra } as any)).files
const java = (files: Map<string, string>, p: string) => files.get(`backend/src/main/java/com/vendas/${p}`)!

describe('backend Java com acesso por linha, tabela fechada e auditoria', () => {
  it('gera o pacote access, a configuração e o filtro do JWT com o usuário', async () => {
    const f2 = await genP()
    for (const c of ['CurrentUser', 'AccessRules', 'AccessMeta', 'PolicySpecs', 'AccessEnforcer', 'AccessExceptionHandler']) expect(java(f2, `access/${c}.java`), c).toBeTruthy()
    const cfg = JSON.parse(f2.get('backend/src/main/resources/mb-access.json')!)
    const byTable = Object.fromEntries(cfg.tables.map((t: any) => [t.table, t]))
    expect(byTable.clientes.policy.rules[0].bypass.values).toEqual(['admin'])
    expect(byTable.pedidos.policy.rules[0].op).toBe('related')
    expect(byTable.notas.closed).toBe(true)
    expect(byTable.clientes.closed).toBe(false)
    expect(java(f2, 'security/JwtFilter.java')).toContain('CurrentUser.from(claims)')
    // a tabela de login (usuarios) não tem regra: o login segue funcionando
    expect(byTable.usuarios.policy).toBeNull()
  })

  it('serviço aplica o filtro em toda leitura e confere cada gravação; controller usa update e descarta a auditoria vinda da tela', async () => {
    const f2 = await genP()
    const svc = java(f2, 'services/ClientesService.java')
    expect(svc).toContain('PolicySpecs.scope(TABLE, access.resolve(TABLE))')
    expect(svc).toContain('repository.findAll(scope(), pageable(page, size, sort))')
    expect(svc).toContain('repository.findOne(Specification.where(byId).and(scope()))')
    expect(svc).toContain('access.checkWrite(TABLE, true, entity, COLUMNS)')
    expect(svc).toContain('access.checkWrite(TABLE, false, entity, COLUMNS)')
    expect(svc).toContain('e.setCriadoEm(java.time.LocalDateTime.now())')
    expect(svc).toContain('e.setAtualizadoEm(java.time.LocalDateTime.now())')
    const ctl = java(f2, 'controllers/ClientesController.java')
    expect(ctl).toContain('service.update(existing.get())')
    for (const c of ['criado_em', 'criado_por', 'atualizado_em']) expect(ctl).toContain(`patch.remove("${c}");`)
    expect(ctl).toContain('if (service.findById(id).isEmpty()) return ResponseEntity.notFound().build();')
  })

  it('o frontend leva o usuário no JWT; login e gestão de acesso chamam como sistema', async () => {
    const f2 = await genP({ accessAdmin: true })
    const api = f2.get('frontend/lib/api-client.ts')!
    expect(api).toContain('export function asSystem')
    expect(api).toContain('userClaims')
    expect(api).toContain('getSessionUser')
    const login = f2.get('frontend/app/api/login/route.ts')!
    expect(login).toContain('async function handleLogin(request: Request)')
    expect(login).toContain('return asSystem(() => handleLogin(request))')
    const admin = f2.get('frontend/app/actions/access-admin.ts')!
    expect(admin).toContain("import { asSystem } from '@/lib/api-client'")
    const names = [...admin.matchAll(/\nexport async function (\w+)\(\.\.\.args/g)].map(m => m[1])
    expect(names.length).toBeGreaterThan(5)
    for (const n of names) {
      expect(admin).toContain(`async function ${n}Impl(`)
      // ninguém chama a versão exportada por dentro do arquivo (o nome sem Impl só aparece na declaração do invólucro)
      expect([...admin.matchAll(new RegExp(`(?<![\\w.])${n}\\(`, 'g'))].length, n).toBe(1)
    }
    // as tabelas do próprio app só respondem a chamadas internas
    const cfg = JSON.parse(f2.get('backend/src/main/resources/mb-access.json')!)
    expect(cfg.tables.find((t: any) => t.table === 'mb_role_permissions').systemOnly).toBe(true)
  })

  it('sem JWT, regra por linha é recusada; sem regra o pacote access nem é gerado', async () => {
    await expect(genP({ jwtEnabled: false })).rejects.toThrow(/exige a opção JWT/)
    const plain = await genP({}, world([{ id: 'mc', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public', fields: [f('a', 'mc', 'id', 'integer', true)] }, usuarios]))
    expect([...plain.keys()].some(k => k.includes('/access/'))).toBe(false)
    expect(plain.get('backend/src/main/resources/mb-access.json')).toBeUndefined()
    expect(java(plain, 'services/ClientesService.java')).not.toContain('PolicySpecs')
  })

  it('regra relacionada com tabela fora do projeto é recusada', async () => {
    const w = world([
      { id: 'mp', db_table_name: 'pedidos', display_name: 'Pedidos', db_schema_name: 'public',
        row_policy: { rules: [{ id: 'r', column: 'cliente_id', op: 'related', source: 'user.email', related: { table: 'sumiu', key: 'id', column: 'x' } }] },
        fields: [f('p1', 'mp', 'id', 'integer', true), f('p2', 'mp', 'cliente_id', 'integer')] },
      usuarios,
    ])
    await expect(genP({}, w)).rejects.toThrow(/sumiu/)
  })
})
