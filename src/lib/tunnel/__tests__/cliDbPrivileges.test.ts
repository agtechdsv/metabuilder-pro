import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

const req = createRequire(import.meta.url)
const { checkDbPrivileges, describePrivileges } = req('../../../../cli/dbPrivileges.js') as any

/** Banco de mentira: responde pela consulta que o Agente faz. */
const pgDb = (role: any, canCreate: boolean, owned: number) => async (sql: string) => {
  if (/pg_roles/.test(sql)) return [role]
  if (/has_schema_privilege/.test(sql)) return [{ can_create: canCreate }]
  if (/pg_tables/.test(sql)) return [{ owned }]
  throw new Error('consulta inesperada: ' + sql)
}
const MIN = { rolsuper: false, rolcreaterole: false, rolcreatedb: false, rolbypassrls: false }

describe('poder do usuário do banco (PostgreSQL)', () => {
  it('usuário de privilégio mínimo: ok, sem aviso', async () => {
    const r = await checkDbPrivileges({ dbType: 'postgres', query: pgDb(MIN, false, 0) })
    expect(r).toEqual({ level: 'ok', findings: [] })
    expect(describePrivileges(r)).toBeNull()
  })

  it('superusuário é perigo; dono das tabelas e criar objetos é só aviso', async () => {
    const danger = await checkDbPrivileges({ dbType: 'postgres', query: pgDb({ ...MIN, rolsuper: true }, true, 12) })
    expect(danger.level).toBe('danger')
    expect(danger.findings).toEqual(expect.arrayContaining(['superuser', 'can_create', 'owns_tables']))
    expect(describePrivileges(danger)).toContain('SUPERUSUÁRIO')

    const warn = await checkDbPrivileges({ dbType: 'postgres', query: pgDb(MIN, true, 12) })
    expect(warn).toEqual({ level: 'warn', findings: ['can_create', 'owns_tables'] })
    expect(describePrivileges(warn)).toContain('mais poder que o necessário')
  })

  it('ignora bypassrls e createrole como perigo', async () => {
    expect((await checkDbPrivileges({ dbType: 'postgres', query: pgDb({ ...MIN, rolbypassrls: true }, false, 0) })).level).toBe('danger')
    expect((await checkDbPrivileges({ dbType: 'postgres', query: pgDb({ ...MIN, rolcreaterole: true }, false, 0) })).level).toBe('danger')
  })

  it('se a consulta falhar, não afirma nada (unknown) e nunca lança', async () => {
    const r = await checkDbPrivileges({ dbType: 'postgres', query: async () => { throw new Error('sem permissão') } })
    expect(r).toEqual({ level: 'unknown', findings: [] })
    expect(describePrivileges(r)).toBeNull()
  })
})

describe('poder do usuário do banco (Oracle)', () => {
  const ora = (privs: string[], roles: string[], owned: number) => async (sql: string) => {
    if (/session_privs/i.test(sql)) return privs.map(p => ({ PRIVILEGE: p }))
    if (/session_roles/i.test(sql)) return roles.map(r => ({ ROLE: r }))
    if (/user_tables/i.test(sql)) return [{ OWNED: owned }]
    throw new Error('inesperada')
  }

  it('só CREATE SESSION e sem tabelas próprias: ok', async () => {
    expect(await checkDbPrivileges({ dbType: 'oracle', query: ora(['CREATE SESSION'], [], 0) })).toEqual({ level: 'ok', findings: [] })
  })

  it('papel DBA ou privilégio ANY é perigo; dono de tabelas com CREATE TABLE é aviso', async () => {
    expect((await checkDbPrivileges({ dbType: 'oracle', query: ora(['CREATE SESSION'], ['DBA'], 0) })).level).toBe('danger')
    expect((await checkDbPrivileges({ dbType: 'oracle', query: ora(['SELECT ANY TABLE'], [], 0) })).level).toBe('danger')
    const dono = await checkDbPrivileges({ dbType: 'oracle', query: ora(['CREATE SESSION', 'CREATE TABLE'], ['RESOURCE'], 12) })
    expect(dono).toEqual({ level: 'warn', findings: ['can_create', 'owns_tables'] })
  })
})
