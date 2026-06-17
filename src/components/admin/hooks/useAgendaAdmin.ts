import { useState, useRef, useMemo, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'
import {
  getAllAppointments,
  updateAppointmentStatus,
  deleteAppointment,
  updateAppointmentDate,
  updateAppointmentLink,
  sendConfirmationEmail
} from '@/app/actions/agenda'

export interface Appointment {
  id: string
  titulo: string
  descricao: string | null
  data_inicio: string
  data_fim: string
  status: 'Pendente' | 'Confirmado' | 'Cancelado'
  categoria: string | null
  prioridade: string | null
  cor_etiqueta: string | null
  cliente_nome: string | null
  cliente_email: string | null
  cliente_whatsapp: string | null
  link_demonstracao?: string | null
  created_at: string
  updated_at: string
}

export function useAgendaAdmin(activeTab: string) {
  const { toast } = useToast()

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false)
  const [agendaFilter, setAgendaFilter] = useState<'all' | 'Pendente' | 'Confirmado' | 'Cancelado'>('all')
  const [agendaSearchQuery, setAgendaSearchQuery] = useState('')
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)

  const [isRescheduling, setIsRescheduling] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isDeletingAppointment, setIsDeletingAppointment] = useState(false)
  const [isDeleteAppointmentModalOpen, setIsDeleteAppointmentModalOpen] = useState(false)
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null)

  const [fastRescheduleMode, setFastRescheduleMode] = useState(false)
  const [reschedulingAppointment, setReschedulingAppointment] = useState<Appointment | null>(null)
  const [isConfirmFastRescheduleOpen, setIsConfirmFastRescheduleOpen] = useState(false)
  const [fastRescheduleTargetDate, setFastRescheduleTargetDate] = useState<Date | null>(null)
  const [fastRescheduleTargetSlot, setFastRescheduleTargetSlot] = useState<string | null>(null)

  const [focusDate, setFocusDate] = useState<Date>(new Date())

  const fetchAppointments = async () => {
    setIsLoadingAppointments(true)
    const res = await getAllAppointments()
    if (res.success && res.appointments) {
      setAppointments(res.appointments as Appointment[])
    } else {
      toast(res.error || 'Erro ao carregar a agenda.', 'error')
    }
    setIsLoadingAppointments(false)
  }

  useEffect(() => {
    if (activeTab === 'agenda') {
      fetchAppointments()
    }
  }, [activeTab])

  const whatsappWindowRef = useRef<Window | null>(null)
  const [demoLink, setDemoLink] = useState('')
  const [isSavingLink, setIsSavingLink] = useState(false)

  useEffect(() => {
    if (selectedAppointment) {
      setDemoLink(selectedAppointment.link_demonstracao || '')
    } else {
      setDemoLink('')
    }
  }, [selectedAppointment])

  const handleSaveDemoLink = async (id: string) => {
    setIsSavingLink(true)
    const res = await updateAppointmentLink(id, demoLink)
    if (res.success) {
      toast('Link da demonstração atualizado com sucesso!', 'success')
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, link_demonstracao: demoLink } : a))
      if (selectedAppointment?.id === id) {
        setSelectedAppointment(prev => prev ? { ...prev, link_demonstracao: demoLink } : null)
      }
    } else {
      toast(res.error || 'Erro ao atualizar link da demonstração.', 'error')
    }
    setIsSavingLink(false)
  }

  const [isSendingEmail, setIsSendingEmail] = useState<string | null>(null)

  const handleSendEmail = async (app: Appointment) => {
    if (!app.link_demonstracao) {
      toast('Por favor, defina e salve um link da demonstração primeiro antes de enviar o e-mail.', 'error')
      return
    }
    setIsSendingEmail(app.id)
    const res = await sendConfirmationEmail({
      id: app.id,
      clientName: app.cliente_nome || 'Cliente',
      clientEmail: app.cliente_email || '',
      dateInicio: app.data_inicio,
      linkDemonstracao: app.link_demonstracao
    })
    if (res.success) {
      toast('E-mail de confirmação enviado com sucesso para o cliente!', 'success')
      setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'Confirmado' } : a))
      if (selectedAppointment?.id === app.id) {
        setSelectedAppointment(prev => prev ? { ...prev, status: 'Confirmado' } : null)
      }
    } else {
      toast(res.error || 'Erro ao enviar o e-mail de confirmação.', 'error')
    }
    setIsSendingEmail(null)
  }

  const getWhatsappUrl = (app: Appointment) => {
    const cleanPhone = app.cliente_whatsapp?.replace(/\D/g, '') || ''
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
    const startDate = new Date(app.data_inicio)
    const friendlyDate = startDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    const timeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}h`
    const message = `Olá, *${app.cliente_nome || 'Cliente'}*! Tudo bem?

Aqui é o Alexandre Moura do *MetaBuilderPRO*. \u{1F680}

Passando para confirmar o agendamento da sua demonstração prática exclusiva de 30 minutos!

\u{1F4C5} *Data*: ${friendlyDate}
\u{23F0} *Hora*: ${timeStr} (Horário de Brasília)
\u{1F517} *Link da Reunião*: ${app.link_demonstracao || 'O link do Google Meet será gerado/enviado próximo à reunião'}

Você pode acessar a sala de videoconferência diretamente pelo link acima no horário agendado. Qualquer dúvida ou necessidade de reagendamento, basta me mandar uma mensagem por aqui.

Nos vemos em breve!`
    return `https://web.whatsapp.com/send/?phone=${phoneWithCountry}&text=${encodeURIComponent(message)}`
  }

  const handleOpenWhatsapp = (app: Appointment) => {
    const url = getWhatsappUrl(app)
    try {
      if (whatsappWindowRef.current && !whatsappWindowRef.current.closed) {
        whatsappWindowRef.current.location.href = url
        whatsappWindowRef.current.focus()
      } else {
        whatsappWindowRef.current = window.open(url, "whatsapp_web")
      }
    } catch (e) {
      whatsappWindowRef.current = window.open(url, "whatsapp_web")
    }
  }

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setIsUpdatingStatus(true)
    const res = await updateAppointmentStatus(id, newStatus)
    if (res.success) {
      if (newStatus === 'Cancelado') {
        toast('Compromisso cancelado com sucesso.', 'success', {
          label: 'Desfazer',
          onClick: () => handleUpdateStatus(id, 'Pendente')
        })
      } else {
        toast(`Status do compromisso atualizado para ${newStatus}.`, 'success')
      }
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus as any } : a))
      if (selectedAppointment?.id === id) {
        setSelectedAppointment(prev => prev ? { ...prev, status: newStatus as any } : null)
      }
    } else {
      toast(res.error || 'Erro ao atualizar status.', 'error')
    }
    setIsUpdatingStatus(false)
  }

  const handleDeleteAppointmentAction = async () => {
    if (!appointmentToDelete) return
    setIsDeletingAppointment(true)
    const res = await deleteAppointment(appointmentToDelete.id)
    if (res.success) {
      toast('Compromisso excluído permanentemente.', 'success')
      setAppointments(prev => prev.filter(a => a.id !== appointmentToDelete.id))
      setIsDeleteAppointmentModalOpen(false)
      setAppointmentToDelete(null)
      if (selectedAppointment?.id === appointmentToDelete.id) {
        setSelectedAppointment(null)
      }
    } else {
      toast(res.error || 'Erro ao excluir compromisso.', 'error')
    }
    setIsDeletingAppointment(false)
  }

  const handleConfirmFastReschedule = async () => {
    if (!reschedulingAppointment || !fastRescheduleTargetDate || !fastRescheduleTargetSlot) return
    setIsRescheduling(true)
    try {
      const [hours, minutes] = fastRescheduleTargetSlot.split(':').map(Number)
      const startDateTime = new Date(fastRescheduleTargetDate)
      startDateTime.setHours(hours, minutes, 0, 0)
      const endDateTime = new Date(startDateTime)
      endDateTime.setMinutes(endDateTime.getMinutes() + 30)

      const res = await updateAppointmentDate(
        reschedulingAppointment.id,
        startDateTime.toISOString(),
        endDateTime.toISOString()
      )

      if (res.success) {
        toast('Compromisso reagendado com sucesso!', 'success')
        setAppointments(prev => prev.map(a => a.id === reschedulingAppointment.id ? {
          ...a,
          data_inicio: startDateTime.toISOString(),
          data_fim: endDateTime.toISOString(),
          updated_at: new Date().toISOString()
        } : a))
        setIsConfirmFastRescheduleOpen(false)
        setFastRescheduleMode(false)
        setReschedulingAppointment(null)
      } else {
        toast(res.error || 'Erro ao reagendar compromisso.', 'error')
      }
    } catch (err) {
      toast('Erro de processamento. Verifique os dados.', 'error')
    } finally {
      setIsRescheduling(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const findAppointmentForSlot = (dayDate: Date, slotStr: string) => {
    const [slotH, slotM] = slotStr.split(':').map(Number)
    return appointments.find(app => {
      const appDate = new Date(app.data_inicio)
      return (
        appDate.getFullYear() === dayDate.getFullYear() &&
        appDate.getMonth() === dayDate.getMonth() &&
        appDate.getDate() === dayDate.getDate() &&
        appDate.getHours() === slotH &&
        appDate.getMinutes() === slotM
      )
    })
  }

  const handleDrop = async (e: React.DragEvent, targetDate: Date, targetSlot: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    const app = appointments.find(a => a.id === id)
    if (!app) return

    const [hours, minutes] = targetSlot.split(':').map(Number)
    const startDateTime = new Date(targetDate)
    startDateTime.setHours(hours, minutes, 0, 0)

    if (startDateTime < new Date()) {
      toast('Não é possível reagendar compromissos para um horário passado.', 'error')
      return
    }

    const endDateTime = new Date(startDateTime)
    endDateTime.setMinutes(endDateTime.getMinutes() + 30)

    const isOccupied = findAppointmentForSlot(targetDate, targetSlot)
    if (isOccupied && isOccupied.id !== id) {
      toast('Este horário já está ocupado por outro compromisso.', 'error')
      return
    }

    setIsRescheduling(true)
    const res = await updateAppointmentDate(id, startDateTime.toISOString(), endDateTime.toISOString())
    setIsRescheduling(false)

    if (res.success) {
      toast('Compromisso reagendado com sucesso!', 'success')
      setAppointments(prev => prev.map(a => a.id === id ? {
        ...a,
        data_inicio: startDateTime.toISOString(),
        data_fim: endDateTime.toISOString(),
        updated_at: new Date().toISOString()
      } : a))
      if (selectedAppointment?.id === id) {
        setSelectedAppointment(prev => prev ? {
          ...prev,
          data_inicio: startDateTime.toISOString(),
          data_fim: endDateTime.toISOString(),
          updated_at: new Date().toISOString()
        } : null)
      }
    } else {
      toast(res.error || 'Erro ao reagendar compromisso.', 'error')
    }
  }

  const handleFastRescheduleClick = (dayDate: Date, slotStr: string) => {
    if (!fastRescheduleMode || !reschedulingAppointment) return
    setFastRescheduleTargetDate(dayDate)
    setFastRescheduleTargetSlot(slotStr)
    setIsConfirmFastRescheduleOpen(true)
  }

  const weekDays = useMemo(() => {
    const d = new Date(focusDate)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))

    return Array.from({ length: 7 }).map((_, i) => {
      const dayDate = new Date(monday)
      dayDate.setDate(monday.getDate() + i)
      return dayDate
    })
  }, [focusDate])

  const filteredAppointments = useMemo(() => {
    return appointments.filter(app => {
      if (agendaFilter !== 'all' && app.status !== agendaFilter) return false
      const matchSearch =
        (app.cliente_nome?.toLowerCase() || '').includes(agendaSearchQuery.toLowerCase()) ||
        (app.cliente_email?.toLowerCase() || '').includes(agendaSearchQuery.toLowerCase()) ||
        (app.cliente_whatsapp?.toLowerCase() || '').includes(agendaSearchQuery.toLowerCase()) ||
        (app.titulo?.toLowerCase() || '').includes(agendaSearchQuery.toLowerCase())
      return matchSearch
    })
  }, [appointments, agendaFilter, agendaSearchQuery])

  return {
    appointments,
    isLoadingAppointments,
    agendaFilter,
    setAgendaFilter,
    agendaSearchQuery,
    setAgendaSearchQuery,
    selectedAppointment,
    setSelectedAppointment,
    isRescheduling,
    isUpdatingStatus,
    isDeletingAppointment,
    isDeleteAppointmentModalOpen,
    setIsDeleteAppointmentModalOpen,
    appointmentToDelete,
    setAppointmentToDelete,
    fastRescheduleMode,
    setFastRescheduleMode,
    reschedulingAppointment,
    setReschedulingAppointment,
    isConfirmFastRescheduleOpen,
    setIsConfirmFastRescheduleOpen,
    fastRescheduleTargetDate,
    setFastRescheduleTargetDate,
    fastRescheduleTargetSlot,
    setFastRescheduleTargetSlot,
    focusDate,
    setFocusDate,
    demoLink,
    setDemoLink,
    isSavingLink,
    isSendingEmail,
    filteredAppointments,
    weekDays,
    findAppointmentForSlot,
    handleSaveDemoLink,
    handleSendEmail,
    handleOpenWhatsapp,
    handleUpdateStatus,
    handleDeleteAppointmentAction,
    handleConfirmFastReschedule,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleFastRescheduleClick
  }
}
