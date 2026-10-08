import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { auditSql, cleanAuditConfig, detectAudit, effectiveAudit } from '../audit'
import { resolveAccess, type TableAccessConfig } from '../policy'

const req = createRequire(import.meta.url)
const { enforceWrite, applyAudit } = req('../../../../cli/sqlPolicy.js') as any

const COLS_PT = ['id', 'nome', 'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por']
const COLS_EN = ['id', 'name', 'created_at', 'created_by', 'updated_at', 'updated_by']

describe('reconhecimento e configuração', () => {
  it('reconhece as quatro colunas pelo nome, em português e em inglês, sem diferenciar maiúsculas', () => {
    expect(detectAudit(COLS_PT)).toEqual({ createdAt: 'criado_em', createdBy: 'criado_por', updatedAt: 'atualizado_em', updatedBy: 'atualizado_por' })
    expect(detectAudit(COLS_EN)).toEqual({ createdAt: 'created_at', createdBy: 'created_by', updatedAt: 'updated_at', updatedBy: 'updated_by' })
    expect(detectAudit(['ID', 'CRIADO_EM'])).toEqual({ createdAt: 'CRIADO_EM' })
    expect(detectAudit(['id', 'nome'])).toEqual({})
  })

  it('sem configuração salva vale o reconhecido; com ela, só o que está salvo (e que ainda existe na tabela)', () => {
    expect(effectiveAudit(null, COLS_PT)?.columns.createdBy).toBe('criado_por')
    expect(effectiveAudit(null, ['id'])).toBeNull()
    const saved = cleanAuditConfig({ createdAt: 'dt_cad', createdBy: 'quem_cadastrou' })
    expect(effectiveAudit(saved, ['id', 'dt_cad'])?.columns).toEqual({ createdAt: 'dt_cad' })
    // coluna salva que sumiu do banco é ignorada, em vez de quebrar a gravação
    expect(effectiveAudit(cleanAuditConfig({ createdBy: 'sumiu' }), COLS_PT)).toBeNull()
  })

  it('desligada, nem o reconhecimento pelo nome vale; o valor do usuário padrão é o id', () => {
    expect(effectiveAudit({ disabled: true }, COLS_PT)).toBeNull()
    expect(effectiveAudit(null, COLS_PT)?.by).toEqual({ source: 'user.attr', attr: 'id' })
    expect(effectiveAudit(cleanAuditConfig({ createdBy: 'criado_por', by: { source: 'user.email' } }), COLS_PT)?.by).toEqual({ source: 'user.email' })
  })

  it('limpa o que vem do navegador: nomes inválidos somem', () => {
    expect(cleanAuditConfig({ createdAt: 'a"; DROP', createdBy: 'ok_col', by: { source: 'user.attr', attr: 'x y' } })).toEqual({ createdBy: 'ok_col' })
    expect(cleanAuditConfig(null)).toBeNull()
    expect(cleanAuditConfig({})).toBeNull()
  })
})

describe('SQL de auditoria', () => {
  it('cria só as colunas que faltam, com a chave estrangeira para a tabela de login, e o gatilho das datas', () => {
    const sql = auditSql({ table: 'clientes', authTable: 'usuarios', existing: ['id', 'criado_em'] })
    expect(sql).not.toContain('ADD COLUMN IF NOT EXISTS "criado_em"')
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "criado_por" uuid REFERENCES "usuarios"("id") ON DELETE SET NULL')
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "atualizado_em" timestamptz NOT NULL DEFAULT now()')
    expect(sql).toContain('CREATE TRIGGER mb_auditoria_update BEFORE UPDATE ON "clientes"')
    expect(sql).toContain('NEW."criado_em" := OLD."criado_em"')
    // sem esquema: o nome "crm" do Studio é o do banco, não o esquema
    expect(sql).not.toContain('crm')
  })

  it('usa os nomes escolhidos pelo desenvolvedor', () => {
    const sql = auditSql({ table: 'pedidos', existing: [], names: { createdAt: 'created_at', createdBy: 'created_by', updatedAt: 'updated_at', updatedBy: 'updated_by' } })
    expect(sql).toContain('"created_by" uuid')
    expect(sql).toContain('NEW."updated_at" := now()')
  })
})

describe('resolveAccess com auditoria', () => {
  const cfg = (audit: any): TableAccessConfig => ({ table: 'Clientes', canCreate: true, canUpdate: true, canDelete: true, policy: null, audit })

  it('vai o valor do usuário (o id, por padrão) junto das colunas; sem o dado, fica nulo', () => {
    const eff = effectiveAudit(null, COLS_PT)
    expect(resolveAccess([cfg(eff)], { attrs: { id: 'u-1' } }).audit).toEqual({
      clientes: { createdAt: 'criado_em', createdBy: 'criado_por', updatedAt: 'atualizado_em', updatedBy: 'atualizado_por', actor: 'u-1' },
    })
    expect(resolveAccess([cfg(eff)], null).audit?.clientes.actor).toBeNull()
    expect(resolveAccess([cfg(null)], { attrs: { id: 'u-1' } }).audit).toBeUndefined()
  })
})

describe('Agente: a auditoria é do servidor, não da tela', () => {
  const audit = { clientes: { createdAt: 'criado_em', createdBy: 'criado_por', updatedAt: 'atualizado_em', updatedBy: 'atualizado_por', actor: 'u-7' } }
  const access = { policies: [], flags: {}, audit }
  const write = (action: string, data: any, over: any = {}) => enforceWrite({ access, action, table: 'clientes', data, dbType: 'postgres', query: async () => [{ c: 1 }], ...over })

  it('insert: preenche quando e por quem, e descarta o que a tela mandou nessas colunas', async () => {
    const out = await write('insert', { nome: 'ACME', criado_por: 'outro-usuario', criado_em: '1999-01-01', ATUALIZADO_POR: 'x' })
    expect(out.nome).toBe('ACME')
    expect(out.criado_por).toBe('u-7')
    expect(out.atualizado_por).toBe('u-7')
    expect(out.criado_em).not.toBe('1999-01-01')
    expect(new Date(out.criado_em).getFullYear()).toBeGreaterThan(2024)
    expect(out.atualizado_em).toBeDefined()
    expect(Object.keys(out).filter(k => k.toLowerCase() === 'atualizado_por')).toEqual(['atualizado_por'])
  })

  it('update: só atualizado_*; criado_* nunca muda, mesmo que a tela mande', async () => {
    const out = await write('update', { nome: 'Novo', criado_por: 'invasor', criado_em: '2000-01-01' }, { idColumn: 'id', idValue: '1' })
    expect(out.criado_por).toBeUndefined()
    expect(out.criado_em).toBeUndefined()
    expect(out.atualizado_por).toBe('u-7')
    expect(out.atualizado_em).toBeDefined()
  })

  it('sem o dado do usuário, as colunas "por" ficam vazias (e as datas são preenchidas)', async () => {
    const semUsuario = { policies: [], flags: {}, audit: { clientes: { ...audit.clientes, actor: null } } }
    const out = await enforceWrite({ access: semUsuario, action: 'insert', table: 'clientes', data: { nome: 'x', criado_por: 'forjado' }, dbType: 'postgres', query: async () => [] })
    expect(out.criado_por).toBeUndefined()
    expect(out.criado_em).toBeDefined()
  })

  it('combina com a regra por linha "só o que eu criei": o valor do servidor satisfaz a regra e o forjado não a engana', async () => {
    const withRule = { policies: [{ table: 'clientes', conds: [{ column: 'criado_por', op: 'eq', values: ['u-7'] }] }], flags: {}, audit }
    const out = await enforceWrite({ access: withRule, action: 'insert', table: 'clientes', data: { nome: 'x', criado_por: 'outro' }, dbType: 'postgres', query: async () => [] })
    expect(out.criado_por).toBe('u-7')
  })

  it('tabela sem auditoria não é alterada; delete e leitura não mexem em nada', async () => {
    expect(applyAudit(access, 'produtos', 'insert', { nome: 'x' })).toEqual({ nome: 'x' })
    expect(await write('delete', undefined, { idColumn: 'id', idValue: '1' })).toBeUndefined()
  })
})
