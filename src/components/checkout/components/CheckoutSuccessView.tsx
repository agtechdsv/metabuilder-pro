
import { CheckCircle2, ArrowRight } from 'lucide-react'
import { useCheckoutState } from '../hooks/useCheckoutState'
import { useI18n } from '@/i18n'

export function CheckoutSuccessView({ state }: { state: ReturnType<typeof useCheckoutState> }) {
  const { t } = useI18n()
  const { licenses, cycle, countdown, getCyclePrices, router } = state

  const cycleLabels: Record<string, string> = {
    monthly: t('checkout.cycles.monthly', 'Mensal'),
    quarterly: t('checkout.cycles.quarterly', 'Trimestral'),
    semiannual: t('checkout.cycles.semiannual', 'Semestral'),
    yearly: t('checkout.cycles.yearly', 'Anual')
  }

  return (
    <div className="relative max-w-xl w-full mx-auto bg-white/95 dark:bg-neutral-900/90 backdrop-blur-2xl border border-neutral-200 dark:border-neutral-800 p-8 md:p-12 rounded-[2.5rem] shadow-2xl text-center space-y-8 overflow-hidden">
        {/* Glows */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 blur-[80px] pointer-events-none rounded-full"></div>

        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500 border border-emerald-500/20 shadow-inner">
          <CheckCircle2 className="w-12 h-12" />
        </div>

        <div className="space-y-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            {t('checkout.success.gateway_confirmed', 'ASAAS Gateway Confirmado')}
          </span>
          <h2 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">{t('checkout.success.approved_title', 'Pagamento Aprovado!')}</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('checkout.success.activated_desc', 'A licença para {count} foi ativada e aplicada a todos os seus workspaces.').replace('{count}', `${licenses} ${licenses === 1 ? t('checkout.success.single_user', 'usuário') : t('checkout.success.plural_users', 'usuários')}`)}
          </p>
        </div>

        <div className="p-5 bg-neutral-50 dark:bg-neutral-950/60 rounded-2xl border border-neutral-100 dark:border-neutral-800/80 text-left text-xs text-neutral-600 dark:text-neutral-300 space-y-2">
          <p><strong>{t('checkout.success.workspace_label', 'Ambiente de Trabalho:')}</strong> /client/dashboard</p>
          <p>
            <strong>{t('checkout.success.contracted_value', 'Valor Contratado:')}</strong> R${' '}
            {getCyclePrices(cycle).total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            ({cycleLabels[cycle] || cycle})
          </p>
          <p><strong>{t('checkout.success.subscription_status_label', 'Status da Assinatura:')}</strong> {t('checkout.success.subscription_status_value', 'Ativa (Acesso ilimitado e sem restrições)')}</p>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-neutral-400">
            {t('checkout.success.redirecting', 'Redirecionando em {count}s para o painel de controle...').replace('{count}', String(countdown))}
          </p>
          <button
            onClick={() => router.push('/client/dashboard')}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-500/25 active:scale-[0.98]"
          >
            {t('checkout.success.access_dashboard_btn', 'Acessar Painel Agora')} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
}

