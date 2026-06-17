import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Search, Loader2, Clock, Mail, Phone, Video, MessageCircle, Check, X, Trash2, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useAgendaAdmin, Appointment } from '../hooks/useAgendaAdmin'

interface AgendaTabProps {
  hook: ReturnType<typeof useAgendaAdmin>
}

export function AgendaTab({ hook }: AgendaTabProps) {
  const { toast } = useToast()
  const {
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
  } = hook

  const renderSlotButton = (dayDate: Date, slotStr: string, app?: Appointment) => {
    const isPast = new Date(dayDate)
    const [sh, sm] = slotStr.split(':').map(Number)
    isPast.setHours(sh, sm, 0, 0)
    const today = new Date()
    const isBeforeNow = isPast < today

    if (app) {
      const isSelected = selectedAppointment?.id === app.id
      return (
        <button
          key={slotStr}
          type="button"
          onClick={() => setSelectedAppointment(app)}
          draggable
          onDragStart={(e) => handleDragStart(e, app.id)}
          className={cn(
            "h-10 rounded-lg border text-left px-2 py-1 flex flex-col justify-between transition-all group cursor-grab active:cursor-grabbing text-[10px] font-semibold w-full",
            isSelected ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-white dark:ring-offset-black scale-95" : "",
            app.status === 'Confirmado'
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-450 hover:bg-emerald-500/20"
              : app.status === 'Cancelado'
                ? "bg-red-500/5 border-dashed border-red-500/20 text-red-500 dark:text-red-400 line-through opacity-60"
                : "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20"
          )}
        >
          <span className="font-bold truncate w-full text-left">{app.cliente_nome || 'Demo'}</span>
          <span className="text-[8px] opacity-75 font-mono flex items-center justify-between">
            <span>{slotStr}</span>
            {app.status === 'Confirmado' && <Video className="w-2.5 h-2.5 text-emerald-500 inline ml-1" />}
          </span>
        </button>
      )
    }

    if (fastRescheduleMode && reschedulingAppointment) {
      if (isBeforeNow) {
        return (
          <div
            key={slotStr}
            className="h-10 border border-neutral-100 dark:border-neutral-900 bg-neutral-100/50 dark:bg-neutral-950/20 rounded-lg flex items-center justify-center text-[9px] font-semibold text-neutral-350 dark:text-neutral-700"
          >
            Passado
          </div>
        )
      }

      return (
        <button
          key={slotStr}
          type="button"
          onClick={() => handleFastRescheduleClick(dayDate, slotStr)}
          className="h-10 border border-dashed border-indigo-500/40 hover:border-indigo-500 hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center text-[9px] font-bold cursor-pointer transition-all hover:scale-95 animate-pulse"
        >
          <span>Escolher</span>
        </button>
      )
    }

    return (
      <div
        key={slotStr}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, dayDate, slotStr)}
        className={cn(
          "h-10 border rounded-lg flex items-center justify-center text-[9px] font-semibold transition-all duration-200",
          isBeforeNow
            ? "border-neutral-100 dark:border-neutral-900 bg-neutral-100/30 dark:bg-neutral-950/10 text-neutral-400 dark:text-neutral-600"
            : "border-neutral-200 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-950/20 text-neutral-400 dark:text-neutral-500 hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:text-indigo-500 cursor-default"
        )}
      >
        <span>Livre</span>
      </div>
    )
  }

  return (
    <>
      <motion.div
        key="agenda"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 15 }}
        transition={{ duration: 0.25 }}
        className="space-y-6"
      >
        {/* Banner for Fast Reschedule Mode */}
        {fastRescheduleMode && reschedulingAppointment && (
          <div className="bg-indigo-600 text-white px-6 py-4 rounded-2xl flex items-center justify-between shadow-lg animate-pulse">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 animate-bounce" />
              <span className="text-xs font-bold">
                Reagendamento Rápido Ativo: Clique em um horário disponível no calendário para reagendar a demonstração de {reschedulingAppointment.cliente_nome}.
              </span>
            </div>
            <button
              onClick={() => {
                setFastRescheduleMode(false)
                setReschedulingAppointment(null)
              }}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-black uppercase transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* KPI Cards for Agenda */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Total de Agendados</span>
            <h3 className="text-2xl font-black text-neutral-900 dark:text-white mt-2">{appointments.length}</h3>
          </div>
          <div className="bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider text-indigo-500">Pendentes</span>
            <h3 className="text-2xl font-black text-neutral-900 dark:text-white mt-2">
              {appointments.filter(a => a.status === 'Pendente').length}
            </h3>
          </div>
          <div className="bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider text-emerald-500">Confirmados</span>
            <h3 className="text-2xl font-black text-neutral-900 dark:text-white mt-2">
              {appointments.filter(a => a.status === 'Confirmado').length}
            </h3>
          </div>
          <div className="bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider text-red-500">Cancelados</span>
            <h3 className="text-2xl font-black text-neutral-900 dark:text-white mt-2">
              {appointments.filter(a => a.status === 'Cancelado').length}
            </h3>
          </div>
        </div>

        {/* Split Screen Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Triage List (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-neutral-900/40 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome, email..."
                  value={agendaSearchQuery}
                  onChange={e => setAgendaSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-200"
                />
              </div>

              {/* Status selection buttons */}
              <div className="flex gap-1 bg-neutral-50 dark:bg-neutral-950 p-1 rounded-xl justify-between border border-neutral-200/50 dark:border-neutral-800/50">
                {(['all', 'Pendente', 'Confirmado', 'Cancelado'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setAgendaFilter(f)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all",
                      agendaFilter === f
                        ? "bg-white dark:bg-neutral-850 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    )}
                  >
                    {f === 'all' ? 'Todos' : f}
                  </button>
                ))}
              </div>
            </div>

            {/* Appointment Cards */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {isLoadingAppointments ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-neutral-500 bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Buscando compromissos...</span>
                </div>
              ) : filteredAppointments.length > 0 ? (
                filteredAppointments.map(app => {
                  const startDate = new Date(app.data_inicio)
                  const isSelected = selectedAppointment?.id === app.id

                  return (
                    <div
                      key={app.id}
                      onClick={() => setSelectedAppointment(app)}
                      className={cn(
                        "p-4 bg-white dark:bg-neutral-900/40 border rounded-2xl cursor-pointer transition-all hover:translate-y-[-2px] flex flex-col gap-3 relative",
                        isSelected
                          ? "border-indigo-500 shadow-md shadow-indigo-500/5"
                          : "border-neutral-200 dark:border-neutral-850"
                      )}
                    >
                      {/* Tag */}
                      <div className="flex justify-between items-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                          app.status === 'Confirmado'
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-450"
                            : app.status === 'Cancelado'
                              ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                              : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400"
                        )}>
                          {app.status}
                        </span>
                        <span className="text-[9px] text-neutral-400 font-bold">
                          {startDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>

                      {/* Client details */}
                      <div>
                        <h4 className="font-black text-xs text-neutral-900 dark:text-white line-clamp-1">{app.cliente_nome || 'Sem Nome'}</h4>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-neutral-500">
                          <Clock className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                          <span className="font-bold">
                            {String(startDate.getHours()).padStart(2, '0')}:{String(startDate.getMinutes()).padStart(2, '0')}h (30 min)
                          </span>
                        </div>
                      </div>

                      {/* Detail expansion if selected */}
                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="border-t border-neutral-100 dark:border-neutral-850/60 pt-3 flex flex-col gap-3 text-[11px]"
                        >
                          {/* Contacts */}
                          <div className="space-y-1.5 text-neutral-600 dark:text-neutral-400">
                            <div className="flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                              <span className="font-medium truncate">{app.cliente_email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                              <span className="font-semibold">{app.cliente_whatsapp}</span>
                            </div>
                          </div>

                          {/* Campo de link da demonstração */}
                          <div className="space-y-1.5 border-t border-neutral-100 dark:border-neutral-850/60 pt-2 pb-1">
                            <label className="text-[9px] font-black uppercase tracking-wider text-neutral-450 dark:text-neutral-400 block">Link da Demonstração (Meet / Zoom)</label>
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                value={demoLink}
                                onChange={(e) => setDemoLink(e.target.value)}
                                placeholder="Ex: https://meet.google.com/abc-defg-hij"
                                onClick={(e) => e.stopPropagation()}
                                className="flex-grow px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-[10px] font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSaveDemoLink(app.id)
                                }}
                                disabled={isSavingLink}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold text-[9px] uppercase tracking-wider cursor-pointer"
                              >
                                {isSavingLink ? '...' : 'Salvar'}
                              </button>
                            </div>
                            {app.link_demonstracao && (
                              <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                                <Video className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                                <a
                                  href={app.link_demonstracao}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline truncate"
                                >
                                  Acessar link salvo
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Communications Buttons */}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenWhatsapp(app)
                              }}
                              className="h-8 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-colors flex items-center justify-center gap-1.5 font-bold text-[10px] uppercase tracking-wider cursor-pointer"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSendEmail(app)
                              }}
                              disabled={isSendingEmail === app.id}
                              className="h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center justify-center gap-1.5 font-bold text-[10px] uppercase tracking-wider border border-neutral-200 dark:border-neutral-700 cursor-pointer disabled:opacity-50"
                            >
                              {isSendingEmail === app.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Mail className="w-3.5 h-3.5" />
                              )}
                              <span>{isSendingEmail === app.id ? 'Enviando...' : 'Enviar Email'}</span>
                            </button>
                          </div>

                          {/* Administration actions */}
                          <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-neutral-100 dark:border-neutral-850/60">
                            {app.status !== 'Confirmado' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleUpdateStatus(app.id, 'Confirmado')
                                }}
                                disabled={isUpdatingStatus}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Confirmar</span>
                              </button>
                            )}

                            {app.status !== 'Cancelado' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleUpdateStatus(app.id, 'Cancelado')
                                }}
                                disabled={isUpdatingStatus}
                                className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Cancelar</span>
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleUpdateStatus(app.id, 'Pendente')
                                }}
                                disabled={isUpdatingStatus}
                                className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                              >
                                <Clock className="w-3.5 h-3.5" />
                                <span>Reverter Cancelamento</span>
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setReschedulingAppointment(app)
                                setFastRescheduleMode(true)
                                toast('Selecione um horário no calendário para reagendar.', 'info')
                              }}
                              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Reagendar</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setAppointmentToDelete(app)
                                setIsDeleteAppointmentModalOpen(true)
                              }}
                              className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg ml-auto cursor-pointer"
                              title="Excluir agendamento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="py-12 text-center text-neutral-400 italic bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-xs">
                  Nenhum agendamento encontrado para os filtros selecionados.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Weekly Grid (8 cols) */}
          <div className="lg:col-span-8 bg-white dark:bg-neutral-900/40 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col gap-6">
            {/* Calendar Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const prevW = new Date(focusDate)
                    prevW.setDate(focusDate.getDate() - 7)
                    setFocusDate(prevW)
                  }}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer border border-neutral-200 dark:border-neutral-850"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white min-w-[200px] text-center capitalize">
                  {weekDays[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} - {weekDays[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                </span>
                <button
                  onClick={() => {
                    const nextW = new Date(focusDate)
                    nextW.setDate(focusDate.getDate() + 7)
                    setFocusDate(nextW)
                  }}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer border border-neutral-200 dark:border-neutral-850"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFocusDate(new Date())}
                  className="px-3.5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950 dark:hover:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 cursor-pointer"
                >
                  Hoje
                </button>
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest hidden sm:inline">Grade Comercial</span>
              </div>
            </div>

            {/* Calendar Grid Container (Horizontal scroll on mobile) */}
            <div className="overflow-x-auto">
              <div className="min-w-[800px] grid grid-cols-8 gap-2.5">
                {/* Time labels column */}
                <div className="flex flex-col gap-2.5 pt-8">
                  {/* Morning Header */}
                  <span className="text-[8px] font-black uppercase text-neutral-400 tracking-wider text-center h-4 flex items-center justify-center border-b border-neutral-200 dark:border-neutral-800/80 pb-1">Manhã</span>

                  {/* Generate typical morning slots */}
                  {Array.from({ length: 8 }).map((_, idx) => {
                    const h = 8 + Math.floor(idx / 2)
                    const m = (idx % 2) * 30
                    return (
                      <div key={`ml-${idx}`} className="h-10 text-[10px] font-bold text-neutral-400 flex items-center justify-end pr-2 border-r border-neutral-200 dark:border-neutral-850">
                        {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}h
                      </div>
                    )
                  })}

                  {/* Evening Header */}
                  <span className="text-[8px] font-black uppercase text-neutral-400 tracking-wider text-center h-4 flex items-center justify-center border-b border-neutral-200 dark:border-neutral-800/80 pb-1 mt-2">Noite</span>

                  {/* Generate typical evening slots */}
                  {Array.from({ length: 4 }).map((_, idx) => {
                    const h = 19 + Math.floor(idx / 2)
                    const m = (idx % 2) * 30
                    return (
                      <div key={`el-${idx}`} className="h-10 text-[10px] font-bold text-neutral-400 flex items-center justify-end pr-2 border-r border-neutral-200 dark:border-neutral-850">
                        {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}h
                      </div>
                    )
                  })}
                </div>

                {/* 7 Days Columns */}
                {weekDays.map((dayDate, dayIdx) => {
                  const dayOfWeek = dayDate.getDay() // 0: Sunday, 6: Saturday
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
                  const dayNameShort = dayDate.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
                  const isToday = new Date().toDateString() === dayDate.toDateString()

                  return (
                    <div key={dayIdx} className="flex flex-col gap-2.5">
                      {/* Day column header */}
                      <div className={cn(
                        "flex flex-col items-center justify-center p-1.5 rounded-xl border",
                        isToday
                          ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-650 dark:text-white"
                          : "border-transparent text-neutral-600 dark:text-neutral-400"
                      )}>
                        <span className="text-[9px] font-black uppercase tracking-wider">{dayNameShort}</span>
                        <span className="text-sm font-black mt-0.5">{dayDate.getDate()}</span>
                      </div>

                      {/* Morning Slots */}
                      <span className="h-4 flex-shrink-0" /> {/* Spacer alignment matching header */}
                      {Array.from({ length: 8 }).map((_, idx) => {
                        const h = 8 + Math.floor(idx / 2)
                        const m = (idx % 2) * 30
                        const slotStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                        const app = findAppointmentForSlot(dayDate, slotStr)

                        return renderSlotButton(dayDate, slotStr, app)
                      })}

                      {/* Evening Spacer */}
                      <span className="h-4 flex-shrink-0 mt-2 border-b border-neutral-100 dark:border-neutral-850/60" />

                      {/* Evening Slots */}
                      {isWeekend ? (
                        /* No evening commercial slots on weekends */
                        Array.from({ length: 4 }).map((_, idx) => (
                          <div
                            key={`empty-weekend-${idx}`}
                            className="h-10 border border-dashed border-neutral-100 dark:border-neutral-900 bg-neutral-50/20 dark:bg-neutral-950/10 rounded-lg flex items-center justify-center text-[9px] font-semibold text-neutral-300 dark:text-neutral-800"
                          >
                            Indisponível
                          </div>
                        ))
                      ) : (
                        Array.from({ length: 4 }).map((_, idx) => {
                          const h = 19 + Math.floor(idx / 2)
                          const m = (idx % 2) * 30
                          const slotStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                          const app = findAppointmentForSlot(dayDate, slotStr)

                          return renderSlotButton(dayDate, slotStr, app)
                        })
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Calendar Legend */}
            <div className="flex flex-wrap gap-4 items-center text-[10px] text-neutral-500 font-bold border-t border-neutral-100 dark:border-neutral-850/60 pt-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />
                <span>Pendente</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                <span>Confirmado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                <span>Cancelado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded" />
                <span>Livre / Disponível</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Confirm Delete Appointment Modal */}
      <Modal
        isOpen={isDeleteAppointmentModalOpen}
        onClose={() => {
          if (!isDeletingAppointment) {
            setIsDeleteAppointmentModalOpen(false)
            setAppointmentToDelete(null)
          }
        }}
        title="Excluir Agendamento"
        description="Esta ação removerá o compromisso permanentemente da agenda."
        size="md"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-650 dark:text-red-400">
            <div className="p-2.5 bg-red-500/20 rounded-xl">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-black">Excluir Compromisso?</p>
              <p className="text-xs opacity-90 mt-0.5">
                O agendamento de <span className="font-bold">"{appointmentToDelete?.cliente_nome}"</span> será apagado permanentemente.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isDeletingAppointment}
              onClick={() => {
                setIsDeleteAppointmentModalOpen(false)
                setAppointmentToDelete(null)
              }}
              className="h-10 px-5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-xs uppercase tracking-widest border border-neutral-200 dark:border-neutral-750 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isDeletingAppointment}
              onClick={handleDeleteAppointmentAction}
              className="h-10 px-6 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-red-500/20 flex items-center gap-2"
            >
              {isDeletingAppointment ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Confirmar Exclusão</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm Fast Reschedule Modal */}
      <Modal
        isOpen={isConfirmFastRescheduleOpen}
        onClose={() => {
          if (!isRescheduling) {
            setIsConfirmFastRescheduleOpen(false)
            setFastRescheduleTargetDate(null)
            setFastRescheduleTargetSlot(null)
          }
        }}
        title="Confirmar Reagendamento Rápido"
        description="Você está alterando a data e o horário da demonstração."
        size="md"
      >
        <div className="space-y-6">
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-neutral-850 dark:text-indigo-300">
            <p className="text-sm font-bold">Deseja reagendar o compromisso?</p>
            <div className="mt-3 space-y-2 text-xs">
              <p>
                <span className="text-neutral-400">Cliente:</span>{" "}
                <span className="font-bold text-neutral-900 dark:text-white">{reschedulingAppointment?.cliente_nome}</span>
              </p>
              <p>
                <span className="text-neutral-400">De:</span>{" "}
                <span className="font-semibold text-red-500 line-through">
                  {reschedulingAppointment && new Date(reschedulingAppointment.data_inicio).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}h
                </span>
              </p>
              <p>
                <span className="text-neutral-400">Para:</span>{" "}
                <span className="font-bold text-emerald-500">
                  {fastRescheduleTargetDate && fastRescheduleTargetDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })} às {fastRescheduleTargetSlot}h
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isRescheduling}
              onClick={() => {
                setIsConfirmFastRescheduleOpen(false)
                setFastRescheduleTargetDate(null)
                setFastRescheduleTargetSlot(null)
              }}
              className="h-10 px-5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-xs uppercase tracking-widest border border-neutral-200 dark:border-neutral-750 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isRescheduling}
              onClick={handleConfirmFastReschedule}
              className="h-10 px-6 bg-indigo-600 hover:bg-indigo-750 disabled:bg-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2"
            >
              {isRescheduling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Reagendando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirmar Reagendamento</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
