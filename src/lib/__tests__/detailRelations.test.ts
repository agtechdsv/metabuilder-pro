import { describe, it, expect } from 'vitest'
import { isUntouchedAutoDetail } from '../detailRelations'

describe('isUntouchedAutoDetail', () => {
  const auto = { id: 'x', model_name: 'pedidos', _isNew: true, _auto: true, status: 'Pendente', data_pedido: '2026-10-06' }

  it('linha em branco criada sozinha pelo formulário, sem toque: não deve ser gravada', () => {
    expect(isUntouchedAutoDetail(auto)).toBe(true)
  })

  it('o usuário digitou ou escolheu algo nela: grava', () => {
    expect(isUntouchedAutoDetail({ ...auto, _touched: true })).toBe(false)
  })

  it('o usuário adicionou itens dentro dela: grava (os itens precisam de um pedido)', () => {
    expect(isUntouchedAutoDetail({ ...auto, _details: [{ id: 'temp-1', _isNew: true }] })).toBe(false)
    expect(isUntouchedAutoDetail({ ...auto, _details: [] })).toBe(true)
  })

  it('linha criada pelo botão "+" do usuário (sem a marca _auto) ou já existente no banco: nunca é afetada', () => {
    expect(isUntouchedAutoDetail({ id: 'temp-1', model_name: 'pedidos', _isNew: true })).toBe(false)
    expect(isUntouchedAutoDetail({ id: 5, model_name: 'pedidos', _auto: true })).toBe(false)
    expect(isUntouchedAutoDetail(null)).toBe(false)
  })
})
