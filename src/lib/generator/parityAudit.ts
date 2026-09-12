/**
 * parityAudit.ts
 *
 * Detecta divergências entre o schema real do banco (Oracle/Postgres/etc.)
 * introspectado pelo CLI e os metadados armazenados no Supabase (fields.data_type).
 *
 * Regras de severidade:
 *   critical  — divergência que silenciosamente corrompe dados ou quebra queries
 *   warning   — divergência que causa renderização incorreta mas não corrompe dados
 *   info      — diferença semântica de menor impacto
 *
 * Decisões de UX:
 *   Q1 — Modal só exibido quando há warning ou critical
 *   Q2 — critical bloqueia o Build (com opção "Buildar mesmo assim + ciente")
 *   Q3 — auto-fix atualiza o Supabase direto via /api/metadata/reconcile
 *   Q4 — Oracle DATE → timestamp como warning auto-fixável
 */

import { normalizeDbColumnType } from './parser'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export type ParityIssueSeverity = 'critical' | 'warning' | 'info'

export interface ParityIssue {
  fieldId: string
  fieldName: string             // db_column_name
  tableName: string             // db_table_name
  currentType: string           // data_type armazenado no Supabase
  introspectedType: string      // tipo retornado pelo CLI/banco real
  canonicalCurrent: string      // normalizeDbColumnType(currentType)
  canonicalIntrospected: string // normalizeDbColumnType(introspectedType)
  severity: ParityIssueSeverity
  autoFixable: boolean
  explanation: string           // texto amigável para exibir no modal
}

export interface ParityReport {
  projectId: string
  analyzedAt: string
  totalFields: number
  issues: ParityIssue[]
  summary: {
    critical: number
    warning: number
    info: number
    total: number
  }
  hasBlockingIssues: boolean  // true se houver pelo menos 1 critical
}

/** Campo vindo do CLI (introspeção real do banco) */
export interface IntrospectedField {
  tableName: string
  columnName: string
  dbType: string   // tipo nativo do banco (ex: "VARCHAR2", "NUMBER(10,2)")
}

/** Campo armazenado no Supabase */
export interface SupabaseField {
  id: string
  model_id: string
  db_column_name: string
  data_type: string
  ui_widget: string
}

export interface SupabaseModel {
  id: string
  db_table_name: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Regras de severidade
// ─────────────────────────────────────────────────────────────────────────────

interface SeverityRule {
  currentCanonical: string
  introspectedCanonical: string
  severity: ParityIssueSeverity
  autoFixable: boolean
  explanation: string
}

const SEVERITY_RULES: SeverityRule[] = [
  // ── Critical: perda silenciosa de dados ────────────────────────────────────
  {
    currentCanonical: 'integer',
    introspectedCanonical: 'numeric',
    severity: 'critical',
    autoFixable: false,
    explanation:
      'O campo está como integer no Supabase mas é NUMBER com decimais no banco real. ' +
      'Campos de valor monetário ou percentual perderão casas decimais silenciosamente.',
  },
  {
    currentCanonical: 'boolean',
    introspectedCanonical: 'varchar',
    severity: 'critical',
    autoFixable: false,
    explanation:
      'Oracle não possui tipo booleano nativo. O campo provavelmente armazena ' +
      '"true"/"false" como VARCHAR2. Requer mapeamento manual no widget_options.',
  },
  {
    currentCanonical: 'boolean',
    introspectedCanonical: 'integer',
    severity: 'critical',
    autoFixable: false,
    explanation:
      'Oracle usa NUMBER(1) para booleans. O gerador produzirá checkbox mas a ' +
      'query enviará true/false em vez de 1/0. Requer configuração manual.',
  },
  // ── Warning: renderização incorreta, sem perda de dados ───────────────────
  {
    currentCanonical: 'date',
    introspectedCanonical: 'timestamp',
    severity: 'warning',
    autoFixable: true,
    explanation:
      'Oracle DATE inclui hora, minuto e segundo (diferente do DATE do Postgres). ' +
      'Corrigindo para timestamp, o seletor de data também capturará o horário.',
  },
  {
    currentCanonical: 'timestamp',
    introspectedCanonical: 'date',
    severity: 'warning',
    autoFixable: true,
    explanation:
      'O banco real usa DATE mas o Supabase marca como timestamp. ' +
      'O campo de hora aparecerá desnecessariamente na UI.',
  },
  {
    currentCanonical: 'integer',
    introspectedCanonical: 'varchar',
    severity: 'warning',
    autoFixable: false,
    explanation:
      'Campo marcado como integer no Supabase mas é string no banco. ' +
      'Pode causar erros de conversão em filtros e ordenação.',
  },
  {
    currentCanonical: 'varchar',
    introspectedCanonical: 'integer',
    severity: 'warning',
    autoFixable: false,
    explanation:
      'Campo marcado como string no Supabase mas é numérico no banco. ' +
      'Filtros numéricos e ordenação podem não funcionar.',
  },
  // ── Info: diferença semântica sem impacto funcional ───────────────────────
  {
    currentCanonical: 'text',
    introspectedCanonical: 'clob',
    severity: 'info',
    autoFixable: true,
    explanation:
      'CLOB (Oracle) e text (Postgres) têm comportamento equivalente na UI. ' +
      'Normalizar garante consistência semântica no gerador.',
  },
  {
    currentCanonical: 'clob',
    introspectedCanonical: 'text',
    severity: 'info',
    autoFixable: true,
    explanation: 'Tipos equivalentes: CLOB ↔ text. Diferença apenas semântica.',
  },
]

function classifyIssue(
  canonicalCurrent: string,
  canonicalIntrospected: string,
  currentRaw: string,
  introspectedRaw: string,
): Pick<ParityIssue, 'severity' | 'autoFixable' | 'explanation'> {
  const rule = SEVERITY_RULES.find(
    r =>
      r.currentCanonical === canonicalCurrent &&
      r.introspectedCanonical === canonicalIntrospected
  )

  if (rule) {
    return { severity: rule.severity, autoFixable: rule.autoFixable, explanation: rule.explanation }
  }

  // Regra genérica: canônicos diferentes sem regra específica = warning manual
  return {
    severity: 'warning',
    autoFixable: false,
    explanation:
      `Tipo no Supabase ("${currentRaw}") difere do tipo real no banco ("${introspectedRaw}"). ` +
      `Canônicos: ${canonicalCurrent} ↔ ${canonicalIntrospected}. Revise manualmente.`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Função principal de geração de relatório
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gera o relatório de paridade comparando o schema introspectado pelo CLI
 * com os metadados armazenados no Supabase.
 *
 * Apenas campos com divergência real (canonicals diferentes) são incluídos.
 */
export function generateParityReport(
  projectId: string,
  introspectedSchema: IntrospectedField[],
  supabaseModels: SupabaseModel[],
  supabaseFields: SupabaseField[]
): ParityReport {
  const issues: ParityIssue[] = []

  // Indexa modelId → tableName
  const modelIndex: Record<string, string> = {}
  for (const model of supabaseModels) {
    modelIndex[model.id] = model.db_table_name
  }

  // Indexa "tableName.columnName" (lowercase) → SupabaseField
  const supabaseIndex: Record<string, SupabaseField> = {}
  for (const field of supabaseFields) {
    const tableName = modelIndex[field.model_id]
    if (tableName) {
      const key = `${tableName.toLowerCase()}.${field.db_column_name.toLowerCase()}`
      supabaseIndex[key] = field
    }
  }

  for (const introspected of introspectedSchema) {
    const key = `${introspected.tableName.toLowerCase()}.${introspected.columnName.toLowerCase()}`
    const sbField = supabaseIndex[key]

    // Campo não existe no Supabase ainda — será criado pelo sync normal
    if (!sbField) continue

    const currentRaw = sbField.data_type || ''
    const introspectedRaw = introspected.dbType || ''

    const canonicalCurrent = normalizeDbColumnType(currentRaw)
    const canonicalIntrospected = normalizeDbColumnType(introspectedRaw)

    // Tipos canônicos idênticos → sem issue
    if (canonicalCurrent === canonicalIntrospected) continue

    const { severity, autoFixable, explanation } = classifyIssue(
      canonicalCurrent,
      canonicalIntrospected,
      currentRaw,
      introspectedRaw,
    )

    issues.push({
      fieldId: sbField.id,
      fieldName: introspected.columnName,
      tableName: introspected.tableName,
      currentType: currentRaw,
      introspectedType: introspectedRaw,
      canonicalCurrent,
      canonicalIntrospected,
      severity,
      autoFixable,
      explanation,
    })
  }

  const summary = {
    critical: issues.filter(i => i.severity === 'critical').length,
    warning: issues.filter(i => i.severity === 'warning').length,
    info: issues.filter(i => i.severity === 'info').length,
    total: issues.length,
  }

  return {
    projectId,
    analyzedAt: new Date().toISOString(),
    totalFields: introspectedSchema.length,
    issues,
    summary,
    hasBlockingIssues: summary.critical > 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Aplicar correções via /api/metadata/reconcile
// ─────────────────────────────────────────────────────────────────────────────

export interface ReconcileResult {
  updated: number
  skipped: number
  errors: string[]
}

/**
 * Envia os fieldIds selecionados para o endpoint de reconciliação,
 * que atualiza fields.data_type e fields.ui_widget no Supabase.
 * Apenas issues com autoFixable=true são processados.
 */
export async function applyParityFixes(
  report: ParityReport,
  selectedFieldIds: string[]
): Promise<ReconcileResult> {
  const toFix = report.issues.filter(
    i => selectedFieldIds.includes(i.fieldId) && i.autoFixable
  )

  if (toFix.length === 0) {
    return { updated: 0, skipped: selectedFieldIds.length, errors: [] }
  }

  const res = await fetch('/api/metadata/reconcile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: report.projectId,
      fixes: toFix.map(i => ({
        fieldId: i.fieldId,
        newDataType: i.introspectedType,
        newUiWidget: resolveUiWidget(i.canonicalIntrospected),
      })),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { updated: 0, skipped: toFix.length, errors: [err] }
  }

  return res.json() as Promise<ReconcileResult>
}

/** Determina o ui_widget mais adequado para o tipo canônico introspectado */
function resolveUiWidget(canonical: string): string {
  if (canonical === 'boolean') return 'checkbox'
  if (canonical === 'integer' || canonical === 'numeric') return 'number_input'
  if (canonical === 'date' || canonical === 'timestamp' || canonical === 'time') return 'date_picker'
  if (canonical === 'uuid') return 'uuid_input'
  return 'text_input'
}
