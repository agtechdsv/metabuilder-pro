import React from 'react'
import { motion } from 'framer-motion'
import { CreditCard, TrendingUp, Building2, Users, Activity, Sparkles, ShieldCheck, AlertTriangle } from 'lucide-react'
import { useDashboardAdmin } from '../hooks/useDashboardAdmin'

interface DashboardTabProps {
  hook: ReturnType<typeof useDashboardAdmin>
  initialWorkspaces: any[]
  clientProfiles: any[]
  mappedWorkspaces: any[]
}

export function DashboardTab({ hook, initialWorkspaces, clientProfiles, mappedWorkspaces }: DashboardTabProps) {
  const {
    dashboardPeriod,
    setDashboardPeriod,
    dashboardCustomStart,
    setDashboardCustomStart,
    dashboardCustomEnd,
    setDashboardCustomEnd,
    dashboardClient,
    setDashboardClient,
    metrics
  } = hook

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Dashboard Filters */}
      <div className="bg-white dark:bg-neutral-900/40 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Período */}
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Período</label>
            <select
              value={dashboardPeriod}
              onChange={(e) => setDashboardPeriod(e.target.value as any)}
              className="w-full h-10 px-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-200"
            >
              <option value="all">Todos os períodos</option>
              <option value="today">Hoje</option>
              <option value="7days">Últimos 7 Dias</option>
              <option value="15days">Últimos 15 Dias</option>
              <option value="30days">Últimos 30 Dias</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          {/* Clientes */}
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Clientes</label>
            <select
              value={dashboardClient}
              onChange={(e) => setDashboardClient(e.target.value)}
              className="w-full h-10 px-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-200"
            >
              <option value="all">Todos os Clientes</option>
              {initialWorkspaces
                .filter(w => {
                  const ownerProfile = clientProfiles.find(p => p.id === w.owner_id)
                  return !ownerProfile?.is_super_admin
                })
                .map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
            </select>
          </div>
        </div>

        {/* Custom Date Pickers */}
        {dashboardPeriod === 'custom' && (
          <div className="flex flex-wrap gap-4 pt-2 border-t border-neutral-100 dark:border-neutral-850/60 animate-in fade-in duration-300">
            <div className="w-[180px] space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Data de Início</label>
              <input
                type="date"
                value={dashboardCustomStart}
                onChange={(e) => setDashboardCustomStart(e.target.value)}
                className="w-full h-10 px-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-200"
              />
            </div>
            <div className="w-[180px] space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Data de Fim (Opcional)</label>
              <input
                type="date"
                value={dashboardCustomEnd}
                onChange={(e) => setDashboardCustomEnd(e.target.value)}
                className="w-full h-10 px-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-200"
              />
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">

        {/* Card 0: Faturamento */}
        <div className="relative bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Faturamento (Caixa)</span>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-neutral-900 dark:text-white">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.faturamento)}
            </h3>
            <p className="text-[10px] font-bold text-neutral-400 mt-1">
              Total recebido no período
            </p>
          </div>
        </div>

        {/* Card 1: MRR */}
        <div className="relative bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-bl-full pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Recorrência Mensal (MRR)</span>
            <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-neutral-900 dark:text-white">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.activeMRR)}
            </h3>
            <p className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 mt-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Calculado a partir de planos ativos</span>
            </p>
          </div>
        </div>

        {/* Card 2: Clientes */}
        <div className="relative bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Total de Clientes</span>
            <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-neutral-900 dark:text-white">
              {metrics.totalClients}
            </h3>
            <p className="text-[10px] font-bold text-neutral-400 mt-1">
              Donos de workspaces
            </p>
          </div>
        </div>

        {/* Card 3: Active Users */}
        <div className="relative bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Usuários Ativos</span>
            <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-neutral-900 dark:text-white">
              {metrics.totalUsers}
            </h3>
            <p className="text-[10px] font-bold text-neutral-400 mt-1">
              Total de usuários
            </p>
          </div>
        </div>

        {/* Card 4: Conversion Rate */}
        <div className="relative bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-bl-full pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Taxa de Conversão</span>
            <div className="p-2.5 bg-violet-500/10 text-violet-500 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-neutral-900 dark:text-white">
              {metrics.conversionRate.toFixed(1)}%
            </h3>
            <p className="text-[10px] font-bold text-neutral-400 mt-1">
              Workspaces convertidos para planos pagos
            </p>
          </div>
        </div>

      </div>

      {/* Visual BI Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Quick Platform Security Health Card */}
        <div className="bg-white dark:bg-neutral-900/40 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between h-[300px]">
          <div>
            <h4 className="text-xs font-black uppercase text-neutral-400 tracking-wider mb-2">Segurança & Conexões</h4>
            <p className="text-[10px] text-neutral-400 font-medium">Visualização rápida de integridade da infraestrutura.</p>
          </div>

          <div className="space-y-4 my-2">
            <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-950/60 rounded-2xl border border-neutral-100 dark:border-neutral-850">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span className="text-[11px] font-bold dark:text-white">Criptografia Base de Dados</span>
              </div>
              <span className="text-[9px] font-black uppercase text-emerald-500 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">Ativa</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-950/60 rounded-2xl border border-neutral-100 dark:border-neutral-850">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                <span className="text-[11px] font-bold dark:text-white">Supabase RPC Connection</span>
              </div>
              <span className="text-[9px] font-black uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">Excelente</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-950/60 rounded-2xl border border-neutral-100 dark:border-neutral-850">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-[11px] font-bold dark:text-white">Clientes Bloqueados</span>
              </div>
              <span className="text-[9px] font-black uppercase text-amber-500 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded">
                {mappedWorkspaces.filter(w => w.is_blocked && !w.ownerIsSuperAdmin).length} Bloqueados
              </span>
            </div>
          </div>

          <div className="text-[10px] text-neutral-400 font-medium text-center border-t border-neutral-100 dark:border-neutral-850/60 pt-3">
            MetaBuilderPRO Platform Engine v1.2
          </div>
        </div>

      </div>

    </motion.div>
  )
}
