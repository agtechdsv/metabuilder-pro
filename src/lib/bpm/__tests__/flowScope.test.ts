import { describe, it, expect } from 'vitest'
import { automationsHref, filterFlowsByScope, flowInScope, isGeneralFlow, parseScopeParams, primaryScopeOf, scopeCounts, triggerModelIds } from '../flowScope'
import { AUTOMATIONS_MENU_LABELS, withAutomationsMenu } from '../../automationsMenu'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const trig = (modelId?: string, types: string[] = ['insert']) => ({ id: 't' + (modelId || 'x'), type: 'trigger', data: { triggerType: types, ...(modelId ? { triggerModelId: modelId } : {}) } })
const flow = (nodes: any[], draft?: any[]) => ({ flow_data: { nodes }, ...(draft ? { draft_flow_data: { nodes: draft } } : {}) })

describe('escopo dos fluxos (tabela ou Geral)', () => {
  it('o fluxo é da tabela do gatilho; sem tabela em nenhum gatilho, é Geral', () => {
    const f1 = flow([trig(A)])
    const f2 = flow([trig(undefined, ['scheduled'])])
    expect(triggerModelIds(f1)).toEqual([A])
    expect(flowInScope(f1, { kind: 'table', modelId: A })).toBe(true)
    expect(flowInScope(f1, { kind: 'table', modelId: B })).toBe(false)
    expect(flowInScope(f1, { kind: 'general' })).toBe(false)
    expect(isGeneralFlow(f2)).toBe(true)
    expect(flowInScope(f2, { kind: 'general' })).toBe(true)
  })

  it('fluxo vazio, só com rascunho ou sem desenho conta como Geral até escolher a tabela', () => {
    expect(isGeneralFlow({})).toBe(true)
    expect(isGeneralFlow({ flow_data: null, draft_flow_data: { nodes: [] } })).toBe(true)
    expect(isGeneralFlow({ draft_flow_data: { nodes: [trig(A)] } })).toBe(false)
  })

  it('tabela do rascunho e do publicado valem as duas; fluxo com duas tabelas aparece nas duas listas', () => {
    const moved = flow([trig(A)], [trig(B)])
    expect(triggerModelIds(moved).sort()).toEqual([A, B].sort())
    const both = flow([trig(A), trig(B)])
    const flows = [moved, both, flow([trig(A)]), flow([trig(undefined, ['webhook'])])]
    expect(filterFlowsByScope(flows, { kind: 'table', modelId: A })).toHaveLength(3)
    expect(filterFlowsByScope(flows, { kind: 'table', modelId: B })).toHaveLength(2)
    expect(filterFlowsByScope(flows, { kind: 'general' })).toHaveLength(1)
    expect(scopeCounts(flows)).toEqual({ general: 1, byModel: { [A]: 3, [B]: 2 } })
  })

  it('ignora nós que não são gatilho e valores que não são texto', () => {
    const f = flow([{ type: 'action', data: { triggerModelId: A } }, { type: 'trigger', data: { triggerModelId: 5 } }, { type: 'trigger', data: { triggerModelId: '' } }])
    expect(triggerModelIds(f)).toEqual([])
  })

  it('o escopo de abertura é a primeira tabela, ou Geral', () => {
    expect(primaryScopeOf(flow([trig(B), trig(A)]))).toEqual({ kind: 'table', modelId: B })
    expect(primaryScopeOf(flow([trig()]))).toEqual({ kind: 'general' })
  })

  it('lê o escopo da URL e só aceita id de tabela bem formado', () => {
    expect(parseScopeParams({ table: A })).toEqual({ kind: 'table', modelId: A })
    expect(parseScopeParams({ scope: 'general' })).toEqual({ kind: 'general' })
    expect(parseScopeParams({})).toBeNull()
    expect(parseScopeParams(null)).toBeNull()
    expect(parseScopeParams({ table: "x' OR 1=1" })).toBeNull()
    expect(parseScopeParams({ table: ['a'] })).toBeNull()
    expect(parseScopeParams({ scope: 'tudo' })).toBeNull()
  })

  it('monta os endereços do painel e do editor', () => {
    expect(automationsHref('/w/p')).toBe('/w/p/automations')
    expect(automationsHref('/w/p', { kind: 'general' })).toBe('/w/p/automations?scope=general')
    expect(automationsHref('/w/p', { kind: 'table', modelId: A }, 'f1')).toBe(`/w/p/automations?table=${A}&flow=f1`)
    expect(automationsHref('/w/p', null, 'f1')).toBe('/w/p/automations') // fluxo sem escopo não faz sentido
  })
})

describe('item "Automação de processos" do menu', () => {
  const nav = [{ id: 'a', type: 'view', target: 'downloads' }, { id: 'f', type: 'folder', children: [{ id: 'c', type: 'view', target: 'clientes' }] }]

  it('com acesso, entra como PRIMEIRO item, no idioma certo', () => {
    const out = withAutomationsMenu(nav, true, 'en')
    expect(out[0]).toMatchObject({ type: 'view', target: 'automations', label: AUTOMATIONS_MENU_LABELS.en, show_dashboard: true })
    expect(out.slice(1)).toEqual(nav)
    expect(withAutomationsMenu(nav, true, 'xx')[0].label).toBe(AUTOMATIONS_MENU_LABELS.pt)
  })

  it('sem acesso, sai, mesmo que esteja no menu (também dentro de pastas)', () => {
    const manual = [{ id: 'm', type: 'view', target: 'Automations' }, { id: 'f', type: 'folder', children: [{ id: 'x', type: 'view', target: 'automations' }, { id: 'c', type: 'view', target: 'clientes' }] }]
    const out = withAutomationsMenu(manual, false)
    expect(JSON.stringify(out)).not.toMatch(/automations/i)
    expect(out[0].children).toEqual([{ id: 'c', type: 'view', target: 'clientes' }])
  })

  it('nunca duplica o item e não muda o menu original', () => {
    const manual = [{ id: 'm', type: 'view', target: 'automations' }, ...nav]
    const out = withAutomationsMenu(manual, true, 'pt')
    expect(out.filter(i => i.target === 'automations')).toHaveLength(1)
    expect(manual).toHaveLength(3)
    expect(withAutomationsMenu(undefined as any, true)).toHaveLength(1)
  })
})
