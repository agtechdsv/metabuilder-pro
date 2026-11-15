import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { archivedReferralEmail, decideReferralAction } from '../partnerReferral'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

describe('indicação de parceiro quando o e-mail já tem uma indicação', () => {
  it('sem indicação anterior cria; ativa (registrada ou assinante) mantém o primeiro parceiro; cancelada é arquivada e a nova entra', () => {
    expect(decideReferralAction(null)).toBe('create')
    expect(decideReferralAction(undefined)).toBe('create')
    expect(decideReferralAction({ id: 'a', status: 'registered' })).toBe('keep')
    expect(decideReferralAction({ id: 'a', status: 'subscribed' })).toBe('keep')
    expect(decideReferralAction({ id: 'a', status: 'canceled' })).toBe('archive_then_create')
  })

  it('o e-mail arquivado nunca coincide com um e-mail real e é único por linha', () => {
    const a = archivedReferralEmail('  Ana@Empresa.com ', '09c3cce9')
    expect(a).toBe('ana@empresa.com#arquivada-09c3cce9')
    expect(a).not.toBe('ana@empresa.com')
    expect(archivedReferralEmail('ana@empresa.com', 'x1')).not.toBe(archivedReferralEmail('ana@empresa.com', 'x2'))
    // o "#" fica no domínio, que só aceita letras, números, ponto e hífen: nenhum e-mail real tem esse valor
    expect(/^[^\s@]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(a)).toBe(false)
    expect(/^[^\s@]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test('ana@empresa.com')).toBe(true)
  })

  it('o registro usa a regra: só barra com indicação ativa, e arquiva só a cancelada antes de criar a nova', () => {
    const src = read('src/app/actions/iclub.ts')
    const fn = src.slice(src.indexOf('async function registerPartnerReferral'), src.indexOf('// 5. Register Referral from Cookie'))
    expect(fn).toContain("select('id, status')")
    expect(fn).toContain('decideReferralAction(existing)')
    expect(fn).toContain("if (action === 'keep') return")
    expect(fn).toContain('archivedReferralEmail(email, existing.id)')
    expect(fn).toContain(".eq('status', 'canceled')") // arquiva só se ainda estiver cancelada (nunca uma ativa)
    // o arquivamento vem antes do insert da indicação nova
    expect(fn.indexOf('archivedReferralEmail(')).toBeLessThan(fn.indexOf(".from('partner_referrals').insert("))
    // a linha antiga não é apagada: as comissões dependem dela
    expect(fn).not.toContain(".from('partner_referrals').delete(")
  })
})
