// ─── MetaBuilder WizardConfig — Monaco IntelliSense Definitions ─────────────
// Este arquivo exporta os tipos do MetaBuilder como uma string para injetar
// no Monaco Editor via addExtraLib(), dando autocomplete ao dev no Code Mode.

export const WIZARD_CONFIG_DTS = `
declare interface SchedulerConfig {
  title_field: string
  start_date_field: string
  end_date_field: string
  color_field: string
}

declare interface TimelineConfig {
  date_field: string
  title_field: string
  desc_field: string
  icon_field: string
}

declare interface MapConfig {
  lat_field: string
  lng_field: string
  title_field: string
  desc_field: string
}

declare interface GanttConfig {
  title_field: string
  start_date_field: string
  end_date_field: string
  progress_field: string
  predecessor_field: string
}

declare interface BlueprintConfig {
  title_field: string
  desc_field: string
  status_field: string
  predecessor_field: string
}

declare interface GalleryConfig {
  image_field?: string
  title_field?: string
  subtitle_field?: string
  [key: string]: any
}

declare interface JoinConfig {
  id?: string
  from?: string
  localKey?: string
  to?: string
  foreignKey?: string
  source_model_id?: string
  target_model_id?: string
}

declare interface BiWidget {
  id: string
  title?: string
  type: string
  model_id?: string
  field?: string
  calc?: string
  group_by?: string
  width?: string
  joins?: JoinConfig[]
}

declare interface AnalyticsConfig {
  widgets: BiWidget[]
  allow_runtime_edit: boolean
}

declare interface CustomAction {
  id: string
  label?: string
  icon?: string
  /** 'navigate' | 'http' | 'bpm' | 'custom' */
  type?: string
  target?: string
  bpm_workflow_id?: string
  confirmation_required?: boolean
  confirmation_message?: string
  navigate_to?: string
  /** 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' */
  http_method?: string
  http_url?: string
  http_body?: string
  button_color?: string
  text_color?: string
  bg_color?: string
  /** 'list' | 'form' | 'both' */
  show_in?: string
  [key: string]: any
}

declare interface CustomSlot {
  id: string
  label?: string
  icon?: string
  tab_icon?: string
  type?: string
  model_id?: string
  display_mode?: string
  grid_fields?: string[]
  form_fields?: string[]
  filter_fields?: string[]
  joins?: JoinConfig[]
  analytics_config?: AnalyticsConfig
  relation_path?: RelationHop[]
  [key: string]: any
}

declare interface RelationHop {
  table: string
  from_field: string
  to_field: string
  target_from_field?: string
  target_to_field?: string
}

declare interface MindmapLevel {
  model_id?: string
  label_field?: string
  [key: string]: any
}

declare interface FieldMetaLabel {
  text: string
  font: string
  size: string
  color: string
}

declare interface FieldMetaContent {
  font: string
  size: string
  color: string
  mask: string
  required: boolean
  readonly: boolean
}

declare interface FieldMetaComponent {
  type: string
  rows: number
  width: string
  options_type: string
  fixed_options: string
  rel_table: string
  rel_label: string
  rel_value: string
}

declare interface FieldMetaViaCep {
  enabled: boolean
  logradouro: string
  bairro: string
  cidade: string
  uf: string
}

declare interface FieldMeta {
  label: FieldMetaLabel
  content: FieldMetaContent
  component: FieldMetaComponent
  viacep: FieldMetaViaCep
}

declare interface LayoutConfig {
  filter_fields: string[]
  grid_fields: string[]
  form_fields: string[]
  /** 'none' | 'field' */
  grouping_type: string
  /** 'list' | 'card' | 'both' */
  display_type: string
  /** 'list' | 'card' */
  default_view: string
  kanban_group_field: string
  master_model_id: string
  detail_display_mode: string
  mindmap_central_field: string
  mindmap_levels: MindmapLevel[]
  /** 'modal' | 'drawer' | 'page' */
  action_interface_type: string
  joins: JoinConfig[]
  fields_metadata: Record<string, FieldMeta>
  analytics_config: AnalyticsConfig
  details_display_mode: Record<string, string>
  details_interface_types: Record<string, 'modal' | 'drawer'>
  details_inline_types: Record<string, boolean>
  details_modal_sizes: Record<string, string>
  details_modal_widths: Record<string, number>
  details_modal_heights: Record<string, number>
  master_tab_title: string
  details_tab_titles: Record<string, string>
  details_item_titles: Record<string, string>
  /** 'csv' | 'xlsx' | 'pdf' */
  export_formats: string[]
  gallery_config: GalleryConfig
  gallery_click_behavior: string
  items_per_page: number | undefined
  form_header_title: string
  form_header_subtitle_field: string
  scheduler_config: SchedulerConfig
  timeline_config: TimelineConfig
  map_config: MapConfig
  blueprint_config: BlueprintConfig
  gantt_config: GanttConfig
  custom_actions: CustomAction[]
  custom_slots: CustomSlot[]
  max_relation_depth: number
  master_use_case_slug?: string
}

declare interface ButtonConfig {
  id: string
  label: string
  labelKey: string
  icon: string
  action?: string
  action_key?: string
  visible: boolean
  custom_label?: string
  custom_icon?: string
  text_color?: string
  bg_color?: string
}

/**
 * Configuração completa de um Caso de Uso no MetaBuilder Pro.
 * 
 * @example
 * const config: WizardConfig = {
 *   name: "Meu Caso de Uso",
 *   slug: "meu-caso-de-uso",
 *   logic_type: "pesquisa_cadastro",
 *   ...
 * }
 */
declare interface WizardConfig {
  name: string
  slug: string
  /**
   * Tipo de lógica do caso de uso.
   * - \`pesquisa\` — somente listagem
   * - \`cadastro\` — somente formulário
   * - \`pesquisa_cadastro\` — listagem + formulário (CRUD completo)
   * - \`kanban\` — quadro kanban
   * - \`analytics\` — dashboard analítico
   * - \`timeline\` — linha do tempo
   * - \`map\` — mapa com coordenadas
   * - \`gantt\` — gráfico de Gantt
   * - \`blueprint\` — fluxograma
   * - \`scheduler\` — calendário/agenda
   * - \`master_detail\` — mestre + detalhes
   * - \`personalizado\` — layout totalmente customizável com abas
   */
  logic_type: string
  has_arguments: boolean
  selected_models: string[]
  tables_config: string[]
  /** 'auto' | 'custom' */
  query_type: string
  custom_query: string
  layout_config: LayoutConfig
  buttons_config: ButtonConfig[]
}
`
