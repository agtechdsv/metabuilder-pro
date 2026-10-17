import { describe, it, expect, beforeEach } from 'vitest'
import { accessForSession, clearTableAccessCache, clearWriteRestrictionCache, clearGroupNamesCache, groupNamesForSession } from '../server'

/**
 * Plataforma web (runtime do Studio): a exceção "por grupo" das regras por linha usa o grupo do usuário final
 * (project_user_roles + project_roles, ou a coluna do grupo no cadastro do usuário no banco legado).
 */
const PID = 'p-1'
const REGRA = { id: 'r1', column: 'criado_por', op: 'eq', source: 'user.attr', attr: 'id', bypass: { source: 'user.group', values: ['Administrador'] } }

function mundo(over: { links?: any[]; roles?: any[]; ui?: any; policy?: any } = {}) {
  const calls: string[] = []
  const data: Record<string, any> = {
    models: [{ db_table_name: 'clientes', can_create: true, can_update: true, can_delete: true, row_policy: over.policy === undefined ? { rules: [REGRA] } : over.policy }],
    project_auth_config: { ui_config: over.ui || {} },
    project_user_roles: over.links ?? [{ role_id: 'r-adm', external_user_id: '5' }],
    project_roles: over.roles ?? [{ id: 'r-adm', name: 'Administrador' }, { id: 'r-fun', name: 'Funcionária' }],
    project_role_permissions: [],
    ui_views: [],
  }
  const client = {
    from: (table: string) => {
      calls.push(table)
      const filters: Array<(r: any) => boolean> = []
      const apply = () => {
        const rows = data[table]
        const list = Array.isArray(rows) ? rows : rows ? [rows] : []
        return list.filter((r: any) => filters.every(f => f(r)))
      }
      const chain: any = {
        select: () => chain,
        eq: (col: string, val: unknown) => { if (table === 'project_roles' || table === 'project_user_roles') filters.push(r => col === 'project_id' || String(r[col]) === String(val)); return chain },
        in: (col: string, vals: unknown[]) => { filters.push(r => vals.map(String).includes(String(r[col]))); return chain },
        maybeSingle: async () => ({ data: Array.isArray(data[table]) ? data[table][0] ?? null : data[table] ?? null, error: null }),
        then: (res: any) => res({ data: apply(), error: null }),
      }
      return chain
    },
  } as any
  return { client, calls }
}
const sessao = (sub = '5', row: Record<string, unknown> = {}) => ({ sub, email: 'a@x.com', row: { id: sub, ...row } })

describe('exceção por grupo — plataforma web', () => {
  beforeEach(() => { clearTableAccessCache(); clearWriteRestrictionCache(); clearGroupNamesCache() })

  it('quem está no grupo da lista de exceção não sofre a regra por linha', async () => {
    const { client } = mundo()
    const a = await accessForSession(PID, sessao(), { client })
    expect(a.policies).toEqual([]) // Administrador: sem filtro
  })

  it('quem está em outro grupo continua filtrado', async () => {
    const { client } = mundo({ links: [{ role_id: 'r-fun', external_user_id: '5' }] })
    const a = await accessForSession(PID, sessao(), { client })
    expect(a.policies).toHaveLength(1)
  })

  it('sem vínculo de grupo, ou visitante sem sessão, continua filtrado (falha fechada)', async () => {
    const semGrupo = await accessForSession(PID, sessao(), { client: mundo({ links: [] }).client })
    expect(semGrupo.policies).toHaveLength(1)
    clearGroupNamesCache()
    const anon = await accessForSession(PID, { sub: 'anon:1.1.1.1' }, { client: mundo().client })
    expect(anon.policies).toHaveLength(1)
  })

  it('banco legado: o grupo vem da coluna do usuário (sync_legacy_groups)', async () => {
    const { client } = mundo({ links: [], ui: { sync_legacy_groups: true, db_user_role_column: 'perfil_id' } })
    const a = await accessForSession(PID, sessao('5', { perfil_id: 'r-adm' }), { client })
    expect(a.policies).toEqual([])
    expect(await groupNamesForSession(PID, sessao('5', { perfil_id: 'r-adm' }), { client })).toEqual(['Administrador'])
  })

  it('erro ao ler o grupo: ninguém escapa da regra', async () => {
    const quebrado = { from: (t: string) => { if (t === 'project_roles') throw new Error('falhou'); return mundo().client.from(t) } } as any
    const a = await accessForSession(PID, sessao(), { client: quebrado })
    expect(a.policies).toHaveLength(1)
  })

  it('só consulta o grupo quando alguma regra tem exceção por grupo (os outros projetos não pagam nada)', async () => {
    const semGrupo = mundo({ policy: { rules: [{ ...REGRA, bypass: { source: 'user.email', values: ['a@x.com'] } }] } })
    await accessForSession(PID, sessao(), { client: semGrupo.client })
    expect(semGrupo.calls).not.toContain('project_roles')
    const comGrupo = mundo()
    clearGroupNamesCache(); clearTableAccessCache()
    await accessForSession(PID, sessao(), { client: comGrupo.client })
    expect(comGrupo.calls).toContain('project_roles')
  })
})
