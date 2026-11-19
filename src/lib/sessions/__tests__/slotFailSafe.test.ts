import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// P3 do roteiro (banco indisponível ou função ausente): o servidor devolve null, o chamador deixa o usuário passar e o erro vai ao log com [vagas]
const rpc = vi.fn()
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc }) }))

import { claimSlot } from '../slotService'
import type { SlotInput } from '../slotCore'

const input: SlotInput = {
  userId: '00000000-0000-4000-8000-000000000001', kind: 'web', deviceId: '00000000-0000-4000-8000-000000000002',
  sessionId: '00000000-0000-4000-8000-000000000003', label: 'Chrome · Windows', city: null, region: null, country: null, ipHash: 'x',
} as SlotInput

describe('vagas de sessão: falha segura', () => {
  let err: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-de-teste'
    rpc.mockReset()
    err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => err.mockRestore())

  it('função ausente no banco: devolve null e registra [vagas]', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'function public.mb_claim_device_slot does not exist' } })
    await expect(claimSlot(input)).resolves.toBeNull()
    expect(err).toHaveBeenCalledWith(expect.stringContaining('[vagas]'), expect.stringContaining('does not exist'))
  })

  it('banco fora do ar (exceção): devolve null e registra [vagas]', async () => {
    rpc.mockRejectedValue(new Error('fetch failed'))
    await expect(claimSlot(input)).resolves.toBeNull()
    expect(err).toHaveBeenCalledWith(expect.stringContaining('[vagas]'), 'fetch failed')
  })

  it('resposta fora do formato: devolve null', async () => {
    rpc.mockResolvedValue({ data: 'lixo', error: null })
    await expect(claimSlot(input)).resolves.toBeNull()
  })

  it('sem a chave de serviço no ambiente: devolve null sem tentar o banco', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    await expect(claimSlot(input)).resolves.toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })
})
