'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Zap, 
  Calendar, 
  Clock, 
  User, 
  Mail, 
  Phone, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Sun, 
  Moon, 
  Video,
  Info
} from 'lucide-react'
import { getOccupiedSlots, createAppointment } from '@/app/actions/agenda'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { useI18n } from '@/i18n/I18nContext'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { createClient } from '@/utils/supabase/client'

export default function AppointmentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-white flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
      </div>
    }>
      <AppointmentPageContent />
    </Suspense>
  )
}

function AppointmentPageContent() {
  const { language, t } = useI18n()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user)
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            setProfile(data)
          })
      }
    })
  }, [])

  const localeMap = {
    pt: 'pt-BR',
    en: 'en-US',
    es: 'es-ES'
  }
  const currentLocale = localeMap[language] || 'pt-BR'

  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1) // 1: Day, 2: Time, 3: Form, 4: Success
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null) // Format: "HH:MM"
  const [occupiedSlots, setOccupiedSlots] = useState<string[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)

  // Read query params for pre-populating
  const searchParams = useSearchParams()
  const nomeParam = searchParams.get('nome') || ''
  const emailParam = searchParams.get('email') || ''
  const whatsappParam = searchParams.get('whatsapp') || ''

  // Form states
  const [fullName, setFullName] = useState(nomeParam)
  const [email, setEmail] = useState(emailParam)
  const [emailTouched, setEmailTouched] = useState(false)
  const [phone, setPhone] = useState(whatsappParam)
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Validation
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isPhoneValid = phone.replace(/\D/g, '').length >= 10
  const isFormValid = fullName.trim() !== '' && isEmailValid && isPhoneValid

  const showEmailError = emailTouched && email.trim() !== '' && !isEmailValid
  const showPhoneError = phoneTouched && phone.trim() !== '' && !isPhoneValid

  // Generate next 14 days
  const availableDays = Array.from({ length: 14 }).map((_, idx) => {
    const d = new Date()
    d.setDate(d.getDate() + idx + 1) // Começa a partir de amanhã
    return d
  })

  // Format date to local YYYY-MM-DD
  const formatDateToYMD = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Fetch occupied slots when selected date changes
  useEffect(() => {
    if (!selectedDate) return

    const fetchSlots = async () => {
      setIsLoadingSlots(true)
      setSelectedSlot(null)
      try {
        const ymd = formatDateToYMD(selectedDate)
        const response = await getOccupiedSlots(ymd)
        if (response.success && response.slots) {
          // Pega apenas as horas e minutos dos timestamps UTC convertidos para o local
          const localOccupiedHours = response.slots.map(isoStr => {
            const dateObj = new Date(isoStr)
            const hours = String(dateObj.getHours()).padStart(2, '0')
            const minutes = String(dateObj.getMinutes()).padStart(2, '0')
            return `${hours}:${minutes}`
          })
          setOccupiedSlots(localOccupiedHours)
        } else {
          setOccupiedSlots([])
        }
      } catch (err) {
        console.error(err)
        setOccupiedSlots([])
      } finally {
        setIsLoadingSlots(false)
      }
    }

    fetchSlots()
  }, [selectedDate])

  // Phone mask formatting
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    const numbers = rawValue.replace(/\D/g, '')
    const truncated = numbers.substring(0, 11)
    
    let formatted = ''
    if (truncated.length > 0) {
      formatted = `(${truncated.substring(0, 2)}`
    }
    if (truncated.length > 2) {
      formatted += `) ${truncated.substring(2, 6)}`
    }
    if (truncated.length > 6) {
      if (truncated.length > 10) {
        formatted = `(${truncated.substring(0, 2)}) ${truncated.substring(2, 7)}-${truncated.substring(7)}`
      } else {
        formatted = `(${truncated.substring(0, 2)}) ${truncated.substring(2, 6)}-${truncated.substring(6)}`
      }
    }
    
    setPhone(formatted)
  }

  // Generate slots of 30 minutes based on day of week
  const generateSlots = (date: Date) => {
    const dayOfWeek = date.getDay() // 0: Sunday, 6: Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const slots: string[] = []

    // 1. Manhã: 08:00 às 12:00 (todos os dias)
    // O último slot de 30min começa às 11:30
    for (let hour = 8; hour < 12; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`)
      slots.push(`${String(hour).padStart(2, '0')}:30`)
    }

    // 2. Noite: 19:00 às 21:00 (apenas segunda a sexta)
    // O último slot de 30min começa às 20:30
    if (!isWeekend) {
      for (let hour = 19; hour < 21; hour++) {
        slots.push(`${String(hour).padStart(2, '0')}:00`)
        slots.push(`${String(hour).padStart(2, '0')}:30`)
      }
    }

    return slots
  }

  const handleNextDayStep = () => {
    if (selectedDate) setCurrentStep(2)
  }

  const handleNextSlotStep = () => {
    if (selectedSlot) setCurrentStep(3)
  }

  const handlePrevStep = () => {
    setCurrentStep(prev => prev - 1)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDate || !selectedSlot || !isFormValid) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const ymd = formatDateToYMD(selectedDate)
      const [hours, minutes] = selectedSlot.split(':').map(Number)
      
      // Cria a data de início local
      const startDateTime = new Date(selectedDate)
      startDateTime.setHours(hours, minutes, 0, 0)
      
      // Cria a data de fim local (+30 minutos)
      const endDateTime = new Date(startDateTime)
      endDateTime.setMinutes(endDateTime.getMinutes() + 30)

      const response = await createAppointment({
        title: `Demonstração MetaBuilderPRO - ${fullName}`,
        description: `Agendamento automático via Landing Page. Contato: ${phone} / ${email}`,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        clientName: fullName,
        clientEmail: email,
        clientPhone: phone
      })

      if (response.success) {
        setCurrentStep(4)
      } else {
        setSubmitError(response.error || t('scheduling.error_booking', 'Erro ao agendar compromisso. Tente novamente.'))
      }
    } catch (err) {
      setSubmitError(t('scheduling.error_connection', 'Erro na conexão com o servidor. Tente novamente.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Format date helper (ex: Segunda-feira, 25 de Maio)
  const formatFriendlyDate = (date: Date) => {
    return date.toLocaleDateString(currentLocale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })
  }

  return (
    <div className="min-h-screen pt-16 flex flex-col bg-white dark:bg-black text-neutral-900 dark:text-white relative overflow-hidden transition-colors duration-300">
      <Navbar user={user} profile={profile} />

      <main className="flex-grow flex flex-col items-center justify-center px-4 py-12 relative z-10 w-full">

      {/* Decorative gradient glowing spheres */}
      <div className="absolute top-[-10%] left-[-15%] w-[50%] h-[50%] bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-15%] w-[50%] h-[50%] bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Container */}
      <div className="w-full max-w-3xl z-10 flex flex-col gap-8">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-4">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]"
          >
            <Video className="w-3.5 h-3.5" />
            {t('scheduling.video_demo', 'Demonstração Técnica Individual (30 min)')}
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 via-neutral-700 to-neutral-500 dark:from-white dark:via-neutral-200 dark:to-neutral-400">
            {t('scheduling.founder_agenda_title_part1', 'Agenda do')} <span className="text-indigo-500">{t('scheduling.founder_agenda_title_part2', 'Fundador')}</span>
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm md:text-base max-w-lg">
            {t('scheduling.desc', 'Agende uma demonstração prática exclusiva do MetaBuilderPRO com Alexandre Moura e veja como a engine funciona com seus dados.')}
          </p>
        </div>

        {/* Form Card */}
        <motion.div 
          layout
          className="w-full bg-white/70 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden transition-colors duration-300"
        >
          {/* Progress bar */}
          {currentStep !== 4 && (
            <div className="w-full h-1 bg-neutral-200 dark:bg-neutral-800 absolute top-0 left-0">
              <motion.div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                animate={{ width: `${(currentStep / 3) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}

          <AnimatePresence mode="wait">
            {currentStep === 4 ? (
              /* Success Screen */
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center text-center gap-6 py-6"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 animate-bounce">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl md:text-3xl font-black text-neutral-900 dark:text-white">{t('scheduling.success_title', 'Demonstração Agendada!')}</h2>
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm max-w-md mx-auto">
                    {t('scheduling.success_desc', 'Seu horário foi bloqueado na agenda do fundador. O link da sala de videoconferência foi gerado.')}
                  </p>
                </div>
                
                {/* Appointment Card */}
                <div className="w-full max-w-md bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-850 rounded-2xl p-6 text-left space-y-4">
                  <div className="flex items-center gap-3 border-b border-neutral-200/50 dark:border-neutral-800/50 pb-3">
                    <Calendar className="w-5 h-5 text-indigo-500" />
                    <div>
                      <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">{t('scheduling.selected_date', 'Data Selecionada')}</span>
                      <p className="text-sm font-bold capitalize text-neutral-900 dark:text-white">{selectedDate && formatFriendlyDate(selectedDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-b border-neutral-200/50 dark:border-neutral-800/50 pb-3">
                    <Clock className="w-5 h-5 text-indigo-500" />
                    <div>
                      <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">{t('scheduling.selected_time', 'Horário (Duração 30 min)')}</span>
                      <p className="text-sm font-bold text-neutral-900 dark:text-white">{t('scheduling.duration_format', '{start}h às {end}h').replace('{start}', selectedSlot || '').replace('{end}', selectedSlot ? (() => {
                        const [h, m] = selectedSlot.split(':').map(Number)
                        const finalM = m + 30
                        if (finalM >= 60) return `${String(h + 1).padStart(2, '0')}:00`
                        return `${String(h).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`
                      })() : '')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Video className="w-5 h-5 text-indigo-500" />
                    <div>
                      <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">{t('scheduling.meeting_location', 'Local da Reunião')}</span>
                      <p className="text-sm font-bold text-neutral-900 dark:text-white">{t('scheduling.meeting_location_desc', 'O link da reunião será enviado por e-mail antecipadamente')}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center mt-4">
                  <a 
                    href="https://www.youtube.com/@MetaBuilderPRO" 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors inline-flex items-center justify-center gap-2"
                  >
                    {t('scheduling.follow_youtube', 'Acompanhar no YouTube')}
                  </a>
                  <Link 
                    href="/"
                    className="px-6 py-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold text-sm transition-colors border border-neutral-200 dark:border-neutral-700 flex items-center justify-center"
                  >
                    {t('scheduling.back_home', 'Voltar ao Início')}
                  </Link>
                </div>
              </motion.div>
            ) : (
              /* Appointment Steps */
              <div className="space-y-6">
                
                {/* Step 1: Select Day */}
                {currentStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col gap-6"
                  >
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">{t('scheduling.step_1_of_3', 'Passo 1 de 3')}</span>
                      <h2 className="text-xl md:text-2xl font-black text-neutral-900 dark:text-white">{t('scheduling.choose_day', 'Escolha um dia disponível')}</h2>
                      <p className="text-xs text-neutral-500 dark:text-neutral-450 leading-relaxed">
                        {t('scheduling.choose_day_desc', 'Selecione uma data para ver os horários de 30 minutos disponíveis na agenda.')}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-1">
                      {availableDays.map((dateObj, idx) => {
                        const isSelected = selectedDate ? formatDateToYMD(selectedDate) === formatDateToYMD(dateObj) : false
                        const dayName = dateObj.toLocaleDateString(currentLocale, { weekday: 'short' }).replace('.', '')
                        const dayNum = dateObj.getDate()
                        const monthName = dateObj.toLocaleDateString(currentLocale, { month: 'short' }).replace('.', '')

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedDate(dateObj)}
                            className={`p-4 rounded-2xl border text-center flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-white font-bold scale-95 shadow-md shadow-indigo-500/5'
                                : 'bg-white dark:bg-neutral-950/40 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-700'
                            }`}
                          >
                            <span className="text-[10px] uppercase font-black tracking-widest text-neutral-400">{dayName}</span>
                            <span className="text-2xl font-black text-neutral-900 dark:text-white">{dayNum}</span>
                            <span className="text-[10px] uppercase font-bold text-neutral-400">{monthName}</span>
                          </button>
                        )
                      })}
                    </div>

                    <div className="flex justify-end gap-3 mt-4 border-t border-neutral-100 dark:border-neutral-850 pt-4">
                      <button 
                        type="button"
                        onClick={() => router.back()}
                        className="px-5 py-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 font-bold text-sm transition-all flex items-center gap-2 border border-neutral-200 dark:border-neutral-700 cursor-pointer"
                      >
                        {t('scheduling.cancel', 'Cancelar')}
                      </button>
                      <button
                        type="button"
                        disabled={!selectedDate}
                        onClick={handleNextDayStep}
                        className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-750 disabled:opacity-50 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer"
                      >
                        {t('scheduling.next', 'Próximo')} <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Select Slot */}
                {currentStep === 2 && selectedDate && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col gap-6"
                  >
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">{t('scheduling.step_2_of_3', 'Passo 2 de 3')}</span>
                      <div className="flex items-center gap-2 text-neutral-500">
                        <Calendar className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs font-black capitalize text-neutral-900 dark:text-white">{formatFriendlyDate(selectedDate)}</span>
                      </div>
                      <h2 className="text-xl md:text-2xl font-black text-neutral-900 dark:text-white">{t('scheduling.select_slot', 'Selecione um horário')}</h2>
                    </div>

                    {/* Fuso Horário alert info */}
                    <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 text-neutral-600 dark:text-indigo-300 rounded-xl text-[10px] md:text-xs flex items-center gap-2 leading-relaxed">
                      <Info className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      <span>{t('scheduling.timezone_warning', 'Os horários disponíveis correspondem ao seu fuso horário local e respeitam a grade comercial do fundador.')}</span>
                    </div>

                    {isLoadingSlots ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-3 text-neutral-500">
                        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                        <span className="text-xs font-semibold uppercase tracking-wider">{t('scheduling.checking_slots', 'Verificando slots disponíveis...')}</span>
                      </div>
                    ) : (
                      (() => {
                        const slots = generateSlots(selectedDate)
                        const freeSlots = slots.filter(slot => !occupiedSlots.includes(slot))

                        if (freeSlots.length === 0) {
                          return (
                            <div className="py-12 text-center text-neutral-500 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col gap-2 items-center justify-center">
                              <Clock className="w-8 h-8 text-neutral-400" />
                              <p className="text-sm font-bold text-neutral-900 dark:text-white">{t('scheduling.no_slots_available', 'Nenhum horário disponível para este dia.')}</p>
                              <p className="text-xs text-neutral-400">{t('scheduling.choose_another_day', 'Por favor, volte e escolha outra data no calendário.')}</p>
                            </div>
                          )
                        }

                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-1">
                            {freeSlots.map((slot, idx) => {
                              const isSelected = selectedSlot === slot
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedSlot(slot)}
                                  className={`py-3.5 px-4 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-white scale-95 shadow-md shadow-indigo-500/5'
                                      : 'bg-white dark:bg-neutral-950/40 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-700'
                                  }`}
                                >
                                  {slot}h
                                </button>
                              )
                            })}
                          </div>
                        )
                      })()
                    )}

                    <div className="flex justify-between gap-3 mt-4 border-t border-neutral-100 dark:border-neutral-850 pt-4">
                      <button
                        type="button"
                        onClick={handlePrevStep}
                        className="px-5 py-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 font-bold text-sm transition-all flex items-center gap-2 border border-neutral-200 dark:border-neutral-700 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" /> {t('scheduling.prev', 'Voltar')}
                      </button>
                      <button
                        type="button"
                        disabled={!selectedSlot || isLoadingSlots}
                        onClick={handleNextSlotStep}
                        className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-750 disabled:opacity-50 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer"
                      >
                        {t('scheduling.next', 'Próximo')} <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Contact Form */}
                {currentStep === 3 && selectedDate && selectedSlot && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col gap-6"
                  >
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">{t('scheduling.step_3_of_3', 'Passo 3 de 3')}</span>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-neutral-500 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                          <span className="font-black capitalize text-neutral-900 dark:text-white">{formatFriendlyDate(selectedDate)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                          <span className="font-black text-neutral-900 dark:text-white">{selectedSlot}h ({t('scheduling.selected_time', 'Duração 30 min')})</span>
                        </div>
                      </div>
                      <h2 className="text-xl md:text-2xl font-black text-neutral-900 dark:text-white">{t('scheduling.confirm_details', 'Confirme seus dados de contato')}</h2>
                    </div>

                    <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
                      {/* Name */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                          <User className="w-3.5 h-3.5" /> {t('scheduling.full_name_label', 'Nome Completo *')}
                        </label>
                        <input 
                          type="text" 
                          required
                          value={fullName}
                          onChange={e => setFullName(e.target.value)}
                          placeholder={t('scheduling.name_placeholder', 'Ex: João Silva')} 
                          className="w-full bg-white dark:bg-neutral-950/80 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600"
                        />
                      </div>

                      {/* Corporate Email */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5" /> {t('scheduling.email_label', 'E-mail Corporativo *')}
                        </label>
                        <input 
                          type="email" 
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          onBlur={() => setEmailTouched(true)}
                          placeholder={t('scheduling.email_placeholder', 'Ex: joao@suaempresa.com')} 
                          className={`w-full bg-white dark:bg-neutral-950/80 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 transition-all text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 ${
                            showEmailError 
                              ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                              : 'border-neutral-200 dark:border-neutral-800 focus:border-indigo-500 focus:ring-indigo-500'
                          }`}
                        />
                        {showEmailError ? (
                          <span className="text-[10px] text-red-400 mt-0.5">{t('scheduling.email_error', 'Por favor, insira um e-mail válido.')}</span>
                        ) : (
                          <span className="text-[10px] text-neutral-500 italic mt-0.5">{t('scheduling.email_hint', 'Utilize o e-mail da sua empresa para podermos alinhar o contexto técnico.')}</span>
                        )}
                      </div>

                      {/* WhatsApp */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5" /> {t('scheduling.phone_label', 'WhatsApp com DDD *')}
                        </label>
                        <input 
                          type="tel" 
                          required
                          value={phone}
                          onChange={handlePhoneChange}
                          onBlur={() => setPhoneTouched(true)}
                          placeholder={t('scheduling.phone_placeholder', 'Ex: (11) 99999-9999')} 
                          className={`w-full bg-white dark:bg-neutral-950/80 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 transition-all text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 ${
                            showPhoneError 
                              ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                              : 'border-neutral-200 dark:border-neutral-800 focus:border-indigo-500 focus:ring-indigo-500'
                          }`}
                        />
                        {showPhoneError && (
                          <span className="text-[10px] text-red-400 mt-0.5">{t('scheduling.phone_error', 'Por favor, insira um número de WhatsApp com DDD válido.')}</span>
                        )}
                      </div>

                      {submitError && (
                        <div className="p-3 bg-red-900/20 border border-red-900/30 text-red-400 rounded-xl text-xs font-medium">
                          {submitError}
                        </div>
                      )}

                      <div className="flex justify-between gap-3 mt-4 border-t border-neutral-100 dark:border-neutral-850 pt-4">
                        <button
                          type="button"
                          onClick={handlePrevStep}
                          className="px-5 py-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 font-bold text-sm transition-all flex items-center gap-2 border border-neutral-200 dark:border-neutral-700 cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" /> {t('scheduling.prev', 'Voltar')}
                        </button>
                        <button
                          type="submit"
                          disabled={!isFormValid || isSubmitting}
                          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-750 disabled:opacity-50 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer"
                        >
                          {isSubmitting ? t('scheduling.confirming_btn', 'Confirmando...') : t('scheduling.confirm_booking_btn', 'Confirmar Agendamento')} 
                          {!isSubmitting && <CheckCircle2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

              </div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer info */}
        <div className="flex items-center justify-center gap-4 text-xs text-neutral-500 dark:text-neutral-600">
          <span>{t('scheduling.google_meet_desc', 'Videoconferência via Google Meet')}</span>
          <span>•</span>
          <span>{t('scheduling.zero_trust_desc', 'Privacidade Zero-Trust')}</span>
        </div>
      </div>
      </main>
      <Footer />
    </div>
  )
}
