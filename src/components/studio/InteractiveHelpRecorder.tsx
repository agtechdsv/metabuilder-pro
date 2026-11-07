'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Circle, Square, Trash2, X } from 'lucide-react'
import { resolveHelp } from '@/lib/helpText'
import { attachRecorder, type RecorderHandle } from '@/lib/interactiveHelp/recorder'
import type { TourStep } from '@/lib/interactiveHelp/types'

interface Props {
  /** endereço da tela do caso de uso em modo demonstração (nada é gravado no banco) */
  src: string
  t: (key: string, fallback?: string) => string
  onCancel: () => void
  onSave: (result: { title: string; summary: string; steps: TourStep[] }) => void
}

const KIND_LABEL: Record<TourStep['kind'], string> = { click: 'Clicar', type: 'Digitar', select: 'Escolher', check: 'Marcar', note: 'Observar', drag: 'Arrastar' }

/**
 * Gravador de roteiro: o dev usa a tela de verdade (modo demonstração) e cada clique, texto digitado, lista escolhida e
 * caixa marcada vira um passo. Ao parar, ele dá um nome e o roteiro entra na lista, onde os passos podem ser ajustados.
 */
export function InteractiveHelpRecorder({ src, t, onCancel, onSave }: Props) {
  const [steps, setSteps] = useState<TourStep[]>([])
  const stepsRef = useRef<TourStep[]>([])
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const handleRef = useRef<RecorderHandle | null>(null)

  const push = (s: TourStep) => {
    stepsRef.current = [...stepsRef.current, s]
    setSteps(stepsRef.current)
  }
  const removeAt = (id: string) => {
    stepsRef.current = stepsRef.current.filter(s => s.id !== id)
    setSteps(stepsRef.current)
  }

  // a cada carga do iframe (inclusive recarga completa) o gravador se liga ao documento novo
  const onLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    handleRef.current?.detach()
    handleRef.current = null
    try {
      const doc = e.currentTarget.contentDocument
      if (doc) handleRef.current = attachRecorder(doc, push)
    } catch { /* outro domínio: não há como gravar */ }
  }
  useEffect(() => () => { handleRef.current?.detach() }, [])

  const finish = () => {
    handleRef.current?.flush()
    handleRef.current?.detach()
    onSave({ title: title.trim() || t('help_center_studio.interactive.record_default_title', 'Tutorial gravado'), summary: summary.trim(), steps: stepsRef.current })
  }

  return (
    <div className="fixed inset-0 z-[400] flex flex-col bg-black/60 p-4">
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-neutral-900">
        <div className="relative min-w-0 flex-1">
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow">
            <Circle className="h-2.5 w-2.5 animate-pulse fill-current" />{t('help_center_studio.interactive.record_recording', 'Gravando')}
          </div>
          <iframe src={src} title="recorder" onLoad={onLoad} className="h-full w-full border-0" />
        </div>

        <aside className="flex w-80 shrink-0 flex-col border-l border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
            <span className="text-xs font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-300">{t('help_center_studio.interactive.record_title', 'Gravar roteiro')}</span>
            <button type="button" onClick={onCancel} className="text-neutral-400 hover:text-neutral-700" aria-label={t('common.cancel', 'Cancelar')}><X className="h-4 w-4" /></button>
          </div>
          <p className="px-4 pt-3 text-[11px] text-neutral-500">{t('help_center_studio.interactive.record_hint', 'Use a tela ao lado como o usuário usaria: cada clique, texto digitado e opção escolhida vira um passo. Nada é gravado no banco.')}</p>

          <div className="space-y-2 px-4 pt-3">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('help_center_studio.interactive.record_title_label', 'Nome do tutorial (ex.: Como lançar um pedido)')} className="w-full rounded-lg border border-neutral-200 bg-transparent px-2 py-1.5 text-xs dark:border-neutral-700" />
            <input value={summary} onChange={e => setSummary(e.target.value)} placeholder={t('help_center_studio.interactive.record_desc_label', 'Frase do cartão (opcional)')} className="w-full rounded-lg border border-neutral-200 bg-transparent px-2 py-1.5 text-xs dark:border-neutral-700" />
          </div>

          <ol className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto px-4 pb-2 text-[11px]">
            {steps.length === 0 && <li className="text-neutral-400">{t('help_center_studio.interactive.record_empty', 'Nenhum passo gravado ainda. Comece a usar a tela.')}</li>}
            {steps.map((s, i) => (
              <li key={s.id} className="flex items-start gap-2">
                <span className="w-4 shrink-0 text-right font-black text-neutral-400">{i + 1}</span>
                <span className="w-14 shrink-0 font-black text-neutral-600 dark:text-neutral-300">{t(`help_center_studio.interactive.step_${s.kind}`, KIND_LABEL[s.kind])}</span>
                <span className="min-w-0 flex-1 truncate text-neutral-500" title={resolveHelp(s.caption, 'pt')}>{typeof s.value === 'string' && s.value ? s.value : resolveHelp(s.caption, 'pt')}</span>
                <button type="button" onClick={() => removeAt(s.id)} className="text-neutral-300 hover:text-red-500" aria-label={t('help_center_studio.interactive.delete_step', 'Apagar passo')}><Trash2 className="h-3 w-3" /></button>
              </li>
            ))}
          </ol>

          <div className="flex gap-2 border-t border-neutral-100 p-3 dark:border-neutral-800">
            <button type="button" onClick={finish} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500">
              <Square className="h-3 w-3 fill-current" />{t('help_center_studio.interactive.record_stop', 'Parar e salvar')}
            </button>
            <button type="button" onClick={onCancel} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-500 dark:border-neutral-700">{t('common.cancel', 'Cancelar')}</button>
          </div>
        </aside>
      </div>
    </div>
  )
}
