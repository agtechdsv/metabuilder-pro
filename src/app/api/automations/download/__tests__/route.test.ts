import { describe, it, expect, vi, beforeEach } from 'vitest'

const apply = vi.fn()
vi.mock('@/lib/tunnel/automationDownload', () => ({ applyAutomationDownload: (...a: any[]) => apply(...a) }))

import { POST } from '../route'

const PID = '123e4567-e89b-42d3-a456-426614174000'
const call = (body: any) => POST(new Request('http://x/api/automations/download', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }) as any)

beforeEach(() => { apply.mockReset() })

describe('POST /api/automations/download', () => {
  it('corpo ilegível: 400, sem chamar nada', async () => {
    expect((await call('{quebrado')).status).toBe(400)
    expect(apply).not.toHaveBeenCalled()
  })

  it('entrega ok: devolve quantos receberam', async () => {
    apply.mockResolvedValue({ ok: true, delivered: 3 })
    const res = await call({ projectId: PID, command: { a: 1 } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, delivered: 3 })
    expect(apply).toHaveBeenCalledWith(PID, { a: 1 })
  })

  it('o servidor repassa o status e a mensagem de quem recusou (assinatura, validação)', async () => {
    apply.mockResolvedValue({ ok: false, status: 401, error: 'Assinatura inválida.' })
    const res = await call({ projectId: PID, command: {} })
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Assinatura inválida.')
    apply.mockResolvedValue({ ok: false, status: 400, error: 'Sem destinatários.' })
    expect((await call({ projectId: PID, command: {} })).status).toBe(400)
  })
})
