'use client'

import { useState } from 'react'
import { Calendar, CreditCard, Shield, AlertTriangle, CheckCircle, Clock, ExternalLink, ShieldAlert, ArrowLeft } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { useRouter } from 'next/navigation'

interface Workspace {
  id: string
  name: string
  slug: string
  owner_id: string
}

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  plan_id?: string | null
  subscription_status?: string | null
  subscription_cycle?: string | null
  subscription_expires_at?: string | null
  asaas_customer_id?: string | null
  asaas_subscription_id?: string | null
}

interface Payment {
  id: string
  user_id: string
  workspace_id: string
  plan_id: string | null
  cycle: string
  amount: number
  status: string
  external_reference: string
  billing_type: string | null
  invoice_url: string | null
  created_at: string
}

interface Plan {
  id: string
  name: string
  price_monthly: number
  price_quarterly: number
  price_semiannually: number
  price_yearly: number
  is_active: boolean
}

interface BillingSettingsProps {
  workspace: Workspace
  profile: Profile
  payments: Payment[]
  plans: Plan[]
  isOwner: boolean
}

export default function BillingSettings({ workspace, profile: initialProfile, payments, plans, isOwner }: BillingSettingsProps) {
  const [profile, setProfile] = useState<Profile>(initialProfile)
  const [isCanceling, setIsCanceling] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const activePlan = plans.find(p => p.id === profile.plan_id)

  const getCycleLabel = (cycle?: string | null) => {
    switch (cycle) {
      case 'monthly': return 'Mensal'
      case 'quarterly': return 'Trimestral'
      case 'semiannual': return 'Semestral'
      case 'yearly': return 'Anual'
      default: return 'Não definido'
    }
  }

  const getBillingTypeLabel = (type?: string | null) => {
    switch (type?.toUpperCase()) {
      case 'CREDIT_CARD': return 'Cartão de Crédito'
      case 'PIX': return 'Pix'
      case 'BOLETO': return 'Boleto'
      default: return type || 'Outro'
    }
  }

  const getStatusBadge = (status?: string | null) => {
    const s = status?.toLowerCase()
    if (s === 'active' || s === 'received' || s === 'confirmed' || s === 'paid') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-3.5 h-3.5" />
          Ativo / Pago
        </span>
      )
    }
    if (s === 'canceled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
          <Clock className="w-3.5 h-3.5" />
          Cancelado
        </span>
      )
    }
    if (s === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Clock className="w-3.5 h-3.5 animate-pulse" />
          Pendente
        </span>
      )
    }
    if (s === 'overdue' || s === 'failed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          Atrasado / Suspenso
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
        {status}
      </span>
    )
  }

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
  }

  const getPlanPrice = () => {
    if (!activePlan) return null
    switch (profile.subscription_cycle) {
      case 'monthly': return activePlan.price_monthly
      case 'quarterly': return activePlan.price_quarterly
      case 'semiannual': return activePlan.price_semiannually
      case 'yearly': return activePlan.price_yearly
      default: return activePlan.price_monthly
    }
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return '-'
    }
  }

  const handleCancelSubscription = async () => {
    setIsCanceling(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.functions.invoke('asaas-cancel', {
        body: { workspaceId: workspace.id }
      })

      if (error) throw error

      if (data && data.success) {
        toast('Assinatura cancelada com sucesso.', 'success')
        setProfile(prev => ({ ...prev, subscription_status: 'canceled' }))
        setShowCancelModal(false)
        router.refresh()
      } else {
        throw new Error(data?.error || 'Erro desconhecido ao cancelar assinatura.')
      }
    } catch (err: any) {
      console.error('Error canceling subscription:', err)
      toast(err.message || 'Erro ao cancelar assinatura. Tente novamente.', 'error')
    } finally {
      setIsCanceling(false)
    }
  }

  const canCancel = isOwner && profile.subscription_status !== 'canceled' && profile.asaas_subscription_id

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Resumo da Assinatura */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-6 md:p-8 shadow-sm">
        <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-6">Resumo da Assinatura</h3>

        {activePlan ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800 flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Plano Atual</span>
              <div>
                <h4 className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-2">{activePlan.name}</h4>
                <p className="text-xs text-neutral-500 mt-1">
                  {getPlanPrice() !== null ? `${formatPrice(getPlanPrice()!)} / ${getCycleLabel(profile.subscription_cycle).toLowerCase()}` : '-'}
                </p>
              </div>
            </div>

            <div className="p-5 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800 flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Ciclo</span>
              <div>
                <h4 className="text-lg font-bold text-neutral-850 dark:text-neutral-200 mt-2">{getCycleLabel(profile.subscription_cycle)}</h4>
                <p className="text-xs text-neutral-500 mt-1">Renovação recorrente</p>
              </div>
            </div>

            <div className="p-5 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800 flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Status</span>
              <div className="mt-2.5">
                {getStatusBadge(profile.subscription_status)}
                {profile.subscription_status === 'canceled' && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-2 font-medium">
                    Acesso mantido até {formatDate(profile.subscription_expires_at)}
                  </p>
                )}
              </div>
            </div>

            <div className="p-5 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800 flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                {profile.subscription_status === 'canceled' ? 'Acesso Expira Em' : 'Próxima Renovação'}
              </span>
              <div>
                <h4 className="text-lg font-bold text-neutral-850 dark:text-neutral-200 mt-2">{formatDate(profile.subscription_expires_at)}</h4>
                <p className="text-xs text-neutral-500 mt-1">Débito automático se ativo</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800">
            <ShieldAlert className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
            <p className="text-sm text-neutral-550 dark:text-neutral-450 font-bold">Nenhuma assinatura ativa encontrada para este Workspace.</p>
            <p className="text-xs text-neutral-500 mt-1">Faça upgrade para usufruir de todos os recursos do MetaBuilder PRO.</p>
          </div>
        )}

        {/* Informações de cancelamento de renovação automática */}
        {activePlan && (
          <div className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="max-w-xl">
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-500" />
                Segurança do Faturamento
              </h4>
              <p className="text-xs text-neutral-550 dark:text-neutral-450 mt-1 leading-relaxed">
                As assinaturas são geridas com segurança via Asaas. Ao cancelar a renovação automática, você não perderá acesso imediatamente: sua conta continuará ativa até o fim do período já pago.
              </p>
            </div>
            {canCancel ? (
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-5 py-3 h-11 text-xs font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-650 dark:bg-rose-500/10 dark:hover:bg-rose-600 border border-rose-100 dark:border-rose-900/50 rounded-xl transition-all whitespace-nowrap active:scale-95 shadow-sm"
              >
                Cancelar Renovação Automática
              </button>
            ) : profile.subscription_status === 'canceled' ? (
              <div className="px-4 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-900/30 rounded-xl text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                Renovação automática já cancelada
              </div>
            ) : !isOwner ? (
              <div className="text-[11px] text-neutral-500 font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-neutral-400" />
                Apenas o Dono pode gerenciar a assinatura.
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Histórico de Pagamentos */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Histórico de Faturamento</h3>
            <p className="text-xs text-neutral-500 mt-1">Veja seus recibos e histórico de transações.</p>
          </div>
          <div className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-bold rounded-full">
            {payments.length} {payments.length === 1 ? 'transação' : 'transações'}
          </div>
        </div>

        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/20">
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-500">Data</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-500">Ciclo</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-500">Valor</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-500">Método</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-500">Status</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-500 text-right">Comprovante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {payments.map(payment => (
                  <tr key={payment.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/20 transition-colors">
                    <td className="p-6 text-sm text-neutral-900 dark:text-neutral-200 font-medium">
                      {formatDate(payment.created_at)}
                    </td>
                    <td className="p-6 text-sm text-neutral-600 dark:text-neutral-400 font-medium">
                      {getCycleLabel(payment.cycle)}
                    </td>
                    <td className="p-6 text-sm text-neutral-900 dark:text-white font-bold">
                      {formatPrice(payment.amount)}
                    </td>
                    <td className="p-6 text-sm text-neutral-600 dark:text-neutral-400 font-medium">
                      {getBillingTypeLabel(payment.billing_type)}
                    </td>
                    <td className="p-6">
                      {getStatusBadge(payment.status)}
                    </td>
                    <td className="p-6 text-right">
                      {payment.invoice_url ? (
                        <a
                          href={payment.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-650 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                        >
                          Recibo Asaas
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-xs text-neutral-400 dark:text-neutral-600 italic">Indisponível</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-neutral-500">
            <CreditCard className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />
            <p className="text-sm font-medium">Nenhuma transação registrada para este workspace.</p>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Cancelamento */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancelar Renovação Automática"
        description="Tem certeza de que deseja cancelar a renovação automática da sua assinatura?"
        size="sm"
      >
        <div className="space-y-4 mt-4">
          <p className="text-xs text-neutral-550 dark:text-neutral-450 leading-relaxed">
            Seu workspace <strong className="text-neutral-800 dark:text-white">{workspace.name}</strong> permanecerá ativo até o dia <strong className="text-neutral-800 dark:text-white">{formatDate(profile.subscription_expires_at)}</strong>.
          </p>
          <p className="text-xs text-neutral-550 dark:text-neutral-450 leading-relaxed">
            Após este período, você e sua equipe perderão acesso aos recursos pagos e a criação/visualização de novos projetos.
          </p>

          <div className="flex items-center gap-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <button
              onClick={() => setShowCancelModal(false)}
              disabled={isCanceling}
              className="flex-1 px-4 py-3 bg-neutral-150 hover:bg-neutral-200 dark:bg-neutral-850 dark:hover:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              Manter Assinatura
            </button>
            <button
              onClick={handleCancelSubscription}
              disabled={isCanceling}
              className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors shadow-lg shadow-rose-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCanceling ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                'Confirmar Cancelamento'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
