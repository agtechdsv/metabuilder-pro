import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Plus, Trash2, Calendar, Sparkles, ChevronLeft, ChevronRight,
  Layers, ArrowRight, BarChart3, Eye, Download, ExternalLink, MapPin,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { useUseCaseMockups } from '../../hooks/useUseCaseMockups'

export function MapaMentalMockup({ mockupsState }: { mockupsState: ReturnType<typeof useUseCaseMockups> }) {
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
                    className="space-y-6 flex flex-col items-center"
                  >
                    {/* SVG Mind Map Simulator */}
                    <div className="w-full max-w-lg aspect-[4/3] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 relative overflow-hidden flex items-center justify-center">
                      
                      <svg className="w-full h-full absolute inset-0 pointer-events-none" viewBox="0 0 400 300">
                        <AnimatePresence>
                          {isMindMapExpanded && (
                            <motion.line 
                              key="line-finance"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ pathLength: 0, opacity: 0 }}
                              transition={{ duration: 0.4 }}
                              x1="200" y1="150" x2="80" y2="80" 
                              stroke="#6366f1" strokeWidth="2" strokeDasharray="3 3" 
                            />
                          )}
                          {isMindMapExpanded && (
                            <motion.line 
                              key="line-sales"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ pathLength: 0, opacity: 0 }}
                              transition={{ duration: 0.4 }}
                              x1="200" y1="150" x2="320" y2="80" 
                              stroke="#6366f1" strokeWidth="2" strokeDasharray="3 3" 
                            />
                          )}
                          {isMindMapExpanded && (
                            <motion.line 
                              key="line-hr"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ pathLength: 0, opacity: 0 }}
                              transition={{ duration: 0.4 }}
                              x1="200" y1="150" x2="200" y2="230" 
                              stroke="#6366f1" strokeWidth="2" strokeDasharray="3 3" 
                            />
                          )}
                          
                          {/* Sub-connections for Financeiro */}
                          {isMindMapExpanded && isFinanceExpanded && (
                            <motion.line 
                              key="line-billing"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ pathLength: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              x1="80" y1="80" x2="35" y2="35" 
                              stroke="#a855f7" strokeWidth="1.5" 
                            />
                          )}
                          {isMindMapExpanded && isFinanceExpanded && (
                            <motion.line 
                              key="line-treasury"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ pathLength: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              x1="80" y1="80" x2="30" y2="115" 
                              stroke="#a855f7" strokeWidth="1.5" 
                            />
                          )}

                          {/* Sub-connections for Vendas */}
                          {isMindMapExpanded && isSalesExpanded && (
                            <motion.line 
                              key="line-crm"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ pathLength: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              x1="320" y1="80" x2="365" y2="35" 
                              stroke="#ec4899" strokeWidth="1.5" 
                            />
                          )}
                          {isMindMapExpanded && isSalesExpanded && (
                            <motion.line 
                              key="line-pipeline"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ pathLength: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              x1="320" y1="80" x2="370" y2="115" 
                              stroke="#ec4899" strokeWidth="1.5" 
                            />
                          )}

                          {/* Sub-connections for RH */}
                          {isMindMapExpanded && isHrExpanded && (
                            <motion.line 
                              key="line-recruitment"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ pathLength: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              x1="200" y1="230" x2="105" y2="260" 
                              stroke="#6366f1" strokeWidth="1.5" 
                            />
                          )}
                          {isMindMapExpanded && isHrExpanded && (
                            <motion.line 
                              key="line-payroll"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ pathLength: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              x1="200" y1="230" x2="295" y2="260" 
                              stroke="#6366f1" strokeWidth="1.5" 
                            />
                          )}
                        </AnimatePresence>
                      </svg>

                      {/* Mind Map Nodes */}
                      <div className="relative w-full h-full flex items-center justify-center">
                        
                        {/* Central Node */}
                        <div 
                          onClick={() => {
                            const nextState = !isMindMapExpanded
                            setIsMindMapExpanded(nextState)
                            if (!nextState) {
                              setIsFinanceExpanded(false)
                              setIsSalesExpanded(false)
                              setIsHrExpanded(false)
                            }
                            triggerToast(nextState ? 'Mapa expandido!' : 'Mapa recolhido!')
                          }}
                          className="absolute w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-center p-3 text-[10px] font-black uppercase tracking-wider shadow-xl cursor-pointer hover:scale-110 active:scale-95 transition-all z-10"
                        >
                          {t('marketing_v2.use_cases_page.mockups.central_node')}
                        </div>

                        <AnimatePresence>
                          {isMindMapExpanded && (
                            <motion.div 
                              key="node-finance"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                              onClick={() => {
                                const nextState = !isFinanceExpanded
                                setIsFinanceExpanded(nextState)
                                triggerToast(nextState ? 'Financeiro expandido!' : 'Financeiro recolhido!')
                              }}
                              className="absolute left-[30px] top-[40px] px-4 py-2.5 rounded-2xl bg-white dark:bg-neutral-900 border border-purple-500/40 text-neutral-800 dark:text-neutral-200 text-xs font-bold shadow-md cursor-pointer hover:scale-105 transition-transform z-10"
                            >
                              ­ƒÆÁ {t('marketing_v2.use_cases_page.mockups.node_finance')}
                            </motion.div>
                          )}

                          {/* Node 1.1: Billing (Faturamento) */}
                          {isMindMapExpanded && isFinanceExpanded && (
                            <motion.div 
                              key="node-billing"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                              onClick={() => triggerToast(t('marketing_v2.use_cases_page.mockups.node_billing'))}
                              className="absolute left-[5px] top-[5px] px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-purple-500/30 text-purple-600 dark:text-purple-400 text-[10px] font-bold shadow-sm cursor-pointer hover:scale-105 transition-transform z-10"
                            >
                              {t('marketing_v2.use_cases_page.mockups.node_billing')}
                            </motion.div>
                          )}

                          {/* Node 1.2: Treasury (Tesouraria) */}
                          {isMindMapExpanded && isFinanceExpanded && (
                            <motion.div 
                              key="node-treasury"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                              onClick={() => triggerToast(t('marketing_v2.use_cases_page.mockups.node_treasury'))}
                              className="absolute left-[2px] top-[110px] px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-purple-500/30 text-purple-600 dark:text-purple-400 text-[10px] font-bold shadow-sm cursor-pointer hover:scale-105 transition-transform z-10"
                            >
                              {t('marketing_v2.use_cases_page.mockups.node_treasury')}
                            </motion.div>
                          )}

                          {/* Node 2: Sales */}
                          {isMindMapExpanded && (
                            <motion.div 
                              key="node-sales"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                              onClick={() => {
                                const nextState = !isSalesExpanded
                                setIsSalesExpanded(nextState)
                                triggerToast(nextState ? 'Vendas expandido!' : 'Vendas recolhido!')
                              }}
                              className="absolute right-[30px] top-[40px] px-4 py-2.5 rounded-2xl bg-white dark:bg-neutral-900 border border-pink-500/40 text-neutral-800 dark:text-neutral-200 text-xs font-bold shadow-md cursor-pointer hover:scale-105 transition-transform z-10"
                            >
                              ­ƒôê {t('marketing_v2.use_cases_page.mockups.node_sales')}
                            </motion.div>
                          )}

                          {/* Node 2.1: CRM (CRM Vendas) */}
                          {isMindMapExpanded && isSalesExpanded && (
                            <motion.div 
                              key="node-crm"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                              onClick={() => triggerToast(t('marketing_v2.use_cases_page.mockups.node_crm'))}
                              className="absolute right-[5px] top-[5px] px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-pink-500/30 text-pink-600 dark:text-pink-400 text-[10px] font-bold shadow-sm cursor-pointer hover:scale-105 transition-transform z-10"
                            >
                              {t('marketing_v2.use_cases_page.mockups.node_crm')}
                            </motion.div>
                          )}

                          {/* Node 2.2: Pipeline (Funil Vendas) */}
                          {isMindMapExpanded && isSalesExpanded && (
                            <motion.div 
                              key="node-pipeline"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                              onClick={() => triggerToast(t('marketing_v2.use_cases_page.mockups.node_pipeline'))}
                              className="absolute right-[2px] top-[110px] px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-pink-500/30 text-pink-600 dark:text-pink-400 text-[10px] font-bold shadow-sm cursor-pointer hover:scale-105 transition-transform z-10"
                            >
                              {t('marketing_v2.use_cases_page.mockups.node_pipeline')}
                            </motion.div>
                          )}

                          {/* Node 3: HR */}
                          {isMindMapExpanded && (
                            <motion.div 
                              key="node-hr"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                              onClick={() => {
                                const nextState = !isHrExpanded
                                setIsHrExpanded(nextState)
                                triggerToast(nextState ? 'RH expandido!' : 'RH recolhido!')
                              }}
                              className="absolute bottom-[25px] px-4 py-2.5 rounded-2xl bg-white dark:bg-neutral-900 border border-indigo-500/40 text-neutral-800 dark:text-neutral-200 text-xs font-bold shadow-md cursor-pointer hover:scale-105 transition-transform z-10"
                            >
                              ­ƒæÑ {t('marketing_v2.use_cases_page.mockups.node_hr')}
                            </motion.div>
                          )}

                          {/* Node 3.1: Recruitment (Recrutamento) */}
                          {isMindMapExpanded && isHrExpanded && (
                            <motion.div 
                              key="node-recruitment"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                              onClick={() => triggerToast(t('marketing_v2.use_cases_page.mockups.node_recruitment'))}
                              className="absolute left-[75px] bottom-[10px] px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold shadow-sm cursor-pointer hover:scale-105 transition-transform z-10"
                            >
                              {t('marketing_v2.use_cases_page.mockups.node_recruitment')}
                            </motion.div>
                          )}

                          {/* Node 3.2: Payroll (Folha de Pagto) */}
                          {isMindMapExpanded && isHrExpanded && (
                            <motion.div 
                              key="node-payroll"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                              onClick={() => triggerToast(t('marketing_v2.use_cases_page.mockups.node_payroll'))}
                              className="absolute right-[75px] bottom-[10px] px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold shadow-sm cursor-pointer hover:scale-105 transition-transform z-10"
                            >
                              {t('marketing_v2.use_cases_page.mockups.node_payroll')}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
  )
}
