/**
 * Ajuda Interativa: um tutorial que executa passos na tela (clicar, digitar, escolher) com legendas, em modo demonstração.
 * O roteiro fica em `layout_config.interactive_help` do caso de uso e viaja junto com a configuração.
 */

import type { HelpText } from '../helpText'

// A ORDEM é a sugerida para um cadastro com pesquisa: primeiro achar e olhar o que já existe, depois criar, mudar e, por último, excluir
// (a ação destrutiva). O dev pode reordenar como quiser; esta é só a sequência inicial.
export const TOUR_ACTIONS = ['search', 'view', 'create', 'edit', 'move', 'delete'] as const
export type TourAction = (typeof TOUR_ACTIONS)[number]

export type TourSpeed = 'slow' | 'normal' | 'fast'
/** Multiplicador dos tempos (digitação e pausas): Lento 2×, Normal 1×, Rápido 0,4× */
export const SPEED_FACTOR: Record<TourSpeed, number> = { slow: 2, normal: 1, fast: 0.4 }

/** Botões fixos da tela, identificados pelo atributo `data-tour` */
export type TourButtonRef = 'new' | 'save' | 'back' | 'search' | 'clear' | 'confirm' | 'cancel' | 'kanban-add' | 'kanban-edit' | 'kanban-delete' | 'kanban-card' | 'scheduler-add' | 'scheduler-event' | 'scheduler-delete' | 'widget'
export type TourRowAction = 'view' | 'edit' | 'delete'

export type TourTarget =
  | { type: 'button'; ref: TourButtonRef }
  /** campo do formulário; `ref` é o id do campo no Studio (atributo `data-tour-field`) */
  | { type: 'field'; ref: string }
  /** campo do filtro de busca (atributo `data-tour-filter`) */
  | { type: 'filter'; ref: string }
  /** a primeira linha do grid: com `action`, o botão daquela ação; sem ela, a linha inteira (para destacar o resultado) */
  | { type: 'row'; ref: 'first'; action?: TourRowAction }
  /** aba de detalhe (ex.: Pedidos dentro de Clientes); `ref` é o id do MODELO do detalhe (atributo `data-tour-detail`) */
  | { type: 'tab'; ref: string }
  /** botão + que adiciona um item daquele detalhe (`data-tour-add`); `ref` é o id do MODELO do detalhe. Cada nível (Pedidos, Itens do Pedido) tem o seu */
  | { type: 'detail-add'; ref: string }
  /** seta que expande o primeiro registro existente daquele detalhe, para editá-lo no lugar (`data-tour-expand`) */
  | { type: 'detail-expand'; ref: string }
  /** coluna do Kanban (`data-tour-column`): 'other' = uma coluna diferente da do cartão arrastado */
  | { type: 'kanban-column'; ref: 'other' }

export type TourStepKind = 'click' | 'type' | 'select' | 'check' | 'note' | 'drag'

export interface TourStep {
  id: string
  kind: TourStepKind
  target?: TourTarget
  /** arrastar (`kind: 'drag'`): onde soltar o elemento de `target` */
  to?: TourTarget
  /** texto a digitar (type) ou valor/opção a escolher (select: `{ pick: 'first' }` = a primeira opção que não seja vazia) */
  value?: string | { pick: 'first' }
  /** legenda mostrada ao lado do elemento, nos três idiomas */
  caption?: HelpText
  /** gerado pelo gerador automático; "Regenerar" refaz só estes e preserva os passos manuais */
  auto?: boolean
  /** o dev mudou o valor de um passo automático: "Regenerar" mantém o valor dele */
  edited?: boolean
  /** a legenda é a ajuda ATUAL do campo, lida na hora de tocar (`caption` fica só como reserva, para campo sem ajuda) */
  liveCaption?: boolean
}

export type TourFill = 'required' | 'all' | 'custom'

export interface Tour {
  id: string
  action: TourAction
  title: HelpText
  fill: TourFill
  /** em "editar": quantos campos o tutorial altera (padrão 2) */
  editFieldCount?: number
  /** o dev desligou este roteiro sem apagar: não aparece para o usuário (nem em "Reproduzir todos") */
  hidden?: boolean
  /** frase curta do que o tutorial ensina (aparece no cartão); gerada junto com o roteiro */
  summary?: HelpText
  /** o dev escreveu a frase: "Regenerar" a mantém (senão ela é refeita junto com o roteiro) */
  summaryCustom?: boolean
  /** assinatura da configuração do caso de uso usada ao gerar (camada barata do "pode estar desatualizado"; ver signature.ts) */
  sourceSig?: string
  steps: TourStep[]
  /** linha sintética (coluna → texto) que as ações de editar, excluir e ver usam no modo demonstração */
  seed?: Record<string, string>
  /** linhas de exemplo das abas de detalhe (pedidos, itens...), por tabela, para editar/ver mostrarem a aba preenchida */
  /** colunas da linha de exemplo cujo valor é "agora" (agenda): atualizado na hora de abrir a demonstração, para o evento aparecer no período atual */
  seedToday?: Record<string, 'date' | 'datetime'>
  seedDetails?: Array<{ table: string; pk?: string; row: Record<string, string> }>
}

export interface InteractiveHelpConfig {
  tours: Tour[]
  /** esconde o ícone sem apagar os roteiros */
  hidden?: boolean
}

/** Lê e valida o que veio do banco: nunca confia no formato (o JSON é editável). */
export function normalizeInteractiveHelp(raw: unknown): InteractiveHelpConfig {
  const out: InteractiveHelpConfig = { tours: [] }
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Record<string, unknown>
  if (r.hidden === true) out.hidden = true
  if (!Array.isArray(r.tours)) return out
  for (const t of r.tours) {
    if (!t || typeof t !== 'object') continue
    const tour = t as Record<string, unknown>
    if (typeof tour.id !== 'string' || !(TOUR_ACTIONS as readonly string[]).includes(tour.action as string)) continue
    if (!Array.isArray(tour.steps)) continue
    const steps = (tour.steps as unknown[]).filter((s): s is TourStep => {
      const st = s as Record<string, unknown>
      return !!st && typeof st.id === 'string' && ['click', 'type', 'select', 'check', 'note', 'drag'].includes(st.kind as string)
    })
    out.tours.push({
      id: tour.id,
      action: tour.action as TourAction,
      title: (tour.title && typeof tour.title === 'object' ? tour.title : {}) as HelpText,
      fill: tour.fill === 'all' || tour.fill === 'custom' ? tour.fill : 'required',
      hidden: tour.hidden === true ? true : undefined,
      summary: tour.summary && typeof tour.summary === 'object' ? (tour.summary as HelpText) : undefined,
      summaryCustom: tour.summaryCustom === true ? true : undefined,
      sourceSig: typeof tour.sourceSig === 'string' ? tour.sourceSig : undefined,
      editFieldCount: typeof tour.editFieldCount === 'number' && tour.editFieldCount > 0 ? Math.min(20, Math.floor(tour.editFieldCount)) : undefined,
      steps,
      seed: tour.seed && typeof tour.seed === 'object' ? (tour.seed as Record<string, string>) : undefined,
      seedToday: tour.seedToday && typeof tour.seedToday === 'object' ? (tour.seedToday as Tour['seedToday']) : undefined,
      seedDetails: Array.isArray(tour.seedDetails) ? (tour.seedDetails as Tour['seedDetails']) : undefined,
    })
  }
  return out
}

/**
 * Roteiros que o usuário vê, NA ORDEM que o dev definiu (a ordem da lista é a ordem de exibição e de execução).
 * Ficam de fora os desligados e os sem passos.
 */
export function visibleTours(raw: unknown): Tour[] {
  const cfg = normalizeInteractiveHelp(raw)
  return cfg.hidden ? [] : cfg.tours.filter(t => !t.hidden && t.steps.length > 0)
}

/** O ícone ▶ só aparece se houver pelo menos um roteiro visível com passos. */
export function hasInteractiveHelp(raw: unknown): boolean {
  return visibleTours(raw).length > 0
}

/** Ações de roteiro que cada tipo de caso de uso suporta (o que não está aqui não tem ajuda interativa). */
export const TOUR_ACTIONS_BY_TYPE: Record<string, readonly TourAction[]> = {
  pesquisa_cadastro: ['search', 'view', 'create', 'edit', 'delete'],
  analytics: ['search'],
  kanban: ['create', 'edit', 'move', 'delete'],
  scheduler: ['create', 'edit', 'delete'],
}

export const supportsInteractiveHelp = (logicType?: string): boolean => !!logicType && logicType in TOUR_ACTIONS_BY_TYPE
export const tourActionsFor = (logicType?: string): readonly TourAction[] => (logicType && TOUR_ACTIONS_BY_TYPE[logicType]) || []
