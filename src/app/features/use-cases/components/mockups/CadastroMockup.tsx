import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Plus, Trash2, Calendar, Sparkles, ChevronLeft, ChevronRight,
  Layers, ArrowRight, BarChart3, Eye, Download, ExternalLink, MapPin,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { useUseCaseMockups } from '../../hooks/useUseCaseMockups'

export function CadastroMockup({ mockupsState }: { mockupsState: ReturnType<typeof useUseCaseMockups> }) {
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
                    className="max-w-md mx-auto bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-6"
                  >
                    <div className="border-b border-neutral-100 dark:border-neutral-800 pb-4">
                      <h4 className="text-sm font-black uppercase tracking-widest text-neutral-800 dark:text-white">
                        {t('marketing_v2.use_cases_page.items.cadastro.title')}
                      </h4>
                      <p className="text-[10px] text-neutral-400 mt-1">
                        Instancia├º├úo pura e isolada de inputs para grava├º├úo direta no banco.
                      </p>
                    </div>

                    <AnimatePresence mode="wait">
                      {regSuccess ? (
                        <motion.div 
                          key="success-form"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="py-10 text-center space-y-4"
                        >
                          <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto text-xl font-bold">
                            Ô£ô
                          </div>
                          <div className="space-y-1">
                            <h5 className="font-bold text-emerald-500 text-sm">Registro Salvo!</h5>
                            <p className="text-[11px] text-neutral-400">Dados persistidos com sucesso via T├║nel do MetaBuilder.</p>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.form 
                          key="active-form"
                          onSubmit={handleRegSubmit} 
                          className="space-y-4 text-left"
                        >
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-neutral-400">{t('marketing_v2.use_cases_page.mockups.name')}</label>
                            <input 
                              type="text" 
                              required
                              value={regName}
                              onChange={(e) => setRegName(e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-indigo-500"
                              placeholder="Nome completo..."
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-neutral-400">{t('marketing_v2.use_cases_page.mockups.email')}</label>
                            <input 
                              type="email" 
                              required
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-indigo-500"
                              placeholder="e-mail de contato..."
                            />
                          </div>
                          <button 
                            type="submit" 
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.02] shadow-lg shadow-emerald-500/10"
                          >
                            {t('marketing_v2.use_cases_page.mockups.save')}
                          </button>
                        </motion.form>
                      )}
                    </AnimatePresence>
                  </motion.div>
  )
}
