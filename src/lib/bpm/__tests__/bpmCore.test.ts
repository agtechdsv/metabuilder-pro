import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fixtures from '../conformance/fixtures.json'
import type { BpmCore as BpmCoreType, BpmRunReport } from '../bpmCore'

// o núcleo é CommonJS (vai também para o app exportado e o CLI); o porte para Java precisa passar nestas mesmas fixtures
const require = createRequire(import.meta.url)
const { BpmCore } = require('../../../../cli/bpmCore.js') as { BpmCore: new (ports: any) => BpmCoreType }

type Case = (typeof fixtures)['cases'][number] & { httpFails?: number }

async function run(c: Case) {
  const queries: { sql: string; params: any[] }[] = []
  const mails: any[] = []
  const http: any[] = []
  const runs: BpmRunReport[] = []
  const tables = fixtures.tables as Record<string, any[]>
  const models = fixtures.models as Record<string, string>
  const core = new BpmCore({
    db: {
      dialect: c.dialect,
      async query(sql: string, params: any[]) {
        queries.push({ sql, params })
        const m = /^SELECT \* FROM "(\w+)" WHERE "id"/.exec(sql)
        return m ? (tables[m[1]] || []).filter(r => String(r.id) === String(params[0])) : []
      },
    },
    models: { tableOf: async (id: string) => models[id] || null, isKnownTable: async (n: string) => Object.values(models).includes(n) },
    http: {
      async request(cfg: any) {
        http.push(cfg)
        if (c.httpFails) { const e: any = new Error('falhou'); e.status = c.httpFails; throw e }
        return { status: 200 }
      },
    },
    mail: { async send(m: any) { mails.push(m) } },
    runs: { async report(r: BpmRunReport) { runs.push(r) } },
    verbose: false,
  })
  core.setWorkflows([{ id: 'f1', name: 'Fluxo', flow_data: c.flow } as any])
  const ev: any = c.event
  let sync: any
  if (ev.mode === 'async') await core.processEvent(ev.table, ev.type, ev.row, ev.oldRow)
  else if (ev.mode === 'sync') sync = await core.processSyncEvent(ev.table, ev.type, ev.row, ev.oldRow)
  else await core.processWebhook('f1', ev.data)
  return { queries, mails, http, runs, sync }
}

describe('núcleo do BPM: conformidade', () => {
  for (const c of fixtures.cases as Case[]) {
    it(c.name, async () => {
      const got = await run(c)
      const ex: any = c.expect
      if (ex.queries) expect(got.queries).toEqual(ex.queries)
      if (ex.mails) expect(got.mails).toEqual(ex.mails)
      if (ex.http) expect(got.http.map(h => ({ method: h.method, url: h.url, data: h.data, timeout: h.timeout }))).toEqual(ex.http)
      if (ex.sync) expect(got.sync).toMatchObject(ex.sync)
      if (ex.runs) {
        expect(got.runs).toHaveLength(ex.runs.length)
        ex.runs.forEach((r: any, i: number) => {
          expect(got.runs[i].status).toBe(r.status)
          if (r.source) expect(got.runs[i].trigger_source).toBe(r.source)
          if (r.blocked !== undefined) expect(got.runs[i].details?.blocked).toBe(r.blocked)
        })
      }
    })
  }
})

describe('núcleo do BPM: comportamento extra', () => {
  it('modo mínimo não escreve os dados do registro no log', async () => {
    const lines: string[] = []
    const c = (fixtures.cases as Case[])[4]
    const core = new BpmCore({
      db: { dialect: 'postgres', query: async () => [] },
      models: { tableOf: async (id: string) => (fixtures.models as any)[id] },
      log: { sql: (m: string) => lines.push(m), info: (m: string) => lines.push(m), debug: (m: string) => lines.push(m) },
      verbose: false,
    })
    core.setWorkflows([{ id: 'f', name: 'F', flow_data: { nodes: [
      { id: 't', type: 'trigger', data: { triggerType: ['INSERT'], triggerModelId: 'm_orders' } },
      { id: 'a', type: 'action', data: { actionType: 'insert', actionModelId: 'm_log', actionFields: [{ field: 'msg', value: '{{orders.cpf}}' }] } },
    ], edges: [{ source: 't', target: 'a' }] } } as any])
    await core.processEvent('orders', 'INSERT', { cpf: '123.456.789-00' })
    expect(lines.join('\n')).not.toContain('123.456.789-00')
    expect(c).toBeTruthy()
  })

  it('falha ao registrar a execução não derruba o fluxo', async () => {
    const queries: string[] = []
    const core = new BpmCore({
      db: { dialect: 'postgres', query: async (s: string) => { queries.push(s); return [] } },
      models: { tableOf: async (id: string) => (fixtures.models as any)[id] },
      runs: { report: async () => { throw new Error('sem rede') } },
    })
    core.setWorkflows([{ id: 'f', name: 'F', flow_data: { nodes: [
      { id: 't', type: 'trigger', data: { triggerType: ['INSERT'], triggerModelId: 'm_orders' } },
      { id: 'a', type: 'action', data: { actionType: 'insert', actionModelId: 'm_log', actionFields: [{ field: 'msg', value: 'x' }] } },
    ], edges: [{ source: 't', target: 'a' }] } } as any])
    await expect(core.processEvent('orders', 'INSERT', { id: 1 })).resolves.toEqual([])
    expect(queries).toHaveLength(1)
  })

  it('datas viram dd/MM/aaaa só em e-mail e mensagens; filtros e webhooks mantêm o valor', async () => {
    const core: any = new BpmCore({ db: { dialect: 'postgres', query: async () => [] }, models: { tableOf: async () => null } })
    const row = { dia: new Date(2026, 10, 25), momento: new Date(2026, 10, 25, 14, 5), n: 7 }
    const t = 'Dia {{pedidos.dia}} às {{pedidos.momento}} qtd {{pedidos.n}}'
    expect(await core.replaceVariables(t, 'pedidos', row, null, null, true)).toBe('Dia 25/11/2026 às 25/11/2026 14:05 qtd 7')
    // sem o modo "humano" nada muda em relação ao comportamento anterior
    expect(await core.replaceVariables('{{pedidos.dia}}', 'pedidos', row)).toBe(String(row.dia))
  })

  it('validação síncrona não espera o registro da execução (a tela está esperando a resposta)', async () => {
    const core = new BpmCore({
      db: { dialect: 'postgres', query: async () => [] },
      models: { tableOf: async (id: string) => (fixtures.models as any)[id] },
      runs: { report: () => new Promise(() => {}) }, // nunca responde
    })
    core.setWorkflows([{ id: 'f', name: 'F', flow_data: { nodes: [
      { id: 't', type: 'trigger', data: { triggerType: ['before_insert'], triggerModelId: 'm_orders' } },
      { id: 'r', type: 'response', data: { responseAllowAction: false, responseMessage: 'bloqueado' } },
    ], edges: [{ source: 't', target: 'r' }] } } as any])
    const res: any = await Promise.race([
      core.processSyncEvent('orders', 'BEFORE_INSERT', { id: 1 }),
      new Promise(r => setTimeout(() => r('travou'), 500)),
    ])
    expect(res).not.toBe('travou')
    expect(res.success).toBe(false)
  })

  it('mensagem do nó de Resposta aceita variáveis {{tabela.campo}} (bloqueio e aviso)', async () => {
    const mk = (allow: boolean) => {
      const core = new BpmCore({ db: { dialect: 'postgres', query: async () => [] }, models: { tableOf: async (id: string) => (fixtures.models as any)[id] } })
      core.setWorkflows([{ id: 'f', name: 'F', flow_data: { nodes: [
        { id: 't', type: 'trigger', data: { triggerType: ['before_update'], triggerModelId: 'm_orders' } },
        { id: 'r', type: 'response', data: { responseAllowAction: allow, responseMessage: 'Pedido {{orders.id}} não pode ser editado' } },
      ], edges: [{ source: 't', target: 'r' }] } } as any])
      return core
    }
    const blocked: any = await mk(false).processSyncEvent('orders', 'BEFORE_UPDATE', { id: 42 })
    expect(blocked.success).toBe(false)
    expect(blocked.error).toBe('Pedido 42 não pode ser editado')
    const allowed: any = await mk(true).processSyncEvent('orders', 'BEFORE_UPDATE', { id: 42 })
    expect(allowed.success).toBe(true)
    expect(allowed.message).toBe('Pedido 42 não pode ser editado')
  })

  describe('variáveis do sistema e do usuário que agiu', () => {
    const mk = () => new BpmCore({ db: { dialect: 'postgres', query: async () => [] }, models: { tableOf: async () => null } }) as any
    const actor = { id: 'u7', email: 'maria@x.com', name: 'Maria Souza' }

    it('{{sistema.*}}: em texto lido por gente sai dd/MM/aaaa; nos demais usos (filtro, valor gravado) sai ISO', async () => {
      const core = mk()
      const human = await core.replaceVariables('{{sistema.data}}|{{sistema.hora}}|{{sistema.data_hora}}', 'x', {}, null, null, true)
      expect(human).toMatch(/^\d{2}\/\d{2}\/\d{4}\|\d{2}:\d{2}\|\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)
      const tech = await core.replaceVariables('{{sistema.data}}|{{sistema.hora}}|{{sistema.data_hora}}', 'x', {})
      expect(tech).toMatch(/^\d{4}-\d{2}-\d{2}\|\d{2}:\d{2}:\d{2}\|\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    })

    it('{{usuario.*}}: vale durante o evento do usuário; sem usuário (agendado, webhook) fica literal', async () => {
      const core = mk()
      const t = 'por {{usuario.nome}} <{{usuario.email}}> id {{usuario.id}}'
      expect(await core.actorCtx.run(actor, () => core.replaceVariables(t, 'x', {}))).toBe('por Maria Souza <maria@x.com> id u7')
      expect(await core.replaceVariables(t, 'x', {})).toBe(t)
      // desconhecidos continuam literais
      expect(await core.actorCtx.run(actor, () => core.replaceVariables('{{usuario.cpf}} {{sistema.mes}}', 'x', {}))).toBe('{{usuario.cpf}} {{sistema.mes}}')
    })

    it('o usuário que agiu chega aos fluxos pelo processEvent (e o actor mal formado é ignorado)', async () => {
      const mails: any[] = []
      const core = new BpmCore({
        db: { dialect: 'postgres', query: async (s: string) => (/FROM "clientes"/.test(s) ? [{ email_contato: 'c@x.com' }] : []) },
        models: { tableOf: async (id: string) => (fixtures.models as any)[id], isKnownTable: async () => true },
        mail: { async send(m: any) { mails.push(m) } },
      })
      core.setWorkflows([{ id: 'f', name: 'F', flow_data: { nodes: [
        { id: 't', type: 'trigger', data: { triggerType: ['INSERT'], triggerModelId: 'm_orders' } },
        { id: 'a', type: 'action', data: { actionType: 'email', emailRecipientType: 'custom', customEmailField: 'c@x.com', actionSubject: 'Feito por {{usuario.nome}}', actionBody: 'Em {{sistema.data}} por {{usuario.email}}' } },
      ], edges: [{ source: 't', target: 'a' }] } } as any])
      await core.processEvent('orders', 'INSERT', { id: 1 }, null, actor)
      expect(mails[0].subject).toBe('Feito por Maria Souza')
      expect(mails[0].body).toMatch(/^Em \d{2}\/\d{2}\/\d{4} por maria@x.com$/)
      await core.processEvent('orders', 'INSERT', { id: 2 }, null, { nome: 'sem id' } as any)
      expect(mails[1].subject).toBe('Feito por {{usuario.nome}}')
    })
  })

  describe('ação Consultar dados (relatórios agendados)', () => {
    const {
      relativeDate, buildHtmlTable,
    } = require('../../../../cli/bpmCore.js') as { relativeDate: (c: any, now?: Date) => Date | null; buildHtmlTable: (d: any, max?: number) => string }

    type Rec = { sql: string; params: any[] }
    function make(handler: (sql: string, params: any[]) => any[], flowNodes: any[], edges: any[] = []) {
      const queries: Rec[] = []
      const mails: any[] = []
      const runs: any[] = []
      const core = new BpmCore({
        db: { dialect: 'postgres', async query(sql: string, params: any[]) { queries.push({ sql, params }); return handler(sql, params) } },
        models: { tableOf: async (id: string) => (fixtures.models as any)[id] || null, isKnownTable: async (n: string) => Object.values(fixtures.models as any).includes(n) },
        mail: { async send(m: any) { mails.push(m) } },
        runs: { async report(r: any) { runs.push(r) } },
      })
      core.setWorkflows([{ id: 'f', name: 'Relatório', flow_data: { nodes: flowNodes, edges } } as any])
      return { core: core as any, queries, mails, runs }
    }
    const trigger = { id: 't', type: 'trigger', data: { triggerType: ['INSERT'], triggerModelId: 'm_orders' } }
    const queryNode = (over: any = {}) => ({ id: 'q', type: 'action', data: { actionType: 'query', queryModelId: 'm_orders', queryName: 'consulta', queryColumns: [{ field: 'id', label: 'Pedido', type: 'integer' }, { field: 'total', label: 'Total', type: 'numeric' }, { field: 'data_pedido', label: 'Data', type: 'timestamp with time zone' }], queryLimit: 50, ...over } })
    const emailNode = (over: any = {}) => ({ id: 'e', type: 'action', data: { actionType: 'email', emailRecipientType: 'custom', customEmailField: 'gestor@x.com', actionSubject: 'Resumo ({{consulta.total}})', actionBody: 'Pedidos: {{consulta.tabela}}', ...over } })
    const chain = [{ source: 't', target: 'q' }, { source: 'q', target: 'e' }]

    it('monta o SQL só com colunas validadas, filtros em parâmetros, ordem e limite; o e-mail recebe tabela e total', async () => {
      const rows = [{ id: '1', total: '1500.5', data_pedido: new Date(2026, 10, 20) }, { id: '2', total: '99', data_pedido: new Date(2026, 10, 21, 14, 5) }]
      const { core, queries, mails } = make(() => rows, [trigger, queryNode({ queryFilters: [{ field: 'status', operator: '==', valueType: 'fixed', value: 'Aprovado' }, { field: 'total', operator: '>=', valueType: 'fixed', value: '100' }], queryOrderBy: 'data_pedido', queryOrderDir: 'desc' }), emailNode()], chain)
      await core.processEvent('orders', 'INSERT', { id: 1 })
      expect(queries[0].sql).toBe('SELECT "id", "total", "data_pedido" FROM "orders" WHERE "status" = $1 AND "total" >= $2 ORDER BY "data_pedido" DESC LIMIT 50')
      expect(queries[0].params).toEqual(['Aprovado', '100'])
      expect(mails).toHaveLength(1)
      expect(mails[0].subject).toBe('Resumo (2)')
      // sem quebras de linha (o envio trocaria por <br/> e quebraria a tabela); datas e valores em pt-BR
      expect(mails[0].body).not.toMatch(/<br\/>.*<table|<table[^>]*>[^]*<br\/>/)
      expect(mails[0].body).toContain('1.500,50')
      expect(mails[0].body).toContain('20/11/2026')
      expect(mails[0].body).toContain('21/11/2026 14:05')
      expect(mails[0].body).toContain('>Pedido<')
    })

    it('filtro de data relativa vira parâmetro (Date) e nunca texto no SQL', async () => {
      const { core, queries } = make(() => [], [trigger, queryNode({ queryFilters: [{ field: 'criado_em', operator: '>=', valueType: 'relative', relKind: 'now_minus', relAmount: 48, relUnit: 'hours' }] })], [{ source: 't', target: 'q' }])
      const before = Date.now()
      await core.processEvent('orders', 'INSERT', { id: 1 })
      const p = queries[0].params[0] as Date
      expect(p).toBeInstanceOf(Date)
      expect(Math.abs(before - 48 * 3600_000 - p.getTime())).toBeLessThan(5000)
      expect(queries[0].sql).toContain('"criado_em" >= $1')
    })

    it('datas relativas: início da semana (segunda), da semana passada, do mês e do mês passado', () => {
      const now = new Date(2026, 10, 26, 15, 30) // quinta-feira, 26/11/2026
      const fmt = (d: Date | null) => d && `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}`
      expect(fmt(relativeDate({ relKind: 'start_of_today' }, now))).toBe('2026-11-26 0:0')
      expect(fmt(relativeDate({ relKind: 'start_of_week' }, now))).toBe('2026-11-23 0:0')
      expect(fmt(relativeDate({ relKind: 'start_of_last_week' }, now))).toBe('2026-11-16 0:0')
      expect(fmt(relativeDate({ relKind: 'start_of_month' }, now))).toBe('2026-11-1 0:0')
      expect(fmt(relativeDate({ relKind: 'start_of_last_month' }, now))).toBe('2026-10-1 0:0')
      expect(fmt(relativeDate({ relKind: 'start_of_year' }, now))).toBe('2026-1-1 0:0')
      expect(fmt(relativeDate({ relKind: 'now_minus', relAmount: 15, relUnit: 'days' }, now))).toBe('2026-11-11 15:30')
      expect(fmt(relativeDate({ relKind: 'now_minus', relAmount: 1, relUnit: 'weeks' }, now))).toBe('2026-11-19 15:30')
      expect(relativeDate({ relKind: 'desconhecido' }, now)).toBeNull()
    })

    it('agrupar e contar com o nome vindo de outra tabela (chave estrangeira)', async () => {
      const { core, queries, mails } = make((sql) => (/GROUP BY/.test(sql) ? [{ grupo: 'f1', valor: '7' }, { grupo: 'f2', valor: '3' }] : [{ id: 'f1', rotulo: 'Ana' }, { id: 'f2', rotulo: 'Beto' }]),
        [trigger, queryNode({ queryColumns: [], queryGroupBy: 'funcionario_id', queryAggregate: 'count', queryGroupLabelModelId: 'm_clients', queryGroupLabelField: 'nome', queryGroupTitle: 'Funcionário', queryFilters: [{ field: 'data_pedido', operator: '>=', valueType: 'relative', relKind: 'now_minus', relAmount: 15, relUnit: 'days' }] }), emailNode()], chain)
      await core.processEvent('orders', 'INSERT', { id: 1 })
      expect(queries[0].sql).toBe('SELECT "funcionario_id" AS "grupo", COUNT(*) AS "valor" FROM "orders" WHERE "data_pedido" >= $1 GROUP BY "funcionario_id" ORDER BY "valor" DESC LIMIT 50')
      expect(queries[1].sql).toBe('SELECT "id", "nome" AS "rotulo" FROM "clients" WHERE "id" IN ($1,$2)')
      expect(mails[0].body).toContain('>Ana<')
      expect(mails[0].body).toContain('>Funcionário<')
      expect(mails[0].body).toContain('>Quantidade<')
      expect(mails[0].subject).toBe('Resumo (2)')
    })

    it('soma por grupo exige o campo; soma e média geram a função certa', async () => {
      const bad = make(() => [], [trigger, queryNode({ queryColumns: [], queryGroupBy: 'status', queryAggregate: 'sum' })], [{ source: 't', target: 'q' }])
      await bad.core.processEvent('orders', 'INSERT', { id: 1 })
      expect(bad.runs[0].status).toBe('error')
      expect(bad.runs[0].error_message).toContain('campo')
      const good = make(() => [{ grupo: 'A', valor: '10' }], [trigger, queryNode({ queryColumns: [], queryGroupBy: 'status', queryAggregate: 'sum', queryAggregateField: 'total' })], [{ source: 't', target: 'q' }])
      await good.core.processEvent('orders', 'INSERT', { id: 1 })
      expect(good.queries[0].sql).toContain('SUM("total") AS "valor"')
    })

    it('"não continuar se não houver resultado": sem linhas o e-mail não sai; com o marcador desligado, sai com a mensagem de vazio', async () => {
      const a = make(() => [], [trigger, queryNode({ querySkipWhenEmpty: true }), emailNode()], chain)
      await a.core.processEvent('orders', 'INSERT', { id: 1 })
      expect(a.mails).toHaveLength(0)
      expect(a.runs[0].status).toBe('success')
      const b = make(() => [], [trigger, queryNode(), emailNode()], chain)
      await b.core.processEvent('orders', 'INSERT', { id: 1 })
      expect(b.mails).toHaveLength(1)
      expect(b.mails[0].body).toContain('Nenhum registro encontrado.')
      expect(b.mails[0].subject).toBe('Resumo (0)')
    })

    it('segurança: tabela fora do projeto, coluna com nome suspeito e operador desconhecido nunca entram no SQL', async () => {
      const t1 = make(() => [], [trigger, queryNode({ queryModelId: 'm_inexistente' })], [{ source: 't', target: 'q' }])
      await t1.core.processEvent('orders', 'INSERT', { id: 1 })
      expect(t1.queries).toHaveLength(0)
      expect(t1.runs[0].status).toBe('error')
      const t2 = make(() => [], [trigger, queryNode({ queryColumns: [{ field: 'id"; DROP TABLE orders; --', label: 'x' }, { field: 'total', label: 'Total' }], queryFilters: [{ field: 'status', operator: '; DROP', valueType: 'fixed', value: 'x' }, { field: 'x y', operator: '=', valueType: 'fixed', value: '1' }] })], [{ source: 't', target: 'q' }])
      await t2.core.processEvent('orders', 'INSERT', { id: 1 })
      expect(t2.queries[0].sql).toBe('SELECT "total" FROM "orders" LIMIT 50')
      expect(t2.queries[0].params).toEqual([])
    })

    it('limite de linhas é aplicado (padrão 200, teto 5000)', async () => {
      const a = make(() => [], [trigger, queryNode({ queryLimit: undefined })], [{ source: 't', target: 'q' }])
      await a.core.processEvent('orders', 'INSERT', { id: 1 })
      expect(a.queries[0].sql).toMatch(/LIMIT 200$/)
      const b = make(() => [], [trigger, queryNode({ queryLimit: 999999 })], [{ source: 't', target: 'q' }])
      await b.core.processEvent('orders', 'INSERT', { id: 1 })
      expect(b.queries[0].sql).toMatch(/LIMIT 5000$/)
    })

    it('anexo: o e-mail leva o resultado como planilha; resultado inexistente vira erro anotado, sem anexo', async () => {
      const rows = [{ id: '1', total: '10', data_pedido: new Date(2026, 10, 20) }]
      const ok = make(() => rows, [trigger, queryNode(), emailNode({ emailAttachDataset: 'consulta', emailAttachFormat: 'xlsx' })], chain)
      await ok.core.processEvent('orders', 'INSERT', { id: 1 })
      expect(ok.mails[0].attachments).toHaveLength(1)
      expect(ok.mails[0].attachments[0].format).toBe('xlsx')
      expect(ok.mails[0].attachments[0].filename).toMatch(/^consulta-\d{4}-\d{2}-\d{2}\.xlsx$/)
      expect(ok.mails[0].attachments[0].dataset.rows).toEqual(rows)
      const missing = make(() => rows, [trigger, queryNode(), emailNode({ emailAttachDataset: 'outra' })], chain)
      await missing.core.processEvent('orders', 'INSERT', { id: 1 })
      expect(missing.mails[0].attachments).toBeUndefined()
      expect(missing.runs[0].status).toBe('error')
    })

    it('tabela HTML: escapa texto, formata data e valor, limita as linhas do corpo e avisa quantas faltam', () => {
      const ds = { columns: [{ key: 'n', label: 'Nome <b>', type: 'text' }, { key: 'v', label: 'Valor', type: 'numeric' }], rows: Array.from({ length: 5 }, (_, i) => ({ n: i === 0 ? '<script>x</script>' : 'L' + i, v: '1234.5' })), total: 5 }
      const html = buildHtmlTable(ds, 3)
      expect(html).not.toContain('<script>')
      expect(html).toContain('&lt;script&gt;')
      expect(html).toContain('Nome &lt;b&gt;')
      expect(html).toContain('1.234,50')
      expect(html).toContain('Mostrando 3 de 5 linhas.')
      expect(html).not.toContain(String.fromCharCode(10))
    })
  })

  describe('aba Mensagem da ação (aviso na tela de quem gravou)', () => {
    const flow = (data: any = {}) => ({ id: 'f', name: 'F', flow_data: { nodes: [
      { id: 't', type: 'trigger', data: { triggerType: ['INSERT'], triggerModelId: 'm_orders' } },
      { id: 'a', type: 'action', data: { actionType: 'insert', actionModelId: 'm_log', actionFields: [{ field: 'msg', value: 'x' }], ...data } },
    ], edges: [{ source: 't', target: 'a' }] } } as any)
    const make = (query: any = async () => []) => new BpmCore({ db: { dialect: 'postgres', query }, models: { tableOf: async (id: string) => (fixtures.models as any)[id] } })

    it('monta o texto (assunto + corpo, variáveis e HTML limpo) e o devolve de processEvent', async () => {
      const core = make()
      core.setWorkflows([flow({ successMessageSubject: 'Pedido {{orders.id}} gravado', successMessageBody: '<p>Olá&nbsp;<b>mundo</b></p><p>Tudo certo.</p>' })])
      const msgs: any = await core.processEvent('orders', 'INSERT', { id: 7 })
      expect(msgs).toHaveLength(1)
      expect(msgs[0].text).toBe('Pedido 7 gravado' + String.fromCharCode(10) + 'Olá mundo' + String.fromCharCode(10) + 'Tudo certo.')
    })

    it('campo único successMessage: texto com variáveis e tipo do aviso', async () => {
      const core = make()
      core.setWorkflows([flow({ successMessage: 'Pedido {{orders.id}} enviado.', successMessageType: 'warning' })])
      expect(await core.processEvent('orders', 'INSERT', { id: 7 })).toEqual([{ text: 'Pedido 7 enviado.', type: 'warning' }])
    })

    it('tipo desconhecido vira sucesso; o campo único vale mais que assunto e corpo antigos', async () => {
      const core = make()
      core.setWorkflows([flow({ successMessage: 'Novo texto', successMessageType: 'qualquer', successMessageSubject: 'antigo', successMessageBody: 'antigo' })])
      expect(await core.processEvent('orders', 'INSERT', { id: 7 })).toEqual([{ text: 'Novo texto', type: 'success' }])
    })

    it('sem assunto e sem corpo não há mensagem', async () => {
      const core = make()
      core.setWorkflows([flow()])
      expect(await core.processEvent('orders', 'INSERT', { id: 7 })).toEqual([])
    })

    it('ação que falha (erro do banco) não gera mensagem de sucesso', async () => {
      const core = make(async () => { throw new Error('banco fora') })
      core.setWorkflows([flow({ successMessageSubject: 'ok' })])
      expect(await core.processEvent('orders', 'INSERT', { id: 7 })).toEqual([])
    })

    it('e-mail que não sai (sem destinatário) não gera mensagem de sucesso', async () => {
      const core = make()
      core.setWorkflows([flow({ actionType: 'email', actionModelId: undefined, actionFields: undefined, emailRecipientType: 'custom', customEmailField: '', actionSubject: 's', actionBody: 'b', successMessageSubject: 'E-mail enviado' })])
      expect(await core.processEvent('orders', 'INSERT', { id: 7 })).toEqual([])
    })

    it('na validação síncrona a mensagem vai junto no resultado', async () => {
      const core = make()
      core.setWorkflows([{ id: 'f', name: 'F', flow_data: { nodes: [
        { id: 't', type: 'trigger', data: { triggerType: ['before_insert'], triggerModelId: 'm_orders' } },
        { id: 'a', type: 'action', data: { actionType: 'insert', actionModelId: 'm_log', actionFields: [{ field: 'msg', value: 'x' }], successMessageSubject: 'Registrado' } },
      ], edges: [{ source: 't', target: 'a' }] } } as any])
      const res: any = await core.processSyncEvent('orders', 'BEFORE_INSERT', { id: 1 })
      expect(res.success).toBe(true)
      expect(res.message).toBe('Registrado')
    })
  })

  describe('agendamento "Apenas uma vez"', () => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    const setup = (schedule: any) => {
      const jobs: { expr: string; fn: () => Promise<void>; stopped: boolean }[] = []
      const warns: string[] = []
      const core = new BpmCore({
        db: { dialect: 'postgres', query: async () => [] },
        models: { tableOf: async () => null },
        log: { warn: (m: string) => warns.push(m) },
        scheduler: { schedule: (expr: string, fn: () => Promise<void>) => { const j = { expr, fn, stopped: false }; jobs.push(j); return { stop() { j.stopped = true } } } },
      })
      core.setWorkflows([{ id: 'f', name: 'Agendado', flow_data: { nodes: [
        { id: 't', type: 'trigger', data: { triggerType: ['SCHEDULED'], triggerSchedules: [schedule] } },
      ], edges: [] } } as any])
      return { jobs, warns }
    }

    it('data e hora futuras: agenda; ao disparar, o agendamento é encerrado (uma vez só, sem repetir no ano seguinte)', async () => {
      const future = new Date(Date.now() + 2 * 3600_000)
      const { jobs, warns } = setup({ id: '1', type: 'once', days: [], time: '', dateTime: local(future) })
      expect(jobs).toHaveLength(1)
      expect(jobs[0].expr).toBe(`${future.getMinutes()} ${future.getHours()} ${future.getDate()} ${future.getMonth() + 1} *`)
      expect(warns).toEqual([])
      expect(jobs[0].stopped).toBe(false)
      await jobs[0].fn()
      expect(jobs[0].stopped).toBe(true)
    })

    it('sem data e hora específicas (só dia da semana e horário): não agenda e AVISA, em vez de ignorar em silêncio', () => {
      const { jobs, warns } = setup({ id: '1', type: 'once', days: ['4'], time: '01:45', dateTime: '' })
      expect(jobs).toHaveLength(0)
      expect(warns.join(' ')).toContain('sem data e hora')
    })

    it('data que já passou: não agenda e avisa', () => {
      const { jobs, warns } = setup({ id: '1', type: 'once', days: [], time: '', dateTime: local(new Date(Date.now() - 3600_000)) })
      expect(jobs).toHaveLength(0)
      expect(warns.join(' ')).toContain('já passou')
    })

    it('recorrente continua como antes (não é encerrado ao disparar)', async () => {
      const { jobs, warns } = setup({ id: '1', type: 'recurring', days: ['4'], time: '01:45', dateTime: '' })
      expect(jobs.map(j => j.expr)).toEqual(['45 01 * * 4'])
      expect(warns).toEqual([])
      await jobs[0].fn()
      expect(jobs[0].stopped).toBe(false)
    })
  })

  it('agendamento recorrente vira cron e usa o agendador injetado', () => {
    const crons: string[] = []
    const core = new BpmCore({
      db: { dialect: 'postgres', query: async () => [] },
      models: { tableOf: async () => null },
      scheduler: { schedule: (expr: string) => { crons.push(expr); return { stop() {} } } },
    })
    core.setWorkflows([{ id: 'f', name: 'F', flow_data: { nodes: [
      { id: 't', type: 'trigger', data: { triggerType: ['SCHEDULED'], triggerSchedules: [{ type: 'recurring', days: [1, 3], time: '08:30' }] } },
    ], edges: [] } } as any])
    expect(crons).toEqual(['30 08 * * 1,3'])
  })
})
