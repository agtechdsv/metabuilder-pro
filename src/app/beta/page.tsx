'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Zap, 
  User, 
  Users, 
  Building, 
  Briefcase, 
  DollarSign, 
  Clock,
  Link as LinkIcon, 
  Cpu, 
  Sparkles, 
  Award, 
  Flame, 
  Calendar, 
  Search, 
  Database, 
  PlusCircle, 
  Home, 
  Globe, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  MessageSquare,
  Mail,
  Phone,
  BookmarkCheck,
  Sun,
  Moon
} from 'lucide-react'
import { submitBetaLead } from '@/app/actions/leads'
import { useTheme } from '@/components/CustomThemeProvider'
import Link from 'next/link'

export default function BetaWaitlistPage() {
  const { theme, setTheme } = useTheme()
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Form states
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [phone, setPhone] = useState('')
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [companySize, setCompanySize] = useState('')
  const [challengesSelected, setChallengesSelected] = useState<string[]>([])
  const [operator, setOperator] = useState('')
  const [urgency, setUrgency] = useState('')
  const [databasesSelected, setDatabasesSelected] = useState<string[]>([])
  const [objective, setObjective] = useState('')

  // Toggles for multi-select
  const toggleChallenge = (value: string) => {
    setChallengesSelected(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value) 
        : [...prev, value]
    )
  }

  const toggleDatabase = (value: string) => {
    setDatabasesSelected(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value) 
        : [...prev, value]
    )
  }

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

  // Validation
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isPhoneValid = phone.replace(/\D/g, '').length >= 10
  const isStep1Valid = fullName.trim() !== '' && isEmailValid && isPhoneValid
  
  const showEmailError = emailTouched && email.trim() !== '' && !isEmailValid
  const showPhoneError = phoneTouched && phone.trim() !== '' && !isPhoneValid
  const isStep2Valid = companyName.trim() !== '' && companySize !== '' && objective !== ''
  const isStep3Valid = challengesSelected.length > 0 && databasesSelected.length > 0
  const isStep4Valid = operator !== '' && urgency !== ''

  const nextStep = () => {
    if (step === 1 && !isStep1Valid) return
    if (step === 2 && !isStep2Valid) return
    if (step === 3 && !isStep3Valid) return
    setStep(prev => prev + 1)
  }

  const prevStep = () => {
    setStep(prev => prev - 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isStep1Valid || !isStep2Valid || !isStep3Valid || !isStep4Valid) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await submitBetaLead({
        fullName,
        email,
        phone,
        companyName,
        companySize,
        challenge: challengesSelected.join(', '),
        operator,
        urgency,
        databaseType: databasesSelected.join(', '),
        objective
      })

      if (response.success) {
        setSubmitSuccess(true)
      } else {
        setSubmitError(response.error || 'Erro ao enviar dados. Tente novamente.')
      }
    } catch (err: any) {
      setSubmitError('Erro na conexão com o servidor. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Options lists with icons
  const companySizes = [
    { value: 'Freelancer', label: 'Sou desenvolvedor autônomo / Freelancer', icon: <User className="w-5 h-5 text-indigo-400" /> },
    { value: 'Pequena', label: 'Startup / Pequena empresa (1 a 10 func.)', icon: <Users className="w-5 h-5 text-blue-400" /> },
    { value: 'Média', label: 'Média empresa (11 a 50 funcionários)', icon: <Building className="w-5 h-5 text-purple-400" /> },
    { value: 'Grande', label: 'Grande empresa (Mais de 50 func.)', icon: <Briefcase className="w-5 h-5 text-emerald-400" /> }
  ]

  const objectives = [
    { value: 'Interno', label: 'Criar sistemas internos para a minha empresa', icon: <Home className="w-5 h-5 text-sky-400" /> },
    { value: 'Clientes', label: 'Desenvolver sistemas sob demanda para clientes', icon: <Briefcase className="w-5 h-5 text-violet-400" /> },
    { value: 'SaaS', label: 'Criar um produto SaaS para revender no mercado', icon: <Globe className="w-5 h-5 text-amber-400" /> }
  ]

  const challenges = [
    { value: 'Alto Custo', label: 'Alto custo com programadores / software houses', icon: <DollarSign className="w-5 h-5 text-red-400" /> },
    { value: 'Lentidão', label: 'Lentidão na entrega de novos recursos/sistemas', icon: <Clock className="w-5 h-5 text-yellow-400" /> },
    { value: 'Dependência', label: 'Dependência técnica de terceiros para atualizar o sistema', icon: <LinkIcon className="w-5 h-5 text-orange-400" /> },
    { value: 'Escalabilidade', label: 'Falta de performance/escala nas ferramentas atuais', icon: <Zap className="w-5 h-5 text-cyan-400" /> }
  ]

  const operators = [
    { value: 'Eu mesmo', label: 'Eu mesmo (não sou programador, sou tomador de decisão)', icon: <Sparkles className="w-5 h-5 text-pink-400" /> },
    { value: 'Analista/Gestor', label: 'Um analista de sistemas / gerente de projetos', icon: <Award className="w-5 h-5 text-indigo-400" /> },
    { value: 'Equipe TI', label: 'Nossa equipe interna de TI / desenvolvedores', icon: <Cpu className="w-5 h-5 text-teal-400" /> }
  ]

  const urgencies = [
    { value: 'Imediato', label: 'Imediatamente (nas próximas semanas)', icon: <Flame className="w-5 h-5 text-red-500 animate-pulse" /> },
    { value: '2-3 Meses', label: 'Nos próximos 2 ou 3 meses', icon: <Calendar className="w-5 h-5 text-indigo-400" /> },
    { value: 'Futuro', label: 'Estou apenas pesquisando soluções para o futuro', icon: <Search className="w-5 h-5 text-gray-400" /> }
  ]

  const databases = [
    { value: 'PostgreSQL', label: 'PostgreSQL (O banco ideal do MetaBuilder)', icon: <Database className="w-5 h-5 text-blue-400" /> },
    { value: 'Oracle', label: 'Oracle Database (Conexão nativa e blindada)', icon: <Database className="w-5 h-5 text-red-500" /> },
    { value: 'Outros', label: 'Outro Banco (SQL Server, MySQL, etc.)', icon: <Database className="w-5 h-5 text-purple-400" /> },
    { value: 'Nenhum', label: 'Nenhum, preciso criar o banco do zero', icon: <PlusCircle className="w-5 h-5 text-green-400" /> }
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-white relative overflow-hidden flex flex-col items-center justify-center px-4 py-12 transition-colors duration-300">
      {/* Botão de Tema flutuante */}
      <div className="absolute top-6 right-6 z-20">
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-3 rounded-full bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer shadow-lg"
          title="Alternar Tema"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

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
            <Zap className="w-3.5 h-3.5 fill-current" />
            Acesso Beta Exclusivo
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 via-neutral-700 to-neutral-500 dark:from-white dark:via-neutral-200 dark:to-neutral-400">
            MetaBuilder<span className="text-indigo-500">PRO</span>
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm md:text-base max-w-lg">
            Entre na lista de espera exclusiva e ajude a moldar o futuro do desenvolvimento ágil orientado a metadados.
          </p>
        </div>

        {/* Form Card */}
        <motion.div 
          layout
          className="w-full bg-white/70 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden transition-colors duration-300"
        >
          {/* Progress bar */}
          {!submitSuccess && (
            <div className="w-full h-1 bg-neutral-200 dark:bg-neutral-800 absolute top-0 left-0">
              <motion.div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                animate={{ width: `${(step / 4) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}

          <AnimatePresence mode="wait">
            {submitSuccess ? (
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
                <h2 className="text-2xl md:text-3xl font-black">Cadastro Confirmado!</h2>
                
                {/* Alexandre Moura Avatar & Welcome Message */}
                <div className="flex flex-col items-center gap-4 bg-white dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 max-w-lg mt-2 relative">
                  <div className="w-14 h-14 rounded-full border border-indigo-500/30 overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                    <img 
                      src="/yt_avatar.png" 
                      alt="Alexandre Moura" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback in case avatar image is missing
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">Mensagem de Alexandre Moura</span>
                    <p className="text-neutral-700 dark:text-neutral-300 text-sm leading-relaxed">
                      "Olá, aqui é o Alexandre Moura! Recebemos os seus detalhes técnicos. O MetaBuilderPRO está sendo lapidado para entregar o máximo de performance. Vou analisar pessoalmente o seu perfil e entraremos em contato por WhatsApp ou E-mail nas próximas semanas para liberar o seu acesso ao lote Beta."
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full justify-center mt-4">
                  <a 
                    href="https://www.youtube.com/@MetaBuilderPRO" 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors inline-flex items-center justify-center gap-2"
                  >
                    Acompanhar no YouTube
                  </a>
                  <Link 
                    href={`/agendamento?nome=${encodeURIComponent(fullName)}&email=${encodeURIComponent(email)}&whatsapp=${encodeURIComponent(phone)}`}
                    className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xs transition-colors inline-flex items-center justify-center gap-2"
                  >
                    Agendar demonstração
                  </Link>
                  <button 
                    onClick={() => {
                      // Reset form
                      setFullName('')
                      setEmail('')
                      setEmailTouched(false)
                      setPhone('')
                      setPhoneTouched(false)
                      setCompanyName('')
                      setCompanySize('')
                      setChallengesSelected([])
                      setOperator('')
                      setUrgency('')
                      setDatabasesSelected([])
                      setObjective('')
                      setStep(1)
                      setSubmitSuccess(false)
                    }}
                    className="px-6 py-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-sm transition-colors border border-neutral-300 dark:border-neutral-700"
                  >
                    Voltar ao Início
                  </button>
                </div>
              </motion.div>
            ) : (
              /* Questionnaire Wizard Steps */
              <form onSubmit={handleSubmit} key="form">
                
                {/* Step 1: Basic Identification */}
                {step === 1 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col gap-6"
                  >
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Passo 1 de 3</span>
                      <h2 className="text-xl md:text-2xl font-black">Quem é você e como falamos com você?</h2>
                    </div>

                    <div className="flex flex-col gap-4">
                      {/* Full Name */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                          <User className="w-3.5 h-3.5" /> Nome Completo *
                        </label>
                        <input 
                          type="text" 
                          required
                          value={fullName}
                          onChange={e => setFullName(e.target.value)}
                          placeholder="Ex: João Silva" 
                          className="w-full bg-white dark:bg-neutral-950/80 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600"
                        />
                      </div>

                      {/* Corporate Email */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5" /> E-mail Corporativo *
                        </label>
                        <input 
                          type="email" 
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          onBlur={() => setEmailTouched(true)}
                          placeholder="Ex: joao@suaempresa.com" 
                          className={`w-full bg-white dark:bg-neutral-950/80 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 transition-all text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 ${
                            showEmailError 
                              ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                              : 'border-neutral-200 dark:border-neutral-800 focus:border-indigo-500 focus:ring-indigo-500'
                          }`}
                        />
                        {showEmailError ? (
                          <span className="text-[10px] text-red-400 mt-0.5">Por favor, insira um e-mail válido.</span>
                        ) : (
                          <span className="text-[10px] text-neutral-500 italic mt-0.5">Dê preferência ao e-mail profissional da sua empresa.</span>
                        )}
                      </div>

                      {/* WhatsApp */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5" /> WhatsApp com DDD *
                        </label>
                        <input 
                          type="tel" 
                          required
                          value={phone}
                          onChange={handlePhoneChange}
                          onBlur={() => setPhoneTouched(true)}
                          placeholder="Ex: (11) 99999-9999" 
                          className={`w-full bg-white dark:bg-neutral-950/80 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 transition-all text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 ${
                            showPhoneError 
                              ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                              : 'border-neutral-200 dark:border-neutral-800 focus:border-indigo-500 focus:ring-indigo-500'
                          }`}
                        />
                        {showPhoneError && (
                          <span className="text-[10px] text-red-400 mt-0.5">Por favor, insira um número de WhatsApp com DDD válido.</span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end mt-4">
                      <button
                        type="button"
                        disabled={!isStep1Valid}
                        onClick={nextStep}
                        className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-750 disabled:opacity-50 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer"
                      >
                        Próximo <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Company Size & Project Goal */}
                {step === 2 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col gap-6"
                  >
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Passo 2 de 3</span>
                      <h2 className="text-xl md:text-2xl font-black">Qual é a sua realidade de negócios?</h2>
                    </div>

                    <div className="flex flex-col gap-5">
                      {/* Company/Project Name */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                          <BookmarkCheck className="w-3.5 h-3.5" /> Qual o nome da sua empresa ou projeto? *
                        </label>
                        <input 
                          type="text" 
                          required
                          value={companyName}
                          onChange={e => setCompanyName(e.target.value)}
                          placeholder="Ex: AgTech Soluções" 
                          className="w-full bg-white dark:bg-neutral-950/80 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600"
                        />
                      </div>

                      {/* Company Size */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                          Tamanho atual da sua empresa *
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {companySizes.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setCompanySize(opt.value)}
                              className={`p-4 rounded-xl border text-left text-xs transition-all flex items-start gap-3 cursor-pointer ${
                                companySize === opt.value 
                                  ? 'bg-indigo-500/10 border-indigo-500 text-indigo-900 dark:text-white font-bold' 
                                  : 'bg-white dark:bg-neutral-950/40 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-700'
                              }`}
                            >
                              <div className="mt-0.5">{opt.icon}</div>
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Objective */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                          Qual é o seu objetivo principal com o MetaBuilderPRO? *
                        </label>
                        <div className="grid grid-cols-1 gap-2.5">
                          {objectives.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setObjective(opt.value)}
                              className={`p-3.5 rounded-xl border text-left text-xs transition-all flex items-center gap-3 cursor-pointer ${
                                objective === opt.value 
                                  ? 'bg-indigo-500/10 border-indigo-500 text-indigo-900 dark:text-white font-bold' 
                                  : 'bg-white dark:bg-neutral-950/40 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-700'
                              }`}
                            >
                              {opt.icon}
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between mt-4">
                      <button
                        type="button"
                        onClick={prevStep}
                        className="px-5 py-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 font-bold text-sm transition-all flex items-center gap-2 border border-neutral-300 dark:border-neutral-700 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" /> Voltar
                      </button>
                      <button
                        type="button"
                        disabled={!isStep2Valid}
                        onClick={nextStep}
                        className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-750 disabled:opacity-50 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer"
                      >
                        Próximo <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Challenges & Database (Multi-select) */}
                {step === 3 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col gap-6"
                  >
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Passo 3 de 4</span>
                      <h2 className="text-xl md:text-2xl font-black">Detalhes Técnicos</h2>
                    </div>

                    <div className="flex flex-col gap-5 overflow-y-auto max-h-[480px] pr-1">
                      
                      {/* Database type */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex justify-between items-center">
                          <span>Qual banco de dados você pretende conectar ao MetaBuilderPRO? *</span>
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 lowercase font-medium">(selecione quantos quiser)</span>
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {databases.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => toggleDatabase(opt.value)}
                              className={`p-3.5 rounded-xl border text-left text-xs transition-all flex items-center gap-3 cursor-pointer ${
                                databasesSelected.includes(opt.value) 
                                  ? 'bg-indigo-500/10 border-indigo-500 text-indigo-900 dark:text-white font-bold' 
                                  : 'bg-white dark:bg-neutral-950/40 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-700'
                              }`}
                            >
                              {opt.icon}
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Main challenge */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex justify-between items-center">
                          <span>Qual o seu maior desafio atual com desenvolvimento web? *</span>
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 lowercase font-medium">(selecione quantos quiser)</span>
                        </label>
                        <div className="grid grid-cols-1 gap-2.5">
                          {challenges.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => toggleChallenge(opt.value)}
                              className={`p-3.5 rounded-xl border text-left text-xs transition-all flex items-center gap-3 cursor-pointer ${
                                challengesSelected.includes(opt.value) 
                                  ? 'bg-indigo-500/10 border-indigo-500 text-indigo-900 dark:text-white font-bold' 
                                  : 'bg-white dark:bg-neutral-950/40 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-700'
                              }`}
                            >
                              {opt.icon}
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between mt-4">
                      <button
                        type="button"
                        onClick={prevStep}
                        className="px-5 py-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 font-bold text-sm transition-all flex items-center gap-2 border border-neutral-300 dark:border-neutral-700 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" /> Voltar
                      </button>
                      <button
                        type="button"
                        disabled={!isStep3Valid}
                        onClick={nextStep}
                        className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-750 disabled:opacity-50 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer"
                      >
                        Próximo <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Operators & Urgency (Single Choice) */}
                {step === 4 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col gap-6"
                  >
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Passo 4 de 4</span>
                      <h2 className="text-xl md:text-2xl font-black">Operação & Urgência</h2>
                    </div>

                    <div className="flex flex-col gap-5 overflow-y-auto max-h-[480px] pr-1">
                      {/* Operator */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                          Quem será o principal operador do MetaBuilderPRO na empresa? *
                        </label>
                        <div className="grid grid-cols-1 gap-2.5">
                          {operators.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setOperator(opt.value)}
                              className={`p-3.5 rounded-xl border text-left text-xs transition-all flex items-center gap-3 cursor-pointer ${
                                operator === opt.value 
                                  ? 'bg-indigo-500/10 border-indigo-500 text-indigo-900 dark:text-white font-bold' 
                                  : 'bg-white dark:bg-neutral-950/40 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-700'
                              }`}
                            >
                              {opt.icon}
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Urgency */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                          Em quanto tempo pretende implementar novas aplicações web? *
                        </label>
                        <div className="grid grid-cols-1 gap-2.5">
                          {urgencies.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setUrgency(opt.value)}
                              className={`p-3.5 rounded-xl border text-left text-xs transition-all flex items-center gap-3 cursor-pointer ${
                                urgency === opt.value 
                                  ? 'bg-indigo-500/10 border-indigo-500 text-indigo-900 dark:text-white font-bold' 
                                  : 'bg-white dark:bg-neutral-950/40 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-700'
                              }`}
                            >
                              {opt.icon}
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {submitError && (
                      <div className="p-3 bg-red-900/20 border border-red-900/30 text-red-400 rounded-xl text-xs font-medium">
                        {submitError}
                      </div>
                    )}

                    <div className="flex justify-between mt-4">
                      <button
                        type="button"
                        onClick={prevStep}
                        className="px-5 py-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 font-bold text-sm transition-all flex items-center gap-2 border border-neutral-300 dark:border-neutral-700 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" /> Voltar
                      </button>
                      <button
                        type="submit"
                        disabled={!isStep4Valid || isSubmitting}
                        className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-750 disabled:opacity-50 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer"
                      >
                        {isSubmitting ? 'Enviando...' : 'Entrar na Lista de Espera'} 
                        {!isSubmitting && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </motion.div>
                )}

              </form>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer info */}
        <div className="flex items-center justify-center gap-4 text-xs text-neutral-500 dark:text-neutral-600">
          <span>© 2026 MetaBuilderPRO</span>
          <span>•</span>
          <span>Conexão Segura SSL</span>
          <span>•</span>
          <span>Proteção de Dados LGPD</span>
        </div>
      </div>
    </div>
  )
}
