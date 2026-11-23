import { describe, it, expect } from 'vitest'
import { bpmExportSupport } from '../exportSupport'
import { readFileSync } from 'node:fs'

const trig = (...types: string[]) => ({ type: 'trigger', data: { triggerType: types } })

describe('o que do fluxo vai no app exportado', () => {
  it('todos os gatilhos suportados: vai inteiro', () => {
    const r = bpmExportSupport([trig('INSERT', 'BEFORE_UPDATE'), trig('webhook'), trig('SCHEDULED')])
    expect(r.level).toBe('full')
    expect(r.supported).toEqual(['BEFORE_UPDATE', 'INSERT', 'SCHEDULED', 'WEBHOOK'])
    expect(r.unsupported).toEqual([])
  })

  it('"Ao carregar formulário" fica de fora: parcial quando há outro gatilho, nenhum quando é o único', () => {
    expect(bpmExportSupport([trig('INSERT', 'ON_LOAD')])).toMatchObject({ level: 'partial', unsupported: ['ON_LOAD'] })
    expect(bpmExportSupport([trig('ON_LOAD')])).toMatchObject({ level: 'none', supported: [] })
  })

  it('gatilho como texto, sem gatilho e entrada vazia', () => {
    expect(bpmExportSupport([{ type: 'trigger', data: { triggerType: 'delete' } }]).level).toBe('full')
    expect(bpmExportSupport([{ type: 'action', data: {} }]).level).toBe('none')
    expect(bpmExportSupport(null).level).toBe('none')
  })

  it('e-mail para "usuários do sistema" avisa que não é resolvido no app exportado', () => {
    const email = (t?: string) => ({ type: 'action', data: { actionType: 'email', ...(t ? { emailRecipientType: t } : {}) } })
    expect(bpmExportSupport([trig('INSERT'), email()]).warnings).toEqual(['email_system_recipients'])
    expect(bpmExportSupport([trig('INSERT'), email('system')]).warnings).toEqual(['email_system_recipients'])
    expect(bpmExportSupport([trig('INSERT'), email('custom'), email('table')]).warnings).toEqual([])
  })

  it('o selo do Studio tem textos nos três idiomas', () => {
    for (const l of ['pt', 'en', 'es']) {
      const j = JSON.parse(readFileSync(`src/i18n/translations/${l}.json`, 'utf8')).bpm.canvas
      for (const k of ['export_full', 'export_partial', 'export_none', 'export_unsupported', 'export_warn_email']) expect(j[k], `${l} ${k}`).toBeTruthy()
    }
  })
})
