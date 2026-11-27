import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import type { BpmCore as BpmCoreType, BpmRunReport } from '../bpmCore'

const require = createRequire(import.meta.url)
const core = require('../../../../cli/bpmCore.js') as {
  BpmCore: new (ports: any) => BpmCoreType
  approvalDdl: (d: 'postgres' | 'oracle') => string[]
  approvalAssignees: (d: any) => { users: string[]; groups: string[] }
  approvalAllows: (a: any, actor: any) => boolean
  approvalSnapshot: (row: any) => string
}
const { BpmCore, approvalDdl, approvalAssignees, approvalAllows, approvalSnapshot } = core

/** Banco de mentira: entende só o SQL das aprovações (e a leitura de um registro) o bastante para exercitar o motor. */
function fakeDb(records: Record<string, any[]> = {}) {
  const tasks: any[] = []
  const history: any[] = []
  const log: string[] = []
  const insert = (sql: string, params: any[], into: any[]) => {
    const cols = /\(([^)]+)\) VALUES/.exec(sql)![1].split(',').map(s => s.trim())
    const row: any = {}
    cols.forEach((c, i) => { row[c] = params[i] })
    into.push(row)
  }
  async function query(sql: string, params: any[] = []) {
    log.push(sql)
    if (/^CREATE /.test(sql)) return []
    if (/^INSERT INTO mb_approval_tasks/.test(sql)) { insert(sql, params, tasks); return [] }
    if (/^INSERT INTO mb_approval_history/.test(sql)) { insert(sql, params, history); return [] }
    if (/^SELECT decided_by, decided_at FROM mb_approval_tasks/.test(sql)) return tasks.filter(t => t.id === params[0]).map(t => ({ decided_by: t.decided_by, decided_at: t.decided_at }))
    if (/^SELECT \* FROM mb_approval_tasks WHERE id =/.test(sql)) return tasks.filter(t => t.id === params[0]).map(t => ({ ...t }))
    const byStatus = /^SELECT \* FROM mb_approval_tasks WHERE status = '(\w+)'/.exec(sql)
    if (byStatus) return tasks.filter(t => t.status === byStatus[1]).map(t => ({ ...t }))
    if (/^SELECT \* FROM mb_approval_tasks WHERE requested_by =/.test(sql)) return tasks.filter(t => t.requested_by === params[0]).map(t => ({ ...t }))
    if (/^SELECT \* FROM mb_approval_tasks WHERE decided_by =/.test(sql)) return tasks.filter(t => t.decided_by === params[0]).map(t => ({ ...t }))
    if (/^SELECT \* FROM mb_approval_tasks/.test(sql)) return tasks.map(t => ({ ...t }))
    if (/^SELECT event, actor_name/.test(sql)) return history.filter(h => h.table_name === params[0] && h.record_pk === params[1]).map(h => ({ ...h }))
    if (/^UPDATE mb_approval_tasks SET/.test(sql)) {
      const id = params[Number(/WHERE id = \$(\d+)/.exec(sql)![1]) - 1]
      const t = tasks.find(x => x.id === id)
      if (!t || (/AND status = 'pending'/.test(sql) && t.status !== 'pending')) return []
      const set = /SET (.+) WHERE/.exec(sql)![1]
      for (const m of set.matchAll(/(\w+) = (\$\d+|'[^']*')/g)) t[m[1]] = m[2].startsWith('$') ? params[Number(m[2].slice(1)) - 1] : m[2].slice(1, -1)
      return []
    }
    const rec = /^SELECT \* FROM "(\w+)" WHERE "id" = \$1/.exec(sql)
    if (rec) return (records[rec[1]] || []).filter(r => String(r.id) === String(params[0]))
    return []
  }
  return { tasks, history, log, query }
}

const NODES = (extra: Record<string, any> = {}) => [
  { id: 't', type: 'trigger', data: { triggerType: ['insert'], triggerModelId: 'm1' } },
  { id: 'ap', type: 'approval', data: { emailGroupsUsers: { Gerente: 'all' }, approvalTitle: 'Pedido {{pedidos.id}} de {{pedidos.valor}}', ...extra } },
  { id: 'ok', type: 'action', data: { actionType: 'email', emailRecipientType: 'custom', customEmailField: 'solic@x.com', actionSubject: 'Aprovado', actionBody: 'Por {{aprovacao.por}}: {{aprovacao.comentario}} ({{aprovacao.decisao}}) em {{pedidos.id}}' } },
  { id: 'no', type: 'action', data: { actionType: 'email', emailRecipientType: 'custom', customEmailField: 'solic@x.com', actionSubject: 'Negado', actionBody: 'Motivo: {{aprovacao.comentario}}' } },
]
const EDGES = [
  { id: 'e1', source: 't', target: 'ap' },
  { id: 'e2', source: 'ap', target: 'ok', sourceHandle: 'approved' },
  { id: 'e3', source: 'ap', target: 'no', sourceHandle: 'rejected' },
]

function setup(opts: { features?: boolean; dialect?: 'postgres' | 'oracle'; nodes?: any[]; edges?: any[]; records?: Record<string, any[]>; trigger?: string } = {}) {
  const db = fakeDb(opts.records)
  const mails: any[] = []
  const runs: BpmRunReport[] = []
  const c = new BpmCore({
    db: { dialect: opts.dialect || 'postgres', query: db.query },
    models: { tableOf: async () => 'pedidos', isKnownTable: async () => true },
    mail: { async send(m: any) { mails.push(m) } },
    recipients: { async resolveSystem() { return 'gerente@x.com' } },
    runs: { async report(r: BpmRunReport) { runs.push(r) } },
    verbose: false,
    ...(opts.features === false ? {} : { features: { approvals: true } }),
  })
  c.setWorkflows([{ id: 'f1', name: 'Aprovar pedido', flow_data: { nodes: opts.nodes || NODES(), edges: opts.edges || EDGES } } as any])
  return { c, db, mails, runs }
}

const solic = { id: '10', name: 'Ana', roles: ['Vendas'] }
const gerente = { id: '20', name: 'Gil', roles: ['Gerente'] }
const intruso = { id: '30', name: 'Zé', roles: ['Vendas'] }

describe('aprovação: tabelas (DDL)', () => {
  it('PostgreSQL cria só se não existir; Oracle não usa IF NOT EXISTS nem a palavra reservada comment', () => {
    const pg = approvalDdl('postgres')
    const ora = approvalDdl('oracle')
    expect(pg).toHaveLength(4)
    expect(ora).toHaveLength(4)
    for (const s of pg) { expect(s).toMatch(/IF NOT EXISTS/); expect(s).not.toMatch(/VARCHAR2|CLOB/) }
    for (const s of ora) { expect(s).not.toMatch(/IF NOT EXISTS/); expect(s).not.toMatch(/\bTEXT\b/) }
    expect(ora.join('\n')).toMatch(/CLOB/)
    expect(ora.join('\n')).toMatch(/comment_text/)
    expect(ora.join('\n')).not.toMatch(/\bcomment\b\s+\w/)
    // nomes de índice de Oracle cabem em 30 caracteres (versões antigas)
    for (const s of ora) { const m = /CREATE INDEX (\w+)/.exec(s); if (m) expect(m[1].length).toBeLessThanOrEqual(30) }
  })
})

describe('aprovação: quem pode decidir', () => {
  it('lê usuários e perfis da escolha do bloco (a mesma do e-mail)', () => {
    expect(approvalAssignees({ emailGroupsUsers: { Gerente: 'all', Vendas: ['1', 2], Vazio: [] } })).toEqual({ users: ['1', '2'], groups: ['Gerente'] })
    expect(approvalAssignees({})).toEqual({ users: [], groups: [] })
  })
  it('pessoa pelo id e perfil pelos grupos assinados; sem ator, ninguém', () => {
    const a = { users: ['20'], groups: ['Diretoria'] }
    expect(approvalAllows(a, { id: '20' })).toBe(true)
    expect(approvalAllows(a, { id: '99', roles: ['Diretoria'] })).toBe(true)
    expect(approvalAllows(a, { id: '99', roles: ['Vendas'] })).toBe(false)
    expect(approvalAllows(a, null)).toBe(false)
    expect(approvalAllows({ users: [], groups: [] }, { id: '1', roles: ['x'] })).toBe(false)
  })
  it('o registro guardado não leva senha, token nem texto enorme', () => {
    const s = JSON.parse(approvalSnapshot({ id: 1, nome: 'A', senha: 'x', api_token: 't', obs: 'a'.repeat(3000), valor: 10 }))
    expect(s).toEqual({ id: 1, nome: 'A', valor: 10 })
  })
})

describe('aprovação: pausa do fluxo', () => {
  it('ao chegar no bloco, cria a tarefa, avisa o aprovador e NÃO segue nenhuma saída', async () => {
    const { c, db, mails, runs } = setup()
    await c.processEvent('pedidos', 'INSERT', { id: 7, valor: 500 }, null, solic)
    expect(db.tasks).toHaveLength(1)
    expect(db.tasks[0]).toMatchObject({ status: 'pending', table_name: 'pedidos', record_pk: '7', requested_by: '10', title: 'Pedido 7 de 500', node_id: 'ap', allow_self: 0 })
    expect(JSON.parse(db.tasks[0].assignees)).toEqual({ users: [], groups: ['Gerente'] })
    expect(db.history.map(h => h.event)).toEqual(['requested'])
    expect(mails).toHaveLength(1)
    expect(mails[0].to).toBe('gerente@x.com')
    expect(mails[0].subject).toMatch(/Aprovação pendente: Pedido 7/)
    expect(runs).toHaveLength(1)
    expect(runs[0].status).toBe('success')
    expect(runs[0].details?.waiting).toBe(true)
  })

  it('bloco sem aprovador não cria tarefa e marca a execução com erro', async () => {
    const { c, db, runs } = setup({ nodes: NODES({ emailGroupsUsers: {} }) })
    await c.processEvent('pedidos', 'INSERT', { id: 1 }, null, solic)
    expect(db.tasks).toHaveLength(0)
    expect(runs[0].status).toBe('error')
    expect(runs[0].error_message).toMatch(/sem aprovador/)
  })

  it('onde as aprovações não existem (app exportado), o fluxo para com aviso e nada é gravado', async () => {
    const { c, db, mails, runs } = setup({ features: false })
    await c.processEvent('pedidos', 'INSERT', { id: 1 }, null, solic)
    expect(db.tasks).toHaveLength(0)
    expect(mails).toHaveLength(0)
    expect(runs[0].status).toBe('error')
    expect(runs[0].error_message).toMatch(/não é suportado/)
  })

  it('em fluxo "antes de salvar" o bloco é recusado com aviso e não grava nada', async () => {
    const nodes = NODES(); (nodes[0].data as any).triggerType = ['before_insert']
    const { c, db, runs } = setup({ nodes })
    const r = await c.processSyncEvent('pedidos', 'BEFORE_INSERT', { id: 1 }, null, solic)
    expect(r.success).toBe(true)
    expect(db.tasks).toHaveLength(0)
    expect(runs.some(x => x.status === 'error' && /antes de salvar/.test(x.error_message || ''))).toBe(true)
  })
})

describe('aprovação: decisão e retomada', () => {
  async function pending(over: any = {}) {
    const s = setup(over)
    await s.c.processEvent('pedidos', 'INSERT', { id: 7, valor: 500 }, null, solic)
    s.mails.length = 0
    s.runs.length = 0
    return s
  }

  it('aprovar segue SÓ pela saída Aprovado, com as variáveis da decisão', async () => {
    const { c, db, mails, runs } = await pending()
    const r = await c.decideApproval({ taskId: db.tasks[0].id, decision: 'approved', comment: 'Tudo certo', actor: gerente })
    expect(r).toMatchObject({ ok: true, resumed: true })
    expect(db.tasks[0]).toMatchObject({ status: 'approved', decided_by: '20', decision_comment: 'Tudo certo' })
    expect(mails).toHaveLength(1)
    expect(mails[0].subject).toBe('Aprovado')
    expect(mails[0].body).toBe('Por Gil: Tudo certo (aprovado) em 7')
    expect(db.history.map(h => h.event)).toEqual(['requested', 'approved'])
    expect(runs).toHaveLength(1)
    expect(runs[0].trigger_source).toBe('aprovação')
  })

  it('rejeitar segue SÓ pela saída Rejeitado', async () => {
    const { c, db, mails } = await pending()
    await c.decideApproval({ taskId: db.tasks[0].id, decision: 'rejected', comment: 'Valor alto', actor: gerente })
    expect(db.tasks[0].status).toBe('rejected')
    expect(mails.map(m => m.subject)).toEqual(['Negado'])
    expect(mails[0].body).toBe('Motivo: Valor alto')
  })

  it('só a primeira decisão vale', async () => {
    const { c, db, mails } = await pending()
    await c.decideApproval({ taskId: db.tasks[0].id, decision: 'approved', actor: gerente })
    await expect(c.decideApproval({ taskId: db.tasks[0].id, decision: 'rejected', actor: gerente })).rejects.toThrow(/já foi decidida/)
    expect(mails).toHaveLength(1)
    expect(db.tasks[0].status).toBe('approved')
  })

  it('quem não é aprovador, ou não está identificado, não decide', async () => {
    const { c, db, mails } = await pending()
    await expect(c.decideApproval({ taskId: db.tasks[0].id, decision: 'approved', actor: intruso })).rejects.toThrow(/não é aprovador/)
    await expect(c.decideApproval({ taskId: db.tasks[0].id, decision: 'approved', actor: null })).rejects.toThrow(/não identificado/)
    await expect(c.decideApproval({ taskId: db.tasks[0].id, decision: 'talvez' as any, actor: gerente })).rejects.toThrow(/Decisão inválida/)
    await expect(c.decideApproval({ taskId: 'nao-existe', decision: 'approved', actor: gerente })).rejects.toThrow(/não encontrada/)
    expect(db.tasks[0].status).toBe('pending')
    expect(mails).toHaveLength(0)
  })

  it('quem pediu não aprova o próprio pedido, a menos que o bloco permita', async () => {
    const both = { id: '10', name: 'Ana', roles: ['Gerente'] } // pediu E é gerente
    const a = await pending()
    await expect(a.c.decideApproval({ taskId: a.db.tasks[0].id, decision: 'approved', actor: both })).rejects.toThrow(/Quem pediu/)
    const b = setup({ nodes: NODES({ approvalAllowSelf: true }) })
    await b.c.processEvent('pedidos', 'INSERT', { id: 8, valor: 1 }, null, both)
    await expect(b.c.decideApproval({ taskId: b.db.tasks[0].id, decision: 'approved', actor: both })).resolves.toMatchObject({ ok: true })
  })

  it('perfil nunca vem do corpo: sem roles assinados, o perfil não basta', async () => {
    const { c, db } = await pending()
    await expect(c.decideApproval({ taskId: db.tasks[0].id, decision: 'approved', actor: { id: '20', name: 'Gil' } })).rejects.toThrow(/não é aprovador/)
  })

  it('se o fluxo foi apagado ou alterado, a decisão fica registrada e o fluxo não continua', async () => {
    const { c, db, mails } = await pending()
    c.setWorkflows([])
    const r = await c.decideApproval({ taskId: db.tasks[0].id, decision: 'approved', actor: gerente })
    expect(r).toMatchObject({ ok: true, resumed: false })
    expect(r.warning).toMatch(/alterado ou desativado/)
    expect(db.tasks[0].status).toBe('approved')
    expect(mails).toHaveLength(0)
  })

  it('a retomada usa o registro como está hoje', async () => {
    const records = { pedidos: [{ id: 7, valor: 900 }] }
    const s = setup({ records })
    const nodes = NODES(); (nodes[2].data as any).actionBody = 'Valor {{pedidos.valor}}'
    s.c.setWorkflows([{ id: 'f1', name: 'F', flow_data: { nodes, edges: EDGES } } as any])
    await s.c.processEvent('pedidos', 'INSERT', { id: 7, valor: 500 }, null, solic)
    s.mails.length = 0
    await s.c.decideApproval({ taskId: s.db.tasks[0].id, decision: 'approved', actor: gerente })
    expect(s.mails[0].body).toBe('Valor 900')
  })
})

describe('aprovação: listas, histórico e cancelamento', () => {
  async function two() {
    const s = setup()
    await s.c.processEvent('pedidos', 'INSERT', { id: 7, valor: 500 }, null, solic)
    await s.c.processEvent('pedidos', 'INSERT', { id: 8, valor: 600 }, null, solic)
    return s
  }

  it('cada pessoa vê só as tarefas dela; quem pediu não vê como pendente de decisão', async () => {
    const { c } = await two()
    const g = await c.approvalOp('approval_list', { view: 'pending' }, gerente)
    expect(g.tasks.map((t: any) => t.title)).toEqual(['Pedido 7 de 500', 'Pedido 8 de 600'])
    expect(g.tasks[0].record).toBeUndefined() // a lista leva só o resumo
    expect(g.tasks[0].summary).toEqual([['id', '7'], ['valor', '500']])
    expect((await c.approvalOp('approval_list', { view: 'pending' }, intruso)).tasks).toEqual([])
    expect((await c.approvalOp('approval_list', { view: 'pending' }, solic)).tasks).toEqual([])
    expect((await c.approvalOp('approval_list', { view: 'requested' }, solic)).tasks).toHaveLength(2)
  })

  it('o detalhe leva o registro inteiro, mas só para quem pode ver a tarefa', async () => {
    const { c, db } = await two()
    const ok = await c.approvalOp('approval_list', { taskId: db.tasks[0].id }, gerente)
    expect(ok.tasks[0].record).toEqual({ id: 7, valor: 500 })
    expect((await c.approvalOp('approval_list', { taskId: db.tasks[0].id }, intruso)).tasks).toEqual([])
  })

  it('o que decidi aparece em "decididas"', async () => {
    const { c, db } = await two()
    await c.approvalOp('approval_decide', { taskId: db.tasks[0].id, decision: 'approved', comment: 'ok' }, gerente)
    const d = await c.approvalOp('approval_list', { view: 'decided' }, gerente)
    expect(d.tasks).toHaveLength(1)
    expect(d.tasks[0]).toMatchObject({ status: 'approved', comment: 'ok', decidedBy: 'Gil' })
  })

  it('histórico do registro em ordem, com quem e o comentário', async () => {
    const { c, db } = await two()
    await c.approvalOp('approval_decide', { taskId: db.tasks[0].id, decision: 'rejected', comment: 'caro' }, gerente)
    const h = await c.approvalOp('approval_history', { table: 'pedidos', pk: '7' }, solic)
    expect(h.events.map((e: any) => e.event)).toEqual(['requested', 'rejected'])
    expect(h.events[1]).toMatchObject({ by: 'Gil', comment: 'caro' })
    expect((await c.approvalOp('approval_history', { table: 'pedidos', pk: '999' }, solic)).events).toEqual([])
  })

  it('leitura sem as tabelas criadas devolve vazio, sem criar nada', async () => {
    const ports = { db: { dialect: 'postgres', query: async (sql: string) => { if (/mb_approval/.test(sql)) { const e: any = new Error('relation "mb_approval_tasks" does not exist'); e.code = '42P01'; throw e } return [] } }, models: { tableOf: async () => 'pedidos' }, features: { approvals: true }, verbose: false }
    const c = new BpmCore(ports)
    expect(await c.approvalOp('approval_list', { view: 'pending' }, gerente)).toEqual({ tasks: [] })
    expect(await c.approvalOp('approval_history', { table: 'pedidos', pk: '1' }, gerente)).toEqual({ events: [] })
    expect(await c.approvalOp('approval_admin_list', {}, null)).toEqual({ tasks: [] })
  })

  it('o dono vê todas e cancela uma pendente; cancelada não é mais decidida', async () => {
    const { c, db } = await two()
    expect((await c.approvalOp('approval_admin_list', {}, null)).tasks).toHaveLength(2)
    expect((await c.approvalOp('approval_admin_list', { status: 'approved' }, null)).tasks).toHaveLength(0)
    const owner = { id: 'member:abc', name: 'Administrador do projeto' }
    await c.approvalOp('approval_cancel', { taskId: db.tasks[0].id }, owner)
    expect(db.tasks[0].status).toBe('cancelled')
    expect(db.history.at(-1)).toMatchObject({ event: 'cancelled', actor_id: 'member:abc' })
    await expect(c.decideApproval({ taskId: db.tasks[0].id, decision: 'approved', actor: gerente })).rejects.toThrow(/já foi decidida/)
    await expect(c.approvalOp('approval_cancel', { taskId: db.tasks[0].id }, owner)).rejects.toThrow(/pendentes/)
  })

  it('ação desconhecida é recusada', async () => {
    const { c } = await two()
    await expect(c.approvalOp('approval_x', {}, gerente)).rejects.toThrow(/desconhecida/)
  })

  it('as tabelas são criadas uma vez só e sem permissão o erro aponta o script do DBA', async () => {
    const s = setup()
    await s.c.processEvent('pedidos', 'INSERT', { id: 1 }, null, solic)
    await s.c.processEvent('pedidos', 'INSERT', { id: 2 }, null, solic)
    expect(s.db.log.filter(q => /^CREATE TABLE/.test(q))).toHaveLength(2) // tarefas + histórico, uma vez
    const denied = new BpmCore({ db: { dialect: 'postgres', query: async (sql: string) => { if (/^CREATE/.test(sql)) throw new Error('permission denied'); return [] } }, models: { tableOf: async () => 'pedidos' }, features: { approvals: true }, recipients: { resolveSystem: async () => 'a@a.com' }, verbose: false })
    denied.setWorkflows([{ id: 'f1', name: 'F', flow_data: { nodes: NODES(), edges: EDGES } } as any])
    const runs: any[] = []
    ;(denied as any).ports.runs = { report: async (r: any) => runs.push(r) }
    await denied.processEvent('pedidos', 'INSERT', { id: 1 }, null, solic)
    expect(runs[0].status).toBe('error')
    expect(runs[0].error_message).toMatch(/scripts\/mb-approvals\.sql/)
  })
})
