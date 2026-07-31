import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import FormulaBuilder from '../../../FormulaBuilder'
import {
  Settings2, Database, Layout, MousePointer2, Plus, Trash2,
  CheckCircle2, AlertCircle, Loader2, Search, Pencil, RefreshCcw,
  Table, GripVertical, SlidersHorizontal, ArrowRightLeft, ArrowRight,
  Type, Palette, Maximize2, Lock, Type as FontIcon, Share2, Columns,
  Settings, LayoutGrid, Wand2, Terminal, RotateCcw, Link, Layers,
  Activity, History, Gauge, BarChart3, BarChartHorizontal, Calendar,
  Download, Zap, Globe, Copy, FileText, FileSpreadsheet, Workflow,
  Check, X, Eye, EyeOff, ChevronDown, ChevronUp
} from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { CustomActionsEditor } from './CustomActionsEditor'
import { SqlQuerySection } from './SqlQuerySection'
import { ButtonsConfig } from './ButtonsConfig'
import { IconPicker } from '../../../IconPicker'
import DynamicIcon from '@/components/runtime/DynamicIcon'
import { getModelsWithRelations } from '@/lib/relationPathFinder'
import { useDraggable, useDroppable } from '@dnd-kit/core'

export function StepActions({ config, setConfig, models, useCases, isDownloadsActive, bpmWorkflows, relations = [] }: any) {
  const params = useParams()
  const { workspace_slug, project_slug } = params as { workspace_slug: string, project_slug: string }
  const { t } = useI18n()
  const [selectedButtonConfig, setSelectedButtonConfig] = useState<any>(null)
  const [isButtonPropertiesOpen, setIsButtonPropertiesOpen] = useState(false)

  const isButtonDisabledByModel = (btnId: string) => {
    const masterId = config.selected_models?.[0]
    if (!masterId) return false
    const masterModel = models.find((m: any) => m.id === masterId)
    if (!masterModel) return false
    if (btnId === 'add' && masterModel.can_create === false) return true
    if (btnId === 'edit' && masterModel.can_update === false) return true
    if (btnId === 'delete' && masterModel.can_delete === false) return true
    return false
  }


  const strategies = [
    {
      id: 'dynamic',
      title: t('wizard.actions.dynamic_query.title'),
      desc: t('wizard.actions.dynamic_query.desc'),
      icon: Wand2
    },
    {
      id: 'raw',
      title: t('wizard.actions.raw_sql.title'),
      desc: t('wizard.actions.raw_sql.desc'),
      icon: Terminal
    }
  ]


  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="space-y-2">
        <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white">{t('wizard.actions.title')}</h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('wizard.actions.subtitle')}</p>
      </div>

      {config.logic_type !== 'personalizado' && (
        <ButtonsConfig
          config={config}
          setConfig={setConfig}
          isButtonDisabledByModel={isButtonDisabledByModel}
          t={t}
          setSelectedButtonConfig={setSelectedButtonConfig}
          setIsButtonPropertiesOpen={setIsButtonPropertiesOpen}
        />
      )}

      <CustomActionsEditor
        config={config}
        setConfig={setConfig}
        models={models}
        useCases={useCases}
        bpmWorkflows={bpmWorkflows}
        relations={relations}
        t={t}
        isDownloadsActive={isDownloadsActive}
      />
      <div className="space-y-6">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.action_interface_label')}</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { id: 'page', title: t('wizard.actions.interface_options.page_title'), desc: t('wizard.actions.interface_options.page_desc'), icon: Layout },
            { id: 'drawer', title: t('wizard.actions.interface_options.drawer_title'), desc: t('wizard.actions.interface_options.drawer_desc'), icon: Layout },
            { id: 'modal', title: t('wizard.actions.interface_options.modal_title'), desc: t('wizard.actions.interface_options.modal_desc'), icon: Maximize2 }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setConfig({
                ...config,
                layout_config: { ...config.layout_config, action_interface_type: opt.id }
              })}
              className={cn(
                "p-6 rounded-[2rem] border-2 text-left transition-all relative group overflow-hidden",
                (config.layout_config.action_interface_type || 'page') === opt.id
                  ? 'border-indigo-600 bg-indigo-600/5 shadow-xl shadow-indigo-500/10'
                  : 'border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900/30'
              )}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className={cn(
                  "p-3 rounded-2xl transition-all",
                  (config.layout_config.action_interface_type || 'page') === opt.id ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
                )}>
                  <opt.icon className="w-5 h-5" />
                </div>
                {(config.layout_config.action_interface_type || 'page') === opt.id && <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white"><CheckCircle2 className="w-4 h-4" /></div>}
              </div>
              <h4 className="font-bold text-base text-neutral-900 dark:text-white">{opt.title}</h4>
              <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.export_data_title', 'Exportação de Dados')}</label>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              const isExportVisible = config.buttons_config.find((b: any) => b.id === 'export')?.visible !== false;
              setConfig({
                ...config,
                buttons_config: config.buttons_config.map((b: any) =>
                  b.id === 'export' ? { ...b, visible: !isExportVisible } : b
                )
              });
            }}
            className={cn(
              "w-full p-6 rounded-[2rem] border-2 text-left transition-all relative group overflow-hidden flex items-center justify-between",
              (config.buttons_config.find((b: any) => b.id === 'export')?.visible !== false)
                ? 'border-indigo-600 bg-indigo-600/5 shadow-xl shadow-indigo-500/10'
                : 'border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900/30'
            )}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-3 rounded-2xl transition-all",
                (config.buttons_config.find((b: any) => b.id === 'export')?.visible !== false) ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
              )}>
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base text-neutral-900 dark:text-white">{t('wizard.actions.export_data_bg', 'Exportação de Dados (Background)')}</h4>
                <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed">{t('wizard.actions.export_data_desc', 'Permite que os usuários exportem os dados desta tela com processamento assíncrono.')}</p>
              </div>
            </div>
            <div className={cn(
              "w-12 h-6 rounded-full p-1 transition-all relative cursor-pointer flex items-center",
              (config.buttons_config.find((b: any) => b.id === 'export')?.visible !== false) ? 'bg-indigo-600' : 'bg-neutral-300 dark:bg-neutral-700'
            )}>
              <div className={cn(
                "w-4 h-4 bg-white rounded-full transition-all shadow-md transform",
                (config.buttons_config.find((b: any) => b.id === 'export')?.visible !== false) ? 'translate-x-6' : 'translate-x-0'
              )} />
            </div>
          </button>

          {(config.buttons_config.find((b: any) => b.id === 'export')?.visible !== false) && (
            <div className="p-6 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] space-y-4 animate-in slide-in-from-top-4 fade-in duration-300">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.actions.allowed_formats', 'Formatos Permitidos')}</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { id: 'xlsx', label: 'Excel (XLSX)', icon: Table, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20' },
                  { id: 'csv', label: 'CSV', icon: Table, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-500/10', border: 'border-indigo-200 dark:border-indigo-500/20' },
                  { id: 'json', label: 'JSON', icon: Database, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20' },
                  { id: 'pdf', label: 'PDF', icon: Layout, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/20' },
                  { id: 'ofx', label: 'OFX (Finance)', icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20' }
                ].map(fmt => {
                  const isSelected = (config.layout_config.export_formats || ['xlsx', 'csv', 'json']).includes(fmt.id);
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => {
                        const current = config.layout_config.export_formats || ['xlsx', 'csv', 'json'];
                        const next = isSelected ? current.filter((f: string) => f !== fmt.id) : [...current, fmt.id];
                        setConfig({
                          ...config,
                          layout_config: { ...config.layout_config, export_formats: next }
                        });
                      }}
                      className={cn(
                        "p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 text-center",
                        isSelected ? cn(fmt.border, fmt.bg) : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-transparent opacity-50 grayscale"
                      )}
                    >
                      <fmt.icon className={cn("w-5 h-5", isSelected ? fmt.color : "text-neutral-400")} />
                      <span className={cn("text-[9px] font-black uppercase tracking-wider", isSelected ? fmt.color : "text-neutral-500")}>{fmt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-neutral-100 dark:bg-neutral-800/50 w-full"></div>

      <SqlQuerySection
        config={config}
        setConfig={setConfig}
        strategies={strategies}
        t={t}
      />


      {/* Button Properties Modal */}
      <Modal
        isOpen={isButtonPropertiesOpen}
        onClose={() => setIsButtonPropertiesOpen(false)}
        title={`Propriedades do Botão: ${selectedButtonConfig ? (selectedButtonConfig.id === 'search' ? 'Pesquisar' : selectedButtonConfig.id === 'clear' ? 'Limpar' : selectedButtonConfig.id === 'view' ? 'Visualizar' : selectedButtonConfig.id === 'add' ? 'Novo Registro' : selectedButtonConfig.id === 'edit' ? 'Editar' : selectedButtonConfig.id === 'delete' ? 'Excluir' : selectedButtonConfig.label) : ''}`}
        size="md"
      >
        {selectedButtonConfig && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Texto de Exibição</label>
              <input
                type="text"
                value={selectedButtonConfig.custom_label}
                onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, custom_label: e.target.value })}
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                placeholder={t(selectedButtonConfig.labelKey) || selectedButtonConfig.label}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Fonte</label>
                <select
                  value={selectedButtonConfig.font_family}
                  onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, font_family: e.target.value })}
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                >
                  <option value="Inter">Inter (Padrão)</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Outfit">Outfit</option>
                  <option value="JetBrains Mono">Mono (JetBrains)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Tamanho</label>
                <input
                  type="text"
                  value={selectedButtonConfig.font_size}
                  onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, font_size: e.target.value })}
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                  placeholder="Ex: 10px"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Transformação do Texto</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'none', label: 'Normal', example: 'Aa' },
                  { value: 'uppercase', label: 'UPPER', example: 'AA' },
                  { value: 'capitalize', label: 'Iniciais', example: 'Aa' },
                  { value: 'lowercase', label: 'lower', example: 'aa' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedButtonConfig({ ...selectedButtonConfig, text_transform: opt.value })}
                    className={cn(
                      "flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all",
                      (selectedButtonConfig.text_transform || 'capitalize') === opt.value
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600"
                        : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:border-indigo-300"
                    )}
                  >
                    <span
                      className="text-base font-black"
                      style={{ textTransform: opt.value as any, fontStyle: opt.value === 'none' ? 'italic' : 'normal' }}
                    >
                      {opt.example}
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-wider">{opt.label}</span>
                  </button>
                ))}
              </div>
              {/* Live preview */}
              <div className="mt-3 flex items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                <span
                  className="text-sm font-bold text-neutral-700 dark:text-neutral-300"
                  style={{
                    textTransform: ((selectedButtonConfig.text_transform || 'capitalize') !== 'none' ? selectedButtonConfig.text_transform : undefined) as any,
                    fontFamily: (selectedButtonConfig.font_family && selectedButtonConfig.font_family !== 'Inter (Padrão)') ? selectedButtonConfig.font_family : undefined,
                    fontSize: selectedButtonConfig.font_size || undefined,
                    color: selectedButtonConfig.text_color || undefined,
                    backgroundColor: selectedButtonConfig.bg_color || undefined,
                  }}
                >
                  {selectedButtonConfig.custom_label || 'Preview do Botão'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Cor do Texto</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={selectedButtonConfig.text_color || '#ffffff'}
                  onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, text_color: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border-none p-0 shrink-0"
                />
                <input
                  type="text"
                  value={selectedButtonConfig.text_color}
                  onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, text_color: e.target.value })}
                  placeholder="Hexadecimal da cor do texto (ex: #ffffff)"
                  className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-xs font-mono font-bold outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Cor do Botão (Fundo)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={selectedButtonConfig.bg_color || '#6366f1'}
                  onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, bg_color: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border-none p-0 shrink-0"
                />
                <input
                  type="text"
                  value={selectedButtonConfig.bg_color}
                  onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, bg_color: e.target.value })}
                  placeholder="Hexadecimal da cor de fundo (ex: #6366f1)"
                  className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-xs font-mono font-bold outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-neutral-100 dark:border-neutral-800 mt-6">
              <button
                type="button"
                onClick={() => setIsButtonPropertiesOpen(false)}
                className="flex-1 px-4 py-3 bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 rounded-2xl font-black text-[10px] capitalize tracking-wider hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfig({
                    ...config,
                    buttons_config: config.buttons_config.map((b: any) =>
                      b.id === selectedButtonConfig.id ? selectedButtonConfig : b
                    )
                  });
                  setIsButtonPropertiesOpen(false);
                }}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] capitalize tracking-wider hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </Modal>



    </div>
  )
}

function DraggableFieldCard({ field }: { field: any }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `source-${field.id}`,
    data: { fieldId: field.id }
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "py-2.5 px-4 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl flex items-center justify-between group cursor-grab active:cursor-grabbing hover:border-indigo-200 dark:hover:border-indigo-800/50 hover:shadow-md transition-all",
        isDragging && "opacity-20 grayscale"
      )}
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200">{field.display_name || field.db_column_name}</span>
        <span className="text-[8px] font-black font-mono text-neutral-400 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded-md opacity-60 uppercase">{field.data_type}</span>
      </div>
    </div>
  )
}

function DroppableZone({ id, children, className }: any) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        "transition-all duration-300 relative",
        isOver && "bg-indigo-100/50 dark:bg-indigo-900/30 border-indigo-500 border-solid scale-[1.02] shadow-[0_0_40px_rgba(99,102,241,0.15)] ring-4 ring-indigo-500/10"
      )}
    >
      {isOver && (
        <div className="absolute inset-0 bg-indigo-500/5 pointer-events-none rounded-[inherit] animate-pulse"></div>
      )}
      {children}
    </div>
  )
}

function DraggableTableHeader({ model, isCollapsed, onToggle }: any) {
  const { t } = useI18n()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `table-source-${model.id}`,
    data: { tableId: model.id, isTable: true }
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Se estiver arrastando, não ativa o toggle
        if (isDragging) return;
        onToggle();
      }}
      className={cn(
        "sticky top-0 z-20 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-5 py-4 flex items-center justify-between cursor-pointer group/header border-b border-neutral-100 dark:border-neutral-800/50 shadow-sm transition-all",
        isDragging && "opacity-20 grayscale"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-4 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
        <div className="flex flex-col">
          <span className="text-[11px] font-black text-neutral-900 dark:text-white uppercase tracking-[0.15em]">{model.display_name || model.db_table_name}</span>
          <span className="text-[8px] font-bold text-indigo-500/0 group-hover:text-indigo-500 transition-all uppercase tracking-widest leading-none mt-1">{t('wizard.layout.drag_to_add_all', 'Arraste para add tudo')}</span>
        </div>
      </div>
      <div className="p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover/header:text-indigo-500 group-hover/header:bg-indigo-50 dark:group-hover/header:bg-indigo-500/10 transition-all">
        {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </div>
    </div>
  )
}





