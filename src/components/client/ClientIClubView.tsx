import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy, Layers, Loader2, TrendingUp, Users, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

interface ClientIClubViewProps {
  loadingIClub: boolean
  iclubData: any
  localProfile: any
  toast: any
}

export function ClientIClubView({
  loadingIClub,
  iclubData,
  localProfile,
  toast,
}: ClientIClubViewProps) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      {loadingIClub ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-neutral-500 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-xs font-bold uppercase tracking-wider">{t('client_views.iclub.loading', 'Carregando painel do iClub...')}</span>
        </div>
      ) : iclubData ? (
        <div className="space-y-8">
          {/* Banner Premium */}
          <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-950 text-white rounded-[2rem] p-8 shadow-lg border border-indigo-500/20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 max-w-2xl space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Zap className="w-3.5 h-3.5 text-indigo-400 animate-pulse" /> {t('client_views.iclub.banner_tag', 'iClub MetaBuilder PRO')}
              </span>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight">{t('client_views.iclub.banner_title', 'O Clube de Vantagens exclusivo para você crescer.')}</h2>
              <p className="text-xs md:text-sm text-indigo-200 leading-relaxed max-w-xl">
                {t('client_views.iclub.banner_desc', 'Indique novos clientes e ganhe descontos acumulados na sua próxima fatura, ou adquira novas licenças e ganhe licenças inteiramente gratuitas!')}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {iclubData.rules.map((rule: any) => (
                  <div key={rule.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-start gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-300">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">{rule.name}</h4>
                      <p className="text-[10px] text-indigo-200/80 mt-1">
                        {rule.benefit_type === 'volume_license'
                          ? t('client_views.iclub.volume_license_desc', 'Ganha {count} licença grátis a cada {target} contratadas.').replace('{count}', String(Number(rule.reward_value))).replace('{target}', String(rule.target_count))
                          : t('client_views.iclub.discount_desc', 'Ganhe {percent}% de desconto vitalício a cada indicado ativo — enquanto ele for assinante, você desconta!').replace('{percent}', String(Number(rule.reward_value)))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Referral Link & Quota Progress Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Link de Indicação */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
              {(() => {
                const referralRule = iclubData.rules.find((r: any) => r.benefit_type === 'referral_discount');
                const referralDiscount = referralRule ? Math.round(Number(referralRule.reward_value)) : 5;

                return (
                  <>
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                          <Users className="w-4.5 h-4.5" />
                        </div>
                        <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">{t('client_views.iclub.referral_tag', 'Convite iClub')}</span>
                      </div>
                      <h3 className="text-lg font-black text-neutral-900 dark:text-white">{t('client_views.iclub.referral_title', 'Indique & Ganhe')}</h3>
                      <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                        {t('client_views.iclub.referral_desc', 'Copie o link abaixo e compartilhe. Quando seu indicado assinar qualquer plano, seu desconto de {percent}% será aplicado automaticamente — e {bold}.')
                          .replace('{percent}', String(referralDiscount))
                          .replace('{bold}', t('client_views.iclub.referral_bold', 'se mantém vitalício enquanto ele continuar ativo como assinante!'))}
                      </p>
                    </div>

                    <div className="mt-6 space-y-2">
                      <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">{t('client_views.iclub.referral_link_label', 'Seu Link de Indicação')}</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={typeof window !== 'undefined' ? `${window.location.origin}/?ref=${iclubData.referralCode}` : ''}
                          className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-[11px] font-mono text-neutral-700 dark:text-neutral-300 w-full focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            const link = typeof window !== 'undefined' ? `${window.location.origin}/?ref=${iclubData.referralCode}` : '';
                            navigator.clipboard.writeText(link);
                            setCopied(true);
                            toast(t('client_views.iclub.referral_copied_toast', 'Link de indicação copiado!'), 'success');
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center shrink-0"
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Progresso de Licenças por Volume */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
              {(() => {
                const volumeRule = iclubData.rules.find((r: any) => r.benefit_type === 'volume_license');
                const target = volumeRule ? volumeRule.target_count : 12;
                const rewardValue = volumeRule ? Math.round(Number(volumeRule.reward_value)) : 1;
                const currentVal = localProfile?.subscription_licenses || 1;
                const progress = Math.min((currentVal / target) * 100, 100);
                const licensesRemaining = target - (currentVal % target);

                return (
                  <>
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                          <Layers className="w-4.5 h-4.5" />
                        </div>
                        <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">{t('client_views.iclub.volume_tag', 'Volume de Licenças')}</span>
                      </div>
                      <h3 className="text-lg font-black text-neutral-900 dark:text-white">{t('client_views.iclub.volume_title', 'Licença Grátis por Volume')}</h3>
                      <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                        {t('client_views.iclub.volume_desc', 'A cada {target} licenças ativas contratadas, o iClub libera {reward} {extra}.')
                          .replace('{target}', String(target))
                          .replace('{reward}', String(rewardValue))
                          .replace('{extra}', rewardValue === 1 ? t('client_views.iclub.single_extra', 'licença extra totalmente gratuita') : t('client_views.iclub.plural_extras', 'licenças extras totalmente gratuitas'))}
                      </p>
                    </div>

                    <div className="mt-6 space-y-2.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-neutral-500">{t('client_views.iclub.progress_label', 'Progresso')}</span>
                        <span className="text-neutral-900 dark:text-white">
                          {t('client_views.iclub.licenses_count', '{current} / {target} Licenças').replace('{current}', String(currentVal)).replace('{target}', String(target))}
                        </span>
                      </div>
                      <div className="w-full bg-neutral-150 dark:bg-neutral-800 rounded-full h-2.5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full bg-emerald-500 rounded-full"
                        />
                      </div>
                      <p className="text-[10px] text-neutral-400 font-bold">
                        {currentVal >= target
                          ? t('client_views.iclub.goal_achieved', 'Você já atingiu a meta de volume! Recompensas ativas liberadas.')
                          : t('client_views.iclub.goal_remaining', 'Falta(m) {remaining} licença(s) para sua próxima recompensa.').replace('{remaining}', String(licensesRemaining))}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Desconto Acumulado */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
              {(() => {
                const referralRule = iclubData.rules.find((r: any) => r.benefit_type === 'referral_discount');
                const referralDiscount = referralRule ? Math.round(Number(referralRule.reward_value)) : 5;

                const totalDiscount = iclubData.rewards
                  .filter((r: any) => r.reward_type === 'percent_discount' && r.status === 'active')
                  .reduce((sum: number, r: any) => sum + Number(r.reward_value), 0);

                return (
                  <>
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl">
                          <TrendingUp className="w-4.5 h-4.5" />
                        </div>
                        <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">{t('client_views.iclub.discount_tag', 'Descontos Acumulados')}</span>
                      </div>
                      <h3 className="text-lg font-black text-neutral-900 dark:text-white">{t('client_views.iclub.discount_title', 'Faturamento iClub')}</h3>
                      <p className="text-xs text-neutral-550 mt-1.5 leading-relaxed text-neutral-500">
                        {t('client_views.iclub.discount_desc_full', 'Indicações que se tornarem assinantes concedem {percent}% de desconto de forma cumulativa na sua próxima fatura. O desconto é vitalício: enquanto o indicado permanecer assinante ativo, você continua descontando a cada renovação.')
                          .replace('{percent}', String(referralDiscount))}
                      </p>
                    </div>

                    <div className="mt-6 space-y-2">
                      <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">{t('client_views.iclub.next_invoice_discount', 'Desconto na Próxima Fatura')}</span>
                      <div className="p-3 bg-purple-550/10 rounded-2xl border border-purple-500/20 flex items-center justify-between">
                        <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{totalDiscount}%</span>
                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">{t('client_views.iclub.discount_suffix', 'De Desconto')}</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* List of Referred Users & Rewards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Indicações Table (7 cols) */}
            <div className="lg:col-span-7 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm flex flex-col justify-between">
              <div>
                <div className="p-6 border-b border-neutral-100 dark:border-neutral-850 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm text-neutral-800 dark:text-white font-black">{t('client_views.iclub.referrals_history_title', 'Histórico de Indicações')}</h3>
                    <p className="text-[10px] text-neutral-400 mt-1">{t('client_views.iclub.referrals_history_desc', 'Acompanhe as pessoas que você convidou.')}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-450">
                    {t('client_views.iclub.referrals_count', '{count} Indicações').replace('{count}', String(iclubData.referrals.length))}
                  </span>
                </div>

                {iclubData.referrals.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-neutral-100 dark:border-neutral-850 text-[10px] font-black uppercase text-neutral-400 tracking-wider bg-neutral-50/50 dark:bg-neutral-950/20">
                          <th className="px-6 py-3">{t('client_views.iclub.table_invited', 'Convidado / Email')}</th>
                          <th className="px-6 py-3">{t('client_views.iclub.table_date', 'Data')}</th>
                          <th className="px-6 py-3 text-right">{t('client_views.iclub.table_status', 'Status')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {iclubData.referrals.map((ref: any) => (
                          <tr key={ref.id} className="text-xs text-neutral-700 dark:text-neutral-350 hover:bg-neutral-50/30 dark:hover:bg-neutral-950/10">
                            <td className="px-6 py-4.5">
                              <div>
                                <span className="font-bold text-neutral-900 dark:text-white">
                                  {ref.referred_name || ref.referred_email.split('@')[0]}
                                </span>
                                <span className="block text-[10px] text-neutral-450 mt-0.5">{ref.referred_email}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4.5 text-neutral-450">
                              {new Date(ref.created_at).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-6 py-4.5 text-right">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                ref.status === 'subscribed' || ref.status === 'reward_applied'
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-450"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                              )}>
                                {ref.status === 'subscribed' || ref.status === 'reward_applied' ? t('client_views.iclub.status_active_subscriber', 'Assinante Ativo') : t('client_views.iclub.status_registered', 'Cadastro Realizado')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-neutral-400 italic text-xs">
                    {t('client_views.iclub.no_referrals', 'Você ainda não fez nenhuma indicação no iClub. Comece compartilhando seu link!')}
                  </div>
                )}
              </div>
            </div>

            {/* Rewards History Timeline (5 cols) */}
            <div className="lg:col-span-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-neutral-100 dark:border-neutral-850">
                <h3 className="text-sm font-bold text-neutral-800 dark:text-white font-black">{t('client_views.iclub.rewards_history_title', 'Histórico de Recompensas')}</h3>
                <p className="text-[10px] text-neutral-400 mt-1">{t('client_views.iclub.rewards_history_desc', 'Veja seus prêmios e bônus adquiridos.')}</p>
              </div>

              <div className="p-6 space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {iclubData.rewards.length > 0 ? (
                  iclubData.rewards.map((reward: any) => (
                    <div key={reward.id} className="p-3.5 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 rounded-2xl flex items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase text-indigo-500">
                          {reward.reward_type === 'free_license' ? t('client_views.iclub.reward_extra_license', 'Licença Extra') : t('client_views.iclub.reward_invoice_discount', 'Desconto de Fatura')}
                        </span>
                        <p className="font-bold text-neutral-800 dark:text-neutral-200 leading-snug">
                          {reward.notes || (reward.reward_type === 'free_license' ? t('client_views.iclub.reward_bonus_desc', 'Bônus de 1 licença extra') : t('client_views.iclub.reward_discount_desc', 'Desconto de {percent}%').replace('{percent}', String(Number(reward.reward_value))))}
                        </p>
                        <span className="block text-[9px] text-neutral-400">
                          {t('client_views.iclub.granted_at', 'Concedido em {date}').replace('{date}', new Date(reward.created_at).toLocaleDateString('pt-BR'))}
                        </span>
                      </div>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest whitespace-nowrap",
                        reward.status === 'active'
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-450"
                          : reward.status === 'applied'
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-450"
                            : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                      )}>
                        {reward.status === 'active' ? t('client_views.iclub.status_active', 'Ativo') : reward.status === 'applied' ? t('client_views.iclub.status_applied', 'Consumido') : t('client_views.iclub.status_expired', 'Expirado')}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-neutral-400 italic text-xs py-8">
                    {t('client_views.iclub.no_rewards', 'Nenhuma recompensa recebida ainda.')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-neutral-400 italic bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl text-xs">
          {t('client_views.iclub.error_init', 'Não foi possível inicializar o painel do iClub.')}
        </div>
      )}
    </div>
  )
}

