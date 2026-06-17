import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Plus, Trash2, Calendar, Sparkles, ChevronLeft, ChevronRight,
  Layers, ArrowRight, BarChart3, Eye, Download, ExternalLink, MapPin,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { useUseCaseMockups } from '../../hooks/useUseCaseMockups'

export function DashboardMockup({ mockupsState }: { mockupsState: ReturnType<typeof useUseCaseMockups> }) {
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
                    {/* Period Selector Tabs */}
                    <div className="flex justify-between items-center bg-white dark:bg-neutral-950 p-2.5 rounded-2xl border border-neutral-250 dark:border-neutral-800 shadow-sm">
                      <span className="text-[10px] font-black uppercase text-neutral-450 tracking-wider pl-2">
                        Painel de Performance (BI)
                      </span>
                      <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-900 p-1 rounded-xl">
                        {(['7d', '30d', '12m'] as const).map((period) => (
                          <button
                            key={period}
                            onClick={() => setDashboardPeriod(period)}
                            className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-colors ${
                              dashboardPeriod === period
                                ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
                            }`}
                          >
                            {period === '7d' ? '7 Dias' : period === '30d' ? '30 Dias' : '12 Meses'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Metric Cards Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-4 bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-1">
                        <span className="text-[9px] font-black uppercase text-neutral-400">Faturamento</span>
                        <h4 className="text-sm font-black text-neutral-850 dark:text-white">
                          {dashboardPeriod === '7d' ? 'R$ 143,2 mil' : dashboardPeriod === '30d' ? 'R$ 589,4 mil' : 'R$ 6,84 mi'}
                        </h4>
                        <span className="text-[9px] font-bold text-emerald-500 block">
                          +{dashboardPeriod === '7d' ? '12%' : dashboardPeriod === '30d' ? '18%' : '32%'} vs ant.
                        </span>
                      </div>
                      <div className="p-4 bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-1">
                        <span className="text-[9px] font-black uppercase text-neutral-400">Assinaturas</span>
                        <h4 className="text-sm font-black text-neutral-850 dark:text-white">
                          {dashboardPeriod === '7d' ? '1.240' : dashboardPeriod === '30d' ? '1.380' : '2.450'}
                        </h4>
                        <span className="text-[9px] font-bold text-emerald-500 block">
                          +{dashboardPeriod === '7d' ? '5%' : dashboardPeriod === '30d' ? '8%' : '24%'} vs ant.
                        </span>
                      </div>
                      <div className="p-4 bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-1">
                        <span className="text-[9px] font-black uppercase text-neutral-400">Ticket M├®dio</span>
                        <h4 className="text-sm font-black text-neutral-850 dark:text-white">
                          {dashboardPeriod === '7d' ? 'R$ 115' : dashboardPeriod === '30d' ? 'R$ 427' : 'R$ 2.791'}
                        </h4>
                        <span className="text-[9px] font-bold text-indigo-500 block">Est├ível</span>
                      </div>
                    </div>

                    {/* Animated Bar Chart SVG representation */}
                    <div className="p-5 bg-white dark:bg-neutral-950 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
                      <span className="text-[10px] font-black uppercase text-neutral-450 tracking-wider">
                        Gr├ífico de Tend├¬ncia de Receita
                      </span>
                      <div className="h-32 flex items-end justify-between gap-2 px-2 pt-4 relative">
                        {/* Helper grid lines */}
                        <div className="absolute inset-x-0 top-0 border-t border-dashed border-neutral-100 dark:border-neutral-800"></div>
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-neutral-100 dark:border-neutral-800"></div>
                        
                        {/* Dynamic bar charts rendering */}
                        {(dashboardPeriod === '7d' 
                          ? [30, 45, 60, 20, 80, 50, 90] 
                          : dashboardPeriod === '30d' 
                          ? [40, 70, 55, 85, 60, 95] 
                          : [20, 30, 25, 45, 60, 55, 75, 80, 70, 90, 85, 100]
                        ).map((height, i) => (
                          <div key={i} className="flex-grow flex flex-col items-center gap-1 group">
                            {/* Fixed-height container for the bar to resolve percentage height calculation */}
                            <div className="w-full h-24 flex items-end justify-center relative">
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${height}%` }}
                                transition={{ type: 'spring', damping: 15, stiffness: 100 }}
                                className="w-full max-w-[16px] sm:max-w-[20px] bg-gradient-to-t from-indigo-500 to-purple-500 rounded-t-lg group-hover:from-indigo-400 group-hover:to-purple-400 transition-colors relative"
                              >
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-[9px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md z-10">
                                  {height}%
                                </div>
                              </motion.div>
                            </div>
                            <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest mt-1">
                              {dashboardPeriod === '7d' 
                                ? ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'][i] 
                                : dashboardPeriod === '30d' 
                                ? ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'][i] 
                                : ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][i]
                              }
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stock Gauge Grid Component from Image */}
                    <div className="p-6 bg-white dark:bg-neutral-950 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-[#eaeefd] dark:bg-indigo-950/50 flex items-center justify-center text-[#5c72e7] dark:text-indigo-400 shrink-0">
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9C8.8 1 15.2 1 19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
                              <path d="m12 12-4-4" />
                              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                            </svg>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <h4 className="text-base font-black uppercase text-black dark:text-white tracking-wider leading-none">ESTOQUE</h4>
                            <span className="text-[9px] font-bold text-[#94a3b8] dark:text-neutral-500 uppercase tracking-widest block">SUM (TODA TABELA)</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => triggerToast('Pesquisa de estoque simulada!')}
                          className="p-2 text-[#94a3b8] hover:text-neutral-600 dark:hover:text-neutral-250 transition-colors"
                        >
                          <Search className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="flex gap-4 relative">
                        {/* Scrollable grid container */}
                        <div 
                          ref={estoqueGridRef}
                          onScroll={handleScroll}
                          className="flex-grow grid grid-cols-1 sm:grid-cols-3 gap-4 max-h-[350px] overflow-y-auto pr-2 scrollbar-none [&::-webkit-scrollbar]:hidden"
                          style={{
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none'
                          }}
                        >
                          {[
                            { name: 'NOTEBOOK NEO 15', value: 532, percent: 0.532, color: '#00b074' },
                            { name: 'C├éMERA DSLR HYPER 18', value: 35, percent: 0.175, color: '#ff9f00' },
                            { name: 'FONE DE OUVIDO APEX 21', value: 492, percent: 0.615, color: '#00b074' },
                            { name: 'SMARTWATCH PRIME 24', value: 10, percent: 0.033, color: '#ff3b30' },
                            { name: 'TECLADO MEC├éNICO VORTEX 27', value: 1029, percent: 0.686, color: '#00b074' },
                            { name: 'MOUSE GAMER LEGEND 30', value: 1161, percent: 0.774, color: '#00b074' },
                            { name: 'MONITOR 4K ULTRA 33', value: 98, percent: 0.196, color: '#ff9f00' },
                            { name: 'IMPRESSORA 3D PRO MAX 36', value: 15, percent: 0.15, color: '#ff3b30' },
                            { name: 'CARREGADOR SEM FIO ELITE 39', value: 850, percent: 0.85, color: '#00b074' },
                          ].map((item, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => triggerToast(`Estoque de ${item.name}: ${item.value} unidades`)}
                              className="bg-[#f8f9fa] dark:bg-neutral-900/40 p-5 rounded-[2.5rem] flex flex-col items-center justify-between text-center relative group hover:scale-[1.02] active:scale-95 transition-all duration-300 cursor-pointer"
                            >
                              <span className="text-[10px] font-bold text-[#8e9aa8] dark:text-neutral-400 tracking-wider mb-3 block uppercase">
                                {item.name}
                              </span>
                              
                              <div className="relative w-28 h-16 flex items-center justify-center">
                                <svg className="w-full h-full" viewBox="0 0 120 70">
                                  {/* Track Arc */}
                                  <path 
                                    d="M 15,60 A 45,45 0 0,1 105,60" 
                                    fill="none" 
                                    stroke="#e5e7eb" 
                                    strokeWidth="10" 
                                    strokeLinecap="round" 
                                    className="dark:stroke-neutral-800"
                                  />
                                  {/* Value Arc */}
                                  <path 
                                    d="M 15,60 A 45,45 0 0,1 105,60" 
                                    fill="none" 
                                    stroke={item.color} 
                                    strokeWidth="10" 
                                    strokeLinecap="round" 
                                    strokeDasharray="141" 
                                    strokeDashoffset={141 * (1 - item.percent)}
                                    className="transition-all duration-1000 ease-out"
                                  />
                                  {/* Pivot Center */}
                                  <circle cx="60" cy="60" r="3.5" fill="#171717" className="dark:fill-neutral-200" />
                                  {/* Needle */}
                                  <line 
                                    x1="60" 
                                    y1="60" 
                                    x2="25" 
                                    y2="60" 
                                    stroke="#171717" 
                                    strokeWidth="2.5" 
                                    strokeLinecap="round" 
                                    className="dark:stroke-neutral-200"
                                    style={{ 
                                      transform: `rotate(${item.percent * 180}deg)`, 
                                      transformOrigin: '60px 60px',
                                      transition: 'transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)' 
                                    }} 
                                  />
                                </svg>
                                
                                <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-lg font-black text-[#171717] dark:text-neutral-100 tracking-tight leading-none">
                                  {item.value.toLocaleString('pt-BR')}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Custom Scrollbar Column mimicking the image */}
                        <div className="w-6 flex flex-col items-center justify-between py-1 shrink-0 select-none border-l border-neutral-100 dark:border-neutral-800/80 pl-2">
                          {/* Up Arrow */}
                          <button 
                            onClick={scrollUp}
                            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors p-1"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M12 6l-6 6h12z" />
                            </svg>
                          </button>

                          {/* Track */}
                          <div className="w-1.5 flex-grow bg-neutral-100 dark:bg-neutral-800 rounded-full my-2 relative">
                            {/* Thumb */}
                            <div 
                              className="absolute w-full bg-[#8e9aa8] dark:bg-neutral-600 rounded-full cursor-pointer hover:bg-neutral-500 transition-all duration-100"
                              style={{ 
                                height: '40px',
                                top: `calc(${scrollPercent} * (100% - 40px))`
                              }}
                            />
                          </div>

                          {/* Down Arrow */}
                          <button 
                            onClick={scrollDown}
                            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors p-1"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M12 18l-6-6h12z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
  )
}
