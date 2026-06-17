import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Plus, Trash2, Calendar, Sparkles, ChevronLeft, ChevronRight,
  Layers, ArrowRight, BarChart3, Eye, Download, ExternalLink, MapPin,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { useUseCaseMockups } from '../../hooks/useUseCaseMockups'

export function AgendaMockup({ mockupsState }: { mockupsState: ReturnType<typeof useUseCaseMockups> }) {
  const { t } = useI18n()
  const {
    estoqueGridRef, scrollPercent, handleScroll, scrollUp, scrollDown,
    searchQuery, setSearchQuery, searchOnlyQuery, setSearchOnlyQuery,
    isDrawerOpen, setIsDrawerOpen, recordToDelete, setRecordToDelete,
    newRecordName, setNewRecordName, newRecordEmail, setNewRecordEmail,
    regName, setRegName, regEmail, setRegEmail, regSuccess,
    activeDetailTab, setActiveDetailTab, kanbanTasks, draggedOverColumn,
    dashboardPeriod, setDashboardPeriod, selectedAgendaDay, setSelectedAgendaDay,
    agendaEvents, isMindMapExpanded, setIsMindMapExpanded,
    isFinanceExpanded, setIsFinanceExpanded, isSalesExpanded, setIsSalesExpanded,
    isHrExpanded, setIsHrExpanded, customHybridTab, setCustomHybridTab,
    galleryFilter, setGalleryFilter, gallerySearchQuery, setGallerySearchQuery,
    selectedAssetPreview, setSelectedAssetPreview, filteredGalleryAssets,
    handleAddRecord, handleDeleteRecord, handleRegSubmit,
    handleKanbanDragStart, handleKanbanDragOver, handleKanbanDragLeave, handleKanbanDrop,
    filteredPesquisaCadastro, filteredSearchOnly, triggerToast, runCustomQuery,
    isSqlRunning, sqlQuery, setSqlQuery, sqlResults, setAgendaEvents,
    setKanbanTasks
  } = mockupsState;
  return (
    <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6 w-full"
                  >
                    <div className="bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 rounded-2xl p-4 text-xs font-bold text-center">
                      ­ƒÆí Arraste os compromissos entre os dias para reagend├í-los no calend├írio!
                    </div>

                    {/* Calendar Month Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-neutral-950 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm gap-4">
                      
                      {/* Left: Icon & Title & Sparkles badge */}
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[1.25rem] bg-[#eaeefd] dark:bg-indigo-950/50 flex items-center justify-center text-[#5c72e7] dark:text-indigo-400 shrink-0 border border-[#c5cff9]/30 dark:border-indigo-800/20">
                          <Calendar className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <h4 className="text-xl font-black text-black dark:text-white leading-tight">Maio de 2026</h4>
                          <span className="text-[10px] font-black text-amber-500 flex items-center gap-1 uppercase tracking-widest leading-none">
                            <Sparkles className="w-3 h-3 fill-current" /> MONTH VIEW MODE
                          </span>
                        </div>
                      </div>

                      {/* Right: Controls & Navigation */}
                      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                        {/* Navigation pill */}
                        <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 p-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 shrink-0">
                          <button 
                            onClick={() => {
                              setSelectedAgendaDay(prev => prev > 1 ? prev - 1 : 31)
                            }}
                            className="p-1 px-2.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-250 transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedAgendaDay(21)
                            }}
                            className="px-3 text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-450 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
                          >
                            HOJE
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedAgendaDay(prev => prev < 31 ? prev + 1 : 1)
                            }}
                            className="p-1 px-2.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-250 transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Mode toggle pill */}
                        <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 p-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 shrink-0">
                          <button
                            onClick={() => triggerToast('Visualiza├º├úo Mensal ativa')}
                            className="px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-white dark:bg-neutral-800 text-[#5c72e7] dark:text-indigo-400 shadow-sm transition-colors"
                          >
                            M├¬s
                          </button>
                          <button
                            onClick={() => triggerToast('Visualiza├º├úo de Semana em desenvolvimento')}
                            className="px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-full text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-250 transition-colors"
                          >
                            Semana
                          </button>
                          <button
                            onClick={() => triggerToast('Visualiza├º├úo Di├íria em desenvolvimento')}
                            className="px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-full text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-250 transition-colors"
                          >
                            Dia
                          </button>
                        </div>

                        {/* Novo Agendamento Button */}
                        <button 
                          onClick={() => {
                            const newId = `ev${Date.now()}`
                            const newEv = { 
                              id: newId, 
                              day: selectedAgendaDay, 
                              time: '12:00', 
                              title: 'Novo Compromisso', 
                              type: 'reuni├úo' 
                            }
                            setAgendaEvents(prev => [...prev, newEv])
                            triggerToast(`Compromisso agendado no dia ${selectedAgendaDay}!`)
                          }}
                          className="px-4 py-2 bg-[#5c72e7] hover:bg-[#4a5fc1] text-white rounded-full text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-500/10 active:scale-95 animate-fade-in"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Novo Compromisso</span>
                        </button>
                      </div>

                    </div>

                    {/* Weekday columns header */}
                    <div className="grid grid-cols-7 text-center gap-2 px-1 text-[10px] font-black text-[#94a3b8] dark:text-neutral-500 uppercase tracking-widest border-b border-neutral-100 dark:border-neutral-800 pb-3">
                      <span>Dom</span>
                      <span>Seg</span>
                      <span>Ter</span>
                      <span>Qua</span>
                      <span>Qui</span>
                      <span>Sex</span>
                      <span>S├íb</span>
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-2">
                      {[
                        // Row 1
                        { dayNumber: 26, monthOffset: -1 },
                        { dayNumber: 27, monthOffset: -1 },
                        { dayNumber: 28, monthOffset: -1 },
                        { dayNumber: 29, monthOffset: -1 },
                        { dayNumber: 30, monthOffset: -1 },
                        { dayNumber: 1, monthOffset: 0 },
                        { dayNumber: 2, monthOffset: 0 },
                        // Row 2
                        { dayNumber: 3, monthOffset: 0 },
                        { dayNumber: 4, monthOffset: 0 },
                        { dayNumber: 5, monthOffset: 0 },
                        { dayNumber: 6, monthOffset: 0 },
                        { dayNumber: 7, monthOffset: 0 },
                        { dayNumber: 8, monthOffset: 0 },
                        { dayNumber: 9, monthOffset: 0 },
                        // Row 3
                        { dayNumber: 10, monthOffset: 0 },
                        { dayNumber: 11, monthOffset: 0 },
                        { dayNumber: 12, monthOffset: 0 },
                        { dayNumber: 13, monthOffset: 0 },
                        { dayNumber: 14, monthOffset: 0 },
                        { dayNumber: 15, monthOffset: 0 },
                        { dayNumber: 16, monthOffset: 0 },
                        // Row 4
                        { dayNumber: 17, monthOffset: 0 },
                        { dayNumber: 18, monthOffset: 0 },
                        { dayNumber: 19, monthOffset: 0 },
                        { dayNumber: 20, monthOffset: 0 },
                        { dayNumber: 21, monthOffset: 0 },
                        { dayNumber: 22, monthOffset: 0 },
                        { dayNumber: 23, monthOffset: 0 },
                        // Row 5
                        { dayNumber: 24, monthOffset: 0 },
                        { dayNumber: 25, monthOffset: 0 },
                        { dayNumber: 26, monthOffset: 0 },
                        { dayNumber: 27, monthOffset: 0 },
                        { dayNumber: 28, monthOffset: 0 },
                        { dayNumber: 29, monthOffset: 0 },
                        { dayNumber: 30, monthOffset: 0 },
                        // Row 6
                        { dayNumber: 31, monthOffset: 0 },
                        { dayNumber: 1, monthOffset: 1 },
                        { dayNumber: 2, monthOffset: 1 },
                        { dayNumber: 3, monthOffset: 1 },
                        { dayNumber: 4, monthOffset: 1 },
                        { dayNumber: 5, monthOffset: 1 },
                        { dayNumber: 6, monthOffset: 1 },
                      ].map((cell, idx) => {
                        const isCurrentMonth = cell.monthOffset === 0
                        const isSelected = selectedAgendaDay === cell.dayNumber && isCurrentMonth
                        const dayEvents = isCurrentMonth ? agendaEvents.filter(ev => ev.day === cell.dayNumber) : []

                        const handleDragStart = (e: React.DragEvent, id: string) => {
                          e.dataTransfer.setData('text/plain', id)
                          e.dataTransfer.effectAllowed = 'move'
                        }

                        const handleDragOver = (e: React.DragEvent) => {
                          e.preventDefault()
                        }

                        const handleDrop = (e: React.DragEvent, targetDay: number) => {
                          e.preventDefault()
                          const eventId = e.dataTransfer.getData('text/plain')
                          if (!eventId) return

                          setAgendaEvents(prev => prev.map(ev => {
                            if (ev.id === eventId) {
                              return { ...ev, day: targetDay }
                            }
                            return ev
                          }))
                          triggerToast(`Compromisso reagendado para o dia ${targetDay}!`)
                        }

                        return (
                          <div
                            key={idx}
                            onDragOver={isCurrentMonth ? handleDragOver : undefined}
                            onDrop={isCurrentMonth ? (e) => handleDrop(e, cell.dayNumber) : undefined}
                            onClick={() => isCurrentMonth && setSelectedAgendaDay(cell.dayNumber)}
                            className={`min-h-[85px] p-2.5 rounded-2xl border transition-all flex flex-col justify-between select-none relative group ${
                              !isCurrentMonth
                                ? 'bg-neutral-50/20 dark:bg-neutral-900/10 border-neutral-100/40 dark:border-neutral-800/20 opacity-30 cursor-not-allowed'
                                : isSelected
                                ? 'bg-white dark:bg-neutral-950 border-[#5c72e7] dark:border-indigo-500 shadow-md shadow-indigo-500/5 ring-1 ring-[#5c72e7]/30 dark:ring-indigo-500/30'
                                : 'bg-white dark:bg-neutral-950 border-neutral-250 dark:border-neutral-800/80 hover:border-neutral-350 dark:hover:border-neutral-700 cursor-pointer'
                            }`}
                          >
                            {/* Day Number */}
                            <div className="flex items-center justify-between">
                              {isSelected ? (
                                <span className="w-5 h-5 rounded-full bg-[#5c72e7] text-white flex items-center justify-center font-bold text-[10px]">
                                  {cell.dayNumber}
                                </span>
                              ) : (
                                <span className={`text-[11px] font-bold ${isCurrentMonth ? 'text-neutral-750 dark:text-neutral-350' : 'text-neutral-400'}`}>
                                  {cell.dayNumber}
                                </span>
                              )}
                            </div>

                            {/* Events list inside cell */}
                            <div className="mt-2 space-y-1 flex-grow overflow-hidden flex flex-col justify-end">
                              {dayEvents.map(ev => (
                                <div
                                  key={ev.id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, ev.id)}
                                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#eaeefd] dark:bg-indigo-950/40 text-[#4a5fc1] dark:text-indigo-300 text-[9px] font-bold cursor-grab active:cursor-grabbing hover:bg-[#c5cff9]/40 transition-colors truncate"
                                  title={`${ev.time} - ${ev.title}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#5c72e7] shrink-0"></span>
                                  <span className="truncate">{ev.title}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
  )
}
