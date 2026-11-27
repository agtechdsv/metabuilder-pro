import { describe, it, expect } from 'vitest'
import { endUserMayOpenAutomations } from '../automationsAccess'

/** Cliente de mentira: cada tabela é uma lista de linhas; select/eq/limit/maybeSingle filtram como o PostgREST. */
function fake(tables: Record<string, any[]>, boom?: string) {
  return {
    from(name: string) {
      if (boom === name) throw new Error('falhou')
      let rows = [...(tables[name] || [])]
      const b: any = {
        select: () => b,
        eq: (col: string, v: any) => { rows = rows.filter(r => String(r[col]) === String(v)); return b },
        limit: () => b,
        maybeSingle: async () => ({ data: rows[0] ?? null }),
      }
      return b
    },
  } as any
}

const P = 'proj-1'
const V = 'view-auto'
const session = (u: any) => encodeURIComponent(JSON.stringify(u))
const withLogin = { project_auth_config: [{ project_id: P, auth_type: 'database', ui_config: {} }] }

describe('acesso do usuário final às Automações (negado por padrão)', () => {
  it('projeto sem login: todos entram', async () => {
    expect(await endUserMayOpenAutomations(fake({}), { projectId: P, viewId: V })).toBe(true)
    expect(await endUserMayOpenAutomations(fake({ project_auth_config: [{ project_id: P, auth_type: 'none' }] }), { projectId: P, viewId: V })).toBe(true)
  })

  it('com login e sem sessão: nega', async () => {
    expect(await endUserMayOpenAutomations(fake(withLogin), { projectId: P, viewId: V })).toBe(false)
    expect(await endUserMayOpenAutomations(fake(withLogin), { projectId: P, viewId: V, sessionCookie: '' })).toBe(false)
  })

  it('só o perfil com can_read = true na tela entra; perfil sem a linha, ou com can_read = false, não', async () => {
    const db = {
      ...withLogin,
      project_user_roles: [{ project_id: P, external_user_id: '1', role_id: 'admin' }, { project_id: P, external_user_id: '2', role_id: 'gerente' }, { project_id: P, external_user_id: '3', role_id: 'func' }],
      project_role_permissions: [{ id: 'a', role_id: 'admin', view_id: V, can_read: true }, { id: 'g', role_id: 'gerente', view_id: V, can_read: false }],
    }
    const ok = (id: string) => endUserMayOpenAutomations(fake(db), { projectId: P, viewId: V, sessionCookie: session({ id }) })
    expect(await ok('1')).toBe(true)
    expect(await ok('2')).toBe(false)
    expect(await ok('3')).toBe(false)
    expect(await ok('99')).toBe(false) // usuário sem perfil
  })

  it('a permissão de outra tela não vale', async () => {
    const db = { ...withLogin, project_user_roles: [{ project_id: P, external_user_id: '1', role_id: 'admin' }], project_role_permissions: [{ id: 'x', role_id: 'admin', view_id: 'outra-tela', can_read: true }] }
    expect(await endUserMayOpenAutomations(fake(db), { projectId: P, viewId: V, sessionCookie: session({ id: '1' }) })).toBe(false)
  })

  it('perfil guardado na própria linha do usuário (grupos legados) também vale', async () => {
    const db = {
      project_auth_config: [{ project_id: P, auth_type: 'database', ui_config: { sync_legacy_groups: true, db_user_role_column: 'perfil_id' } }],
      project_role_permissions: [{ id: 'a', role_id: 'r1', view_id: V, can_read: true }],
    }
    expect(await endUserMayOpenAutomations(fake(db), { projectId: P, viewId: V, sessionCookie: session({ id: '1', perfil_id: 'r1' }) })).toBe(true)
    expect(await endUserMayOpenAutomations(fake(db), { projectId: P, viewId: V, sessionCookie: session({ id: '1', perfil_id: 'r2' }) })).toBe(false)
  })

  it('falha fechada: cookie ilegível ou erro ao ler o banco negam', async () => {
    expect(await endUserMayOpenAutomations(fake(withLogin), { projectId: P, viewId: V, sessionCookie: '%%%nao-e-json' })).toBe(false)
    expect(await endUserMayOpenAutomations(fake(withLogin), { projectId: P, viewId: V, sessionCookie: session('texto') })).toBe(false)
    expect(await endUserMayOpenAutomations(fake(withLogin, 'project_role_permissions'), { projectId: P, viewId: V, sessionCookie: session({ id: '1' }) })).toBe(false)
    expect(await endUserMayOpenAutomations(fake(withLogin, 'project_auth_config'), { projectId: P, viewId: V })).toBe(false)
  })
})
