import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUser = vi.fn()
const visibleProject = vi.fn()
const serviceFrom = vi.fn()

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: visibleProject }) }) }),
  }),
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: serviceFrom }) }))

import { POST } from '../route'

const call = (body: any) => POST(new Request('http://x/api/metadata/reconcile', { method: 'POST', body: JSON.stringify(body) }))
const body = { projectId: 'p1', fixes: [{ fieldId: 'f1', newDataType: 'text', newUiWidget: 'text' }] }

beforeEach(() => {
  getUser.mockReset(); visibleProject.mockReset(); serviceFrom.mockReset()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
})

describe('POST /api/metadata/reconcile', () => {
  it('sem login: 401, e nada é tocado com a chave de serviço', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    expect((await call(body)).status).toBe(401)
    expect(serviceFrom).not.toHaveBeenCalled()
  })

  it('logado, mas sem acesso ao projeto: 403', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    visibleProject.mockResolvedValue({ data: null })
    expect((await call(body)).status).toBe(403)
    expect(serviceFrom).not.toHaveBeenCalled()
  })
})
