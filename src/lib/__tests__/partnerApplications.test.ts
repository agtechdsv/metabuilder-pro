import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { APPLICATION_CHANNELS, MIN_FILL_MS, looksLikeBot, suggestPartnerCode, validateApplication, type ApplicationInput } from '../partnerApplications'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const LANGS = ['pt', 'en', 'es'] as const
const json = (l: string) => JSON.parse(read(`src/i18n/translations/${l}.json`))
const get = (obj: any, path: string) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

const good: ApplicationInput = {
  name: '  Maria  da Silva ', email: ' Maria@Empresa.com ', phone: '+55 (31) 98483-8184', company: 'Acme', channel: 'consulting',
  audience: 'Clientes legados', message: 'Olá', consent: true, lang: 'pt', website: '', openedAt: 0,
}

describe('candidatura de parceiro: validação', () => {
  it('limpa os campos e aceita um envio correto', () => {
    const r = validateApplication(good)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.name).toBe('Maria da Silva')
      expect(r.value.email).toBe('maria@empresa.com')
      expect(r.value.company).toBe('Acme')
    }
  })

  it('campos opcionais vazios viram null', () => {
    const r = validateApplication({ ...good, phone: '', company: '', audience: '', message: '' })
    expect(r.ok && r.value.phone === null && r.value.company === null && r.value.audience === null && r.value.message === null).toBe(true)
  })

  it('recusa nome curto, e-mail ruim, telefone ruim, perfil fora da lista, texto longo e falta de consentimento', () => {
    const code = (o: Partial<ApplicationInput>) => { const r = validateApplication({ ...good, ...o }); return r.ok ? 'ok' : r.code }
    expect(code({ name: 'A' })).toBe('name_invalid')
    expect(code({ email: 'sem-arroba' })).toBe('email_invalid')
    expect(code({ email: 'a@b' })).toBe('email_invalid')
    expect(code({ email: 'a b@c.com' })).toBe('email_invalid')
    expect(code({ phone: 'abc' })).toBe('phone_invalid')
    expect(code({ channel: 'hacker' })).toBe('channel_invalid')
    expect(code({ message: 'x'.repeat(2001) })).toBe('text_too_long')
    expect(code({ audience: 'x'.repeat(601) })).toBe('text_too_long')
    expect(code({ consent: false })).toBe('consent_required')
    expect(code({ consent: 'true' as unknown as boolean })).toBe('consent_required')
  })

  it('idioma desconhecido cai em português; caracteres de controle somem', () => {
    const r = validateApplication({ ...good, lang: 'xx', name: 'Ana\u0000 Souza' })
    expect(r.ok && r.value.lang === 'pt' && r.value.name === 'Ana Souza').toBe(true)
  })
})

describe('candidatura de parceiro: anti-robô', () => {
  it('campo isca preenchido ou envio rápido demais é robô; envio normal passa', () => {
    const now = 1_000_000
    expect(looksLikeBot({ ...good, website: 'http://spam', openedAt: now - 60_000 }, now)).toBe('honeypot')
    expect(looksLikeBot({ ...good, openedAt: now - (MIN_FILL_MS - 1) }, now)).toBe('too_fast')
    expect(looksLikeBot({ ...good, openedAt: now + 5000 }, now)).toBe('too_fast')
    expect(looksLikeBot({ ...good, openedAt: NaN }, now)).toBe('too_fast')
    expect(looksLikeBot({ ...good, openedAt: now - 20_000 }, now)).toBeNull()
  })
})

describe('sugestão de código do link', () => {
  it('usa a primeira palavra, sem acento, em maiúsculas, e sempre cabe no formato aceito', () => {
    expect(suggestPartnerCode('João da Silva')).toBe('JOAO')
    expect(suggestPartnerCode('Li Wei')).toMatch(/^[A-Z0-9][A-Z0-9_-]{2,31}$/)
    expect(suggestPartnerCode('!!!')).toMatch(/^[A-Z0-9][A-Z0-9_-]{2,31}$/)
  })
})

describe('candidatura de parceiro: ligação no sistema', () => {
  it('o SQL cria a tabela com RLS ligada, sem policy e sem acesso de anon/authenticated', () => {
    const sql = read('scripts/parceiros-interessados.sql')
    expect(sql).toContain('create table if not exists public.partner_applications')
    expect(sql).toMatch(/enable row level security/)
    expect(sql).toMatch(/revoke all on public\.partner_applications from anon, authenticated/)
    expect(sql).not.toMatch(/create policy/i)
    for (const c of APPLICATION_CHANNELS) expect(sql).toContain(`'${c}'`)
  })

  it('a ação pública barra robô e limita por IP antes de gravar; as de admin conferem o SuperAdmin pela sessão', () => {
    const src = read('src/app/actions/partnerApplications.ts')
    expect(src.indexOf('looksLikeBot')).toBeLessThan(src.indexOf(".insert({"))
    expect(src).toContain('MAX_PER_IP_PER_HOUR')
    expect(src).toContain('hashIp(')
    expect(src).not.toMatch(/ip_hash:\s*clientIp/)
    for (const fn of ['listPartnerApplications', 'decidePartnerApplication', 'deletePartnerApplication']) {
      const body = src.slice(src.indexOf(`export async function ${fn}`))
      expect(body.slice(0, 400), fn).toContain('requireSuperAdmin()')
    }
  })

  it('o e-mail de aviso escapa o texto de quem se candidata e o destino é o que o SuperAdmin escolhe (só ele muda)', () => {
    const src = read('src/app/actions/partnerApplications.ts')
    expect(src).toContain('esc(String(val))')
    expect(src).toContain("'partner_notify_email'")
    expect(src).toMatch(/notifyTo,\s*\)/)
    for (const fn of ['getPartnerNotifyEmail', 'savePartnerNotifyEmail']) {
      expect(src.slice(src.indexOf(`export async function ${fn}`)).slice(0, 300), fn).toContain('requireSuperAdmin()')
    }
    expect(read('src/lib/security/securityMail.ts')).toMatch(/to\?: string \| null/)
    expect(read('src/components/admin/PartnersAdmin.tsx')).toContain('savePartnerNotifyEmail')
  })

  it('a página tem o formulário, o botão leva até ele e o WhatsApp continua como alternativa', () => {
    const land = read('src/components/partner/PartnersLanding.tsx')
    expect(land).toContain('<PartnerApplyForm />')
    expect(land).toContain('href="#cadastro"')
    expect(land).toContain('id="cadastro"')
    expect(land).toContain('salesWhatsappUrl(')
  })

  it('todas as chaves do formulário existem nos três idiomas, com texto', () => {
    const src = read('src/components/partner/PartnerApplyForm.tsx')
    const keys = new Set<string>()
    for (const m of src.matchAll(/\bk\('([a-z0-9_]+)'\)/g)) keys.add(m[1])
    for (const m of src.matchAll(/'(err_[a-z]+)'/g)) keys.add(m[1])
    for (const c of APPLICATION_CHANNELS) keys.add(`channel_${c}`)
    expect(keys.size).toBeGreaterThan(15)
    for (const l of LANGS) for (const key of keys) {
      const v = get(json(l), `partner_apply.${key}`)
      expect(typeof v === 'string' && v.trim().length > 0, `${l}: partner_apply.${key}`).toBe(true)
    }
    for (const l of LANGS) expect(get(json(l), 'partners_page.cta_apply'), l).toBeTruthy()
  })

  it('o painel do SuperAdmin tem as abas Parceiros e Sistema, com cada cartão no lugar certo e o link do cartão de ajustes', () => {
    const src = read('src/components/admin/PlatformAdminClient.tsx')
    const block = (tab: string) => {
      const i = src.indexOf(`activeTab === '${tab}' && (`)
      const j = src.indexOf('\n        )}', i)
      return src.slice(i, j)
    }
    const plans = block('plans'), partners = block('partners'), system = block('system')
    for (const c of ['PricingRulesAdmin', 'CampaignsAdmin', 'IClubSettingsAdmin', 'PartnerSettingsAdmin']) expect(plans, c).toContain(`<${c}`)
    for (const c of ['PartnersAdmin', 'DeviceSessionsAdmin', 'TrashSettingsAdmin']) expect(plans, c).not.toContain(`<${c} `)
    expect(plans).not.toContain('<PartnersAdmin')
    expect(plans).toContain("openTab('partners')")
    expect(partners).toContain('<PartnersAdmin')
    expect(system).toContain('<DeviceSessionsAdmin')
    expect(system).toContain('<TrashSettingsAdmin')
    for (const l of LANGS) { expect(get(json(l), 'admin.tabs.partners'), l).toBeTruthy(); expect(get(json(l), 'admin.tabs.system'), l).toBeTruthy() }
  })

  it('a tela do SuperAdmin lista, aprova (abre o cadastro preenchido), recusa e apaga', () => {
    const src = read('src/components/admin/PartnersAdmin.tsx')
    for (const s of ['listPartnerApplications', 'decidePartnerApplication', 'deletePartnerApplication', 'suggestPartnerCode', "k('approve')"]) expect(src, s).toContain(s)
  })

  it('as telas de Parceiros e Sessões do SuperAdmin usam o diálogo do app (nunca alert/confirm do navegador) e textos em pt, en e es', () => {
    const files: [string, string][] = [
      ['src/components/admin/PartnersAdmin.tsx', 'admin_partners.'],
      ['src/components/admin/PartnerSettingsAdmin.tsx', 'admin_partners.'],
      ['src/components/admin/DeviceSessionsAdmin.tsx', 'admin_devices.'],
    ]
    for (const [file, prefix] of files) {
      const src = read(file)
      expect(src, file).not.toMatch(/window\.(confirm|alert)|[^.\w]alert\(|[^.\w]confirm\(/)
      const keys = new Set<string>()
      for (const m of src.matchAll(/\bk\('([a-z0-9_]+)'/g)) keys.add(m[1])
      expect(keys.size, file).toBeGreaterThan(5)
      for (const l of LANGS) for (const key of keys) {
        const v = get(json(l), prefix + key)
        expect(typeof v === 'string' && v.trim().length > 0, `${l}: ${prefix}${key}`).toBe(true)
      }
    }
    // chaves montadas na hora (k(`x_${...}`) e t(`admin_partners.channel_${...}`)): todas as variações existem
    const dynamic: [string, string[]][] = [
      ['admin_partners.', [...APPLICATION_CHANNELS.map(c => `channel_${c}`), 'skip_suspended', 'skip_no_pix', 'skip_below_min', 'item_pending', 'item_sending', 'item_sent', 'item_done', 'item_failed',
        'batch_done', 'batch_partial', 'batch_failed', 'batch_processing', 'approved', 'rejected', 'batch_failed_part',
        'err_not_authorized', 'err_user_not_found', 'err_code_invalid', 'err_code_in_use', 'err_pix_invalid', 'err_document_invalid', 'err_percent_invalid', 'err_already_partner',
        'err_nothing_to_pay', 'err_payout_cap_exceeded', 'err_no_partners', 'err_not_found', 'err_unknown', 'err_invalid_email', 'err_invalid_status']],
      ['admin_devices.', ['mode_off', 'mode_observe', 'mode_enforce', 'mode_off_hint', 'mode_observe_hint', 'mode_enforce_hint', 'ev_takeover', 'ev_conflict', 'ev_cap_reached', 'ev_code_failed',
        'ev_same_session', 'stat_active', 'stat_ide', 'stat_web', 'stat_takeovers', 'stat_conflicts', 'stat_caps', 'err_forbidden', 'err_invalid_settings', 'err_unknown', 'kind_ide', 'kind_web']],
    ]
    for (const [prefix, keys] of dynamic) for (const l of LANGS) for (const key of keys) {
      const v = get(json(l), prefix + key)
      expect(typeof v === 'string' && v.trim().length > 0, `${l}: ${prefix}${key}`).toBe(true)
    }
    // os marcadores de troca ({name}, {n}, {total}...) são os mesmos nos três idiomas
    for (const ns of ['admin_partners', 'admin_devices']) {
      const marks = (s: string) => (String(s).match(/\{[a-z]+\}/g) || []).sort().join(',')
      for (const key of Object.keys(json('pt')[ns])) for (const l of ['en', 'es']) {
        expect(marks(json(l)[ns][key]), `${l}: ${ns}.${key}`).toBe(marks(json('pt')[ns][key]))
      }
    }
  })
})
