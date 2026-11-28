import { describe, it, expect, beforeEach } from 'vitest'
import { createRequire } from 'node:module'

/**
 * Tabelas do MetaBuilder no banco do cliente (feedback da Ajuda e log de banco): quando o DBA já as criou, o Agente NÃO pode tentar criá-las.
 * O PostgreSQL exige permissão de CRIAR no schema até para "CREATE TABLE IF NOT EXISTS" numa tabela que já existe, e o usuário de
 * privilégio mínimo do Agente não tem essa permissão.
 */
const req = createRequire(import.meta.url)
const HF = '../../../cli/helpFeedback.js'
const LG = '../../../cli/cliDbLogger.js'

/** Cliente pg de mentira. `exists`: as tabelas já existem; `denyCreate`: CREATE/ALTER recusados por falta de permissão. */
function fakePg(opts: { exists: boolean; denyCreate: boolean; hasZone?: boolean }) {
  const log: string[] = []
  let created = false
  return {
    log,
    async query(sql: string, params?: any[]) {
      log.push(sql.trim().split('\n')[0].slice(0, 60))
      if (/^\s*SELECT 1 FROM mb_(help_feedback|logs) WHERE 1 = 0/.test(sql)) {
        if (opts.exists || created) return { rows: [] }
        throw new Error('relation "mb_help_feedback" does not exist')
      }
      if (/information_schema\.columns/.test(sql)) return { rows: opts.hasZone === false ? [] : [{ '?column?': 1 }] }
      if (/^\s*(CREATE|ALTER)/.test(sql)) {
        if (opts.denyCreate) throw new Error('permissão negada para esquema public')
        created = true
        return { rows: [] }
      }
      if (/^\s*INSERT INTO mb_help_feedback/.test(sql)) return { rows: [], rowCount: 1 }
      return { rows: [] }
    },
  }
}

/** Remove comentários e espaços repetidos: compara o SQL, não a formatação. */
const norm = (s: string) => s.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').replace(/\s*;\s*/g, ';').trim().toLowerCase()

describe('script único para o cliente (scripts/cliente-tabelas-metabuilder.sql)', () => {
  const fs = req('node:fs') as typeof import('node:fs')
  const path = req('node:path') as typeof import('node:path')
  const script = fs.readFileSync(path.resolve(__dirname, '../../../scripts/cliente-tabelas-metabuilder.sql'), 'utf8')
  const pgPart = script.split('-- #  ORACLE')[0]
  const oraPart = '-- #  ORACLE' + script.split('-- #  ORACLE')[1]

  it('traz o MESMO DDL de aprovações que o Agente usa (PostgreSQL e Oracle)', () => {
    const { approvalDdl } = req('../../../cli/bpmCore.js')
    for (const stmt of approvalDdl('postgres')) expect(norm(pgPart)).toContain(norm(stmt) + ';')
    for (const stmt of approvalDdl('oracle')) expect(norm(oraPart)).toContain(norm(stmt) + ';')
  })

  it('traz o MESMO DDL de feedback da Ajuda e de log de banco que o Agente usa', () => {
    const { CREATE_TABLE_SQL } = req(HF)
    const feedbackCreate = CREATE_TABLE_SQL.split(/;\s*\n/)[0]
    const feedbackIndex = CREATE_TABLE_SQL.split(/;\s*\n/)[2]
    expect(norm(pgPart)).toContain(norm(feedbackCreate) + ';')
    expect(norm(pgPart)).toContain(norm(feedbackIndex))
    // mb_logs: o DDL do logger (tabela + 3 índices)
    const loggerSrc = fs.readFileSync(path.resolve(__dirname, '../../../cli/cliDbLogger.js'), 'utf8')
    const loggerDdl = /return `([\s\S]*?)`;/.exec(loggerSrc)![1]
    for (const stmt of loggerDdl.split(';').map(s => s.trim()).filter(Boolean)) expect(norm(pgPart)).toContain(norm(stmt) + ';')
  })

  it('dá permissão ao usuário do Agente nas 4 tabelas (e nas sequências das tabelas com BIGSERIAL), sem DELETE nas aprovações', () => {
    for (const t of ['mb_approval_tasks', 'mb_approval_history', 'mb_help_feedback', 'mb_logs']) expect(pgPart).toMatch(new RegExp(`GRANT [A-Z, ]+ ON ${t}\\s+TO mb_agent`))
    expect(pgPart).toMatch(/SEQUENCE mb_help_feedback_id_seq/)
    expect(pgPart).toMatch(/SEQUENCE mb_logs_id_seq/)
    expect(pgPart).not.toMatch(/GRANT [A-Z, ]*DELETE[A-Z, ]* ON mb_approval/)
  })

  it('não leva comandos que mudam permissão de forma ampla (nada de SUPERUSER, DROP ou GRANT ALL)', () => {
    expect(script).not.toMatch(/\b(DROP|TRUNCATE|SUPERUSER|GRANT ALL|ALTER USER|CREATE (ROLE|USER))\b/i)
  })
})

describe('feedback da Ajuda (mb_help_feedback)', () => {
  beforeEach(() => { delete req.cache[req.resolve(HF)] }) // tableReady é do módulo

  const vote = { vote: 'up', screen: 's1', field: 'f1', zone: 'grid' }

  it('tabela criada pelo DBA: grava o voto sem tentar criar nada, mesmo com CREATE recusado', async () => {
    const { saveHelpFeedback } = req(HF)
    const pg = fakePg({ exists: true, denyCreate: true })
    const r = await saveHelpFeedback(pg, vote)
    expect(r.ok).toBe(true)
    expect(pg.log.some(l => /^(CREATE|ALTER)/.test(l))).toBe(false)
    expect(pg.log.some(l => /^INSERT INTO mb_help_feedback/.test(l))).toBe(true)
  })

  it('tabela antiga sem a coluna zone: grava sem a zona', async () => {
    const { saveHelpFeedback } = req(HF)
    const pg = fakePg({ exists: true, denyCreate: true, hasZone: false })
    const r = await saveHelpFeedback(pg, vote)
    expect(r.ok).toBe(true)
  })

  it('sem tabela e sem permissão: devolve NO_TABLE com o script para o DBA', async () => {
    const { saveHelpFeedback } = req(HF)
    const pg = fakePg({ exists: false, denyCreate: true })
    const r = await saveHelpFeedback(pg, vote)
    expect(r).toMatchObject({ ok: false, code: 'NO_TABLE' })
    expect(r.script).toMatch(/CREATE TABLE IF NOT EXISTS mb_help_feedback/)
  })

  it('sem tabela e com permissão: cria e grava', async () => {
    const { saveHelpFeedback } = req(HF)
    const pg = fakePg({ exists: false, denyCreate: false })
    const r = await saveHelpFeedback(pg, vote)
    expect(r.ok).toBe(true)
    expect(pg.log.some(l => /^CREATE TABLE/.test(l))).toBe(true)
  })
})

describe('log de banco do túnel (mb_logs)', () => {
  beforeEach(() => { delete req.cache[req.resolve(LG)] })
  const cfg = { enabled: true, types: ['SQL_ERROR'], retention_days: 7 }

  it('tabela criada pelo DBA: o log inicia sem tentar criar (CREATE recusado não derruba)', async () => {
    const { cliDbLogger } = req(LG)
    const pg = fakePg({ exists: true, denyCreate: true })
    await cliDbLogger.init(pg, 'public', cfg)
    expect(pg.log.some(l => /^CREATE/.test(l))).toBe(false)
    expect(cliDbLogger._ready).toBe(true)
  })

  it('sem tabela e com permissão: cria e inicia', async () => {
    const { cliDbLogger } = req(LG)
    const pg = fakePg({ exists: false, denyCreate: false })
    await cliDbLogger.init(pg, 'public', cfg)
    expect(pg.log.some(l => /^CREATE TABLE/.test(l))).toBe(true)
    expect(cliDbLogger._ready).toBe(true)
  })

  it('sem tabela e sem permissão: não inicia (e não quebra)', async () => {
    const { cliDbLogger } = req(LG)
    const pg = fakePg({ exists: false, denyCreate: true })
    await cliDbLogger.init(pg, 'public', cfg)
    expect(cliDbLogger._ready).toBeFalsy()
  })
})
