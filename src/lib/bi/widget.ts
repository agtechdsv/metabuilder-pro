/**
 * Esquema ÚNICO do widget de BI, no formato em que é gravado (analytics_config.widgets).
 *
 * Antes havia três descrições que divergiam: a do painel em execução (AnalyticsDashboard), a do Studio (types.ts)
 * e a do gerador do app exportado (ast.ts, em camelCase). Agora todas usam estes tipos; o gerador guarda o widget
 * original em `spec` e cada recurso novo é escrito uma vez só, aqui.
 */
import type { BiGroup } from './groups'

export type BiWidgetType = 'kpi' | 'bar' | 'pie' | 'line' | 'area' | 'gauge'
export type BiWidgetCalc = 'COUNT' | 'COUNT_DISTINCT' | 'SUM' | 'AVG' | 'MIN' | 'MAX'
export type BiWidgetWidth = 'full' | 'half' | 'third' | 'quarter'
export type BiPeriodMode = 'panel' | 'fixed' | 'own' | 'group'

/** Filtro do widget com operador (campo = "tabela.coluna"). */
export interface BiWidgetCondition { field: string; op: string; value?: string; value2?: string }

export interface BiWidget {
  id: string
  title?: string
  type: BiWidgetType | string
  model_id?: string
  model_name?: string
  /** campo do valor ("tabela.coluna"), fórmula (quando use_formula) ou vazio = toda a tabela */
  field?: string
  field_id?: string
  calc?: BiWidgetCalc | string
  /** agrupar por ("tabela.coluna") */
  group_by?: string
  width?: BiWidgetWidth | string
  /** JOINs configurados manualmente (legado) */
  joins?: any[]

  // medidor
  gauge_min?: number
  gauge_max?: number
  gauge_target?: number
  gauge_start?: number
  gauge_end?: number

  // valor e agrupamento
  use_formula?: boolean
  formula_tokens?: any[]
  date_granularity?: 'day' | 'week' | 'month' | 'quarter' | 'year' | string
  sort_by?: 'value_desc' | 'value_asc' | 'label_asc' | 'label_desc' | string
  limit_top_n?: number

  // aparência
  format?: string
  decimals?: number
  currency?: string
  color?: string
  show_labels?: boolean
  highlight_max?: boolean
  orientation?: 'vertical' | 'horizontal' | string
  stacked?: boolean

  // Fase 2
  conditions?: BiWidgetCondition[]
  /** segunda dimensão (série) para barras, linhas e área */
  series_by?: string
  /** métrica derivada: valor = (calc/field) ÷ (divide_by.calc/divide_by.field) */
  divide_by?: { calc: string; field?: string }
  /** campo de data que recebe o filtro de período */
  period_field?: string
  period_mode?: BiPeriodMode
  period_fixed?: string
  /** agrupamento a que o widget pertence (id em analytics_config.groups) */
  group_id?: string
  /** caminho de relação escolhido por tabela (assinatura do caminho); sem escolha vale o mais curto */
  relation_paths?: Record<string, string>
  // Fase 4 — interações
  /** clicar numa barra/fatia deste gráfico filtra os widgets que respondem ao filtro cruzado */
  cross_source?: boolean
  /** este widget responde aos filtros cruzados dos outros gráficos */
  cross_target?: boolean
  /** clicar numa barra/fatia permite "detalhar": próximo nível de data ou a dimensão `drill_by` */
  drill_detail?: boolean
  /** dimensão do próximo nível (TABELA.COLUNA) quando o agrupamento não é uma data */
  drill_by?: string
  /** clicar numa barra/fatia permite ver os registros que compõem o número */
  drill_records?: boolean
  /** KPI sem agrupamento: variação contra o período anterior */
  compare_previous?: boolean
  compare_invert?: boolean
}

/** Widget já normalizado para exibir (o painel exige estes campos preenchidos). */
export type RuntimeBiWidget = BiWidget & {
  title: string
  model_id: string
  field: string
  calc: BiWidgetCalc | string
  width: BiWidgetWidth | string
}

export interface BiAnalyticsConfig {
  widgets: BiWidget[]
  groups?: BiGroup[]
  allow_runtime_edit?: boolean
  /** campo de data do filtro global de período do app exportado (ex.: 'data_pedido') */
  date_filter_field?: string
}
