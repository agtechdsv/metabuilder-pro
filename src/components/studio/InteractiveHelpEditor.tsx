'use client'

import React, { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, PlayCircle, RefreshCw, Trash2, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveHelp } from '@/lib/helpText'
import { isLikelyStale, layoutSignature } from '@/lib/interactiveHelp/signature'
import { buildAutoTour, isTourStale, regenerateTour, type AutoTourInput } from '@/lib/interactiveHelp/autoTour'
import { buildFieldInfos, buildSchedulerSeed } from '@/lib/interactiveHelp/fieldInfo'
import { moveItem, sortBySuggestedOrder } from '@/lib/interactiveHelp/order'
import { HelpTextEditor } from './UseCaseBuilder/steps/HelpTextEditor'
import { InteractiveHelpRecorder } from './InteractiveHelpRecorder'
import { normalizeInteractiveHelp, tourActionsFor, type InteractiveHelpConfig, type Tour, type TourAction, type TourFill, type TourStep } from '@/lib/interactiveHelp/types'

interface Props {
  config: any
  setConfig: (config: any) => void
  models: any[]
  /** endereço da tela em modo demonstração, para gravar um roteiro (sem ele o botão Gravar não aparece) */
  recordUrl?: string
  /** o caso de uso escolhido (nome e tipo) */
  view: { name?: string; logic_type?: string; model_id?: string | null }
  t: (key: string, fallback?: string) => string
}

const ACTION_FALLBACK: Record<TourAction, string> = { create: 'Cadastrar', edit: 'Editar', delete: 'Excluir', search: 'Pesquisar', view: 'Ver detalhes', move: 'Mover cartão', custom: 'Gravado' }
const BUTTON_FALLBACK: Record<string, string> = { new: 'Novo Registro', save: 'Salvar Alterações', back: 'Voltar para Lista', search: 'Pesquisar', clear: 'Limpar', confirm: 'Confirmar exclusão', cancel: 'Cancelar', 'kanban-add': 'Adicionar cartão (+)', 'kanban-edit': 'Editar cartão', 'kanban-delete': 'Excluir cartão', 'kanban-card': 'Cartão', 'scheduler-add': 'Adicionar evento (+)', 'scheduler-event': 'Evento', 'scheduler-delete': 'Excluir evento', widget: 'Gráficos do painel', 'widget-expand': 'Ampliar gráfico (lupa)', 'widget-collapse': 'Recolher gráfico', 'item-view': 'Ver item (lupa)', 'item-edit': 'Editar item', 'item-delete': 'Excluir item', 'map-marker': 'Marcador do mapa', 'map-cluster': 'Grupo de marcadores (se houver)' }

/**
 * Ajuda Interativa no Studio: o dev gera o roteiro de cada ação a partir da configuração do caso de uso, define a ORDEM em que eles
 * aparecem e rodam, revisa os passos (muda o valor digitado, reordena, apaga), liga/desliga cada roteiro e salva junto com a ajuda,
 * sem republicar. v1: só casos de uso de cadastro com pesquisa.
 */
export function InteractiveHelpEditor(props: Props) {
  // o conteúdo real fica em outro componente: assim a troca entre um caso de uso de cadastro e outro tipo não muda a quantidade de hooks (erro #310)
  return <InteractiveHelpEditorBody {...props} />
}

function InteractiveHelpEditorBody({ config, setConfig, models, view, t, recordUrl }: Props) {
  const [openTour, setOpenTour] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const lc = config.layout_config || {}
  const ih: InteractiveHelpConfig = useMemo(() => normalizeInteractiveHelp(lc.interactive_help), [lc.interactive_help])

  // agenda: o evento de exemplo usa as colunas de início e de título configuradas
  const schedulerSeed = useMemo(() => (view.logic_type === 'scheduler' ? buildSchedulerSeed(lc, models) : undefined), [lc, models, view.logic_type])

  const excludeFieldIds = useMemo(
    () => (view.logic_type === 'scheduler' ? [lc.scheduler_config?.start_date_field, lc.scheduler_config?.end_date_field].filter((x: any) => typeof x === 'string' && x) : []),
    [lc, view.logic_type],
  )

  const input: AutoTourInput = useMemo(() => ({
    // sem campos na zona do formulário (comum em Fluxograma, Kanban...), o runtime usa os campos da grade como formulário
    formFields: buildFieldInfos(lc, models, 'form', view.model_id).length > 0 ? buildFieldInfos(lc, models, 'form', view.model_id) : buildFieldInfos(lc, models, 'grid', view.model_id),
    filterFields: buildFieldInfos(lc, models, 'filter', view.model_id),
    gridFields: buildFieldInfos(lc, models, 'grid', view.model_id),
  }), [lc, models, view.model_id])

  const labelOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const group of [input.formFields, input.filterFields || [], input.gridFields || []]) for (const f of group) map.set(f.id, f.label)
    return (id: string) => map.get(id) || id
  }, [input])

  const save = (next: InteractiveHelpConfig) => {
    const clean = next.tours.length || next.hidden ? { ...next, tours: next.tours } : undefined
    setConfig({ ...config, layout_config: { ...lc, interactive_help: clean } })
  }
  // troca o roteiro da mesma ação NO LUGAR (a ordem é do dev); um roteiro novo entra no fim da lista
  const upsert = (tour: Tour) => {
    // roteiro gravado tem identidade própria (pode haver vários); os gerados são um por ação
    const i = ih.tours.findIndex(x => (tour.action === 'custom' ? x.id === tour.id : x.action === tour.action))
    save({ ...ih, tours: i >= 0 ? ih.tours.map((x, k) => (k === i ? tour : x)) : [...ih.tours, tour] })
  }
  const moveTour = (index: number, delta: -1 | 1) => save({ ...ih, tours: moveItem(ih.tours, index, delta) })
  const actionName = (a: TourAction) => t(`help_center_studio.interactive.action_${a}`, ACTION_FALLBACK[a])

  const generate = (action: TourAction, previous?: Tour) => {
    const opts = { action, screenName: view.name, layoutConfig: lc, viewType: view.logic_type, schedulerSeed, excludeFieldIds }
    const tour = previous ? regenerateTour(previous, input, opts) : buildAutoTour(input, opts)
    upsert(previous?.hidden ? { ...tour, hidden: true } : tour)
  }
  const patchTour = (tour: Tour, patch: Partial<Tour>) => upsert({ ...tour, ...patch })
  const patchStep = (tour: Tour, stepId: string, patch: Partial<TourStep>) =>
    upsert({ ...tour, steps: tour.steps.map(s => (s.id === stepId ? { ...s, ...patch } : s)) })

  const targetText = (s: TourStep): string => {
    const tg = s.target
    if (!tg) return ''
    if (tg.type === 'field' || tg.type === 'filter') return labelOf(tg.ref)
    if (tg.type === 'button') return t(`help_center_studio.interactive.btn_${tg.ref}`, BUTTON_FALLBACK[tg.ref] || tg.ref)
    if (tg.type === 'detail-expand') return t('help_center_studio.interactive.detail_expand', 'Expandir registro')
    if (tg.type === 'detail-add') return t('help_center_studio.interactive.btn_detail-add', 'Adicionar item (+)')
    if (tg.type === 'tab') return t('help_center_studio.interactive.detail_tab', 'Aba do detalhe')
    if (tg.type === 'text') return tg.ref
    if (tg.type === 'row') return tg.action ? t(`help_center_studio.interactive.row_${tg.action}`, tg.action) : t('help_center_studio.interactive.row', 'Primeira linha')
    return ''
  }
  const kindText = (k: TourStep['kind']) => t(`help_center_studio.interactive.step_${k}`, { click: 'Clicar', type: 'Digitar', select: 'Escolher', check: 'Marcar', note: 'Observar', drag: 'Arrastar' }[k])
  const missing = tourActionsFor(view.logic_type).filter(a => !ih.tours.some(x => x.action === a))
  const suggested = sortBySuggestedOrder(ih.tours)
  const inSuggestedOrder = suggested.every((x, i) => x.id === ih.tours[i].id)

  // desatualizado = o que seria gerado agora é diferente do que está guardado. Só avalia com os dados dos campos já carregados
  // (antes disso tudo pareceria mudado).
  const fieldsReady = models.some(m => Array.isArray(m?.fields) && m.fields.length > 0)
  const staleIds = useMemo(
    () => new Set(fieldsReady ? ih.tours.filter(tr => tr.action !== 'custom' && isTourStale(tr, input, { action: tr.action, screenName: view.name, viewType: view.logic_type, schedulerSeed, excludeFieldIds })).map(tr => tr.id) : []),
    [fieldsReady, ih.tours, input, view.name],
  )
  const regenerateAll = () => save({ ...ih, tours: ih.tours.map(tr => tr.action === 'custom' ? tr : regenerateTour(tr, input, { action: tr.action, screenName: view.name, layoutConfig: lc, viewType: view.logic_type, schedulerSeed, excludeFieldIds })) })
  // a configuração mudou (assinatura diferente) mas a comparação exata diz que os roteiros continuam certos: dá para só "carimbar" a assinatura nova
  const sigChanged = fieldsReady && staleIds.size === 0 && ih.tours.some(tr => isLikelyStale(tr, lc, view.name))
  const markCurrent = () => save({ ...ih, tours: ih.tours.map(tr => (tr.action === 'custom' ? tr : { ...tr, sourceSig: layoutSignature(lc, tr.action, view.name) })) })

  const arrow = 'p-1 rounded text-neutral-400 hover:text-indigo-600 disabled:opacity-25 disabled:hover:text-neutral-400'

  return (
    <div className="space-y-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500"><PlayCircle className="w-4 h-4 text-indigo-600" />{t('help_center_studio.interactive.title', 'Ajuda interativa')}</span>
        <label className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-500 cursor-pointer">
          <input type="checkbox" checked={ih.hidden === true} onChange={e => save({ ...ih, hidden: e.target.checked ? true : undefined })} />
          {t('help_center_studio.interactive.hide', 'Ocultar o ícone ▶ (mantém os roteiros)')}
        </label>
      </div>
      {recordUrl && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setRecording(true)} className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30">
            <span className="h-2 w-2 rounded-full bg-red-600" />{t('help_center_studio.interactive.record_button', 'Gravar roteiro')}
          </button>
          {tourActionsFor(view.logic_type).length === 0 && <span className="text-[10px] text-neutral-400">{t('help_center_studio.interactive.record_unsupported', 'Este tipo de caso de uso não tem geração automática: grave o roteiro usando a tela.')}</span>}
        </div>
      )}
      <p className="text-[11px] text-neutral-500">{t('help_center_studio.interactive.description', 'O usuário vê o sistema executar os passos sozinho, em modo demonstração (nada é gravado). Gere o roteiro de cada ação e ajuste o que quiser.')}</p>
      {ih.tours.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {staleIds.size > 0 && (
            <span className="text-[11px] font-bold text-amber-600" title={t('help_center_studio.interactive.stale_hint', 'A configuração do caso de uso mudou desde que o roteiro foi gerado. Regenere para atualizar.')}>
              {staleIds.size === 1 ? t('help_center_studio.interactive.stale_one', '1 roteiro desatualizado') : t('help_center_studio.interactive.stale_many', '{count} roteiros desatualizados').replace('{count}', String(staleIds.size))}
            </span>
          )}
          {sigChanged && (
            <span className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              {t('help_center_studio.interactive.sig_changed', 'A configuração mudou, mas isso não afeta os roteiros.')}
              <button type="button" onClick={markCurrent} className="font-bold text-indigo-600 hover:underline">{t('help_center_studio.interactive.mark_current', 'Marcar como em dia')}</button>
            </span>
          )}
          <button type="button" onClick={regenerateAll} className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline">
            <RefreshCw className="h-3 w-3" />{t('help_center_studio.interactive.regenerate_all', 'Regenerar todos')}
          </button>
        </div>
      )}
      {ih.tours.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-[10px] font-bold text-indigo-600">{t('help_center_studio.interactive.order_hint', 'A ordem desta lista é a ordem em que o usuário vê e em que o "Reproduzir todos" executa.')}</p>
          {!inSuggestedOrder && (
            <button type="button" onClick={() => save({ ...ih, tours: suggested })} className="text-[10px] font-bold text-indigo-600 underline hover:no-underline">
              {t('help_center_studio.interactive.use_suggested_order', 'Usar a ordem sugerida (pesquisar, ver, cadastrar, editar, excluir)')}
            </button>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {ih.tours.map((tour, index) => {
          const opened = openTour === tour.id
          const action = tour.action
          return (
            <li key={tour.id} className={cn('rounded-xl border border-neutral-100 dark:border-neutral-800', tour.hidden && 'opacity-60')}>
              <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                <div className="flex flex-col">
                  <button type="button" disabled={index === 0} onClick={() => moveTour(index, -1)} className={arrow} title={t('help_center_studio.interactive.move_up', 'Subir')} aria-label={t('help_center_studio.interactive.move_up', 'Subir')}><ArrowUp className="w-3 h-3" /></button>
                  <button type="button" disabled={index === ih.tours.length - 1} onClick={() => moveTour(index, 1)} className={arrow} title={t('help_center_studio.interactive.move_down', 'Descer')} aria-label={t('help_center_studio.interactive.move_down', 'Descer')}><ArrowDown className="w-3 h-3" /></button>
                </div>
                <span className="w-4 text-center text-[10px] font-black text-neutral-300">{index + 1}</span>
                <button type="button" onClick={() => setOpenTour(opened ? null : tour.id)} className="flex items-center gap-1.5 text-xs font-black text-neutral-700 dark:text-neutral-200">
                  {opened ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  {action === 'custom' ? (resolveHelp(tour.title, 'pt') || actionName(action)) : actionName(action)}
                </button>
                <span className="text-[10px] text-neutral-400">{tour.steps.length} {t('runtime.tour.steps', 'passos')}</span>
                {staleIds.has(tour.id) && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" title={t('help_center_studio.interactive.stale_hint', 'A configuração do caso de uso mudou desde que o roteiro foi gerado. Regenere para atualizar.')}>
                    {t('help_center_studio.interactive.stale', 'Desatualizado')}
                  </span>
                )}
                {tour.steps.some(x => x.kind === 'select' && x.value === '') && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" title={t('help_center_studio.interactive.search_term_missing_hint', 'Um campo de busca (autocomplete) está sem termo de busca: o passo é pulado até você informar.')}>
                    {t('help_center_studio.interactive.search_term_missing', 'Falta termo de busca')}
                  </span>
                )}

                {action === 'create' && (
                  <select value={tour.fill} onChange={e => generate(action, { ...tour, fill: e.target.value as TourFill })} className="ml-auto text-[10px] font-bold rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-2 py-1">
                    <option value="required">{t('help_center_studio.interactive.fill_required', 'Só obrigatórios')}</option>
                    <option value="all">{t('help_center_studio.interactive.fill_all', 'Todos os campos')}</option>
                  </select>
                )}
                {action === 'edit' && (
                  <label className="ml-auto flex items-center gap-1 text-[10px] font-bold text-neutral-500">
                    {t('help_center_studio.interactive.edit_count', 'Campos a alterar')}
                    <input type="number" min={1} max={20} value={tour.editFieldCount ?? 2} onChange={e => generate(action, { ...tour, editFieldCount: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} className="w-12 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-1.5 py-0.5" />
                  </label>
                )}

                <div className={cn('flex items-center gap-2', action !== 'create' && action !== 'edit' && 'ml-auto')}>
                  <label className="flex items-center gap-1 text-[10px] font-bold text-neutral-500 cursor-pointer" title={t('help_center_studio.interactive.hidden_hint', 'Oculto: não aparece para o usuário, mas o roteiro fica guardado.')}>
                    <input type="checkbox" checked={tour.hidden === true} onChange={e => patchTour(tour, { hidden: e.target.checked ? true : undefined })} />
                    {t('help_center_studio.interactive.hidden', 'Oculto')}
                  </label>
                  {action !== 'custom' && <button type="button" onClick={() => generate(action, tour)} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline"><RefreshCw className="w-3 h-3" />{t('help_center_studio.interactive.regenerate', 'Regenerar')}</button>}
                  <button type="button" onClick={() => save({ ...ih, tours: ih.tours.filter(x => x.id !== tour.id) })} className="text-neutral-400 hover:text-red-500" title={t('help_center_studio.interactive.remove', 'Remover')} aria-label={t('help_center_studio.interactive.remove', 'Remover')}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {opened && (
                <div className="border-t border-neutral-100 dark:border-neutral-800">
                <div className="space-y-1.5 px-3 pt-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('help_center_studio.interactive.card_phrase', 'Frase do cartão (o que o usuário lê ao escolher)')}</span>
                    {tour.summaryCustom && (
                      <button type="button" hidden={action === 'custom'} onClick={() => patchTour(tour, { summary: buildAutoTour(input, { action, screenName: view.name, viewType: view.logic_type, schedulerSeed, excludeFieldIds }).summary, summaryCustom: undefined })} className="text-[10px] font-bold text-indigo-600 hover:underline">
                        {t('help_center_studio.interactive.card_phrase_auto', 'Usar a frase automática')}
                      </button>
                    )}
                  </div>
                  <HelpTextEditor
                    value={tour.summary}
                    rows={2}
                    placeholder={t('help_center_studio.interactive.card_phrase_placeholder', 'Uma frase curta do que este tutorial ensina.')}
                    onChange={v => patchTour(tour, { summary: v, summaryCustom: true })}
                  />
                </div>
                <ol className="space-y-1 px-3 py-2">
                  {tour.steps.map((s, i) => (
                    <li key={s.id} className="flex items-start gap-2 text-[11px]">
                      <span className="flex shrink-0 flex-col">
                        <button type="button" disabled={i === 0} onClick={() => upsert({ ...tour, steps: moveItem(tour.steps, i, -1) })} className={arrow} aria-label={t('help_center_studio.interactive.move_up', 'Subir')}><ArrowUp className="w-2.5 h-2.5" /></button>
                        <button type="button" disabled={i === tour.steps.length - 1} onClick={() => upsert({ ...tour, steps: moveItem(tour.steps, i, 1) })} className={arrow} aria-label={t('help_center_studio.interactive.move_down', 'Descer')}><ArrowDown className="w-2.5 h-2.5" /></button>
                      </span>
                      <span className="w-5 shrink-0 pt-1 text-right font-black text-neutral-400">{i + 1}</span>
                      <span className="w-16 shrink-0 pt-1 font-black text-neutral-600 dark:text-neutral-300">{kindText(s.kind)}</span>
                      <span className="w-40 shrink-0 pt-1 truncate text-neutral-500" title={targetText(s)}>{targetText(s)}</span>
                      {s.kind === 'select' && typeof s.value === 'string' ? (
                        <input value={s.value} placeholder={t('help_center_studio.interactive.search_term', 'Termo de busca (ex.: parte do nome)')} onChange={e => patchStep(tour, s.id, { value: e.target.value, edited: s.auto ? true : s.edited })} className={cn('min-w-0 flex-1 rounded-lg border bg-transparent px-2 py-1', s.value ? 'border-neutral-200 dark:border-neutral-700' : 'border-amber-400')} />
                      ) : s.kind === 'select' && s.value && typeof s.value === 'object' ? (
                        <input defaultValue="" placeholder={t('help_center_studio.interactive.option_text', 'Opção a escolher, pelo texto (vazio = a primeira da lista)')} onBlur={e => { const v = e.target.value.trim(); if (v) patchStep(tour, s.id, { value: v, edited: s.auto ? true : s.edited }) }} className="min-w-0 flex-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-2 py-1" />
                      ) : s.kind === 'type' && typeof s.value === 'string' ? (
                        <input value={s.value} onChange={e => patchStep(tour, s.id, { value: e.target.value, edited: s.auto ? true : s.edited })} className="min-w-0 flex-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-2 py-1" />
                      ) : !s.auto && !s.liveCaption && (s.kind === 'click' || s.kind === 'note' || s.kind === 'check') ? (
                        <input value={resolveHelp(s.caption, 'pt')} onChange={e => patchStep(tour, s.id, { caption: { pt: e.target.value } })} placeholder={t('help_center_studio.interactive.caption_placeholder', 'Legenda deste passo')} className="min-w-0 flex-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-2 py-1" />
                      ) : (
                        <span className="min-w-0 flex-1 pt-1 truncate text-neutral-400">{s.kind === 'select' ? t('help_center_studio.interactive.first_option', 'primeira opção da lista') : s.liveCaption ? t('help_center_studio.interactive.live_caption', 'legenda: ajuda atual do campo') : resolveHelp(s.caption, 'pt')}</span>
                      )}
                      <button type="button" onClick={() => upsert({ ...tour, steps: tour.steps.filter(x => x.id !== s.id) })} className="pt-1 text-neutral-300 hover:text-red-500" aria-label={t('help_center_studio.interactive.delete_step', 'Apagar passo')}><Trash2 className="w-3 h-3" /></button>
                    </li>
                  ))}
                </ol>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {missing.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('help_center_studio.interactive.not_generated', 'Ainda não geradas')}</p>
          <ul className="flex flex-wrap gap-2">
            {missing.map(action => (
              <li key={action}>
                <button type="button" onClick={() => generate(action)} className="flex items-center gap-1.5 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30">
                  <Wand2 className="w-3 h-3" />{t('help_center_studio.interactive.generate', 'Gerar')}: {actionName(action)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {recording && recordUrl && (
        <InteractiveHelpRecorder
          src={recordUrl}
          t={t}
          onCancel={() => setRecording(false)}
          onSave={({ title, summary, steps }) => {
            setRecording(false)
            if (steps.length === 0) return
            const id = `rec-${Date.now().toString(36)}`
            upsert({ id, action: 'custom', title: { pt: title }, fill: 'required', steps, summary: summary ? { pt: summary } : undefined, summaryCustom: summary ? true : undefined })
            setOpenTour(id)
          }}
        />
      )}
    </div>
  )
}
