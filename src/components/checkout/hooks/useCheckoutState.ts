import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { getOrCreateDefaultWorkspace } from '@/app/actions/checkout'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/utils/supabase/client'

export interface CheckoutClientProps {
  rules: any
  initialLicenses?: number
  initialCycle?: 'monthly' | 'quarterly' | 'semiannual' | 'yearly'
  workspaceSlug?: string
  user: any
  profile?: any
  mode?: string
}

export function useCheckoutState({ rules, initialLicenses = 1, initialCycle, workspaceSlug, user, profile, mode }: CheckoutClientProps) {
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

  // Share states
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

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

    let oldDailyRate = 0;
    if (profile.subscription_amount && profile.subscription_amount > 0) {
      let oldMonths = 1;
      if (oldCycle === 'quarterly') oldMonths = 3;
      else if (oldCycle === 'semiannual') oldMonths = 6;
      else if (oldCycle === 'yearly') oldMonths = 12;
      oldDailyRate = profile.subscription_amount / (oldMonths * 30);
    } else {
      const oldPrices = getCyclePrices(oldCycle, oldLicenses);
      oldDailyRate = oldPrices.dailyRate;
    }

    const newPrices = getCyclePrices(cycle, licenses);

    const diff = (newPrices.dailyRate - oldDailyRate) * daysRemaining;
    const prorataValue = diff >= 5 ? diff : 0;

    return {
      daysRemaining,
      prorataValue
    };
  }, [isUpgrade, profile, cycle, licenses, rules]);

  const isDowngradeOrSame = isUpgrade && (prorataDetails?.prorataValue ?? 0) < 5;

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

    if (paymentMethod === 'card' && !isDowngradeOrSame) {
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

      // Se transação de cartão foi confirmada/recebida na hora, ou se for downgrade (não gerou cobrança)
      if ((paymentMethod === 'card' || !data.paymentId) && (data.status === 'CONFIRMED' || data.status === 'RECEIVED')) {
        setSuccessWorkspaceSlug(workspace.slug)
        setCheckoutStep('success')
        toast('Plano atualizado com sucesso!', 'success')
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

  return {
    isUpgrade, licenses, setLicenses, cycle, setCycle, workspace,
    billingName, setBillingName, billingCpfCnpj, setBillingCpfCnpj,
    billingEmail, setBillingEmail, billingPhone, setBillingPhone,
    paymentMethod, setPaymentMethod, cardNumber, setCardNumber,
    cardName, setCardName, cardExpiry, setCardExpiry, cardCvv, setCardCvv,
    billingPostalCode, setBillingPostalCode, billingAddressNumber, setBillingAddressNumber,
    isProcessing, checkoutStep, showPaymentDetails, getCyclePrices, prorataDetails, isDowngradeOrSame, handleSubmitCheckout, featuresList, router,
    countdown, successWorkspaceSlug, pixQrCode, pixCopiaCola, barCode, identificationField, invoiceUrl, pendingPaymentId,
    isSendingEmail, setIsSendingEmail, emailSent, setEmailSent, toast
  }
}
