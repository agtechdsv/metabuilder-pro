'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  CreditCard, 
  QrCode, 
  FileText, 
  CheckCircle2, 
  Loader2, 
  ArrowRight, 
  Copy, 
  Check, 
  AlertCircle,
  HelpCircle,
  Lock,
  X
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getOrCreateDefaultWorkspace } from '@/app/actions/checkout'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/utils/supabase/client'

interface CheckoutClientProps {
  rules: any
  initialLicenses?: number
  initialCycle?: 'monthly' | 'quarterly' | 'semiannual' | 'yearly'
  workspaceSlug?: string
  user: any
  profile?: any
  mode?: string
}

export function CheckoutClient({ rules, initialLicenses = 1, initialCycle, workspaceSlug, user, profile, mode }: CheckoutClientProps) {
  const isUpgrade = mode === 'upgrade'
  const [licenses, setLicenses] = useState(isUpgrade && profile?.subscription_licenses ? Math.max(initialLicenses, profile.subscription_licenses) : initialLicenses)
  const [cycle, setCycle] = useState<'monthly' | 'quarterly' | 'semiannual' | 'yearly'>(
    initialCycle && ['monthly', 'quarterly', 'semiannual', 'yearly'].includes(initialCycle)
      ? initialCycle
      : 'monthly'
  )
  const [workspace, setWorkspace] = useState<any>(null)

  // Checkout form states
  const [billingName, setBillingName] = useState(profile?.full_name || '')
  const [billingCpfCnpj, setBillingCpfCnpj] = useState(profile?.cnpj || '')
  const [billingEmail, setBillingEmail] = useState(profile?.email || user?.email || '')
  const [billingPhone, setBillingPhone] = useState(profile?.whatsapp || '')
  
  // Payment methods: 'card' | 'pix' | 'boleto'
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix' | 'boleto'>('card')
  
  // Card states
  const [cardNumber, setCardNumber] = useState('')
  const [cardName, setCardName] = useState(profile?.full_name || '')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [billingPostalCode, setBillingPostalCode] = useState(profile?.address_zip || '')
  const [billingAddressNumber, setBillingAddressNumber] = useState(profile?.address_number || '')
  
  // General status states
  const [isProcessing, setIsProcessing] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState<'checkout' | 'success'>('checkout')
  const [successWorkspaceSlug, setSuccessWorkspaceSlug] = useState('')
  const [countdown, setCountdown] = useState(10)

  // Dynamic payment response states (from Asaas Deno function)
  const [showPaymentDetails, setShowPaymentDetails] = useState(false)
  const [pixQrCode, setPixQrCode] = useState<string | null>(null)
  const [pixCopiaCola, setPixCopiaCola] = useState<string | null>(null)
  const [barCode, setBarCode] = useState<string | null>(null)
  const [identificationField, setIdentificationField] = useState<string | null>(null)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null)

  const { toast } = useToast()
  const router = useRouter()

  // Load default workspace on mount
  useEffect(() => {
    async function loadWorkspace() {
      const result = await getOrCreateDefaultWorkspace(workspaceSlug)
      if (result.success && result.workspace) {
        setWorkspace(result.workspace)
      } else {
        toast(result.error || 'Erro ao carregar ou criar workspace padrão.', 'error')
      }
    }
    loadWorkspace()
  }, [workspaceSlug])

  // Listen to profile updates from drawer
  useEffect(() => {
    const handleProfileUpdate = (e: Event) => {
      const customEvent = e as CustomEvent
      const data = customEvent.detail
      if (data) {
        if (data.full_name) {
          setBillingName(data.full_name)
          setCardName(data.full_name)
        }
        if (data.cnpj) setBillingCpfCnpj(data.cnpj)
        if (data.email) setBillingEmail(data.email)
        if (data.whatsapp) setBillingPhone(data.whatsapp)
        if (data.address_zip) setBillingPostalCode(data.address_zip)
        if (data.address_number) setBillingAddressNumber(data.address_number)
      }
    }

    window.addEventListener('profile-updated', handleProfileUpdate)
    return () => window.removeEventListener('profile-updated', handleProfileUpdate)
  }, [])

  // Helper to calculate cycle prices dynamically
  const getCyclePrices = (currentCycle: 'monthly' | 'quarterly' | 'semiannual' | 'yearly', targetLicenses: number = licenses) => {
    if (!rules) return { total: 0, monthlyEquivalent: 0, months: 1, dailyRate: 0 }

    const basePrice = Number(rules.base_price) || 450
    let volDiscount = 0
    if (rules.volume_tiers && rules.volume_tiers.length > 0) {
      const sorted = [...rules.volume_tiers].sort((a: any, b: any) => b.min_licenses - a.min_licenses)
      const tier = sorted.find((t: any) => targetLicenses >= t.min_licenses)
      if (tier) volDiscount = tier.discount_percent
    }
    
    const unitPrice = basePrice * (1 - volDiscount / 100)

    let months = 1
    if (currentCycle === 'quarterly') months = 3
    if (currentCycle === 'semiannual') months = 6
    if (currentCycle === 'yearly') months = 12

    let cycleDiscount = 0
    if (rules.cycle_discounts) {
      cycleDiscount = rules.cycle_discounts[currentCycle] || 0
    }

    const totalValue = (unitPrice * targetLicenses * months) * (1 - cycleDiscount / 100)

    return {
      total: totalValue,
      monthlyEquivalent: totalValue / months,
      months,
      dailyRate: totalValue / (months * 30)
    }
  }

  const prorataDetails = useMemo(() => {
    if (!isUpgrade || !profile?.subscription_expires_at || !rules) return null;

    const oldLicenses = profile.subscription_licenses || 1;
    const oldCycle = profile.subscription_cycle || 'monthly';

    const expiresAt = new Date(profile.subscription_expires_at);
    const now = new Date();
    const diffTime = expiresAt.getTime() - now.getTime();
    const daysRemaining = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const oldPrices = getCyclePrices(oldCycle, oldLicenses);
    const newPrices = getCyclePrices(cycle, licenses);

    const diff = (newPrices.dailyRate - oldPrices.dailyRate) * daysRemaining;
    const prorataValue = diff >= 5 ? diff : 0;

    return {
      daysRemaining,
      prorataValue
    };
  }, [isUpgrade, profile, cycle, licenses, rules]);

  // Handle billing process calling Edge Function
  const handleSubmitCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rules) {
      toast('As regras de precificação não estão disponíveis no momento.', 'error')
      return
    }

    if (!billingName || !billingCpfCnpj || !billingEmail || !billingPhone) {
      toast('Preencha todos os campos obrigatórios de faturamento.', 'error')
      return
    }

    if (!workspace) {
      toast('Aguarde o carregamento do workspace.', 'error')
      return
    }

    if (paymentMethod === 'card') {
      if (!cardNumber || !cardName || !cardExpiry || !cardCvv || !billingPostalCode || !billingAddressNumber) {
        toast('Preencha todos os campos do cartão de crédito.', 'error')
        return
      }
    }

    setIsProcessing(true)

    try {
      const supabase = createClient()

      // Chamar Edge Function 'asaas-checkout'
      const { data, error } = await supabase.functions.invoke('asaas-checkout', {
        body: {
          licenses: licenses,
          cycle: cycle,
          paymentMethod: paymentMethod,
          billingName: billingName,
          billingCpfCnpj: billingCpfCnpj,
          billingEmail: billingEmail,
          phone: billingPhone,
          postalCode: paymentMethod === 'card' ? billingPostalCode : '',
          addressNumber: paymentMethod === 'card' ? billingAddressNumber : '',
          cardNumber: paymentMethod === 'card' ? cardNumber : undefined,
          cardName: paymentMethod === 'card' ? cardName : undefined,
          cardExpiry: paymentMethod === 'card' ? cardExpiry : undefined,
          cardCvv: paymentMethod === 'card' ? cardCvv : undefined,
          workspaceId: workspace.id,
          isUpgrade: isUpgrade
        }
      })

      if (error) {
        let errMsg = 'Erro ao processar checkout.'
        try {
          const bodyText = await error.context.text()
          const parsed = JSON.parse(bodyText)
          errMsg = parsed.error || errMsg
        } catch (_) {
          errMsg = error.message || errMsg
        }
        throw new Error(errMsg)
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Erro ao processar checkout.')
      }

      // Se transação de cartão foi confirmada/recebida na hora, ativa localmente
      if (paymentMethod === 'card' && (data.status === 'CONFIRMED' || data.status === 'RECEIVED')) {
        setSuccessWorkspaceSlug(workspace.slug)
        setCheckoutStep('success')
        toast('Pagamento aprovado e plano ativado!', 'success')
      } else {
        // Pix ou Boleto aguardando faturamento
        setPixQrCode(data.pixQrCode)
        setPixCopiaCola(data.pixCopiaCola)
        setBarCode(data.barCode)
        setIdentificationField(data.identificationField)
        setInvoiceUrl(data.invoiceUrl)
        setPendingPaymentId(data.paymentId)
        setShowPaymentDetails(true)
        toast('Assinatura gerada. Aguardando pagamento.', 'success')
      }
    } catch (err: any) {
      toast(err.message || 'Erro ao processar a transação.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  // Polling e Realtime para ativação Pix/Boleto
  useEffect(() => {
    if (!workspace?.id || !user?.id || !showPaymentDetails || checkoutStep === 'success') return

    const supabase = createClient()
    let intervalId: any

    const checkStatus = async () => {
      if (isUpgrade && pendingPaymentId) {
        // Upgrade flow: wait for the specific payment to be paid
        const { data, error } = await supabase
          .from('payments')
          .select('status')
          .eq('asaas_payment_id', pendingPaymentId)
          .single()

        if (!error && data && data.status === 'paid') {
          setSuccessWorkspaceSlug(workspace.slug)
          setCheckoutStep('success')
          toast('Pagamento confirmado e plano atualizado!', 'success')
          clearInterval(intervalId)
        }
      } else if (!isUpgrade) {
        // New subscription flow: wait for the profile to be active
        const { data, error } = await supabase
          .from('profiles')
          .select('subscription_status')
          .eq('id', user.id)
          .single()

        if (!error && data && data.subscription_status === 'active') {
          setSuccessWorkspaceSlug(workspace.slug)
          setCheckoutStep('success')
          toast('Pagamento confirmado e plano ativado!', 'success')
          clearInterval(intervalId)
        }
      }
    }

    // Polling a cada 3 segundos
    intervalId = setInterval(checkStatus, 3000)

    // Realtime do Supabase
    let channel: any
    if (isUpgrade && pendingPaymentId) {
      channel = supabase
        .channel(`payment-status-checkout-${pendingPaymentId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'payments',
            filter: `asaas_payment_id=eq.${pendingPaymentId}`,
          },
          (payload: any) => {
            if (payload.new && payload.new.status === 'paid') {
              setSuccessWorkspaceSlug(workspace.slug)
              setCheckoutStep('success')
              toast('Pagamento confirmado e plano atualizado!', 'success')
              clearInterval(intervalId)
            }
          }
        )
        .subscribe()
    } else if (!isUpgrade) {
      channel = supabase
        .channel(`profile-status-checkout-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload: any) => {
            if (payload.new && payload.new.subscription_status === 'active') {
              setSuccessWorkspaceSlug(workspace.slug)
              setCheckoutStep('success')
              toast('Pagamento confirmado e plano ativado!', 'success')
              clearInterval(intervalId)
            }
          }
        )
        .subscribe()
    }

    return () => {
      clearInterval(intervalId)
      if (channel) supabase.removeChannel(channel)
    }
  }, [workspace, user, showPaymentDetails, checkoutStep, isUpgrade, pendingPaymentId])

  // Redirect countdown
  useEffect(() => {
    if (checkoutStep === 'success' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (checkoutStep === 'success' && countdown === 0) {
      router.push('/client/dashboard')
    }
  }, [checkoutStep, countdown, router])

  const featuresList = [
    "Acesso a todas as ferramentas PRO",
    "Desenvolvimento Ilimitado",
    "Suporte e Atualizações (IClub)"
  ]


  if (checkoutStep === 'success') {
    return (
      <div className="relative max-w-xl w-full mx-auto bg-white/95 dark:bg-neutral-900/90 backdrop-blur-2xl border border-neutral-200 dark:border-neutral-800 p-8 md:p-12 rounded-[2.5rem] shadow-2xl text-center space-y-8 overflow-hidden">
        {/* Glows */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 blur-[80px] pointer-events-none rounded-full"></div>

        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500 border border-emerald-500/20 shadow-inner">
          <CheckCircle2 className="w-12 h-12" />
        </div>

        <div className="space-y-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            ASAAS Gateway Confirmado
          </span>
          <h2 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">Pagamento Aprovado!</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            A licença para <strong className="text-indigo-500 font-extrabold">{licenses} {licenses === 1 ? 'usuário' : 'usuários'}</strong> foi ativada e aplicada a todos os seus workspaces.
          </p>
        </div>

        <div className="p-5 bg-neutral-50 dark:bg-neutral-950/60 rounded-2xl border border-neutral-100 dark:border-neutral-800/80 text-left text-xs text-neutral-600 dark:text-neutral-300 space-y-2">
          <p><strong>Ambiente de Trabalho:</strong> /client/dashboard</p>
          <p>
            <strong>Valor Contratado:</strong> R${' '}
            {getCyclePrices(cycle).total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            ({cycle === 'monthly' ? 'Mensal' : cycle === 'quarterly' ? 'Trimestral' : cycle === 'semiannual' ? 'Semestral' : 'Anual'})
          </p>
          <p><strong>Status da Assinatura:</strong> Ativa (Acesso ilimitado e sem restrições)</p>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-neutral-400">
            Redirecionando em <span className="font-bold text-indigo-500">{countdown}s</span> para o painel de controle...
          </p>
          <button
            onClick={() => router.push('/client/dashboard')}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-500/25 active:scale-[0.98]"
          >
            Acessar Painel Agora <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // Show pix/boleto dynamic credentials view while waiting
  if (showPaymentDetails) {
    return (
      <div className="relative max-w-xl w-full mx-auto bg-white/95 dark:bg-neutral-900/90 backdrop-blur-2xl border border-neutral-200 dark:border-neutral-800 p-8 md:p-12 rounded-[2.5rem] shadow-2xl text-center space-y-8 overflow-hidden">
        {/* Glows */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 blur-[80px] pointer-events-none rounded-full"></div>

        <div className="space-y-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
            Aguardando Pagamento
          </span>
          <h2 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
            {paymentMethod === 'pix' ? 'Pague com Pix' : 'Pague com Boleto'}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Sua assinatura para <strong className="text-indigo-500 font-extrabold">{licenses} {licenses === 1 ? 'licença' : 'licenças'}</strong> foi gerada. Complete o pagamento para ativar.
          </p>
        </div>

        {paymentMethod === 'pix' ? (
          <div className="space-y-6 text-center">
            <div className="p-6 bg-neutral-50 dark:bg-neutral-950/60 rounded-3xl border border-neutral-150 dark:border-neutral-800 max-w-sm mx-auto space-y-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Escaneie o QR Code abaixo pelo app do seu banco:</p>
              
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
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Ou copie a chave Pix Copia e Cola:</p>
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
                        toast('Chave Pix copiada!', 'success')
                      }}
                      className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg text-indigo-500 transition-colors shrink-0"
                      title="Copiar código"
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
                <h3 className="font-bold text-sm text-neutral-800 dark:text-neutral-200">Boleto Bancário</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Vencimento em 3 dias úteis. Compensação em até 1 dia útil após o pagamento.
                </p>
              </div>

              {barCode && (
                <div className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-1">
                  <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Linha Digitável:</p>
                  <p className="font-mono text-[10px] text-neutral-800 dark:text-neutral-200 font-bold select-all leading-normal">
                    {identificationField || barCode}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(identificationField || barCode || '')
                      toast('Código copiado!', 'success')
                    }}
                    className="text-[9px] text-indigo-500 hover:text-indigo-650 font-bold underline mt-1.5 block mx-auto"
                  >
                    Copiar Linha Digitável
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
                  Visualizar / Imprimir Boleto
                </a>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-3 pt-4">
          <div className="flex items-center gap-2 text-xs text-indigo-550 dark:text-indigo-400 font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            <span>Aguardando confirmação de pagamento...</span>
          </div>
          <p className="text-[10px] text-neutral-400 leading-normal max-w-sm">
            Assim que seu banco confirmar o pagamento, esta tela se atualizará automaticamente.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative max-w-5xl w-full mx-auto bg-white/95 dark:bg-neutral-900/90 backdrop-blur-2xl border border-neutral-200/50 dark:border-neutral-800/60 p-8 md:p-12 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      
      {/* Decorative glows inside modal */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px] pointer-events-none rounded-full"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 blur-[100px] pointer-events-none rounded-full"></div>

      {/* Close Button */}
      <button 
        onClick={() => router.push(isUpgrade ? '/client/dashboard' : '/')}
        className="absolute top-6 right-6 p-2 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-400 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white transition-all active:scale-90 z-20"
        title="Fechar checkout"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Modal Header */}
      <div className="space-y-2 mb-10 pr-12">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-neutral-900 dark:text-white leading-[1.1]">
          Finalizar <span className="text-indigo-600">Assinatura</span>
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">
          Insira seus dados de faturamento e inicie a automação profissional sem limites.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        
        {/* Left Column: Forms */}
        {licenses >= 50 ? (
          <div className="lg:col-span-6 space-y-8 animate-in fade-in slide-in-from-left-4">
            <div className="bg-neutral-50/50 dark:bg-neutral-950/40 border border-neutral-200/50 dark:border-neutral-800/40 p-8 md:p-12 rounded-3xl space-y-6 shadow-sm text-center flex flex-col items-center justify-center min-h-[500px]">
              <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-500 mb-2 border border-indigo-500/20">
                 <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1v2H9V7zm0 4h1v2H9v-2zm0 4h1v2H9v-2zm-3-8h1v2H6V7zm0 4h1v2H6v-2zm0 4h1v2H6v-2zm8-8h1v2h-1V7zm0 4h1v2h-1v-2zm0 4h1v2h-1v-2z" /></svg>
              </div>
              <h2 className="text-3xl font-black text-neutral-900 dark:text-white">Plano Enterprise</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">
                Para volumes de 50 ou mais licenças, oferecemos condições exclusivas, SLA dedicado e suporte prioritário.
              </p>
              <a 
                href={`https://wa.me/5511999999999?text=Ol%C3%A1%2C%20tenho%20interesse%20em%20um%20plano%20Enterprise%20do%20MetaBuilder%20Pro%20para%20${licenses}%20licen%C3%A7as`} 
                target="_blank" 
                rel="noreferrer"
                className="mt-4 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/25"
              >
                Falar com Consultor
              </a>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-6 space-y-8 animate-in fade-in slide-in-from-left-4">
            <form onSubmit={handleSubmitCheckout} className="space-y-8">
            
            {/* Step 1: Billing Info */}
            <div className="bg-neutral-50/50 dark:bg-neutral-950/40 border border-neutral-200/50 dark:border-neutral-800/40 p-6 md:p-8 rounded-3xl space-y-6 shadow-sm">
              <h2 className="text-lg font-bold flex items-center gap-3 border-b border-neutral-150 dark:border-neutral-850/60 pb-4 text-neutral-900 dark:text-white">
                <FileText className="w-5 h-5 text-indigo-500" />
                1. Informações de Faturamento
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">Nome / Razão Social</label>
                  <input 
                    type="text" 
                    required
                    value={billingName}
                    onChange={(e) => setBillingName(e.target.value)}
                    placeholder="Ex: Alexandre Santos"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none text-neutral-900 dark:text-white transition-all shadow-sm focus:ring-2 focus:ring-indigo-500/25"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">CPF / CNPJ</label>
                  <input 
                    type="text" 
                    required
                    value={billingCpfCnpj}
                    onChange={(e) => setBillingCpfCnpj(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none text-neutral-900 dark:text-white transition-all shadow-sm focus:ring-2 focus:ring-indigo-500/25"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">Telefone / Celular</label>
                  <input 
                    type="tel" 
                    required
                    value={billingPhone}
                    onChange={(e) => setBillingPhone(e.target.value)}
                    placeholder="Ex: (11) 99999-9999"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none text-neutral-900 dark:text-white transition-all shadow-sm focus:ring-2 focus:ring-indigo-500/25"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">E-mail para Notas e Cobranças</label>
                  <input 
                    type="email" 
                    required
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    placeholder="exemplo@empresa.com"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none text-neutral-900 dark:text-white transition-all shadow-sm focus:ring-2 focus:ring-indigo-500/25"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Payment Method */}
            <div className="bg-neutral-50/50 dark:bg-neutral-950/40 border border-neutral-200/50 dark:border-neutral-800/40 p-6 md:p-8 rounded-3xl space-y-6 shadow-sm">
              <h2 className="text-lg font-bold flex items-center gap-3 border-b border-neutral-150 dark:border-neutral-850/60 pb-4 text-neutral-900 dark:text-white">
                <CreditCard className="w-5 h-5 text-indigo-500" />
                2. Forma de Pagamento (ASAAS Gateway)
              </h2>

              {/* Payment Tabs */}
              <div className="flex bg-neutral-100/60 dark:bg-neutral-950 p-1.5 rounded-2xl border border-neutral-200/40 dark:border-neutral-800/80 gap-1 relative">
                {['card', 'pix', 'boleto'].map((method) => {
                  const isSelected = paymentMethod === method
                  const icons = {
                    card: <CreditCard className="w-3.5 h-3.5 relative z-10" />,
                    pix: <QrCode className="w-3.5 h-3.5 relative z-10" />,
                    boleto: <FileText className="w-3.5 h-3.5 relative z-10" />
                  }
                  const labels = {
                    card: 'Cartão',
                    pix: 'Pix',
                    boleto: 'Boleto'
                  }
                  
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method as any)}
                      className="relative flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all outline-none select-none z-10"
                    >
                      {/* Sliding Background Capsule */}
                      {isSelected && (
                        <motion.div
                          layoutId="activePaymentMethodBg"
                          className="absolute inset-0 bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-250/20 dark:border-neutral-700/30 z-0"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      
                      {icons[method as keyof typeof icons]}
                      <span className={`relative z-10 font-extrabold transition-colors ${
                        isSelected 
                          ? 'text-neutral-900 dark:text-white' 
                          : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white'
                      }`}>
                        {labels[method as keyof typeof labels]}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Dynamic Content based on payment method */}
              <div className="pt-2">
                <AnimatePresence mode="wait">
                  {paymentMethod === 'card' && (
                    <motion.div 
                      key="card-fields"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      {/* Card graphics mockup */}
                      <div className="relative w-full max-w-sm mx-auto aspect-[1.586/1] bg-gradient-to-br from-indigo-950 to-indigo-700 dark:from-neutral-950 dark:to-indigo-950 p-6 rounded-[2rem] shadow-xl text-white flex flex-col justify-between overflow-hidden border border-white/5">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 blur-2xl rounded-full"></div>
                        <div className="flex justify-between items-start z-10">
                          <div className="px-2.5 py-1 bg-white/10 rounded-lg border border-white/5 font-black text-[9px] uppercase tracking-widest">
                            Checkout Seguro
                          </div>
                          <Lock className="w-4 h-4 text-white/40" />
                        </div>
                        <div className="space-y-4 z-10">
                          <div className="text-lg font-mono tracking-widest select-none min-h-[28px] opacity-90">
                            {cardNumber || '•••• •••• •••• ••••'}
                          </div>
                          <div className="flex justify-between items-end">
                            <div className="min-w-0 pr-4">
                              <p className="text-[7px] uppercase tracking-widest text-white/45">Titular</p>
                              <p className="text-xs font-bold tracking-wide uppercase truncate max-w-[180px]">
                                {cardName || 'Nome do Titular'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[7px] uppercase tracking-widest text-white/45 font-mono">Validade</p>
                              <p className="text-xs font-bold tracking-wide font-mono">
                                {cardExpiry || 'MM/AA'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">Número do Cartão</label>
                          <input 
                            type="text" 
                            required={paymentMethod === 'card'}
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim().substring(0, 19))}
                            placeholder="4000 1234 5678 9010"
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none text-neutral-900 dark:text-white font-mono transition-all focus:ring-2 focus:ring-indigo-500/25"
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">Nome no Cartão</label>
                          <input 
                            type="text" 
                            required={paymentMethod === 'card'}
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            placeholder="Como impresso no cartão"
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none text-neutral-900 dark:text-white uppercase transition-all focus:ring-2 focus:ring-indigo-500/25"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">Validade</label>
                          <input 
                            type="text" 
                            required={paymentMethod === 'card'}
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value.replace(/[^\d]/g, '').replace(/(\d{2})(\d{2})/, '$1/$2').substring(0, 5))}
                            placeholder="MM/AA"
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none text-neutral-900 dark:text-white font-mono transition-all focus:ring-2 focus:ring-indigo-500/25"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">CVV</label>
                          <input 
                            type="password" 
                            required={paymentMethod === 'card'}
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value.replace(/[^\d]/g, '').substring(0, 4))}
                            placeholder="123"
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none text-neutral-900 dark:text-white font-mono transition-all focus:ring-2 focus:ring-indigo-500/25"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">CEP do Titular</label>
                          <input 
                            type="text" 
                            required={paymentMethod === 'card'}
                            value={billingPostalCode}
                            onChange={(e) => setBillingPostalCode(e.target.value.replace(/[^\d]/g, '').substring(0, 8))}
                            placeholder="00000-000"
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none text-neutral-900 dark:text-white font-mono transition-all focus:ring-2 focus:ring-indigo-500/25"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">Número da Residência</label>
                          <input 
                            type="text" 
                            required={paymentMethod === 'card'}
                            value={billingAddressNumber}
                            onChange={(e) => setBillingAddressNumber(e.target.value)}
                            placeholder="Ex: 123"
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none text-neutral-900 dark:text-white transition-all focus:ring-2 focus:ring-indigo-500/25"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {paymentMethod === 'pix' && (
                    <motion.div 
                      key="pix-mock-fields"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4 py-4 text-center text-xs text-neutral-500 dark:text-neutral-400"
                    >
                      <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-500 mx-auto border border-indigo-500/20">
                        <QrCode className="w-8 h-8" />
                      </div>
                      <p className="max-w-xs mx-auto leading-relaxed">
                        Ao clicar em finalizar, o Asaas gerará um QR Code Pix único e chave Copia e Cola para você realizar o pagamento com compensação em segundos.
                      </p>
                    </motion.div>
                  )}

                  {paymentMethod === 'boleto' && (
                    <motion.div 
                      key="boleto-mock-fields"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4 py-4 text-center text-xs text-neutral-500 dark:text-neutral-400"
                    >
                      <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-500 mx-auto border border-indigo-500/20">
                        <FileText className="w-8 h-8" />
                      </div>
                      <p className="max-w-xs mx-auto leading-relaxed">
                        Ao clicar em finalizar, geraremos um Boleto com código de barras e link em PDF. Você poderá efetuar o pagamento em qualquer agência, internet banking ou app.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing || !workspace || (isUpgrade && licenses === profile?.subscription_licenses && cycle === profile?.subscription_cycle)}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-[0.99] shadow-xl shadow-indigo-500/25"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processando no ASAAS...</span>
                </>
              ) : !workspace ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Carregando ambiente...</span>
                </>
              ) : (
                <>
                  <span>Finalizar Assinatura</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
          </div>
        )}

        {/* Right Column: Order Summary */}
        <div className="lg:col-span-6 sticky top-6">
          
          {/* License Selector */}
          <div className="bg-neutral-50/50 dark:bg-neutral-950/40 border border-neutral-200/50 dark:border-neutral-800/40 p-6 rounded-3xl mb-4 shadow-sm flex items-center justify-between z-20 relative">
            <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Quantidade de Licenças</span>
            <div className="flex items-center gap-4">
              <button 
                type="button"
                onClick={() => setLicenses(Math.max(1, licenses - 1))}
                className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 transition-colors"
              >
                -
              </button>
              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 w-8 text-center">{licenses}</span>
              <button 
                type="button"
                onClick={() => setLicenses(licenses + 1)}
                className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Cycle Selector */}
          <div className="bg-neutral-100/60 dark:bg-neutral-900/40 backdrop-blur-md border border-neutral-200/50 dark:border-neutral-800/40 p-1.5 rounded-2xl flex items-center gap-1.5 w-full relative z-20 mb-4 shadow-inner">
            {(['monthly', 'quarterly', 'semiannual', 'yearly'] as const).map((c) => {
              const isSelected = cycle === c
              const labels = {
                monthly: 'Mensal',
                quarterly: 'Trimestral',
                semiannual: 'Semestral',
                yearly: 'Anual'
              }
              
              let discountLabel = ''
              if (rules?.cycle_discounts?.[c]) {
                discountLabel = `-${rules.cycle_discounts[c]}%`
              }

              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCycle(c)}
                  className="relative flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex flex-col items-center justify-center transition-all select-none z-10"
                >
                  {isSelected && (
                    <motion.div
                      layoutId="activeCycleBg"
                      className="absolute inset-0 bg-white dark:bg-neutral-950 rounded-xl shadow-md border border-neutral-200/40 dark:border-neutral-800/30 z-0"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className={`relative z-10 font-extrabold transition-colors ${
                    isSelected 
                      ? 'text-indigo-650 dark:text-indigo-400' 
                      : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white'
                  }`}>
                    {labels[c]}
                  </span>
                  {discountLabel && (
                    <span className="relative z-10 text-[8px] font-bold text-emerald-500 mt-0.5">
                      {discountLabel}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Main Card Body */}
          <div className="bg-neutral-50/50 dark:bg-neutral-950/40 border border-neutral-200/50 dark:border-neutral-800/40 p-6 md:p-8 rounded-3xl space-y-6 shadow-sm relative z-10 transition-all duration-300">
            <h2 className="text-lg font-bold border-b border-neutral-150 dark:border-neutral-850/60 pb-4 text-neutral-900 dark:text-white">
              Resumo do Pedido
            </h2>

            {/* Selected Plan Details */}
            <div className="space-y-6">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="text-xl font-black text-indigo-650 dark:text-indigo-400">Plano Pro</h3>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">Pacote flexível com desconto progressivo por volume e prazo de renovação.</p>
                </div>
                {(() => {
                  const { total, monthlyEquivalent } = getCyclePrices(cycle)
                  return (
                    <div className="text-right shrink-0">
                      {licenses >= 50 ? (
                        <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                          Sob Consulta
                        </span>
                      ) : (
                        <>
                          <span className="text-lg font-black text-neutral-900 dark:text-white">
                            R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[9px] text-neutral-400 block font-bold mt-0.5">
                            equiv. R$ {monthlyEquivalent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / mês
                          </span>
                          {licenses > 1 && (
                            <span className="text-[9px] text-indigo-500 dark:text-indigo-400 block font-bold mt-0.5">
                              equiv. R$ {(monthlyEquivalent / licenses).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / licença
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )
                })()}
              </div>

              <div className="p-4 bg-white dark:bg-neutral-900/60 rounded-2xl border border-neutral-150 dark:border-neutral-800/50 space-y-3">
                <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Incluso no pacote:</p>
                <ul className="space-y-2.5">
                  <li className="flex items-center gap-2 text-xs font-bold text-neutral-700 dark:text-neutral-200">
                    <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>{licenses} {licenses === 1 ? 'Licença Ativa' : 'Licenças Ativas'}</span>
                  </li>
                  {featuresList.map((feat: string, index: number) => (
                    <li key={index} className="flex items-start gap-2.5 text-xs text-neutral-500 dark:text-neutral-450 leading-tight">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Total Line */}
              <div className="border-t border-neutral-150 dark:border-neutral-800/80 pt-4 flex flex-col gap-2">
                {isUpgrade && licenses < 50 && prorataDetails && prorataDetails.prorataValue > 0 && (
                  <div className="flex justify-between items-center mb-2 bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                    <span className="text-xs font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-400">
                      Cobrança Avulsa Hoje (Prorata)
                    </span>
                    <span className="text-xl font-black text-indigo-650 dark:text-indigo-400 whitespace-nowrap flex-shrink-0 ml-4 text-right">
                      R$ {prorataDetails.prorataValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                    {isUpgrade ? 'Valor da Assinatura (Próximo Ciclo)' : 'Total do Ciclo'}
                  </span>
                  <span className="text-2xl font-black text-neutral-900 dark:text-white whitespace-nowrap flex-shrink-0 ml-4 text-right">
                    {licenses >= 50 ? 'Sob Consulta' : `R$ ${getCyclePrices(cycle).total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </span>
                </div>
                {isUpgrade && licenses < 50 && (
                  <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                    <p className="text-xs text-amber-800 dark:text-amber-400 font-medium">
                      <strong>Atenção:</strong> Como este é um upgrade, será cobrado hoje apenas um <strong className="font-black uppercase">valor proporcional (prorata)</strong> referente aos dias restantes até a próxima fatura.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Usage Policies */}
            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900/60 border border-neutral-150 dark:border-neutral-800/50 flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Políticas de Licenciamento</p>
                <p className="text-[9px] text-neutral-500 dark:text-neutral-450 mt-1 leading-normal">
                  Sua assinatura permite criar e trabalhar em múltiplos workspaces. As licenças inclusas limitam o total de colaboradores simultâneos ativos no sistema. Cancelamento flexível a qualquer momento.
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
