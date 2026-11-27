import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import type { BpmCore as BpmCoreType } from '../bpmCore'

const require = createRequire(import.meta.url)
const { BpmCore } = require('../../../../cli/bpmCore.js') as { BpmCore: new (ports: any) => BpmCoreType }

const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'

const trigger = { id: 't', type: 'trigger', data: { triggerType: ['INSERT'], triggerModelId: 'm' } }
const query = (over: any = {}) => ({ id: 'q', type: 'action', data: { actionType: 'query', queryModelId: 'm', queryName: 'pedidos', queryColumns: [{ field: 'id', label: 'Pedido', type: 'integer' }], queryLimit: 50, ...over } })
const download = (over: any = {}) => ({ id: 'd', type: 'action', data: { actionType: 'download', downloadDataset: 'pedidos', downloadFormat: 'xlsx', emailGroupsUsers: { Gerente: 'all' }, ...over } })
const chain = [{ source: 't', target: 'q' }, { source: 'q', target: 'd' }]

function setup(opts: { nodes?: any[]; ids?: string[] | Error; withDownloads?: boolean; withIds?: boolean; deliverFails?: boolean } = {}) {
  const delivered: any[] = []
  const mails: any[] = []
  const runs: any[] = []
  const warns: string[] = []
  const ports: any = {
    db: { dialect: 'postgres', async query() { return [{ id: '1' }, { id: '2' }] } },
    models: { tableOf: async () => 'orders', isKnownTable: async () => true },
    mail: { async send(m: any) { mails.push(m) } },
    runs: { async report(r: any) { runs.push(r) } },
    recipients: {
      async resolveSystem() { return 'g@x.com' },
      ...(opts.withIds === false ? {} : { async resolveIds() { if (opts.ids instanceof Error) throw opts.ids; return opts.ids ?? [U1, U2] } }),
    },
    log: { warn: (m: string) => warns.push(m) },
    verbose: false,
  }
  if (opts.withDownloads !== false) {
    ports.downloads = { async deliver(a: any) { if (opts.deliverFails) throw new Error('o servidor respondeu 502'); delivered.push(a); return { delivered: a.recipientIds.length } } }
  }
  const core = new BpmCore(ports)
  core.setWorkflows([{ id: 'f1', name: 'Relatório semanal', flow_data: { nodes: opts.nodes || [trigger, query(), download()], edges: chain } } as any])
  return { core, delivered, mails, runs, warns }
}
const fire = (s: ReturnType<typeof setup>) => s.core.processEvent('orders', 'INSERT', { id: 9 })

describe('ação Download: arquivo do resultado na Central de Downloads', () => {
  it('gera o arquivo do resultado da consulta e entrega a cada destinatário, com o título da automação', async () => {
    const s = setup()
    await fire(s)
    expect(s.delivered).toHaveLength(1)
    const d = s.delivered[0]
    expect(d.format).toBe('xlsx')
    expect(d.recipientIds).toEqual([U1, U2])
    expect(d.title).toBe('Automação: Relatório semanal')
    expect(d.dataset.rows).toHaveLength(2)
    expect(d.fileName).toMatch(/^pedidos-\d{4}-\d{2}-\d{2}\.xlsx$/)
    expect(s.runs[0].status).toBe('success')
    expect(s.mails).toHaveLength(0) // o aviso por e-mail vem DESMARCADO por padrão
  })

  it('aceita os 5 formatos; formato desconhecido cai em xlsx', async () => {
    for (const f of ['xlsx', 'csv', 'pdf', 'json', 'ofx']) {
      const s = setup({ nodes: [trigger, query(), download({ downloadFormat: f })] })
      await fire(s)
      expect(s.delivered[0].format).toBe(f)
      expect(s.delivered[0].fileName.endsWith('.' + f)).toBe(true)
    }
    const s = setup({ nodes: [trigger, query(), download({ downloadFormat: 'exe' })] })
    await fire(s)
    expect(s.delivered[0].format).toBe('xlsx')
  })

  it('o nome aceita variáveis e sai limpo: sem acento, sem caminho e sem caracteres estranhos', async () => {
    const s = setup({ nodes: [trigger, query(), download({ downloadFileName: 'Relatório de Pedidos {{orders.id}} ../x?' })] })
    await fire(s)
    expect(s.delivered[0].fileName).toBe('Relatorio_de_Pedidos_9_.._x_.xlsx')
    expect(s.delivered[0].fileName).not.toMatch(/[\\/ ?]/)
    const dots = setup({ nodes: [trigger, query(), download({ downloadFileName: '...segredo' })] })
    await fire(dots)
    expect(dots.delivered[0].fileName).toBe('segredo.xlsx')
  })

  it('só entrega a quem tem id UUID; os outros são pulados com aviso (sem derrubar o fluxo)', async () => {
    const s = setup({ ids: [U1, '42', 'ana@x.com', U1] })
    await fire(s)
    expect(s.delivered[0].recipientIds).toEqual([U1])
    expect(s.warns.some(w => /sem id UUID/.test(w))).toBe(true)
    expect(s.runs[0].status).toBe('success')
  })

  it('sem nenhum destinatário válido, nada é entregue e a execução é marcada com erro', async () => {
    const s = setup({ ids: ['42'] })
    await fire(s)
    expect(s.delivered).toHaveLength(0)
    expect(s.runs[0].status).toBe('error')
    expect(s.runs[0].error_message).toMatch(/nenhum destinatário válido/)
    const none = setup({ ids: [] })
    await fire(none)
    expect(none.delivered).toHaveLength(0)
    expect(none.runs[0].status).toBe('error')
  })

  it('resultado inexistente (a consulta não vem antes) vira erro anotado, sem entrega', async () => {
    const s = setup({ nodes: [trigger, download({ downloadDataset: 'outra' })] })
    s.core.setWorkflows([{ id: 'f1', name: 'x', flow_data: { nodes: [trigger, download({ downloadDataset: 'outra' })], edges: [{ source: 't', target: 'd' }] } } as any])
    await fire(s)
    expect(s.delivered).toHaveLength(0)
    expect(s.runs[0].status).toBe('error')
    expect(s.runs[0].error_message).toMatch(/não encontrado/)
  })

  it('falha do servidor ao entregar vira erro na execução', async () => {
    const s = setup({ deliverFails: true })
    await fire(s)
    expect(s.runs[0].status).toBe('error')
    expect(s.runs[0].error_message).toMatch(/502/)
  })

  it('erro ao achar os destinatários: nenhuma entrega e erro anotado', async () => {
    const s = setup({ ids: new Error('banco fora') })
    await fire(s)
    expect(s.delivered).toHaveLength(0)
    expect(s.runs[0].status).toBe('error')
  })

  it('aviso por e-mail só quando marcado', async () => {
    const s = setup({ nodes: [trigger, query(), download({ downloadNotify: true, downloadFileName: 'Vendas' })] })
    await fire(s)
    expect(s.mails).toHaveLength(1)
    expect(s.mails[0].to).toBe('g@x.com')
    expect(s.mails[0].subject).toBe('Arquivo disponível: Vendas.xlsx')
    expect(s.mails[0].body).toContain('Central de Downloads')
  })

  it('onde não há a porta de downloads (app exportado), a ação para com aviso e nada quebra', async () => {
    const s = setup({ withDownloads: false })
    await fire(s)
    expect(s.delivered).toHaveLength(0)
    expect(s.runs[0].status).toBe('error')
    expect(s.runs[0].error_message).toMatch(/não é suportado/)
  })

  it('sem a porta que acha os ids dos destinatários, também para com erro anotado', async () => {
    const s = setup({ withIds: false })
    await fire(s)
    expect(s.delivered).toHaveLength(0)
    expect(s.runs[0].status).toBe('error')
  })

  it('limite de destinatários por entrega', async () => {
    const many = Array.from({ length: 250 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
    const s = setup({ ids: many })
    await fire(s)
    expect(s.delivered[0].recipientIds).toHaveLength(200)
  })
})
