import { describe, expect, it } from 'vitest'
import { checkTabLink, describePath, isPathValid, suggestRelationPath, type RawRelation } from '../orchestratorRelationPath'

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
  it('sem rota: no_route', () => expect(checkTabLink({ ...base, path: [], tabModelId: 'ilha' })).toEqual({ kind: 'no_route', hadPath: false }))
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
