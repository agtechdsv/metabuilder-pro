import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

// CommonJS do Agente CLI (também testado fora do pkg)
const require = createRequire(import.meta.url)
const { resolveSystemRecipientEmails } = require('../../../../cli/recipients.js') as {
  resolveSystemRecipientEmails: (a: any) => Promise<string>
}

// o mesmo desenho do projeto Vendas PG: grupos do cliente em perfis / perfis_usuarios, login em usuarios
const legacyConfig = {
  auth: {
    db_table_name: 'usuarios', db_email_column: 'email', sync_legacy_groups: true,
    groups_table: 'perfis', groups_name_column: 'nome',
    user_roles_table: 'perfis_usuarios', user_roles_user_col: 'usuario_id', user_roles_role_col: 'perfil_id',
  },
  roles: [], userRoles: [],
}

function fakeDb() {
  const calls: { sql: string; params: any[] }[] = []
  const query = async (sql: string, params: any[]) => {
    calls.push({ sql, params })
    if (/FROM "perfis" WHERE/.test(sql)) return params[0] === 'Administrador' ? [{ id: 'p1', nome: 'Administrador' }] : []
    if (/FROM "perfis_usuarios"/.test(sql)) return params[0] === 'p1' ? [{ usuario_id: 'u1' }, { usuario_id: 'u2' }, { usuario_id: 'u1' }] : []
    if (/FROM "usuarios" WHERE "id" IN/.test(sql)) {
      const all: Record<string, string> = { u1: 'ana@x.com', u2: 'beto@x.com', u3: 'caio@x.com' }
      return params.map((id: string) => ({ email: all[id] })).filter((r: any) => r.email)
    }
    return []
  }
  return { calls, query }
}

describe('destinatários "usuários e grupos do sistema" (e-mail do BPM)', () => {
  it('grupo do cliente com "Enviar para todos": acha o grupo, os membros (sem repetir) e os e-mails', async () => {
    const { query, calls } = fakeDb()
    const out = await resolveSystemRecipientEmails({ data: { emailGroupsUsers: { Administrador: 'all' } }, config: legacyConfig, query })
    expect(out).toBe('ana@x.com,beto@x.com')
    // usa as colunas da configuração, não nomes fixos
    expect(calls[0].sql).toContain('"perfis" WHERE "nome" = $1')
    expect(calls[1].sql).toContain('SELECT "usuario_id" FROM "perfis_usuarios" WHERE "perfil_id" = $1')
  })

  it('grupo do cliente com perfil direto no usuário (1 para N): lê os usuários pela coluna de perfil', async () => {
    const calls: string[] = []
    const query = async (sql: string, params: any[]) => {
      calls.push(sql)
      if (/FROM "perfis" WHERE/.test(sql)) return [{ id: 'p1' }]
      if (/SELECT "id" FROM "usuarios" WHERE "perfil_id"/.test(sql)) return [{ id: 'u1' }, { id: 'u2' }]
      if (/FROM "usuarios" WHERE "id" IN/.test(sql)) return params.map((id: string) => ({ email: id + '@x.com' }))
      return []
    }
    const config = { auth: { db_table_name: 'usuarios', db_email_column: 'email', sync_legacy_groups: true, groups_table: 'perfis', groups_name_column: 'nome', user_groups_type: '1_to_n', user_role_column: 'perfil_id' } }
    expect(await resolveSystemRecipientEmails({ data: { emailGroupsUsers: { Gerente: 'all' } }, config, query })).toBe('u1@x.com,u2@x.com')
    expect(calls.some((c) => /perfis_usuarios/.test(c))).toBe(false)
  })

  it('usuários escolhidos um a um (lista de ids) e grupo juntos', async () => {
    const { query } = fakeDb()
    const out = await resolveSystemRecipientEmails({ data: { emailGroupsUsers: { Administrador: 'all', Gerente: ['u3'] } }, config: legacyConfig, query })
    expect(out.split(',').sort()).toEqual(['ana@x.com', 'beto@x.com', 'caio@x.com'])
  })

  it('perfis da plataforma (sem grupos do cliente): usa roles e userRoles do servidor', async () => {
    const { query } = fakeDb()
    const config = {
      auth: { db_table_name: 'usuarios', db_email_column: 'email', sync_legacy_groups: false },
      roles: [{ id: 'r1', name: 'Gerente' }], userRoles: [{ role_id: 'r1', external_user_id: 'u2' }, { role_id: 'r9', external_user_id: 'u1' }],
    }
    expect(await resolveSystemRecipientEmails({ data: { emailGroupsUsers: { Gerente: 'all' } }, config, query })).toBe('beto@x.com')
  })

  it('grupo inexistente ou sem membros: vazio, com aviso, sem derrubar', async () => {
    const { query } = fakeDb()
    const warns: string[] = []
    const out = await resolveSystemRecipientEmails({ data: { emailGroupsUsers: { Fantasma: 'all' } }, config: legacyConfig, query, log: { warn: (m: string) => warns.push(m) } })
    expect(out).toBe('')
    expect(warns.join(' ')).toContain('Fantasma')
  })

  it('sem configuração do servidor: não quebra e devolve vazio', async () => {
    const { query } = fakeDb()
    expect(await resolveSystemRecipientEmails({ data: { emailGroupsUsers: { Administrador: 'all' } }, config: null, query })).toBe('')
  })

  it('nome de tabela ou coluna fora do padrão de identificador é ignorado (vem de configuração)', async () => {
    const { query, calls } = fakeDb()
    const config = { ...legacyConfig, auth: { ...legacyConfig.auth, groups_table: 'perfis"; DROP TABLE x; --' } }
    // sem tabela de grupos válida cai nos perfis da plataforma (vazios aqui)
    expect(await resolveSystemRecipientEmails({ data: { emailGroupsUsers: { Administrador: 'all' } }, config, query })).toBe('')
    expect(calls.some((c) => /DROP/.test(c.sql))).toBe(false)
  })
})
