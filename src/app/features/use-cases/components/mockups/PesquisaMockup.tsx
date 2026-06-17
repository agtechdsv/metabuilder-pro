import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Plus, Trash2, Calendar, Sparkles, ChevronLeft, ChevronRight,
  Layers, ArrowRight, BarChart3, Eye, Download, ExternalLink, MapPin,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { useUseCaseMockups } from '../../hooks/useUseCaseMockups'

export function PesquisaMockup({ mockupsState }: { mockupsState: ReturnType<typeof useUseCaseMockups> }) {
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
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input 
                        type="text" 
                        placeholder="Pesquisar por descri├º├úo ou c├│digo (Ex: Servidor, Edge)..."
                        value={searchOnlyQuery}
                        onChange={(e) => setSearchOnlyQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs font-medium focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-200"
                      />
                    </div>

                    <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-neutral-950 shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                            <th className="px-4 py-3">C├│digo</th>
                            <th className="px-4 py-3">Descri├º├úo</th>
                            <th className="px-4 py-3">Regi├úo</th>
                            <th className="px-4 py-3 text-right">Uso de CPU</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                          {filteredSearchOnly.length > 0 ? (
                            filteredSearchOnly.map((rec, idx) => (
                              <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                                <td className="px-4 py-3.5 font-mono text-[10px] font-bold text-neutral-800 dark:text-neutral-200">{rec.code}</td>
                                <td className="px-4 py-3.5 text-neutral-600 dark:text-neutral-400">{rec.description}</td>
                                <td className="px-4 py-3.5 text-neutral-500">{rec.region}</td>
                                <td className="px-4 py-3.5 text-right font-bold text-neutral-800 dark:text-neutral-200">
                                  <div className="flex items-center justify-end gap-2">
                                    <span>{rec.usage}</span>
                                    <div className="w-12 h-1.5 bg-neutral-100 dark:bg-neutral-850 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-cyan-500" 
                                        style={{ width: rec.usage }}
                                      ></div>
                                    </div>
                                  </div>
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
                  </motion.div>
  )
}
