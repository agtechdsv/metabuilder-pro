import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Plus, Trash2, Calendar, Sparkles, ChevronLeft, ChevronRight,
  Layers, ArrowRight, BarChart3, Eye, Download, ExternalLink, MapPin,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { useUseCaseMockups } from '../../hooks/useUseCaseMockups'

export function BlueprintMockup({ mockupsState }: { mockupsState: ReturnType<typeof useUseCaseMockups> }) {
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
                        Fluxo de Aprova├º├úo de Proposta
                      </span>
                      <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-500 text-[10px] font-black rounded-full uppercase tracking-wider">
                        Workflow Canvas
                      </span>
                    </div>

                    <div className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl aspect-[4/3] relative overflow-hidden p-6 flex flex-col items-center justify-between">
                      {/* Connection arrows using SVG */}
                      <svg className="w-full h-full absolute inset-0 pointer-events-none" viewBox="0 0 400 300">
                        {/* Node 1 to Node 2 */}
                        <line x1="200" y1="65" x2="200" y2="120" stroke="#818cf8" strokeWidth="2.5" />
                        {/* Arrowhead Node 1 to 2 */}
                        <polygon points="200,123 196,115 204,115" fill="#818cf8" />
                        
                        {/* Node 2 to Node 3 (Aprovado) */}
                        <path d="M 150 145 L 85 145 L 85 200" fill="none" stroke="#10b981" strokeWidth="2.5" />
                        <polygon points="85,203 81,195 89,195" fill="#10b981" />

                        {/* Node 2 to Node 4 (Rejeitado) */}
                        <path d="M 250 145 L 315 145 L 315 200" fill="none" stroke="#f43f5e" strokeWidth="2.5" />
                        <polygon points="315,203 311,195 319,195" fill="#f43f5e" />
                      </svg>

                      {/* Nodes */}
                      <div className="relative w-full h-full">
                        {/* Node 1: Start */}
                        <div 
                          onClick={() => triggerToast('N├│: Cria├º├úo de Proposta')}
                          className="absolute left-1/2 -translate-x-1/2 top-4 px-4 py-2.5 bg-indigo-505 text-white rounded-2xl shadow-md cursor-pointer hover:scale-105 transition-transform text-xs font-bold text-center z-10"
                        >
                          ­ƒôØ 1. Proposta Criada
                        </div>

                        {/* Node 2: Decision */}
                        <div 
                          onClick={() => triggerToast('N├│ de Decis├úo: Revis├úo do Gestor')}
                          className="absolute left-1/2 -translate-x-1/2 top-28 px-5 py-3 bg-white dark:bg-neutral-900 border-2 border-indigo-500 text-neutral-800 dark:text-neutral-200 rounded-2xl shadow-lg cursor-pointer hover:scale-105 transition-transform text-xs font-black text-center z-10"
                        >
                          ÔÜû´©Å 2. Revis├úo do Gestor
                        </div>

                        {/* Node 3: Approved */}
                        <div 
                          onClick={() => triggerToast('A├º├úo: Proposta Aprovada')}
                          className="absolute left-6 bottom-8 px-4 py-2.5 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500 text-emerald-600 dark:text-emerald-400 rounded-2xl shadow-sm cursor-pointer hover:scale-105 transition-transform text-xs font-bold text-center z-10"
                        >
                          Ô£à 3. Aprovada e Enviada
                        </div>

                        {/* Node 4: Rejected */}
                        <div 
                          onClick={() => triggerToast('A├º├úo: Proposta Rejeitada')}
                          className="absolute right-6 bottom-8 px-4 py-2.5 bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500 text-rose-600 dark:text-rose-450 rounded-2xl shadow-sm cursor-pointer hover:scale-105 transition-transform text-xs font-bold text-center z-10"
                        >
                          ÔØî 4. Devolvida para Ajustes
                        </div>
                      </div>
                    </div>
                  </motion.div>
  )
}
