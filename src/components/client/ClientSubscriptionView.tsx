import React from 'react'
import { CreditCard, ExternalLink, Loader2, ShieldAlert, Sliders } from 'lucide-react'
import { formatPrice, formatDate, getCycleLabel, getBillingTypeLabel, StatusBadge } from './ClientSharedComponents'
import { useI18n } from '@/i18n'

interface ClientSubscriptionViewProps {
  loadingAsaasData: boolean
  asaasSubData: any
  toast: any
  localProfile: any
  setCardForm: (form: any) => void
  setShowCardModal: (v: boolean) => void
  router: any
  lastSuccessfulPayment: any
  payments: any[]
}

export function ClientSubscriptionView({
  loadingAsaasData,
  asaasSubData,
  toast,
  localProfile,
  setCardForm,
  setShowCardModal,
  router,
  lastSuccessfulPayment,
  payments,
}: ClientSubscriptionViewProps) {
  const { t } = useI18n()

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      {/* Real-time Asaas data loading */}
      {loadingAsaasData && (
        <div className="flex items-center gap-3 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl animate-pulse">
          <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
            {t('client_views.subscription.verifying_realtime', 'Verificando pagamentos e faturamento em tempo real...')}
          </span>
        </div>
      )}

      {/* Pending Invoice Display (PIX QR code / Copy PIX / Boleto) */}
      {asaasSubData?.pendingInvoice && (
        <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <h4 className="text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest">
                {t('client_views.subscription.pending_invoice_title', 'Cobrança Pendente Encontrada')}
              </h4>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-xl">
              {t('client_views.subscription.pending_invoice_desc', 'Há um pagamento em aberto de {value} vencendo em {date}. Efetue o pagamento abaixo para evitar interrupções.')
                .replace('{value}', formatPrice(asaasSubData.pendingInvoice.value))
                .replace('{date}', formatDate(asaasSubData.pendingInvoice.dueDate))}
            </p>

            {/* If PIX */}
            {asaasSubData.pendingInvoice.billingType === 'PIX' && asaasSubData.pendingInvoice.pixCopiaCola && (
              <div className="flex flex-col gap-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {asaasSubData.pendingInvoice.pixQrCode && (
                    <div className="bg-white p-2 rounded-2xl border border-neutral-200 w-fit shrink-0">
                      <img src={`data:image/png;base64,${asaasSubData.pendingInvoice.pixQrCode}`} alt="PIX QR Code" className="w-24 h-24" />
                    </div>
                  )}
                  <div className="flex-1 min-w-[200px] space-y-1.5">
                    <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">
                      {t('client_views.subscription.pix_copy_paste', 'Pix Copia e Cola')}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={asaasSubData.pendingInvoice.pixCopiaCola}
                        className="bg-neutral-100 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-700 dark:text-neutral-300 w-full font-mono focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(asaasSubData.pendingInvoice.pixCopiaCola);
                          toast(t('client_views.subscription.pix_copied', 'Código PIX copiado!'), 'success');
                        }}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors"
                      >
                        {t('client_views.subscription.copy', 'Copiar')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* If Boleto */}
            {asaasSubData.pendingInvoice.billingType === 'BOLETO' && (
              <div className="flex flex-col gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-3">
                  {asaasSubData.pendingInvoice.bankSlipUrl && (
                    <a
                      href={asaasSubData.pendingInvoice.bankSlipUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-950 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 rounded-xl text-xs font-bold transition-colors"
                    >
                      {t('client_views.subscription.print_boleto', 'Imprimir Boleto')} <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {asaasSubData.pendingInvoice.identificationField && (
                    <div className="flex-1 max-w-md">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={asaasSubData.pendingInvoice.identificationField}
                          className="bg-neutral-100 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-700 dark:text-neutral-300 w-full font-mono focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(asaasSubData.pendingInvoice.identificationField);
                            toast(t('client_views.subscription.bar_code_copied', 'Linha digitável copiada!'), 'success');
                          }}
                          className="px-3.5 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-bold shrink-0 transition-colors"
                        >
                          {t('client_views.subscription.copy', 'Copiar')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Option to pay invoice with card */}
          <div className="shrink-0">
            <button
              onClick={() => {
                setCardForm((prev: any) => ({
                  ...prev,
                  billingEmail: localProfile?.email || '',
                  billingName: localProfile?.full_name || ''
                }));
                setShowCardModal(true);
              }}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/10 transition-all flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              {t('client_views.subscription.pay_with_card', 'Pagar com Cartão')}
            </button>
          </div>
        </div>
      )}

      {/* Plan Summary & Card on file */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-neutral-100 dark:border-neutral-800 pb-5">
          <div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
              {t('client_views.subscription.summary_title', 'Resumo da Assinatura')}
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              {t('client_views.subscription.summary_desc', 'Status do plano ativo e ciclo contratado')}
            </p>
          </div>

          {/* Masked Card Details and Plan Update */}
          {localProfile?.subscription_licenses && localProfile.subscription_licenses > 0 && (
            <div className="shrink-0 flex flex-wrap items-center gap-3">
              {localProfile?.card_brand && localProfile?.card_last_digits ? (
                <div className="flex items-center gap-2.5 px-4 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-2xl text-xs">
                  <CreditCard className="w-4 h-4 text-indigo-500" />
                  <span className="font-bold text-neutral-700 dark:text-neutral-300 uppercase">
                    {localProfile.card_brand} •••• {localProfile.card_last_digits}
                  </span>
                  <button
                    onClick={() => {
                      setCardForm((prev: any) => ({
                        ...prev,
                        billingEmail: localProfile?.email || '',
                        billingName: localProfile?.full_name || ''
                      }));
                      setShowCardModal(true);
                    }}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline ml-1.5"
                  >
                    {t('client_views.subscription.change', 'Alterar')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setCardForm((prev: any) => ({
                      ...prev,
                      billingEmail: localProfile?.email || '',
                      billingName: localProfile?.full_name || ''
                    }));
                    setShowCardModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-850 dark:hover:bg-neutral-750 text-neutral-850 dark:text-white text-xs font-bold rounded-2xl border border-neutral-200 dark:border-neutral-750 transition-colors"
                >
                  <CreditCard className="w-4 h-4 text-neutral-500" /> {t('client_views.subscription.add_card', 'Adicionar Cartão')}
                </button>
              )}
              
              <button
                onClick={() => router.push('/checkout?mode=upgrade')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl border border-indigo-500 transition-colors shadow-sm"
              >
                <Sliders className="w-4 h-4" /> {t('client_views.subscription.change_plan', 'Alterar Plano')}
              </button>
            </div>
          )}
        </div>

        {localProfile?.subscription_licenses && localProfile.subscription_licenses > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Plan */}
            <div className="p-5 bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-500/10 dark:to-indigo-500/5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
                {t('client_views.subscription.active_licenses_card', 'Licenças Ativas')}
              </span>
              <h4 className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-2">{localProfile.subscription_licenses} {t('client_dashboard.shared.licenses_gauge_title', 'Licenças')}</h4>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                {t('client_views.subscription.volume_based', 'Baseado em volume')}
              </p>
            </div>

            {/* Cycle */}
            <div className="p-5 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                {t('client_views.subscription.cycle_card', 'Ciclo')}
              </span>
              <h4 className="text-lg font-bold text-neutral-800 dark:text-neutral-200 mt-2">
                {getCycleLabel(localProfile?.subscription_cycle)}
              </h4>
              <p className="text-xs text-neutral-400 mt-1">
                {t('client_views.subscription.recurring_renewal', 'Renovação recorrente')}
              </p>
            </div>

            {/* Status */}
            <div className="p-5 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                {t('client_views.subscription.status_card', 'Status')}
              </span>
              <div className="mt-3">
                <StatusBadge status={localProfile?.subscription_status} />
                {localProfile?.subscription_status === 'canceled' && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 font-medium">
                    {t('client_views.subscription.access_kept_until', 'Acesso mantido até {date}').replace('{date}', formatDate(localProfile.subscription_expires_at))}
                  </p>
                )}
              </div>
            </div>

            {/* Next Renewal */}
            <div className="p-5 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                {localProfile?.subscription_status === 'canceled' ? t('client_views.subscription.access_expires_card', 'Acesso Expira Em') : t('client_views.subscription.next_renewal_card', 'Próxima Renovação')}
              </span>
              <h4 className="text-lg font-bold text-neutral-800 dark:text-neutral-200 mt-2">
                {formatDate(localProfile?.subscription_expires_at)}
              </h4>
              <p className="text-xs text-neutral-400 mt-1">
                {t('client_views.subscription.auto_debit_hint', 'Débito automático se ativo')}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-10 text-center bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800">
            <ShieldAlert className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
            <p className="text-sm font-bold text-neutral-600 dark:text-neutral-400">
              {t('client_views.subscription.no_active_sub_title', 'Nenhuma assinatura ativa encontrada.')}
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              {t('client_views.subscription.no_active_sub_desc', 'Contrate um plano para usufruir de todos os recursos.')}
            </p>
          </div>
        )}

        {/* Last payment info */}
        {lastSuccessfulPayment && (
          <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block mb-1">
                {t('client_views.subscription.last_payment', 'Último Pagamento')}
              </span>
              <span className="font-bold text-neutral-900 dark:text-white">{formatPrice(lastSuccessfulPayment.amount)}</span>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block mb-1">
                {t('client_views.subscription.date', 'Data')}
              </span>
              <span className="font-bold text-neutral-900 dark:text-white">{formatDate(lastSuccessfulPayment.created_at)}</span>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block mb-1">
                {t('client_views.subscription.payment_method', 'Forma de Pagamento')}
              </span>
              <span className="font-bold text-neutral-900 dark:text-white">{getBillingTypeLabel(lastSuccessfulPayment.billing_type)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Payments History */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
              {t('client_views.subscription.billing_history_title', 'Histórico de Faturamento')}
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              {t('client_views.subscription.billing_history_desc', 'Seus recibos e histórico de transações')}
            </p>
          </div>
          <div className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-bold rounded-full">
            {payments.length} {payments.length === 1 ? t('client_views.subscription.single_transaction', 'transação') : t('client_views.subscription.plural_transactions', 'transações')}
          </div>
        </div>

        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/20">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    {t('client_views.subscription.table_date', 'Data')}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    {t('client_views.subscription.table_cycle', 'Ciclo')}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    {t('client_views.subscription.table_value', 'Valor')}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    {t('client_views.subscription.table_method', 'Método')}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    {t('client_views.subscription.table_status', 'Status')}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500 text-right">
                    {t('client_views.subscription.table_receipt', 'Comprovante')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/20 transition-colors">
                    <td className="px-6 py-4 text-sm text-neutral-800 dark:text-neutral-200 font-medium">{formatDate(p.created_at)}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">{getCycleLabel(p.cycle)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-neutral-900 dark:text-white">{formatPrice(p.amount)}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">{getBillingTypeLabel(p.billing_type)}</td>
                    <td className="px-6 py-4"><StatusBadge status={p.status} /></td>
                    <td className="px-6 py-4 text-right">
                      {p.invoice_url ? (
                        <a
                          href={p.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                        >
                          {t('client_views.subscription.receipt_btn', 'Recibo')} <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-xs text-neutral-400 italic">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-neutral-500">
            <CreditCard className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
            <p className="text-sm font-medium">
              {t('client_views.subscription.no_transactions', 'Nenhuma transação registrada.')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

