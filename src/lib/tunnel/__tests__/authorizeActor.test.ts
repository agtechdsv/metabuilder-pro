import { describe, it, expect, vi, beforeEach } from 'vitest'

let supabaseUser: { id: string } | null = null
vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: supabaseUser } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'p' } }) }) }) }),
  }),
}))
let userRows: any[] = [{ id: 'user-maria', ativo: true }]
vi.mock('../server', () => ({
  serviceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { auth_type: 'database' } }) }) }) }) }),
  getProjectSecretToken: async () => 'segredo-do-projeto-0123456789',
  tunnelCallAuto: async () => ({ success: true, data: userRows }),
}))
vi.mock('../loginSetup', () => ({
  loadLoginSetup: async () => ({ project: { id: 'p' }, schemaName: 'public', auth: { auth_type: 'database', db_table_name: 'usuarios', db_email_column: 'email' }, security: {} }),
}))

import { authorizeProjectActor, isPublishedAppPage, clearLivenessCache } from '../authorize'
import { endUserCookieName, signEndUserSession } from '../sessionToken'

const PID = '123e4567-e89b-42d3-a456-426614174001'
const cookie = () => signEndUserSession({ pid: PID, sub: 'user-maria', row: { id: 'user-maria' } })
const req = (opts: { cookie?: string; referer?: string }) => ({
  cookies: { get: (n: string) => (opts.cookie && n === endUserCookieName(PID) ? { value: opts.cookie } : undefined) },
  headers: new Headers(opts.referer ? { referer: opts.referer } : {}),
}) as any

beforeEach(() => {
  process.env.RUNTIME_SESSION_SECRET = 'segredo-de-teste-0123456789abcdef'
  supabaseUser = null
  userRows = [{ id: 'user-maria', ativo: true }]
  clearLivenessCache()
})

describe('desenvolvedor que também entrou no app como usuário final', () => {
  const dev = { id: 'dev-1' }

  it('na página do app publicado vale o usuário final (testa o app como aquele usuário o vê)', async () => {
    supabaseUser = dev
    const actor = await authorizeProjectActor(req({ cookie: cookie(), referer: 'https://www.metabuilderpro.com/kika-projetos/vendas-pg/clientes' }), PID)
    expect(actor?.kind).toBe('end_user')
  })

  it('nas telas do desenvolvedor (Studio, IDE) continua sendo membro', async () => {
    supabaseUser = dev
    for (const referer of ['https://x.com/admin/kika/vendas/studio/auth', 'https://x.com/workspace', 'https://x.com/ide-local/abc']) {
      expect((await authorizeProjectActor(req({ cookie: cookie(), referer }), PID))?.kind).toBe('member')
    }
  })

  it('sem origem informada nada muda: membro primeiro', async () => {
    supabaseUser = dev
    expect((await authorizeProjectActor(req({ cookie: cookie() }), PID))?.kind).toBe('member')
  })

  it('o cabeçalho de origem não dá poder: sem login do MetaBuilder e sem cookie, ninguém', async () => {
    expect(await authorizeProjectActor(req({ referer: 'https://x.com/admin/a/b/studio' }), PID)).toBeNull()
  })
})

describe('isPublishedAppPage', () => {
  it('reconhece /{workspace}/{projeto}/{tela} e ignora as rotas da plataforma', () => {
    expect(isPublishedAppPage(req({ referer: 'https://x.com/a/b/c?x=1' }))).toBe(true)
    expect(isPublishedAppPage(req({ referer: 'https://x.com/a/b' }))).toBe(false)
    expect(isPublishedAppPage(req({ referer: 'https://x.com/admin/a/b/c' }))).toBe(false)
    expect(isPublishedAppPage(req({ referer: 'lixo' }))).toBe(false)
  })
})

describe('usuário apagado ou desativado no banco do cliente', () => {
  const app = 'https://www.metabuilderpro.com/kika-projetos/vendas-pg/clientes'

  it('perde o acesso (nas páginas do app e no caminho comum) e NÃO vira visitante anônimo', async () => {
    userRows = []
    expect(await authorizeProjectActor(req({ cookie: cookie(), referer: app }), PID)).toBeNull()
    clearLivenessCache()
    userRows = [{ id: 'user-maria', ativo: false }]
    expect(await authorizeProjectActor(req({ cookie: cookie() }), PID)).toBeNull()
  })

  it('o desenvolvedor com um login antigo de usuário final segue sendo desenvolvedor nas telas do Studio', async () => {
    supabaseUser = { id: 'dev-1' }
    userRows = []
    const actor = await authorizeProjectActor(req({ cookie: cookie(), referer: 'https://x.com/admin/kika/vendas/studio/auth' }), PID)
    expect(actor?.kind).toBe('member')
  })

  it('usuário ativo continua entrando', async () => {
    expect((await authorizeProjectActor(req({ cookie: cookie(), referer: app }), PID))?.kind).toBe('end_user')
  })
})
