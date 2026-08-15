import React from 'react'
import { Check, Clock, Loader2, ShieldAlert, XCircle, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from './ClientSharedComponents'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n'

interface ClientCancelViewProps {
  localProfile: any
  CANCELLATION_REASONS: any
  selectedReasons: string[]
  setSelectedReasons: (reasons: string[] | ((prev: string[]) => string[])) => void
  cancellationError: string | null
  setCancellationError: (err: string | null) => void
  cancellationComment: string
  setCancellationComment: (comment: string) => void
  setActiveTab: (tab: any) => void
  canCancel: boolean
  showCancelModal: boolean
  setShowCancelModal: (show: boolean) => void
  isCanceling: boolean
  handleCancelSubscription: () => void
}

export function ClientCancelView({
  localProfile,
  CANCELLATION_REASONS,
  selectedReasons,
  setSelectedReasons,
  cancellationError,
  setCancellationError,
  cancellationComment,
  setCancellationComment,
  setActiveTab,
  canCancel,
  showCancelModal,
  setShowCancelModal,
  isCanceling,
  handleCancelSubscription
}: ClientCancelViewProps) {
  const { t } = useI18n()

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in-50 duration-200">
      {localProfile?.subscription_status === 'canceled' ? (
        /* Already canceled */
        <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-3xl p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-amber-100 dark:bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto">
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-xl font-black text-neutral-900 dark:text-white">
              {t('client_views.cancel.already_canceled_title', 'Renovação Automática Cancelada')}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 leading-relaxed">
              {t('client_views.cancel.already_canceled_desc', 'A renovação automática da sua assinatura já foi cancelada. Seu acesso permanece ativo até {date}.')
                .replace('{date}', formatDate(localProfile?.subscription_expires_at))}
            </p>
          </div>
        </div>
      ) : !(localProfile?.subscription_licenses && localProfile.subscription_licenses > 0) ? (
        /* No active plan */
        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto" />
          <p className="text-sm text-neutral-500">
            {t('client_views.cancel.no_active_sub', 'Nenhuma assinatura ativa para cancelar.')}
          </p>
        </div>
      ) : (
        /* Can cancel */
        <>
          {/* Cancellation Form Card */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 shadow-sm space-y-6">
            <div className="text-center space-y-2 mb-6">
              <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <XCircle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
                {t('client_views.cancel.really_cancel_title', 'DESEJA REALMENTE CANCELAR SUA ASSINATURA?')}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-lg mx-auto leading-relaxed">
                {t('client_views.cancel.really_cancel_desc', 'Ao cancelar, seu acesso continuará ativo até o final do período já pago ({date}). Após essa data, o acesso aos recursos do workspace será suspenso, mas seus dados permanecerão preservados.')
                  .replace('{date}', formatDate(localProfile?.subscription_expires_at))}
              </p>
            </div>

            {/* Motivos Checklist */}
            <div className="space-y-3">
              <p className="text-[11px] font-black tracking-widest text-rose-500 uppercase">
                {t('client_views.cancel.reasons_title', 'Motivo do cancelamento?')}
              </p>

              <div className="grid grid-cols-1 gap-2.5">
                {CANCELLATION_REASONS.map((reason: any) => {
                  const isSelected = selectedReasons.includes(reason.id)
                  const reasonLabel = t(`client_views.cancel.reasons.${reason.id}`, reason.label)
                  return (
                    <button
                      key={reason.id}
                      type="button"
                      onClick={() => {
                        setCancellationError(null)
                        setSelectedReasons(prev =>
                          prev.includes(reason.id)
                            ? prev.filter(id => id !== reason.id)
                            : [...prev, reason.id]
                        )
                      }}
                      className={cn(
                        'w-full flex items-center justify-between p-4 rounded-2xl text-left transition-all duration-200 border',
                        isSelected
                          ? 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400'
                          : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                      )}
                    >
                      <span className="text-xs font-bold tracking-wide">{reasonLabel}</span>
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all duration-200',
                          isSelected
                            ? 'border-rose-500 bg-rose-500 text-white'
                            : 'border-neutral-300 dark:border-neutral-700 bg-transparent'
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Textarea */}
            <div className="space-y-2">
              <p className="text-[10px] font-black tracking-widest text-rose-500 uppercase leading-relaxed">
                {t('client_views.cancel.comment_title', 'Nos conte um pouco mais sobre o motivo do seu cancelamento e como podemos melhorar nossos serviços')}
              </p>
              <textarea
                value={cancellationComment}
                onChange={(e) => setCancellationComment(e.target.value)}
                placeholder={t('client_views.cancel.comment_placeholder', 'Escreva sua resposta aqui (opcional)...')}
                rows={4}
                className="w-full rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-4 text-sm text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-rose-500 focus:outline-none transition-colors resize-none"
              />
            </div>

            {cancellationError && (
              <p className="text-xs font-bold text-rose-500 text-center">{cancellationError}</p>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-neutral-150 dark:border-neutral-800">
              <button
                onClick={() => {
                  setSelectedReasons([])
                  setCancellationComment('')
                  setCancellationError(null)
                  setActiveTab('subscription')
                }}
                className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white text-xs font-bold rounded-xl transition-colors order-2 sm:order-1"
              >
                {t('client_views.cancel.keep_sub_btn', 'Manter Assinatura')}
              </button>
              {canCancel && (
                <button
                  id="client-cancel-subscription-btn"
                  onClick={() => {
                    if (selectedReasons.length === 0) {
                      setCancellationError(t('client_views.cancel.select_reason_error', 'Por favor, selecione pelo menos um motivo de cancelamento.'))
                      return
                    }
                    setShowCancelModal(true)
                  }}
                  className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 order-1 sm:order-2"
                >
                  <Zap className="w-4 h-4 fill-white" />
                  {t('client_views.cancel.continue_cancel_btn', 'Continuar Cancelamento')}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title={t('client_views.cancel.confirm_modal_title', 'Confirmar Cancelamento')}
        description={t('client_views.cancel.confirm_modal_desc', 'Tem certeza de que deseja cancelar a renovação automática da sua assinatura?')}
        size="sm"
      >
        <div className="space-y-4 mt-4">
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            {t('client_views.cancel.modal_access_kept_desc', 'Seu acesso permanecerá ativo até {date}. Após esta data, o acesso será suspenso.')
              .replace('{date}', formatDate(localProfile?.subscription_expires_at))}
          </p>

          <div className="flex gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <button
              onClick={() => setShowCancelModal(false)}
              disabled={isCanceling}
              className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              {t('client_views.cancel.modal_back_btn', 'Voltar')}
            </button>
            <button
              onClick={handleCancelSubscription}
              disabled={isCanceling}
              className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors shadow-lg shadow-rose-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCanceling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('client_views.cancel.modal_canceling', 'Cancelando...')}
                </>
              ) : (
                t('client_views.cancel.modal_confirm_btn', 'Confirmar Cancelamento')
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

