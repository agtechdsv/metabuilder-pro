import React from 'react'
import { motion } from 'framer-motion'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function formatPrice(amount: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
}

export function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export function getCycleLabel(cycle?: string | null) {
  switch (cycle) {
    case 'monthly': return 'Mensal'
    case 'quarterly': return 'Trimestral'
    case 'semiannual': return 'Semestral'
    case 'yearly': return 'Anual'
    default: return '—'
  }
}

export function getBillingTypeLabel(type?: string | null) {
  switch (type?.toUpperCase()) {
    case 'CREDIT_CARD': return 'Cartão de Crédito'
    case 'PIX': return 'Pix'
    case 'BOLETO': return 'Boleto'
    default: return type || 'Outro'
  }
}

export function StatusBadge({ status }: { status?: string | null }) {
  const s = status?.toLowerCase()
  if (s === 'active' || s === 'received' || s === 'confirmed' || s === 'paid') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <CheckCircle className="w-3.5 h-3.5" /> Ativo
      </span>
    )
  }
  if (s === 'canceled') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
        <Clock className="w-3.5 h-3.5" /> Cancelado
      </span>
    )
  }
  if (s === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <Clock className="w-3.5 h-3.5 animate-pulse" /> Pendente
      </span>
    )
  }
  if (s === 'overdue' || s === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
        <AlertTriangle className="w-3.5 h-3.5" /> Atrasado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
      {status || '—'}
    </span>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1">{label}</p>
        <p className="text-3xl font-black text-neutral-900 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-neutral-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ─── License Gauge Card ───────────────────────────────────────────────────────

export function LicenseGaugeCard({
  licensesUsed,
  licensesTotal,
}: {
  licensesUsed: number
  licensesTotal: number
}) {
  const pct = licensesTotal > 0 ? Math.min((licensesUsed / licensesTotal) * 100, 100) : 0
  const angle = -90 + (pct / 100) * 180

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 flex flex-col items-center justify-between shadow-sm hover:shadow-md transition-shadow h-full">
      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Licenças</p>

      <div className="relative w-full flex items-center justify-center my-1">
        <svg viewBox="0 0 100 55" className="w-32 h-auto overflow-visible">
          {/* Background track */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="8"
            strokeLinecap="round"
            className="stroke-neutral-100 dark:stroke-neutral-850"
          />
          {/* Active track */}
          <motion.path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="url(#gauge-emerald-gradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="125.66"
            initial={{ strokeDashoffset: 125.66 }}
            animate={{ strokeDashoffset: 125.66 - (pct / 100) * 125.66 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
          <defs>
            <linearGradient id="gauge-emerald-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#0D9488" />
            </linearGradient>
          </defs>

          {/* Value Text centered in the gauge, nestled inside the arc */}
          <text
            x="50"
            y="48"
            textAnchor="middle"
            className="fill-neutral-900 dark:fill-white font-sans font-black text-[16px] tracking-tight"
          >
            {licensesUsed}
            <tspan className="fill-neutral-400 dark:fill-neutral-500 font-medium text-[11px]"> / {licensesTotal || '—'}</tspan>
          </text>
        </svg>
      </div>

      <p className="text-xs text-neutral-500 text-center mt-2">Usuários ativos vs. contratadas</p>
    </div>
  )
}

// ─── Logic Type Doughnut Chart ────────────────────────────────────────────────

export function LogicTypeDoughnutChart({ data }: { data: { label: string; count: number; color: string }[] }) {
  const chartData = data.map(d => ({
    name: d.label,
    value: d.count,
    color: d.color,
  }))

  const colorMap: Record<string, string> = {
    'bg-indigo-500': '#6366F1',
    'bg-emerald-500': '#10B981',
    'bg-amber-500': '#F59E0B',
    'bg-blue-500': '#3B82F6',
    'bg-rose-500': '#F43F5E',
    'bg-purple-500': '#8B5CF6',
    'bg-cyan-500': '#06B6D4',
    'bg-orange-500': '#F97316',
    'outros': '#9CA3AF',
  }

  return (
    <div className="w-full h-44 flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius="50%"
            outerRadius="72%"
            paddingAngle={4}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colorMap[entry.color] || '#10B981'}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: '12px',
              border: 'none',
              boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
              backgroundColor: '#ffffff',
              fontSize: '11px',
              fontWeight: 'bold',
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            iconSize={6}
            wrapperStyle={{
              fontSize: '9px',
              fontWeight: 'bold',
              color: '#6B7280',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────

export function MiniBarChart({ data }: { data: { label: string; count: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="space-y-2">
      {data.map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs text-neutral-500 dark:text-neutral-400 w-36 shrink-0 truncate">{item.label}</span>
          <div className="flex-1 bg-neutral-100 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(item.count / max) * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={cn('h-2 rounded-full', item.color)}
            />
          </div>
          <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 w-4 text-right shrink-0">{item.count}</span>
        </div>
      ))}
    </div>
  )
}
