import { describe, it, expect } from 'vitest'
import { findBlockingTable, isForeignKeyError } from '../fkError'

const TABLES = ['clientes', 'pedidos', 'itens_pedido', 'perfis_usuarios']

describe('tabela que impede a exclusão', () => {
  it('PostgreSQL em inglês', () => {
    const msg = 'update or delete on table "clientes" violates foreign key constraint "pedidos_cliente_id_fkey" on table "pedidos"'
    expect(findBlockingTable(msg, TABLES, 'clientes')).toBe('pedidos')
  })

  it('PostgreSQL em português', () => {
    const msg = 'atualização ou exclusão em tabela "clientes" viola restrição de chave estrangeira "pedidos_cliente_id_fkey" em "pedidos"'
    expect(findBlockingTable(msg, TABLES, 'clientes')).toBe('pedidos')
    expect(isForeignKeyError(msg)).toBe(true)
  })

  it('Oracle: só vem o nome da restrição; vale a tabela de nome mais longo contido nele', () => {
    const msg = 'ORA-02292: integrity constraint (CRM.FK_ITENS_PEDIDO_PEDIDO) violated - child record found'
    expect(findBlockingTable(msg, TABLES, 'pedidos')).toBe('itens_pedido')
    expect(isForeignKeyError(msg)).toBe(true)
  })

  it('não adivinha: sem pista na mensagem devolve null', () => {
    expect(findBlockingTable('violates foreign key constraint', TABLES, 'clientes')).toBeNull()
    expect(findBlockingTable('erro qualquer', TABLES, 'clientes')).toBeNull()
  })
})
