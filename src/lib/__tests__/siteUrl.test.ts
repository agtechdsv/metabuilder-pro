import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { DEFAULT_SITE_URL, siteBaseUrl } from '../siteUrl'
import { welcomeMail } from '../billing/welcomeMailText'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

describe('endereço do site nos links dos e-mails', () => {
  const saved = { app: process.env.NEXT_PUBLIC_APP_URL, site: process.env.NEXT_PUBLIC_SITE_URL }
  afterEach(() => {
    if (saved.app === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = saved.app
    if (saved.site === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = saved.site
  })

  it('sem variável de ambiente usa o endereço oficial, com www', () => {
    delete process.env.NEXT_PUBLIC_APP_URL; delete process.env.NEXT_PUBLIC_SITE_URL
    expect(DEFAULT_SITE_URL).toBe('https://www.metabuilderpro.com')
    expect(siteBaseUrl()).toBe('https://www.metabuilderpro.com')
  })

  it('a variável tem prioridade (APP_URL antes de SITE_URL) e a barra do fim some', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://site.exemplo.com/'
    expect(siteBaseUrl()).toBe('https://site.exemplo.com')
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.exemplo.com//'
    expect(siteBaseUrl()).toBe('https://app.exemplo.com')
  })

  it('os e-mails de parceiro, cobrança, interesse e passkey usam o endereço central, sem o endereço sem www escrito à mão', () => {
    for (const f of [
      'src/app/actions/partners.ts', 'src/app/actions/partnerApplications.ts', 'src/app/actions/stack-interest.ts',
      'src/lib/billing/billingService.ts', 'src/app/api/auth/passkeys/authenticate/verify/route.ts',
    ]) {
      const src = read(f)
      expect(src, f).toContain('siteBaseUrl()')
      expect(src, f).not.toContain("'https://metabuilderpro.com'")
    }
  })
})

describe('e-mail de boas-vindas', () => {
  it('não cita tecnologias de exportação (a lista vai crescer) e diz que o código é do cliente, nos três idiomas', () => {
    for (const lang of ['pt', 'en', 'es'] as const) {
      const m = welcomeMail(lang, { name: 'Ana', appUrl: 'https://www.metabuilderpro.com' })
      expect(m.text, lang).not.toMatch(/Node|Java/)
      expect(m.html, lang).not.toMatch(/Node|Java/)
    }
    expect(welcomeMail('pt', { name: 'Ana', appUrl: 'https://x.com' }).text).toContain('exporta o código completo, que é seu')
    expect(welcomeMail('en', { name: 'Ana', appUrl: 'https://x.com' }).text).toContain('exports the complete code, which is yours')
    expect(welcomeMail('es', { name: 'Ana', appUrl: 'https://x.com' }).text).toContain('exporta el código completo, que es suyo')
  })
})
