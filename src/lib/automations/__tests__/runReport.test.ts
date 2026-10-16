import { describe, it, expect } from 'vitest'
import { parseRunReport, retentionDays, retentionCutoff, failureRecipients, failureEmail } from '../runReport'

describe('execuções de BPM reportadas pelo CLI', () => {
  it('valida status, identificação do fluxo e limita o tamanho dos detalhes', () => {
    expect(parseRunReport({ status: 'ok', workflow_name: 'x' }).ok).toBe(false)
    expect(parseRunReport({ status: 'error' }).ok).toBe(false)
    const r = parseRunReport({ status: 'ERROR', workflow_name: ' Aprovar pedido ', error_message: 'falhou', duration_ms: 1500.4, workflow_id: 'não-é-uuid' })
    expect(r.ok && r.run).toMatchObject({ status: 'error', workflowName: 'Aprovar pedido', workflowId: null, durationMs: 1500, errorMessage: 'falhou' })
    // sucesso não guarda mensagem de erro
    const s = parseRunReport({ status: 'success', workflow_name: 'a', error_message: 'x' })
    expect(s.ok && s.run.errorMessage).toBeNull()
    expect(parseRunReport({ status: 'success', workflow_name: 'a', details: { x: 'y'.repeat(30000) } }).ok).toBe(false)
  })

  it('retenção: 0 guarda para sempre; ausente ou inválido vale 30 dias', () => {
    expect(retentionDays({ log_retention: 0 })).toBe(0)
    expect(retentionDays({ log_retention: 90 })).toBe(90)
    expect(retentionDays({})).toBe(30)
    expect(retentionDays({ log_retention: -5 })).toBe(30)
    expect(retentionCutoff(0)).toBeNull()
    expect(retentionCutoff(7, new Date('2026-10-16T00:00:00Z'))!.toISOString()).toBe('2026-10-09T00:00:00.000Z')
  })

  it('e-mail de falha: só endereços válidos, limitado a 5, texto escapado e assunto numa linha', () => {
    expect(failureRecipients({ error_email: 'a@x.com; b@y.com.br, ruim, c@z' })).toEqual(['a@x.com', 'b@y.com.br'])
    expect(failureRecipients({})).toEqual([])
    const mail = failureEmail('Vendas <PG>', { workflowId: null, workflowName: 'Fluxo\nX', status: 'loop', triggerSource: null, startedAt: '2026-10-16T10:00:00.000Z', finishedAt: null, durationMs: 20, errorMessage: '<script>x</script>', details: {} })
    expect(mail.subject).not.toMatch(/[\r\n]/)
    expect(mail.subject).toContain('loop infinito')
    expect(mail.html).toContain('Vendas &lt;PG&gt;')
    expect(mail.html).not.toContain('<script>')
  })
})
