import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

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
      supabase.functions.invoke('asaas-update-subscription', { method: 'GET' })
        .then(({ data, error }) => {
          if (data && !error) {
            setAsaasSubData(data)
          }
        })
        .catch(err => console.error('Erro ao consultar dados da assinatura:', err))
        .finally(() => setLoadingAsaasData(false))
    }
  }, [activeTab, localProfile?.asaas_subscription_id])

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
          const { data: realTimeData } = await supabase.functions.invoke('asaas-update-subscription', { method: 'GET' })
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
    if (!workspaces[0]) return
    setIsCanceling(true)
    try {
      const supabase = createClient()

      const { error: dbError } = await supabase.from('cancellation_feedbacks').insert({
        user_id: localProfile?.id || null,
        workspace_id: workspaces[0].id,
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
        body: { workspaceId: workspaces[0].id },
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
