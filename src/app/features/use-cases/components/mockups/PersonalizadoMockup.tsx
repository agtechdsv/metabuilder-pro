import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Plus, Trash2, Calendar, Sparkles, ChevronLeft, ChevronRight,
  Layers, ArrowRight, BarChart3, Eye, Download, ExternalLink, MapPin,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { useUseCaseMockups } from '../../hooks/useUseCaseMockups'

export function PersonalizadoMockup({ mockupsState }: { mockupsState: ReturnType<typeof useUseCaseMockups> }) {
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
                    className="space-y-6 text-left"
                  >
                    <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm space-y-4">
                      
                      {/* Hybrid Layout Header */}
                      <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                            <Layers className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-neutral-800 dark:text-white leading-tight">
                              Painel de Controle Financeiro (H├¡brido)
                            </h4>
                            <p className="text-[10px] text-neutral-400">
                              Exemplo de Layout Personalizado com m├║ltiplas vis├Áes e bot├Áes din├ómicos
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {/* Mock Action Buttons generated from Tabs */}
                          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center gap-1.5 shadow-sm">
                            <Plus className="w-3.5 h-3.5" /> Emitir NFe
                          </button>
                          <button className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center gap-1.5">
                            <ExternalLink className="w-3.5 h-3.5" /> Portal
                          </button>
                        </div>
                      </div>

                      {/* Fake Tabs */}
                      <div className="flex border-b border-neutral-200 dark:border-neutral-800">
                        <button 
                          onClick={() => setCustomHybridTab('metrics')}
                          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${customHybridTab === 'metrics' ? 'border-amber-500 text-amber-600 dark:text-amber-500' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'}`}
                        >
                          M├®tricas e Gr├íficos
                        </button>
                        <button 
                          onClick={() => setCustomHybridTab('kanban')}
                          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${customHybridTab === 'kanban' ? 'border-amber-500 text-amber-600 dark:text-amber-500' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'}`}
                        >
                          Kanban de Aprova├º├Áes
                        </button>
                        <button 
                          onClick={() => setCustomHybridTab('history')}
                          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${customHybridTab === 'history' ? 'border-amber-500 text-amber-600 dark:text-amber-500' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'}`}
                        >
                          Hist├│rico (Grid)
                        </button>
                      </div>

                      {/* Content Area - Simulated Dynamic Content */}
                      <div className="pt-2 min-h-[220px]">
                        <AnimatePresence mode="wait">
                          {customHybridTab === 'metrics' && (
                            <motion.div 
                              key="metrics"
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className="grid grid-cols-1 md:grid-cols-3 gap-4"
                            >
                              <div className="col-span-2 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="p-4 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                                    <span className="text-[10px] font-black uppercase text-neutral-400">Receita Bruta</span>
                                    <p className="text-xl font-black text-neutral-800 dark:text-white mt-1">R$ 1.452.900</p>
                                  </div>
                                  <div className="p-4 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                                    <span className="text-[10px] font-black uppercase text-neutral-400">Custos Vari├íveis</span>
                                    <p className="text-xl font-black text-rose-500 mt-1">R$ 384.200</p>
                                  </div>
                                </div>
                                <div className="h-32 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex items-center justify-center text-xs text-neutral-400 font-medium">
                                  <BarChart3 className="w-5 h-5 mr-2 opacity-50" />
                                  [Gr├ífico Anal├¡tico Embutido]
                                </div>
                              </div>
                              <div className="col-span-1 border-l border-neutral-100 dark:border-neutral-800 pl-4">
                                <h5 className="text-[10px] font-black uppercase text-neutral-400 mb-3">
                                  A├º├Áes R├ípidas Customizadas
                               </h5>
                                <div className="space-y-2">
                                  <button className="w-full text-left p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-indigo-500/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 transition-colors flex items-center justify-between group">
                                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Aprovar Lote #41</span>
                                    <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-indigo-500" />
                                  </button>
                                  <button className="w-full text-left p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-indigo-500/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 transition-colors flex items-center justify-between group">
                                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Revisar Despesas</span>
                                    <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-indigo-500" />
                                  </button>
                                  <button className="w-full text-left p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 hover:border-amber-400 transition-colors flex items-center justify-between group">
                                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Gerar Fechamento</span>
                                    <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}

                          {customHybridTab === 'kanban' && (
                            <motion.div 
                              key="kanban"
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className="grid grid-cols-3 gap-4"
                            >
                              <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-xl p-3 border border-neutral-100 dark:border-neutral-800 h-48 flex flex-col gap-2">
                                <span className="text-[10px] font-black uppercase text-neutral-400 px-1">Pendente</span>
                                <div className="bg-white dark:bg-neutral-950 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-sm">
                                  <p className="text-[10px] font-bold text-neutral-800 dark:text-neutral-200">Revis├úo Cont├íbil Q2</p>
                                </div>
                                <div className="bg-white dark:bg-neutral-950 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-sm opacity-50 border-dashed"></div>
                              </div>
                              <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-xl p-3 border border-neutral-100 dark:border-neutral-800 h-48 flex flex-col gap-2">
                                <span className="text-[10px] font-black uppercase text-amber-500 px-1">Em An├ílise</span>
                                <div className="bg-white dark:bg-neutral-950 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/30 shadow-sm border-l-2 border-l-amber-500">
                                  <p className="text-[10px] font-bold text-neutral-800 dark:text-neutral-200">Aprovar Adiantamentos</p>
                                </div>
                              </div>
                              <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-xl p-3 border border-neutral-100 dark:border-neutral-800 h-48 flex flex-col gap-2">
                                <span className="text-[10px] font-black uppercase text-emerald-500 px-1">Aprovado</span>
                                <div className="bg-white dark:bg-neutral-950 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900/30 shadow-sm border-l-2 border-l-emerald-500">
                                  <p className="text-[10px] font-bold text-neutral-800 dark:text-neutral-200">Lote Pagamento #40</p>
                                </div>
                              </div>
                            </motion.div>
                          )}

                          {customHybridTab === 'history' && (
                            <motion.div 
                              key="history"
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-950"
                            >
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-[9px] font-black uppercase text-neutral-400 tracking-wider">
                                    <th className="px-4 py-2">Data</th>
                                    <th className="px-4 py-2">A├º├úo</th>
                                    <th className="px-4 py-2">Usu├írio</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                                  <tr className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30">
                                    <td className="px-4 py-2 font-mono text-neutral-500">Hoje, 14:30</td>
                                    <td className="px-4 py-2 font-bold text-neutral-800 dark:text-neutral-200">Emiss├úo de NFe Avulsa</td>
                                    <td className="px-4 py-2 text-indigo-500">@alexandre</td>
                                  </tr>
                                  <tr className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30">
                                    <td className="px-4 py-2 font-mono text-neutral-500">Ontem, 09:15</td>
                                    <td className="px-4 py-2 font-bold text-neutral-800 dark:text-neutral-200">Baixa de Lote #39</td>
                                    <td className="px-4 py-2 text-indigo-500">@financeiro</td>
                                  </tr>
                                  <tr className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30">
                                    <td className="px-4 py-2 font-mono text-neutral-500">05/06, 16:00</td>
                                    <td className="px-4 py-2 font-bold text-neutral-800 dark:text-neutral-200">Altera├º├úo de Meta</td>
                                    <td className="px-4 py-2 text-indigo-500">@diretoria</td>
                                  </tr>
                                </tbody>
                              </table>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
  )
}
