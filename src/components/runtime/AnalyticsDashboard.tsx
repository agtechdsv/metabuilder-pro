'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area, LabelList
} from 'recharts'
import { 
  TrendingUp, Users, DollarSign, Activity, Loader2, 
  AlertCircle, ChevronDown, Plus, Pencil, Trash2, Maximize2, Minimize2, ZoomIn, LayoutGrid, Grid3x3, Gauge,
  GripVertical, MousePointer2, Save, Search, BarChart3, X, Filter, CornerUpLeft, Table2, RefreshCw
} from 'lucide-react'
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'

// O esquema do widget é único e vive em lib/bi/widget.ts (painel, Studio e app exportado usam o mesmo)
type Widget = RuntimeBiWidget

interface AnalyticsDashboardProps {
  config: {
    widgets: Widget[]
    groups?: BiGroup[]
    allow_runtime_edit?: boolean
    // Fase 5
    rls?: RlsRule[]
    cache_seconds?: number
    refresh_seconds?: number
    timeout_seconds?: number
  }
  project: any
  joins?: any[]
  filters?: Record<string, string>
  onEditWidget?: (widget: Widget) => void
  onAddWidget?: () => void
  onDeleteWidget?: (id: string) => void
  onSaveLayout?: (newWidgets: Widget[], newGroups?: BiGroup[]) => void
  tunnelChannel?: any
  isTunnelReady?: boolean
  projectRelations?: any[]
}

import { compileFormula } from '@/lib/bi/safeFormula'
import { formatBiValue, biPrimaryColor } from '@/lib/bi/format'
import { PERIOD_PRESETS, resolvePeriod, resolveWidgetPeriod, effectivePeriodMode, formatPeriodDay, previousRange, type PeriodRange } from '@/lib/bi/period'
import { planWidgetQuery } from '@/lib/bi/widgetPlan'
import { shapeAggRows, prevValueFromRows } from '@/lib/bi/shapeResult'
import { SCALE_PRESETS, presetOf, spanFor, widthOfSpan, type ScaleKey } from '@/lib/bi/scaleLayout'
import { crossConditionsFor, makeCrossFilter, toggleCrossFilter, drillInto, drillTarget, applyDrill, bucketConditions, type CrossFilter, type DrillLevel, type GroupInfo } from '@/lib/bi/interaction'
import { planRecordsQuery } from '@/lib/bi/recordsPlan'
import { cleanRlsRules, rlsAccess, withAccess, type AccessResult, type BiViewer, type RlsRule } from '@/lib/bi/access'
import { perfSettings, QueryCache } from '@/lib/bi/perf'
import type { RuntimeBiWidget } from '@/lib/bi/widget'
import { sectionsOf, moveWidget, moveGroup as moveGroupInList, renameGroup as renameGroupInList, removeGroup as removeGroupFromList, groupLabel, type BiGroup } from '@/lib/bi/groups'

const BI_ROW_LIMIT = 1000
// cache dos resultados no navegador (a chave é o SQL, que já traz período, filtros e a regra de acesso)
const panelCache = new QueryCache<{ data: any[]; at: number }>(200)
const NO_ACCESS: AccessResult = { conditions: [] }

/** Linha do usuário final logado, guardada no cookie client_session_<projeto> pelo login do portal. */
function readViewer(projectId: string | undefined): BiViewer | null {
  if (!projectId || typeof document === 'undefined') return null
  try {
    const name = `client_session_${projectId}`
    const row = document.cookie.split('; ').find(r => r.trim().startsWith(`${name}=`))
    if (!row) return null
    const user = JSON.parse(decodeURIComponent(row.trim().substring(name.length + 1)))
    if (!user || typeof user !== 'object') return null
    const pick = (...keys: string[]) => { for (const k of keys) if (user[k] !== undefined && user[k] !== null && String(user[k]).trim() !== '') return String(user[k]); return null }
    return { email: pick('email', 'EMAIL', 'e_mail', 'E_MAIL'), name: pick('__display_name', 'nome', 'NOME', 'name', 'NAME'), attrs: user }
  } catch {
    return null
  }
}
const BI_MAX_GROUPS = 2000
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4']

/**
 * Moldura arrastável de cada widget. Fica FORA de AnalyticsDashboard de propósito: um componente declarado dentro do
 * outro ganha identidade nova a cada render, e o React desmontava e remontava todos os cards a cada mudança de estado
 * (todos os widgets recarregavam e a página voltava ao topo ao trocar um período).
 */
// Classes por número de colunas (de 12) e por tamanho da escala. Ficam escritas por extenso para o Tailwind gerá-las.
const COL_CLASS: Record<number, string> = {
  2: 'col-span-12 sm:col-span-6 lg:col-span-2',
  3: 'col-span-12 sm:col-span-6 lg:col-span-3',
  4: 'col-span-12 md:col-span-4',
  6: 'col-span-12 md:col-span-6',
  12: 'col-span-12',
}
const CARD_BOX: Record<ScaleKey, { compact: string; full: string; pad: string; gap: string }> = {
  small: { compact: 'min-h-[110px]', full: 'min-h-[210px]', pad: 'p-3', gap: 'gap-3' },
  medium: { compact: 'min-h-[145px]', full: 'min-h-[280px]', pad: 'p-4', gap: 'gap-5' },
  normal: { compact: 'min-h-[180px]', full: 'min-h-[350px]', pad: 'p-6', gap: 'gap-8' },
  large: { compact: 'min-h-[220px]', full: 'min-h-[400px]', pad: 'p-6', gap: 'gap-8' },
  xl: { compact: 'min-h-[260px]', full: 'min-h-[460px]', pad: 'p-8', gap: 'gap-8' },
}

function SortableCard({ id, widthClass, compact, box, renderHeader, children }: {
  box: { compact: string; full: string; pad: string }
  id: string
  widthClass: string
  /** KPI de valor único: não precisa dos 350 px de altura mínima */
  compact?: boolean
  renderHeader: (drag: { attributes: any; listeners: any }) => React.ReactNode
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 'auto', opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className={cn("group bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] flex flex-col transition-all hover:shadow-2xl hover:shadow-indigo-500/5 hover:-translate-y-1 relative overflow-hidden", box.pad, compact ? box.compact : box.full, widthClass)}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-all" />
      {renderHeader({ attributes, listeners })}
      <div className="flex-1 flex flex-col relative z-10">{children}</div>
    </div>
  )
}

export default function AnalyticsDashboard({ 
  config, 
  project, 
  joins = [], 
  filters = {}, 
  onEditWidget, 
  onAddWidget, 
  onDeleteWidget,
  onSaveLayout,
  tunnelChannel,
  isTunnelReady,
  projectRelations = []
}: AnalyticsDashboardProps) {
  const [data, setData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  // widgets cuja consulta atingiu o limite de linhas: os totais podem estar incompletos
  const [truncated, setTruncated] = useState<Record<string, boolean>>({})
  // dados em colunas por série (2ª dimensão): { rows: [{ name, <serie>: valor }], keys: [serie...] }
  const [seriesData, setSeriesData] = useState<Record<string, { rows: any[]; keys: string[] }>>({})
  // período do painel: aplicado aos widgets que têm "campo de data do período"
  const [period, setPeriod] = useState<{ preset: string; from: string; to: string }>({ preset: 'all', from: '', to: '' })
  // valor do período anterior dos KPIs com comparação
  const [prevData, setPrevData] = useState<Record<string, number>>({})
  const [expandedGaugeId, setExpandedGaugeId] = useState<string | null>(null)
  const [expandedWidgetId, setExpandedWidgetId] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  // agrupamentos recolhidos (só nesta sessão da tela)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [localWidgets, setLocalWidgets] = useState(config.widgets || [])
  const [localGroups, setLocalGroups] = useState<BiGroup[]>(config.groups || [])

  // Sincroniza widgets locais quando a config mudar (ex: após load inicial)
  useEffect(() => {
    if (config.widgets) {
      setLocalWidgets(config.widgets)
    }
  }, [config.widgets])
  useEffect(() => {
    setLocalGroups(config.groups || [])
  }, [config.groups])
  
  const { t, language } = useI18n()

  // ── Fase 5: acesso por linha, cache, atualização automática e tempo limite ───
  const perf = useMemo(() => perfSettings(config), [config.cache_seconds, config.refresh_seconds, config.timeout_seconds])
  const rlsRules = useMemo(() => cleanRlsRules(config.rls), [config.rls])
  // o usuário final vem do cookie do portal; só depois de lido (ready) as consultas saem, para nunca irem sem a regra
  const [viewerState, setViewerState] = useState<{ ready: boolean; viewer: BiViewer | null }>({ ready: false, viewer: null })
  useEffect(() => { setViewerState({ ready: true, viewer: readViewer(project?.id) }) }, [project?.id])
  const access = useMemo<AccessResult>(
    () => (rlsRules.length > 0 && viewerState.viewer ? rlsAccess(rlsRules, viewerState.viewer) : NO_ACCESS),
    [rlsRules, viewerState.viewer],
  )
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const deniedMessage = (d: NonNullable<AccessResult['denied']>) =>
    d.code === 'no_viewer' ? t('runtime.bi_denied_no_viewer') : t('runtime.bi_denied_missing').replace('{detail}', d.detail)

  // Escala do painel: não é só zoom, muda a densidade (cards por linha, altura, gráficos); veja lib/bi/scaleLayout
  const [scaleKey, setScaleKey] = useState<ScaleKey>('normal')
  const preset = presetOf(scaleKey)
  const box = CARD_BOX[scaleKey]
  const scaleIcons: Record<ScaleKey, React.ReactNode> = {
    small: <Minimize2 className="w-3.5 h-3.5" />,
    medium: <Grid3x3 className="w-3.5 h-3.5" />,
    normal: <LayoutGrid className="w-3.5 h-3.5" />,
    large: <Maximize2 className="w-3.5 h-3.5" />,
    xl: <ZoomIn className="w-3.5 h-3.5" />,
  }
  const scales = SCALE_PRESETS.map(pr => ({
    key: pr.key,
    icon: scaleIcons[pr.key],
    label: t('runtime.scale_' + pr.key, pr.label),
  }))

  // Tooltips do recharts usam estilo inline: acompanham o tema escuro por estado
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const read = () => setIsDark(document.documentElement.classList.contains('dark'))
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const periodRange = useMemo(() => resolvePeriod(period.preset, { from: period.from, to: period.to }), [period])
  // seletor próprio dos widgets em modo "own": { widgetId: { preset, from, to } }
  const [ownPeriods, setOwnPeriods] = useState<Record<string, { preset: string; from: string; to: string }>>({})
  // período efetivo de um widget: da barra do painel, fixo ou do seletor do próprio card
  // barra de período de cada grupo: { groupId: { preset, from, to } }
  const [groupPeriods, setGroupPeriods] = useState<Record<string, { preset: string; from: string; to: string }>>({})
  const groupIds = localGroups.map(g => g.id)
  const effectiveMode = (w: Widget) => effectivePeriodMode(w, groupIds)
  const widgetPeriod = (w: Widget): PeriodRange | null =>
    resolveWidgetPeriod(w, { panel: periodRange, groupIds, groupPeriods, ownPeriods })
  // a barra do painel só vale para widgets em modo "segue o painel"
  const followsPanel = (w: Widget) => !!w.period_field && effectiveMode(w) === 'panel'
  const hasPeriodWidgets = localWidgets.some(followsPanel)
  const periodWidgetCount = localWidgets.filter(followsPanel).length
  const fmtDay = formatPeriodDay

  // ── Fase 4: filtro cruzado e drill-down ──────────────────────────────────────
  const [crossFilters, setCrossFilters] = useState<Record<string, CrossFilter>>({})
  const [drillStacks, setDrillStacks] = useState<Record<string, DrillLevel[]>>({})
  // como cada gráfico está agrupado agora (vem do planejador): o campo a filtrar quando alguém clica
  const [groupInfo, setGroupInfo] = useState<Record<string, GroupInfo | undefined>>({})
  // widgets que não têm relação com o filtro cruzado ativo (o filtro é ignorado neles)
  const [crossIgnored, setCrossIgnored] = useState<Record<string, boolean>>({})
  const [pointMenu, setPointMenu] = useState<{ x: number; y: number; name: string; actions: { key: string; label: string; run: () => void }[] } | null>(null)
  const [recordsView, setRecordsView] = useState<{ title: string; label: string; rows: any[] | null; error: string | null } | null>(null)
  const recordsQueryId = useRef<string | null>(null)
  const crossList = Object.values(crossFilters)
  // widget como deve ser consultado: caminho de drill aberto e, por cima, os filtros cruzados que ele responde
  const drilled = (w: Widget): Widget => withAccess(applyDrill(w, drillStacks[w.id] || []) as Widget, access)
  const withCross = (w: Widget): Widget => {
    const extra = crossConditionsFor(w, crossList)
    return extra.length ? { ...w, conditions: [...(w.conditions || []), ...extra] } : w
  }
  const hasCrossTargets = localWidgets.some(w => w.cross_target)
  const canInteract = (w: Widget) =>
    !!w.group_by && ((!!w.cross_source && hasCrossTargets) || !!w.drill_detail || !!w.drill_records)

  const biLocale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR'
  const fmt = (val: any, widget: Widget, axis = false) =>
    formatBiValue(val, { format: widget.format, decimals: widget.decimals, currency: widget.currency, locale: biLocale }, axis)
  const tooltipStyle = {
    borderRadius: '12px',
    border: 'none',
    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
    background: isDark ? '#18181b' : '#ffffff',
    color: isDark ? '#fafafa' : '#171717',
  }

  const formatNumber = (val: any) => {
    if (val === null || val === undefined) return ''
    const num = Number(val)
    if (isNaN(num)) return String(val)
    const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR'
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(num)
  }

  // Mapeia IDs de widgets para evitar loops de refresh infinitos
  const lastQueryIds = useRef<Record<string, string>>({})
  // consulta do período anterior (comparação do KPI): uma por widget
  const prevQueryIds = useRef<Record<string, string>>({})
  // assinatura (config + filtros + período) da última busca de cada widget: evita recarregar o que não mudou
  const fetchedSig = useRef<Record<string, string>>({})
  // 'agg' = SQL já agregado no banco; 'raw' = linhas cruas agregadas aqui (caminho antigo, usado como reserva)
  const queryModes = useRef<Record<string, 'agg' | 'raw' | 'prev'>>({})
  // consultas esperando resposta, relógio do tempo limite de cada uma e chave de cache a gravar quando chegar o resultado
  const pendingQueries = useRef<Set<string>>(new Set())
  const queryTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const cacheKeys = useRef<Record<string, { key: string; ttl: number }>>({})
  // "atualizar" ignora o cache nesta rodada de consultas
  const forceFresh = useRef(false)
  const handleSqlResultRef = useRef<((payload: any) => void) | null>(null)
  useEffect(() => () => { Object.values(queryTimers.current).forEach(clearTimeout) }, [])
  // sempre aponta para a versão mais recente de fetchWidgetData (o listener do canal guarda uma versão antiga)
  const fetchWidgetDataRef = useRef<((widget: Widget, opts?: { legacy?: boolean; reason?: string }) => Promise<void>) | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Arrastar reordena dentro do próprio agrupamento (para mudar um widget de grupo, use o Studio ou o campo "Grupo" do editor)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setLocalWidgets((items) => {
      const a = items.find((i) => i.id === active.id)
      const o = items.find((i) => i.id === over.id)
      if (!a || !o || (a.group_id || '') !== (o.group_id || '')) return items
      const section = sectionsOf(items, localGroups).find(sec => (sec.group?.id ?? '') === (a.group_id || ''))
      const toIndex = section ? section.widgets.findIndex(w => w.id === o.id) : -1
      return toIndex < 0 ? items : moveWidget(items, localGroups, a.id, a.group_id || null, toIndex)
    })
  }

  // Refs para evitar re-subscrições desnecessárias
  const widgetsRef = useRef<Widget[]>([])
  useEffect(() => {
    widgetsRef.current = localWidgets.map(w => withCross(drilled(w)))
  }, [localWidgets, crossFilters, drillStacks, access])

  // Listener centralizado (SQL_RESULT) usando o canal do PAI
  useEffect(() => {
    if (!tunnelChannel || !isTunnelReady) return
    

    const handleSqlResult = (payload: any) => {
      const qId = payload.payload?.queryId
      if (!qId) return

      // chegou a resposta: encerra o relógio do tempo limite e guarda o resultado em cache
      pendingQueries.current.delete(qId)
      clearTimeout(queryTimers.current[qId])
      delete queryTimers.current[qId]
      const ck = cacheKeys.current[qId]
      if (ck) {
        delete cacheKeys.current[qId]
        if (payload.payload.success && !payload.payload.__cached) panelCache.set(ck.key, { data: payload.payload.data, at: Date.now() }, ck.ttl)
      }
      if (payload.payload.success && queryModes.current[qId] !== undefined) setLastUpdated(payload.payload.__at || Date.now())

      // lista de registros do drill ("ver registros")
      if (recordsQueryId.current && qId === recordsQueryId.current) {
        recordsQueryId.current = null
        setRecordsView(prev => prev
          ? (payload.payload.success
              ? { ...prev, rows: payload.payload.data || [], error: null }
              : { ...prev, rows: null, error: payload.payload.error || t('runtime.bi_records_error') })
          : prev)
        return
      }

      const prevWidgetId = Object.keys(prevQueryIds.current).find(id => prevQueryIds.current[id] === qId)
      if (prevWidgetId) {
        delete queryModes.current[qId]
        if (payload.payload.success) {
          setPrevData(prev => ({ ...prev, [prevWidgetId]: prevValueFromRows(payload.payload.data) }))
        }
        return
      }

      const widgetId = Object.keys(lastQueryIds.current).find(id => lastQueryIds.current[id] === qId)
      if (!widgetId) return

      const widget = widgetsRef.current.find(w => w.id === widgetId)
      if (!widget) return

      const queryMode = queryModes.current[qId]
      delete queryModes.current[qId]
      // resposta que chegou depois do "tempo esgotado" ainda vale: troca o erro pelos dados
      if (payload.payload.success) setErrors(prev => (prev[widget.id] ? { ...prev, [widget.id]: '' } : prev))
      if (queryMode === 'agg') {
        if (payload.payload.success) {
          processAggRows(widget, payload.payload.data)
        } else {
          // o SQL agregado falhou (dialeto, tipo de coluna...): refaz pelo caminho antigo, com linhas cruas
          console.warn('[BI] consulta agregada falhou, usando o caminho alternativo:', payload.payload.error)
          fetchWidgetDataRef.current?.(widget, { legacy: true, reason: payload.payload.error })
          return
        }
        setLoading(prev => ({ ...prev, [widget.id]: false }))
        return
      }

      if (payload.payload.success) {
        const records = payload.payload.data
        setTruncated(prev => ({ ...prev, [widget.id]: Array.isArray(records) && records.length >= BI_ROW_LIMIT }))
        const model = (project as any).models?.find((m: any) => String(m.id) === String(widget.model_id))
        const tableName = model?.db_table_name || (typeof widget.model_id === 'string' && widget.model_id !== 'undefined' && !widget.model_id.includes('-') ? widget.model_id : null)
        const isFormula = (widget as any).use_formula || (widget.field?.includes('*') || widget.field?.includes('+') || widget.field?.includes('/') || widget.field?.includes('-'))
        const formula = widget.field || '*'
        
        processWidgetData(widget, records, isFormula, formula, tableName)
      } else {
        setErrors(prev => ({ ...prev, [widget.id]: payload.payload.error || t('runtime.bi_fetch_error') }))
      }
      setLoading(prev => ({ ...prev, [widget.id]: false }))
    }

    tunnelChannel.on('broadcast', { event: 'sql_result' }, handleSqlResult)
    handleSqlResultRef.current = handleSqlResult

    return () => {
      const bindings = tunnelChannel.bindings?.broadcast
      if (Array.isArray(bindings)) {
        const binding = bindings.find((b: any) => b.callback === handleSqlResult)
        if (binding) {
          if (tunnelChannel.channelAdapter) {
            tunnelChannel.channelAdapter.off('broadcast', binding.ref)
          }
          tunnelChannel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleSqlResult)
        }
      }
    }

    // O pai cuida da subscrição, nós só ouvimos.
  }, [tunnelChannel, isTunnelReady])

  useEffect(() => {
    if (!isTunnelReady) { fetchedSig.current = {}; return }
    // espera ler o usuário logado: a consulta nunca sai sem a regra de acesso dele
    if (!viewerState.ready) return
    if (localWidgets.length === 0) return

    // sem usuário ou sem o dado que a regra exige: nada é consultado
    if (access.denied) {
      const msg = deniedMessage(access.denied)
      setErrors(Object.fromEntries(localWidgets.map(w => [w.id, msg])))
      setLoading({})
      return
    }

    const handler = setTimeout(() => {
      localWidgets.forEach(widget => {
        // Só busca de novo o que mudou para este widget: configuração, filtros da tela, período, caminho de drill
        // e filtros cruzados que ele responde. Antes, trocar o período recarregava todos os widgets do painel.
        const base = drilled(widget)
        const full = withCross(base)
        const sig = JSON.stringify({ w: full, f: filters, p: widgetPeriod(widget) })
        if (fetchedSig.current[widget.id] === sig) return
        fetchedSig.current[widget.id] = sig
        fetchWidgetData(full, full !== base ? { fallback: base } : {})
      })
    }, 400) // Debounce de 400ms para evitar chamadas excessivas durante a digitação

    return () => clearTimeout(handler)
  }, [isTunnelReady, viewerState.ready, access, localWidgets, localGroups, filters, periodRange, ownPeriods, groupPeriods, crossFilters, drillStacks])

  const fetchWidgetData = async (widget: Widget, opts: { legacy?: boolean; reason?: string; fallback?: Widget } = {}) => {
    if (!tunnelChannel || !isTunnelReady) {
      return
    }

    // "atualizar" pede dados novos: ignora o cache só nesta rodada
    const fresh = forceFresh.current
    const queryId = crypto.randomUUID()
    // Registra este queryId como o último enviado por este widget
    lastQueryIds.current[widget.id] = queryId

    setLoading(prev => ({ ...prev, [widget.id]: true }))
    setErrors(prev => ({ ...prev, [widget.id]: '' }))

    // O Agente CLI só executa PostgreSQL e Oracle; para outro banco o planejador cai nas linhas cruas
    const dbType = (project?.db_type || 'postgres').toLowerCase()
    const dialect: 'postgres' | 'oracle' | null = dbType === 'oracle' ? 'oracle' : (dbType === 'postgres' || dbType === 'postgresql') ? 'postgres' : null

    // Toda a lógica de tabelas, JOINs mínimos, filtros e recursos do widget está no planejador (lib/bi/widgetPlan),
    // que também roda no app exportado. Aqui só se envia o que ele decidiu.
    const buildPlan = (w: Widget) => planWidgetQuery({
      widget: w,
      models: (project as any).models || [],
      relations: projectRelations,
      dialect,
      layoutJoins: joins,
      screenFilters: filters,
      period: widgetPeriod(widget),
      legacy: opts.legacy,
      failureReason: opts.reason,
      projectSlug: (project as any)?.slug,
      rawRowLimit: BI_ROW_LIMIT,
      maxGroups: BI_MAX_GROUPS,
    })
    let plan = buildPlan(widget)
    // filtro cruzado de uma tabela sem relação com este widget: ignora o filtro e avisa no card
    let ignoredCross = false
    if (plan.kind === 'error' && opts.fallback) {
      plan = buildPlan(opts.fallback)
      ignoredCross = true
    }
    setCrossIgnored(prev => (!!prev[widget.id] === ignoredCross ? prev : { ...prev, [widget.id]: ignoredCross }))
    setGroupInfo(prev => (JSON.stringify(prev[widget.id]) === JSON.stringify(plan.group) ? prev : { ...prev, [widget.id]: plan.group }))
    plan.warnings.forEach(w => console.warn(w))

    delete prevQueryIds.current[widget.id]
    if (!plan.compare) setPrevData(prev => { if (!(widget.id in prev)) return prev; const next = { ...prev }; delete next[widget.id]; return next })

    if (plan.kind === 'error' || !plan.sql) {
      // a regra de acesso não coube neste indicador (ex.: tabela sem relação): nunca mostra sem o filtro
      const reason = plan.message || 'Não foi possível montar a consulta'
      setErrors(prev => ({ ...prev, [widget.id]: access.conditions.length > 0 && plan.kind === 'error' ? t('runtime.bi_access_unfilterable').replace('{reason}', reason) : reason }))
      setLoading(prev => ({ ...prev, [widget.id]: false }))
      return
    }

    const sendQuery = (sql: string, mode: 'agg' | 'raw' | 'prev', limit: number, qid: string = queryId) => {
      queryModes.current[qid] = mode
      const ttl = perf.cacheSeconds * 1000
      const cacheKey = `${project.id}|${sql}`
      // cache: a mesma consulta feita há pouco reaproveita o resultado (o botão de atualizar ignora)
      if (!fresh && ttl > 0) {
        const hit = panelCache.get(cacheKey)
        if (hit) {
          setTimeout(() => handleSqlResultRef.current?.({ payload: { queryId: qid, success: true, data: hit.data, __cached: true, __at: hit.at } }), 0)
          return
        }
      }
      if (ttl > 0) cacheKeys.current[qid] = { key: cacheKey, ttl }
      // tempo limite: se o banco não responder, o indicador avisa e oferece tentar de novo
      pendingQueries.current.add(qid)
      if (mode !== 'prev') {
        queryTimers.current[qid] = setTimeout(() => {
          if (!pendingQueries.current.has(qid)) return
          pendingQueries.current.delete(qid)
          setErrors(prev => ({ ...prev, [widget.id]: t('runtime.bi_timeout') }))
          setLoading(prev => ({ ...prev, [widget.id]: false }))
        }, perf.timeoutSeconds * 1000)
      }
      // Pequeno delay para garantir que o canal esteja pronto
      setTimeout(() => {
        if (!tunnelChannel || !isTunnelReady) return

        tunnelChannel.send({
          type: 'broadcast',
          event: 'sql_query',
          payload: {
            queryId: qid,
            action: 'select',
            query: sql, // ← 'query' é o campo lido pelo CLI
            sql,        // ← mantido por compatibilidade
            schemaName: plan.schemaName, // ← campo obrigatório: identifica o schema para o CLI não ignorar
            table: plan.tableName,
            limit,      // ← o CLI só reconhece o limite se vier aqui ou como LIMIT/FETCH NEXT no SQL
            // 'filters' não é enviado: o WHERE já está no SQL e o CLI o acrescentaria de novo depois do LIMIT
            token: project?.secret_token || '',
            projectId: project.id
          }
        })
      }, 500)
    }

    sendQuery(plan.sql, plan.kind === 'agg' ? 'agg' : 'raw', plan.limit ?? BI_ROW_LIMIT)
    // KPI com comparação: segunda consulta, igual à primeira mas no período anterior
    if (plan.kind === 'agg' && plan.prev) {
      const prevId = crypto.randomUUID()
      prevQueryIds.current[widget.id] = prevId
      sendQuery(plan.prev.sql, 'prev', plan.prev.limit, prevId)
    }
  }

  fetchWidgetDataRef.current = fetchWidgetData

  // Busca um widget agora (com o drill e os filtros cruzados atuais)
  const runFetch = (widget: Widget) => {
    const base = drilled(widget)
    const full = withCross(base)
    fetchedSig.current[widget.id] = JSON.stringify({ w: full, f: filters, p: widgetPeriod(widget) })
    fetchWidgetData(full, full !== base ? { fallback: base } : {})
  }
  // Atualizar: refaz todos os indicadores ignorando o cache
  const refreshAll = () => {
    if (!isTunnelReady || !viewerState.ready || access.denied) return
    forceFresh.current = true
    try { localWidgets.forEach(runFetch) } finally { forceFresh.current = false }
  }
  const refreshAllRef = useRef(refreshAll)
  refreshAllRef.current = refreshAll
  // atualização automática: só enquanto a aba está visível
  useEffect(() => {
    if (!perf.refreshSeconds || !isTunnelReady) return
    const id = setInterval(() => { if (document.visibilityState === 'visible') refreshAllRef.current() }, perf.refreshSeconds * 1000)
    return () => clearInterval(id)
  }, [perf.refreshSeconds, isTunnelReady])

  // Clique numa barra/fatia: oferece filtrar os outros gráficos, detalhar o próximo nível e/ou ver os registros
  const onPoint = (widget: Widget, name: string, ev?: any) => {
    const group = groupInfo[widget.id]
    const stack = drillStacks[widget.id] || []
    const actions: { key: string; label: string; run: () => void }[] = []

    if (widget.cross_source && hasCrossTargets && group) {
      const cf = makeCrossFilter(widget, group, name)
      if (cf) {
        const active = crossFilters[widget.id]?.name === name
        actions.push({
          key: 'cross',
          label: active ? t('runtime.bi_cross_clear') : t('runtime.bi_cross_by').replace('{name}', name),
          run: () => setCrossFilters(prev => toggleCrossFilter(prev, cf)),
        })
      }
    }
    if (widget.drill_detail) {
      const level = drillInto(widget, stack, group, name)
      if (level) {
        actions.push({
          key: 'drill',
          label: t('runtime.bi_drill').replace('{name}', name),
          run: () => setDrillStacks(prev => ({ ...prev, [widget.id]: [...(prev[widget.id] || []), level] })),
        })
      }
    }
    if (widget.drill_records && group) {
      actions.push({ key: 'records', label: t('runtime.bi_records').replace('{name}', name), run: () => openRecords(widget, name) })
    }

    if (actions.length === 0) return
    if (actions.length === 1) { actions[0].run(); return }
    const x = Math.min(Number(ev?.clientX ?? window.innerWidth / 2), window.innerWidth - 280)
    const y = Math.min(Number(ev?.clientY ?? window.innerHeight / 2), window.innerHeight - (actions.length * 44 + 24))
    setPointMenu({ x: Math.max(8, x), y: Math.max(8, y), name, actions })
  }

  // Quem foi clicado, a partir do estado que o recharts entrega no onClick do gráfico
  const chartClick = (widget: Widget, data: any[]) => (state: any, ev: any) => {
    const i = Number(state?.activeTooltipIndex ?? state?.activeIndex)
    const name = Number.isInteger(i) && data[i] ? String(data[i].name) : state?.activeLabel !== undefined ? String(state.activeLabel) : null
    if (name !== null) onPoint(widget, name, ev)
  }
  const clickStyle = (widget: Widget) => (canInteract(widget) ? { cursor: 'pointer' } : undefined)
  // esmaece as barras/fatias que não são o valor filtrado
  const dimOf = (widget: Widget, name: any) => {
    const sel = crossFilters[widget.id]
    return sel && sel.name !== String(name) ? 0.3 : 1
  }

  const openRecords = (widget: Widget, name: string) => {
    if (!tunnelChannel || !isTunnelReady) return
    const group = groupInfo[widget.id]
    const base = drilled(widget)
    const ew: Widget = withCross({ ...base, conditions: [...(base.conditions || []), ...(group ? bucketConditions(group, name) : [])] })
    const dbType = (project?.db_type || 'postgres').toLowerCase()
    const dialect: 'postgres' | 'oracle' | null = dbType === 'oracle' ? 'oracle' : (dbType === 'postgres' || dbType === 'postgresql') ? 'postgres' : null
    const plan = planRecordsQuery({
      widget: ew,
      models: (project as any).models || [],
      relations: projectRelations,
      dialect,
      period: widgetPeriod(widget),
      screenFilters: filters,
      projectSlug: (project as any)?.slug,
      limit: 200,
    })
    const title = widget.title || 'Registros'
    if (plan.kind === 'error' || !plan.sql) {
      setRecordsView({ title, label: name, rows: null, error: plan.message || 'Não foi possível montar a consulta' })
      return
    }
    const qid = crypto.randomUUID()
    recordsQueryId.current = qid
    setRecordsView({ title, label: name, rows: null, error: null })
    tunnelChannel.send({
      type: 'broadcast',
      event: 'sql_query',
      payload: {
        queryId: qid, action: 'select', query: plan.sql, sql: plan.sql,
        schemaName: plan.schemaName, table: plan.tableName, limit: plan.limit,
        token: project?.secret_token || '', projectId: project.id,
      },
    })
  }

  // Resultado do SQL agregado: já vem pronto como { bi_name, bi_value }; a montagem dos dados é a mesma do app exportado (lib/bi/shapeResult)
  const processAggRows = (widget: Widget, rows: any[]) => {
    const shaped = shapeAggRows(widget, rows, BI_MAX_GROUPS)
    if (shaped.series) {
      setSeriesData(prev => ({ ...prev, [widget.id]: shaped.series! }))
    } else {
      setSeriesData(prev => { if (!prev[widget.id]) return prev; const next = { ...prev }; delete next[widget.id]; return next })
    }
    setData(prev => ({ ...prev, [widget.id]: shaped.data }))
    setTruncated(prev => ({ ...prev, [widget.id]: shaped.truncated }))
  }

  const processWidgetData = (widget: Widget, records: any[], isFormula: boolean, formula: string, tableName: string) => {
    const model = (project as any).models?.find((m: any) => String(m.id) === String(widget.model_id))
    
    // Identifica o nome da coluna para cálculo
    let fieldName = '*'
    if (!isFormula) {
      const fieldMeta = model?.fields?.find((f: any) => String(f.id) === String(widget.field))
      fieldName = fieldMeta?.db_column_name || widget.field || '*'
      if (fieldName.includes('.')) fieldName = fieldName.split('.')[1]
    }

    const calcFormula = isFormula ? compileFormula(formula) : null

    if (!widget.group_by && (widget.type === 'kpi' || widget.type === 'gauge')) {
      // Bug fix: COUNT sem group_by deve simplesmente contar os registros retornados
      // Não tentar converter campos de texto para Number() pois resulta em NaN -> 0
      if (widget.calc === 'COUNT') {
        setData(prev => ({ ...prev, [widget.id]: records.length }))
        return
      }

      const values = records.map((r) => {
        if (calcFormula) return calcFormula(r)

        let rawVal = r[fieldName];
        if (rawVal === undefined) {
          const keys = Object.keys(r);
          const targetLow = fieldName.toLowerCase();
          const matchingKey = keys.find(k => k.toLowerCase() === targetLow);
          if (matchingKey) rawVal = r[matchingKey];
          else {
            const deepMatch = keys.find(k => k.toLowerCase().includes(targetLow));
            if (deepMatch) rawVal = r[deepMatch];
          }
        }
        // nulo/vazio fica de fora (NaN é filtrado abaixo): Number(null) = 0 puxaria a média para baixo
        if (rawVal === null || rawVal === undefined || rawVal === '') return NaN
        return Number(rawVal)
      }).filter(v => !isNaN(v))

      let result = 0
      if (widget.calc === 'SUM') result = values.reduce((a, b) => a + b, 0)
      if (widget.calc === 'AVG') result = values.reduce((a, b) => a + b, 0) / (values.length || 1)
      if (widget.calc === 'MIN') result = values.length > 0 ? Math.min(...values) : 0
      if (widget.calc === 'MAX') result = values.length > 0 ? Math.max(...values) : 0
      
      setData(prev => ({ ...prev, [widget.id]: result }))
      return
    }

    // Lógica de agrupamento (Charts ou Grouped KPIs)
    const allModels = Array.isArray(project.models) ? project.models : Object.values(project.models || {})
    let groupByFieldMeta = null
    let groupByTableName = tableName
    let resolvedGroupByPath = null

    if (widget.group_by) {
      const parts = widget.group_by.split('.')
      const targetTableName = parts.length > 1 ? parts[0] : null
      const targetFieldName = parts.length > 1 ? parts[1] : widget.group_by

      for (const m of (allModels as any[])) {
        if (targetTableName && m.db_table_name !== targetTableName) continue
        const fields = Array.isArray(m.fields) ? m.fields : Object.values(m.fields || {})
        const found = fields.find((f: any) => String(f.id) === String(targetFieldName) || f.db_column_name === targetFieldName || f.name === targetFieldName)
        if (found) {
          groupByFieldMeta = found
          groupByTableName = m.db_table_name
          resolvedGroupByPath = found.db_column_name
          break
        }
      }
    }

    let groupByPath = resolvedGroupByPath || widget.group_by
    if (groupByPath && groupByPath.includes('.')) {
      groupByPath = groupByPath.split('.')[1]
    }
    
    const grouped = records.reduce((acc: any, curr: any) => {
      let key = 'N/A'
      let rawKey = curr[groupByPath]
      
      if (rawKey === undefined) {
        const keys = Object.keys(curr)
        const targetLow = String(groupByPath).toLowerCase()
        const foundKey = keys.find(k => k.toLowerCase() === targetLow)
        if (foundKey) rawKey = curr[foundKey]
        else {
          const deepKey = keys.find(k => k.toLowerCase().includes(targetLow))
          if (deepKey) rawKey = curr[deepKey]
        }
      }

      if (rawKey && widget.date_granularity) {
         if (typeof rawKey === 'string' && rawKey.match(/^\d{4}-\d{2}-\d{2}/)) {
           const dateMatch = rawKey.match(/^(\d{4})-(\d{2})-(\d{2})/)
           if (dateMatch) {
              const [_, y, m, d] = dateMatch
              if (widget.date_granularity === 'month') rawKey = `${y}-${m}`
              else if (widget.date_granularity === 'year') rawKey = `${y}`
              else if (widget.date_granularity === 'day') rawKey = `${y}-${m}-${d}`
           }
         } else {
           const dObj = new Date(rawKey)
           if (!isNaN(dObj.getTime())) {
              const y = dObj.getFullYear()
              const m = dObj.getMonth() + 1
              const day = dObj.getDate()
              const mStr = m < 10 ? '0' + m : m
              const dStr = day < 10 ? '0' + day : day
              if (widget.date_granularity === 'month') rawKey = `${y}-${mStr}`
              else if (widget.date_granularity === 'year') rawKey = `${y}`
              else if (widget.date_granularity === 'day') rawKey = `${y}-${mStr}-${dStr}`
           }
         }
      }

      key = String(rawKey || 'N/A')
      
      if (!acc[key]) acc[key] = { name: key, value: 0, count: 0 }
      
      let val = 0
      let hasValue = true
      if (calcFormula) {
        val = calcFormula(curr)
      } else {
        let rawVal = curr[fieldName]
        if (rawVal === undefined) {
          const keys = Object.keys(curr)
          const targetLow = fieldName.toLowerCase()
          const matchingKey = keys.find(k => k.toLowerCase() === targetLow)
          if (matchingKey) rawVal = curr[matchingKey]
          else {
            const deepMatch = keys.find(k => k.toLowerCase().includes(targetLow))
            if (deepMatch) rawVal = curr[deepMatch]
          }
        }
        hasValue = fieldName === '*' || !(rawVal === null || rawVal === undefined || rawVal === '')
        val = fieldName === '*' ? 1 : Number(rawVal)
      }

      const num = Number(val)
      if (widget.calc === 'SUM') acc[key].value += (num || 0)
      else if (widget.calc === 'COUNT') acc[key].value += 1
      else if (hasValue && Number.isFinite(num)) {
        // AVG/MIN/MAX ignoram nulos; count guarda quantos valores válidos entraram
        if (widget.calc === 'AVG') acc[key].value += num
        else if (widget.calc === 'MIN') acc[key].value = acc[key].count === 0 ? num : Math.min(acc[key].value, num)
        else if (widget.calc === 'MAX') acc[key].value = acc[key].count === 0 ? num : Math.max(acc[key].value, num)
        acc[key].count += 1
      }
      
      return acc
    }, {})

    let finalData = Object.values(grouped).map((item: any) => ({
      name: String(item.name),
      value: widget.calc === 'AVG' ? (item.count ? item.value / item.count : 0) : item.value
    }))

    const sortMode = widget.sort_by || 'value_desc'
    if (sortMode === 'value_asc') finalData.sort((a, b) => a.value - b.value)
    else if (sortMode === 'label_asc') finalData.sort((a, b) => a.name.localeCompare(b.name))
    else if (sortMode === 'label_desc') finalData.sort((a, b) => b.name.localeCompare(a.name))
    else finalData.sort((a, b) => b.value - a.value)

    if (widget.limit_top_n && widget.limit_top_n > 0) {
      finalData = finalData.slice(0, widget.limit_top_n)
    }

    setData(prev => ({ ...prev, [widget.id]: finalData }))
  }

  const renderGauge = (val: number, widget: Widget, size: 'normal' | 'mini' = 'normal', title?: string, isExpanded?: boolean) => {
    const min = widget.gauge_min ?? 0
    const target = widget.gauge_target ?? 70
    const scaleStart = widget.gauge_start ?? 0
    const scaleEnd = widget.gauge_end ?? 100
    const rawVal = typeof val === 'number' ? val : 0
    const scaleSpan = scaleEnd - scaleStart
    const percentage = scaleSpan === 0 ? 0 : Math.min(Math.max(((rawVal - scaleStart) / scaleSpan) * 100, 0), 100)
    const radius = size === 'normal' || isExpanded ? 80 : 40
    const strokeWidth = size === 'normal' || isExpanded ? 16 : 10
    const circumference = Math.PI * radius
    const rotation = -90 + (percentage / 100) * 180
    const isBelowMin = rawVal < min
    const isInRange = rawVal >= min && rawVal < target
    const uniqueId = `${widget.id}-${title?.replace(/\s+/g, '-') || 'main'}`
    const gradientId = isBelowMin ? `grad-red-${uniqueId}` : isInRange ? `grad-amber-${uniqueId}` : `grad-green-${uniqueId}`
    const viewBox = size === 'normal' || isExpanded ? "0 0 200 200" : "0 0 100 100"
    const cx = size === 'normal' || isExpanded ? 100 : 50
    const cy = size === 'normal' || isExpanded ? 100 : 50

    return (
      <div className={cn("flex flex-col items-center justify-center transition-all duration-700", (size === 'normal' || isExpanded) ? "flex-1 p-8" : "p-2")}>
        {title && <span className={cn("font-black uppercase tracking-tight text-neutral-400 mb-2 truncate max-w-full text-center", (size === 'normal' || isExpanded) ? "text-sm" : "text-[8px]")}>{title}</span>}
        <div className={cn("relative overflow-hidden transition-all duration-700", (size === 'normal' || isExpanded) ? "w-64 h-[140px]" : "w-24 h-[60px]")}>
          <svg className={cn("transition-all duration-700", (size === 'normal' || isExpanded) ? "w-64 h-64" : "w-24 h-24")} viewBox={viewBox}>
            <defs>
              <linearGradient id={`grad-red-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#ef4444" /><stop offset="100%" stopColor="#991b1b" /></linearGradient>
              <linearGradient id={`grad-amber-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#92400e" /></linearGradient>
              <linearGradient id={`grad-green-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#064e3b" /></linearGradient>
            </defs>
            <circle cx={cx} cy={cy} r={radius} fill="none" strokeWidth={strokeWidth} strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={0} transform={`rotate(180 ${cx} ${cy})`} className="text-neutral-100 dark:text-neutral-800" />
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeDasharray={`${(percentage / 100) * circumference} 1000`} strokeDashoffset={0} strokeLinecap="round" transform={`rotate(180 ${cx} ${cy})`} className={cn("transition-all duration-1000 ease-out", isBelowMin ? "text-red-500" : isInRange ? "text-amber-500" : "text-emerald-500")} />
            <g transform={`rotate(${rotation} ${cx} ${cy})`} style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.3))' }}>
              <path d={`M ${cx - (size === 'normal' || isExpanded ? 4 : 2)} ${cy} L ${cx} ${cy - radius} L ${cx + (size === 'normal' || isExpanded ? 4 : 2)} ${cy} Z`} fill={`url(#${gradientId})`} className="transition-all duration-1000 ease-out" />
              <circle cx={cx} cy={cy} r={size === 'normal' || isExpanded ? 6 : 3} className="fill-neutral-900 dark:fill-white" />
            </g>
          </svg>
        </div>
        {(() => {
          const text = fmt(rawVal, widget)
          const scale = ['text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl', 'text-7xl']
          const base = isExpanded ? 'text-7xl' : size === 'mini' ? 'text-lg' : effWidth(widget) === 'quarter' ? 'text-2xl' : effWidth(widget) === 'third' ? 'text-4xl' : effWidth(widget) === 'half' ? 'text-5xl' : 'text-6xl'
          const step = text.length > 15 ? 3 : text.length > 11 ? 2 : text.length > 8 ? 1 : 0
          const cls = size === 'mini' ? base : scale[Math.max(0, scale.indexOf(base) - step)]
          return (
            <span className={cn("font-black tracking-tighter text-neutral-900 dark:text-white transition-all duration-700 leading-none", cls, size === 'mini' ? 'mt-1' : 'mt-3')}>
              {text}
            </span>
          )
        })()}
        {(size === 'normal' || isExpanded) && (
          <div className="mt-8 flex gap-8 text-center">
            <div className="flex flex-col"><span className="text-[10px] font-black text-red-500 uppercase">{t('runtime.bi_gauge_min')}</span><span className="font-bold">{fmt(min, widget, true)}</span></div>
            <div className="flex flex-col"><span className="text-[10px] font-black text-emerald-500 uppercase">{t('runtime.bi_gauge_target')}</span><span className="font-bold">{fmt(target, widget, true)}</span></div>
            <div className="flex flex-col"><span className="text-[10px] font-black text-indigo-500 uppercase">{t('runtime.bi_gauge_scale')}</span><span className="font-bold">{fmt(scaleStart, widget, true)} – {fmt(scaleEnd, widget, true)}</span></div>
          </div>
        )}
      </div>
    )
  }

  // largura que o widget realmente tem na escala atual (a fonte do KPI acompanha)
  const effWidth = (w: Widget) => widthOfSpan(spanFor(w.width, scaleKey))

  const renderKPI = (val: number, widget: Widget, size: 'normal' | 'mini' = 'normal', title?: string, isExpanded?: boolean) => {
    const width = effWidth(widget)
    
    const baseFontSize = isExpanded ? 'text-8xl' :
                   size === 'mini' ? 'text-2xl' :
                   width === 'quarter' ? 'text-3xl' :
                   width === 'third' ? 'text-5xl' :
                   width === 'half' ? 'text-7xl' :
                   'text-9xl'
    const fontScale = ['text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl', 'text-7xl', 'text-8xl', 'text-9xl']
    const lenOfValue = fmt(typeof val === 'number' ? val : 0, widget).length
    const stepDown = lenOfValue > 15 ? 3 : lenOfValue > 11 ? 2 : lenOfValue > 8 ? 1 : 0
    const fontSize = size === 'mini' ? baseFontSize : fontScale[Math.max(0, fontScale.indexOf(baseFontSize) - stepDown)]

    const padding = (size === 'normal' || isExpanded) ? (width === 'quarter' ? 'p-4' : 'p-8') : "p-4 text-center"
    const rawVal = typeof val === 'number' ? val : 0
    const formattedVal = fmt(rawVal, widget)
    return (
      <div className={cn("flex flex-col items-center justify-center transition-all duration-700", padding)}>
        {title && <span className={cn("font-black uppercase tracking-tight text-neutral-400 mb-1 truncate max-w-full", (size === 'normal' || isExpanded) ? "text-sm" : "text-[10px]")}>{title}</span>}
        <span className={cn("font-black tracking-tighter text-neutral-900 dark:text-white transition-all", fontSize)}>{formattedVal}</span>
        {(size === 'normal' || isExpanded) && (
          <span className="text-xs font-black uppercase text-neutral-400 mt-2 tracking-widest">
            {widget.calc} {widget.field_id && widget.field_id !== '' ? `/ ${widget.field_id}` : ''}
          </span>
        )}
        {(size === 'normal' || isExpanded) && widget.compare_previous && (() => {
          const wp = widgetPeriod(widget)
          const prevVal = prevData[widget.id]
          if (!wp || prevVal === undefined) return null
          const pr = previousRange(wp)
          const up = rawVal >= prevVal
          const good = widget.compare_invert ? !up : up
          const pct = prevVal === 0 ? null : ((rawVal - prevVal) / Math.abs(prevVal)) * 100
          // 99,96% não pode aparecer como "100%": só mostramos 100% quando for exatamente isso
          const absPct = pct === null ? 0 : Math.abs(pct)
          const shownPct = absPct < 100 && Math.round(absPct * 10) / 10 >= 100 ? 99.9 : absPct
          return (
            <div className="mt-3 flex flex-col items-center gap-0.5">
              {pct === null ? (
                <span className="text-[10px] font-bold text-neutral-400 text-center">sem dados no período anterior ({fmtDay(pr.from)} – {fmtDay(pr.to)})</span>
              ) : (
                <>
                  <span className={cn("text-sm font-black tracking-tight", good ? 'text-emerald-500' : 'text-red-500')}>
                    {up ? '▲' : '▼'} {formatBiValue(shownPct, { format: 'percent', decimals: 1, locale: biLocale })}
                  </span>
                  <span className="text-[10px] font-bold text-neutral-400 text-center">
                    vs {fmtDay(pr.from)} – {fmtDay(pr.to)}: {fmt(prevVal, widget)}
                  </span>
                </>
              )}
            </div>
          )
        })()}
      </div>
    )
  }

  const renderWidgetContent = (widget: Widget, forceSize?: 'normal' | 'large') => {
    if (loading[widget.id]) return <div className="flex-1 flex items-center justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
    if (errors[widget.id]) return <div className="flex-1 flex flex-col items-center justify-center gap-2 text-red-400 p-4 text-center"><AlertCircle className="w-5 h-5" /><p className="text-[10px] font-bold uppercase tracking-widest">{errors[widget.id]}</p>{!access.denied && <button type="button" onClick={() => { forceFresh.current = true; try { runFetch(widget) } finally { forceFresh.current = false } }} className="mt-1 flex items-center gap-1 px-3 py-1 rounded-lg border border-red-200 dark:border-red-900/50 text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"><RefreshCw className="w-3 h-3" />{t('runtime.bi_retry')}</button>}</div>
    
    const val = data[widget.id]
    if (val === undefined || val === null) return <div className="flex-1 flex items-center justify-center text-neutral-300 text-xs font-black uppercase">{t('runtime.bi_no_data')}</div>

    if (widget.type === 'kpi') {
      if (Array.isArray(val)) {
        return (
          <div className="grid grid-cols-3 gap-4 p-2 max-h-[300px] overflow-auto">
            {val.map((item: any, idx: number) => (
              <div key={idx} onClick={() => setExpandedGaugeId(`${widget.id}-${item.name}`)} className="bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-[1.5rem] border border-neutral-100 dark:border-neutral-800 hover:border-indigo-500/30 transition-all cursor-pointer group/mini relative">
                <div className="absolute top-3 right-3 opacity-0 group-hover/mini:opacity-100 transition-opacity"><Maximize2 className="w-3 h-3 text-neutral-400" /></div>
                {renderKPI(item.value, widget, 'mini', item.name)}
              </div>
            ))}
          </div>
        )
      }
      return renderKPI(val, widget, 'normal')
    }

    if (widget.type === 'gauge') {
      if (Array.isArray(val)) {
        return (
          <div className="grid grid-cols-3 gap-4 p-2 max-h-[300px] overflow-auto">
            {val.map((item: any, idx: number) => (
              <div key={idx} onClick={() => setExpandedGaugeId(`${widget.id}-${item.name}`)} className="bg-neutral-50 dark:bg-neutral-800/50 p-2 rounded-[1.5rem] border border-neutral-100 dark:border-neutral-800 hover:border-indigo-500/30 transition-all cursor-pointer group/mini relative">
                <div className="absolute top-3 right-3 opacity-0 group-hover/mini:opacity-100 transition-opacity"><Maximize2 className="w-3 h-3 text-neutral-400" /></div>
                {renderGauge(item.value, widget, 'mini', item.name)}
              </div>
            ))}
          </div>
        )
      }
      return renderGauge(val, widget, 'normal')
    }

    const height = forceSize === 'large' ? 450 : preset.chartHeight
    const sd = seriesData[widget.id]
    if (sd && sd.rows.length > 0 && ['bar', 'line', 'area'].includes(widget.type)) {
      const tickS = { fontSize: 10, fontWeight: 700, fill: '#888888' }
      const shortS = (v: any) => { const t = String(v); return t.length > 16 ? `${t.slice(0, 15)}…` : t }
      const axisFmt = (v: any) => fmt(v, widget, true)
      const horizontalS = widget.type === 'bar' && widget.orientation === 'horizontal'
      const stack = widget.stacked ? 'a' : undefined
      return (
        <div className="w-full mt-4 relative" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {widget.type === 'bar' ? (
              <BarChart data={sd.rows} layout={horizontalS ? 'vertical' : 'horizontal'} margin={{ top: 6, right: 8, left: 0, bottom: 0 }} onClick={chartClick(widget, sd.rows)} style={clickStyle(widget)}>
                <CartesianGrid strokeDasharray="3 3" vertical={horizontalS} horizontal={!horizontalS} stroke="#88888822" />
                {horizontalS ? (
                  <>
                    <XAxis type="number" axisLine={false} tickLine={false} tick={tickS} tickFormatter={axisFmt} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={tickS} width={112} tickFormatter={shortS} />
                  </>
                ) : (
                  <>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tickS} tickFormatter={shortS} />
                    <YAxis axisLine={false} tickLine={false} tick={tickS} tickFormatter={axisFmt} />
                  </>
                )}
                <Tooltip cursor={{ fill: '#88888811' }} contentStyle={tooltipStyle} formatter={(v: any, n: any) => [fmt(v, widget), n]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800 }} />
                {sd.keys.map((k, i) => <Bar key={k} dataKey={k} stackId={stack} fill={COLORS[i % COLORS.length]} radius={stack ? undefined : (horizontalS ? [0, 4, 4, 0] : [4, 4, 0, 0])} />)}
              </BarChart>
            ) : widget.type === 'line' ? (
              <LineChart data={sd.rows} margin={{ top: 6, right: 12, left: 0, bottom: 0 }} onClick={chartClick(widget, sd.rows)} style={clickStyle(widget)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tickS} tickFormatter={shortS} />
                <YAxis axisLine={false} tickLine={false} tick={tickS} tickFormatter={axisFmt} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [fmt(v, widget), n]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800 }} />
                {sd.keys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} />)}
              </LineChart>
            ) : (
              <AreaChart data={sd.rows} margin={{ top: 6, right: 12, left: 0, bottom: 0 }} onClick={chartClick(widget, sd.rows)} style={clickStyle(widget)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tickS} tickFormatter={shortS} />
                <YAxis axisLine={false} tickLine={false} tick={tickS} tickFormatter={axisFmt} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [fmt(v, widget), n]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800 }} />
                {sd.keys.map((k, i) => <Area key={k} type="monotone" dataKey={k} stackId={stack} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.25} strokeWidth={2.5} />)}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )
    }
    const rows: any[] = Array.isArray(val) ? val : []
    if (rows.length === 0) return <div className="flex-1 flex items-center justify-center text-neutral-300 text-xs font-black uppercase">{t('runtime.bi_no_data')}</div>

    const primary = biPrimaryColor(widget.color)
    const tick = { fontSize: 10, fontWeight: 700, fill: '#888888' }
    const tooltipFormatter = (value: any) => [fmt(value, widget), widget.calc]
    const labelFormatter = (value: any) => fmt(value, widget, true)
    const maxValue = Math.max(...rows.map(r => Number(r.value) || 0))
    const barFill = (value: number) => widget.highlight_max && (Number(value) || 0) !== maxValue ? `${primary}66` : primary
    const horizontal = widget.type === 'bar' && widget.orientation === 'horizontal'
    const shortName = (v: any) => { const t = String(v); return t.length > 16 ? `${t.slice(0, 15)}…` : t }
    const total = rows.reduce((acc, r) => acc + (Number(r.value) || 0), 0)
    const gradId = `bi-grad-${widget.id}`

    return (
      <div className="w-full mt-4 relative" style={{ height }}>
        {widget.type === 'pie' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingBottom: 36 }}>
            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">{t('runtime.bi_total')}</span>
            <span className="text-xl font-black tracking-tighter text-neutral-900 dark:text-white">{fmt(total, widget, true)}</span>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          {widget.type === 'bar' ? (
            <BarChart data={rows} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: widget.show_labels ? 18 : 6, right: horizontal && widget.show_labels ? 56 : 8, left: 0, bottom: 0 }} onClick={chartClick(widget, rows)} style={clickStyle(widget)}>
              <CartesianGrid strokeDasharray="3 3" vertical={horizontal} horizontal={!horizontal} stroke="#88888822" />
              {horizontal ? (
                <>
                  <XAxis type="number" axisLine={false} tickLine={false} tick={tick} tickFormatter={labelFormatter} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={tick} width={112} tickFormatter={shortName} />
                </>
              ) : (
                <>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tick} tickFormatter={shortName} />
                  <YAxis axisLine={false} tickLine={false} tick={tick} tickFormatter={labelFormatter} />
                </>
              )}
              <Tooltip cursor={{ fill: '#88888811' }} contentStyle={tooltipStyle} formatter={tooltipFormatter} />
              <Bar dataKey="value" radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}>
                {rows.map((r, i) => <Cell key={`bar-${i}`} fill={barFill(r.value)} fillOpacity={dimOf(widget, r.name)} />)}
                {widget.show_labels && <LabelList dataKey="value" position={horizontal ? 'right' : 'top'} formatter={labelFormatter} style={{ fontSize: 10, fontWeight: 800, fill: isDark ? '#e5e5e5' : '#404040' }} />}
              </Bar>
            </BarChart>
          ) : widget.type === 'line' ? (
            <LineChart data={rows} margin={{ top: widget.show_labels ? 22 : 6, right: 12, left: 0, bottom: 0 }} onClick={chartClick(widget, rows)} style={clickStyle(widget)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tick} tickFormatter={shortName} />
              <YAxis axisLine={false} tickLine={false} tick={tick} tickFormatter={labelFormatter} />
              <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} />
              <Line type="monotone" dataKey="value" stroke={primary} strokeWidth={3} dot={{ r: 4, fill: primary }} activeDot={{ r: 6 }}>
                {widget.show_labels && <LabelList dataKey="value" position="top" formatter={labelFormatter} style={{ fontSize: 10, fontWeight: 800, fill: isDark ? '#e5e5e5' : '#404040' }} />}
              </Line>
            </LineChart>
          ) : widget.type === 'area' ? (
            <AreaChart data={rows} margin={{ top: widget.show_labels ? 22 : 6, right: 12, left: 0, bottom: 0 }} onClick={chartClick(widget, rows)} style={clickStyle(widget)}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={primary} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={primary} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tick} tickFormatter={shortName} />
              <YAxis axisLine={false} tickLine={false} tick={tick} tickFormatter={labelFormatter} />
              <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} />
              <Area type="monotone" dataKey="value" stroke={primary} strokeWidth={3} fill={`url(#${gradId})`}>
                {widget.show_labels && <LabelList dataKey="value" position="top" formatter={labelFormatter} style={{ fontSize: 10, fontWeight: 800, fill: isDark ? '#e5e5e5' : '#404040' }} />}
              </Area>
            </AreaChart>
          ) : (
            <PieChart>
              <Pie
                data={rows}
                innerRadius={height * 0.25}
                outerRadius={height * 0.35}
                paddingAngle={rows.length > 1 ? 4 : 0}
                dataKey="value"
                label={widget.show_labels ? ((e: any) => (total > 0 ? `${Math.round((Number(e.value) / total) * 100)}%` : '')) : false}
                labelLine={false}
                onClick={(entry: any, _i: number, ev: any) => onPoint(widget, String(entry?.name ?? entry?.payload?.name), ev)}
                style={clickStyle(widget)}
              >
                {rows.map((r: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={dimOf(widget, r.name)} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 900 }}
                formatter={(name: any, entry: any) => {
                  const v = Number(entry?.payload?.value) || 0
                  const pct = total > 0 ? ` (${Math.round((v / total) * 100)}%)` : ''
                  return `${shortName(name)} · ${fmt(v, widget, true)}${pct}`
                }}
              />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    )
  }

  // Seções: soltos no topo e, depois, os grupos na ordem definida (grupo sem widget não aparece no painel)
  const sections = sectionsOf(localWidgets, localGroups)
    .filter(sec => sec.widgets.length > 0)
    .map(sec => ({ key: sec.group?.id ?? '__none__', group: sec.group, title: sec.group?.title ?? null, widgets: sec.widgets }))
  type Section = (typeof sections)[number]
  const renameGroup = (id: string, newTitle: string) => setLocalGroups(gs => renameGroupInList(gs, id, newTitle))
  const ungroup = (id: string) => {
    const r = removeGroupFromList(localGroups, localWidgets, id)
    setLocalGroups(r.groups)
    setLocalWidgets(r.widgets)
  }
  const moveGroup = (id: string, dir: -1 | 1) => {
    const i = localGroups.findIndex(g => g.id === id)
    if (i < 0) return
    setLocalGroups(moveGroupInList(localGroups, id, i + dir))
  }

  const renderGroupHeader = (sec: Section) => {
    const group = sec.group as BiGroup
    const index = localGroups.findIndex(g => g.id === group.id)
    const collapsed = !!collapsedGroups[group.id]
    const n = sec.widgets.length
    return (
      <div className="flex items-center gap-3 px-2">
        <button
          type="button"
          onClick={() => setCollapsedGroups(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
          className="flex items-center gap-3 flex-1 min-w-0 text-left group/gh"
          aria-expanded={!collapsed}
        >
          <span className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 group-hover/gh:text-indigo-600 transition-all">
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-300", collapsed && "-rotate-90")} />
          </span>
          <span className="text-xs font-black uppercase tracking-[0.2em] text-neutral-700 dark:text-neutral-200 truncate">{groupLabel(group)}</span>
          <span className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300">
            {n} {n === 1 ? t('runtime.bi_indicator_one') : t('runtime.bi_indicator_many')}
          </span>
          <span className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
        </button>
        {isEditMode && (
          <div className="flex items-center gap-1 shrink-0">
            <input
              key={group.title}
              defaultValue={group.title}
              placeholder={t('runtime.bi_group_name')}
              onBlur={e => { if (!e.target.value.trim() && group.title) { e.target.value = group.title; return } renameGroup(group.id, e.target.value) }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              title={t('runtime.bi_group_rename')}
              className="w-40 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-[10px] font-bold text-neutral-900 dark:text-white"
            />
            <button type="button" disabled={index <= 0} onClick={() => moveGroup(group.id, -1)} title={t('runtime.bi_move_up')} className="p-1.5 rounded-lg text-neutral-400 hover:text-indigo-600 disabled:opacity-30"><ChevronDown className="w-4 h-4 rotate-180" /></button>
            <button type="button" disabled={index < 0 || index === localGroups.length - 1} onClick={() => moveGroup(group.id, 1)} title={t('runtime.bi_move_down')} className="p-1.5 rounded-lg text-neutral-400 hover:text-indigo-600 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
            <button type="button" onClick={() => ungroup(group.id)} title={t('runtime.bi_ungroup_hint')} className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-neutral-400 hover:text-red-500">{t('runtime.bi_ungroup')}</button>
          </div>
        )}
      </div>
    )
  }

  // Barra de período do grupo: aparece abaixo do cabeçalho quando algum widget do grupo usa "Segue o grupo"
  const renderGroupPeriodBar = (sec: Section) => {
    const group = sec.group as BiGroup
    const followers = sec.widgets.filter(w => !!w.period_field && effectiveMode(w) === 'group')
    if (followers.length === 0) return null
    const gp = groupPeriods[group.id] || { preset: 'all', from: '', to: '' }
    const set = (patch: Partial<typeof gp>) => setGroupPeriods(prev => ({ ...prev, [group.id]: { ...gp, ...patch } }))
    const inputCls = 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-[10px] font-bold text-neutral-900 dark:text-white'
    return (
      <div className="flex flex-wrap items-center gap-2 px-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mr-1">{t('runtime.bi_group_period')}</span>
        <span className="text-[9px] font-bold text-neutral-400 mr-2">
          {t('runtime.bi_affects').replace('{n}', String(followers.length)).replace('{unit}', followers.length === 1 ? t('runtime.bi_indicator_one') : t('runtime.bi_indicator_many'))}
        </span>
        {[...PERIOD_PRESETS, { id: 'custom', label: 'Personalizado' }].map(o => ({ ...o, label: t('bi_editor.period_' + o.id, o.label) })).map(o => (
          <button
            key={o.id}
            type="button"
            onClick={() => set({ preset: o.id })}
            className={cn("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all", gp.preset === o.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-neutral-900 text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-600')}
          >
            {o.label}
          </button>
        ))}
        {gp.preset === 'custom' && (
          <>
            <input type="date" value={gp.from} onChange={e => set({ from: e.target.value })} className={inputCls} />
            <span className="text-[10px] text-neutral-400">{t('runtime.bi_until')}</span>
            <input type="date" value={gp.to} onChange={e => set({ to: e.target.value })} className={inputCls} />
          </>
        )}
      </div>
    )
  }

  const renderWidgetCard = (widget: Widget) => {
    const widthClass = COL_CLASS[spanFor(widget.width, scaleKey)]

    return (
      <SortableCard
        key={widget.id}
        id={widget.id}
        widthClass={widthClass}
        box={box}
        compact={widget.type === 'kpi' && !widget.group_by}
        renderHeader={({ attributes, listeners }) => (
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-3">
            {isEditMode ? (
              <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-neutral-400 hover:text-indigo-600 transition-colors"><GripVertical className="w-4 h-4" /></div>
            ) : (
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl text-indigo-600 dark:text-indigo-400">
                {widget.type === 'kpi' ? <Activity className="w-4 h-4" /> : widget.type === 'gauge' ? <Gauge className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
              </div>
            )}
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-neutral-900 dark:text-white">{widget.title || 'Sem título'}</h3>
              <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-tighter opacity-70">{widget.calc === 'COUNT_DISTINCT' ? 'CONTAGEM DISTINTA' : widget.calc}{widget.divide_by?.calc ? ` ÷ ${widget.divide_by.calc === 'COUNT_DISTINCT' ? 'CONTAGEM DISTINTA' : widget.divide_by.calc}` : ''} ({widget.use_formula ? 'fórmula' : (widget.field_id || 'Toda Tabela')})</p>
              {widget.period_field && (() => {
                const wp = widgetPeriod(widget)
                const mode = effectiveMode(widget)
                const own = ownPeriods[widget.id] || { preset: 'all', from: '', to: '' }
                return (
                  <div className="flex flex-wrap items-center gap-1">
                    <p className="text-[8px] font-black text-indigo-500 uppercase tracking-tighter">
                      📅 {wp ? `${fmtDay(wp.from)} – ${fmtDay(wp.to)}` : t('runtime.bi_all_period')}{mode === 'fixed' ? ' · ' + t('runtime.bi_mode_fixed') : mode === 'group' ? ' · ' + t('runtime.bi_mode_group') : ''}
                    </p>
                    {mode === 'own' && (
                      <>
                        <select
                          value={own.preset}
                          onChange={e => setOwnPeriods(prev => ({ ...prev, [widget.id]: { ...own, preset: e.target.value } }))}
                          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md px-1 py-0.5 text-[9px] font-bold text-neutral-700 dark:text-neutral-200"
                        >
                          {PERIOD_PRESETS.map(o => <option key={o.id} value={o.id}>{t('bi_editor.period_' + o.id, o.label)}</option>)}
                          <option value="custom">{t('bi_editor.period_custom')}</option>
                        </select>
                        {own.preset === 'custom' && (
                          <>
                            <input type="date" value={own.from} onChange={e => setOwnPeriods(prev => ({ ...prev, [widget.id]: { ...own, from: e.target.value } }))} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md px-1 py-0.5 text-[9px] font-bold text-neutral-700 dark:text-neutral-200" />
                            <input type="date" value={own.to} onChange={e => setOwnPeriods(prev => ({ ...prev, [widget.id]: { ...own, to: e.target.value } }))} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md px-1 py-0.5 text-[9px] font-bold text-neutral-700 dark:text-neutral-200" />
                          </>
                        )}
                      </>
                    )}
                  </div>
                )
              })()}
              {(drillStacks[widget.id] || []).length > 0 && (
                <div className="flex flex-wrap items-center gap-1 text-[9px] font-black uppercase tracking-tighter text-indigo-500">
                  <button type="button" title={t('runtime.bi_back_level')} onClick={() => setDrillStacks(prev => ({ ...prev, [widget.id]: (prev[widget.id] || []).slice(0, -1) }))} className="p-0.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40"><CornerUpLeft className="w-3 h-3" /></button>
                  <button type="button" onClick={() => setDrillStacks(prev => ({ ...prev, [widget.id]: [] }))} className="hover:underline">{t('runtime.bi_all')}</button>
                  {(drillStacks[widget.id] || []).map((l, i) => <span key={i}>› {l.label}</span>)}
                </div>
              )}
              {crossIgnored[widget.id] && (
                <p className="text-[8px] font-black text-neutral-400 uppercase tracking-tighter" title={t('runtime.bi_cross_ignored_hint')}>
                  ⛔ {t('runtime.bi_cross_ignored')}
                </p>
              )}
              {truncated[widget.id] && (
                <p className="text-[8px] font-black text-amber-600 uppercase tracking-tighter" title={t('runtime.bi_limit_hint').replace('{n}', String(BI_ROW_LIMIT))}>
                  ⚠ {t('runtime.bi_limited').replace('{n}', String(BI_ROW_LIMIT))}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setExpandedWidgetId(widget.id)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-indigo-600 transition-all">
              <Search className="w-4 h-4" />
            </button>
            {isEditMode && onEditWidget && (
              <button onClick={() => onEditWidget(widget)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-indigo-600 transition-all">
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {isEditMode && onDeleteWidget && (
              <button onClick={() => onDeleteWidget(widget.id)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-red-500 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        )}
      >
        {renderWidgetContent(widget)}
      </SortableCard>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700 relative">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-neutral-400">{t('runtime.bi_perf')}</h2>
        <button 
          onClick={() => {
            if (isEditMode && onSaveLayout) {
              onSaveLayout(localWidgets, localGroups)
            }
            setIsEditMode(!isEditMode)
          }} 
          className={cn("flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all", isEditMode ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/40 scale-105" : "bg-white dark:bg-neutral-900 text-neutral-500 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50")}
        >
          {isEditMode ? <Save className="w-3.5 h-3.5" /> : <MousePointer2 className="w-3.5 h-3.5" />}
          {isEditMode ? t('runtime.bi_save_layout') : t('runtime.bi_organize')}
        </button>
        <div className="flex items-center gap-2 ml-auto text-[9px] font-bold text-neutral-400">
          {lastUpdated && <span className="hidden sm:inline">{t('runtime.bi_updated_at').replace('{time}', new Date(lastUpdated).toLocaleTimeString(biLocale))}</span>}
          {perf.refreshSeconds > 0 && <span className="hidden md:inline" title={t('runtime.bi_auto_refresh').replace('{every}', perf.refreshSeconds >= 3600 ? `${perf.refreshSeconds / 3600} h` : perf.refreshSeconds >= 60 ? `${Math.round(perf.refreshSeconds / 60)} min` : `${perf.refreshSeconds} s`)}>⟳</span>}
          <button type="button" onClick={refreshAll} title={t('runtime.bi_refresh')} className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-indigo-600 transition-all">
            <RefreshCw className={cn('w-3.5 h-3.5', Object.values(loading).some(Boolean) && 'animate-spin')} />
          </button>
        </div>
        <div className="flex items-center bg-white dark:bg-neutral-900 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800 ml-4 hidden md:flex">
          {scales.map(s => (
            <button
              key={s.key}
              onClick={() => setScaleKey(s.key)}
              title={s.label}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                scaleKey === s.key
                  ? "bg-neutral-100 dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                  : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              )}
            >
              {s.icon}
            </button>
          ))}
        </div>
      </div>

      {rlsRules.length > 0 && viewerState.ready && !viewerState.viewer && (
        <p className="mx-2 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-[10px] font-bold text-amber-700 dark:text-amber-400">
          {t('runtime.bi_rls_dev_preview')}
        </p>
      )}

      {hasPeriodWidgets && (
        <div className="flex flex-wrap items-center gap-2 px-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mr-1">{t('runtime.bi_period')}</span>
          <span className="text-[9px] font-bold text-neutral-400 mr-2">
            {t('runtime.bi_affects').replace('{n}', String(periodWidgetCount)).replace('{unit}', periodWidgetCount === 1 ? t('runtime.bi_indicator_one') : t('runtime.bi_indicator_many'))}
          </span>
          {[...PERIOD_PRESETS, { id: 'custom', label: 'Personalizado' }].map(o => ({ ...o, label: t('bi_editor.period_' + o.id, o.label) })).map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => setPeriod(p => ({ ...p, preset: o.id }))}
              className={cn("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all", period.preset === o.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-neutral-900 text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-600')}
            >
              {o.label}
            </button>
          ))}
          {period.preset === 'custom' && (
            <>
              <input type="date" value={period.from} onChange={e => setPeriod(p => ({ ...p, from: e.target.value }))} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-[10px] font-bold text-neutral-900 dark:text-white" />
              <span className="text-[10px] text-neutral-400">{t('runtime.bi_until')}</span>
              <input type="date" value={period.to} onChange={e => setPeriod(p => ({ ...p, to: e.target.value }))} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-[10px] font-bold text-neutral-900 dark:text-white" />
            </>
          )}
        </div>
      )}

      {crossList.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-2">
          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-neutral-400 mr-1"><Filter className="w-3 h-3" /> {t('runtime.bi_cross_filters')}</span>
          {crossList.map(f => (
            <button
              key={f.sourceId}
              type="button"
              title={t('runtime.bi_remove_filter')}
              onClick={() => setCrossFilters(prev => { const next = { ...prev }; delete next[f.sourceId]; return next })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all"
            >
              {f.sourceTitle}: {f.name} <X className="w-3 h-3" />
            </button>
          ))}
          {crossList.length > 1 && (
            <button type="button" onClick={() => setCrossFilters({})} className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-neutral-400 hover:text-red-500">{t('runtime.bi_clear_all')}</button>
          )}
        </div>
      )}

      {pointMenu && (
        <div className="fixed inset-0 z-[120]" onClick={() => setPointMenu(null)} onKeyDown={e => { if (e.key === 'Escape') setPointMenu(null) }}>
          <div className="absolute w-64 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl p-1.5" style={{ left: pointMenu.x, top: pointMenu.y }} onClick={e => e.stopPropagation()}>
            <p className="px-3 pt-2 pb-1 text-[9px] font-black uppercase tracking-widest text-neutral-400 truncate">{pointMenu.name}</p>
            {pointMenu.actions.map(a => (
              <button key={a.key} type="button" onClick={() => { setPointMenu(null); a.run() }} className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition-all">
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {recordsView && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => { recordsQueryId.current = null; setRecordsView(null) }}>
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-neutral-900 dark:text-white truncate"><Table2 className="w-4 h-4 text-indigo-500 shrink-0" /> {recordsView.title}</h3>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-tight truncate">{recordsView.label}{recordsView.rows ? ` · ${recordsView.rows.length}${recordsView.rows.length >= 200 ? '+ ' + t('runtime.bi_records_latest') : ' ' + t('runtime.bi_records_n')}` : ''}</p>
              </div>
              <button type="button" onClick={() => { recordsQueryId.current = null; setRecordsView(null) }} className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-red-500 transition-all"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-auto">
              {recordsView.error ? (
                <div className="p-10 text-center text-xs font-bold text-red-500">{recordsView.error}</div>
              ) : !recordsView.rows ? (
                <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
              ) : recordsView.rows.length === 0 ? (
                <div className="p-10 text-center text-xs font-black uppercase text-neutral-300">{t('runtime.bi_no_records')}</div>
              ) : (() => {
                // o Oracle devolve as colunas em caixa alta (às vezes duplicadas): mostra cada coluna uma vez
                const seen = new Set<string>()
                const cols = Object.keys(recordsView.rows[0]).filter(k => { const l = k.toLowerCase(); if (seen.has(l)) return false; seen.add(l); return true }).slice(0, 14)
                const cell = (v: any) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))
                return (
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-900">
                      <tr>{cols.map(k => <th key={k} className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-neutral-400 whitespace-nowrap">{k}</th>)}</tr>
                    </thead>
                    <tbody>
                      {recordsView.rows.map((r, i) => (
                        <tr key={i} className="border-t border-neutral-100 dark:border-neutral-800/60 hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                          {cols.map(k => <td key={k} className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300 whitespace-nowrap max-w-[240px] truncate" title={cell(r[k])}>{cell(r[k])}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {expandedGaugeId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-neutral-900 rounded-[3.5rem] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-12 relative max-w-2xl w-full flex flex-col items-center">
            <button onClick={() => setExpandedGaugeId(null)} className="absolute top-8 right-8 p-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-red-500 rounded-full transition-all"><Minimize2 className="w-5 h-5" /></button>
            {(() => {
              const [wId, ...nameParts] = expandedGaugeId.split('-')
              const iName = nameParts.join('-')
              const widget = localWidgets.find(w => w.id === wId)
              const val = data[wId]
              if (!widget || !Array.isArray(val)) return null
              const expandedItem = val.find(v => v.name === iName)
              return expandedItem ? (
                <div className="animate-in zoom-in-95 duration-500 w-full flex flex-col items-center">
                  <h3 className="text-xl font-black uppercase tracking-tight text-neutral-400 mb-2">{widget.title}</h3>
                  {widget.type === 'gauge' ? renderGauge(expandedItem.value, widget, 'normal', expandedItem.name, true) : renderKPI(expandedItem.value, widget, 'normal', expandedItem.name, true)}
                </div>
              ) : null
            })()}
          </div>
        </div>
      )}

      {expandedWidgetId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-neutral-900 rounded-[3.5rem] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-12 relative max-w-6xl w-full h-[85vh] flex flex-col">
            <button onClick={() => setExpandedWidgetId(null)} className="absolute top-10 right-10 p-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-red-500 rounded-full transition-all"><Minimize2 className="w-6 h-6" /></button>
            {(() => {
              const widget = localWidgets.find(w => w.id === expandedWidgetId)
              if (!widget) return null
              return (
                <div className="flex-1 flex flex-col p-10 overflow-hidden">
                  <div className="mb-10"><h2 className="text-4xl font-black text-neutral-900 dark:text-white uppercase tracking-tighter">{widget.title}</h2><p className="text-sm font-bold text-neutral-400 uppercase tracking-[0.2em] mt-1">{widget.calc} / {widget.field_id}</p></div>
                  <div className="flex-1 flex items-center justify-center overflow-auto">{renderWidgetContent(widget, 'large')}</div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="space-y-8">
          {sections.map((sec) => (
            <div key={sec.key} className="space-y-4">
              {sec.group && renderGroupHeader(sec)}
              {sec.group && !collapsedGroups[sec.key] && renderGroupPeriodBar(sec)}
              {!(sec.group && collapsedGroups[sec.key]) && (
                <SortableContext items={sec.widgets.map(w => w.id)} strategy={rectSortingStrategy}>
                  <div className={cn("grid grid-cols-12", box.gap)} style={{ zoom: preset.zoom }}>
                    {sec.widgets.map((widget) => renderWidgetCard(widget))}
                  </div>
                </SortableContext>
              )}
            </div>
          ))}
          {config.allow_runtime_edit && onAddWidget && !isEditMode && (
            <div className={cn("grid grid-cols-12", box.gap)} style={{ zoom: preset.zoom }}>
              <button onClick={onAddWidget} className={cn(COL_CLASS[spanFor("third", scaleKey)], box.full, "border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-5 text-neutral-400 hover:text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all group")}>
                <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xl shadow-neutral-500/5"><Plus className="w-10 h-10" /></div>
                <div className="text-center"><span className="text-xs font-black uppercase tracking-widest block">{t('runtime.bi_new_indicator')}</span><span className="text-[10px] font-bold opacity-60">{t('runtime.bi_expand')}</span></div>
              </button>
            </div>
          )}
        </div>
      </DndContext>
    </div>
  )
}
