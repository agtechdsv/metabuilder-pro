'use client'

/**
 * ParityReportModal.tsx
 *
 * Modal exibido após Eject & Sync quando há divergências de tipo (warning ou critical)
 * entre o schema real do banco e os metadados do Supabase.
 *
 * Comportamento:
 *   - warning  → avisa, permite buildar normalmente
 *   - critical → bloqueia o Build; usuário precisa corrigir ou aceitar o risco conscientemente
 *   - auto-fix → seleciona issues autoFixable e envia para /api/metadata/reconcile
 */

import { useState, useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { applyParityFixes, type ParityReport, type ParityIssue } from '@/lib/generator/parityAudit'
import {
  AlertTriangle,
  XCircle,
  Info,
  CheckCircle2,
  Wrench,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ParityReportModalProps {
  isOpen: boolean
  report: ParityReport | null
  onClose: () => void
  /** Chamado quando o usuário clica em Build (após confirmar riscos se houver critical) */
  onProceedToBuild: () => void
  /** Chamado após auto-fix bem-sucedido para re-render do estado externo */
  onAfterFix?: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: {
    label: 'Crítico',
    icon: XCircle,
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    badge: 'bg-red-500/20 text-red-400',
  },
  warning: {
    label: 'Aviso',
    icon: AlertTriangle,
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-400',
  },
  info: {
    label: 'Info',
    icon: Info,
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    badge: 'bg-blue-500/20 text-blue-400',
  },
}

function SeverityBadge({ severity }: { severity: ParityIssue['severity'] }) {
  const cfg = SEVERITY_CONFIG[severity]
  const Icon = cfg.icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', cfg.badge)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

function IssueRow({
  issue,
  checked,
  onToggle,
}: {
  issue: ParityIssue
  checked: boolean
  onToggle: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SEVERITY_CONFIG[issue.severity]

  return (
    <div className={cn('rounded-xl border p-3 transition-all', cfg.bg, cfg.border)}>
      <div className="flex items-start gap-3">
        {/* Checkbox para auto-fix */}
        {issue.autoFixable ? (
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggle(issue.fieldId)}
            className="mt-1 accent-indigo-500 w-4 h-4 shrink-0 cursor-pointer"
          />
        ) : (
          <div className="w-4 h-4 mt-1 shrink-0 rounded border border-neutral-700 bg-neutral-800 flex items-center justify-center">
            <span className="text-neutral-600 text-[8px]">–</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <SeverityBadge severity={issue.severity} />
            <span className="font-mono text-xs text-neutral-300 font-semibold">
              {issue.tableName}.<span className={cfg.text}>{issue.fieldName}</span>
            </span>
            {issue.autoFixable && (
              <span className="text-[10px] text-indigo-400 font-medium">✦ auto-fix</span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
            <span className="bg-neutral-800 px-1.5 py-0.5 rounded font-mono">{issue.currentType}</span>
            <span className="text-neutral-600">→</span>
            <span className="bg-neutral-800 px-1.5 py-0.5 rounded font-mono text-green-400">{issue.introspectedType}</span>
          </div>

          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
          </button>

          {expanded && (
            <p className="mt-2 text-xs text-neutral-400 leading-relaxed border-t border-neutral-700/50 pt-2">
              {issue.explanation}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal principal
// ─────────────────────────────────────────────────────────────────────────────

export function ParityReportModal({
  isOpen,
  report,
  onClose,
  onProceedToBuild,
  onAfterFix,
}: ParityReportModalProps) {
  const { toast } = useToast()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [riskAccepted, setRiskAccepted] = useState(false)
  const [isFixing, setIsFixing] = useState(false)
  const [fixResult, setFixResult] = useState<{ updated: number; errors: string[] } | null>(null)

  const autoFixableIssues = useMemo(
    () => report?.issues.filter(i => i.autoFixable) ?? [],
    [report]
  )

  const allAutoSelected = autoFixableIssues.length > 0 && autoFixableIssues.every(i => selectedIds.has(i.fieldId))

  function toggleSelectAll() {
    if (allAutoSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(autoFixableIssues.map(i => i.fieldId)))
    }
  }

  function toggleIssue(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleApplyFix() {
    if (!report || selectedIds.size === 0) return
    setIsFixing(true)
    setFixResult(null)

    try {
      const result = await applyParityFixes(report, Array.from(selectedIds))
      setFixResult(result)

      if (result.updated > 0) {
        toast(`✅ ${result.updated} campo(s) corrigido(s) no Supabase.`, 'success')
        onAfterFix?.()
        // Desmarca os corrigidos
        setSelectedIds(new Set())
      }
      if (result.errors.length > 0) {
        toast(`⚠️ ${result.errors.length} erro(s) durante a correção.`, 'error')
      }
    } catch (e: any) {
      toast(`Erro ao aplicar correções: ${e.message}`, 'error')
    } finally {
      setIsFixing(false)
    }
  }

  function handleBuild() {
    if (!report) return
    if (report.hasBlockingIssues && !riskAccepted) return
    onProceedToBuild()
    onClose()
  }

  if (!report) return null

  const { summary, issues, hasBlockingIssues, totalFields } = report

  // Ordena: critical primeiro, depois warning, depois info
  const sortedIssues = [...issues].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return order[a.severity] - order[b.severity]
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Relatório de Paridade — Eject & Sync"
      description={`${totalFields} campos analisados · ${summary.total} divergência(s) encontrada(s)`}
      size="xl"
    >
      {/* Resumo de severidades */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { key: 'critical', count: summary.critical, label: 'Críticos', color: 'border-red-500/30 bg-red-500/10 text-red-400' },
          { key: 'warning', count: summary.warning, label: 'Avisos', color: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
          { key: 'info', count: summary.info, label: 'Informativos', color: 'border-blue-500/30 bg-blue-500/10 text-blue-400' },
        ].map(({ key, count, label, color }) => (
          <div key={key} className={cn('rounded-xl border p-3 text-center', color)}>
            <div className="text-2xl font-black">{count}</div>
            <div className="text-xs font-medium opacity-80">{label}</div>
          </div>
        ))}
      </div>

      {/* Aviso de bloqueio de Build */}
      {hasBlockingIssues && (
        <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 flex gap-3">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-400 mb-1">Build bloqueado por issues críticos</p>
            <p className="text-xs text-red-300/80">
              Há {summary.critical} campo(s) com divergência crítica que podem causar perda silenciosa de dados.
              Corrija-os ou aceite o risco explicitamente para continuar o Build.
            </p>
          </div>
        </div>
      )}

      {/* Seletor de auto-fix */}
      {autoFixableIssues.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-neutral-400">
            {selectedIds.size} de {autoFixableIssues.length} auto-fixáveis selecionados
          </span>
          <button
            onClick={toggleSelectAll}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
          >
            {allAutoSelected ? 'Desmarcar todos' : 'Selecionar todos auto-fix'}
          </button>
        </div>
      )}

      {/* Lista de issues */}
      <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1 mb-5">
        {sortedIssues.map(issue => (
          <IssueRow
            key={issue.fieldId}
            issue={issue}
            checked={selectedIds.has(issue.fieldId)}
            onToggle={toggleIssue}
          />
        ))}
      </div>

      {/* Resultado do fix */}
      {fixResult && (
        <div className={cn(
          'mb-4 rounded-xl border p-3 flex items-center gap-2 text-sm',
          fixResult.errors.length > 0
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
            : 'border-green-500/30 bg-green-500/10 text-green-400'
        )}>
          {fixResult.errors.length > 0
            ? <AlertTriangle className="w-4 h-4 shrink-0" />
            : <CheckCircle2 className="w-4 h-4 shrink-0" />
          }
          {fixResult.updated > 0 && <span>{fixResult.updated} campo(s) corrigido(s) com sucesso.</span>}
          {fixResult.errors.length > 0 && <span>{fixResult.errors.length} erro(s): {fixResult.errors[0]}</span>}
        </div>
      )}

      {/* Aceitar risco (só exibe se há critical) */}
      {hasBlockingIssues && (
        <label className="flex items-start gap-3 mb-4 cursor-pointer group">
          <input
            type="checkbox"
            checked={riskAccepted}
            onChange={e => setRiskAccepted(e.target.checked)}
            className="mt-0.5 accent-amber-500 w-4 h-4 shrink-0"
          />
          <span className="text-xs text-neutral-400 group-hover:text-neutral-300 transition-colors">
            Estou ciente dos riscos de integridade de dados e desejo continuar o Build mesmo assim.
          </span>
        </label>
      )}

      {/* Ações */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-neutral-800">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          Fechar
        </button>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleApplyFix}
              disabled={isFixing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isFixing
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Wrench className="w-4 h-4" />
              }
              {isFixing ? 'Corrigindo…' : `Corrigir ${selectedIds.size} campo(s)`}
            </button>
          )}

          <button
            onClick={handleBuild}
            disabled={hasBlockingIssues && !riskAccepted}
            className={cn(
              'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all',
              hasBlockingIssues && !riskAccepted
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-500 text-white'
            )}
          >
            {hasBlockingIssues && !riskAccepted
              ? <ShieldAlert className="w-4 h-4" />
              : <CheckCircle2 className="w-4 h-4" />
            }
            {hasBlockingIssues && !riskAccepted ? 'Build bloqueado' : 'Ir para Build'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
