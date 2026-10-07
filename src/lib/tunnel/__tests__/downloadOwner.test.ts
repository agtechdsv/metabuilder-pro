import { describe, it, expect, vi, beforeEach } from 'vitest'

let supabaseUser: { id: string } | null = null
let projectVisible = true
vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: supabaseUser } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: projectVisible ? { id: 'p' } : null }) }) }) }),
  }),
}))
let publicProject = false
vi.mock('../server', () => ({
  serviceClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: publicProject ? { auth_type: 'none' } : { auth_type: 'database' } }) }) }) }),
  }),
}))

import { resolveDownloadOwner, clearPublicCache } from '../authorize'
import { endUserCookieName, signEndUserSession } from '../sessionToken'

const PID = '123e4567-e89b-42d3-a456-426614174000'
const USER_UUID = '8f14e45f-ceea-467a-9575-e6c1a1b7c0aa'
const reqWith = (cookie?: string) => ({ cookies: { get: (n: string) => (cookie && n === endUserCookieName(PID) ? { value: cookie } : undefined) }, headers: new Headers() }) as any

beforeEach(() => {
  process.env.RUNTIME_SESSION_SECRET = 'segredo-de-teste-0123456789abcdef'
  supabaseUser = null; projectVisible = true; publicProject = false; clearPublicCache()
})

describe('resolveDownloadOwner', () => {
  it('usuário final: o dono é o id da sessão assinada (UUID)', async () => {
    const cookie = signEndUserSession({ pid: PID, sub: USER_UUID })
    expect(await resolveDownloadOwner(reqWith(cookie), PID)).toEqual({ id: USER_UUID, kind: 'end_user' })
  })

  it('usuário final cujo id não é UUID recebe um aviso claro (a coluna não aceita)', async () => {
    const cookie = signEndUserSession({ pid: PID, sub: '42' })
    const r = await resolveDownloadOwner(reqWith(cookie), PID)
    expect(r && 'error' in r).toBe(true)
  })

  it('sem cookie de usuário final: membro do projeto', async () => {
    supabaseUser = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }
    expect(await resolveDownloadOwner(reqWith(), PID)).toEqual({ id: supabaseUser.id, kind: 'member' })
  })

  it('cookie de OUTRO projeto ou adulterado não vale; sem ninguém e projeto fechado: null', async () => {
    const other = signEndUserSession({ pid: '99999999-9999-4999-8999-999999999999', sub: USER_UUID })
    expect(await resolveDownloadOwner(reqWith(other), PID)).toBeNull()
    expect(await resolveDownloadOwner(reqWith('lixo.lixo'), PID)).toBeNull()
  })

  it('projeto sem login: visitante usa o dono anônimo', async () => {
    publicProject = true
    expect(await resolveDownloadOwner(reqWith(), PID)).toEqual({ id: '00000000-0000-0000-0000-000000000000', kind: 'anonymous' })
  })
})
