import { describe, it, expect } from 'vitest'
import { parseHelpFeedback, HELP_FEEDBACK_MAX_COMMENT } from '../helpFeedback'

const pid = '11111111-1111-4111-8111-111111111111'

describe('feedback da ajuda', () => {
  it('aceita voto de campo e de tela, limpando o comentário', () => {
    const r = parseHelpFeedback({ projectId: pid, field: 'f1', screen: 'v1', vote: 'down', comment: '  não entendi  ', language: 'pt' })
    expect(r).toEqual({ ok: true, value: { projectId: pid, screen: 'v1', field: 'f1', zone: null, vote: 'down', comment: 'não entendi', language: 'pt' } })
    expect(parseHelpFeedback({ projectId: pid, screen: 'v1', vote: 'up' }).ok).toBe(true)
  })

  it('recusa projeto, voto ou identificador inválidos e pedido sem alvo', () => {
    expect(parseHelpFeedback(null).ok).toBe(false)
    expect(parseHelpFeedback({ projectId: 'x', field: 'f', vote: 'up' }).ok).toBe(false)
    expect(parseHelpFeedback({ projectId: pid, field: 'f', vote: 'meh' }).ok).toBe(false)
    expect(parseHelpFeedback({ projectId: pid, field: "f'; drop", vote: 'up' }).ok).toBe(false)
    expect(parseHelpFeedback({ projectId: pid, vote: 'up' }).ok).toBe(false)
  })

  it('guarda a zona e recusa zona desconhecida', () => {
    const ok = parseHelpFeedback({ projectId: pid, field: 'f', zone: 'grid', vote: 'up' })
    expect(ok.ok && ok.value.zone).toBe('grid')
    expect(parseHelpFeedback({ projectId: pid, field: 'f', zone: 'sidebar', vote: 'up' }).ok).toBe(false)
    // voto dado na Central de Ajuda tem zona própria
    const central = parseHelpFeedback({ projectId: pid, screen: 'v', field: 'f', zone: 'central', vote: 'down', comment: 'x' })
    expect(central.ok && central.value.zone).toBe('central')
  })

  it('corta comentário longo e ignora idioma estranho', () => {
    const r = parseHelpFeedback({ projectId: pid, field: 'f', vote: 'down', comment: 'a'.repeat(5000), language: '<x>' })
    expect(r.ok && r.value.comment!.length).toBe(HELP_FEEDBACK_MAX_COMMENT)
    expect(r.ok && r.value.language).toBeNull()
  })
})
