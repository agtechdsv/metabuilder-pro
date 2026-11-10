import { describe, expect, it } from 'vitest'
import { auditRelationIds, checkTabLink, describePath, isAuditColumnName, isPathValid, suggestRelationPath, type RawRelation } from '../orchestratorRelationPath'

// clientes <- pedidos <- entregas ; pedidos <- itens_pedido -> produtos ; funcionarios <- pedidos ; funcionarios <- tarefas ; ilha isolada
const rels: RawRelation[] = [
  { id: 'r-ped-cli', from_model_id: 'pedidos', to_model_id: 'clientes' },
  { id: 'r-ent-ped', from_model_id: 'entregas', to_model_id: 'pedidos' },
  { id: 'r-it-ped', from_model_id: 'itens', to_model_id: 'pedidos' },
  { id: 'r-it-prod', from_model_id: 'itens', to_model_id: 'produtos' },
  { id: 'r-ped-func', from_model_id: 'pedidos', to_model_id: 'funcionarios' },
  { id: 'r-tar-func', from_model_id: 'tarefas', to_model_id: 'funcionarios' },
]
const models = ['clientes', 'pedidos', 'entregas', 'itens', 'produtos', 'funcionarios', 'tarefas', 'ilha'].map(id => ({ id, db_table_name: id }))

describe('suggestRelationPath', () => {
  it('ligação direta: 1 relação', () => expect(suggestRelationPath(rels, 'pedidos', 'clientes')).toEqual(['r-ped-cli']))
  it('duas relações, em ordem da aba ao mestre', () => expect(suggestRelationPath(rels, 'entregas', 'clientes')).toEqual(['r-ent-ped', 'r-ped-cli']))
  it('passa pela tabela intermediária nos dois sentidos (produtos -> itens -> pedidos -> clientes)', () => {
    expect(suggestRelationPath(rels, 'produtos', 'clientes')).toEqual(['r-it-prod', 'r-it-ped', 'r-ped-cli'])
  })
  it('sem rota devolve null; mesmo modelo devolve []', () => {
    expect(suggestRelationPath(rels, 'ilha', 'clientes')).toBeNull()
    expect(suggestRelationPath(rels, 'clientes', 'clientes')).toEqual([])
  })
  it('respeita o limite de relações', () => expect(suggestRelationPath(rels, 'produtos', 'clientes', 2)).toBeNull())
  it('aceita os nomes detail/master das relações antigas', () => {
    expect(suggestRelationPath([{ id: 'x', detail_model_id: 'a', master_model_id: 'b' }], 'a', 'b')).toEqual(['x'])
  })
})

describe('isPathValid', () => {
  it('os caminhos do exemplo real são válidos', () => {
    expect(isPathValid(rels, ['r-ent-ped', 'r-ped-cli'], 'entregas', 'clientes')).toBe(true)
    expect(isPathValid(rels, ['r-it-prod', 'r-it-ped', 'r-ped-cli'], 'produtos', 'clientes')).toBe(true)
    expect(isPathValid(rels, ['r-tar-func', 'r-ped-func', 'r-ped-cli'], 'tarefas', 'clientes')).toBe(true)
  })
  it('caminho que não chega ao mestre, fora de ordem, vazio ou com id vazio é inválido', () => {
    expect(isPathValid(rels, ['r-ent-ped'], 'entregas', 'clientes')).toBe(false)
    expect(isPathValid(rels, ['r-ped-cli', 'r-ent-ped'], 'entregas', 'clientes')).toBe(false)
    expect(isPathValid(rels, [], 'entregas', 'clientes')).toBe(false)
    expect(isPathValid(rels, ['r-ent-ped', ''], 'entregas', 'clientes')).toBe(false)
    expect(isPathValid(rels, ['nao-existe'], 'entregas', 'clientes')).toBe(false)
  })
})

describe('checkTabLink', () => {
  const base = { relations: rels, masterModelId: 'clientes', linkedToMaster: true }
  it('vazio com rota: sugere', () => expect(checkTabLink({ ...base, path: [], tabModelId: 'entregas' })).toEqual({ kind: 'empty', suggestion: ['r-ent-ped', 'r-ped-cli'] }))
  it('caminho certo: ok', () => expect(checkTabLink({ ...base, path: ['r-ent-ped', 'r-ped-cli'], tabModelId: 'entregas' })).toEqual({ kind: 'ok' }))
  it('caminho errado com rota: inválido e sugere', () => expect(checkTabLink({ ...base, path: ['r-ped-cli'], tabModelId: 'entregas' })).toEqual({ kind: 'invalid', suggestion: ['r-ent-ped', 'r-ped-cli'] }))
  it('sem rota: no_route', () => expect(checkTabLink({ ...base, path: [], tabModelId: 'ilha' })).toEqual({ kind: 'no_route', hadPath: false, onlyAudit: false }))
  it('nada a conferir: vínculo desligado, sem mestre, sem caso de uso ou mesmo modelo', () => {
    expect(checkTabLink({ ...base, path: [], tabModelId: 'entregas', linkedToMaster: false })).toEqual({ kind: 'skip' })
    expect(checkTabLink({ ...base, path: [], tabModelId: 'entregas', masterModelId: '' })).toEqual({ kind: 'skip' })
    expect(checkTabLink({ ...base, path: [], tabModelId: undefined })).toEqual({ kind: 'skip' })
    expect(checkTabLink({ ...base, path: [], tabModelId: 'clientes' })).toEqual({ kind: 'skip' })
  })
})

describe('describePath', () => {
  it('lista as tabelas a partir da aba', () => expect(describePath(rels, models, ['r-ent-ped', 'r-ped-cli'], 'entregas')).toBe('entregas → pedidos → clientes'))
})

// auditoria: produtos.created_by -> usuarios e clientes.created_by -> usuarios criam um atalho sem sentido de negócio
const relsAudit: RawRelation[] = [
  ...rels,
  { id: 'r-prod-user', from_model_id: 'produtos', to_model_id: 'usuarios', from_field_id: 'f-prod-cb' },
  { id: 'r-cli-user', from_model_id: 'clientes', to_model_id: 'usuarios', from_field_id: 'f-cli-cb' },
  { id: 'r-ilha-user', from_model_id: 'ilha', to_model_id: 'usuarios', from_field_id: 'f-ilha-x', audit_only: true },
]
const modelsAudit = [
  { id: 'produtos', fields: [{ id: 'f-prod-cb', db_column_name: 'created_by' }] },
  { id: 'clientes', fields: [{ id: 'f-cli-cb', db_column_name: 'updated_by' }] },
  { id: 'ilha', fields: [{ id: 'f-ilha-x', db_column_name: 'responsavel_cadastro' }] },
]

describe('isAuditColumnName', () => {
  it('reconhece nomes de auditoria', () => {
    for (const n of ['created_by', 'updatedBy', 'deleted_by', 'criado_por', 'atualizado_por', 'usuario_criacao', 'created_by_id', 'CreatedBy']) expect(isAuditColumnName(n), n).toBe(true)
  })
  it('não confunde chaves de negócio', () => {
    for (const n of ['cliente_id', 'pedido_id', 'usuario_id', 'funcionario_id', 'responsavel_id', '', undefined]) expect(isAuditColumnName(n as string), String(n)).toBe(false)
  })
})

describe('relações de auditoria', () => {
  const audit = auditRelationIds(relsAudit, modelsAudit)
  it('acha pelo nome da coluna e pela marca manual', () => {
    expect([...audit].sort()).toEqual(['r-cli-user', 'r-ilha-user', 'r-prod-user'])
  })
  it('sem a regra, produtos chega a clientes por usuarios (o problema)', () => {
    expect(suggestRelationPath(relsAudit, 'produtos', 'clientes')).toEqual(['r-prod-user', 'r-cli-user'])
  })
  it('com a regra, produtos chega a clientes pelo negócio', () => {
    expect(suggestRelationPath(relsAudit, 'produtos', 'clientes', 4, audit)).toEqual(['r-it-prod', 'r-it-ped', 'r-ped-cli'])
  })
  it('caminho guardado por auditoria é avisado e já traz a sugestão de negócio', () => {
    expect(checkTabLink({ relations: relsAudit, path: ['r-prod-user', 'r-cli-user'], tabModelId: 'produtos', masterModelId: 'clientes', linkedToMaster: true, auditIds: audit }))
      .toEqual({ kind: 'audit', suggestion: ['r-it-prod', 'r-it-ped', 'r-ped-cli'] })
  })
  it('só existe rota por auditoria: no_route com onlyAudit', () => {
    const only: RawRelation[] = [{ id: 'a-b', from_model_id: 'a', to_model_id: 'u', from_field_id: 'x' }, { id: 'b-u', from_model_id: 'b', to_model_id: 'u', from_field_id: 'y' }]
    const ids = auditRelationIds(only, [{ id: 'a', fields: [{ id: 'x', db_column_name: 'created_by' }] }, { id: 'b', fields: [{ id: 'y', db_column_name: 'created_by' }] }])
    expect(checkTabLink({ relations: only, path: [], tabModelId: 'a', masterModelId: 'b', linkedToMaster: true, auditIds: ids })).toEqual({ kind: 'no_route', hadPath: false, onlyAudit: true })
  })
  it('caminho de negócio continua ok', () => {
    expect(checkTabLink({ relations: relsAudit, path: ['r-ent-ped', 'r-ped-cli'], tabModelId: 'entregas', masterModelId: 'clientes', linkedToMaster: true, auditIds: audit })).toEqual({ kind: 'ok' })
  })
})
