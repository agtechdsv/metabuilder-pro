import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Plus, Trash2, Calendar, Sparkles, ChevronLeft, ChevronRight,
  Layers, ArrowRight, BarChart3, Eye, Download, ExternalLink, MapPin,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { useUseCaseMockups } from '../../hooks/useUseCaseMockups'

export function TimelineMockup({ mockupsState }: { mockupsState: ReturnType<typeof useUseCaseMockups> }) {
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
                        Histórico de Auditoria
                      </span>
                      <span className="px-2.5 py-1 bg-violet-500/10 text-violet-500 text-[10px] font-black rounded-full uppercase tracking-wider">
                        Real-time Feed
                      </span>
                    </div>

                    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200 dark:before:bg-neutral-850">
                      {[
                        { time: 'Hoje, 18:30', title: 'Caso de Uso Publicado', desc: 'O desenvolvedor João entregou a tela "Gestão de Contratos".', type: 'success' },
                        { time: 'Hoje, 15:45', title: 'Integração Estabelecida', desc: 'Conexão via Túnel Seguro estabelecida com o banco Postgres de produção.', type: 'info' },
                        { time: 'Ontem, 10:15', title: 'Alteração de Permissões', desc: 'Permissões do usuário Maria Santos alteradas para Administrador.', type: 'warning' },
                        { time: '24 Mai, 14:00', title: 'Novo Integrador Adicionado', desc: 'Webhook configurado para disparar eventos para o Asaas.', type: 'default' }
                      ].map((item, idx) => (
                        <div key={idx} className="relative group">
                          {/* Timeline node dot */}
                          <div className={cn(
                            "absolute -left-[22px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-neutral-950 transition-transform group-hover:scale-125",
                            item.type === 'success' ? 'bg-emerald-500' :
                            item.type === 'info' ? 'bg-blue-500' :
                            item.type === 'warning' ? 'bg-amber-500' : 'bg-neutral-450'
                          )} />
                          
                          <div 
                            onClick={() => triggerToast(`Visualizando: ${item.title}`)}
                            className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer text-left space-y-1"
                          >
                            <span className="text-[10px] font-bold text-neutral-400 font-mono">{item.time}</span>
                            <h5 className="text-xs font-bold text-neutral-850 dark:text-white">{item.title}</h5>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-normal">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
  )
}
