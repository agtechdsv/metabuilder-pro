import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Plus, Trash2, Calendar, Sparkles, ChevronLeft, ChevronRight,
  Layers, ArrowRight, BarChart3, Eye, Download, ExternalLink, MapPin,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { useUseCaseMockups } from '../../hooks/useUseCaseMockups'

export function MapMockup({ mockupsState }: { mockupsState: ReturnType<typeof useUseCaseMockups> }) {
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
                        Geolocaliza├º├úo de Operadores
                      </span>
                      <span className="px-2.5 py-1 bg-blue-500/10 text-blue-500 text-[10px] font-black rounded-full uppercase tracking-wider">
                        Map View (Leaflet)
                      </span>
                    </div>

                    <div className="w-full bg-[#e8ecef] dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] aspect-[4/3] relative overflow-hidden shadow-inner flex items-center justify-center">
                      {/* Map Background Image */}
                      <img 
                        src="/map_background.png" 
                        alt="Map Background" 
                        className="absolute inset-0 w-full h-full object-cover opacity-60 dark:opacity-30 mix-blend-multiply dark:mix-blend-normal pointer-events-none"
                      />
                      {/* Map Background grid grid layout to simulate streets */}
                      <div className="absolute inset-0 opacity-15 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
                      
                      {/* Map Pins */}
                      <div className="relative w-full h-full">
                        {[
                          { name: 'Filial S├úo Paulo (Matriz)', operators: 12, top: '25%', left: '40%' },
                          { name: 'Filial Rio de Janeiro', operators: 8, top: '60%', left: '75%' },
                          { name: 'CD Campinas', operators: 4, top: '45%', left: '20%' }
                        ].map((pin, idx) => (
                          <div 
                            key={idx}
                            style={{ top: pin.top, left: pin.left }}
                            className="absolute group z-10"
                          >
                            {/* Animated Pin dot */}
                            <div 
                              onClick={() => triggerToast(`${pin.name}: ${pin.operators} operadores`)}
                              className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg cursor-pointer hover:scale-125 transition-transform relative border-2 border-white dark:border-neutral-950"
                            >
                              <MapPin className="w-4 h-4" />
                              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 text-[8px] font-black rounded-full flex items-center justify-center text-white ring-1 ring-white">
                                {pin.operators}
                              </span>
                            </div>
                            
                            {/* Hover info tooltip */}
                            <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-[9px] font-black px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-md pointer-events-none whitespace-nowrap">
                              {pin.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
  )
}
