import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Plus, Trash2, Calendar, Sparkles, ChevronLeft, ChevronRight,
  Layers, ArrowRight, BarChart3, Eye, Download, ExternalLink, MapPin,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { useUseCaseMockups } from '../../hooks/useUseCaseMockups'

export function GaleriaMockup({ mockupsState }: { mockupsState: ReturnType<typeof useUseCaseMockups> }) {
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
                    {/* Header Controls */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white dark:bg-neutral-950 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                      <div className="relative w-full sm:w-auto flex-grow max-w-xs">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input 
                          type="text" 
                          placeholder="Buscar arquivos..."
                          value={gallerySearchQuery}
                          onChange={(e) => setGallerySearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs font-medium focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-200"
                        />
                      </div>
                      
                      {/* Filter tabs */}
                      <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-900 p-1 rounded-xl w-full sm:w-auto justify-center sm:justify-start">
                        {(['all', 'image', 'pdf'] as const).map((filter) => (
                          <button
                            key={filter}
                            type="button"
                            onClick={() => setGalleryFilter(filter)}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors capitalize ${
                              galleryFilter === filter
                                ? 'bg-white dark:bg-neutral-800 text-rose-600 dark:text-rose-450 shadow-sm'
                                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
                            }`}
                          >
                            {filter === 'all' ? 'Todos' : filter === 'image' ? 'Imagens' : 'Documentos'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Gallery Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filteredGalleryAssets.length > 0 ? (
                        filteredGalleryAssets.map((asset) => (
                          <div 
                            key={asset.id} 
                            className="group relative bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col"
                          >
                            {/* Visual Preview Area */}
                            <div className="aspect-video w-full relative overflow-hidden bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-center">
                              {asset.type === 'image' ? (
                                <img 
                                  src={asset.url} 
                                  alt={asset.title} 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                />
                              ) : (
                                <div className="flex flex-col items-center gap-2 p-4 text-center">
                                  <FileText className="w-10 h-10 text-rose-500" />
                                  <span className="text-[10px] font-mono font-black uppercase text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded">PDF</span>
                                </div>
                              )}
                              
                              {/* Hover actions overlay */}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button 
                                  type="button"
                                  onClick={() => setSelectedAssetPreview(asset)}
                                  className="p-2.5 bg-white text-neutral-850 rounded-xl hover:bg-neutral-100 active:scale-95 transition-all shadow-lg flex items-center gap-1.5 text-xs font-bold"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span>Visualizar</span>
                                </button>
                              </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-4 flex-grow flex flex-col justify-between gap-3">
                              <div className="space-y-1">
                                <h4 className="text-xs font-black text-neutral-800 dark:text-white leading-snug">
                                  {asset.title}
                                </h4>
                                <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 font-mono truncate">
                                  {asset.fileName}
                                </p>
                              </div>

                              <div className="flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800/80 pt-3">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[8px] font-bold text-neutral-450 uppercase tracking-wider">Tamanho</span>
                                  <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300">{asset.size}</span>
                                </div>
                                <div className="flex gap-1">
                                  <button 
                                    type="button"
                                    onClick={() => triggerToast(`Iniciando download de ${asset.fileName}...`)}
                                    className="p-2 hover:bg-rose-500/10 hover:text-rose-500 text-neutral-400 rounded-xl transition-colors"
                                    title="Baixar arquivo"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => triggerToast(`Redirecionando para ${asset.externalUrl}...`)}
                                    className="p-2 hover:bg-rose-500/10 hover:text-rose-500 text-neutral-400 rounded-xl transition-colors"
                                    title="Acessar link externo"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-2 py-12 text-center text-neutral-400 italic text-xs">
                          Nenhum arquivo correspondente aos filtros.
                        </div>
                      )}
                    </div>

                    {/* Lightbox / Preview Modal Simulation */}
                    <AnimatePresence>
                      {selectedAssetPreview && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 rounded-[2.5rem] overflow-hidden flex items-center justify-center p-6">
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-sm bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
                          >
                            <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase text-neutral-450 tracking-wider">
                                Pr├®-visualiza├º├úo do Asset
                              </span>
                              <button 
                                type="button"
                                onClick={() => setSelectedAssetPreview(null)}
                                className="text-xs font-black text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                              >
                                Fechar
                              </button>
                            </div>
                            
                            <div className="p-6 space-y-4">
                              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 flex items-center justify-center">
                                {selectedAssetPreview.type === 'image' ? (
                                  <img src={selectedAssetPreview.url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <FileText className="w-12 h-12 text-rose-500" />
                                )}
                              </div>
                              
                              <div className="space-y-2">
                                <h5 className="font-extrabold text-sm text-neutral-800 dark:text-white">
                                  {selectedAssetPreview.title}
                                </h5>
                                <div className="grid grid-cols-2 gap-3 text-[11px] bg-neutral-50 dark:bg-neutral-900/60 p-3 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                                  <div>
                                    <span className="text-neutral-450 block text-[9px] font-bold uppercase">Formato</span>
                                    <span className="font-bold text-neutral-700 dark:text-neutral-300 uppercase">{selectedAssetPreview.type}</span>
                                  </div>
                                  <div>
                                    <span className="text-neutral-450 block text-[9px] font-bold uppercase">Tamanho</span>
                                    <span className="font-bold text-neutral-700 dark:text-neutral-300">{selectedAssetPreview.size}</span>
                                  </div>
                                  <div className="col-span-2">
                                    <span className="text-neutral-450 block text-[9px] font-bold uppercase">Atualizado em</span>
                                    <span className="font-bold text-neutral-700 dark:text-neutral-300">{selectedAssetPreview.updatedAt}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <button 
                                type="button"
                                onClick={() => {
                                  triggerToast(`Efetuando download de ${selectedAssetPreview.fileName}...`)
                                  setSelectedAssetPreview(null)
                                }}
                                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                              >
                                <Download className="w-4 h-4" />
                                <span>Baixar Arquivo</span>
                              </button>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  </motion.div>
  )
}
