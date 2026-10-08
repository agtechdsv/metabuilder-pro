/**
 * Auditoria por tabela: quando e por quem cada registro foi criado/alterado.
 *
 * O dev escolhe (ou o sistema reconhece pelo nome) quatro colunas da tabela. Quem PREENCHE é o servidor (o Agente CLI, ou o
 * app exportado), nunca a tela: o que o navegador mandar nessas colunas é descartado, `criado_*` não muda depois de criado e
 * `*_por` recebe o dado do usuário logado (o id, por padrão), lido da sessão assinada.
 *
 * Este arquivo é puro e é copiado para o app exportado (lib/rowPolicy/audit.ts).
 */
import type { RlsSource } from '../bi/access'

export interface AuditColumns {
  createdAt?: string
  createdBy?: string
  updatedAt?: string
  updatedBy?: string
}

/** O que vai gravado em `models.audit_config`. Sem nada salvo, vale o reconhecimento pelo nome. */
export interface AuditConfig extends AuditColumns {
  /** auditoria desligada nesta tabela (nem o reconhecimento pelo nome vale) */
  disabled?: boolean
  /** de onde vem o valor das colunas `*_por`: o id do usuário (padrão), o e-mail, o nome ou outra coluna do cadastro dele */
  by?: { source: RlsSource; attr?: string }
}

export const DEFAULT_AUDIT_BY: { source: RlsSource; attr?: string } = { source: 'user.attr', attr: 'id' }

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/
const ident = (v: unknown): string | undefined => (typeof v === 'string' && IDENT.test(v.trim()) ? v.trim() : undefined)

/** Nomes comuns (português e inglês), em ordem de preferência, de cada coluna de auditoria. */
const CANDIDATES: Record<keyof AuditColumns, string[]> = {
  createdAt: ['criado_em', 'created_at', 'data_criacao', 'dt_criacao', 'createdat', 'criadoem'],
  createdBy: ['criado_por', 'created_by', 'usuario_criacao', 'createdby', 'criadopor'],
  updatedAt: ['atualizado_em', 'updated_at', 'data_atualizacao', 'dt_atualizacao', 'updatedat', 'atualizadoem'],
  updatedBy: ['atualizado_por', 'updated_by', 'usuario_atualizacao', 'updatedby', 'atualizadopor'],
}

/** Reconhece as colunas de auditoria pelo nome (sem diferenciar maiúsculas). */
export function detectAudit(columns: string[]): AuditColumns {
  const out: AuditColumns = {}
  for (const key of Object.keys(CANDIDATES) as Array<keyof AuditColumns>) {
    for (const cand of CANDIDATES[key]) {
      const found = columns.find(c => c.toLowerCase() === cand)
      if (found) { out[key] = found; break }
    }
  }
  return out
}

/** Limpa o que veio do banco/da tela. null = nada configurado (vale o reconhecimento pelo nome). */
export function cleanAuditConfig(raw: unknown): AuditConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const cfg: AuditConfig = {}
  if (r.disabled === true) cfg.disabled = true
  for (const k of ['createdAt', 'createdBy', 'updatedAt', 'updatedBy'] as const) {
    const v = ident(r[k])
    if (v) cfg[k] = v
  }
  const by = r.by as any
  if (by && typeof by === 'object' && (by.source === 'user.email' || by.source === 'user.name' || by.source === 'user.attr')) {
    const attr = ident(by.attr)
    if (by.source !== 'user.attr') cfg.by = { source: by.source }
    else if (attr) cfg.by = { source: 'user.attr', attr }
  }
  return Object.keys(cfg).length ? cfg : null
}

export interface EffectiveAudit {
  columns: AuditColumns
  by: { source: RlsSource; attr?: string }
}

/**
 * O que vale numa tabela: o salvo pelo dev, ou o reconhecido pelo nome. Só entram colunas que existem de verdade na tabela
 * (uma coluna salva que foi removida do banco é ignorada, em vez de quebrar a gravação).
 */
export function effectiveAudit(saved: AuditConfig | null | undefined, tableColumns: string[]): EffectiveAudit | null {
  if (saved?.disabled) return null
  const exists = (c?: string) => (c ? tableColumns.find(x => x.toLowerCase() === c.toLowerCase()) : undefined)
  const hasSaved = !!saved && (saved.createdAt || saved.createdBy || saved.updatedAt || saved.updatedBy)
  const picked: AuditColumns = hasSaved
    ? {
        createdAt: exists(saved!.createdAt), createdBy: exists(saved!.createdBy),
        updatedAt: exists(saved!.updatedAt), updatedBy: exists(saved!.updatedBy),
      }
    : detectAudit(tableColumns)
  const columns: AuditColumns = {}
  for (const k of ['createdAt', 'createdBy', 'updatedAt', 'updatedBy'] as const) if (picked[k]) columns[k] = picked[k]
  if (Object.keys(columns).length === 0) return null
  return { columns, by: saved?.by || DEFAULT_AUDIT_BY }
}

/** Colunas do cadastro do usuário que a auditoria usa (o login as grava na sessão assinada). */
export function auditAttrColumn(by: { source: RlsSource; attr?: string } | undefined): string | null {
  return by?.source === 'user.attr' && by.attr ? by.attr : null
}

// ── SQL para o desenvolvedor aplicar no banco (PostgreSQL) ───────────────────────

const q = (s: string) => '"' + s.replace(/"/g, '""') + '"'

/**
 * Script que cria as colunas de auditoria que faltam na tabela (e o gatilho que cuida das datas em qualquer caminho de
 * gravação). O MetaBuilder não altera o banco do cliente: quem aplica é o desenvolvedor.
 * `authTable` é a tabela de login, referenciada por `criado_por`/`atualizado_por`.
 */
export function auditSql(opts: { table: string; schema?: string; authTable?: string; authKey?: string; existing?: string[]; names?: AuditColumns }): string {
  // sem esquema, os nomes saem sem prefixo: valem no esquema padrão da conexão (o nome "crm" do Studio é o do banco, não necessariamente o esquema)
  const schema = opts.schema || ''
  const qual = (name: string) => (schema ? `${q(schema)}.${q(name)}` : q(name))
  const names: Required<AuditColumns> = {
    createdAt: opts.names?.createdAt || 'criado_em',
    createdBy: opts.names?.createdBy || 'criado_por',
    updatedAt: opts.names?.updatedAt || 'atualizado_em',
    updatedBy: opts.names?.updatedBy || 'atualizado_por',
  }
  const has = (c: string) => (opts.existing || []).some(x => x.toLowerCase() === c.toLowerCase())
  const target = qual(opts.table)
  const ref = opts.authTable ? ` REFERENCES ${qual(opts.authTable)}(${q(opts.authKey || 'id')}) ON DELETE SET NULL` : ''
  const lines: string[] = []
  if (!has(names.createdAt)) lines.push(`ALTER TABLE ${target} ADD COLUMN IF NOT EXISTS ${q(names.createdAt)} timestamptz NOT NULL DEFAULT now();`)
  if (!has(names.createdBy)) lines.push(`ALTER TABLE ${target} ADD COLUMN IF NOT EXISTS ${q(names.createdBy)} uuid${ref};`)
  if (!has(names.updatedAt)) lines.push(`ALTER TABLE ${target} ADD COLUMN IF NOT EXISTS ${q(names.updatedAt)} timestamptz NOT NULL DEFAULT now();`)
  if (!has(names.updatedBy)) lines.push(`ALTER TABLE ${target} ADD COLUMN IF NOT EXISTS ${q(names.updatedBy)} uuid${ref};`)
  const fn = qual(`mb_auditoria_${opts.table.replace(/[^A-Za-z0-9_]/g, '_')}`)
  return [
    `-- Auditoria da tabela ${opts.table} (PostgreSQL). Aplique no banco do cliente.`,
    ...lines,
    '',
    `CREATE OR REPLACE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$`,
    'BEGIN',
    `  NEW.${q(names.updatedAt)} := now();`,
    `  NEW.${q(names.createdAt)} := OLD.${q(names.createdAt)};`,
    `  NEW.${q(names.createdBy)} := COALESCE(OLD.${q(names.createdBy)}, NEW.${q(names.createdBy)});`,
    '  RETURN NEW;',
    'END $$;',
    '',
    `DROP TRIGGER IF EXISTS mb_auditoria_update ON ${target};`,
    `CREATE TRIGGER mb_auditoria_update BEFORE UPDATE ON ${target} FOR EACH ROW EXECUTE FUNCTION ${fn}();`,
  ].join('\n')
}
