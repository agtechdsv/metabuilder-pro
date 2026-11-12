import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SALES_WHATSAPP, salesWhatsappUrl } from '../contact'

describe('contatos mostrados aos clientes', () => {
  it('o WhatsApp comercial é o número real (nada do placeholder 5511999999999)', () => {
    expect(SALES_WHATSAPP).toBe('5531984838184')
    expect(SALES_WHATSAPP).toMatch(/^55\d{10,11}$/)
  })

  it('o link já leva a mensagem codificada', () => {
    expect(salesWhatsappUrl('Olá, tenho interesse')).toBe('https://wa.me/5531984838184?text=Ol%C3%A1%2C%20tenho%20interesse')
  })

  it('os botões do Enterprise usam o contato central, sem número escrito à mão', () => {
    for (const f of ['src/components/checkout/CheckoutClient.tsx', 'src/components/marketing/MarketingSections.tsx']) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).toContain('salesWhatsappUrl(')
      expect(src, f).not.toMatch(/wa\.me\/\d/)
    }
  })
})
