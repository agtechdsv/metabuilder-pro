import { describe, it, expect } from 'vitest'
import { composeBiQuery, drillAllowed, parseBiRequest, viewerFromSession, dialectOf, type BiQueryRequest, type BiServerContext } from '../serverQuery'
import type { BiAnalyticsConfig, BiWidget } from '../widget'

// Modelo parecido com o Vendas: pedidos → funcionarios (vendedor); pedidos → clientes
let n = 0
const f = (model: string, name: string, type: string, extra: any = {}) => ({ id: `${model}.${name}`, db_column_name: name, data_type: type, order_index: n++, ...extra })
const models = [
  { id: 'm_ped', db_table_name: 'pedidos', db_schema_name: 'crm', fields: [f('ped', 'id', 'uuid', { is_primary_key: true }), f('ped', 'cliente_id', 'uuid'), f('ped', 'funcionario_id', 'uuid'), f('ped', 'data_pedido', 'timestamp with time zone'), f('ped', 'status', 'text')] },
  { id: 'm_cli', db_table_name: 'clientes', db_schema_name: 'crm', fields: [f('cli', 'id', 'uuid', { is_primary_key: true }), f('cli', 'nome_empresa', 'text')] },
  { id: 'm_fun', db_table_name: 'funcionarios', db_schema_name: 'crm', fields: [f('fun', 'id', 'uuid', { is_primary_key: true }), f('fun', 'nome', 'text'), f('fun', 'email', 'text')] },
]
const rel = (id: string, fm: string, ff: string, tm: string, tf: string) => ({ id, from_model_id: fm, from_field_id: `${fm.replace('m_', '')}.${ff}`, to_model_id: tm, to_field_id: `${tm.replace('m_', '')}.${tf}` })
const relations = [rel('r4', 'm_ped', 'cliente_id', 'm_cli', 'id'), rel('r5', 'm_ped', 'funcionario_id', 'm_fun', 'id')]
const ctx: BiServerContext = { models, relations, joins: [], dialect: 'postgres', projectSlug: 'x' }

const kpi: BiWidget = { id: 'w1', type: 'kpi', model_id: 'm_ped', calc: 'COUNT', field: '', width: 'third' } as any
const bar: BiWidget = { id: 'w2', type: 'bar', model_id: 'm_ped', calc: 'COUNT', field: '', width: 'half', group_by: 'pedidos.status', cross_target: true, drill_detail: true, drill_by: 'clientes.nome_empresa', drill_records: true } as any
const rlsPorEmail = { id: 'r1', field: 'funcionarios.email', op: 'eq', source: 'user.email', bypass: { source: 'user.attr', attr: 'perfil', values: ['gerente'] } }
const config: BiAnalyticsConfig = { widgets: [kpi, bar], rls: [rlsPorEmail as any] }

const req = (over: Partial<BiQueryRequest> = {}): BiQueryRequest => ({
  projectId: 'p1', viewId: 'v1', widgetId: 'w1', part: 'main', drill: [], cross: [], filters: {}, period: null, legacy: false, draft: false, ...over,
})
const maria = { email: 'maria@x.com', name: 'Maria', attrs: { perfil: 'vendedor' } }
const gerente = { email: 'joao@x.com', name: 'João', attrs: { perfil: 'gerente' } }

describe('composeBiQuery — usuário final', () => {
  it('soma a regra de acesso com o e-mail da SESSÃO e junta a tabela da regra', () => {
    const r = composeBiQuery({ req: req(), config, actor: 'end_user', viewer: maria, ctx })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.sql).toContain('"funcionarios"')
    expect(r.sql).toContain('maria@x.com')
    expect(r.schemaName).toBe('crm')
    expect(r.tableName).toBe('pedidos')
  })

  it('quem está na lista de exceção não sofre o filtro (o gerente vê todos)', () => {
    const r = composeBiQuery({ req: req(), config, actor: 'end_user', viewer: gerente, ctx })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.sql).not.toContain('joao@x.com')
    expect(r.sql).not.toContain('"funcionarios"')
  })

  it('sem usuário, a regra nega (falha fechada) e o motivo vai junto', () => {
    const r = composeBiQuery({ req: req(), config, actor: 'end_user', viewer: null, ctx })
    expect(r).toMatchObject({ ok: false, status: 403, code: 'denied', denied: { code: 'no_viewer' } })
  })

  it('sem o dado que a regra pede (e-mail vazio), nega', () => {
    const r = composeBiQuery({ req: req(), config, actor: 'end_user', viewer: { email: '', attrs: {} }, ctx })
    expect(r).toMatchObject({ ok: false, status: 403, denied: { code: 'missing_value' } })
  })

  it('o indicador enviado pelo navegador é IGNORADO: vale o salvo (não dá para trocar a consulta nem tirar a regra)', () => {
    const forged = { ...kpi, model_id: 'm_cli', conditions: [] } as BiWidget
    const r = composeBiQuery({ req: req({ widget: forged }), config, actor: 'end_user', viewer: maria, ctx })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.tableName).toBe('pedidos')
    expect(r.sql).toContain('maria@x.com')
  })

  it('indicador que não existe no painel salvo: 404', () => {
    expect(composeBiQuery({ req: req({ widgetId: 'nao_existe' }), config, actor: 'end_user', viewer: maria, ctx })).toMatchObject({ ok: false, status: 404 })
  })

  it('sem regras cadastradas, todos veem tudo, também o visitante sem sessão', () => {
    const open: BiAnalyticsConfig = { widgets: [kpi] }
    const r = composeBiQuery({ req: req(), config: open, actor: 'end_user', viewer: null, ctx })
    expect(r.ok).toBe(true)
  })

  it('drill: só o que o indicador permite; outro campo é recusado', () => {
    const level = { group_by: 'clientes.nome_empresa', conds: [{ field: 'pedidos.status', op: 'eq', value: 'Aprovado' }], label: 'Aprovado' }
    expect(composeBiQuery({ req: req({ widgetId: 'w2', drill: [level] }), config, actor: 'end_user', viewer: maria, ctx }).ok).toBe(true)
    const bad = { ...level, group_by: 'funcionarios.email' }
    expect(composeBiQuery({ req: req({ widgetId: 'w2', drill: [bad] }), config, actor: 'end_user', viewer: maria, ctx })).toMatchObject({ ok: false, status: 400, code: 'drill_not_allowed' })
    // indicador sem drill_detail não aceita drill
    expect(composeBiQuery({ req: req({ drill: [level] }), config, actor: 'end_user', viewer: maria, ctx })).toMatchObject({ ok: false, code: 'drill_not_allowed' })
  })

  it('filtro cruzado vira condição só nos indicadores que respondem a ele', () => {
    const cross = [{ sourceId: 'outro', sourceTitle: 'x', name: 'Aprovado', conds: [{ field: 'pedidos.status', op: 'eq', value: 'Aprovado' }] }]
    const r = composeBiQuery({ req: req({ widgetId: 'w2', cross }), config, actor: 'end_user', viewer: maria, ctx })
    expect(r.ok && r.sql).toContain('Aprovado')
    const semResposta = composeBiQuery({ req: req({ widgetId: 'w1', cross }), config, actor: 'end_user', viewer: maria, ctx })
    expect(semResposta.ok && semResposta.sql).not.toContain('Aprovado')
  })

  it('ver registros: o grupo clicado vira filtro e a regra continua valendo', () => {
    const r = composeBiQuery({ req: req({ widgetId: 'w2', part: 'records', bucket: 'Aprovado' }), config, actor: 'end_user', viewer: maria, ctx })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.kind).toBe('records')
    expect(r.sql).toContain('Aprovado')
    expect(r.sql).toContain('maria@x.com')
  })

  it('comparação com o período anterior só existe se o indicador a pede', () => {
    expect(composeBiQuery({ req: req({ part: 'prev' }), config, actor: 'end_user', viewer: maria, ctx })).toMatchObject({ ok: false, status: 404, code: 'no_previous' })
    const cmp: BiAnalyticsConfig = { widgets: [{ ...kpi, compare_previous: true, period_field: 'pedidos.data_pedido' } as any], rls: config.rls }
    const r = composeBiQuery({ req: req({ part: 'prev', period: { from: '2026-01-01', to: '2026-01-31' } }), config: cmp, actor: 'end_user', viewer: maria, ctx })
    expect(r.ok && r.kind).toBe('prev')
  })
})

describe('composeBiQuery — membro do projeto', () => {
  it('usa o indicador enviado (teste de uma edição ainda não salva)', () => {
    const edited = { ...kpi, model_id: 'm_cli' } as BiWidget
    const r = composeBiQuery({ req: req({ widget: edited }), config, actor: 'member', viewer: null, ctx })
    expect(r.ok && r.tableName).toBe('clientes')
  })

  it('sem sessão de usuário final não sofre a regra; testando como um usuário, sofre', () => {
    const livre = composeBiQuery({ req: req(), config, actor: 'member', viewer: null, ctx })
    expect(livre.ok && livre.sql).not.toContain('maria@x.com')
    const comoMaria = composeBiQuery({ req: req(), config, actor: 'member', viewer: maria, ctx })
    expect(comoMaria.ok && comoMaria.sql).toContain('maria@x.com')
  })
})

describe('parseBiRequest', () => {
  const ok = { projectId: 'p', viewId: 'v', widgetId: 'w', part: 'main' }

  it('pedido mínimo é aceito, com valores padrão', () => {
    const r = parseBiRequest(ok)
    expect(r.ok && r.req).toMatchObject({ part: 'main', drill: [], cross: [], filters: {}, period: null, legacy: false, draft: false })
  })

  it('recusa pedido incompleto, parte inválida e indicador diferente do pedido', () => {
    expect(parseBiRequest(null).ok).toBe(false)
    expect(parseBiRequest({ projectId: 'p' }).ok).toBe(false)
    expect(parseBiRequest({ ...ok, part: 'sql' }).ok).toBe(false)
    expect(parseBiRequest({ ...ok, widget: { id: 'outro' } }).ok).toBe(false)
  })

  it('limpa o que vem do navegador: período inválido some, textos são cortados, listas têm teto', () => {
    const r = parseBiRequest({
      ...ok,
      period: { from: '01/02/2026', to: '2026-02-10' },
      filters: { a: 'x'.repeat(500), b: '' },
      cross: Array.from({ length: 50 }, (_, i) => ({ sourceId: `s${i}`, conds: [{ field: 'a.b', op: 'eq', value: 1 }, { field: '', op: 'eq' }] })),
      drill: [{ group_by: 'a.b', date_granularity: 'month', conds: [], label: 'x' }, { group_by: '' }],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.req.period).toBeNull()
    expect(r.req.filters).toEqual({ a: 'x'.repeat(200) })
    expect(r.req.cross).toHaveLength(20)
    expect(r.req.cross[0].conds).toEqual([{ field: 'a.b', op: 'eq', value: '1' }])
    expect(r.req.drill).toHaveLength(1)
  })
})

describe('auxiliares', () => {
  it('viewerFromSession: sessão assinada vira usuário; visitante anônimo e sem sessão não', () => {
    expect(viewerFromSession(null)).toBeNull()
    expect(viewerFromSession({ sub: 'anon:1.2.3.4' })).toBeNull()
    expect(viewerFromSession({ sub: '7', email: 'a@x.com', name: 'A', row: { perfil: 'admin' }, attrs: { depto: '3' } }))
      .toEqual({ email: 'a@x.com', name: 'A', attrs: { depto: '3', perfil: 'admin' } })
  })

  it('dialectOf', () => {
    expect(dialectOf(undefined)).toBe('postgres')
    expect(dialectOf('Oracle')).toBe('oracle')
    expect(dialectOf('mysql')).toBeNull()
  })

  it('drillAllowed', () => {
    expect(drillAllowed(kpi, [])).toBe(true)
    expect(drillAllowed(bar, [{ group_by: 'pedidos.status', date_granularity: 'semana', conds: [], label: '' }])).toBe(false)
  })
})
