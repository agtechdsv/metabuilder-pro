import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const LANGS = ['pt', 'en', 'es'] as const
const json = (l: string) => JSON.parse(read(`src/i18n/translations/${l}.json`))
const get = (obj: any, path: string) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

/** Chaves usadas por k('x') (ou k(`x_${...}`) com prefixo conhecido) num componente, junto com o prefixo da tradução. */
function usedKeys(src: string, prefix: string): string[] {
  const keys = new Set<string>()
  for (const m of src.matchAll(/\bk\('([a-z0-9_]+)'\)/g)) keys.add(prefix + m[1])
  return [...keys]
}

describe('divulgação do Tour guiado e do programa de parceiros (pt, en e es)', () => {
  it('a página do Tour usa só chaves que existem nos três idiomas, com texto preenchido', () => {
    const src = read('src/app/features/tour/page.tsx')
    const keys = [...usedKeys(src, 'marketing_v2.features.tour.'), 'marketing_v2.features.tour.badge_studio', 'marketing_v2.features.tour.badge_portal', 'marketing_v2.features.tour.badge_ide']
    expect(keys.length).toBeGreaterThan(10)
    for (const l of LANGS) for (const key of keys) {
      const v = get(json(l), key)
      expect(typeof v === 'string' && v.trim().length > 0, `${l}: ${key}`).toBe(true)
    }
  })

  it('a página dos parceiros usa só chaves que existem nos três idiomas, com texto preenchido', () => {
    const src = read('src/components/partner/PartnersLanding.tsx')
    const keys = [...usedKeys(src, 'partners_page.'), ...[1, 2, 3, 4].flatMap(n => [`partners_page.faq${n}_q`, `partners_page.faq${n}_a`]), ...[1, 2, 3, 4].map(n => `partners_page.who_${n}`)]
    for (const l of LANGS) for (const key of keys) {
      const v = get(json(l), key)
      expect(typeof v === 'string' && v.trim().length > 0, `${l}: ${key}`).toBe(true)
    }
  })

  it('os textos das condições mantêm os marcadores que a página preenche', () => {
    for (const l of LANGS) {
      const p = json(l).partners_page
      expect(p.term_percent, l).toContain('{percent}')
      expect(p.term_grace, l).toContain('{days}')
      expect(p.term_min, l).toContain('{min}')
    }
  })

  it('menu, rodapé, home e menu do usuário apontam para as páginas novas e todos os rótulos existem', () => {
    const nav = read('src/components/layout/Navbar.tsx')
    expect(nav).toContain('href="/features/tour"')
    expect(nav).toContain('href="/parceiros"')
    expect(read('src/components/layout/Footer.tsx')).toContain('href="/parceiros"')
    const home = read('src/components/marketing/MarketingSections.tsx')
    expect(home).toContain('href="/features/tour"')
    expect(home).toContain('href="/parceiros"')
    expect(read('src/components/auth/UserMenu.tsx')).toContain('href="/parceiro"')
    const labels = ['marketing_v2.navbar.tour', 'marketing_v2.navbar.partners', 'footer.partners', 'partner_panel.menu', 'marketing_v2.home.partner_badge', 'marketing_v2.home.partner_title', 'marketing_v2.home.partner_desc', 'marketing_v2.home.partner_cta', 'marketing_v2.features.tour.card_desc']
    for (const l of LANGS) for (const key of labels) expect(get(json(l), key), `${l}: ${key}`).toBeTruthy()
  })

  it('a página de parceiros mostra o mesmo cabeçalho das outras (barra de menus), com o Tour em Developers e Parceiros em Owners', () => {
    const nav = read('src/components/layout/Navbar.tsx')
    expect(nav).toContain("pathname === '/parceiros') && (")
    const dev = nav.indexOf('Dropdown Developers'), owners = nav.indexOf('Dropdown Owners'), infra = nav.indexOf('Dropdown Infra')
    expect(nav.indexOf('href="/features/tour"')).toBeGreaterThan(dev)
    expect(nav.indexOf('href="/features/tour"')).toBeLessThan(owners)
    expect(nav.indexOf('href="/parceiros"')).toBeGreaterThan(owners)
    expect(nav.indexOf('href="/parceiros"')).toBeLessThan(infra)
  })

  it('a página pública lê as condições dos ajustes do SuperAdmin (não promete um número escrito à mão)', () => {
    const page = read('src/app/parceiros/page.tsx')
    for (const k of ['partner_default_percent', 'partner_grace_days', 'partner_min_payout']) expect(page, k).toContain(k)
    // nenhum percentual fixo nos textos de divulgação
    for (const l of LANGS) expect(JSON.stringify(json(l).partners_page)).not.toMatch(/\d+\s?%/)
  })

  it('o botão de contato usa o WhatsApp central, sem número escrito à mão', () => {
    const src = read('src/components/partner/PartnersLanding.tsx')
    expect(src).toContain('salesWhatsappUrl(')
    expect(src).not.toMatch(/wa\.me\/\d/)
  })
})
