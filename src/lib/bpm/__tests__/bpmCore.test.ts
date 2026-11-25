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
    await expect(core.processEvent('orders', 'INSERT', { id: 1 })).resolves.toBeUndefined()
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
