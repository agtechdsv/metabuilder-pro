import { describe, it, expect } from 'vitest'
import { buildCopyScript, buildDbUrl, dbKey, suggestCopyName } from '../testEngine'

describe('banco de teste: cópia e conexão', () => {
  it('sugere o nome da cópia a partir do banco original', () => {
    expect(suggestCopyName('postgres://crm:senha@localhost:5432/crm')).toBe('crm_teste')
    expect(suggestCopyName('postgres://u:p@h/Vendas-2026')).toBe('vendas_2026_teste')
  })

  it('o script para o administrador traz host, porta, banco e usuário, nunca a senha', () => {
    const s = buildCopyScript('postgres://crm:segredo123@srv.local:5433/crm', 'crm_teste')
    expect(s).toContain('-h srv.local -p 5433 -U crm')
    expect(s).toContain('CREATE DATABASE \\"crm_teste\\" TEMPLATE \\"crm\\"')
    expect(s).toContain('pg_dump')
    expect(s).not.toContain('segredo123')
  })

  it('monta a URL protegendo caracteres especiais da senha e identifica o banco por host:porta/banco', () => {
    const url = buildDbUrl({ host: ' db.exemplo ', port: '5432', database: 'meu banco', user: 'a@b', password: 'p:w/d#' })
    expect(url).toBe('postgres://a%40b:p%3Aw%2Fd%23@db.exemplo:5432/meu%20banco')
    expect(new URL(url).password).toBe('p%3Aw%2Fd%23')
    expect(dbKey(url)).toBe('db.exemplo:5432/meu%20banco')
  })
})
