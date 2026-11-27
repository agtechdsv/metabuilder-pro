import { describe, it, expect } from 'vitest'
import { publicLoginAuth, publicLoginProject, publicLoginVisual, LOGIN_VISUAL_KEYS } from '../loginPublic'

const project = {
  id: 'p1', workspace_id: 'w1', name: 'Vendas PG', slug: 'vendas-pg', description: 'Sistema', icon: 'Calculator', is_active: true, db_type: 'postgres',
  secret_token: 'TOKEN-SECRETO', theme_config: { login_logo_url: 'x.png', show_in_portal: true },
  navigation: [{ id: 'v1', label: 'Folha de pagamento', target: 'folha' }],
  workspaces: { id: 'w1', name: 'Kika', slug: 'kika', owner_id: 'DONO-UUID', theme_config: { portal_logo_url: 'l.png' }, custom_domain: 'x.com' },
}

const auth = {
  project_id: 'p1', auth_type: 'database', db_table_name: 'usuarios', db_email_column: 'email', db_password_column: 'hash_senha', db_password_hash_type: 'bcrypt',
  ldap_server_url: 'ldap://interno:389', ldap_base_dn: 'dc=x', ui_config: { db_groups_table: 'perfis' }, db_display_name_column: 'nome', sync_legacy_groups: true, db_groups_table: 'perfis',
}

describe('tela de login: só vai ao navegador o que ela usa', () => {
  it('projeto: identidade e tema, sem o menu, sem dono e sem o token (relay ligado)', () => {
    const p = publicLoginProject(project, true)
    expect(p).toEqual({
      id: 'p1', name: 'Vendas PG', slug: 'vendas-pg', description: 'Sistema', icon: 'Calculator',
      theme_config: { login_logo_url: 'x.png', show_in_portal: true },
      workspaces: { slug: 'kika', name: 'Kika', theme_config: { portal_logo_url: 'l.png' } },
    })
    const text = JSON.stringify(p)
    for (const secret of ['TOKEN-SECRETO', 'DONO-UUID', 'Folha de pagamento', 'navigation', 'owner_id', 'workspace_id', 'custom_domain', 'db_type']) expect(text).not.toContain(secret)
  })

  it('sem o relay (modo antigo) o token vai, porque o navegador fala direto com o túnel; o menu continua fora', () => {
    const p = publicLoginProject(project, false)
    expect(p.secret_token).toBe('TOKEN-SECRETO')
    expect(JSON.stringify(p)).not.toContain('Folha de pagamento')
  })

  it('workspace em lista (formato do join) também é aceito', () => {
    const p: any = publicLoginProject({ ...project, workspaces: [project.workspaces] }, true)
    expect(p.workspaces).toEqual({ slug: 'kika', name: 'Kika', theme_config: { portal_logo_url: 'l.png' } })
    expect((publicLoginProject({ ...project, workspaces: null }, true) as any).workspaces).toBeNull()
  })

  it('autenticação com o relay: só o tipo e a coluna do nome; nada de tabela, coluna de senha, hash nem LDAP', () => {
    const a = publicLoginAuth(auth, true)
    expect(a).toEqual({ auth_type: 'database', db_display_name_column: 'nome' })
    const text = JSON.stringify(a)
    for (const secret of ['usuarios', 'hash_senha', 'bcrypt', 'ldap', 'perfis', 'dc=x']) expect(text).not.toContain(secret)
    expect(publicLoginAuth({ auth_type: 'none' }, true)).toEqual({ auth_type: 'none', db_display_name_column: '' })
  })

  it('autenticação sem o relay (modo antigo) vai inteira: a tela a manda ao túnel', () => {
    expect(publicLoginAuth(auth, false)).toBe(auth)
  })

  it('visual: só as chaves da aparência; as de banco, grupos e acesso a tabelas ficam de fora', () => {
    const v = publicLoginVisual({
      theme: 'light', welcome_title: 'Oi', button_color: '#fff', allow_signup: true, icon_svg: '<svg/>',
      db_user_roles_table: 'x', db_groups_table: 'perfis', sync_legacy_groups: true, table_access: { closed: true, open: ['a'] }, db_display_name_column: 'nome',
    })
    expect(v).toEqual({ theme: 'light', welcome_title: 'Oi', button_color: '#fff', allow_signup: true, icon_svg: '<svg/>' })
    expect(publicLoginVisual(null)).toEqual({})
    expect(publicLoginVisual('texto')).toEqual({})
    for (const k of LOGIN_VISUAL_KEYS) expect(k.startsWith('db_')).toBe(false)
  })
})
