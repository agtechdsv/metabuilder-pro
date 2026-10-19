import { describe, it, expect } from 'vitest'
import { parseMetaBuilderJSON } from '../parser'
import { generateNodeProject } from '../emitter/node-project'
import { generateJavaSpringProject } from '../emitter/java-spring-project'

/**
 * Excluir um usuário NÃO pode apagar tudo o que ele criou. As colunas criado_por / atualizado_por referenciam o usuário (chave estrangeira),
 * mas o registro (cliente, pedido...) continua existindo: só a referência é anulada. Já as tabelas realmente dependentes (pedidos de um cliente)
 * continuam sendo apagadas junto. Achado ao copiar a exclusão em cascata do app Node para o Java: o Node apagava tudo o que o usuário criou.
 */
const f = (id: string, model: string, col: string, type: string, pk = false) =>
  ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, is_primary_key: pk })

const raw = () => ({
  project: { id: 'p1', name: 'Vendas', slug: 'vendas' },
  models: [
    { id: 'mu', db_table_name: 'usuarios', display_name: 'Usuarios', db_schema_name: 'public' },
    { id: 'mc', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public' },
    { id: 'mp', db_table_name: 'pedidos', display_name: 'Pedidos', db_schema_name: 'public' },
  ],
  fields: [
    f('u1', 'mu', 'id', 'uuid', true), f('u2', 'mu', 'email', 'text'),
    f('c1', 'mc', 'id', 'uuid', true), f('c2', 'mc', 'nome', 'text'), f('c3', 'mc', 'criado_por', 'uuid'),
    f('p1', 'mp', 'id', 'uuid', true), f('p2', 'mp', 'cliente_id', 'uuid'), f('p3', 'mp', 'atualizado_por', 'uuid'),
  ],
  relations: [
    { id: 'r1', from_model_id: 'mc', from_field_id: 'c3', to_model_id: 'mu', to_field_id: 'u1', relation_type: 'many_to_one' },
    { id: 'r2', from_model_id: 'mp', from_field_id: 'p3', to_model_id: 'mu', to_field_id: 'u1', relation_type: 'many_to_one' },
    { id: 'r3', from_model_id: 'mp', from_field_id: 'p2', to_model_id: 'mc', to_field_id: 'c1', relation_type: 'many_to_one' },
  ],
  views: [],
})

describe('exclusão em cascata: colunas de auditoria não apagam registros', () => {
  it('Node (Postgres): excluir usuário anula criado_por/atualizado_por; excluir cliente apaga os pedidos dele', () => {
    const files = generateNodeProject(parseMetaBuilderJSON(raw(), 'postgres'))
    const usuarios = files.get('app/actions/usuarios.ts')!
    expect(usuarios).toContain('UPDATE "clientes" SET "criado_por" = NULL WHERE "criado_por" = $1')
    expect(usuarios).toContain('UPDATE "pedidos" SET "atualizado_por" = NULL WHERE "atualizado_por" = $1')
    expect(usuarios).not.toContain('DELETE FROM "clientes"')
    expect(usuarios).not.toContain('DELETE FROM "pedidos"')
    expect(files.get('app/actions/clientes.ts')!).toContain('DELETE FROM "pedidos" WHERE "cliente_id" = $1')
  })

  it('Node (Oracle): o mesmo, com os binds do Oracle', () => {
    const files = generateNodeProject(parseMetaBuilderJSON(raw(), 'oracle'))
    const usuarios = files.get('app/actions/usuarios.ts')!
    expect(usuarios).toContain('UPDATE "clientes" SET "criado_por" = NULL WHERE "criado_por" = :id')
    expect(usuarios).not.toContain('DELETE FROM "clientes"')
  })

  it('Java: o serviço do usuário anula as referências; o do cliente apaga os pedidos', () => {
    const files = generateJavaSpringProject(parseMetaBuilderJSON(raw(), 'postgres', { backendStack: 'java-spring', javaGroupId: 'com.vendas' } as any))
    const svc = (n: string) => files.get(`backend/src/main/java/com/vendas/services/${n}Service.java`)!
    expect(svc('Usuarios')).toContain('UPDATE \\"clientes\\" SET \\"criado_por\\" = NULL WHERE \\"criado_por\\" = :id')
    expect(svc('Usuarios')).not.toContain('DELETE FROM')
    expect(svc('Clientes')).toContain('DELETE FROM \\"pedidos\\" WHERE \\"cliente_id\\" = :id')
  })
})
