import { describe, it, expect } from 'vitest'
import { editedValue, sampleValue } from '../interactiveHelp/sampleValues'
import { buildAutoTour, buildSeed, regenerateTour, selectFillFields, type TourFieldInfo } from '../interactiveHelp/autoTour'
import { hasInteractiveHelp, normalizeInteractiveHelp, SPEED_FACTOR } from '../interactiveHelp/types'

const TODAY = new Date('2026-11-06T12:00:00Z')
const f = (over: Partial<TourFieldInfo> & { id: string; column: string; label: string }): TourFieldInfo => ({ dataType: 'text', component: 'text', ...over })

const nome = f({ id: 'n', column: 'nome_empresa', label: 'Nome Empresa', required: true, help: { pt: 'Nome da empresa cliente.' } })
const cnpj = f({ id: 'c', column: 'cnpj_cpf', label: 'Cnpj Cpf' })
const email = f({ id: 'e', column: 'email_contato', label: 'Email Contato' })
const lat = f({ id: 'la', column: 'latitude', label: 'Latitude', dataType: 'numeric', component: 'number' })
const status = f({ id: 's', column: 'status_lead', label: 'Status Lead', component: 'select' })
const venc = f({ id: 'v', column: 'data_vencimento', label: 'Data Vencimento', dataType: 'date', component: 'date' })
const pk = f({ id: 'pk', column: 'id', label: 'Id', dataType: 'uuid', isPrimaryKey: true })
const total = f({ id: 't', column: 'virt_total', label: 'Total Item', isVirtual: true })

describe('valores de exemplo', () => {
  it('usa o nome da coluna para e-mail, CNPJ, coordenadas e quantidade', () => {
    expect(sampleValue(email, TODAY)).toBe('exemplo@empresa.com.br')
    expect(sampleValue(cnpj, TODAY)).toBe('11.222.333/0001-81')
    expect(sampleValue(lat, TODAY)).toBe('-23.5505')
    expect(sampleValue(f({ id: 'x', column: 'quantidade', label: 'Quantidade', dataType: 'integer', component: 'number' }), TODAY)).toBe('10')
  })

  it('texto livre vira "<Rótulo> 01" e é sempre o mesmo valor', () => {
    expect(sampleValue(nome, TODAY)).toBe('Nome Empresa 01')
    expect(sampleValue(nome, TODAY)).toBe(sampleValue(nome, TODAY))
  })

  it('data vira hoje, ou hoje + 7 dias para prazo; lista não se digita; booleano marca', () => {
    expect(sampleValue(f({ id: 'd', column: 'data_pedido', label: 'Data Pedido', dataType: 'timestamp with time zone', component: 'date' }), TODAY)).toBe('2026-11-06')
    expect(sampleValue(venc, TODAY)).toBe('2026-11-13')
    expect(sampleValue(status, TODAY)).toBeNull()
    expect(sampleValue(f({ id: 'b', column: 'ativo', label: 'Ativo', dataType: 'boolean', component: 'checkbox' }), TODAY)).toBe('true')
  })

  it('o valor editado muda de forma visível mas mantém o formato válido', () => {
    expect(editedValue(nome, TODAY)).toBe('Nome Empresa 01 (editado)')
    expect(editedValue(lat, TODAY)).toBe('-22.5505')
    expect(editedValue(cnpj, TODAY)).toBe('11.222.333/0001-81')
    expect(editedValue(email, TODAY)).toBe('exemplo@empresa.com.br'.replace('@', '.novo@'))
    expect(editedValue(venc, TODAY)).toBe('2026-11-14')
  })
})

describe('gerador automático', () => {
  const input = { formFields: [pk, nome, cnpj, email, lat, status, total], filterFields: [nome, status], gridFields: [nome, cnpj] }

  it('cadastrar com "só obrigatórios": novo → campo obrigatório → calculado → salvar → voltar → resultado', () => {
    const tour = buildAutoTour(input, { action: 'create', fill: 'required', today: TODAY, screenName: 'Clientes' })
    expect(tour.steps.map(s => [s.kind, (s.target as any)?.type, (s.target as any)?.ref])).toEqual([
      ['click', 'button', 'new'],
      ['type', 'field', 'n'],
      ['note', 'field', 't'],
      ['click', 'button', 'save'],
      ['click', 'button', 'back'],
      ['note', 'row', 'first'],
    ])
    expect(tour.steps[1].value).toBe('Nome Empresa 01')
    expect(tour.title.pt).toBe('Como cadastrar: Clientes')
    expect(tour.steps.every(s => s.auto)).toBe(true)
  })

  it('a legenda do passo é a ajuda do campo; sem ajuda, uma frase pelo rótulo nos três idiomas', () => {
    const tour = buildAutoTour(input, { action: 'create', fill: 'all', today: TODAY })
    expect(tour.steps[1].caption).toEqual({ pt: 'Nome da empresa cliente.' })
    const semAjuda = tour.steps.find(s => (s.target as any)?.ref === 'c')!
    expect(semAjuda.caption).toEqual({ pt: 'Preencha "Cnpj Cpf".', en: 'Fill in "Cnpj Cpf".', es: 'Complete "Cnpj Cpf".' })
  })

  it('"todos" pula chave primária e calculado; lista vira "escolher a primeira opção"', () => {
    const tour = buildAutoTour(input, { action: 'create', fill: 'all', today: TODAY })
    const refs = tour.steps.map(s => (s.target as any)?.ref)
    expect(refs).not.toContain('pk')
    const pick = tour.steps.find(s => (s.target as any)?.ref === 's')!
    expect(pick.kind).toBe('select')
    expect(pick.value).toEqual({ pick: 'first' })
  })

  it('sem nenhum campo obrigatório marcado, "só obrigatórios" cai nos 3 primeiros em vez de um roteiro vazio', () => {
    const none = [cnpj, email, lat, status].map(x => ({ ...x, required: false }))
    expect(selectFillFields(none, 'required').map(x => x.id)).toEqual(['c', 'e', 'la'])
  })

  it('"escolher" usa os campos marcados e traz o pai da lista em cascata, antes do filho', () => {
    const pai = f({ id: 'uf', column: 'uf', label: 'UF', component: 'select' })
    const filho = f({ id: 'cid', column: 'cidade_id', label: 'Cidade', component: 'select', dependsOn: 'uf' })
    const chosen = selectFillFields([filho, nome, pai], 'custom', ['cid', 'n'])
    expect(chosen.map(x => x.id)).toEqual(['uf', 'cid', 'n'])
  })

  it('editar altera só os 2 primeiros campos digitáveis (ajustável) e usa linha sintética', () => {
    const tour = buildAutoTour(input, { action: 'edit', today: TODAY })
    const typed = tour.steps.filter(s => s.kind === 'type')
    expect(typed.map(s => (s.target as any).ref)).toEqual(['n', 'c'])
    expect(buildAutoTour(input, { action: 'edit', editFieldCount: 1, today: TODAY }).steps.filter(s => s.kind === 'type')).toHaveLength(1)
    expect(tour.seed).toMatchObject({ nome_empresa: 'Nome Empresa 01', cnpj_cpf: '11.222.333/0001-81' })
    expect(tour.seed).not.toHaveProperty('status_lead')
  })

  it('excluir, ver e pesquisar montam o roteiro da ação', () => {
    const del = buildAutoTour(input, { action: 'delete', today: TODAY })
    expect(del.steps.map(s => `${(s.target as any)?.type}:${(s.target as any)?.action ?? (s.target as any)?.ref}`)).toEqual(['row:delete', 'button:confirm', 'row:first'])
    const view = buildAutoTour(input, { action: 'view', today: TODAY })
    expect(view.steps.map(s => s.kind)).toEqual(['click', 'note', 'click'])
    const search = buildAutoTour(input, { action: 'search', today: TODAY })
    expect(search.steps.map(s => [s.kind, (s.target as any)?.type])).toEqual([['type', 'filter'], ['click', 'button'], ['note', 'row'], ['click', 'button']])
    expect(search.seed?.nome_empresa).toBe('Nome Empresa 01') // a pesquisa acha a linha sintética
  })

  it('regenerar refaz só os passos automáticos e preserva os manuais', () => {
    const tour = buildAutoTour(input, { action: 'create', today: TODAY })
    const manual = { id: 'm1', kind: 'note' as const, caption: { pt: 'Dica minha' } }
    const edited = { ...tour, title: { pt: 'Meu título' }, steps: [...tour.steps, manual] }
    const again = regenerateTour(edited, { ...input, formFields: [pk, nome, email] }, { action: 'create', today: TODAY })
    expect(again.title.pt).toBe('Meu título')
    expect(again.steps[again.steps.length - 1]).toEqual(manual)
    expect(again.steps.filter(s => s.auto)).toHaveLength(tour.steps.length - 1) // some o passo do campo calculado, que não existe mais
  })

  it('linha sintética ignora chave, calculado, lista e booleano', () => {
    const seed = buildSeed([pk, nome, status, total, f({ id: 'b', column: 'ativo', label: 'Ativo', component: 'checkbox' })], TODAY)
    expect(seed).toEqual({ nome_empresa: 'Nome Empresa 01' })
  })
})

describe('formato do roteiro', () => {
  it('normaliza dado estranho sem lançar e só mostra o ícone com roteiro válido', () => {
    expect(normalizeInteractiveHelp(null)).toEqual({ tours: [] })
    expect(normalizeInteractiveHelp({ tours: [{ id: 'x', action: 'hack', steps: [] }, 7, { id: 'ok', action: 'create', steps: [{ id: 's', kind: 'click' }, { id: 't', kind: 'explode' }] }] }).tours)
      .toHaveLength(1)
    expect(hasInteractiveHelp({ tours: [{ id: 'ok', action: 'create', steps: [{ id: 's', kind: 'click' }] }] })).toBe(true)
    expect(hasInteractiveHelp({ hidden: true, tours: [{ id: 'ok', action: 'create', steps: [{ id: 's', kind: 'click' }] }] })).toBe(false)
    expect(hasInteractiveHelp({ tours: [{ id: 'ok', action: 'create', steps: [] }] })).toBe(false)
  })

  it('velocidades: Lento 2×, Normal 1×, Rápido 0,4×', () => {
    expect(SPEED_FACTOR).toEqual({ slow: 2, normal: 1, fast: 0.4 })
  })
})

describe('campos a partir da configuração do caso de uso', () => {
  const models = [{ fields: [
    { id: 'n', db_column_name: 'nome_empresa', display_name: 'Nome Empresa', data_type: 'text' },
    { id: 'u', db_column_name: 'uf', display_name: 'UF', data_type: 'text' },
    { id: 'c', db_column_name: 'cidade_id', display_name: 'Cidade', data_type: 'uuid' },
    { id: 'pk', db_column_name: 'id', display_name: 'id', data_type: 'uuid', is_primary_key: true },
  ] }]
  const lc = {
    form_fields: ['pk', 'n', { id: 'c' }, 'u', 'virt_x', 'byoc_y'],
    filter_fields: ['n'],
    fields_metadata: {
      n: { label: { text: 'Razão Social', help: { pt: 'Nome da empresa.' } }, content: { required: true }, component: { type: 'text' } },
      u: { component: { type: 'select' } },
      c: { component: { type: 'select', depends_on: 'uf' } },
      virt_x: { label: { text: 'Total' } },
      'filter-n': { label: { text: 'Buscar empresa', help: { pt: 'x', en: 'x' }, help_hidden: true }, component: { type: 'text' } },
    },
  }

  it('lê rótulo, tipo, obrigatório, chave, calculado e componente especial', async () => {
    const { buildFieldInfos } = await import('../interactiveHelp/fieldInfo')
    const form = buildFieldInfos(lc, models, 'form')
    expect(form.map(f => f.id)).toEqual(['pk', 'n', 'c', 'u', 'virt_x', 'byoc_y'])
    const nome = form.find(f => f.id === 'n')!
    expect(nome).toMatchObject({ label: 'Razão Social', column: 'nome_empresa', required: true, component: 'text', help: { pt: 'Nome da empresa.' } })
    expect(form.find(f => f.id === 'pk')!.isPrimaryKey).toBe(true)
    expect(form.find(f => f.id === 'virt_x')!.isVirtual).toBe(true)
    expect(form.find(f => f.id === 'byoc_y')!.hidden).toBe(true)
  })

  it('"depends_on" (nome da coluna do pai) vira o id do pai; a zona usa a chave própria e respeita ajuda oculta', async () => {
    const { buildFieldInfos } = await import('../interactiveHelp/fieldInfo')
    expect(buildFieldInfos(lc, models, 'form').find(f => f.id === 'c')!.dependsOn).toBe('u')
    const filtro = buildFieldInfos(lc, models, 'filter')[0]
    expect(filtro.label).toBe('Buscar empresa')
    expect(filtro.help).toBeUndefined() // ajuda oculta não vira legenda
  })

  it('o roteiro gerado a partir da configuração real: obrigatório preenchido, cascata em ordem', async () => {
    const { buildFieldInfos } = await import('../interactiveHelp/fieldInfo')
    const input = { formFields: buildFieldInfos(lc, models, 'form'), filterFields: buildFieldInfos(lc, models, 'filter') }
    const all = buildAutoTour(input, { action: 'create', fill: 'all', today: TODAY })
    const refs = all.steps.filter(s => s.target?.type === 'field' && s.kind !== 'note').map(s => (s.target as any).ref)
    expect(refs).toEqual(['n', 'u', 'c']) // pk, calculado e BYOC ficam de fora; UF (pai) antes de Cidade (filho)
  })
})

describe('regenerar preserva valores ajustados', () => {
  it('o valor que o dev mudou num passo automático continua após regenerar', () => {
    const input = { formFields: [nome, email] }
    const tour = buildAutoTour(input, { action: 'create', fill: 'all', today: TODAY })
    const edited = { ...tour, steps: tour.steps.map(s => ((s.target as any)?.ref === 'n' ? { ...s, value: 'Minha Empresa', edited: true } : s)) }
    const again = regenerateTour(edited, input, { action: 'create', today: TODAY })
    expect(again.steps.find(s => (s.target as any)?.ref === 'n')).toMatchObject({ value: 'Minha Empresa', edited: true })
    expect(again.steps.find(s => (s.target as any)?.ref === 'e')!.value).toBe('exemplo@empresa.com.br')
  })

  it('a quantidade de campos de "editar" vai no roteiro e sobrevive à regeneração', () => {
    const input = { formFields: [nome, cnpj, email] }
    const tour = buildAutoTour(input, { action: 'edit', editFieldCount: 3, today: TODAY })
    expect(tour.editFieldCount).toBe(3)
    expect(tour.steps.filter(s => s.kind === 'type')).toHaveLength(3)
    expect(regenerateTour(tour, input, { action: 'edit', today: TODAY }).steps.filter(s => s.kind === 'type')).toHaveLength(3)
  })
})

describe('ordem, ocultar por roteiro e fila de reprodução', () => {
  const t = (id: string, over: any = {}) => ({ id, action: 'create', title: { pt: id }, fill: 'required', steps: [{ id: 's', kind: 'click' }], ...over })

  it('a ordem do dev é a da lista; roteiro oculto ou sem passos não aparece', async () => {
    const { visibleTours } = await import('../interactiveHelp/types')
    const cfg = { tours: [t('b', { action: 'edit' }), t('a'), t('c', { action: 'delete', hidden: true }), t('d', { action: 'view', steps: [] })] }
    expect(visibleTours(cfg).map(x => x.id)).toEqual(['b', 'a'])
    expect(visibleTours({ ...cfg, hidden: true })).toEqual([])
    expect(hasInteractiveHelp({ tours: [t('c', { hidden: true })] })).toBe(false)
  })

  it('moveItem sobe e desce sem sair dos limites nem alterar a original', async () => {
    const { moveItem } = await import('../interactiveHelp/order')
    const list = ['a', 'b', 'c']
    expect(moveItem(list, 1, -1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(list, 1, 1)).toEqual(['a', 'c', 'b'])
    expect(moveItem(list, 0, -1)).toEqual(['a', 'b', 'c'])
    expect(moveItem(list, 2, 1)).toEqual(['a', 'b', 'c'])
    expect(list).toEqual(['a', 'b', 'c'])
  })

  it('clicar marca e clicar de novo desmarca', async () => {
    const { toggleId } = await import('../interactiveHelp/order')
    expect(toggleId([], 'a')).toEqual(['a'])
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('a fila segue a ordem do dev, não a ordem dos cliques; sem seleção é "todos"', async () => {
    const { buildQueue } = await import('../interactiveHelp/order')
    const tours = [t('cadastrar'), t('pesquisar'), t('editar'), t('excluir')] as any[]
    expect(buildQueue(tours, ['excluir', 'cadastrar']).map(x => x.id)).toEqual(['cadastrar', 'excluir'])
    expect(buildQueue(tours).map(x => x.id)).toEqual(['cadastrar', 'pesquisar', 'editar', 'excluir'])
    expect(buildQueue(tours, [])).toEqual([])
  })

  it('o "oculto" do roteiro sobrevive à leitura do banco', () => {
    const cfg = normalizeInteractiveHelp({ tours: [{ id: 'x', action: 'create', hidden: true, steps: [{ id: 's', kind: 'click' }] }] })
    expect(cfg.tours[0].hidden).toBe(true)
  })
})

describe('trocar preenchimento e quantidade (o que o editor faz agora ao mudar a caixa)', () => {
  const campos = [pk, nome, cnpj, email, lat].map(c => ({ ...c, required: c.id === 'n' }))
  const input = { formFields: campos }

  it('de "só obrigatórios" para "todos os campos" o roteiro ganha os outros campos', () => {
    const so = buildAutoTour(input, { action: 'create', fill: 'required', today: TODAY })
    const todos = regenerateTour({ ...so, fill: 'all' }, input, { action: 'create', today: TODAY })
    const digitados = (t: typeof so) => t.steps.filter(s => s.kind === 'type').map(s => (s.target as any).ref)
    expect(digitados(so)).toEqual(['n'])
    expect(digitados(todos)).toEqual(['n', 'c', 'e', 'la'])
    expect(todos.fill).toBe('all')
  })

  it('de 2 para 5 campos a alterar, "editar" muda 5 campos (limitado ao que existe)', () => {
    const mais = [...campos, f({ id: 'x1', column: 'a1', label: 'A1' }), f({ id: 'x2', column: 'a2', label: 'A2' }), f({ id: 'x3', column: 'a3', label: 'A3' })]
    const dois = buildAutoTour({ formFields: mais }, { action: 'edit', today: TODAY })
    const cinco = regenerateTour({ ...dois, editFieldCount: 5 }, { formFields: mais }, { action: 'edit', today: TODAY })
    expect(dois.steps.filter(s => s.kind === 'type')).toHaveLength(2)
    expect(cinco.steps.filter(s => s.kind === 'type')).toHaveLength(5)
  })
})

describe('campos da aba de detalhe ficam fora do roteiro (v1)', () => {
  it('campo de outro modelo e a observação de calculado dele não entram; o campo do modelo principal entra', async () => {
    const { buildFieldInfos } = await import('../interactiveHelp/fieldInfo')
    const models = [{ fields: [
      { id: 'n', model_id: 'M', db_column_name: 'nome_empresa', display_name: 'Nome Empresa', data_type: 'text' },
      { id: 'dp', model_id: 'D', db_column_name: 'data_pedido', display_name: 'Data Pedido', data_type: 'timestamp with time zone' },
    ] }]
    const lc = { form_fields: ['n', 'dp'], fields_metadata: { n: { content: { required: true } }, dp: { content: { required: true } } } }
    const infos = buildFieldInfos(lc, models, 'form', 'M')
    expect(infos.map(i => [i.id, i.isDetail])).toEqual([['n', false], ['dp', true]])
    const tour = buildAutoTour({ formFields: infos }, { action: 'create', fill: 'all', today: TODAY })
    expect(tour.steps.filter(s => s.kind === 'type').map(s => (s.target as any).ref)).toEqual(['n'])
    // sem o modelo principal informado nada é tratado como detalhe (comportamento anterior)
    expect(buildFieldInfos(lc, models, 'form').every(i => !i.isDetail)).toBe(true)
  })
})

describe('ordem sugerida dos roteiros', () => {
  it('pesquisar, ver detalhes, cadastrar, editar, excluir', async () => {
    const { TOUR_ACTIONS } = await import('../interactiveHelp/types')
    expect([...TOUR_ACTIONS]).toEqual(['search', 'view', 'create', 'edit', 'delete'])
  })

  it('"usar a ordem sugerida" reordena roteiros já criados sem alterar a lista original', async () => {
    const { sortBySuggestedOrder } = await import('../interactiveHelp/order')
    const antiga = [{ id: 'c', action: 'create' }, { id: 'e', action: 'edit' }, { id: 'x', action: 'delete' }, { id: 's', action: 'search' }, { id: 'v', action: 'view' }] as const
    expect(sortBySuggestedOrder(antiga).map(t => t.id)).toEqual(['s', 'v', 'c', 'e', 'x'])
    expect(antiga.map(t => t.id)).toEqual(['c', 'e', 'x', 's', 'v'])
  })
})

describe('cartão do tutorial: resumo, duração e título curto', () => {
  const input = { formFields: [pk, nome, cnpj, email], filterFields: [nome, status], gridFields: [nome] }

  it('o resumo diz o que o roteiro faz, nos três idiomas, com o rótulo e a contagem reais', () => {
    const search = buildAutoTour(input, { action: 'search', today: TODAY })
    expect(search.summary).toEqual({ pt: 'Filtra a lista por "Nome Empresa".', en: 'Filters the list by "Nome Empresa".', es: 'Filtra la lista por "Nome Empresa".' })
    const create = buildAutoTour(input, { action: 'create', fill: 'all', today: TODAY })
    expect(create.summary?.pt).toBe('Preenche 3 campos e salva um novo registro.')
    const um = buildAutoTour({ formFields: [pk, nome] }, { action: 'create', fill: 'all', today: TODAY })
    expect(um.summary?.pt).toBe('Preenche 1 campo e salva um novo registro.')
    expect(buildAutoTour(input, { action: 'edit', editFieldCount: 2, today: TODAY }).summary?.en).toBe('Changes 2 fields of a record and saves.')
    expect(buildAutoTour(input, { action: 'delete', today: TODAY }).summary?.pt).toBe('Remove um registro, com confirmação.')
    expect(buildAutoTour(input, { action: 'view', today: TODAY }).summary?.es).toBe('Abre un registro solo de lectura.')
  })

  it('o resumo vai para o banco, volta na leitura e sobrevive a regenerar', () => {
    const tour = buildAutoTour(input, { action: 'create', today: TODAY })
    expect(normalizeInteractiveHelp({ tours: [tour] }).tours[0].summary).toEqual(tour.summary)
    const again = regenerateTour({ ...tour, hidden: true }, input, { action: 'create', today: TODAY })
    expect(again.summary).toBeDefined()
    expect(again.hidden).toBe(true) // regenerar não "liga" um roteiro oculto
  })

  it('a duração estimada cresce com o roteiro e encolhe com a velocidade', async () => {
    const { estimateTourMs, estimateQueueMs, formatDuration, TRANSITION_SECONDS } = await import('../interactiveHelp/player')
    const curto = buildAutoTour(input, { action: 'delete', today: TODAY })
    const longo = buildAutoTour(input, { action: 'create', fill: 'all', today: TODAY })
    expect(estimateTourMs(longo, 'normal')).toBeGreaterThan(estimateTourMs(curto, 'normal'))
    expect(estimateTourMs(longo, 'fast')).toBeLessThan(estimateTourMs(longo, 'normal'))
    expect(estimateTourMs(longo, 'slow')).toBeGreaterThan(estimateTourMs(longo, 'normal'))
    // a fila soma os tutoriais e a espera entre eles
    const dois = estimateTourMs(curto, 'normal') + estimateTourMs(longo, 'normal') + TRANSITION_SECONDS.normal * 1000
    expect(estimateQueueMs([curto, longo], 'normal')).toBe(dois)
    expect(estimateQueueMs([], 'normal')).toBe(0)
  })

  it('formata a duração: segundos, e minutos arredondados de 5 em 5 s', async () => {
    const { formatDuration } = await import('../interactiveHelp/player')
    expect(formatDuration(22_000)).toBe('22 s')
    expect(formatDuration(65_000)).toBe('1 min 5 s')
    expect(formatDuration(120_000)).toBe('2 min')
    expect(formatDuration(127_000)).toBe('2 min 5 s')
    expect(formatDuration(0)).toBe('1 s')
  })

  it('o título curto tira o nome da tela, mas só se houver dois-pontos', async () => {
    const { shortTitle } = await import('../interactiveHelp/order')
    expect(shortTitle('Como pesquisar: Clientes')).toBe('Como pesquisar')
    expect(shortTitle('Tour sem dois pontos')).toBe('Tour sem dois pontos')
    expect(shortTitle(': só o fim')).toBe(': só o fim')
  })
})

describe('tutoriais já vistos (só no navegador)', () => {
  const makeStorage = (initial: Record<string, string> = {}) => {
    const data: Record<string, string> = { ...initial }
    return { data, getItem: (k: string) => (k in data ? data[k] : null), setItem: (k: string, v: string) => { data[k] = v }, removeItem: (k: string) => { delete data[k] } }
  }

  it('a chave é por projeto e por tela', async () => {
    const { seenStorageKey } = await import('../interactiveHelp/seen')
    expect(seenStorageKey('p1', 'v1')).toBe('mb_tour_seen:p1:v1')
    expect(seenStorageKey('p1', 'v2')).not.toBe(seenStorageKey('p1', 'v1'))
    expect(seenStorageKey()).toBe('mb_tour_seen:-:-')
  })

  it('marca como visto sem duplicar e lê de volta', async () => {
    const { markSeen, readSeen } = await import('../interactiveHelp/seen')
    const st = makeStorage()
    expect(markSeen(st, 'k', 'a')).toEqual(['a'])
    expect(markSeen(st, 'k', 'b')).toEqual(['a', 'b'])
    expect(markSeen(st, 'k', 'a')).toEqual(['a', 'b'])
    expect(readSeen(st, 'k')).toEqual(['a', 'b'])
  })

  it('zerar o progresso apaga só o desta tela', async () => {
    const { clearSeen, markSeen, readSeen } = await import('../interactiveHelp/seen')
    const st = makeStorage()
    markSeen(st, 'k1', 'a'); markSeen(st, 'k2', 'z')
    clearSeen(st, 'k1')
    expect(readSeen(st, 'k1')).toEqual([])
    expect(readSeen(st, 'k2')).toEqual(['z'])
  })

  it('valor guardado estranho, sem armazenamento ou armazenamento que lança: nunca derruba a tela', async () => {
    const { markSeen, readSeen, clearSeen } = await import('../interactiveHelp/seen')
    expect(readSeen(makeStorage({ k: 'não é json' }), 'k')).toEqual([])
    expect(readSeen(makeStorage({ k: '{"a":1}' }), 'k')).toEqual([])
    expect(readSeen(makeStorage({ k: '["a", 7, null, "b"]' }), 'k')).toEqual(['a', 'b'])
    expect(readSeen(null, 'k')).toEqual([])
    expect(markSeen(null, 'k', 'a')).toEqual(['a']) // vale para a sessão da tela mesmo sem armazenamento
    const quebrado = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('cheio') }, removeItem: () => { throw new Error('x') } }
    expect(readSeen(quebrado, 'k')).toEqual([])
    expect(markSeen(quebrado, 'k', 'a', ['b'])).toEqual(['b', 'a'])
    expect(() => clearSeen(quebrado, 'k')).not.toThrow()
  })

  it('"continuar de onde parei" são os que faltam, na ordem do dev', async () => {
    const { unseenTours } = await import('../interactiveHelp/seen')
    const tours = [{ id: 'search' }, { id: 'view' }, { id: 'create' }, { id: 'edit' }]
    expect(unseenTours(tours, ['view', 'create']).map(t => t.id)).toEqual(['search', 'edit'])
    expect(unseenTours(tours, [])).toHaveLength(4)
    expect(unseenTours(tours, ['search', 'view', 'create', 'edit'])).toEqual([])
  })
})

describe('frase do cartão editada pelo dev', () => {
  const input = { formFields: [pk, nome, email], filterFields: [nome] }

  it('a frase escrita pelo dev sobrevive a regenerar; a automática é refeita', () => {
    const tour = buildAutoTour(input, { action: 'create', fill: 'all', today: TODAY })
    const minha = { pt: 'Meu texto', en: 'My text' }
    const custom = { ...tour, summary: minha, summaryCustom: true }
    const again = regenerateTour(custom, { formFields: [pk, nome] }, { action: 'create', today: TODAY })
    expect(again.summary).toEqual(minha)
    expect(again.summaryCustom).toBe(true)
    // sem marca de "escrita pelo dev", regenerar atualiza a frase com a contagem nova
    const auto = regenerateTour(tour, { formFields: [pk, nome] }, { action: 'create', fill: 'all', today: TODAY })
    expect(auto.summary?.pt).toBe('Preenche 1 campo e salva um novo registro.')
    expect(auto.summaryCustom).toBeUndefined()
  })

  it('a marca "escrita pelo dev" vai e volta do banco', () => {
    const cfg = normalizeInteractiveHelp({ tours: [{ id: 'x', action: 'view', summary: { pt: 'oi' }, summaryCustom: true, steps: [{ id: 's', kind: 'click' }] }] })
    expect(cfg.tours[0]).toMatchObject({ summary: { pt: 'oi' }, summaryCustom: true })
  })
})
