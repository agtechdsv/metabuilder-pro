import { useState } from 'react'
import { useI18n } from '@/i18n/I18nContext'

export interface LogAction {
  time: string
  action: string
  detail: string
  gap: string
}

export function useControlCenterMockups() {
  const { t } = useI18n()

  // BI Tab States
  const biWorkspaces = [
    { name: 'AGTech', slug: 'agtech', projects: 1, cases: 3, users: 3, created: '23/05/2026' }
  ]

  // Productivity Tab States
  const [selectedProject, setSelectedProject] = useState('All')
  const [selectedDev, setSelectedDev] = useState('All')
  const [selectedPeriod, setSelectedPeriod] = useState('All')
  const [isDetailedLogOpen, setIsDetailedLogOpen] = useState(false)
  const [detailedLogTheme, setDetailedLogTheme] = useState<'dark' | 'light'>('dark')
  const [simulatedModalTab, setSimulatedModalTab] = useState<'visual' | 'raw'>('visual')
  const [simulatedCopied, setSimulatedCopied] = useState(false)
  const [simulatedProdSubTab, setSimulatedProdSubTab] = useState<'summary' | 'detailed'>('summary')

  // Detailed Log mock database
  const mockDetailedLogs: Record<string, { dev: string; start: string; activeTime: string; actions: LogAction[] }> = {
    session1: {
      dev: 'Alexandre Moura',
      start: '26/05/2026, 19:05:50',
      activeTime: '0m 8s',
      actions: [
        { time: '2026-05-26T19:05:50.000Z', action: 'SESSION_START', detail: t('marketing_v2.control_center_page.productivity.sim_start_1'), gap: 'START' },
        { time: '2026-05-26T19:05:58.000Z', action: 'NAVIGATION', detail: t('marketing_v2.control_center_page.productivity.sim_close_1'), gap: '+8s' }
      ]
    },
    session2: {
      dev: 'Alexandre Moura',
      start: '26/05/2026, 18:48:35',
      activeTime: '1m 13s',
      actions: [
        { time: '2026-05-26T18:48:35.000Z', action: 'SESSION_START', detail: t('marketing_v2.control_center_page.productivity.sim_start_2'), gap: 'START' },
        { time: '2026-05-26T18:48:45.000Z', action: 'CONFIG_CHANGE', detail: t('marketing_v2.control_center_page.productivity.sim_remove_save'), gap: '+10s' },
        { time: '2026-05-26T18:49:02.000Z', action: 'CONFIG_CHANGE', detail: t('marketing_v2.control_center_page.productivity.sim_add_save'), gap: '+17s' },
        { time: '2026-05-26T18:49:15.000Z', action: 'CONFIG_CHANGE', detail: t('marketing_v2.control_center_page.productivity.sim_remove_save'), gap: '+13s' },
        { time: '2026-05-26T18:49:30.000Z', action: 'CONFIG_CHANGE', detail: t('marketing_v2.control_center_page.productivity.sim_add_save'), gap: '+15s' },
        { time: '2026-05-26T18:49:48.000Z', action: 'NAVIGATION', detail: t('marketing_v2.control_center_page.productivity.sim_finish_2'), gap: '+18s' }
      ]
    }
  }

  const [activeDetailedLog, setActiveDetailedLog] = useState<keyof typeof mockDetailedLogs>('session2')

  const handleCloseSimulatedLog = () => {
    setIsDetailedLogOpen(false)
    setSimulatedModalTab('visual')
    setSimulatedCopied(false)
  }

  const handleSimulatedCopyJson = (actions: LogAction[]) => {
    const text = JSON.stringify(actions, null, 2)
    navigator.clipboard.writeText(text)
      .then(() => {
        setSimulatedCopied(true)
        setTimeout(() => setSimulatedCopied(false), 2000)
      })
      .catch((err) => {
        console.error('Erro ao copiar:', err)
      })
  }

  const handleSimulatedDownloadJson = (actions: LogAction[]) => {
    const blob = new Blob([JSON.stringify(actions, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mock_session_log_${activeDetailedLog}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Cancel Tab States
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [cancelComment, setCancelComment] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Simulated Subscription States
  const simulatedPlans = [
    {
      id: 'start',
      name: 'Start',
      licenses_count: 1,
      price: 450.00,
      price_monthly: 450.00,
      price_quarterly: 1215.00,
      price_semiannually: 2295.00,
      price_yearly: 4320.00
    },
    {
      id: 'professional',
      name: 'Professional',
      licenses_count: 3,
      price: 1190.00,
      price_monthly: 1190.00,
      price_quarterly: 3213.00,
      price_semiannually: 6069.00,
      price_yearly: 11424.00
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      licenses_count: 5,
      price: 1500.00,
      price_monthly: 1500.00,
      price_quarterly: 4050.00,
      price_semiannually: 7650.00,
      price_yearly: 14400.00
    }
  ]

  const [simulatedPlanId, setSimulatedPlanId] = useState('professional')
  const [simulatedCycle, setSimulatedCycle] = useState('semiannual')
  const [selectedSimulatedPlanId, setSelectedSimulatedPlanId] = useState('professional')
  const [selectedSimulatedCycle, setSelectedSimulatedCycle] = useState('semiannual')

  const [simulatedCardBrand, setSimulatedCardBrand] = useState('VISA')
  const [simulatedCardDigits, setSimulatedCardDigits] = useState('1234')

  const [showSimulatedCardModal, setShowSimulatedCardModal] = useState(false)
  const [showSimulatedPlanConfirmModal, setShowSimulatedPlanConfirmModal] = useState(false)

  const [isSimulatingCardUpdate, setIsSimulatingCardUpdate] = useState(false)
  const [isSimulatingPlanUpdate, setIsSimulatingPlanUpdate] = useState(false)

  const [simulatedCardForm, setSimulatedCardForm] = useState({
    cardNumber: '',
    cardName: '',
    cardExpiry: '',
    cardCvv: '',
    billingName: 'Alexandre Moura',
    billingCpfCnpj: '',
    billingEmail: 'contato@agtech.com.br',
    phone: '',
    postalCode: '',
    addressNumber: ''
  })

  const getSimulatedCycleLabel = (cycle: string) => {
    switch (cycle) {
      case 'monthly': return 'Mensal'
      case 'quarterly': return 'Trimestral'
      case 'semiannual': return 'Semestral'
      case 'yearly': return 'Anual'
      default: return '—'
    }
  }

  const formatSimulatedPrice = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
  }

  const getSimulatedPlanPrice = (planId: string, cycle: string) => {
    const p = simulatedPlans.find(pl => pl.id === planId)
    if (!p) return 0
    switch (cycle) {
      case 'monthly': return p.price_monthly
      case 'quarterly': return p.price_quarterly
      case 'semiannual': return p.price_semiannually
      case 'yearly': return p.price_yearly
      default: return p.price_monthly
    }
  }

  const handleSimulatedCardSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSimulatingCardUpdate(true)
    setTimeout(() => {
      const brand = simulatedCardForm.cardNumber.startsWith('5') ? 'MASTERCARD' : 'VISA'
      const digits = simulatedCardForm.cardNumber.slice(-4) || '4321'
      setSimulatedCardBrand(brand)
      setSimulatedCardDigits(digits)
      setIsSimulatingCardUpdate(false)
      setShowSimulatedCardModal(false)
      triggerToast('Cartão de crédito atualizado com sucesso! (Simulado)')
      setSimulatedCardForm(prev => ({
        ...prev,
        cardNumber: '',
        cardName: '',
        cardExpiry: '',
        cardCvv: ''
      }))
    }, 1500)
  }

  const handleSimulatedPlanChange = () => {
    setIsSimulatingPlanUpdate(true)
    setTimeout(() => {
      setSimulatedPlanId(selectedSimulatedPlanId)
      setSimulatedCycle(selectedSimulatedCycle)
      setIsSimulatingPlanUpdate(false)
      setShowSimulatedPlanConfirmModal(false)
      triggerToast('Plano de assinatura atualizado com sucesso! (Simulado)')
    }, 1500)
  }

  const toggleReason = (reason: string) => {
    if (selectedReasons.includes(reason)) {
      setSelectedReasons(selectedReasons.filter(r => r !== reason))
    } else {
      setSelectedReasons([...selectedReasons, reason])
    }
  }

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  return {
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
  }
}
