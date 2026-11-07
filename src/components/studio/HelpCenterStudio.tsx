'use client'

import React, { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HelpCircle, Loader2, Save, ExternalLink } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'
import { hasHelp } from '@/lib/helpText'
import { draftLayoutOf, mergeHelpIntoLayout, patchComponentHelp } from '@/lib/helpPatch'
import { HelpOverview } from './UseCaseBuilder/steps/StepLayout/special-layouts/HelpOverview'
import { ScreenHelpField } from './UseCaseBuilder/steps/StepLayout/special-layouts/ScreenHelpField'
import { InteractiveHelpEditor } from './InteractiveHelpEditor'
import { hasLikelyStaleTours } from '@/lib/interactiveHelp/signature'

interface Props {
  workspaceSlug: string
  projectSlug: string
  views: any[]
  models: any[]
}

const viewHasHelp = (view: any): boolean => {
  const lc = view?.layout_config || {}
  if (hasHelp(lc.screen_help)) return true
  return Object.values(lc.fields_metadata || {}).some((e: any) => hasHelp(e?.label?.help))
}

/**
 * Aba "Central de Ajuda" do Studio: o DEV escolhe um caso de uso e edita só a ajuda (da tela, dos campos por zona, ocultar),
 * sem abrir o construtor e sem republicar o caso de uso. A gravação vai direto ao que está publicado (e ao rascunho, se houver),
 * então vale na hora para os usuários.
 */
export function HelpCenterStudio({ workspaceSlug, projectSlug, views: allViews, models }: Props) {
  // caso de uso que nunca foi publicado não recebe gravação direta (ele ainda é rascunho): esse se edita no construtor
  const views = useMemo(
    () => allViews.filter(v => v?.status !== 'draft' && v?.layout_config && Object.keys(v.layout_config).length > 0),
    [allViews],
  )
  const unpublished = allViews.length - views.length
  const { t } = useI18n()
  const { toast } = useToast()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [selectedId, setSelectedId] = useState('')
  const [config, setConfig] = useState<any>(null)
  // o que está gravado, para saber se há alteração (só as propriedades de ajuda contam)
  const [baseline, setBaseline] = useState('')
  const [saving, setSaving] = useState(false)
  // Os modelos do Studio vêm só com o id dos campos. O gerador da ajuda interativa precisa do nome da coluna, do tipo e da chave:
  // busca esses dados dos campos usados no caso de uso escolhido.
  const [fieldRows, setFieldRows] = useState<any[]>([])
  // mesma identidade enquanto os campos não mudam: o editor só recalcula o que depende deles (ex.: roteiros desatualizados)
  const tourModels = useMemo(() => [{ fields: fieldRows }], [fieldRows])
  const selectedRef = useRef('')

  const view = views.find(v => v.id === selectedId)
  const helpSig = (layout: any) => JSON.stringify(mergeHelpIntoLayout({}, layout || {}))
  const dirty = !!config && helpSig(config.layout_config) !== baseline

  const select = (id: string) => {
    if (dirty && !window.confirm(t('help_center_studio.discard_confirm', 'Há alterações não salvas nesta tela. Descartar?'))) return
    setSelectedId(id)
    selectedRef.current = id
    setFieldRows([])
    const v = views.find(x => x.id === id)
    if (!v) { setConfig(null); setBaseline(''); return }
    const lcIds = ['form_fields', 'grid_fields', 'filter_fields'].flatMap(k => (Array.isArray(v.layout_config?.[k]) ? v.layout_config[k] : []))
      .map((f: any) => (typeof f === 'string' ? f : f?.id))
      .concat([v.layout_config?.scheduler_config?.start_date_field, v.layout_config?.scheduler_config?.title_field, v.layout_config?.kanban_group_field])
      .filter((x: any) => typeof x === 'string' && x && !x.startsWith('virt_') && !x.startsWith('byoc_'))
    if (lcIds.length) {
      void supabase.from('fields').select('id, model_id, db_column_name, display_name, data_type, is_primary_key').in('id', Array.from(new Set(lcIds)))
        .then(({ data }: any) => {
          if (selectedRef.current !== id) return
          // o nome da tabela do modelo vem dos modelos do Studio (para a linha de exemplo das abas de detalhe)
          const tableOf = new Map((models || []).map((m: any) => [m.id, m.db_table_name]))
          setFieldRows((data || []).map((r: any) => ({ ...r, model_table: tableOf.get(r.model_id) })))
        })
    }
    const layout = JSON.parse(JSON.stringify(v.layout_config || {}))
    setConfig({ id: v.id, layout_config: layout })
    setBaseline(helpSig(layout))
  }

  const save = async () => {
    if (!view || !config) return
    setSaving(true)
    try {
      const edited = config.layout_config
      const published = mergeHelpIntoLayout(view.layout_config || {}, edited)
      const update: Record<string, any> = { layout_config: published }

      // rascunho em andamento: recebe a mesma ajuda, para que publicá-lo depois não desfaça a edição
      if (view.draft_config && draftLayoutOf(view.draft_config)) {
        update.draft_config = view.draft_config.layout_config
          ? { ...view.draft_config, layout_config: mergeHelpIntoLayout(view.draft_config.layout_config, edited) }
          : mergeHelpIntoLayout(view.draft_config, edited)
      }
      const { error } = await supabase.from('ui_views').update(update).eq('id', view.id)
      if (error) throw error

      // o app em execução lê a ajuda dos campos em ui_components
      const { data: comps, error: compErr } = await supabase.from('ui_components').select('id, field_id, config').eq('view_id', view.id)
      if (compErr) throw compErr
      const changed = (comps || [])
        .map((c: any) => ({ c, next: patchComponentHelp(c.config, published.fields_metadata, c.field_id) }))
        .filter(x => x.next !== x.c.config)
      const results = await Promise.all(changed.map(x => supabase.from('ui_components').update({ config: x.next }).eq('id', x.c.id)))
      const failed = results.find(r => r.error)
      if (failed?.error) throw failed.error

      // as props ainda trazem a versão antiga até o refresh: guarda aqui para a próxima seleção e o "alterado"
      view.layout_config = published
      if (update.draft_config) view.draft_config = update.draft_config
      setBaseline(helpSig(edited))
      toast(t('help_center_studio.saved', 'Ajuda salva. Já vale para os usuários, sem republicar.'), 'success')
      router.refresh()
    } catch (err: any) {
      toast(t('help_center_studio.save_error', 'Não foi possível salvar a ajuda: ') + (err?.message || ''), 'error')
    } finally {
      setSaving(false)
    }
  }

  const sorted = [...views].sort((a, b) => String(a.name || a.slug).localeCompare(String(b.name || b.slug)))

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800/50 pb-4">
        <div>
          <h3 className="text-xl font-black flex items-center gap-3 text-neutral-900 dark:text-white tracking-tight">
            <HelpCircle className="w-6 h-6 text-indigo-600 dark:text-indigo-500" />
            {t('help_center_studio.title', 'Central de Ajuda')}
          </h3>
          <p className="mt-1 text-xs text-neutral-500 max-w-2xl">
            {t('help_center_studio.description', 'Escolha um caso de uso e edite a ajuda dele: da tela, dos campos de cada zona, ou oculte o que não quer mostrar. Vale na hora, sem republicar o caso de uso.')}
          </p>
        </div>
        <a
          href={`/${workspaceSlug}/${projectSlug}/help`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:underline"
        >
          <ExternalLink className="w-3.5 h-3.5" /> {t('help_center_studio.open_central', 'Abrir a Central de Ajuda do app')}
        </a>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('help_center_studio.use_case', 'Caso de uso')}</label>
        <select
          value={selectedId}
          onChange={e => select(e.target.value)}
          className="w-full max-w-xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-600"
        >
          <option value="">{t('help_center_studio.select', 'Selecione um caso de uso…')}</option>
          {sorted.map(v => (
            <option key={v.id} value={v.id}>{viewHasHelp(v) ? '✓ ' : '   '}{hasLikelyStaleTours(v.layout_config, v.name) ? '⚠ ' : ''}{v.name || v.slug}</option>
          ))}
        </select>
        <p className="text-[10px] text-neutral-400 ml-1">
          {t('help_center_studio.legend', '✓ = já tem ajuda escrita')}
          {unpublished > 0 && ` · ${t('help_center_studio.unpublished', 'casos de uso ainda não publicados não aparecem aqui (edite no construtor)')}: ${unpublished}`}
        </p>
      </div>

      {config && view && (
        <div className="space-y-4 rounded-[1.5rem] border border-neutral-200 dark:border-neutral-800 p-5 bg-white dark:bg-neutral-950/40">
          <ScreenHelpField config={config} setConfig={setConfig} t={t} />
          <HelpOverview config={config} setConfig={setConfig} models={models} t={t} defaultOpen />
          <InteractiveHelpEditor config={config} setConfig={setConfig} models={tourModels} view={view} t={t} recordUrl={view?.slug ? `/${workspaceSlug}/${projectSlug}/${view.slug}?mb_demo=1` : undefined} />

          <div className="sticky bottom-4 flex items-center justify-end gap-3 pt-2">
            {dirty && <span className="text-[11px] font-bold text-amber-600">{t('help_center_studio.unsaved', 'Alterações não salvas')}</span>}
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={save}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black tracking-wide text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all',
                (!dirty || saving) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('help_center_studio.save', 'Salvar ajuda')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
