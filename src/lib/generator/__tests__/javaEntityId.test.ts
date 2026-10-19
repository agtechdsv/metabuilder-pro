import { describe, it, expect } from 'vitest'
import { parseMetaBuilderJSON } from '../parser'
import { generateJavaSpringProject } from '../emitter/java-spring-project'

/**
 * Cadastrar pelo backend Java falhava em toda tabela com chave UUID: o Hibernate recusava com
 * "Identifier of entity must be manually assigned before calling persist()", porque as telas não enviam o id (o banco tem valor padrão).
 * Achado ao rodar os testes de ponta a ponta no app Java ejetado, no banco real.
 */
const f = (id: string, model: string, col: string, type: string, extra: Record<string, unknown> = {}) =>
  ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, ...extra })

const raw = () => ({
  project: { id: 'p1', name: 'Vendas', slug: 'vendas' },
  models: [
    { id: 'm1', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public' },
    { id: 'm2', db_table_name: 'paises', display_name: 'Paises', db_schema_name: 'public' },
    { id: 'm3', db_table_name: 'ora_itens', display_name: 'OraItens', db_schema_name: 'public' },
    { id: 'm4', db_table_name: 'contadores', display_name: 'Contadores', db_schema_name: 'public' },
  ],
  fields: [
    f('a1', 'm1', 'id', 'uuid', { is_primary_key: true, default_value: 'gen_random_uuid()' }), f('a2', 'm1', 'nome', 'text'),
    f('b1', 'm2', 'sigla', 'varchar', { is_primary_key: true }), f('b2', 'm2', 'nome', 'text'),                       // texto sem padrão: chave de negócio
    f('c1', 'm3', 'id', 'varchar', { is_primary_key: true, default_value: 'SYS_GUID()' }), f('c2', 'm3', 'nome', 'text'), // texto com padrão (Oracle)
    f('d1', 'm4', 'id', 'integer', { is_primary_key: true }), f('d2', 'm4', 'nome', 'text'),                              // numérica: identity
  ],
  relations: [], views: [],
})

describe('backend Java: geração do id da entidade', () => {
  const files = generateJavaSpringProject(parseMetaBuilderJSON(raw(), 'postgres', { backendStack: 'java-spring', javaGroupId: 'com.vendas' } as any))
  const entity = (n: string) => files.get(`backend/src/main/java/com/vendas/entities/${n}.java`)!

  it('chave UUID: o UUID é gerado ao gravar', () => {
    expect(entity('Clientes')).toMatch(/@Id\s+@GeneratedValue\(strategy = GenerationType\.UUID\)/)
  })

  it('chave de texto com valor padrão no banco (SYS_GUID, uuid): também é gerada', () => {
    expect(entity('OraItens')).toMatch(/@Id\s+@GeneratedValue\(strategy = GenerationType\.UUID\)/)
  })

  it('chave de texto SEM padrão (sigla): continua informada por quem cadastra, nunca trocada por um UUID', () => {
    expect(entity('Paises')).toContain('@Id')
    expect(entity('Paises')).not.toContain('GenerationType.UUID')
  })

  it('chave numérica segue como identity', () => {
    expect(entity('Contadores')).toMatch(/@Id\s+@GeneratedValue\(strategy = GenerationType\.IDENTITY\)/)
  })
})

describe('backend Java: excluir um registro apaga antes as linhas filhas (como o app Node)', () => {
  const rawFk = () => ({
    project: { id: 'p1', name: 'Vendas', slug: 'vendas' },
    models: [
      { id: 'mc', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public' },
      { id: 'mp', db_table_name: 'pedidos', display_name: 'Pedidos', db_schema_name: 'public' },
    ],
    fields: [
      f('a1', 'mc', 'id', 'uuid', { is_primary_key: true }), f('a2', 'mc', 'nome', 'text'),
      f('b1', 'mp', 'id', 'uuid', { is_primary_key: true }), f('b2', 'mp', 'cliente_id', 'uuid'),
    ],
    relations: [{ id: 'r1', source_model_id: 'mp', source_field_id: 'b2', target_model_id: 'mc', target_field_id: 'a1', relation_type: 'many_to_one' }],
    views: [],
  })
  const files = generateJavaSpringProject(parseMetaBuilderJSON(rawFk(), 'postgres', { backendStack: 'java-spring', javaGroupId: 'com.vendas' } as any))
  const service = (n: string) => files.get(`backend/src/main/java/com/vendas/services/${n}Service.java`)!

  it('o serviço do pai apaga os filhos que apontam para ele antes de excluir, numa transação', () => {
    const s = service('Clientes')
    expect(s).toContain('@Transactional')
    expect(s).toContain('em.createNativeQuery("DELETE FROM \\"pedidos\\" WHERE \\"cliente_id\\" = :id").setParameter("id", id).executeUpdate();')
    expect(s.indexOf('DELETE FROM')).toBeLessThan(s.indexOf('repository.deleteById(id)'))
  })

  it('quem não tem filhos continua só com o deleteById', () => {
    const s = service('Pedidos')
    expect(s).not.toContain('createNativeQuery')
    expect(s).toContain('repository.deleteById(id)')
  })
})
