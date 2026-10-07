import { describe, it, expect, vi } from 'vitest'
import { fetchBiQuery } from '../queryClient'

const reply = (status: number, body: any) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })) as any

describe('fetchBiQuery', () => {
  it('sucesso devolve o resultado do banco como veio', async () => {
    const r = await fetchBiQuery({ widgetId: 'w' }, reply(200, { success: true, data: [{ bi_value: 1 }] }))
    expect(r).toEqual({ success: true, data: [{ bi_value: 1 }] })
  })

  it('erro de SQL do banco (HTTP 200, success false) NÃO é falha do servidor: o painel pode tentar o caminho alternativo', async () => {
    const r = await fetchBiQuery({}, reply(200, { success: false, error: 'coluna inexistente' }))
    expect(r.success).toBe(false)
    expect(r.serverError).toBeUndefined()
  })

  it('negado pela regra de acesso leva o motivo', async () => {
    const r = await fetchBiQuery({}, reply(403, { error: 'x', code: 'denied', denied: { code: 'no_viewer' } }))
    expect(r).toMatchObject({ success: false, serverError: true, code: 'denied', denied: { code: 'no_viewer' } })
  })

  it('401, 504 e rede viram falha do servidor com código', async () => {
    expect(await fetchBiQuery({}, reply(401, {}))).toMatchObject({ serverError: true, code: 'unauthorized' })
    expect(await fetchBiQuery({}, reply(504, {}))).toMatchObject({ serverError: true, code: 'timeout' })
    expect(await fetchBiQuery({}, vi.fn().mockRejectedValue(new Error('off')) as any)).toMatchObject({ serverError: true, code: 'network' })
  })
})
