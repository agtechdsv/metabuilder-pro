import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Aba Sistema do painel do SuperAdmin: Gerenciador de e-mails, Avisos de cobrança e Sessões e dispositivos abrem recolhidos, com seta de expandir/recolher.
const dir = resolve(__dirname, '..')
const read = (f: string) => readFileSync(resolve(dir, f), 'utf8')

describe('cartões recolhíveis da aba Sistema', () => {
  for (const [file, bodyId] of [
    ['EmailManagerAdmin.tsx', 'email-manager-body'],
    ['BillingNoticesAdmin.tsx', 'billing-notices-body'],
    ['DeviceSessionsAdmin.tsx', 'device-sessions-body'],
  ] as const) {
    it(`${file}: abre recolhido, usa a seta, só mostra o corpo aberto e o erro de carga aparece sempre`, () => {
      const src = read(file)
      expect(src).toContain("import { SectionToggle } from './SectionToggle'")
      expect(src).toMatch(/const \[open, setOpen\] = useState\(false\)/) // recolhido por padrão
      expect(src).toContain(`<SectionToggle open={open}`)
      expect(src).toContain(`id="${bodyId}"`)
      expect(src).toMatch(/\{open && overview && \(/) // o corpo só existe com o cartão aberto
      expect(src).toMatch(/\{error && <p role="alert"/) // o erro não depende de estar aberto
    })
  }

  it('a seta anuncia o estado (aria-expanded) e tem rótulo traduzido', () => {
    const src = read('SectionToggle.tsx')
    expect(src).toContain('aria-expanded={open}')
    expect(src).toContain("'admin_section.collapse'")
    expect(src).toContain("'admin_section.expand'")
  })

  it('os rótulos existem em pt, en e es', () => {
    for (const lang of ['pt', 'en', 'es']) {
      const j = JSON.parse(readFileSync(resolve(__dirname, `../../../i18n/translations/${lang}.json`), 'utf8'))
      expect(j.admin_section?.expand).toBeTruthy()
      expect(j.admin_section?.collapse).toBeTruthy()
    }
  })
})
