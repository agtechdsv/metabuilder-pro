import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, CreditCard, XCircle, Activity, Check, ArrowRight,
  TrendingUp, RotateCcw, Zap, Users, FileText, ExternalLink, Sliders,
  Compass, Copy, Download, Code, Loader2, Shield, Lightbulb, MessageCircle,
  ThumbsUp, Star, Layout, Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { LogAction } from '../../hooks/useControlCenterMockups'
import CommunityHubView from '@/components/client/CommunityHubView'


export function TabSubscription({ mockupsState, setActiveTab }: { mockupsState: any, setActiveTab: (tab: string) => void }) {
  const { t } = useI18n()
  const {
    biWorkspaces,
    selectedProject, setSelectedProject,
    selectedDev, setSelectedDev,
    selectedPeriod, setSelectedPeriod,
    isDetailedLogOpen, setIsDetailedLogOpen,
    detailedLogTheme, setDetailedLogTheme,
    simulatedModalTab, setSimulatedModalTab,
    simulatedCopied, setSimulatedCopied,
    simulatedProdSubTab, setSimulatedProdSubTab,
    mockDetailedLogs,
    activeDetailedLog, setActiveDetailedLog,
    handleCloseSimulatedLog,
    handleSimulatedCopyJson,
    handleSimulatedDownloadJson,
    selectedReasons, setSelectedReasons,
    cancelComment, setCancelComment,
    toastMessage, setToastMessage,
    simulatedPlans,
    simulatedPlanId, setSimulatedPlanId,
    simulatedCycle, setSimulatedCycle,
    selectedSimulatedPlanId, setSelectedSimulatedPlanId,
    selectedSimulatedCycle, setSelectedSimulatedCycle,
    simulatedCardBrand, setSimulatedCardBrand,
    simulatedCardDigits, setSimulatedCardDigits,
    showSimulatedCardModal, setShowSimulatedCardModal,
    showSimulatedPlanConfirmModal, setShowSimulatedPlanConfirmModal,
    isSimulatingCardUpdate, setIsSimulatingCardUpdate,
    isSimulatingPlanUpdate, setIsSimulatingPlanUpdate,
    simulatedCardForm, setSimulatedCardForm,
    getSimulatedCycleLabel,
    formatSimulatedPrice,
    getSimulatedPlanPrice,
    handleSimulatedCardSubmit,
    handleSimulatedPlanChange,
    toggleReason,
    triggerToast
  } = mockupsState

  return (
    <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6 text-left relative"
                >
                  {/* Plan Summary & Card on file */}
                  <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-neutral-800 dark:text-white">
                          {t('marketing_v2.control_center_page.subscription.summary_title')}
                        </h4>
                        <p className="text-[10px] text-neutral-400 mt-0.5">{t('marketing_v2.control_center_page.subscription.summary_desc')}</p>
                      </div>

                      {/* Masked Card Details */}
                      <div>
                        {simulatedCardBrand && simulatedCardDigits ? (
                          <div className="flex items-center gap-2.5 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-[10px] font-bold">
                            <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="text-neutral-700 dark:text-neutral-300 uppercase">
                              {simulatedCardBrand} •••• {simulatedCardDigits}
                            </span>
                            <button
                              onClick={() => {
                                setSimulatedCardForm((prev: any) => ({
                                  ...prev,
                                  billingEmail: 'contato@agtech.com.br',
                                  billingName: 'Alexandre Moura'
                                }))
                                setShowSimulatedCardModal(true)
                              }}
                              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline ml-1.5"
                            >
                              {t('marketing_v2.control_center_page.subscription.btn_change')}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setSimulatedCardForm((prev: any) => ({
                                ...prev,
                                billingEmail: 'contato@agtech.com.br',
                                billingName: 'Alexandre Moura'
                              }))
                              setShowSimulatedCardModal(true)
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-200 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-800 dark:text-white text-[10px] font-bold rounded-xl border border-neutral-200 dark:border-neutral-700 transition-colors"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-neutral-500" /> {t('marketing_v2.control_center_page.subscription.btn_add_card')}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      {/* Plan */}
                      <div className="p-4 bg-indigo-600/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-left space-y-1">
                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">{t('marketing_v2.control_center_page.subscription.col_current_plan')}</span>
                        <h5 className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                          {simulatedPlans.find((p: any) => p.id === simulatedPlanId)?.name}
                        </h5>
                        <p className="text-[9px] font-bold text-neutral-500">
                          {formatSimulatedPrice(getSimulatedPlanPrice(simulatedPlanId, simulatedCycle))} / {getSimulatedCycleLabel(simulatedCycle).toLowerCase()}
                        </p>
                      </div>

                      {/* Cycle */}
                      <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-left space-y-1">
                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">{t('marketing_v2.control_center_page.subscription.col_cycle')}</span>
                        <h5 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                          {getSimulatedCycleLabel(simulatedCycle)}
                        </h5>
                        <p className="text-[9px] text-neutral-400 font-bold">{t('marketing_v2.control_center_page.subscription.col_recurrent')}</p>
                      </div>

                      {/* Status */}
                      <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-left space-y-1">
                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">{t('marketing_v2.control_center_page.subscription.col_status')}</span>
                        <h5 className="text-sm font-bold text-emerald-500 flex items-center gap-1">✓ {t('marketing_v2.control_center_page.simulator.active')}</h5>
                        <p className="text-[9px] text-neutral-400 font-bold">{t('marketing_v2.control_center_page.subscription.col_normal')}</p>
                      </div>

                      {/* Next Renewal */}
                      <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-left space-y-1">
                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">{t('marketing_v2.control_center_page.subscription.col_next_renewal')}</span>
                        <h5 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">23/11/2026</h5>
                        <p className="text-[9px] text-neutral-400 font-bold">{t('marketing_v2.control_center_page.subscription.col_billing_recurrent')}</p>
                      </div>
                    </div>

                    <div className="pt-2 text-[10px] text-neutral-500 flex flex-wrap gap-x-6 gap-y-1 font-mono">
                      <span><strong>{t('marketing_v2.control_center_page.subscription.billing_summary_payment')}</strong> {formatSimulatedPrice(getSimulatedPlanPrice(simulatedPlanId, simulatedCycle))}</span>
                      <span><strong>{t('marketing_v2.control_center_page.subscription.billing_summary_date')}</strong> 23/05/2026</span>
                      <span><strong>{t('marketing_v2.control_center_page.subscription.billing_summary_method')}</strong> {simulatedCardBrand ? t('marketing_v2.control_center_page.subscription.method_card') : t('marketing_v2.control_center_page.subscription.method_pix')}</span>
                    </div>
                  </div>

                  {/* Plan & Cycle Switcher (Upgrade/Downgrade Section) */}
                  <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-4">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-neutral-800 dark:text-white">{t('marketing_v2.control_center_page.subscription.change_plan_title')}</h3>
                      <p className="text-[10px] text-neutral-400 mt-0.5">{t('marketing_v2.control_center_page.subscription.change_plan_desc')}</p>
                    </div>

                    {/* Billing Cycle Selector Buttons */}
                    <div className="flex flex-wrap gap-2 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 w-fit">
                      {(['monthly', 'quarterly', 'semiannual', 'yearly'] as const).map(c => {
                        const discountLabels: Record<string, string> = {
                          quarterly: '-10%',
                          semiannual: '-15%',
                          yearly: '-20%',
                        }
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setSelectedSimulatedCycle(c)}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1',
                              selectedSimulatedCycle === c
                                ? 'bg-white dark:bg-neutral-800 text-neutral-800 dark:text-white shadow-sm'
                                : 'text-neutral-555 hover:text-neutral-700 dark:hover:text-neutral-300'
                            )}
                          >
                            <span>{getSimulatedCycleLabel(c)}</span>
                            {discountLabels[c] && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-black leading-none">
                                {discountLabels[c]}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Plans Selector Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {simulatedPlans.map((p: any) => {
                        const isCurrent = p.id === simulatedPlanId && selectedSimulatedCycle === simulatedCycle
                        const isSelected = p.id === selectedSimulatedPlanId

                        let displayPrice = p.price
                        if (selectedSimulatedCycle === 'monthly') displayPrice = p.price_monthly
                        else if (selectedSimulatedCycle === 'quarterly') displayPrice = p.price_quarterly / 3
                        else if (selectedSimulatedCycle === 'semiannual') displayPrice = p.price_semiannually / 6
                        else if (selectedSimulatedCycle === 'yearly') displayPrice = p.price_yearly / 12

                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedSimulatedPlanId(p.id)}
                            className={cn(
                              'p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 outline-none',
                              isSelected
                                ? 'bg-indigo-50/5 dark:bg-indigo-500/5 border-indigo-500 shadow-md ring-1 ring-indigo-500'
                                : 'bg-neutral-50 dark:bg-neutral-900/40 hover:bg-neutral-100 dark:hover:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800'
                            )}
                          >
                            <div className="space-y-1 w-full">
                              <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-black text-neutral-800 dark:text-white uppercase tracking-wider">{p.name}</h4>
                                {isCurrent && (
                                  <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[8px] font-black uppercase tracking-wider shrink-0">
                                    {t('marketing_v2.control_center_page.simulator.active')}
                                  </span>
                                )}
                              </div>
                              <p className="text-[9px] text-neutral-400">
                                {p.licenses_count === 1 ? t('marketing_v2.control_center_page.subscription.plan_license_single') : t('marketing_v2.control_center_page.subscription.plan_license_plural').replace('{count}', String(p.licenses_count))}
                              </p>
                            </div>

                            <div className="w-full">
                              <div className="flex items-baseline gap-0.5">
                                <span className="text-base font-black text-neutral-800 dark:text-white">{formatSimulatedPrice(displayPrice)}</span>
                                <span className="text-[8px] text-neutral-400 font-bold">/mês</span>
                              </div>
                              {selectedSimulatedCycle !== 'monthly' && (
                                <p className="text-[8px] text-neutral-400 mt-0.5 leading-normal">
                                  {t('marketing_v2.control_center_page.subscription.plan_billing_hint').replace('{price}', formatSimulatedPrice(
                                    selectedSimulatedCycle === 'quarterly' ? p.price_quarterly :
                                      selectedSimulatedCycle === 'semiannual' ? p.price_semiannually : p.price_yearly
                                  ))}
                                </p>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Trigger to show inline modal */}
                    {(selectedSimulatedPlanId !== simulatedPlanId || selectedSimulatedCycle !== simulatedCycle) && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => setShowSimulatedPlanConfirmModal(true)}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black shadow-lg shadow-indigo-500/10 transition-all flex items-center gap-1.5"
                        >
                          <Zap className="w-3.5 h-3.5 fill-white" />
                          {t('marketing_v2.control_center_page.subscription.btn_confirm_sub')}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Invoice table */}
                  <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-3">
                    <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                      <h4 className="text-xs font-black uppercase tracking-widest text-neutral-800 dark:text-white">
                        {t('marketing_v2.control_center_page.subscription.billing_history')}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-900 text-[8px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                        {t('marketing_v2.control_center_page.subscription.transactions_count')}
                      </span>
                    </div>

                    <div className="border border-neutral-100 dark:border-neutral-800 rounded-xl overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/10">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-neutral-100 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800 text-[8px] font-black uppercase text-neutral-400 tracking-wider">
                            <th className="px-3 py-2">{t('marketing_v2.control_center_page.subscription.col_date')}</th>
                            <th className="px-3 py-2">{t('marketing_v2.control_center_page.subscription.col_cycle')}</th>
                            <th className="px-3 py-2">{t('marketing_v2.control_center_page.subscription.col_value')}</th>
                            <th className="px-3 py-2">{t('marketing_v2.control_center_page.subscription.col_method')}</th>
                            <th className="px-3 py-2">{t('marketing_v2.control_center_page.subscription.col_status')}</th>
                            <th className="px-3 py-2 text-right">{t('marketing_v2.control_center_page.subscription.col_receipt')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300">
                          <tr className="hover:bg-neutral-100/50 dark:hover:bg-neutral-900/20">
                            <td className="px-3 py-2.5 font-bold font-mono">23/05/2026</td>
                            <td className="px-3 py-2.5 font-bold">{getSimulatedCycleLabel(simulatedCycle)}</td>
                            <td className="px-3 py-2.5 font-bold font-mono text-indigo-600 dark:text-indigo-400">
                              {formatSimulatedPrice(getSimulatedPlanPrice(simulatedPlanId, simulatedCycle))}
                            </td>
                            <td className="px-3 py-2.5 font-medium">{simulatedCardBrand ? t('marketing_v2.control_center_page.subscription.method_card') : t('marketing_v2.control_center_page.subscription.method_pix')}</td>
                            <td className="px-3 py-2.5">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase">{t('marketing_v2.control_center_page.simulator.active')}</span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold">
                              <button
                                onClick={() => triggerToast(t('marketing_v2.control_center_page.subscription.toast_loading_receipt'))}
                                className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-350 flex items-center justify-end gap-1"
                              >
                                <span>{t('marketing_v2.control_center_page.subscription.btn_receipt')}</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Simulated Modal Overlay for Credit Card Update */}
                  <AnimatePresence>
                    {showSimulatedCardModal && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 rounded-2xl overflow-hidden flex items-center justify-center p-4">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 shadow-2xl flex flex-col max-h-[92%] overflow-hidden"
                        >
                          <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/60 flex items-center justify-between shrink-0">
                            <div className="flex flex-col text-left">
                              <span className="text-[10px] font-black uppercase tracking-wider dark:text-white">
                                {t('marketing_v2.control_center_page.subscription.card_modal_title')}
                              </span>
                              <span className="text-[8px] text-neutral-400 font-medium">
                                {t('marketing_v2.control_center_page.subscription.card_modal_desc')}
                              </span>
                            </div>
                            <button
                              onClick={() => setShowSimulatedCardModal(false)}
                              className="text-[10px] font-black text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                            >
                              ✕
                            </button>
                          </div>

                          <form onSubmit={handleSimulatedCardSubmit} className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-grow text-left">
                            <div className="space-y-3">
                              <h5 className="text-[9px] font-black uppercase tracking-widest text-indigo-500 border-b border-neutral-100 dark:border-neutral-800 pb-1">
                                {t('marketing_v2.control_center_page.subscription.card_details_header')}
                              </h5>

                              <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-neutral-400">
                                  {t('marketing_v2.control_center_page.subscription.card_number')}
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="4000 1234 5678 9010"
                                  value={simulatedCardForm.cardNumber}
                                  onChange={e => setSimulatedCardForm((prev: any) => ({ ...prev, cardNumber: e.target.value }))}
                                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-2 text-[11px] focus:border-indigo-500 focus:outline-none text-neutral-800 dark:text-white"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-neutral-400">
                                  {t('marketing_v2.control_center_page.subscription.card_name')}
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="ALEXANDRE MOURA"
                                  value={simulatedCardForm.cardName}
                                  onChange={e => setSimulatedCardForm((prev: any) => ({ ...prev, cardName: e.target.value.toUpperCase() }))}
                                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-2 text-[11px] focus:border-indigo-500 focus:outline-none text-neutral-800 dark:text-white"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black uppercase text-neutral-400">
                                    {t('marketing_v2.control_center_page.subscription.card_expiry')}
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="12/30"
                                    value={simulatedCardForm.cardExpiry}
                                    onChange={e => setSimulatedCardForm((prev: any) => ({ ...prev, cardExpiry: e.target.value }))}
                                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-2 text-[11px] focus:border-indigo-500 focus:outline-none text-neutral-800 dark:text-white"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black uppercase text-neutral-400">
                                    {t('marketing_v2.control_center_page.subscription.card_cvv')}
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="123"
                                    value={simulatedCardForm.cardCvv}
                                    onChange={e => setSimulatedCardForm((prev: any) => ({ ...prev, cardCvv: e.target.value }))}
                                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-2 text-[11px] focus:border-indigo-500 focus:outline-none text-neutral-800 dark:text-white"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3 pt-2">
                              <h5 className="text-[9px] font-black uppercase tracking-widest text-indigo-500 border-b border-neutral-100 dark:border-neutral-800 pb-1">
                                {t('marketing_v2.control_center_page.subscription.billing_details_header')}
                              </h5>

                              <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-neutral-400">
                                  {t('marketing_v2.control_center_page.subscription.billing_name')}
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={simulatedCardForm.billingName}
                                  onChange={e => setSimulatedCardForm((prev: any) => ({ ...prev, billingName: e.target.value }))}
                                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-2 text-[11px] focus:border-indigo-500 focus:outline-none text-neutral-800 dark:text-white"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-neutral-400">
                                  {t('marketing_v2.control_center_page.subscription.billing_email')}
                                </label>
                                <input
                                  type="email"
                                  required
                                  value={simulatedCardForm.billingEmail}
                                  onChange={e => setSimulatedCardForm((prev: any) => ({ ...prev, billingEmail: e.target.value }))}
                                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-2 text-[11px] focus:border-indigo-500 focus:outline-none text-neutral-800 dark:text-white"
                                />
                              </div>
                            </div>

                            <div className="flex gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 shrink-0">
                              <button
                                type="button"
                                onClick={() => setShowSimulatedCardModal(false)}
                                className="flex-1 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-[10px] font-bold rounded-xl transition-colors"
                              >
                                {t('common.cancel')}
                              </button>
                              <button
                                type="submit"
                                disabled={isSimulatingCardUpdate}
                                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-[10px] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                              >
                                {isSimulatingCardUpdate ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" /> {t('marketing_v2.control_center_page.subscription.btn_card_updating')}
                                  </>
                                ) : (
                                  t('marketing_v2.control_center_page.subscription.btn_card_submit')
                                )}
                              </button>
                            </div>
                          </form>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Simulated Modal Overlay for Plan Confirmation */}
                  <AnimatePresence>
                    {showSimulatedPlanConfirmModal && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 rounded-2xl overflow-hidden flex items-center justify-center p-4">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="w-full max-w-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 shadow-2xl flex flex-col p-5 space-y-4"
                        >
                          <div className="text-left space-y-1">
                            <h4 className="text-[11px] font-black uppercase tracking-wider dark:text-white">
                              {t('marketing_v2.control_center_page.subscription.plan_modal_title')}
                            </h4>
                            <p className="text-[9px] text-neutral-400 font-medium">
                              {t('marketing_v2.control_center_page.subscription.plan_modal_desc')}
                            </p>
                          </div>

                          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-2.5 text-left text-[10px]">
                            <div>
                              <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400">{t('marketing_v2.control_center_page.subscription.col_current_plan')}</span>
                              <p className="font-bold text-neutral-700 dark:text-neutral-300">
                                {simulatedPlans.find((p: any) => p.id === simulatedPlanId)?.name} ({getSimulatedCycleLabel(simulatedCycle)})
                              </p>
                            </div>
                            <div className="border-t border-neutral-200 dark:border-neutral-800 pt-2 font-semibold">
                              <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500">{t('marketing_v2.control_center_page.subscription.plan_modal_new_plan')}</span>
                              <p className="font-black text-indigo-600 dark:text-indigo-400">
                                {simulatedPlans.find((p: any) => p.id === selectedSimulatedPlanId)?.name} ({getSimulatedCycleLabel(selectedSimulatedCycle)})
                              </p>
                              <p className="text-[9px] text-neutral-500 mt-0.5 leading-relaxed">
                                {t('marketing_v2.control_center_page.subscription.plan_modal_new_value').replace('{price}', formatSimulatedPrice(getSimulatedPlanPrice(selectedSimulatedPlanId, selectedSimulatedCycle)))}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-1.5 text-[9px] text-neutral-500 leading-relaxed text-left">
                            <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <p>
                              {t('marketing_v2.control_center_page.subscription.plan_modal_disclaimer')}
                            </p>
                          </div>

                          <div className="flex gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                            <button
                              type="button"
                              onClick={() => setShowSimulatedPlanConfirmModal(false)}
                              className="flex-1 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-[10px] font-bold rounded-xl transition-colors"
                            >
                              {t('common.cancel')}
                            </button>
                            <button
                              type="button"
                              onClick={handleSimulatedPlanChange}
                              disabled={isSimulatingPlanUpdate}
                              className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-[10px] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                            >
                              {isSimulatingPlanUpdate ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('common.saving')}
                                </>
                              ) : (
                                t('common.confirm')
                              )}
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>
                </motion.div>
              
  )
}
