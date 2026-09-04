// ─── Shared Types for UseCaseBuilderWizard ─────────────────────────────────

export interface UseCaseBuilderWizardProps {
  initialData?: UseCaseInitialData
  onClose: () => void
  onSaveSuccess: () => void
  canCreate?: boolean
  projectRelations?: Relation[]
}

// ─── Domain models ──────────────────────────────────────────────────────────

export interface Field {
  id: string
  db_column_name: string
  display_name?: string
  data_type?: string
  is_visible_in_list?: boolean
  is_visible_in_form?: boolean
  is_searchable?: boolean
  widget_options?: any
}

export interface Model {
  id: string
  db_table_name: string
  db_schema_name?: string
  display_name?: string
  description?: string
  can_create?: boolean
  can_update?: boolean
  can_delete?: boolean
  fields: Field[]
}

export interface Relation {
  id?: string
  project_id?: string
  from_model_id?: string
  to_model_id?: string
  foreign_table_id?: string
  referenced_table_id?: string
  foreign_column_id?: string
  referenced_column_id?: string
}

export interface Enumeration {
  id: string
  name: string
  values: string[]
}

export interface UseCase {
  id?: string
  name: string
  slug: string
  logic_type?: string
  model_id?: string
  draft_config?: any
}

export interface BpmWorkflow {
  id: string
  name: string
}

// ─── Wizard Config ───────────────────────────────────────────────────────────

export interface SchedulerConfig {
  title_field: string
  start_date_field: string
  end_date_field: string
  color_field: string
}

export interface TimelineConfig {
  date_field: string
  title_field: string
  desc_field: string
  icon_field: string
}

export interface MapConfig {
  lat_field: string
  lng_field: string
  title_field: string
  desc_field: string
}

export interface GanttConfig {
  title_field: string
  start_date_field: string
  end_date_field: string
  progress_field: string
  predecessor_field: string
}

export interface BlueprintConfig {
  title_field: string
  desc_field: string
  status_field: string
  predecessor_field: string
}

export interface AnalyticsConfig {
  widgets: BiWidget[]
  allow_runtime_edit: boolean
  /**
   * Campo de data para pushdown de filtro no banco.
   * Ex: 'data_pedido', 'created_at'. Sem declaração, a heurística JS é usada.
   */
  date_filter_field?: string
}

export interface BiWidget {
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

export interface JoinConfig {
  id?: string
  from?: string
  localKey?: string
  to?: string
  foreignKey?: string
  source_model_id?: string
  target_model_id?: string
}

export interface GalleryConfig {
  image_field?: string
  title_field?: string
  subtitle_field?: string
  [key: string]: any
}

export interface CustomAction {
  id: string
  label?: string
  icon?: string
  type?: string
  target?: string
  bpm_workflow_id?: string
  confirmation_required?: boolean
  confirmation_message?: string
  navigate_to?: string
  http_method?: string
  http_url?: string
  http_body?: string
  button_color?: string
  text_color?: string
  bg_color?: string
  show_in?: string
  [key: string]: any
}

export interface CustomSlot {
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

export interface RelationHop {
  table: string
  from_field: string
  to_field: string
  target_from_field?: string
  target_to_field?: string
}

export interface MindmapLevel {
  model_id?: string
  label_field?: string
  [key: string]: any
}

export interface LayoutConfig {
  filter_fields: string[]
  grid_fields: string[]
  form_fields: string[]
  grouping_type: string
  display_type: string
  default_view: string
  kanban_group_field: string
  master_model_id: string
  detail_display_mode: string
  mindmap_central_field: string
  mindmap_levels: MindmapLevel[]
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
  // personalizado
  master_use_case_slug?: string
}

export interface ButtonConfig {
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

export interface WizardConfig {
  name: string
  slug: string
  logic_type: string
  has_arguments: boolean
  selected_models: string[]
  tables_config: string[]
  query_type: string
  custom_query: string
  layout_config: LayoutConfig
  buttons_config: ButtonConfig[]
}

// ─── Field Metadata ──────────────────────────────────────────────────────────

export interface FieldMetaLabel {
  text: string
  font: string
  size: string
  color: string
}

export interface FieldMetaContent {
  font: string
  size: string
  color: string
  mask: string
  required: boolean
  readonly: boolean
}

export interface FieldMetaComponent {
  type: string
  rows: number
  width: string
  options_type: string
  fixed_options: string
  rel_table: string
  rel_label: string
  rel_value: string
}

export interface FieldMetaViaCep {
  enabled: boolean
  logradouro: string
  bairro: string
  cidade: string
  uf: string
}

export interface FieldMeta {
  label: FieldMetaLabel
  content: FieldMetaContent
  component: FieldMetaComponent
  viacep: FieldMetaViaCep
}

// ─── Initial data (from Supabase ui_views row) ──────────────────────────────

export interface UseCaseInitialData {
  id: string
  name: string
  slug: string
  logic_type?: string
  has_arguments?: boolean
  tables_config?: string[]
  query_type?: string
  custom_query?: string
  layout_config?: LayoutConfig
  buttons_config?: ButtonConfig[]
  model_id?: string
  status?: string
  draft_config?: Partial<UseCaseInitialData> | null
  is_quick_add?: boolean
}

// ─── Wizard Step ──────────────────────────────────────────────────────────────

export interface WizardStep {
  id: number
  title: string
  icon: React.ReactNode
  hidden?: boolean
}

// ─── Step component shared props ─────────────────────────────────────────────

export interface StepBaseProps {
  config: WizardConfig
  setConfig: React.Dispatch<React.SetStateAction<WizardConfig>>
}

export interface StepWithModelsProps extends StepBaseProps {
  models: Model[]
}
