'use client'

import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, PlayCircle, RefreshCw, Trash2, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveHelp } from '@/lib/helpText'
import { buildAutoTour, regenerateTour, type AutoTourInput } from '@/lib/interactiveHelp/autoTour'
import { buildFieldInfos } from '@/lib/interactiveHelp/fieldInfo'
import { normalizeInteractiveHelp, TOUR_ACTIONS, type InteractiveHelpConfig, type Tour, type TourAction, type TourFill, type TourStep } from '@/lib/interactiveHelp/types'

interface Props {
  config: any
  setConfig: (config: any) => void
  models: any[]
  /** o caso de uso escolhido (nome e tipo) */
  view: { name?: string; logic_type?: string }
  t: (key: string, fallback?: string) => string
}

const ACTION_FALLBACK: Record<TourAction, string> = { create: 'Cadastrar', edit: 'Editar', delete: 'Excluir', search: 'Pesquisar', view: 'Ver detalhes' }
const BUTTON_FALLBACK: Record<string, string> = { new: 'Novo Registro', save: 'Salvar Alterações', back: 'Voltar para Lista', search: 'Pesquisar', clear: 'Limpar', confirm: 'Confirmar exclusão', cancel: 'Cancelar' }

/**
 * Ajuda Interativa no Studio: o dev gera o roteiro de cada ação a partir da configuração do caso de uso, revisa os passos
 * (muda o valor digitado, apaga passos) e salva junto com a ajuda, sem republicar. v1: só casos de uso de cadastro com pesquisa.
 */
export function InteractiveHelpEditor({ config, setConfig, models, view, t }: Props) {
  const [openTour, setOpenTour] = useState<string | null>(null)
  const lc = config.layout_config || {}
  const ih: InteractiveHelpConfig = useMemo(() => normalizeInteractiveHelp(lc.interactive_help), [lc.interactive_help])

  const input: AutoTourInput = useMemo(() => ({
    formFields: buildFieldInfos(lc, models, 'form'),
    filterFields: buildFieldInfos(lc, models, 'filter'),
    gridFields: buildFieldInfos(lc, models, 'grid'),
  }), [lc, models])

  const labelOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const group of [input.formFields, input.filterFields || [], input.gridFields || []]) for (const f of group) map.set(f.id, f.label)
    return (id: string) => map.get(id) || id
  }, [input])

  const save = (next: InteractiveHelpConfig) => {
    const clean = next.tours.length || next.hidden ? { ...next, tours: next.tours } : undefined
    setConfig({ ...config, layout_config: { ...lc, interactive_help: clean } })
  }
  const upsert = (tour: Tour) => save({ ...ih, tours: [...ih.tours.filter(x => x.action !== tour.action), tour].sort((a, b) => TOUR_ACTIONS.indexOf(a.action) - TOUR_ACTIONS.indexOf(b.action)) })
  const actionName = (a: TourAction) => t(`help_center_studio.interactive.action_${a}`, ACTION_FALLBACK[a])

  if (view.logic_type !== 'pesquisa_cadastro') {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 p-4 text-xs text-neutral-500">
        <span className="flex items-center gap-2 font-black uppercase tracking-widest text-[10px] text-neutral-400"><PlayCircle className="w-4 h-4" />{t('help_center_studio.interactive.title', 'Ajuda interativa')}</span>
        <p className="mt-2">{t('help_center_studio.interactive.only_cadastro', 'Nesta versão a ajuda interativa vale para casos de uso de cadastro com pesquisa.')}</p>
      </div>
    )
  }

  const generate = (action: TourAction, previous?: Tour) => {
    const opts = { action, screenName: view.name }
    upsert(previous ? regenerateTour(previous, input, opts) : buildAutoTour(input, opts))
  }
  const patchTour = (tour: Tour, patch: Partial<Tour>) => upsert({ ...tour, ...patch })
  const patchStep = (tour: Tour, stepId: string, patch: Partial<TourStep>) =>
    upsert({ ...tour, steps: tour.steps.map(s => (s.id === stepId ? { ...s, ...patch } : s)) })

  const targetText = (s: TourStep): string => {
    const tg = s.target
    if (!tg) return ''
    if (tg.type === 'field' || tg.type === 'filter') return labelOf(tg.ref)
    if (tg.type === 'button') return t(`help_center_studio.interactive.btn_${tg.ref}`, BUTTON_FALLBACK[tg.ref] || tg.ref)
    if (tg.type === 'row') return tg.action ? t(`help_center_studio.interactive.row_${tg.action}`, tg.action) : t('help_center_studio.interactive.row', 'Primeira linha')
    return tg.ref
  }
  const kindText = (k: TourStep['kind']) => t(`help_center_studio.interactive.step_${k}`, { click: 'Clicar', type: 'Digitar', select: 'Escolher', check: 'Marcar', note: 'Observar' }[k])

  return (
    <div className="space-y-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500"><PlayCircle className="w-4 h-4 text-indigo-600" />{t('help_center_studio.interactive.title', 'Ajuda interativa')}</span>
        <label className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-500 cursor-pointer">
          <input type="checkbox" checked={ih.hidden === true} onChange={e => save({ ...ih, hidden: e.target.checked ? true : undefined })} />
          {t('help_center_studio.interactive.hide', 'Ocultar o ícone ▶ (mantém os roteiros)')}
        </label>
      </div>
      <p className="text-[11px] text-neutral-500">{t('help_center_studio.interactive.description', 'O usuário vê o sistema executar os passos sozinho, em modo demonstração (nada é gravado). Gere o roteiro de cada ação e ajuste o que quiser.')}</p>

      <ul className="space-y-2">
        {TOUR_ACTIONS.map(action => {
          const tour = ih.tours.find(x => x.action === action)
          const opened = openTour === action
          return (
            <li key={action} className="rounded-xl border border-neutral-100 dark:border-neutral-800">
              <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                <button type="button" disabled={!tour} onClick={() => setOpenTour(opened ? null : action)} className="flex items-center gap-1.5 text-xs font-black text-neutral-700 dark:text-neutral-200 disabled:opacity-60">
                  {tour ? (opened ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : <span className="w-3.5" />}
                  {actionName(action)}
                </button>
                <span className="text-[10px] text-neutral-400">{tour ? `${tour.steps.length} ${t('runtime.tour.steps', 'passos')}` : t('help_center_studio.interactive.none', 'não gerado')}</span>

                {action === 'create' && tour && (
                  <select value={tour.fill} onChange={e => patchTour(tour, { fill: e.target.value as TourFill })} className="ml-auto text-[10px] font-bold rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-2 py-1">
                    <option value="required">{t('help_center_studio.interactive.fill_required', 'Só obrigatórios')}</option>
                    <option value="all">{t('help_center_studio.interactive.fill_all', 'Todos os campos')}</option>
                  </select>
                )}
                {action === 'edit' && tour && (
                  <label className="ml-auto flex items-center gap-1 text-[10px] font-bold text-neutral-500">
                    {t('help_center_studio.interactive.edit_count', 'Campos a alterar')}
                    <input type="number" min={1} max={20} value={tour.editFieldCount ?? 2} onChange={e => patchTour(tour, { editFieldCount: Math.max(1, Number(e.target.value) || 1) })} className="w-12 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-1.5 py-0.5" />
                  </label>
                )}

                <div className={cn('flex items-center gap-1', !(tour && (action === 'create' || action === 'edit')) && 'ml-auto')}>
                  {tour && (
                    <button type="button" onClick={() => {
                      // recomeça do que o dev escolheu: a quantidade/o preenchimento já estão no roteiro
                      generate(action, tour)
                    }} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline"><RefreshCw className="w-3 h-3" />{t('help_center_studio.interactive.regenerate', 'Regenerar')}</button>
                  )}
                  {!tour && (
                    <button type="button" onClick={() => generate(action)} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline"><Wand2 className="w-3 h-3" />{t('help_center_studio.interactive.generate', 'Gerar')}</button>
                  )}
                  {tour && (
                    <button type="button" onClick={() => save({ ...ih, tours: ih.tours.filter(x => x.action !== action) })} className="ml-2 text-neutral-400 hover:text-red-500" title={t('help_center_studio.interactive.remove', 'Remover')} aria-label={t('help_center_studio.interactive.remove', 'Remover')}><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>

              {tour && opened && (
                <ol className="space-y-1 border-t border-neutral-100 dark:border-neutral-800 px-3 py-2">
                  {tour.steps.map((s, i) => (
                    <li key={s.id} className="flex items-start gap-2 text-[11px]">
                      <span className="w-5 shrink-0 pt-1 text-right font-black text-neutral-400">{i + 1}</span>
                      <span className="w-16 shrink-0 pt-1 font-black text-neutral-600 dark:text-neutral-300">{kindText(s.kind)}</span>
                      <span className="w-40 shrink-0 pt-1 truncate text-neutral-500" title={targetText(s)}>{targetText(s)}</span>
                      {s.kind === 'type' && typeof s.value === 'string' ? (
                        <input value={s.value} onChange={e => patchStep(tour, s.id, { value: e.target.value, edited: s.auto ? true : s.edited })} className="min-w-0 flex-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-2 py-1" />
                      ) : (
                        <span className="min-w-0 flex-1 pt-1 truncate text-neutral-400">{s.kind === 'select' ? t('help_center_studio.interactive.first_option', 'primeira opção da lista') : resolveHelp(s.caption, 'pt')}</span>
                      )}
                      <button type="button" onClick={() => upsert({ ...tour, steps: tour.steps.filter(x => x.id !== s.id) })} className="pt-1 text-neutral-300 hover:text-red-500" aria-label={t('help_center_studio.interactive.delete_step', 'Apagar passo')}><Trash2 className="w-3 h-3" /></button>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
