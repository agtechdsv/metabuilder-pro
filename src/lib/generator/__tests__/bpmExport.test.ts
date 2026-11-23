import { describe, it, expect, vi } from 'vitest'
import ts from 'typescript'
import { buildProjectSource } from '../projectSource'
import { buildBpmExport } from '../bpmExport'
import { bpmLinkedFlowIds, patchBpmCustomActions } from '../layers/bpm'

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const f = (id: string, model: string, col: string, type: string, pk = false) =>
  ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, is_primary_key: pk })

function fakeSupabase(data: Record<string, any>) {
  return {
    from: (table: string) => {
      const rows = data[table]
      const chain: any = {
        select: () => chain, eq: () => chain, in: () => chain, order: () => chain,
        single: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
        maybeSingle: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
        then: (res: any) => res({ data: Array.isArray(rows) ? rows : rows ? [rows] : [], error: null }),
      }
      return chain
    },
  } as any
}

const flow = (id: string, nodes: any[], edges: any[] = []) => ({ id, name: 'Fluxo ' + id, is_active: true, flow_data: { nodes, edges } })

const FLOWS = [
  flow('w1', [
    { id: 't', type: 'trigger', data: { triggerType: ['BEFORE_INSERT', 'INSERT'], triggerModelId: 'mc' } },
    { id: 'r', type: 'response', data: { responseAllowAction: false, responseMessage: 'Não pode' } },
  ], [{ source: 't', target: 'r' }]),
  flow('w2', [{ id: 't', type: 'trigger', data: { triggerType: ['WEBHOOK'], triggerWebhookSecretHash: 'a'.repeat(64) } }]),
  flow('w3', [{ id: 't', type: 'trigger', data: { triggerType: ['SCHEDULED'], triggerSchedules: [{ type: 'recurring', days: [1], time: '08:00' }] } }]),
]

const world = (dbType: string, bpm: any[] = FLOWS) => fakeSupabase({
  projects: { id: 'p1', slug: 'vendas', name: 'Vendas', db_type: dbType },
  models: [
    { id: 'mc', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public', fields: [f('a', 'mc', 'id', 'integer', true), f('b', 'mc', 'nome', 'varchar')] },
    { id: 'mp', db_table_name: 'pedidos', display_name: 'Pedidos', db_schema_name: 'public', fields: [f('c', 'mp', 'id', 'integer', true), f('d', 'mp', 'total', 'integer')] },
  ],
  ui_views: [{ id: 'v1', slug: 'clientes', name: 'Clientes', logic_type: 'list', model_id: 'mc', layout_config: {}, ui_components: [] }],
  relations: [],
  project_enumerations: [],
  project_auth_config: { auth_type: 'none', ui_config: {} },
  bpm_workflows: bpm,
})

const syntaxErrors = (src: string, name = 'x.ts') => (ts.transpileModule(src, { fileName: name, reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.Preserve, module: ts.ModuleKind.ESNext } }).diagnostics || []).map(d => String(d.messageText))

describe('BPM no app exportado', () => {
  it('sem fluxos, o app não ganha nada de BPM (idêntico ao de antes)', async () => {
    for (const db of ['postgres', 'oracle']) {
      const { files } = await buildProjectSource(world(db, []), { projectId: 'p1', dbStack: db as any })
      expect([...files.keys()].filter(k => k.includes('bpm') || k === 'instrumentation.ts')).toEqual([])
      expect(files.get('app/actions/clientes.ts')).not.toContain('bpm')
      expect(JSON.parse(files.get('package.json')!).dependencies['node-cron']).toBeUndefined()
    }
  })

  it('só PostgreSQL e Oracle com backend Node levam fluxos (MySQL, SQL Server, Supabase e Java ficam de fora por enquanto)', async () => {
    for (const db of ['mysql', 'sqlserver', 'supabase']) {
      const { files } = await buildProjectSource(world(db), { projectId: 'p1', dbStack: db as any, dbConnectionString: 'x://y' })
      expect(files.has('lib/bpm/core.js'), db).toBe(false)
    }
    const java = await buildProjectSource(world('postgres'), { projectId: 'p1', dbStack: 'postgres', backendStack: 'java-spring' })
    expect([...java.files.keys()].some(k => k.includes('lib/bpm'))).toBe(false)
  })

  for (const db of ['postgres', 'oracle']) {
    it(`${db}: gera o núcleo, o retrato dos fluxos, o runtime, o instrumentation e a rota de webhook`, async () => {
      const { files } = await buildProjectSource(world(db), { projectId: 'p1', dbStack: db as any, dbConnectionString: db === 'oracle' ? 'oracle://u:p@h:1521/s' : 'postgresql://u:p@h:5432/d' })
      for (const p of ['lib/bpm/core.js', 'lib/bpm/core.d.ts', 'lib/bpm/emailTemplates.js', 'lib/bpm/emailTemplates.d.ts', 'lib/bpm/workflows.json', 'lib/bpm/runtime.ts', 'instrumentation.ts', 'app/api/bpm/webhook/[workflowId]/route.ts']) {
        expect(files.has(p), p).toBe(true)
      }
      const snap = JSON.parse(files.get('lib/bpm/workflows.json')!)
      expect(snap.models).toEqual({ mc: 'clientes', mp: 'pedidos' })
      expect(snap.workflows.map((w: any) => w.id)).toEqual(['w1', 'w2', 'w3'])
      const pkg = JSON.parse(files.get('package.json')!)
      expect(pkg.dependencies.nodemailer).toBeTruthy()
      expect(pkg.dependencies['node-cron']).toBeTruthy()
      for (const p of ['lib/bpm/runtime.ts', 'instrumentation.ts', 'app/api/bpm/webhook/[workflowId]/route.ts', 'app/actions/clientes.ts', 'app/actions/pedidos.ts']) {
        expect(syntaxErrors(files.get(p)!), p).toEqual([])
      }
    })

    it(`${db}: só a tabela que algum fluxo escuta ganha os ganchos (e o original continua dentro)`, async () => {
      const { files } = await buildProjectSource(world(db), { projectId: 'p1', dbStack: db as any, dbConnectionString: db === 'oracle' ? 'oracle://u:p@h:1521/s' : 'postgresql://u:p@h:5432/d' })
      const clientes = files.get('app/actions/clientes.ts')!
      expect(clientes).toContain("import { bpmBefore, bpmAfter } from '@/lib/bpm/runtime'")
      expect(clientes).toContain("bpmBefore(__bpmTable, 'INSERT'")
      expect(clientes).toContain("bpmBefore(__bpmTable, 'UPDATE'")
      expect(clientes).toContain("bpmBefore(__bpmTable, 'DELETE'")
      expect(clientes).toContain('__bpmError')
      expect(clientes).toContain('async function __bpm_createClientes(')
      expect(clientes).toContain('export async function createClientes(')
      expect(clientes).not.toContain('export async function __bpm')
      expect(files.get('app/actions/pedidos.ts')).not.toContain('bpm')
    })
  }

  it('o formulário mostra a mensagem do bloqueio (só nos apps com gatilho)', async () => {
    const opts = { projectId: 'p1', dbStack: 'postgres' as const, authStrategy: 'none', dbConnectionString: 'postgresql://u:p@h:5432/d' }
    const form = (files: Map<string, string>) => [...files.entries()].find(([, c]) => c.includes('await createAction(payload)'))![1]
    const on = form((await buildProjectSource(world('postgres'), opts)).files)
    expect(on).toContain('created.__bpmError')
    expect(on).toContain('updated.__bpmError')
    expect(syntaxErrors(on, 'f.tsx')).toEqual([])
    expect(form((await buildProjectSource(world('postgres', []), opts)).files)).not.toContain('__bpmError')
  })

  it('o runtime de cada banco usa o SQL do próprio dialeto', async () => {
    const pg = (await buildProjectSource(world('postgres'), { projectId: 'p1', dbStack: 'postgres', dbConnectionString: 'postgresql://u:p@h:5432/d' })).files.get('lib/bpm/runtime.ts')!
    expect(pg).toContain('ON CONFLICT (name) DO NOTHING')
    expect(pg).toContain('make_interval(days => $1)')
    expect(pg).toContain("dialect: \"postgres\"")
    const ora = (await buildProjectSource(world('oracle'), { projectId: 'p1', dbStack: 'oracle', dbConnectionString: 'oracle://u:p@h:1521/s' })).files.get('lib/bpm/runtime.ts')!
    expect(ora).toContain('NUMTODSINTERVAL')
    expect(ora).toContain('GENERATED BY DEFAULT AS IDENTITY')
    expect(ora).toContain("dialect: \"oracle\"")
    expect(ora).not.toContain('ON CONFLICT')
  })

  it('o webhook só existe com fluxo de webhook e o proxy o libera (tem segredo próprio, sem sessão)', async () => {
    const withHook = await buildProjectSource(world('postgres'), { projectId: 'p1', dbStack: 'postgres', authStrategy: 'legacy', dbConnectionString: 'postgresql://u:p@h:5432/d' })
    expect(withHook.files.get('proxy.ts')).toContain("'/api/bpm/webhook'")
    const route = withHook.files.get('app/api/bpm/webhook/[workflowId]/route.ts')!
    for (const s of ['timingSafeEqual', 'x-webhook-secret', 'MAX_BODY_BYTES', 'status: 401', 'status: 404']) expect(route, s).toContain(s)
    const noHook = await buildProjectSource(world('postgres', [FLOWS[0], FLOWS[2]]), { projectId: 'p1', dbStack: 'postgres', authStrategy: 'legacy', dbConnectionString: 'postgresql://u:p@h:5432/d' })
    expect(noHook.files.has('app/api/bpm/webhook/[workflowId]/route.ts')).toBe(false)
    expect(noHook.files.get('proxy.ts')).not.toContain('/api/bpm/webhook')
    expect(noHook.files.get('proxy.ts')).toContain("const PUBLIC_PATHS = ['/login', '/api/login', '/api/health']")
  })

  it('o pacote de produção só fala de BPM quando o app leva fluxos (variáveis de SMTP e agendamento, e a seção do guia)', async () => {
    const opts = { projectId: 'p1', dbStack: 'postgres' as const, authStrategy: 'none', dbConnectionString: 'postgresql://u:p@h:5432/d' }
    const on = (await buildProjectSource(world('postgres'), opts)).files
    for (const v of ['SMTP_HOST=', 'SMTP_PASSWORD=', 'BPM_SCHEDULER=on', 'BPM_TIMEZONE=', 'BPM_RUNS_RETENTION_DAYS=30', 'BPM_ERROR_EMAIL=']) expect(on.get('.env.example'), v).toContain(v)
    expect(on.get('DEPLOY.md')).toContain('## Automações (BPM)')
    expect(on.get('DEPLOY.md')).toContain('3 fluxos')
    const off = (await buildProjectSource(world('postgres', []), opts)).files
    expect(off.get('.env.example')).not.toContain('SMTP_HOST')
    expect(off.get('DEPLOY.md')).not.toContain('Automações (BPM)')
  })

  it('botão ligado a fluxo chama a action do servidor, que só aceita fluxos ligados a botões e só recebe o id do registro', async () => {
    const { files } = await buildProjectSource(world('postgres'), { projectId: 'p1', dbStack: 'postgres', authStrategy: 'none', dbConnectionString: 'postgresql://u:p@h:5432/d' })
    const original = files.get('components/ui/custom-action-button.tsx')!
    expect(original).not.toContain('runBpmAction') // sem botão ligado a fluxo, o componente é o de sempre
    expect(files.has('app/actions/bpm.ts')).toBe(false)

    const ast: any = { bpm: { flows: [{ id: 'w1' }, { id: 'w2' }], hookedTables: [] }, routes: [{ actionsRow: [{ id: 'a', linkedBpmWorkflows: ['w1', 'fantasma'] }] }] }
    expect(bpmLinkedFlowIds(ast)).toEqual(['w1']) // só fluxos que existem
    patchBpmCustomActions(ast, files)
    const btn = files.get('components/ui/custom-action-button.tsx')!
    expect(btn).toContain("import { runBpmAction } from '@/app/actions/bpm'")
    expect(btn.indexOf('runBpmAction(action.linkedBpmWorkflows')).toBeLessThan(btn.indexOf('onClick(action, item)')) // vem antes do onClick da tela
    expect(syntaxErrors(btn, 'b.tsx')).toEqual([])
    const act = files.get('app/actions/bpm.ts')!
    expect(act).toContain('new Set<string>(["w1"])')
    expect(act).toContain('{ id: recordId }')
    expect(syntaxErrors(act)).toEqual([])
  })

  it('buildBpmExport: fluxos inativos ou sem desenho ficam de fora e as tabelas dos gatilhos são listadas', () => {
    const models = [{ id: 'mc', dbTable: 'public.clientes' }]
    const r = buildBpmExport([
      flow('a', [{ id: 't', type: 'trigger', data: { triggerType: 'UPDATE', triggerModelId: 'mc' } }]),
      { id: 'b', name: 'B', is_active: false, flow_data: { nodes: [{ id: 't', type: 'trigger', data: {} }], edges: [] } },
      { id: 'c', name: 'C', is_active: true, flow_data: null },
    ], models, 'postgres', 'nodejs')!
    expect(r.flows.map(x => x.id)).toEqual(['a'])
    expect(r.models).toEqual({ mc: 'clientes' }) // sem o schema
    expect(r.hookedTables).toEqual(['clientes'])
    expect(buildBpmExport([], models, 'postgres', 'nodejs')).toBeUndefined()
  })
})
