import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { parseMetaBuilderJSON } from '../parser'
import { generateNodeProject } from '../emitter/node-project'

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const f = (id: string, model: string, col: string, type: string, pk = false) =>
  ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, is_primary_key: pk })

const raw = () => ({
  project: { id: 'p1', name: 'Vendas', slug: 'vendas' },
  auth_config: { auth_type: 'database', table_name: 'usuarios', email_column: 'email', password_column: 'hash_senha' },
  models: [{ id: 'mu', db_table_name: 'usuarios', display_name: 'Usuarios', db_schema_name: 'public' }],
  fields: [f('a', 'mu', 'id', 'integer', true), f('b', 'mu', 'email', 'varchar'), f('c', 'mu', 'hash_senha', 'varchar')],
  relations: [],
  views: [],
  access_admin: { enabled: true, ui: {}, roles: [{ id: 'g1', name: 'Administrador' }], permissions: [], userRoles: [] },
})

// Roda o script gerado (npm run db:setup) de verdade, com um "pg" de mentira que registra os comandos
describe('scripts/setup-access.mjs (gerado)', () => {
  let dir = ''
  const run = (args: string[], tablesExist: boolean) =>
    execFileSync(process.execPath, ['scripts/setup-access.mjs', ...args], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgres://crm:x@localhost:5432/crm', FAKE_TABLES: tablesExist ? '1' : '0' },
    })

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'mb-setup-'))
    const files = generateNodeProject(parseMetaBuilderJSON(raw(), 'postgres'))
    for (const p of ['scripts/setup-access.mjs', 'db/access-control.json']) {
      mkdirSync(join(dir, p, '..'), { recursive: true })
      writeFileSync(join(dir, p), files.get(p)!)
    }
    mkdirSync(join(dir, 'node_modules', 'pg'), { recursive: true })
    writeFileSync(join(dir, 'node_modules', 'pg', 'index.js'), `
      class Client {
        constructor(o) { this.o = o }
        async connect() {}
        async end() {}
        async query(s) {
          if (/COUNT\\(\\*\\)/.test(s)) {
            if (process.env.FAKE_TABLES !== '1') throw new Error('relação não existe')
            return { rows: [{ count: '7' }] }
          }
          console.log('SQL: ' + s.split('\\n')[0])
          return { rows: [] }
        }
      }
      module.exports = { Client }
    `)
    writeFileSync(join(dir, 'package.json'), '{"type":"commonjs"}')
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('--check: tabelas existentes → "exists N", sem rodar nenhum comando de escrita', () => {
    const out = run(['--check'], true)
    expect(out).toContain('MB_ACCESS_CHECK exists 7')
    expect(out).not.toContain('SQL:')
  })

  it('--check: tabelas ausentes → "missing"', () => {
    expect(run(['--check'], false)).toContain('MB_ACCESS_CHECK missing')
  })

  it('sem --check: cria as tabelas e grava os dados do projeto', () => {
    const out = run([], true)
    expect(out).toContain('SQL: CREATE TABLE IF NOT EXISTS mb_role_permissions')
    expect(out).toContain('SQL: INSERT INTO mb_role_permissions')
    expect(out).toContain('Tabelas de acesso prontas (PostgreSQL)')
  })
})
