import { describe, it, expect } from 'vitest'
import { buildCopyScript, buildDbUrl, dbKey, dbTipoDoProjeto, dbUrlDoApp, suggestCopyName } from '../testEngine'

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

  it('Oracle: a URL usa o serviço no lugar do banco e a porta 1521; o script da cópia é de Data Pump (schema), sem a senha', () => {
    expect(dbTipoDoProjeto('oracle')).toBe('oracle')
    expect(dbTipoDoProjeto('postgres')).toBe('postgres')
    expect(dbTipoDoProjeto('mysql')).toBeNull()
    const url = buildDbUrl({ host: '192.168.0.201', port: '', database: 'FREEPDB1', user: 'crm', password: 'p@ss' }, 'oracle')
    expect(url).toBe('oracle://crm:p%40ss@192.168.0.201:1521/FREEPDB1')
    expect(dbKey(url)).toBe('192.168.0.201:1521/FREEPDB1')
    expect(suggestCopyName(url)).toBe('crm_teste')
    const s = buildCopyScript(url, 'crm_teste')
    expect(s).toContain('expdp')
    expect(s).toContain('remap_schema=CRM:CRM_TESTE')
    expect(s).not.toContain('p%40ss')
  })

  it('conexão que o app já usa: Node+Postgres (DATABASE_URL), Node+Oracle (DB_*) e Java (application.properties) viram a URL do motor', () => {
    expect(dbUrlDoApp({ env: 'NEXT_PUBLIC_X=1\nDATABASE_URL="postgres://crm:s@localhost:5432/crm"\n' })).toBe('postgres://crm:s@localhost:5432/crm')
    expect(dbUrlDoApp({ env: 'DB_CONNECTION_STRING=192.168.0.201:1521/FREEPDB1\nDB_USER=crm\nDB_PASSWORD="a b"\n' })).toBe('oracle://crm:a%20b@192.168.0.201:1521/FREEPDB1')
    expect(dbUrlDoApp({ props: 'spring.datasource.url=jdbc:postgresql://localhost:5432/crm\nspring.datasource.username=crm\nspring.datasource.password=x\n' })).toBe('postgres://crm:x@localhost:5432/crm')
    expect(dbUrlDoApp({ props: 'spring.datasource.url=jdbc:oracle:thin:@//192.168.0.201:1521/FREEPDB1\nspring.datasource.username=crm\nspring.datasource.password=y\n' })).toBe('oracle://crm:y@192.168.0.201:1521/FREEPDB1')
    expect(dbUrlDoApp({ props: 'spring.datasource.url=jdbc:mysql://h/db' })).toBeNull()
    expect(dbUrlDoApp({})).toBeNull()
  })
})
