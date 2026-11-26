import { describe, it, expect } from 'vitest'
import {
  MAX_JOIN_DEPTH, defaultColumnLabel, describePath, hopsOfJoin, isControlField, isSensitiveField, joinSpecOf, nextHops, outgoingHops,
  reachableTables, relatedKey, searchFields,
} from '../relationPaths'

// itens -> pedidos -> clientes -> cidades -> estados -> paises (cadeia de 5 saltos) e pedidos -> funcionarios
const models = ['itens', 'pedidos', 'clientes', 'cidades', 'estados', 'paises', 'funcionarios'].map((n) => ({ id: 'm_' + n, db_table_name: n, display_name: n[0].toUpperCase() + n.slice(1) }))
const fields: any[] = []
const add = (model: string, name: string, label?: string) => { fields.push({ id: `${model}.${name}`, model_id: 'm_' + model, db_column_name: name, display_name: label || name, data_type: 'text' }); return `${model}.${name}` }
for (const m of ['itens', 'pedidos', 'clientes', 'cidades', 'estados', 'paises', 'funcionarios']) { add(m, 'id'); add(m, 'nome', 'Nome') }
add('pedidos', 'cliente_id', 'Cliente'); add('pedidos', 'funcionario_id', 'Funcionário'); add('itens', 'pedido_id', 'Pedido')
add('clientes', 'cidade_id', 'Cidade'); add('cidades', 'estado_id', 'Estado'); add('estados', 'pais_id', 'País')
add('funcionarios', 'senha_hash', 'Senha'); add('pedidos', 'criado_em', 'Criado em')
const rel = (from: string, fk: string, to: string) => ({ from_model_id: 'm_' + from, from_field_id: `${from}.${fk}`, to_model_id: 'm_' + to, to_field_id: `${to}.id` })
const relations = [rel('itens', 'pedido_id', 'pedidos'), rel('pedidos', 'cliente_id', 'clientes'), rel('pedidos', 'funcionario_id', 'funcionarios'), rel('clientes', 'cidade_id', 'cidades'), rel('cidades', 'estado_id', 'estados'), rel('estados', 'pais_id', 'paises')]
const ctx = { relations, dbFields: fields, dbModels: models }

describe('caminhos de relacionamento da consulta', () => {
  it('só saem os relacionamentos muitos-para-um da tabela (o sentido contrário não aparece)', () => {
    expect(outgoingHops(ctx, 'm_pedidos').map((h) => h.fk).sort()).toEqual(['cliente_id', 'funcionario_id'])
    expect(outgoingHops(ctx, 'm_clientes').map((h) => h.fk)).toEqual(['cidade_id']) // clientes não "enxerga" os pedidos
    expect(outgoingHops(ctx, 'm_paises')).toEqual([])
  })

  it('o limite é de 4 níveis e nunca volta a uma tabela já visitada', () => {
    let path: any[] = []
    for (let i = 0; i < 10; i++) {
      const next = nextHops(ctx, 'm_itens', path)
      if (!next.length) break
      path = [...path, next[0]]
    }
    expect(MAX_JOIN_DEPTH).toBe(4)
    expect(path.map((h) => h.modelId)).toEqual(['m_pedidos', 'm_clientes', 'm_cidades', 'm_estados']) // o 5º (países) fica de fora
    // ciclo: uma tabela que aponta para a base não leva de volta a ela
    const loop = { ...ctx, relations: [...relations, rel('clientes', 'cidade_id', 'pedidos')] }
    expect(nextHops(loop, 'm_pedidos', [outgoingHops(loop, 'm_pedidos').find((h) => h.fk === 'cliente_id')!]).map((h) => h.modelId)).toEqual(['m_cidades'])
  })

  it('a chave do campo com um salto é a mesma do formato antigo, e o encadeado junta os saltos', () => {
    const toClient = outgoingHops(ctx, 'm_pedidos').find((h) => h.fk === 'cliente_id')!
    expect(relatedKey([toClient], 'nome')).toBe('rel_cliente_id__nome')
    const toCity = outgoingHops(ctx, 'm_clientes')[0]
    expect(relatedKey([toClient, toCity], 'nome')).toBe('rel_cliente_id__cidade_id__nome')
    expect(joinSpecOf([toClient, toCity], 'nome')).toEqual({ path: [{ fk: 'cliente_id', modelId: 'm_clientes', pk: 'id' }, { fk: 'cidade_id', modelId: 'm_cidades', pk: 'id' }], field: 'nome' })
    expect(defaultColumnLabel([toClient, toCity], 'Nome')).toBe('Cidade › Nome')
    expect(defaultColumnLabel([], 'Status')).toBe('Status')
  })

  it('descreve o caminho completo, também de colunas salvas no formato antigo de um salto', () => {
    const toClient = outgoingHops(ctx, 'm_pedidos').find((h) => h.fk === 'cliente_id')!
    const toCity = outgoingHops(ctx, 'm_clientes')[0]
    expect(describePath(ctx, 'm_pedidos', joinSpecOf([toClient, toCity], 'nome'))).toBe('Pedidos › Clientes › Cidades › Nome')
    const legacy = { fk: 'cliente_id', modelId: 'm_clientes', field: 'nome', pk: 'id' }
    expect(describePath(ctx, 'm_pedidos', legacy)).toBe('Pedidos › Clientes › Nome')
    expect(hopsOfJoin(legacy)).toEqual([{ fk: 'cliente_id', modelId: 'm_clientes', pk: 'id' }])
    expect(hopsOfJoin(null)).toEqual([])
  })

  it('a busca acha o campo em qualquer nível, sem segredos, com o mais próximo primeiro', () => {
    const hits = searchFields(ctx, 'm_itens', 'nome')
    expect(hits[0].path).toHaveLength(0) // Nome dos itens vem antes
    expect(hits.map((h) => h.path.length)).toEqual([...hits.map((h) => h.path.length)].sort((a, b) => a - b))
    expect(hits.some((h) => h.key === 'rel_pedido_id__cliente_id__cidade_id__estado_id__nome')).toBe(true) // 4 níveis
    expect(hits.some((h) => h.key.includes('pais_id'))).toBe(false) // 5 níveis: fora do limite
    expect(searchFields(ctx, 'm_pedidos', 'senha')).toEqual([]) // coluna sensível não é oferecida
    expect(searchFields(ctx, 'm_pedidos', 'n')).toEqual([]) // busca curta demais
  })

  it('reconhece campos de controle e sensíveis', () => {
    for (const n of ['criado_em', 'criado_por', 'atualizado_em', 'atualizado_por']) expect(isControlField(n)).toBe(true)
    expect(isControlField('status')).toBe(false)
    for (const n of ['hash_senha', 'senha_hash', 'token_acesso', 'api_key', 'password']) expect(isSensitiveField(n)).toBe(true)
    expect(isSensitiveField('nome')).toBe(false)
  })

  it('a lista de tabelas alcançáveis respeita o teto, mesmo em modelos muito ligados', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: 'x' + i, db_table_name: 'x' + i }))
    const f: any[] = many.flatMap((m) => [{ id: m.id + '.id', model_id: m.id, db_column_name: 'id' }, ...many.map((o) => ({ id: m.id + '.' + o.id, model_id: m.id, db_column_name: 'fk_' + o.id }))])
    const r = many.flatMap((m) => many.filter((o) => o.id !== m.id).map((o) => ({ from_model_id: m.id, from_field_id: m.id + '.' + o.id, to_model_id: o.id, to_field_id: o.id + '.id' })))
    expect(reachableTables({ relations: r, dbFields: f, dbModels: many }, 'x0', 500).length).toBeLessThanOrEqual(500)
  })
})
