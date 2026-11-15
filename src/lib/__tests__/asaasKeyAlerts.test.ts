import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ALWAYS_SEND_KINDS, ADMIN_KINDS, isCustomerKind } from '../../../supabase/functions/_shared/billingCore'
import { adminBillingMail } from '../billing/billingMailText'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

describe('alertas da chave de API do Asaas', () => {
  const base = { appUrl: 'https://x.com' }

  it('cada evento tem título, o que significa e o que fazer; o assunto não leva "cliente não identificado"', () => {
    for (const [event, title] of [
      ['ACCESS_TOKEN_EXPIRING_SOON', 'Chave de API do Asaas vai expirar'],
      ['ACCESS_TOKEN_DISABLED', 'Chave de API do Asaas desabilitada'],
      ['ACCESS_TOKEN_EXPIRED', 'Chave de API do Asaas expirou'],
      ['ACCESS_TOKEN_CREATED', 'Nova chave de API criada no Asaas'],
      ['ACCESS_TOKEN_ENABLED', 'Chave de API do Asaas habilitada'],
      ['ACCESS_TOKEN_DELETED', 'Chave de API do Asaas excluída'],
    ] as const) {
      const m = adminBillingMail('admin_key_alert', { ...base, event, keyName: 'MetaBuilderPRO', expiresAt: '2026-12-01' })!
      expect(m, event).toBeTruthy()
      expect(m.subject, event).toBe(title)
      expect(m.text, event).toContain('O que fazer:')
      expect(m.text, event).toContain('Chave: MetaBuilderPRO')
      expect(m.text, event).toContain('Expira em: 2026-12-01')
      expect(m.text, event).toContain('Asaas > Integrações > Chaves de API')
    }
    // o aviso de chave desabilitada explica o sintoma que o cliente vê e onde atualizar a chave
    const dis = adminBillingMail('admin_key_alert', { ...base, event: 'ACCESS_TOKEN_DISABLED' })!
    expect(dis.text).toContain('A chave de API fornecida é inválida')
    expect(dis.text).toContain('ASAAS_API_KEY')
    expect(dis.text).toContain('Chave: -') // sem nome informado
  })

  it('evento desconhecido não gera e-mail, e o nome vindo do Asaas é escapado', () => {
    expect(adminBillingMail('admin_key_alert', { ...base, event: 'ACCESS_TOKEN_OUTRO' })).toBeNull()
    expect(adminBillingMail('admin_key_alert', { ...base })).toBeNull()
    const m = adminBillingMail('admin_key_alert', { ...base, event: 'ACCESS_TOKEN_CREATED', keyName: '<img src=x onerror=1>' })!
    expect(m.html).toContain('&lt;img src=x onerror=1&gt;')
    expect(m.html).not.toContain('<img src=x')
  })

  it('é um aviso ao admin que sai sempre (não depende do interruptor dos avisos de cobrança)', () => {
    expect(ADMIN_KINDS).toContain('admin_key_alert')
    expect(ALWAYS_SEND_KINDS).toContain('admin_key_alert')
    expect(isCustomerKind('admin_key_alert')).toBe(false)
  })

  it('o webhook enfileira o alerta (um por evento do Asaas) sem guardar nada além do nome e da validade', () => {
    const hook = read('supabase/functions/asaas-webhook/index.ts')
    const i = hook.indexOf('event.startsWith("ACCESS_TOKEN_")')
    expect(i).toBeGreaterThan(0)
    const block = hook.slice(i, i + 900)
    expect(block).toContain('queuePayoutNotice(supabase, {')
    expect(block).toContain('kind: "admin_key_alert"')
    expect(block).toContain('keyName: str(tok.name)')
    expect(block).toContain('expiresAt: str(tok.expirationDate ?? tok.expiresAt)')
    expect(block).toContain('body.id') // único por evento: reentrega do mesmo evento não duplica
    // nunca grava o corpo inteiro do evento
    expect(block).not.toMatch(/payload:\s*\{[^}]*body\b/)
    expect(read('src/lib/billing/billingService.ts')).toContain('keyName: p.keyName ?? null, expiresAt: p.expiresAt ?? null')
  })
})
