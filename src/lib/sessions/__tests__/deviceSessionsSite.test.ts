import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PROTECTED_API_PREFIXES, isProtectedPath } from '../slotCore'
import { slotCodeMail, slotKickedMail, MAIL_LANGS, resolveMailLang } from '../../security/securityMailText'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const LANGS = ['pt', 'en', 'es'] as const
const json = (l: string) => JSON.parse(read(`src/i18n/translations/${l}.json`))
const get = (obj: any, path: string) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

const sql = read('scripts/sessoes-dispositivos.sql')

describe('vagas de sessão: script SQL', () => {
  it('os blocos $$ fecham em par (o String.replace de $$ já estragou um script antes)', () => {
    expect((sql.match(/\$\$/g) || []).length % 2).toBe(0)
  })

  it('as três tabelas têm RLS ligada, sem policy, e nenhum acesso para anon/authenticated', () => {
    for (const t of ['mb_device_sessions', 'mb_device_events', 'mb_slot_challenges']) {
      expect(sql, t).toMatch(new RegExp(`alter table public\\.${t}\\s+enable row level security`))
      expect(sql, t).toMatch(new RegExp(`revoke all on public\\.${t}\\s+from anon, authenticated`))
    }
    expect(sql).not.toMatch(/create policy/i)
  })

  it('todas as funções são só do service_role (revoke de anon e authenticated, não só de public)', () => {
    const fns = [...sql.matchAll(/create or replace function public\.(mb_[a-z_]+)\s*\(/g)].map(m => m[1])
    expect(fns.length).toBeGreaterThanOrEqual(9)
    for (const f of fns) {
      expect(sql, `revoke ${f}`).toMatch(new RegExp(`revoke all on function public\\.${f}\\([^)]*\\)\\s+from public, anon, authenticated`))
      expect(sql, `grant ${f}`).toMatch(new RegExp(`grant execute on function public\\.${f}\\([^)]*\\)\\s+to service_role`))
    }
  })

  it('as funções que mexem em dados são security definer com search_path fixo', () => {
    for (const f of ['mb_claim_device_slot', 'mb_take_over_slot', 'mb_release_device_slot', 'mb_revoke_device_session', 'mb_purge_revoked_auth_sessions', 'mb_purge_device_data']) {
      const body = sql.slice(sql.indexOf(`function public.${f}(`))
      const header = body.slice(0, body.indexOf('as $$'))
      expect(header, f).toContain('security definer')
      expect(header, f).toContain('set search_path = public')
    }
  })

  it('o banco garante no máximo uma sessão ativa por usuário e tipo', () => {
    expect(sql).toMatch(/create unique index if not exists mb_device_sessions_one_active on public\.mb_device_sessions \(user_id, kind\) where revoked_at is null/)
  })

  it('os eventos e motivos que o código TypeScript grava existem nos CHECK do banco', () => {
    const actions = read('src/app/actions/deviceSessions.ts')
    for (const ev of ['code_sent', 'code_failed']) {
      expect(actions).toContain(`'${ev}'`)
      expect(sql, ev).toContain(`'${ev}'`)
    }
    for (const reason of ['user', 'admin', 'logout', 'replaced', 'idle', 'same_device']) expect(sql, reason).toContain(`'${reason}'`)
    // os ajustes ficam em platform_settings, com o modo desligado por padrão
    expect(sql).toContain(`('device_slot_mode',          '{"mode": "off"}'`)
  })
})

describe('vagas de sessão: ligação no código', () => {
  it('o proxy aplica o portão e o matcher cobre exatamente as rotas de API protegidas', () => {
    const proxy = read('src/proxy.ts')
    expect(proxy).toContain('applySlotGate(')
    const m = proxy.match(/'\/api\/\(([^)]+)\)\/:path\*'/)
    expect(m).not.toBeNull()
    const inMatcher = m![1].split('|').sort()
    const inCore = PROTECTED_API_PREFIXES.map(p => p.replace('/api/', '')).sort()
    expect(inMatcher).toEqual(inCore)
    // domínios próprios dos clientes nunca reescrevem /api
    expect(proxy.indexOf("url.pathname.startsWith('/api/')")).toBeGreaterThan(proxy.indexOf('applySlotGate('))
    expect(proxy.indexOf("url.pathname.startsWith('/api/')")).toBeLessThan(proxy.indexOf('Query Supabase to find which project'))
  })

  it('o batimento não passa pelo portão (ele mesmo confere a vaga) e as áreas dos apps publicados ficam de fora', () => {
    expect(isProtectedPath('/api/session/heartbeat')).toBe(false)
    expect(isProtectedPath('/auth/sessao-ativa')).toBe(false)
    expect(isProtectedPath('/login')).toBe(false)
    expect(isProtectedPath('/kika-projetos/vendas-pg/clientes')).toBe(false)
  })

  it('o logout libera a vaga e o SessionGuard está montado nos Providers', () => {
    const actions = read('src/app/auth/actions.ts')
    const signOutFn = actions.slice(actions.indexOf('export async function signOut'))
    expect(signOutFn.slice(0, signOutFn.indexOf('supabase.auth.signOut('))).toContain("releaseSlot(")
    // o logout padrão do Supabase é global e derrubaria a sessão da outra máquina: tem de ser só local
    expect(signOutFn).toContain("supabase.auth.signOut({ scope: 'local' })")
    // nenhum outro ponto do app chama o signOut global
    for (const f of ['src/components/auth/LoginForm.tsx', 'src/components/auth/UserMenu.tsx', 'src/components/auth/SessionGuard.tsx', 'src/components/auth/ActiveSessionChooser.tsx']) {
      expect(read(f), f).not.toMatch(/auth\.signOut\(\s*\)/)
    }
    expect(read('src/components/Providers.tsx')).toContain('<SessionGuard />')
  })

  it('"Meus dispositivos" e a tela do SuperAdmin estão nas telas certas', () => {
    expect(read('src/components/client/ClientDashboardClient.tsx')).toContain('<DeviceSessionsPanel />')
    expect(read('src/components/profile/ProfileDrawer.tsx')).toContain('<DeviceSessionsPanel />')
    expect(read('src/components/admin/PlatformAdminClient.tsx')).toContain('<DeviceSessionsAdmin ')
  })

  it('só o SuperAdmin muda os ajustes e vê o painel (a ação confere a sessão, não o corpo do pedido)', () => {
    const src = read('src/app/actions/deviceSessions.ts')
    for (const fn of ['adminDeviceOverviewAction', 'adminSaveDeviceSettingsAction', 'adminRevokeDeviceAction']) {
      const body = src.slice(src.indexOf(`export async function ${fn}`))
      expect(body.slice(0, 400), fn).toContain('requireSuperAdmin()')
    }
    expect(src).toContain("profile?.is_super_admin")
  })

  it('o cron diário limpa as sessões encerradas e aplica a retenção', () => {
    const cron = read('src/app/api/cron/empty-trash/route.ts')
    expect(cron).toContain('mb_purge_revoked_auth_sessions')
    expect(cron).toContain('mb_purge_device_data')
  })
})

describe('vagas de sessão: textos (pt, en e es)', () => {
  const files = ['src/components/auth/ActiveSessionChooser.tsx', 'src/components/auth/SessionGuard.tsx', 'src/components/auth/KickedNotice.tsx', 'src/components/workspace/DeviceSessionsPanel.tsx']

  it('todas as chaves usadas pelos componentes existem nos três idiomas, com texto', () => {
    const keys = new Set<string>()
    for (const f of files) for (const m of read(f).matchAll(/\bk\('([a-z0-9_]+)'\)/g)) keys.add(m[1])
    // chaves montadas dinamicamente
    for (const r of ['replaced', 'same_device', 'idle', 'logout', 'user', 'admin']) keys.add(`mydev_reason_${r}`)
    for (const m of read('src/components/auth/ActiveSessionChooser.tsx').matchAll(/'(err_[a-z_]+)'/g)) keys.add(m[1])
    expect(keys.size).toBeGreaterThan(30)
    for (const l of LANGS) for (const key of keys) {
      const v = get(json(l), `device_sessions.${key}`)
      expect(typeof v === 'string' && v.trim().length > 0, `${l}: device_sessions.${key}`).toBe(true)
    }
  })

  it('os textos mantêm os marcadores que o código preenche', () => {
    for (const l of LANGS) {
      const d = json(l).device_sessions
      expect(d.code_desc, l).toContain('{email}')
      expect(d.code_sent, l).toContain('{email}')
      expect(d.kicked_desc_place, l).toContain('{place}')
      expect(d.kicked_desc_place, l).toContain('{time}')
    }
  })

  it('termos e privacidade trazem a cláusula nova nos três idiomas e a política cita o identificador do dispositivo', () => {
    for (const l of LANGS) {
      const j = json(l)
      expect(j.terms.item5_title?.trim(), l).toBeTruthy()
      expect(j.terms.item5_desc?.length, l).toBeGreaterThan(400)
      expect(j.privacy.item5_title?.trim(), l).toBeTruthy()
      expect(j.privacy.item5_desc, l).toMatch(/90/)
      expect(j.privacy.item5_desc, l).toMatch(/LGPD/)
      expect(Object.keys(j.terms).indexOf('item5_title'), l).toBeLessThan(Object.keys(j.terms).indexOf('button'))
    }
    expect(read('src/components/legal/TermsContent.tsx')).toContain("t('terms.item5_desc')")
    expect(read('src/components/legal/PrivacyContent.tsx')).toContain("t('privacy.item5_desc')")
  })
})

describe('vagas de sessão: e-mails de segurança', () => {
  const data = { kicked: { label: 'Chrome · Windows', place: 'Belo Horizonte, MG', since: '2026-11-13T01:00:00.000Z' }, by: { label: 'IDE · macOS', place: 'São Paulo, SP' }, at: '2026-11-13T02:00:00.000Z' }

  it('existem nos três idiomas, com assunto, HTML e texto', () => {
    expect(MAIL_LANGS).toEqual(['pt', 'en', 'es'])
    const subjects = new Set<string>()
    for (const l of MAIL_LANGS) {
      const kicked = slotKickedMail(l, data)
      const code = slotCodeMail(l, '123456', 10)
      for (const m of [kicked, code]) { expect(m.subject.length).toBeGreaterThan(5); expect(m.html).toContain('<html'); expect(m.text.length).toBeGreaterThan(20); subjects.add(m.subject) }
      expect(kicked.html).toContain('São Paulo, SP')
      expect(code.html).toContain('123456')
      expect(code.text).toContain('10')
    }
    expect(subjects.size).toBe(6)
  })

  it('texto que vem do aparelho (cidade, navegador) nunca entra como HTML', () => {
    const evil = slotKickedMail('pt', { ...data, by: { label: '<img src=x onerror=alert(1)>', place: '"><script>alert(1)</script>' } })
    expect(evil.html).not.toContain('<script>')
    expect(evil.html).not.toContain('<img src=x')
    expect(evil.html).toContain('&lt;script&gt;')
  })

  it('idioma desconhecido cai no português', () => {
    expect(resolveMailLang('en')).toBe('en')
    expect(resolveMailLang('es')).toBe('es')
    expect(resolveMailLang('fr')).toBe('pt')
    expect(resolveMailLang(undefined)).toBe('pt')
  })
})
