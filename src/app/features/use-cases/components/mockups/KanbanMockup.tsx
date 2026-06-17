import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Plus, Trash2, Calendar, Sparkles, ChevronLeft, ChevronRight,
  Layers, ArrowRight, BarChart3, Eye, Download, ExternalLink, MapPin,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { useUseCaseMockups } from '../../hooks/useUseCaseMockups'

export function KanbanMockup({ mockupsState }: { mockupsState: ReturnType<typeof useUseCaseMockups> }) {
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
                    className="space-y-4"
                  >
                    <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl p-4 text-xs font-bold text-center">
                      ­ƒÆí Arraste os cart├Áes entre as colunas para simular a atualiza├º├úo do DB!
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      
                      {/* TODO COLUMN */}
                      <div 
                        onDragOver={(e) => handleKanbanDragOver(e, 'todo')}
                        onDragLeave={handleKanbanDragLeave}
                        onDrop={(e) => handleKanbanDrop(e, 'todo')}
                        className={`p-3 rounded-2xl border transition-all duration-200 space-y-3 min-h-[220px] ${
                          draggedOverColumn === 'todo'
                            ? 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500 border-dashed scale-[1.01]'
                            : 'bg-neutral-100 dark:bg-neutral-950/60 border-neutral-200 dark:border-neutral-850'
                        }`}
                      >
                        <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                          {t('marketing_v2.use_cases_page.mockups.to_do')}
                        </h5>
                        <div className="space-y-2">
                          {kanbanTasks.filter(t => t.status === 'todo').map(task => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => handleKanbanDragStart(e, task.id)}
                              className="w-full text-left p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm text-xs font-bold hover:scale-[1.03] transition-all text-neutral-800 dark:text-neutral-200 cursor-grab active:cursor-grabbing hover:shadow-md"
                            >
                              {task.title}
                              <div className="mt-3 flex justify-between items-center text-[8px] font-extrabold text-indigo-500 uppercase tracking-widest">
                                <span>ID: {task.id}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* IN PROGRESS COLUMN */}
                      <div 
                        onDragOver={(e) => handleKanbanDragOver(e, 'inprogress')}
                        onDragLeave={handleKanbanDragLeave}
                        onDrop={(e) => handleKanbanDrop(e, 'inprogress')}
                        className={`p-3 rounded-2xl border transition-all duration-200 space-y-3 min-h-[220px] ${
                          draggedOverColumn === 'inprogress'
                            ? 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500 border-dashed scale-[1.01]'
                            : 'bg-neutral-100 dark:bg-neutral-950/60 border-neutral-200 dark:border-neutral-850'
                        }`}
                      >
                        <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                          {t('marketing_v2.use_cases_page.mockups.in_progress')}
                        </h5>
                        <div className="space-y-2">
                          {kanbanTasks.filter(t => t.status === 'inprogress').map(task => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => handleKanbanDragStart(e, task.id)}
                              className="w-full text-left p-3 bg-white dark:bg-neutral-900 border border-indigo-500/25 dark:border-indigo-500/20 rounded-xl shadow-sm text-xs font-bold hover:scale-[1.03] transition-all text-neutral-800 dark:text-neutral-200 cursor-grab active:cursor-grabbing hover:shadow-md"
                            >
                              {task.title}
                              <div className="mt-3 flex justify-between items-center text-[8px] font-extrabold text-amber-500 uppercase tracking-widest">
                                <span>ID: {task.id}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* DONE COLUMN */}
                      <div 
                        onDragOver={(e) => handleKanbanDragOver(e, 'done')}
                        onDragLeave={handleKanbanDragLeave}
                        onDrop={(e) => handleKanbanDrop(e, 'done')}
                        className={`p-3 rounded-2xl border transition-all duration-200 space-y-3 min-h-[220px] ${
                          draggedOverColumn === 'done'
                            ? 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500 border-dashed scale-[1.01]'
                            : 'bg-neutral-100 dark:bg-neutral-950/60 border-neutral-200 dark:border-neutral-850'
                        }`}
                      >
                        <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                          {t('marketing_v2.use_cases_page.mockups.done')}
                        </h5>
                        <div className="space-y-2">
                          {kanbanTasks.filter(t => t.status === 'done').map(task => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => handleKanbanDragStart(e, task.id)}
                              className="w-full text-left p-3 bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-850 text-neutral-400 dark:text-neutral-500 rounded-xl text-xs line-through hover:scale-[1.03] transition-all cursor-grab active:cursor-grabbing hover:shadow-md"
                            >
                              {task.title}
                              <div className="mt-3 flex justify-between items-center text-[8px] font-extrabold text-emerald-500 uppercase tracking-widest">
                                <span>ID: {task.id}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </motion.div>
  )
}
