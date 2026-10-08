import { describe, it, expect, vi, beforeEach } from 'vitest'

const authorize = vi.fn()
const buildProps = vi.fn()

vi.mock('@/lib/tunnel/authorize', () => ({ authorizeProjectActor: (...a: any[]) => authorize(...a) }))
vi.mock('@/lib/build-view-props', () => ({ buildViewProps: (...a: any[]) => buildProps(...a) }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'p1' }, error: null }) }) }) }) }),
}))

import { NextRequest } from 'next/server'
import { GET } from '../route'

const call = (qs: string) => GET(new NextRequest('http://x/api/runtime/slot-props' + qs))

beforeEach(() => {
  authorize.mockReset(); buildProps.mockReset()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
})

describe('GET /api/runtime/slot-props', () => {
  it('sem sessão de membro, de usuário final nem projeto aberto: 401, sem montar a estrutura da tela', async () => {
    authorize.mockResolvedValue(null)
    expect((await call('?projectId=p1&slug=clientes')).status).toBe(401)
    expect(buildProps).not.toHaveBeenCalled()
  })

  it('com acesso, devolve as props', async () => {
    authorize.mockResolvedValue({ kind: 'end_user', session: { pid: 'p1', sub: '5' } })
    buildProps.mockResolvedValue({ modelName: 'clientes' })
    const res = await call('?projectId=p1&slug=clientes')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ modelName: 'clientes' })
  })

  it('parâmetros faltando: 400 (antes de conferir quem pede)', async () => {
    expect((await call('?projectId=p1')).status).toBe(400)
  })
})
