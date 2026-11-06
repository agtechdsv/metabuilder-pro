/**
 * Gerador automático de roteiros da Ajuda Interativa.
 *
 * Parte SEMPRE de uma ação (cadastrar, editar, excluir, pesquisar, ver) e monta os passos a partir da configuração do caso de uso.
 * É função pura: o Studio mostra o resultado como uma lista editável. Os passos gerados levam `auto: true`, então "Regenerar"
 * refaz só estes e mantém o que o dev ajustou à mão.
 */

import type { HelpText } from '../helpText'
import { editedValue, sampleValue, type SampleField } from './sampleValues'
import { layoutSignature } from './signature'
import type { Tour, TourAction, TourFill, TourStep, TourTarget } from './types'

export interface TourFieldInfo extends SampleField {
  /** id do campo no Studio (é o que o player usa para achar o elemento) */
  id: string
  required?: boolean
  readOnly?: boolean
  isPrimaryKey?: boolean
  /** campo calculado: não se digita, só se observa */
  isVirtual?: boolean
  hidden?: boolean
  /** campo de um modelo de DETALHE (aba como "Pedidos" dentro de "Clientes"): a v1 só ensina a aba principal */
  isDetail?: boolean
  /** a ajuda do campo vira a legenda do passo */
  help?: HelpText
  /** id do campo "pai" em listas em cascata: o pai é preenchido antes */
  dependsOn?: string
}

export interface AutoTourOptions {
  action: TourAction
  fill?: TourFill
  /** ids escolhidos quando `fill` é 'custom' */
  customFieldIds?: string[]
  /** quantos campos alterar em "editar" (padrão 2) */
  editFieldCount?: number
  /** nome do caso de uso, para o título */
  screenName?: string
  /** `layout_config` do caso de uso: com ele, o roteiro guarda a assinatura da configuração usada (detecção barata de "desatualizado") */
  layoutConfig?: any
  today?: Date
}

type Cap = HelpText
const cap = (pt: string, en: string, es: string): Cap => ({ pt, en, es })

const BUTTON_CAPTION: Record<string, Cap> = {
  new: cap('Clique em Novo Registro para começar.', 'Click New Record to start.', 'Haga clic en Nuevo Registro para empezar.'),
  save: cap('Clique em Salvar Alterações para gravar.', 'Click Save Changes to store it.', 'Haga clic en Guardar Cambios para registrar.'),
  back: cap('Volte para a lista.', 'Go back to the list.', 'Vuelva a la lista.'),
  search: cap('Clique em Pesquisar para aplicar o filtro.', 'Click Search to apply the filter.', 'Haga clic en Buscar para aplicar el filtro.'),
  clear: cap('Clique em Limpar para remover o filtro.', 'Click Clear to remove the filter.', 'Haga clic en Limpiar para quitar el filtro.'),
  confirm: cap('Confirme a exclusão.', 'Confirm the deletion.', 'Confirme la eliminación.'),
}
const ROW_CAPTION: Record<string, Cap> = {
  edit: cap('Clique no lápis para editar o registro.', 'Click the pencil to edit the record.', 'Haga clic en el lápiz para editar el registro.'),
  view: cap('Clique na lupa para ver os detalhes.', 'Click the magnifier to see the details.', 'Haga clic en la lupa para ver los detalles.'),
  delete: cap('Clique na lixeira para excluir o registro.', 'Click the trash can to delete the record.', 'Haga clic en la papelera para eliminar el registro.'),
}
const RESULT_CAPTION: Record<TourAction, Cap> = {
  create: cap('O novo registro aparece na lista.', 'The new record shows up in the list.', 'El nuevo registro aparece en la lista.'),
  edit: cap('As alterações já aparecem na lista.', 'The changes already show in the list.', 'Los cambios ya aparecen en la lista.'),
  delete: cap('O registro some da lista.', 'The record disappears from the list.', 'El registro desaparece de la lista.'),
  search: cap('Só os registros que combinam com o filtro aparecem.', 'Only the records matching the filter appear.', 'Solo aparecen los registros que coinciden con el filtro.'),
  view: cap('Os dados aparecem só para leitura.', 'The data is shown read-only.', 'Los datos se muestran solo para lectura.'),
}
const FILL_CAPTION = (label: string): Cap => cap(`Preencha "${label}".`, `Fill in "${label}".`, `Complete "${label}".`)
const PICK_CAPTION = (label: string): Cap => cap(`Escolha uma opção em "${label}".`, `Pick an option in "${label}".`, `Elija una opción en "${label}".`)
const CALC_CAPTION = (label: string): Cap => cap(`"${label}" é calculado automaticamente.`, `"${label}" is calculated automatically.`, `"${label}" se calcula automáticamente.`)

const TITLE: Record<TourAction, Cap> = {
  create: cap('Como cadastrar', 'How to register', 'Cómo registrar'),
  edit: cap('Como editar', 'How to edit', 'Cómo editar'),
  delete: cap('Como excluir', 'How to delete', 'Cómo eliminar'),
  search: cap('Como pesquisar', 'How to search', 'Cómo buscar'),
  view: cap('Como ver os detalhes', 'How to see the details', 'Cómo ver los detalles'),
}

const titleFor = (action: TourAction, screenName?: string): HelpText =>
  screenName ? { pt: `${TITLE[action].pt}: ${screenName}`, en: `${TITLE[action].en}: ${screenName}`, es: `${TITLE[action].es}: ${screenName}` } : TITLE[action]

const isListLike = (f: TourFieldInfo) => /select|combo|dropdown|autocomplete|radio/i.test(f.component || '')
const isCheck = (f: TourFieldInfo) => /checkbox|boolean|switch/i.test(f.component || '') || (f.dataType || '').toLowerCase() === 'boolean'
const fillable = (f: TourFieldInfo) => !f.isPrimaryKey && !f.isVirtual && !f.readOnly && !f.hidden && !f.isDetail

/** Coloca cada campo "filho" logo depois do "pai" (listas em cascata), mantendo a ordem do formulário no resto. */
function orderByDependency(fields: TourFieldInfo[]): TourFieldInfo[] {
  const out: TourFieldInfo[] = []
  const placed = new Set<string>()
  const byId = new Map(fields.map(f => [f.id, f]))
  const place = (f: TourFieldInfo, guard = 0) => {
    if (placed.has(f.id) || guard > 10) return
    const parent = f.dependsOn ? byId.get(f.dependsOn) : undefined
    if (parent) place(parent, guard + 1)
    placed.add(f.id)
    out.push(f)
  }
  fields.forEach(f => place(f))
  return out
}

/** Quais campos entram no cadastro, conforme o preenchimento escolhido. Sem nenhum obrigatório marcado, cai nos 3 primeiros (roteiro vazio não ajuda ninguém). */
export function selectFillFields(formFields: TourFieldInfo[], fill: TourFill, customIds: string[] = []): TourFieldInfo[] {
  const candidates = formFields.filter(fillable)
  let chosen: TourFieldInfo[]
  if (fill === 'all') chosen = candidates
  else if (fill === 'custom') chosen = candidates.filter(f => customIds.includes(f.id))
  else {
    chosen = candidates.filter(f => f.required)
    if (chosen.length === 0) chosen = candidates.slice(0, 3)
  }
  // lista em cascata: as opções do filho dependem do pai, então o pai entra junto mesmo que não tenha sido escolhido
  const byId = new Map(candidates.map(c => [c.id, c]))
  const ids = new Set(chosen.map(c => c.id))
  const addParents = (f: TourFieldInfo, guard = 0) => {
    const p = f.dependsOn ? byId.get(f.dependsOn) : undefined
    if (p && !ids.has(p.id) && guard < 10) { ids.add(p.id); addParents(p, guard + 1) }
  }
  chosen.forEach(f => addParents(f))
  return orderByDependency(candidates.filter(c => ids.has(c.id)))
}

/** Frase do cartão do tutorial, nos três idiomas, a partir do que o roteiro realmente faz. */
function buildSummary(action: TourAction, steps: TourStep[], firstFilterLabel?: string): HelpText {
  const fields = steps.filter(s => s.target?.type === 'field' && s.kind !== 'note').length
  const n = (one: string, many: string) => (fields === 1 ? one : many.replace('{n}', String(fields)))
  switch (action) {
    case 'search':
      return firstFilterLabel
        ? { pt: `Filtra a lista por "${firstFilterLabel}".`, en: `Filters the list by "${firstFilterLabel}".`, es: `Filtra la lista por "${firstFilterLabel}".` }
        : { pt: 'Filtra a lista pelos campos de busca.', en: 'Filters the list using the search fields.', es: 'Filtra la lista con los campos de búsqueda.' }
    case 'view': return { pt: 'Abre um registro só para leitura.', en: 'Opens a record in read-only mode.', es: 'Abre un registro solo de lectura.' }
    case 'create': return { pt: `Preenche ${n('1 campo', '{n} campos')} e salva um novo registro.`, en: `Fills in ${n('1 field', '{n} fields')} and saves a new record.`, es: `Completa ${n('1 campo', '{n} campos')} y guarda un nuevo registro.` }
    case 'edit': return { pt: `Altera ${n('1 campo', '{n} campos')} de um registro e salva.`, en: `Changes ${n('1 field', '{n} fields')} of a record and saves.`, es: `Modifica ${n('1 campo', '{n} campos')} de un registro y guarda.` }
    default: return { pt: 'Remove um registro, com confirmação.', en: 'Deletes a record, with confirmation.', es: 'Elimina un registro, con confirmación.' }
  }
}

let seq = 0
const stepId = () => `auto-${++seq}-${Math.random().toString(36).slice(2, 6)}`

// A legenda de um passo de campo é a ajuda ATUAL do campo, lida na hora de tocar (liveCaption). O que fica guardado aqui é só a frase
// de reserva (pelo rótulo), usada quando o campo não tem ajuda: assim editar a ajuda do campo não deixa o tutorial desatualizado.
function fieldStep(f: TourFieldInfo, value: string | null, kindTarget: 'field' | 'filter' = 'field'): TourStep {
  const target: TourTarget = { type: kindTarget, ref: f.id }
  if (isCheck(f)) return { id: stepId(), kind: 'check', target, caption: FILL_CAPTION(f.label), auto: true, liveCaption: true }
  if (isListLike(f) || value === null) return { id: stepId(), kind: 'select', target, value: { pick: 'first' }, caption: PICK_CAPTION(f.label), auto: true, liveCaption: true }
  return { id: stepId(), kind: 'type', target, value, caption: FILL_CAPTION(f.label), auto: true, liveCaption: true }
}

/** Linha sintética usada no modo demonstração (editar, excluir, ver, pesquisar): só colunas que têm valor de exemplo. */
export function buildSeed(fields: TourFieldInfo[], today?: Date): Record<string, string> {
  const seed: Record<string, string> = {}
  for (const f of fields) {
    if (f.isPrimaryKey || f.isVirtual || isListLike(f) || isCheck(f)) continue
    const v = sampleValue(f, today)
    if (v !== null) seed[f.column] = v
  }
  return seed
}

export interface AutoTourInput {
  /** campos do formulário, na ordem em que aparecem */
  formFields: TourFieldInfo[]
  /** campos do filtro de busca, na ordem */
  filterFields?: TourFieldInfo[]
  /** campos do grid (entram na linha sintética) */
  gridFields?: TourFieldInfo[]
}

export function buildAutoTour(input: AutoTourInput, options: AutoTourOptions): Tour {
  const { action } = options
  const fill: TourFill = options.fill ?? 'required'
  const steps: TourStep[] = []
  const btn = (ref: 'new' | 'save' | 'back' | 'search' | 'clear' | 'confirm'): TourStep => ({ id: stepId(), kind: 'click', target: { type: 'button', ref }, caption: BUTTON_CAPTION[ref], auto: true })
  const row = (act: 'view' | 'edit' | 'delete'): TourStep => ({ id: stepId(), kind: 'click', target: { type: 'row', ref: 'first', action: act }, caption: ROW_CAPTION[act], auto: true })
  const result = (): TourStep => ({ id: stepId(), kind: 'note', target: { type: 'row', ref: 'first' }, caption: RESULT_CAPTION[action], auto: true })

  const seedFields = [...input.formFields, ...(input.gridFields || [])]

  if (action === 'create') {
    steps.push(btn('new'))
    const chosen = selectFillFields(input.formFields, fill, options.customFieldIds)
    for (const f of chosen) steps.push(fieldStep(f, sampleValue(f, options.today)))
    for (const f of input.formFields.filter(x => x.isVirtual && !x.hidden && !x.isDetail)) {
      steps.push({ id: stepId(), kind: 'note', target: { type: 'field', ref: f.id }, caption: CALC_CAPTION(f.label), auto: true, liveCaption: true })
    }
    steps.push(btn('save'), btn('back'), result())
  } else if (action === 'edit') {
    steps.push(row('edit'))
    const count = Math.max(1, options.editFieldCount ?? 2)
    const textual = input.formFields.filter(f => fillable(f) && !isListLike(f) && !isCheck(f))
    const pool = textual.length ? textual : input.formFields.filter(fillable)
    for (const f of pool.slice(0, count)) steps.push(fieldStep(f, editedValue(f, options.today)))
    steps.push(btn('save'), btn('back'), result())
  } else if (action === 'delete') {
    steps.push(row('delete'), btn('confirm'), result())
  } else if (action === 'view') {
    steps.push(row('view'), { id: stepId(), kind: 'note', caption: RESULT_CAPTION.view, auto: true }, btn('back'))
  } else {
    const filters = (input.filterFields || []).filter(f => !f.hidden)
    const first = filters.filter(f => !isListLike(f))[0] || filters[0]
    if (first) steps.push(fieldStep(first, sampleValue(first, options.today), 'filter'))
    steps.push(btn('search'), result(), btn('clear'))
  }

  return {
    id: `auto-${action}`,
    action,
    title: titleFor(action, options.screenName),
    fill,
    editFieldCount: action === 'edit' ? Math.max(1, options.editFieldCount ?? 2) : undefined,
    sourceSig: options.layoutConfig ? layoutSignature(options.layoutConfig, action, options.screenName) : undefined,
    summary: buildSummary(action, steps, action === 'search' ? (input.filterFields || []).filter(f => !f.hidden)[0]?.label : undefined),
    steps,
    // a linha sintética usa os mesmos valores do cadastro, para a pesquisa e a edição enxergarem o que o tutorial mostra
    seed: action === 'create' ? undefined : buildSeed(seedFields, options.today),
  }
}

/** Regenera um roteiro preservando os passos manuais (os `auto: false`/sem marca ficam na mesma posição relativa, ao fim). */
export function regenerateTour(previous: Tour, input: AutoTourInput, options: AutoTourOptions): Tour {
  const fresh = buildAutoTour(input, { ...options, action: previous.action, fill: previous.fill, editFieldCount: options.editFieldCount ?? previous.editFieldCount })
  const manual = previous.steps.filter(s => !s.auto)
  // valores que o dev ajustou em passos automáticos continuam valendo nos passos equivalentes
  const keep = new Map<string, TourStep['value']>()
  for (const s of previous.steps) if (s.auto && s.edited && s.target && 'ref' in s.target) keep.set(`${s.kind}:${s.target.type}:${s.target.ref}`, s.value)
  const steps = fresh.steps.map(s => {
    const key = s.target && 'ref' in s.target ? `${s.kind}:${s.target.type}:${s.target.ref}` : ''
    return key && keep.has(key) ? { ...s, value: keep.get(key), edited: true } : s
  })
  const keepPhrase = previous.summaryCustom === true && !!previous.summary
  return {
    ...fresh,
    id: previous.id,
    // o título acompanha o nome da tela (renomeou o caso de uso? regenerar atualiza)
    title: fresh.title,
    hidden: previous.hidden,
    summary: keepPhrase ? previous.summary : fresh.summary,
    summaryCustom: keepPhrase ? true : undefined,
    steps: [...steps, ...manual],
  }
}

const targetKey = (s: TourStep) => (s.target ? `${s.target.type}:${'ref' in s.target ? s.target.ref : ''}:${(s.target as { action?: string }).action ?? ''}` : '')

/**
 * O roteiro ficou DESATUALIZADO? Compara o que está guardado com o que seria gerado agora, olhando só a parte automática:
 * os passos (tipo e alvo), as legendas de reserva, a frase do cartão (se não for do dev), o título e as colunas da linha de exemplo.
 * Valores digitados e datas ficam de fora (uma data de exemplo muda todo dia e não significa que a tela mudou).
 * Os passos manuais e as edições do dev não contam.
 */
export function isTourStale(previous: Tour, input: AutoTourInput, options: AutoTourOptions): boolean {
  const fresh = buildAutoTour(input, { ...options, action: previous.action, fill: previous.fill, editFieldCount: options.editFieldCount ?? previous.editFieldCount })
  // a frase escrita pelo dev não é comparada (nos dois lados), senão o roteiro ficaria desatualizado para sempre
  const skipSummary = previous.summaryCustom === true
  const shape = (t: Tour) => JSON.stringify({
    title: t.title,
    summary: skipSummary ? null : t.summary,
    seed: Object.keys(t.seed || {}).sort(),
    steps: t.steps.filter(s => s.auto).map(s => [s.kind, targetKey(s), !!s.liveCaption, s.caption]),
  })
  return shape(previous) !== shape(fresh)
}
