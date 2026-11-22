import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { BILLING_REFRESH_EVENT } from '@/lib/billing/notice'

export const CANCELLATION_REASONS = [
  { id: 'preco_alto', label: 'PREÇO MUITO ALTO' },
  { id: 'dificuldade_uso', label: 'DIFICULDADE DE USO' },
  { id: 'falta_recursos', label: 'FALTA DE RECURSOS / CONEXÕES' },
  { id: 'mudanca_estrategia', label: 'MUDANÇA DE ESTRATÉGIA / NÃO PRECISO' },
  { id: 'outro', label: 'OUTRO MOTIVO' },
] as const

interface UseClientSubscriptionProps {
  localProfile: any
  setLocalProfile: React.Dispatch<React.SetStateAction<any>>
  activeTab: string
  workspaces: any[]
  toast: (msg: string, type: 'success' | 'error' | 'info') => void
  router: ReturnType<typeof useRouter>
}

/**
 * Nome da Edge Function de assinatura (GET). Se a URL traz ?pay=pay_... (link do e-mail ou do banner), vai junto: o servidor devolve exatamente
 * essa cobrança, depois de conferir que é do usuário da sessão.
 */
export function subscriptionFnName(): string {
  try {
    const p = new URLSearchParams(window.location.search).get('pay')
    return p && /^pay_[A-Za-z0-9]+$/.test(p) ? `asaas-update-subscription?pay=${encodeURIComponent(p)}` : 'asaas-update-subscription'
  } catch { return 'asaas-update-subscription' }
}

export function useClientSubscription({
  localProfile,
  setLocalProfile,
  activeTab,
  workspaces,
  toast,
  router
}: UseClientSubscriptionProps) {
  const [asaasSubData, setAsaasSubData] = useState<{ creditCard: any; pendingInvoice: any } | null>(null)
  const [loadingAsaasData, setLoadingAsaasData] = useState(false)

  const [showCardModal, setShowCardModal] = useState(false)
  const [isUpdatingCard, setIsUpdatingCard] = useState(false)
  const [cardForm, setCardForm] = useState({
    cardNumber: '',
    cardName: '',
    cardExpiry: '',
    cardCvv: '',
    billingName: localProfile?.full_name || '',
    billingCpfCnpj: '',
    billingEmail: localProfile?.email || '',
    phone: '',
    postalCode: '',
    addressNumber: ''
  })

  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [cancellationComment, setCancellationComment] = useState('')
  const [cancellationError, setCancellationError] = useState<string | null>(null)
  const [isCanceling, setIsCanceling] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)

  useEffect(() => {
    if (activeTab === 'subscription' && localProfile?.asaas_subscription_id) {
      setLoadingAsaasData(true)
      const supabase = createClient()
      supabase.functions.invoke(subscriptionFnName(), { method: 'GET' })
        .then(({ data, error }) => {
          if (data && !error) {
            setAsaasSubData(data)
          }
        })
        .catch(err => console.error('Erro ao consultar dados da assinatura:', err))
        .finally(() => setLoadingAsaasData(false))
    }
  }, [activeTab, localProfile?.asaas_subscription_id])

  // Cobrança na tela (Pix): enquanto ela estiver aberta, olha o NOSSO banco a cada 5 s (o webhook do Asaas grava o pagamento lá). Quando o pagamento
  // entra, avisa, atualiza o perfil e a tela. Não consulta o Asaas (barato) e para sozinho depois de 15 minutos.
  useEffect(() => {
    const inv = asaasSubData?.pendingInvoice
    const uid = localProfile?.id
    if (!inv || !uid) return
    const supabase = createClient()
    let stopped = false
    let base: { paid: number; status: string; lic: number } | null = null
    let ticks = 0
    const check = async () => {
      if (stopped) return
      try {
        const [paidRes, profRes] = await Promise.all([
          supabase.from('payments').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'paid'),
          supabase.from('profiles').select('subscription_status, subscription_licenses, subscription_cycle, subscription_expires_at, subscription_amount').eq('id', uid).maybeSingle(),
        ])
        const now = { paid: paidRes.count ?? 0, status: String(profRes.data?.subscription_status ?? ''), lic: Number(profRes.data?.subscription_licenses ?? 0) }
        if (!base) { base = now; return }
        if (now.paid > base.paid || (now.status === 'active' && base.status !== 'active') || now.lic > base.lic) {
          stopped = true
          clearInterval(timer)
          toast('Pagamento recebido! Obrigado.', 'success')
          if (profRes.data) setLocalProfile((prev: any) => prev ? { ...prev, ...profRes.data } : prev)
          setAsaasSubData(prev => (prev ? { ...prev, pendingInvoice: null } : prev))
          window.dispatchEvent(new Event(BILLING_REFRESH_EVENT)) // o banner de cobrança confere de novo e some
          router.refresh()
        }
      } catch { /* tenta de novo no próximo ciclo */ }
    }
    const timer = setInterval(() => { if (++ticks > 180) { stopped = true; clearInterval(timer); return } void check() }, 5000)
    void check()
    return () => { stopped = true; clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asaasSubData?.pendingInvoice?.id, localProfile?.id])

  const handleUpdateCard = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingCard(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.functions.invoke('asaas-update-subscription', {
        body: {
          action: 'updateCard',
          ...cardForm
        }
      })
      if (error) throw error
      if (data?.success) {
        toast('Dados de pagamento atualizados com sucesso!', 'success')
        setShowCardModal(false)

        setCardForm(prev => ({
          ...prev,
          cardNumber: '',
          cardName: '',
          cardExpiry: '',
          cardCvv: ''
        }))

        setLocalProfile((prev: any) => prev ? {
          ...prev,
          card_brand: data.cardBrand,
          card_last_digits: data.cardLastDigits
        } : prev)

        if (localProfile?.asaas_subscription_id) {
          const { data: realTimeData } = await supabase.functions.invoke(subscriptionFnName(), { method: 'GET' })
          if (realTimeData) setAsaasSubData(realTimeData)
        }

        router.refresh()
      } else {
        throw new Error(data?.error || 'Erro ao atualizar dados do cartão.')
      }
    } catch (err: any) {
      toast(err.message || 'Erro ao processar cartão. Verifique os dados e tente novamente.', 'error')
    } finally {
      setIsUpdatingCard(false)
    }
  }

  const handleCancelSubscription = async () => {
    setIsCanceling(true)
    try {
      const supabase = createClient()

      const { error: dbError } = await supabase.from('cancellation_feedbacks').insert({
        user_id: localProfile?.id || null,
        workspace_id: workspaces?.[0]?.id || null,
        reasons: selectedReasons.map(r => {
          const found = CANCELLATION_REASONS.find(cr => cr.id === r)
          return found ? found.label : r
        }),
        comment: cancellationComment || null,
        subscription_id: localProfile?.asaas_subscription_id || null
      })

      if (dbError) {
        console.error('Erro ao salvar feedback de cancelamento:', dbError)
      }

      const { data, error } = await supabase.functions.invoke('asaas-cancel', {
        body: { workspaceId: workspaces?.[0]?.id || null },
      })
      if (error) throw error
      if (data?.success) {
        toast('Assinatura cancelada com sucesso.', 'success')
        setLocalProfile((prev: any) => prev ? { ...prev, subscription_status: 'canceled' } : prev)
        setShowCancelModal(false)
        router.refresh()
      } else {
        throw new Error(data?.error || 'Erro desconhecido ao cancelar assinatura.')
      }
    } catch (err: any) {
      toast(err.message || 'Erro ao cancelar assinatura. Tente novamente.', 'error')
    } finally {
      setIsCanceling(false)
    }
  }

  return {
    asaasSubData,
    loadingAsaasData,
    showCardModal,
    setShowCardModal,
    isUpdatingCard,
    cardForm,
    setCardForm,
    handleUpdateCard,
    selectedReasons,
    setSelectedReasons,
    cancellationComment,
    setCancellationComment,
    cancellationError,
    setCancellationError,
    isCanceling,
    showCancelModal,
    setShowCancelModal,
    handleCancelSubscription,
    CANCELLATION_REASONS
  }
}
