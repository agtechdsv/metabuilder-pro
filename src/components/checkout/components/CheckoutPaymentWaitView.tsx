
import { Copy, FileText, Loader2, QrCode, CheckCircle2, Mail } from 'lucide-react'
import { useCheckoutState } from '../hooks/useCheckoutState'
import { sendPaymentEmail } from '@/app/actions/checkout-email'
import { useI18n } from '@/i18n'

export function CheckoutPaymentWaitView({ state }: { state: ReturnType<typeof useCheckoutState> }) {
  const { t } = useI18n()
  const { 
    paymentMethod, licenses, pixQrCode, pixCopiaCola, barCode, 
    identificationField, invoiceUrl, toast, isSendingEmail, 
    setIsSendingEmail, emailSent, setEmailSent, isUpgrade, 
    prorataDetails, getCyclePrices, cycle, billingEmail
  } = state

  return (
    <div className="relative max-w-xl w-full mx-auto bg-white/95 dark:bg-neutral-900/90 backdrop-blur-2xl border border-neutral-200 dark:border-neutral-800 p-8 md:p-12 rounded-[2.5rem] shadow-2xl text-center space-y-8 overflow-hidden">
        {/* Glows */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 blur-[80px] pointer-events-none rounded-full"></div>

        <div className="space-y-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
            {t('checkout.wait.waiting_title', 'Aguardando Pagamento')}
          </span>
          <h2 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
            {paymentMethod === 'pix' ? t('checkout.wait.pay_with_pix', 'Pague com Pix') : t('checkout.wait.pay_with_boleto', 'Pague com Boleto')}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('checkout.wait.license_generated_desc', 'Sua assinatura para {count} foi gerada. Complete o pagamento para ativar.').replace('{count}', `${licenses} ${licenses === 1 ? t('checkout.active_license_single', 'licença') : t('checkout.active_license_plural', 'licenças')}`)}
          </p>
        </div>

        {paymentMethod === 'pix' ? (
          <div className="space-y-6 text-center">
            <div className="p-6 bg-neutral-50 dark:bg-neutral-950/60 rounded-3xl border border-neutral-150 dark:border-neutral-800 max-w-sm mx-auto space-y-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">{t('checkout.wait.scan_qr', 'Escaneie o QR Code abaixo pelo app do seu banco:')}</p>
              
              {pixQrCode ? (
                <div className="w-48 h-48 bg-white border border-neutral-200 rounded-2xl mx-auto flex items-center justify-center p-3 relative shadow-md">
                  <img src={`data:image/png;base64,${pixQrCode}`} alt="Pix QR Code" className="w-full h-full" />
                </div>
              ) : (
                <div className="w-48 h-48 bg-neutral-100 dark:bg-neutral-900 rounded-2xl mx-auto flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
              )}

              {pixCopiaCola && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{t('checkout.wait.or_copy_pix', 'Ou copie a chave Pix Copia e Cola:')}</p>
                  <div className="flex gap-2 bg-white dark:bg-neutral-900 p-2 rounded-xl border border-neutral-200 dark:border-neutral-800">
                    <input 
                      type="text" 
                      readOnly 
                      value={pixCopiaCola} 
                      className="bg-transparent border-none text-xs font-mono text-neutral-500 truncate flex-1 outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(pixCopiaCola || '')
                        toast(t('checkout.wait.pix_copied', 'Chave Pix copiada!'), 'success')
                      }}
                      className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg text-indigo-500 transition-colors shrink-0"
                      title={t('checkout.wait.copy_code', 'Copiar código')}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-md mx-auto text-center">
            <div className="p-6 bg-neutral-50 dark:bg-neutral-950/60 rounded-3xl border border-neutral-150 dark:border-neutral-800 space-y-6">
              <div className="w-14 h-14 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-500 mx-auto border border-indigo-500/20">
                <FileText className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-neutral-800 dark:text-neutral-200">{t('checkout.wait.boleto_title', 'Boleto Bancário')}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {t('checkout.wait.boleto_hint', 'Vencimento em 3 dias úteis. Compensação em até 1 dia útil após o pagamento.')}
                </p>
              </div>

              {barCode && (
                <div className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-1">
                  <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">{t('checkout.wait.bar_code_label', 'Linha Digitável:')}</p>
                  <p className="font-mono text-[10px] text-neutral-800 dark:text-neutral-200 font-bold select-all leading-normal">
                    {identificationField || barCode}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(identificationField || barCode || '')
                      toast(t('checkout.wait.code_copied', 'Código copiado!'), 'success')
                    }}
                    className="text-[9px] text-indigo-500 hover:text-indigo-650 font-bold underline mt-1.5 block mx-auto"
                  >
                    {t('checkout.wait.copy_bar_code', 'Copiar Linha Digitável')}
                  </button>
                </div>
              )}

              {invoiceUrl && (
                <a
                  href={invoiceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-md shadow-indigo-500/15"
                >
                  {t('checkout.wait.view_print_boleto', 'Visualizar / Imprimir Boleto')}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Share Buttons */}
        <div className="w-full max-w-md mx-auto pt-6 pb-2 border-t border-neutral-200/50 dark:border-neutral-800/50 mt-6 space-y-4">
          <p className="text-center text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
            {t('checkout.wait.pay_later_title', 'Precisa pagar depois ou pelo celular?')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => {
                const text = encodeURIComponent(`Olá! Aqui está o resumo da sua assinatura MetaBuilder PRO:\n\n🔗 *Link da fatura:* ${invoiceUrl}\n\n${paymentMethod === 'pix' ? `🔹 *PIX Copia e Cola:*\n${pixCopiaCola}` : `🔹 *Linha Digitável do Boleto:*\n${identificationField || barCode}`}\n\nObrigado por escolher o MetaBuilder PRO!`);
                window.open(`https://wa.me/?text=${text}`, '_blank');
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#25D366]/20 active:scale-95"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              {t('checkout.wait.send_whatsapp', 'Enviar por WhatsApp')}
            </button>
            <button
              type="button"
              disabled={isSendingEmail || emailSent}
              onClick={async () => {
                setIsSendingEmail(true)
                try {
                  const res = await sendPaymentEmail({
                    email: billingEmail,
                    paymentMethod: paymentMethod as 'pix' | 'boleto',
                    amount: isUpgrade ? (prorataDetails?.prorataValue || 0) : getCyclePrices(cycle, licenses).total,
                    invoiceUrl,
                    barCode: paymentMethod === 'pix' ? pixCopiaCola : (identificationField || barCode)
                  })
                  if (res.success) {
                    setEmailSent(true)
                    toast(t('checkout.wait.email_sent_success', 'Fatura enviada para o seu e-mail!'), 'success')
                  } else {
                    toast(res.error || t('checkout.wait.email_sent_error', 'Erro ao enviar e-mail.'), 'error')
                  }
                } catch (e) {
                  toast(t('checkout.wait.email_conn_error', 'Erro de conexão ao enviar e-mail.'), 'error')
                } finally {
                  setIsSendingEmail(false)
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 disabled:opacity-50 rounded-xl text-xs font-bold transition-all active:scale-95"
            >
              {isSendingEmail ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : emailSent ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {t('checkout.wait.sent_email', 'Enviado')}
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  {t('checkout.wait.send_email', 'Enviar por E-mail')}
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 pt-6">
          <div className="flex items-center gap-2 text-xs text-indigo-550 dark:text-indigo-400 font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            <span>{t('checkout.wait.waiting_confirmation', 'Aguardando confirmação de pagamento...')}</span>
          </div>
          <p className="text-[10px] text-neutral-400 leading-normal max-w-sm">
            {t('checkout.wait.waiting_hint', 'Assim que seu banco confirmar o pagamento, esta tela se atualizará automaticamente.')}
          </p>
        </div>
      </div>
    )
}

