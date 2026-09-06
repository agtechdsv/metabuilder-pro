/**
 * ast.ts
 *
 * Define a Árvore de Sintaxe Abstrata (AST) para o CleanCodeGenerator.
 * Esta estrutura converte o formato MetaBuilder (JSON relacional)
 * em uma representação agnóstica de código, focada em Next.js (App Router).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core Types
// ─────────────────────────────────────────────────────────────────────────────

export type DbType = 'postgres' | 'supabase' | 'oracle' | 'mysql' | 'sqlserver'

export type LogicType =
  | 'pesquisa_cadastro'
  | 'kanban'
  | 'galeria'
  | 'scheduler'
  | 'timeline'
  | 'gantt'
  | 'map'
  | 'mapa'
  | 'blueprint'
  | 'mapa_mental'
  | 'personalizado'
  | 'dashboard_bi'
  | 'analytics'
  | string // fallback para futuros tipos

// ─────────────────────────────────────────────────────────────────────────────
// Field-level metadata (por zona — espelho exato de layout_config.fields_metadata)
// ─────────────────────────────────────────────────────────────────────────────

export interface FieldLabelConfig {
  text?: string
  color?: string
  bold?: boolean
  italic?: boolean
  uppercase?: boolean
}

export interface FieldRelationConfig {
  targetTable: string      // tabela alvo do FK (ex: 'empresas')
  targetModel?: string     // nome do modelo alvo (ex: 'Empresas')
  displayColumn: string    // coluna de exibição (ex: 'nome')
  valueColumn: string      // coluna de valor / PK (ex: 'id')
}

export interface SelectOption {
  value: string
  label: string
  color?: string
}

/** Configuração completa de um campo em uma zona específica */
export interface ResolvedFieldConfig {
  label?: FieldLabelConfig
  width?: number | string      // largura em px ou percentual
  columns?: number | string    // número de colunas (1..12)
  gridSpan?: number | string   // span de colunas no grid de 12 colunas (Studio: component.gridSpan)
  modalGridSpan?: number | string // span de colunas na modal (Studio: component.modalGridSpan)
  format?: string              // 'currency' | 'percent' | 'date_pt' | 'datetime_pt' | etc.
  options?: SelectOption[]     // para campos enum/select
  relation?: FieldRelationConfig
  readOnly?: boolean
  required?: boolean
  placeholder?: string
  multiline?: boolean          // textarea em vez de input
  rows?: number                // linhas do textarea
  // Campos BYOC
  compiledCode?: string
  // Pass-through do config bruto (para campos não mapeados)
  [key: string]: any
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolved Field — resultado das 5 etapas de resolução do Runtime
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Um campo já totalmente resolvido para uma zona específica de uma view.
 * Equivale ao que o Runtime Web passa para ViewPageContent como displayFields/formFields/filterFields.
 */
export interface ResolvedField {
  id: string                   // UUID do field no banco
  dbColumn: string             // nome real da coluna (pode ser 'tabela.coluna' para JOINs)
  sqlExpression: string        // expressão SQL (pode ter AS alias para JOINs)
  label: string                // label customizado ou display_name do campo
  dataType: string             // 'varchar' | 'integer' | 'boolean' | 'date' | 'timestamp' | 'uuid' | 'text' | 'byoc' | 'virtual'
  isPrimaryKey: boolean
  isSortable: boolean
  isVirtual: boolean           // campo calculado (virt_*)
  isByoc: boolean              // campo custom code (byoc_*)
  hidden?: boolean             // campo presente na query mas não renderizado (ex: campos de agrupamento kanban)
  config: ResolvedFieldConfig
}

// ─────────────────────────────────────────────────────────────────────────────
// Buttons — botões configurados pelo dev no Studio (buttons_config)
// ─────────────────────────────────────────────────────────────────────────────

export type ButtonStyle = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
export type ButtonActionType = 'create' | 'update' | 'delete' | 'custom' | 'export' | 'link' | 'download' | 'view' | 'edit' | 'search' | 'clear'

export interface CustomActionParam {
  source: string
  target: string
}

export interface ViewButton {
  id: string
  label: string
  icon?: string
  style: ButtonStyle
  actionType: ButtonActionType
  placement?: 'header' | 'row' | 'form' | 'filter'    // onde o botão aparece
  confirmationMessage?: string              // se presente, exibe diálogo de confirmação
  customLogic?: string                      // código JS da ação customizada (para //TODO)
  linkTarget?: string                       // para actionType = 'link'
  // Configurações de Ação Customizada (Modal / UseCase / Trigger)
  triggerType?: 'sql' | 'usecase' | 'rest' | 'custom'
  usecaseSlug?: string
  usecaseOpenMode?: 'page' | 'modal' | 'drawer'
  usecaseModalSize?: 'sm' | 'md' | 'lg' | 'full' | 'custom'
  usecaseModalWidth?: string
  usecaseModalHeight?: string
  usecaseSelectedFields?: Array<CustomActionParam | string>
  usecaseParams?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Relation Tabs — abas de detalhe (relacionamentos 1:N)
// ─────────────────────────────────────────────────────────────────────────────

export interface SubRelationDetail {
  relatedModelId: string
  relatedTable: string         // ex: 'itens_pedido'
  relatedModelName: string     // ex: 'ItensPedido'
  foreignKey: string           // ex: 'pedido_id'
  label: string                // ex: 'Itens de Pedido'
  gridFields: ResolvedField[]
  formFields?: ResolvedField[]
}

export interface RelationTab {
  relatedModelId: string
  relatedTable: string         // nome real da tabela filha no banco
  relatedModelName: string     // nome Pascal do modelo (para geração de ações)
  foreignKey: string           // coluna FK na tabela filha
  sourceKey: string            // coluna PK na tabela mãe (geralmente 'id')
  displayMode: 'tab' | 'inline'
  label: string                // label da aba (nome do modelo relacionado)
  gridFields: ResolvedField[]  // campos da tabela filha visíveis na aba
  formFields?: ResolvedField[] // campos do formulário da tabela filha
  subDetails?: SubRelationDetail[] // sub-detalhes (ex: itens_pedido para pedidos)
}

// ─────────────────────────────────────────────────────────────────────────────
// Model Node — modelo de dados
// ─────────────────────────────────────────────────────────────────────────────

export interface FieldNode {
  id: string
  name: string
  dbColumn: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'uuid' | 'json' | 'relation'
  dataType: string             // tipo bruto do banco (varchar, integer, etc.)
  isPrimary: boolean
  isRequired: boolean
  isVisibleInList: boolean
  isVisibleInForm: boolean
  isSearchable: boolean
  isSortable: boolean
  config?: ResolvedFieldConfig
  relation?: {
    targetModel: string
    foreignKey: string
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Model Node — modelo de dados
// ─────────────────────────────────────────────────────────────────────────────

export interface ModelNode {
  id: string
  name: string                 // PascalCase (ex: 'Clientes')
  dbTable: string              // nome real da tabela (ex: 'clientes')
  dbSchema: string             // schema (ex: 'public')
  fields: FieldNode[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Node — view/caso de uso resolvido (resultado das 5 etapas)
// ─────────────────────────────────────────────────────────────────────────────

export interface RouteNode {
  path: string                 // ex: '/clientes'
  viewSlug: string             // slug original da view (ex: 'clientes')
  logicType: LogicType         // tipo da view (pesquisa_cadastro, kanban, etc.)
  modelId: string
  modelTable: string           // nome real da tabela no banco
  modelName: string            // PascalCase do modelo
  title: string                // label exibido na tela e na sidebar
  icon?: string                // ícone lucide-react da view
  primaryKey: string           // nome da coluna PK (nem sempre 'id')

  // ── Campos resolvidos por zona (Etapas 3, 4 e 5 do Runtime) ──
  gridFields: ResolvedField[]     // colunas da listagem, em ordem exata
  formFields: ResolvedField[]     // campos do formulário, em ordem exata
  filterFields: ResolvedField[]   // campos da barra de filtros, em ordem exata

  // ── Configuração da tela ──
  displayType: 'list' | 'card' | 'both'

  // ── Configuração específica para Kanban ──
  kanbanGroupField?: string
  kanbanGroupDisplayField?: string
  kanbanCardFields?: string[]

  // ── Configuração específica para Timeline ──
  timelineConfig?: TimelineConfig

  // ── Configuração específica para Analytics / Dashboard BI ──
  analyticsConfig?: AnalyticsConfig

  // ── Configuração específica para Scheduler / Agenda ──
  schedulerConfig?: SchedulerConfig

  // ── Configuração específica para Galeria / Vitrine de Catálogo ──
  galleryConfig?: GalleryConfig

  // ── Configuração específica para Gantt / Cronograma de Projetos ──
  ganttConfig?: GanttConfig

  // ── Configuração específica para Mapa / Visão Geoespacial ──
  mapConfig?: MapConfig

  // ── Configuração específica para Blueprint / Fluxograma de Processos ──
  blueprintConfig?: BlueprintConfig

  // ── Configuração específica para Mapa Mental / Níveis Hierárquicos ──
  mindmapConfig?: MindmapConfig

  // ── Botões configurados pelo dev ──
  buttons: ViewButton[]

  // ── Relacionamentos mestre-detalhe (abas) ──
  relationTabs: RelationTab[]

  // ── Interface de Ação (page, drawer, modal) ──
  actionInterfaceType?: 'page' | 'drawer' | 'modal'

  // ── Raw layout_config (para features futuras / fallback) ──
  rawLayoutConfig?: any
}

export interface AnalyticsWidget {
  id: string
  title: string
  type: 'kpi' | 'bar' | 'pie' | 'line' | 'gauge' | string
  modelId: string
  field: string
  calc: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | string
  groupBy?: string
  width?: 'full' | 'half' | 'third' | 'quarter' | string
  dateGranularity?: string
  sortBy?: string
  limitTopN?: number
  gaugeMin?: number
  gaugeMax?: number
  gaugeTarget?: number
  gaugeStart?: number
  gaugeEnd?: number
  useFormula?: boolean
  formulaTokens?: any[]
  color?: string
}

export interface AnalyticsConfig {
  widgets: AnalyticsWidget[]
  allowRuntimeEdit?: boolean
  /**
   * Campo de data usado pelo filtro global de período (ex: 'data_pedido', 'created_at').
   * Quando ausente, o gerador aplica uma heurística por convenção de nome de coluna.
   * Declare explicitamente para comportamento determinístico.
   */
  dateFilterField?: string
}

export interface TimelineConfig {
  dateField: string              // nome da coluna no banco (dbColumn)
  titleField: string             // nome da coluna no banco (dbColumn)
  descField?: string             // nome da coluna no banco (dbColumn)
  iconField?: string             // nome da coluna no banco (dbColumn)
  layoutStyle?: 'cards' | 'infographic'
  layoutDirection?: 'horizontal' | 'vertical'
  layoutMode?: 'alternating' | 'same_side'
  timelineOrderHorizontal?: 'asc' | 'desc'
  timelineOrderVertical?: 'asc' | 'desc'
  animated?: boolean
  cardScale?: number
}

export interface SchedulerConfig {
  titleField: string        // dbColumn do título do evento (ex: 'descricao', 'status')
  startDateField: string    // dbColumn de data/hora início (ex: 'data_estimada')
  endDateField?: string     // dbColumn de data/hora fim (opcional)
  colorField?: string       // dbColumn de cor / status (opcional, para colorir cards)
}

export interface GalleryConfig {
  imageField?: string         // dbColumn do campo de imagem/URL/base64 (ex: 'foto', 'imagem')
  titleField?: string         // dbColumn do título do card (ex: 'nome', 'descricao')
  cardFields?: string[]       // dbColumns adicionais exibidos como metadados no card
  cardFieldsLabels?: Record<string, string> // labels customizados por campo
  clickBehavior?: 'fullscreen' | 'thumbnail' // comportamento de clique (padrão: 'fullscreen')
}

export interface GanttConfig {
  titleField: string          // dbColumn do título da tarefa/barra (ex: 'titulo', 'nome')
  startDateField: string      // dbColumn da data de início (ex: 'data_inicio', 'start_date')
  endDateField: string        // dbColumn da data de término (ex: 'data_fim', 'end_date')
  progressField?: string      // dbColumn da porcentagem de conclusão (0-100) (ex: 'progresso')
}

export interface MapConfig {
  latField: string            // dbColumn da latitude (ex: 'latitude', 'lat')
  lngField: string            // dbColumn da longitude (ex: 'longitude', 'lng')
  titleField: string          // dbColumn do título/rótulo do marcador (ex: 'nome', 'titulo')
  descField?: string          // dbColumn da descrição ou endereço no popup (opcional)
  zoom?: number               // nível de zoom inicial (default: 13)
}

export interface BlueprintConfig {
  titleField: string            // dbColumn do título/nome da etapa/nó (ex: 'nome', 'titulo')
  predecessorField: string      // dbColumn do nó predecessor/pai (ex: 'predecessor_id', 'parent_id')
  descField?: string            // dbColumn da descrição da etapa (opcional)
  statusField?: string          // dbColumn do status da etapa (opcional)
  scale?: number                // escala do diagrama (default: 1)
  direction?: 'TB' | 'LR' | 'BT' | 'RL' // direção do layout dagre (default: 'TB')
  animatedEdges?: boolean       // arestas animadas (default: true)
}

export interface MindmapLevel {
  modelId?: string
  modelTable?: string
  modelName?: string
  titleField: string
  descField?: string
  relationType?: 'direct' | 'indirect' | 'multilevel'
  foreignKey?: string
  throughTable?: string
  throughLocalFk?: string
  throughTargetFk?: string
  relationPath?: Array<{
    table: string
    to_field: string
    from_field?: string
    target_to_field?: string
    target_from_field: string
  }>
}

export interface MindmapConfig {
  centralFieldId?: string
  levels?: MindmapLevel[]
  hierarchyFields?: string[] // dbColumns para agrupamento por colunas (modo pivot)
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Node — server actions geradas para cada modelo
// ─────────────────────────────────────────────────────────────────────────────

export interface ActionNode {
  id: string
  name: string                 // ex: 'createClientes'
  modelId: string
  type: 'insert' | 'update' | 'delete' | 'custom'
  params: string[]
  body?: string                // código customizado (se houver)
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Config
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthConfig {
  authType: string             // 'database' | 'managed' | 'ldap' | 'none'
  tableName?: string
  emailColumn?: string
  passwordColumn?: string
  hashFormat?: string          // 'bcrypt' | 'md5' | 'sha256' | 'plain'
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation — espelho exato da estrutura navigation do projeto
// ─────────────────────────────────────────────────────────────────────────────

export interface NavigationItem {
  id: string
  label: string
  icon?: string
  type: 'view' | 'folder' | 'link'
  target?: string              // slug da view (para type='view') ou URL (para type='link')
  view_id?: string             // ID da view (alternativa ao target)
  children?: NavigationItem[]  // apenas para type='folder'
}

// ─────────────────────────────────────────────────────────────────────────────
// App AST — projeto único
// ─────────────────────────────────────────────────────────────────────────────

export interface AppAST {
  projectName: string
  projectSlug: string          // ex: 'crm' — usado como sub-rota no workspace
  projectDescription?: string   // ex: 'CRM COMPLETO'
  projectIcon?: string         // ícone SVG ou nome lucide-react do projeto
  dbStack: DbType
  dbConnectionString?: string
  supabaseUrl?: string
  supabaseAnonKey?: string
  authConfig?: AuthConfig
  navigation: NavigationItem[] // estrutura de menu (espelho do project.navigation)
  models: ModelNode[]
  routes: RouteNode[]
  actions: ActionNode[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace AST — multi-projeto
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkspaceProjectNode {
  slug: string                 // ex: 'crm'
  name: string                 // ex: 'CRM Completo'
  description?: string
  app: AppAST
}

export interface WorkspaceAST {
  workspaceName: string        // ex: 'AGTech Projetos'
  workspaceSlug: string        // ex: 'agtechtrade'
  dbStack: DbType
  dbConnectionString?: string
  supabaseUrl?: string
  supabaseAnonKey?: string
  projects: WorkspaceProjectNode[]
}
