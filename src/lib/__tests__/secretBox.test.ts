import { describe, it, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import { encryptSecret, decryptSecret, isEncryptedSecret } from '../secretBox'

const env = (): NodeJS.ProcessEnv => ({ AI_KEY_ENCRYPTION_SECRET: randomBytes(32).toString('base64') }) as any

describe('secretBox', () => {
  it('cifra e decifra, e o valor gravado não contém o original', () => {
    const e = env()
    const stored = encryptSecret('sk-minha-chave-123', e)
    expect(isEncryptedSecret(stored)).toBe(true)
    expect(stored).not.toContain('sk-minha-chave')
    expect(decryptSecret(stored, e)).toBe('sk-minha-chave-123')
  })

  it('o mesmo texto gera valores diferentes (IV aleatório)', () => {
    const e = env()
    expect(encryptSecret('abc', e)).not.toBe(encryptSecret('abc', e))
  })

  it('valor antigo em texto puro continua legível', () => {
    expect(decryptSecret('sk-antigo', env())).toBe('sk-antigo')
    expect(isEncryptedSecret('sk-antigo')).toBe(false)
  })

  it('chave-mestra errada ou dado adulterado falham com erro claro', () => {
    const stored = encryptSecret('segredo', env())
    expect(() => decryptSecret(stored, env())).toThrow(/descriptografar/)
    const e = env()
    const ok = encryptSecret('segredo', e)
    const tampered = ok.slice(0, -4) + (ok.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect(() => decryptSecret(tampered, e)).toThrow()
  })

  it('exige a chave-mestra válida (32 bytes)', () => {
    expect(() => encryptSecret('x', {} as any)).toThrow(/não está configurada/)
    expect(() => encryptSecret('x', { AI_KEY_ENCRYPTION_SECRET: Buffer.from('curta').toString('base64') } as any)).toThrow(/32 bytes/)
  })
})
