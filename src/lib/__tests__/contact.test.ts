import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SALES_WHATSAPP, SALES_WHATSAPP_DISPLAY, salesWhatsappUrl } from '../contact'

describe('contatos mostrados aos clientes', () => {
  it('o WhatsApp comercial é o número real (nada do placeholder 5511999999999)', () => {
    expect(SALES_WHATSAPP).toBe('5531989560146')
    expect(SALES_WHATSAPP).toMatch(/^55\d{10,11}$/)
  })

  it('o número aparece formatado para o leitor', () => {
    expect(SALES_WHATSAPP_DISPLAY).toBe('(31) 98956-0146')
  })

  it('o rodapé e o e-mail de boas-vindas levam o WhatsApp pelo contato central', () => {
    expect(readFileSync('src/components/layout/Footer.tsx', 'utf8')).toContain('salesWhatsappUrl(')
    expect(readFileSync('src/lib/billing/welcomeMailText.ts', 'utf8')).toContain('SALES_WHATSAPP_DISPLAY')
  })

  it('os e-mails para clientes e parceiros levam o WhatsApp; os da equipe e os de segurança não', () => {
    const shell = readFileSync('src/lib/security/securityMailText.ts', 'utf8')
    expect(shell).toContain('withContact = true')
    expect(shell).toContain('wa.me/${SALES_WHATSAPP}')
    expect(readFileSync('src/lib/billing/billingMailText.ts', 'utf8')).toContain('para a equipe.`, false)')
    expect(readFileSync('src/lib/billing/payoutMailText.ts', 'utf8')).toContain('para a equipe.`, false)')
  })

  it('a janela da AG Tech tem o botão de WhatsApp pelo contato central', () => {
    expect(readFileSync('src/components/legal/AgTechContent.tsx', 'utf8')).toContain('salesWhatsappUrl(')
  })

  it('o link já leva a mensagem codificada', () => {
    expect(salesWhatsappUrl('Olá, tenho interesse')).toBe('https://wa.me/5531989560146?text=Ol%C3%A1%2C%20tenho%20interesse')
  })

  it('os botões do Enterprise usam o contato central, sem número escrito à mão', () => {
    for (const f of ['src/components/checkout/CheckoutClient.tsx', 'src/components/marketing/MarketingSections.tsx']) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).toContain('salesWhatsappUrl(')
      expect(src, f).not.toMatch(/wa\.me\/\d/)
    }
  })
})
