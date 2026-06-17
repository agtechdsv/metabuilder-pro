import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Plus, Trash2, Calendar, Sparkles, ChevronLeft, ChevronRight,
  Layers, ArrowRight, BarChart3, Eye, Download, ExternalLink, MapPin,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { useUseCaseMockups } from '../../hooks/useUseCaseMockups'

export function GanttMockup({ mockupsState }: { mockupsState: ReturnType<typeof useUseCaseMockups> }) {
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
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between bg-white dark:bg-neutral-950 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                      <span className="text-xs font-bold text-neutral-800 dark:text-white">
                        Cronograma de Implementa├º├úo
                      </span>
                      <span className="px-2.5 py-1 bg-sky-500/10 text-sky-500 text-[10px] font-black rounded-full uppercase tracking-wider">
                        Gantt Chart
                      </span>
                    </div>

                    <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm p-4 space-y-4">
                      {/* Gantt Header timeline */}
                      <div className="grid grid-cols-12 text-center text-[9px] font-black text-neutral-400 uppercase tracking-widest border-b border-neutral-100 dark:border-neutral-800/80 pb-2">
                        <span className="col-span-4 text-left">Tarefa</span>
                        <span className="col-span-2">S1</span>
                        <span className="col-span-2">S2</span>
                        <span className="col-span-2">S3</span>
                        <span className="col-span-2">S4</span>
                      </div>

                      {/* Gantt Rows */}
                      <div className="space-y-3.5">
                        {[
                          { task: 'Mapeamento SQL', start: 0, width: 3, progress: '100%', color: 'from-sky-500 to-sky-600' },
                          { task: 'Configura├º├úo RLS', start: 2, width: 4, progress: '80%', color: 'from-indigo-500 to-indigo-600' },
                          { task: 'Integra├º├úo de APIs', start: 5, width: 5, progress: '40%', color: 'from-purple-500 to-purple-600' },
                          { task: 'Homologa├º├úo final', start: 9, width: 3, progress: '0%', color: 'from-neutral-450 to-neutral-500' }
                        ].map((row, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => triggerToast(`Progresso de ${row.task}: ${row.progress}`)}
                            className="grid grid-cols-12 items-center text-xs group cursor-pointer"
                          >
                            <span className="col-span-4 font-bold text-neutral-800 dark:text-neutral-200 truncate pr-2">{row.task}</span>
                            
                            {/* Gantt Bar Lane */}
                            <div className="col-span-8 grid grid-cols-8 gap-0 h-7 bg-neutral-50 dark:bg-neutral-900/60 rounded-xl relative overflow-hidden border border-neutral-150 dark:border-neutral-850">
                              <div 
                                className={cn(
                                  "h-full rounded-lg bg-gradient-to-r relative flex items-center pl-2 group-hover:brightness-105 transition-all shadow-sm",
                                  row.color
                                )}
                                style={{
                                  gridColumnStart: row.start + 1,
                                  gridColumnEnd: row.start + row.width + 1
                                }}
                              >
                                <span className="text-[8px] font-black text-white uppercase tracking-widest">{row.progress}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
  )
}
