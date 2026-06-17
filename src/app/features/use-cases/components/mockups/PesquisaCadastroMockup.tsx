import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Plus, Trash2, Calendar, Sparkles, ChevronLeft, ChevronRight,
  Layers, ArrowRight, BarChart3, Eye, Download, ExternalLink, MapPin,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { useUseCaseMockups } from '../../hooks/useUseCaseMockups'

export function PesquisaCadastroMockup({ mockupsState }: { mockupsState: ReturnType<typeof useUseCaseMockups> }) {
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
                    <div className="flex flex-col sm:flex-row gap-3 justify-between">
                      <div className="relative flex-grow">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input 
                          type="text" 
                          placeholder={t('marketing_v2.use_cases_page.mockups.search')}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs font-medium focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-200"
                        />
                      </div>
                      <button 
                        onClick={() => setIsDrawerOpen(true)}
                        className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{t('marketing_v2.use_cases_page.mockups.add_btn')}</span>
                      </button>
                    </div>

                    <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-neutral-950 shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                            <th className="px-4 py-3">{t('marketing_v2.use_cases_page.mockups.name')}</th>
                            <th className="px-4 py-3 hidden sm:table-cell">{t('marketing_v2.use_cases_page.mockups.email')}</th>
                            <th className="px-4 py-3">{t('marketing_v2.use_cases_page.mockups.status')}</th>
                            <th className="px-4 py-3 text-right">{t('marketing_v2.use_cases_page.mockups.actions')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                          {filteredPesquisaCadastro.length > 0 ? (
                            filteredPesquisaCadastro.map((rec) => (
                              <tr key={rec.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                                <td className="px-4 py-3.5 font-bold text-neutral-800 dark:text-neutral-200">{rec.name}</td>
                                <td className="px-4 py-3.5 text-neutral-500 dark:text-neutral-400 hidden sm:table-cell">{rec.email}</td>
                                <td className="px-4 py-3.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${rec.status === 'Ativo' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-neutral-500/10 text-neutral-400'}`}>
                                    {rec.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  <button 
                                    onClick={() => setRecordToDelete(rec.id)}
                                    className="text-red-400 hover:text-red-600 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors inline-block"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-neutral-400 italic">
                                {t('runtime.no_results')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Dynamic Drawer Overlay Simulator */}
                    <AnimatePresence>
                      {isDrawerOpen && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 rounded-[2.5rem] overflow-hidden flex justify-end">
                          <motion.div 
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="w-full sm:w-[320px] bg-white dark:bg-neutral-950 border-l border-neutral-200 dark:border-neutral-800 h-full p-6 flex flex-col justify-between"
                          >
                            <div className="space-y-6">
                              <h4 className="text-sm font-black uppercase tracking-widest text-neutral-800 dark:text-white">
                                {t('marketing_v2.use_cases_page.mockups.add_btn')}
                              </h4>
                              <form onSubmit={(e) => handleAddRecord(e, t)} className="space-y-4">
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black uppercase text-neutral-400">{t('marketing_v2.use_cases_page.mockups.name')}</label>
                                  <input 
                                    type="text" 
                                    required
                                    value={newRecordName}
                                    onChange={(e) => setNewRecordName(e.target.value)}
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-indigo-500"
                                    placeholder="Ex: David Silva"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black uppercase text-neutral-400">{t('marketing_v2.use_cases_page.mockups.email')}</label>
                                  <input 
                                    type="email" 
                                    required
                                    value={newRecordEmail}
                                    onChange={(e) => setNewRecordEmail(e.target.value)}
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-indigo-500"
                                    placeholder="Ex: david@empresa.com"
                                  />
                                </div>
                                <div className="pt-4 flex gap-2">
                                  <button 
                                    type="submit" 
                                    className="flex-grow py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                                  >
                                    {t('marketing_v2.use_cases_page.mockups.save')}
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => setIsDrawerOpen(false)}
                                    className="px-3 py-2 border border-neutral-200 dark:border-neutral-800 text-neutral-500 rounded-lg text-xs hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                                  >
                                    {t('marketing_v2.use_cases_page.mockups.cancel')}
                                  </button>
                                </div>
                              </form>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>

                    {/* Delete Confirmation Overlay Simulator */}
                    <AnimatePresence>
                      {recordToDelete !== null && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 rounded-[2.5rem] overflow-hidden flex items-center justify-center p-6">
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="w-full max-w-sm bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-5"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-red-500/10 dark:bg-red-500/20 text-red-500 dark:text-red-400 flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5" />
                              </div>
                              <div className="space-y-1 text-left">
                                <h4 className="text-sm font-bold text-neutral-800 dark:text-white leading-tight">
                                  {t('marketing_v2.use_cases_page.mockups.delete_confirm_title')}
                                </h4>
                                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                  {t('marketing_v2.use_cases_page.mockups.delete_confirm_desc')}
                                </p>
                              </div>
                            </div>

                            <div className="pt-2 flex gap-2">
                              <button 
                                onClick={() => {
                                  if (recordToDelete !== null) {
                                    handleDeleteRecord(recordToDelete, t)
                                    setRecordToDelete(null)
                                  }
                                }}
                                className="flex-grow py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors"
                              >
                                {t('marketing_v2.use_cases_page.mockups.delete_confirm_yes')}
                              </button>
                              <button 
                                type="button" 
                                onClick={() => setRecordToDelete(null)}
                                className="px-4 py-2.5 border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-xl text-xs font-bold hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                              >
                                {t('marketing_v2.use_cases_page.mockups.delete_confirm_no')}
                              </button>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  </motion.div>
  )
}
