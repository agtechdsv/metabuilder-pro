import { describe, it, expect } from 'vitest'
import { parseEmailRequest, MAX_RECIPIENTS } from '../emailGuard'

const ok = { to: 'ana@empresa.com.br', subject: 'Pedido aprovado', html: '<p>Olá</p>' }

describe('envio de e-mail das automações', () => {
  it('aceita um pedido normal; destinatários em texto (vírgula/ponto e vírgula) ou lista', () => {
    expect(parseEmailRequest(ok)).toEqual({ ok: true, req: { to: ['ana@empresa.com.br'], subject: 'Pedido aprovado', html: '<p>Olá</p>' } })
    const r = parseEmailRequest({ ...ok, to: 'a@x.com; b@y.com, c@z.com' })
    expect(r.ok && r.req.to).toEqual(['a@x.com', 'b@y.com', 'c@z.com'])
    expect(parseEmailRequest({ ...ok, to: ['a@x.com', 'b@y.com'] }).ok).toBe(true)
  })

  it('recusa destinatário inválido, vazio ou em excesso', () => {
    expect(parseEmailRequest({ ...ok, to: '' }).ok).toBe(false)
    expect(parseEmailRequest({ ...ok, to: 'sem-arroba' }).ok).toBe(false)
    expect(parseEmailRequest({ ...ok, to: 'a@x.com\nBcc: vitima@x.com' }).ok).toBe(false)
    expect(parseEmailRequest({ ...ok, to: 'Fulano <a@x.com>' }).ok).toBe(false)
    const muitos = Array.from({ length: MAX_RECIPIENTS + 1 }, (_, i) => `u${i}@x.com`)
    expect(parseEmailRequest({ ...ok, to: muitos }).ok).toBe(false)
  })

  it('assunto: quebra de linha vira espaço (sem injeção de cabeçalho); nem vazio, nem enorme', () => {
    const r = parseEmailRequest({ ...ok, subject: 'Oi\r\nBcc: x@y.com' })
    expect(r.ok && r.req.subject).toBe('Oi Bcc: x@y.com')
    expect(parseEmailRequest({ ...ok, subject: '   ' }).ok).toBe(false)
    expect(parseEmailRequest({ ...ok, subject: 'a'.repeat(201) }).ok).toBe(false)
  })

  it('corpo: não vazio e com tamanho limitado', () => {
    expect(parseEmailRequest({ ...ok, html: '' }).ok).toBe(false)
    expect(parseEmailRequest({ ...ok, html: 'x'.repeat(600_000) }).ok).toBe(false)
    expect(parseEmailRequest({ ...ok, html: 123 as any }).ok).toBe(false)
  })
})
