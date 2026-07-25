'use client'

import { Check, X, AlertTriangle, ShieldAlert } from 'lucide-react'

interface MigrationReviewProps {
  migrations: string[]
  approvedIndices: Set<number>
  onToggleApproval: (index: number) => void
  onToggleAll: (selectAll: boolean) => void
}

function classifyRisk(sql: string): { level: 'safe' | 'warning' | 'danger'; label: string } {
  const upper = sql.toUpperCase()
  if (upper.includes('DROP TABLE') || upper.includes('DROP COLUMN')) {
    return { level: 'danger', label: '⚠️ Perigo — Remove dados permanentemente' }
  }
  if (upper.includes('ALTER TABLE') || upper.includes('TRUNCATE')) {
    return { level: 'warning', label: '⚠️ Atenção — Modifica estrutura existente' }
  }
  return { level: 'safe', label: '✅ Seguro — Cria nova tabela' }
}

export function MigrationReview({ migrations, approvedIndices, onToggleApproval, onToggleAll }: MigrationReviewProps) {
  if (!migrations || migrations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center text-neutral-400 p-8">
        <Check className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm font-medium">Nenhuma migração SQL necessária.</p>
        <p className="text-xs mt-1">O caso de uso usa apenas tabelas existentes.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-xl">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Revise antes de aplicar</p>
          <p className="text-xs text-amber-600 dark:text-amber-400/80 mt-0.5">
            Essas queries serão executadas diretamente no seu banco. Confirme individualmente quais deseja aprovar.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300 cursor-pointer">
            <input 
              type="checkbox" 
              checked={approvedIndices.size === migrations.length}
              onChange={(e) => onToggleAll(e.target.checked)}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 bg-amber-100 border-amber-300 dark:bg-amber-900 dark:border-amber-700"
            />
            Selecionar todas
          </label>
        </div>
      </div>

      {migrations.map((sql, i) => {
        const risk = classifyRisk(sql)
        const approved = approvedIndices.has(i)

        return (
          <div
            key={i}
            className={`rounded-2xl border overflow-hidden transition-all ${
              approved
                ? 'border-emerald-200 dark:border-emerald-500/30'
                : 'border-neutral-200 dark:border-neutral-800 opacity-60'
            }`}
          >
            {/* Header da migration */}
            <div className={`flex items-center justify-between px-4 py-3 ${
              approved
                ? 'bg-emerald-50 dark:bg-emerald-500/10'
                : 'bg-neutral-50 dark:bg-neutral-900/50'
            }`}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onToggleApproval(i)}
                  className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                    approved
                      ? 'bg-emerald-600 border-emerald-600'
                      : 'border-neutral-300 dark:border-neutral-700'
                  }`}
                >
                  {approved && <Check className="w-3 h-3 text-white" />}
                </button>
                <div>
                  <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Migration #{i + 1}
                  </p>
                  <p className={`text-xs ${
                    risk.level === 'danger' ? 'text-red-600 dark:text-red-400' :
                    risk.level === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                    'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {risk.label}
                  </p>
                </div>
              </div>
              {risk.level === 'danger' && (
                <ShieldAlert className="w-5 h-5 text-red-500" />
              )}
            </div>

            {/* SQL */}
            <div className="p-4 bg-neutral-950">
              <pre className="text-xs text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
                {sql}
              </pre>
            </div>
          </div>
        )
      })}

      <p className="text-xs text-neutral-400 text-center">
        {approvedIndices.size} de {migrations.length} migration{migrations.length !== 1 ? 's' : ''} aprovada{approvedIndices.size !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
