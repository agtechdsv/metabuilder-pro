import { describe, it, expect } from 'vitest'
import { leastPrivilegeSql } from '../dbRole'

describe('script do usuário do Agente com privilégio mínimo', () => {
  it('PostgreSQL: sem poderes de administrador, só dados, com limite de tempo e logs pré-criados', () => {
    const sql = leastPrivilegeSql({ engine: 'postgres', user: 'mb_agent', database: 'crm', schema: 'public' })
    expect(sql).toContain('NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS')
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "public" TO "mb_agent"')
    expect(sql).toContain('GRANT CONNECT ON DATABASE "crm"')
    expect(sql).toContain("statement_timeout = '300s'")
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "public".mb_logs')
    // nada que dê poder sobre a estrutura
    for (const perigo of ['SUPERUSER ', 'GRANT ALL', 'CREATE ON SCHEMA', 'WITH GRANT OPTION', 'pg_read_server_files']) expect(sql.replace('NOSUPERUSER', ''), perigo).not.toContain(perigo)
  })

  it('Oracle: só CREATE SESSION + dados nas tabelas do dono, por sinônimo', () => {
    const sql = leastPrivilegeSql({ engine: 'oracle', user: 'mb_agent', schema: 'crm' })
    expect(sql).toContain('GRANT CREATE SESSION TO MB_AGENT')
    expect(sql).toContain("owner = 'CRM'")
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON')
    for (const perigo of ['GRANT DBA', 'GRANT RESOURCE', 'GRANT CONNECT', 'ANY TABLE', 'WITH ADMIN OPTION', 'UNLIMITED TABLESPACE']) expect(sql, perigo).not.toContain(perigo)
  })

  it('nomes inválidos (tentativa de injetar SQL) voltam ao padrão', () => {
    const sql = leastPrivilegeSql({ engine: 'postgres', user: 'x"; DROP ROLE postgres; --', database: 'a b', schema: 'p;q' })
    expect(sql).not.toContain('DROP ROLE')
    expect(sql).toContain('"mb_agent"')
    expect(sql).toContain('"meu_banco"')
    expect(sql).toContain('"public"')
  })
})
