import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { partnerApplicationMail, slotCodeMail, slotKickedMail } from '../security/securityMailText'
import { partnerApprovedMail, partnerRejectedMail } from '../security/partnerMailText'
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

describe('e-mails com o modelo da marca', () => {
  const data = { name: 'Ana <b>x</b> & "Cia"', email: 'ana@x.com', phone: null, company: 'Acme', channel: 'consulting', audience: '<script>alert(1)</script>', message: null, lang: 'pt' }

  it('o aviso de candidatura usa o modelo (degradê, título, quadro e botão), escapa o texto de quem se candidata e leva ao painel', () => {
    const m = partnerApplicationMail(data, 'https://site.exemplo/admin/platform')
    expect(m.html).toContain('linear-gradient(135deg,#10b981')
    expect(m.html).toContain('Nova candidatura de parceiro')
    expect(m.html).toContain('href="https://site.exemplo/admin/platform"')
    expect(m.html).not.toContain('<script>')
    expect(m.html).not.toContain('<b>x</b>')
    expect(m.html).toContain('Ana &lt;b&gt;x&lt;/b&gt; &amp; &quot;Cia&quot;')
    expect(m.html).toContain('Consultoria ou software house')
    expect(m.subject).not.toMatch(/[\r\n]/)
    expect(m.text).toContain('ana@x.com')
  })

  it('o assunto não aceita quebra de linha vinda do nome', () => {
    expect(partnerApplicationMail({ ...data, name: 'A\r\nBcc: x@y.com' }, 'https://s/a').subject).not.toMatch(/[\r\n]/)
  })

  it('os e-mails de segurança das vagas usam o mesmo modelo', () => {
    expect(slotCodeMail('pt', '123456', 10).html).toContain('linear-gradient(135deg,#10b981')
    expect(slotKickedMail('en', { kicked: {}, by: {}, at: new Date().toISOString() }).html).toContain('linear-gradient(135deg,#10b981')
  })
})

describe('e-mails ao candidato (aprovação e recusa)', () => {
  const d = { name: 'Ana <i>Souza</i>', email: 'ana@x.com', code: 'ANA10', linkUrl: 'https://site.exemplo/?ref=ANA10', panelUrl: 'https://site.exemplo/parceiro', percent: 15, graceDays: 7, minPayout: 50 }

  it('a aprovação existe nos três idiomas, traz código, link, condições e painel, e não vaza HTML nem dados financeiros', () => {
    for (const lang of ['pt', 'en', 'es'] as const) {
      const m = partnerApprovedMail(lang, d)
      expect(m.subject, lang).toBeTruthy()
      expect(m.html, lang).toContain('linear-gradient(135deg,#10b981')
      expect(m.html, lang).toContain('ANA10')
      expect(m.html, lang).toContain('href="https://site.exemplo/parceiro"')
      expect(m.html, lang).toContain('https://site.exemplo/?ref=ANA10')
      expect(m.html, lang).toContain('15%')
      expect(m.html, lang).toContain('Ana &lt;i&gt;Souza&lt;/i&gt;')
      expect(m.html, lang).not.toContain('<i>Souza</i>')
      expect(m.text, lang).toContain('ana@x.com')
      expect(m.html + m.text, lang).not.toMatch(/chave pix:|cpf:|cnpj:/i)
    }
    expect(partnerApprovedMail('en', d).subject).toBe('You are now a MetaBuilder PRO partner')
    expect(partnerApprovedMail('es', d).html).toContain('R$')
  })

  it('a recusa existe nos três idiomas, é curta e não tem botão', () => {
    for (const lang of ['pt', 'en', 'es'] as const) {
      const m = partnerRejectedMail(lang, { name: 'Ana' })
      expect(m.subject, lang).toBeTruthy()
      expect(m.html, lang).toContain('Ana')
      expect(m.html, lang).not.toContain('<a href')
    }
  })

  it('o endereço do e-mail nunca vem da tela: boas-vindas usa o e-mail da conta do parceiro e a recusa o da candidatura gravada; só o SuperAdmin chama', () => {
    const src = read('src/app/actions/partnerApplications.ts')
    for (const fn of ['sendPartnerWelcome', 'rejectPartnerApplication']) {
      const body = src.slice(src.indexOf(`export async function ${fn}`))
      expect(body.slice(0, 300), fn).toContain('requireSuperAdmin()')
    }
    expect(src).toMatch(/from\('profiles'\)\.select\('email'\)\.eq\('id', partner\.user_id\)/)
    expect(src).toMatch(/sendMailTo\(app\.email, partnerRejectedMail/)
    expect(src).not.toMatch(/sendPartnerWelcome\(partnerId: string, to/)
  })

  it('a tela: caixa de avisar o parceiro marcada de início, caixa de avisar a recusa desmarcada de início', () => {
    const ui = read('src/components/admin/PartnersAdmin.tsx')
    expect(ui).toContain('const [notifyPartner, setNotifyPartner] = useState(true)')
    expect(ui).toContain('const [notifyReject, setNotifyReject] = useState(false)')
    expect(ui).toContain('sendPartnerWelcome(r.id, approvingId)')
    expect(ui).toContain('rejectPartnerApplication(id, notifyReject)')
  })
})

describe('excluir parceiro', () => {
  const src = read('src/app/actions/partners.ts')
  const body = src.slice(src.indexOf('export async function deletePartner'), src.indexOf('lotes de pagamento (SuperAdmin)'))

  it('só o SuperAdmin exclui, e só quando não há indicados, comissões nem itens de lote (conferido no servidor, antes de apagar)', () => {
    expect(body.slice(0, 300)).toContain('requireSuperAdmin()')
    for (const t of ['partner_referrals', 'partner_commissions', 'partner_payout_items']) expect(body).toContain(t)
    expect(body.indexOf("fail('has_history')")).toBeGreaterThan(-1)
    expect(body.indexOf("fail('has_history')")).toBeLessThan(body.indexOf(".delete()"))
    expect(body).not.toContain('auth.users')
    expect(body).not.toMatch(/from\('profiles'\)\.delete/)
  })

  it('a candidatura de origem volta para "nova" e a lista informa se há histórico', () => {
    expect(body).toMatch(/status: 'new', partner_id: null, decided_at: null/)
    expect(src).toContain('hasHistory:')
  })

  it('a tela tem o botão (desativado com histórico), pede confirmação no diálogo do app e os textos existem nos três idiomas', () => {
    const ui = read('src/components/admin/PartnersAdmin.tsx')
    expect(ui).toContain('disabled={busy || current.hasHistory}')
    expect(ui).toContain("askDialog(k('delete_partner_confirm'")
    for (const l of LANGS) for (const key of ['delete_partner', 'delete_partner_disabled', 'delete_partner_confirm', 'partner_deleted', 'err_has_history']) {
      expect(get(json(l), `admin_partners.${key}`), `${l}: ${key}`).toBeTruthy()
    }
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
    expect(src).toContain('partnerApplicationMail(')
    expect(src).toContain("'partner_notify_email'")
    expect(src).toMatch(/sendTeamNotice\(mail\.subject, mail\.text, mail\.html, notifyTo\)/)
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
