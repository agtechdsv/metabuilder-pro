import { describe, it, expect } from 'vitest'
import { aplicarMascara, campoMarcador, regraDeLinha, describeName, isSupportedView, mascaraDePadrao, planTitle, planView } from '../plan'
import { eventLine, parseTestEvent, statusFromPlaywright } from '../results'
import type { ManifestField, ManifestView } from '../manifestTypes'

const campo = (column: string, extra: Partial<ManifestField> = {}): ManifestField =>
  ({ column, label: column, dataType: 'varchar', required: false, readOnly: false, isPrimaryKey: false, hasFormula: false, ...extra })

const view = (over: Partial<ManifestView> = {}): ManifestView => ({
  slug: 'clientes', path: '/clientes', title: 'Clientes', logicType: 'pesquisa_cadastro', table: 'clientes', primaryKey: 'id', displayType: 'list',
  actionInterface: 'page', filter: [], grid: [], form: [campo('id', { isPrimaryKey: true }), campo('nome', { required: true })], buttons: [], exportFormats: [], details: [], ...over,
})

describe('plano de testes de um caso de uso', () => {
  it('Pesquisa + Cadastro: lista e formulário sempre; obrigatórios só se há campo obrigatório', () => {
    const p = planView(view())
    expect(p.map(t => t.kind)).toContain('obrigatorios')
    expect(planView(view({ form: [campo('nome')] })).map(t => t.kind)).not.toContain('obrigatorios')
    expect(p.map(t => t.kind).slice(0, 3)).toEqual(['abre', 'lista', 'formulario'])
  })

  it('um teste de máscara por campo com máscara de padrão fixo; máscara numérica não entra', () => {
    const p = planView(view({ form: [campo('cnpj', { label: 'CNPJ', mask: '00.000.000/0000-00' }), campo('valor', { mask: '0.000,00' }), campo('cep', { mask: '00000-000' })] }))
    expect(p.filter(t => t.kind === 'mascara').map(t => t.field)).toEqual(['cnpj', 'cep'])
    expect(mascaraDePadrao('0.000,00')).toBe(false)
    expect(mascaraDePadrao('(00) 00000-0000')).toBe(true)
  })

  it('campo de data não ganha teste de máscara (o app usa o seletor nativo de data)', () => {
    const p = planView(view({ form: [campo('data', { dataType: 'date', mask: '00/00/0000' }), campo('quando', { dataType: 'timestamp', mask: '00/00/0000' }), campo('cnpj', { mask: '00.000.000/0000-00' })] }))
    expect(p.filter(t => t.kind === 'mascara').map(t => t.field)).toEqual(['cnpj'])
  })

  it('telas criadas por IA (personalizado) ganham só "a tela abre"', () => {
    expect(isSupportedView(view({ logicType: 'personalizado' }))).toBe(false)
    expect(planView(view({ logicType: 'personalizado' })).map(t => t.kind)).toEqual(['abre'])
  })

  it('cada tipo de tela especial ganha o seu gabarito, e os filtros só se houver filtro', () => {
    const k = (logicType: string, filter: ManifestField[] = []) => planView(view({ logicType, filter })).map(t => t.kind)
    expect(k('kanban')).toEqual(['abre', 'tipo_kanban'])
    expect(k('gantt', [campo('projeto_id')])).toEqual(['abre', 'tipo_gantt', 'filtros_tela'])
    expect(k('scheduler')).toEqual(['abre', 'tipo_agenda'])
    expect(k('map')).toContain('tipo_mapa')
    expect(isSupportedView(view({ logicType: 'analytics' }))).toBe(true)
  })

  it('Pesquisa + Cadastro (fase 3): paginação, Visualizar, botões e tipos de campo; filtro por opção, exportação, abas só se houver o que conferir', () => {
    const base = planView(view({ buttons: [{ id: 'export', label: 'Exportar Dados', actionType: 'export', placement: 'header' }] })).map(t => t.kind)
    expect(base).toEqual(expect.arrayContaining(['grid_paginacao', 'visualizar', 'botoes', 'campos_tipos']))
    for (const k of ['filtro_opcoes', 'exportacao_marcadas', 'central_downloads', 'abas']) expect(base).not.toContain(k)

    const opcoes = [{ value: 'a', label: 'A' }]
    const rico = planView(view({
      grid: [campo('nome', { label: 'Nome' }), campo('status', { label: 'Status', options: opcoes })],
      filter: [campo('nome', { label: 'Nome' }), campo('status', { label: 'Status', options: opcoes })],
      exportFormats: ['csv'], details: [{ table: 'pedidos', label: 'Pedidos', foreignKey: 'cliente_id', displayMode: 'tab', fields: [], subDetails: [] }],
    }))
    expect(rico.map(t => t.kind)).toEqual(expect.arrayContaining(['filtro_opcoes', 'exportacao_filtrada', 'exportacao_marcadas', 'central_downloads', 'abas']))
    expect(rico.find(t => t.kind === 'filtro_opcoes')?.field).toBe('status')
  })

  it('grid: total sempre; ordenação e filtro só com campo de texto (o filtro também precisa estar no grid)', () => {
    const base = { grid: [campo('nome', { label: 'Nome' }), campo('status', { options: [{ value: 'a', label: 'A' }] })], filter: [campo('nome', { label: 'Nome' })] }
    const p = planView(view(base))
    expect(p.filter(t => t.kind === 'grid_total')).toHaveLength(1)
    expect(p.find(t => t.kind === 'grid_ordenacao')?.field).toBe('nome')
    expect(p.find(t => t.kind === 'grid_filtro')?.field).toBe('nome')
    const semGrid = planView(view({ grid: [campo('status', { options: [{ value: 'a', label: 'A' }] })], filter: [campo('nome')] }))
    expect(semGrid.some(t => t.kind === 'grid_ordenacao')).toBe(false)
    expect(semGrid.some(t => t.kind === 'grid_filtro')).toBe(false)
  })

  it('exportação: um teste por formato liberado no Studio (csv, json, xlsx)', () => {
    const p = planView(view({ exportFormats: ['xlsx', 'csv', 'json', 'pdf'] }))
    expect(p.filter(t => t.kind === 'exportacao').map(t => t.format)).toEqual(['xlsx', 'csv', 'json'])
    expect(planView(view({ exportFormats: [] })).some(t => t.kind === 'exportacao')).toBe(false)
  })

  it('integração: cadastro, reabrir, edição e exclusão só com tipo integração e um campo de texto que identifique o registro', () => {
    const kinds = (v: ManifestView, types?: ('funcional' | 'integracao')[]) => planView(v, { types }).map(t => t.kind)
    expect(kinds(view(), ['integracao'])).toEqual(['crud_cadastro', 'crud_reabrir', 'crud_edicao', 'crud_exclusao'])
    expect(kinds(view())).not.toContain('crud_cadastro')                    // o padrão (funcional) nunca grava
    expect(kinds(view(), ['funcional', 'integracao'])).toEqual(expect.arrayContaining(['abre', 'lista', 'crud_cadastro', 'crud_exclusao']))
    // sem campo de texto livre (só número e máscara de padrão): o registro é identificado pelo id novo, então também há teste de integração
    expect(kinds(view({ form: [campo('id', { isPrimaryKey: true }), campo('valor', { dataType: 'numeric' }), campo('cnpj', { mask: '00.000.000/0000-00' })] }), ['integracao'])).toEqual(['crud_cadastro', 'crud_reabrir', 'crud_edicao', 'crud_exclusao'])
    // sem nenhum campo editável (tudo somente leitura) não há o que preencher
    expect(kinds(view({ form: [campo('id', { isPrimaryKey: true }), campo('total', { readOnly: true })] }), ['integracao'])).toEqual([])
    // com uma aba de detalhe editável, o plano ganha o teste das abas (entre a edição e a exclusão)
    expect(kinds(view({ details: [{ table: 'itens', label: 'Itens', foreignKey: 'pedido_id', displayMode: 'tab', subDetails: [], fields: [campo('pedido_id'), campo('qtd', { dataType: 'integer' })] }] as any }), ['integracao'])).toEqual(['crud_cadastro', 'crud_reabrir', 'crud_edicao', 'detalhe_adicionar', 'crud_exclusao'])
    // aba só com a chave do pai e campo calculado: nada a preencher
    expect(kinds(view({ details: [{ table: 'itens', label: 'Itens', foreignKey: 'pedido_id', displayMode: 'tab', subDetails: [], fields: [campo('pedido_id'), campo('total', { readOnly: true })] }] as any }), ['integracao'])).toEqual(['crud_cadastro', 'crud_reabrir', 'crud_edicao', 'crud_exclusao'])
    expect(kinds(view({ logicType: 'kanban' }), ['integracao'])).toEqual([])
    expect(kinds(view({ logicType: 'kanban', kanbanGroupColumn: 'status' }), ['integracao'])).toEqual(['kanban_mover'])
    expect(kinds(view({ logicType: 'blueprint', blueprintPredecessorColumn: 'predecessor_id' }), ['integracao'])).toEqual(['fluxo_conectar'])
    expect(campoMarcador(view())?.column).toBe('nome')
    expect(planTitle({ kind: 'crud_edicao', title: 'x' }, 'en')).toBe('edit: changing and saving writes only the change')
  })

  it('segurança: permissões da tabela sempre; por grupo só com gestão de acesso; por linha só com regra que o motor sabe conferir', () => {
    const k = (v: ManifestView, auth?: any) => planView(v, { types: ['seguranca'], auth }).map(t => t.kind)
    expect(k(view())).toEqual(['seg_tabela'])                                        // sem login do tipo banco: só o que a tela mostra
    const login = { type: 'database', usersTable: 'usuarios' }
    expect(k(view(), login)).toEqual(['seg_tabela'])
    expect(k(view(), { ...login, access: { groupsTable: 'perfis' } })).toEqual(['seg_tabela', 'seg_nivel_nenhum', 'seg_nivel_leitura'])
    const comRegra = view({ rowPolicy: [{ column: 'criado_por', op: 'eq', source: 'user.attr', attr: 'id' }] })
    expect(k(comRegra, login)).toEqual(['seg_tabela', 'seg_linha'])
    // regra "related" sem a tabela relacionada, ou sem o atributo do usuário: o motor não confere
    expect(regraDeLinha(view({ rowPolicy: [{ column: 'cliente_id', op: 'related', source: 'user.email' }] }))).toBeUndefined()
    // "related" completa: conferida
    expect(regraDeLinha(view({ rowPolicy: [{ column: 'cliente_id', op: 'related', source: 'user.email', related: { table: 'clientes', key: 'id', column: 'email' } }] }))?.op).toBe('related')
    expect(regraDeLinha(view({ rowPolicy: [{ column: 'x', op: 'eq', source: 'user.attr' }] }))).toBeUndefined()
    expect(k(view({ logicType: 'kanban' }), login)).toEqual([])
    expect(planView(view(), { types: ['funcional'] }).map(t => t.kind)).not.toContain('seg_tabela') // o padrão nunca cria usuários
  })

  it('gestão de acesso: oito testes só no tipo segurança, só com login pelo banco e gestão de acesso ligada', () => {
    const acesso = view({ slug: '__gestao_acesso', logicType: 'gestao_acesso', table: '' })
    const auth = { type: 'database', usersTable: 'usuarios', access: { groupsTable: 'perfis' } } as any
    expect(planView(acesso, { types: ['seguranca'], auth }).map(t => t.kind)).toEqual([
      'acesso_abre', 'acesso_usuarios_lista', 'acesso_usuario_ciclo', 'acesso_email_repetido', 'acesso_grupo_ciclo', 'acesso_permissoes_matriz', 'acesso_permissao_ciclo', 'acesso_so_admin'])
    expect(planView(acesso, { types: ['funcional'], auth })).toEqual([])                       // nem "a tela abre": não é um caso de uso do Studio
    expect(planView(acesso, { types: ['integracao'], auth })).toEqual([])
    expect(planView(acesso, { types: ['seguranca'], auth: { type: 'database' } as any })).toEqual([]) // sem gestão de acesso no app
    expect(isSupportedView(acesso)).toBe(true)
  })

  it('aplicarMascara: cada 0 consome um dígito e o resto é literal', () => {
    expect(aplicarMascara('12345678901234', '00.000.000/0000-00')).toBe('12.345.678/9012-34')
    expect(aplicarMascara('123', '00000-000')).toBe('123')
    expect(aplicarMascara('1234567', '00000-000')).toBe('12345-67')
  })

  it('o nome do grupo é o mesmo que o teste usa no describe', () => {
    expect(describeName(view())).toBe('Clientes (clientes) · pesquisa_cadastro')
  })
})

describe('leitura dos eventos do relator', () => {
  it('ida e volta de um evento, mesmo no meio de outras linhas da saída', () => {
    const ev = { t: 'end' as const, group: 'Clientes (clientes) · pesquisa_cadastro', title: 'lista: ...', status: 'failed' as const, ms: 1200, error: 'campo "X" não visível' }
    expect(parseTestEvent('  [WebServer] ruído ' + eventLine(ev))).toEqual(ev)
    expect(parseTestEvent(eventLine({ t: 'done', total: 4, passed: 3, failed: 1, skipped: 0 }))).toMatchObject({ t: 'done', total: 4 })
  })

  it('linhas que não são do relator ou estão quebradas viram null', () => {
    expect(parseTestEvent('  ok 1 [dynamic-pg-node] › ...')).toBeNull()
    expect(parseTestEvent('@@MB@@{quebrado')).toBeNull()
    expect(parseTestEvent('@@MB@@{"t":"outra"}')).toBeNull()
  })

  it('status do Playwright → status do painel', () => {
    expect(statusFromPlaywright('passed')).toBe('passed')
    expect(statusFromPlaywright('skipped')).toBe('skipped')
    expect(statusFromPlaywright('timedOut')).toBe('failed')
    expect(statusFromPlaywright('failed')).toBe('failed')
  })
})
