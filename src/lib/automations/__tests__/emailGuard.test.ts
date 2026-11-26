import { describe, it, expect } from 'vitest'
import { parseEmailRequest, MAX_RECIPIENTS, MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES } from '../emailGuard'

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

  describe('anexos (planilha do resultado de uma consulta)', () => {
    const b64 = (n: number) => Buffer.alloc(n, 1).toString('base64')
    const att = (over: any = {}) => ({ filename: 'consulta-2026-11-26.xlsx', content: b64(100), ...over })

    it('aceita xlsx e csv; o tipo vem da extensão, não do pedido', () => {
      const r = parseEmailRequest({ ...ok, attachments: [att({ contentType: 'text/html' }), att({ filename: 'a.csv' })] })
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.req.attachments).toHaveLength(2)
        expect(r.req.attachments![0].contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        expect(r.req.attachments![1].contentType).toBe('text/csv; charset=utf-8')
        expect(r.req.attachments![0].content.length).toBe(100)
      }
    })

    it('aceita PDF (tipo vem da extensão)', () => {
      const r = parseEmailRequest({ ...ok, attachments: [att({ filename: 'relatorio.pdf', contentType: 'text/html' })] })
      expect(r.ok && r.req.attachments![0].contentType).toBe('application/pdf')
    })

    it('sem anexos o pedido continua igual', () => {
      const r = parseEmailRequest(ok)
      expect(r.ok && r.req.attachments).toBeUndefined()
    })

    it('recusa extensão perigosa, conteúdo que não é base64, lista grande demais e tamanho acima do limite', () => {
      expect(parseEmailRequest({ ...ok, attachments: [att({ filename: 'virus.exe' })] }).ok).toBe(false)
      expect(parseEmailRequest({ ...ok, attachments: [att({ filename: 'a.xlsx.html' })] }).ok).toBe(false)
      expect(parseEmailRequest({ ...ok, attachments: [att({ content: 'isto não é base64!!' })] }).ok).toBe(false)
      expect(parseEmailRequest({ ...ok, attachments: [att({ content: '' })] }).ok).toBe(false)
      expect(parseEmailRequest({ ...ok, attachments: 'x' }).ok).toBe(false)
      expect(parseEmailRequest({ ...ok, attachments: Array.from({ length: MAX_ATTACHMENTS + 1 }, () => att()) }).ok).toBe(false)
      expect(parseEmailRequest({ ...ok, attachments: [att({ content: b64(MAX_ATTACHMENT_BYTES + 1) })] }).ok).toBe(false)
      // o total conta (dois anexos que juntos passam do limite)
      expect(parseEmailRequest({ ...ok, attachments: [att({ content: b64(MAX_ATTACHMENT_BYTES - 10) }), att({ filename: 'b.csv', content: b64(100) })] }).ok).toBe(false)
    })

    it('nome do arquivo é limpo (sem caminho nem caracteres estranhos)', () => {
      const r = parseEmailRequest({ ...ok, attachments: [att({ filename: '../../etc/relatório final.xlsx' })] })
      expect(r.ok && r.req.attachments![0].filename).toBe('.._.._etc_relat_rio_final.xlsx')
    })
  })
})
