import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, Trash2, Calendar, Sparkles, ChevronLeft, ChevronRight,
  Layers, ArrowRight, BarChart3, Eye, Download, ExternalLink, MapPin,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { useUseCaseMockups } from '../../hooks/useUseCaseMockups'

export function MasterDetailMockup({ mockupsState }: { mockupsState: ReturnType<typeof useUseCaseMockups> }) {
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
      {/* Master Record Panel */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
        <div className="space-y-1">
          <span className="text-[9px] font-black uppercase text-neutral-400">{t('runtime.master_details.main_data')}</span>
          <h4 className="text-sm font-extrabold text-neutral-800 dark:text-white">Alexandre Silva</h4>
          <p className="text-[10px] text-neutral-500">ID: #349202</p>
        </div>
        <div className="space-y-1">
          <span className="text-[9px] font-black uppercase text-neutral-400">Plano</span>
          <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Pro Enterprise</p>
        </div>
        <div className="space-y-1 sm:text-right">
          <span className="text-[9px] font-black uppercase text-neutral-400">Total Faturado</span>
          <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">R$ 14.820,00</p>
        </div>
      </div>

      {/* Details Relational Tabs */}
      <div className="space-y-3">
        <div className="flex border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveDetailTab('items')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${activeDetailTab === 'items' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'}`}
          >
            {t('marketing_v2.use_cases_page.mockups.tab_items')} (2)
          </button>
          <button
            onClick={() => setActiveDetailTab('payments')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${activeDetailTab === 'payments' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'}`}
          >
            {t('marketing_v2.use_cases_page.mockups.tab_payments')} (3)
          </button>
          <button
            onClick={() => setActiveDetailTab('logs')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${activeDetailTab === 'logs' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'}`}
          >
            {t('marketing_v2.use_cases_page.mockups.tab_logs')}
          </button>
        </div>

        <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden p-4 min-h-[160px]">
          <AnimatePresence mode="wait">
            {activeDetailTab === 'items' && (
              <motion.div
                key="items-detail"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div className="grid grid-cols-3 text-[9px] font-black uppercase text-neutral-400 tracking-wider border-b border-neutral-100 dark:border-neutral-800 pb-2">
                  <span>{t('marketing_v2.use_cases_page.mockups.item_name')}</span>
                  <span className="text-center">{t('marketing_v2.use_cases_page.mockups.qty')}</span>
                  <span className="text-right">{t('marketing_v2.use_cases_page.mockups.price')}</span>
                </div>
                <div className="grid grid-cols-3 text-xs">
                  <span className="font-bold text-neutral-800 dark:text-neutral-300">Database Connector Cloud</span>
                  <span className="text-center">1</span>
                  <span className="text-right text-neutral-600 dark:text-neutral-400">R$ 9.600,00</span>
                </div>
                <div className="grid grid-cols-3 text-xs">
                  <span className="font-bold text-neutral-800 dark:text-neutral-300">Suporte Dedicado 24h</span>
                  <span className="text-center">12</span>
                  <span className="text-right text-neutral-600 dark:text-neutral-400">R$ 435,00/mês</span>
                </div>
              </motion.div>
            )}

            {activeDetailTab === 'payments' && (
              <motion.div
                key="payments-detail"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div className="grid grid-cols-3 text-[9px] font-black uppercase text-neutral-400 border-b border-neutral-100 dark:border-neutral-800 pb-2">
                  <span>ID Transação</span>
                  <span>Data</span>
                  <span className="text-right">Status</span>
                </div>
                <div className="grid grid-cols-3 text-xs">
                  <span className="font-mono text-[10px]">TX-98231</span>
                  <span className="text-neutral-500">21/05/2026</span>
                  <span className="text-right text-emerald-500 font-bold">Pago</span>
                </div>
                <div className="grid grid-cols-3 text-xs">
                  <span className="font-mono text-[10px]">TX-97210</span>
                  <span className="text-neutral-500">21/04/2026</span>
                  <span className="text-right text-emerald-500 font-bold">Pago</span>
                </div>
                <div className="grid grid-cols-3 text-xs">
                  <span className="font-mono text-[10px]">TX-96102</span>
                  <span className="text-neutral-500">21/03/2026</span>
                  <span className="text-right text-amber-500 font-bold">Pendente</span>
                </div>
              </motion.div>
            )}

            {activeDetailTab === 'logs' && (
              <motion.div 
                key="logs-detail"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-neutral-500 space-y-2 font-mono"
              >
                <p>[2026-05-21 15:30] ✅ Conectado com sucesso via Túnel Seguro.</p>
                <p>[2026-05-21 14:12] 📝 Registro alterado por administrador@empresa.com</p>
                <p>[2026-05-20 09:41] 🚀 Mapeamento semântico de relacionamentos (FK) atualizado.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
