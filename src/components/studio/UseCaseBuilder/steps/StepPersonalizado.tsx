'use client'

import { useState } from 'react'
import {
  Database, Layout, Share2, Plus, Trash2,
  ChevronUp, ChevronDown, Check, X
} from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'
import { IconPicker } from '../../IconPicker'
import DynamicIcon from '@/components/runtime/DynamicIcon'
import { getFormattedFieldName } from '../utils'
import type { Model, UseCase, StepBaseProps, RelationHop } from '../types'

// ─── MultiLevelPathBuilder ────────────────────────────────────────────────────

interface MultiLevelPathBuilderProps {
  level: { model_id?: string; relation_path?: RelationHop[] }
  onChange: (path: RelationHop[]) => void
  models: Model[]
  parentModelId?: string
}

export function MultiLevelPathBuilder({ level, onChange, models, parentModelId }: MultiLevelPathBuilderProps) {
  const path: RelationHop[] = level.relation_path || []

  const addHop = () => onChange([...path, { table: '', from_field: '', to_field: '', target_from_field: '', target_to_field: '' }])
  const removeHop = (index: number) => onChange(path.filter((_, i) => i !== index))
  const updateHop = (index: number, key: keyof RelationHop, value: string) => {
    const newPath = [...path]
    newPath[index] = { ...newPath[index], [key]: value }
    onChange(newPath)
  }

  return (
    <div className="space-y-3 mt-4 border border-dashed border-indigo-200 dark:border-indigo-900 p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/10">
      <div className="flex items-center justify-between">
        <label className="text-[9px] font-black uppercase text-indigo-500 tracking-widest">Caminho de Tabelas (INNER JOINs)</label>
        <button type="button" onClick={addHop} className="text-[9px] px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded uppercase font-bold hover:bg-indigo-100 transition-all">
          + Adicionar Pulo
        </button>
      </div>
      {path.length === 0 && (
        <p className="text-[10px] text-neutral-400 italic">Adicione os pulos para conectar o pai ao destino final.</p>
      )}
      {path.map((hop, idx) => {
        const prevTableName = idx === 0
          ? models.find(m => m.id === parentModelId)?.db_table_name
          : path[idx - 1]?.table
        const currentModel = models.find(m => m.db_table_name === hop.table)
        const prevModel    = models.find(m => m.db_table_name === prevTableName)
        return (
          <div key={idx} className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3 relative">
            <button type="button" onClick={() => removeHop(idx)} className="absolute top-2 right-2 text-red-500 hover:bg-red-50 p-1 rounded-md">
              <Trash2 className="w-3 h-3" />
            </button>
            <div className="text-[9px] font-bold text-neutral-500 uppercase">Pulo {idx + 1}</div>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="text-[9px] font-black uppercase text-neutral-400">Tabela Intermediária</label>
                <select value={hop.table || ''} onChange={e => updateHop(idx, 'table', e.target.value)} className="w-full text-xs p-2 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 mt-1">
                  <option value="">Selecione a Tabela...</option>
                  {models.map(m => <option key={m.id} value={m.db_table_name}>{m.display_name || m.db_table_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black uppercase text-neutral-400">Chave em {prevTableName || 'Pai'}</label>
                  <select value={hop.from_field || ''} onChange={e => updateHop(idx, 'from_field', e.target.value)} className="w-full text-xs p-2 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 mt-1">
                    <option value="">Campo...</option>
                    {prevModel?.fields?.map(f => <option key={f.id} value={f.db_column_name}>{f.db_column_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-neutral-400">Chave na Intermediária</label>
                  <select value={hop.to_field || ''} onChange={e => updateHop(idx, 'to_field', e.target.value)} className="w-full text-xs p-2 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 mt-1">
                    <option value="">Campo...</option>
                    {currentModel?.fields?.map(f => <option key={f.id} value={f.db_column_name}>{f.db_column_name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {path.length > 0 && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-lg mt-2">
          <div className="text-[9px] font-bold text-emerald-600 uppercase mb-2">Pulo Final para o Destino</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-black uppercase text-neutral-400">Chave na Intermediária {path[path.length - 1]?.table}</label>
              <select value={path[path.length - 1]?.target_from_field || ''} onChange={e => updateHop(path.length - 1, 'target_from_field', e.target.value)} className="w-full text-xs p-2 rounded border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-neutral-950 mt-1">
                <option value="">Campo...</option>
                {models.find(m => m.db_table_name === path[path.length - 1]?.table)?.fields?.map(f => <option key={f.id} value={f.db_column_name}>{f.db_column_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-neutral-400">Chave no Destino Final</label>
              <select value={path[path.length - 1]?.target_to_field || ''} onChange={e => updateHop(path.length - 1, 'target_to_field', e.target.value)} className="w-full text-xs p-2 rounded border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-neutral-950 mt-1">
                <option value="">Campo...</option>
                {models.find(m => m.id === level.model_id)?.fields?.map(f => <option key={f.id} value={f.db_column_name}>{f.db_column_name}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── RelationPathSelector ────────────────────────────────────────────────────

interface RelationPathSelectorProps {
  path: string[]
  onChange: (path: string[]) => void
  relations: any[]
  models: Model[]
}

export function RelationPathSelector({ path, onChange, relations, models }: RelationPathSelectorProps) {
  const addHop = () => onChange([...path, ''])
  const removeHop = (index: number) => onChange(path.filter((_, i) => i !== index))
  const updateHop = (index: number, relationId: string) => {
    const newPath = [...path]
    newPath[index] = relationId
    onChange(newPath)
  }

  // Pre-compute relation labels for the dropdown
  const relationOptions = relations.map(rel => {
    const fromModel = models.find(m => m.id === (rel.from_model_id || rel.detail_model_id))
    const toModel = models.find(m => m.id === (rel.to_model_id || rel.master_model_id))
    const fromName = fromModel?.display_name || fromModel?.db_table_name || 'Desconhecido'
    const toName = toModel?.display_name || toModel?.db_table_name || 'Desconhecido'
    return {
      id: rel.id,
      label: `De: ${fromName} -> Para: ${toName} (Chave: ${rel.foreign_column_id || rel.from_field_id || 'N/A'})`
    }
  })

  return (
    <div className="space-y-3 mt-4 border border-dashed border-indigo-200 dark:border-indigo-900 p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/10">
      <div className="flex items-center justify-between">
        <label className="text-[9px] font-black uppercase text-indigo-500 tracking-widest">Caminho de Relacionamentos (Joins Dinâmicos)</label>
        <button type="button" onClick={addHop} className="text-[9px] px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded uppercase font-bold hover:bg-indigo-100 transition-all flex items-center gap-1">
          <Plus className="w-3 h-3" /> Adicionar Relação
        </button>
      </div>
      {path.length === 0 && (
        <p className="text-[10px] text-neutral-400 italic">Selecione as relações para conectar a aba Mestre à esta aba.</p>
      )}
      {path.map((relationId, idx) => {
        return (
          <div key={idx} className="flex gap-2 items-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-2">
            <div className="text-[9px] font-bold text-neutral-500 uppercase px-2">{idx + 1}</div>
            <select 
              value={relationId || ''} 
              onChange={e => updateHop(idx, e.target.value)} 
              className="flex-1 text-xs p-2 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 outline-none focus:border-indigo-500"
            >
              <option value="">Selecione o relacionamento...</option>
              {relationOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <button type="button" onClick={() => removeHop(idx)} className="text-neutral-400 hover:text-red-500 p-2 rounded-md transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─── StepPersonalizado ────────────────────────────────────────────────────────

interface StepPersonalizadoProps extends StepBaseProps {
  models: Model[]
  useCases?: UseCase[]
  relations?: any[]
}

export function StepPersonalizado({ config, setConfig, models, useCases = [], relations = [] }: StepPersonalizadoProps) {
  const { t } = useI18n()
  const [expandedCustomSlot, setExpandedCustomSlot] = useState<number | null>(null)
  const [tabToDelete, setTabToDelete]               = useState<number | null>(null)
  const [editingSlotTabIconIndex, setEditingSlotTabIconIndex] = useState<number | null>(null)
  const [editingSlotIconIndex, setEditingSlotIconIndex]       = useState<number | null>(null)

  function renderSlotFieldOptions(slotModelId: string, includeNone = true, noneLabel = 'Selecione o campo...') {
    if (!slotModelId) return includeNone ? <option value="">Selecione primeiro o modelo...</option> : null
    const model = models.find(m => m.id === slotModelId)
    if (!model) return null
    return (
      <>
        {includeNone && <option value="">{noneLabel}</option>}
        {model.fields?.map(f => <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>)}
      </>
    )
  }

  const updateSlot = (idx: number, updater: (slot: any) => any) => {
    const newSlots = [...(config.layout_config.custom_slots || [])]
    newSlots[idx] = updater({ ...newSlots[idx] })
    setConfig({ ...config, layout_config: { ...config.layout_config, custom_slots: newSlots } })
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="space-y-2">
        <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
          {t('wizard.personalizado.title', 'Configuração do Orquestrador de Casos de Uso')}
        </h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">
          {t('wizard.personalizado.subtitle', 'Defina o Caso de Uso Mestre e as Abas (Detalhes) que comporão este painel unificado.')}
        </p>
      </div>

      {/* Master use case */}
      <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-[1.5rem] space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20"><Database className="w-4 h-4" /></div>
          <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.personalizado.master_uc_title', 'Caso de Uso Mestre')}</h4>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 ml-1">{t('wizard.personalizado.select_master', 'Selecione o Mestre')}</label>
            <select
              value={(config.layout_config as any).master_use_case_slug || ''}
              onChange={e => {
                const selectedSlug = e.target.value
                const selectedUc = useCases.find(uc => uc.slug === selectedSlug)
                setConfig({
                  ...config,
                  selected_models: selectedUc ? [selectedUc.model_id!] : config.selected_models,
                  layout_config: { ...config.layout_config, master_use_case_slug: selectedSlug }
                })
              }}
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            >
              <option value="">{t('wizard.personalizado.select_master_placeholder', 'Selecione o Caso de Uso Mestre...')}</option>
              {useCases.map(uc => <option key={uc.slug} value={uc.slug}>{uc.name}</option>)}
            </select>
          </div>

          <div className="flex items-start gap-3 p-4 bg-white/60 dark:bg-black/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl">
            <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex-shrink-0 mt-0.5">
              <Share2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1 space-y-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400 mb-1">{t('wizard.tables.santo_graal_active', 'Santo Graal ativo')}</p>
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 leading-relaxed">
                {t('wizard.tables.santo_graal_desc', 'O sistema detecta automaticamente todas as tabelas relacionadas à tabela raiz e disponibiliza seus campos na etapa seguinte.')}
              </p>
              <div className="flex items-center gap-3 bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/50 w-fit">
                <label className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">{t('wizard.tables.max_depth_label', 'Profundidade Máxima (Níveis)')}</label>
                <select
                  value={config.layout_config?.max_relation_depth || 2}
                  onChange={e => setConfig({ ...config, layout_config: { ...config.layout_config, max_relation_depth: parseInt(e.target.value, 10) } })}
                  className="text-xs bg-white dark:bg-neutral-900 border border-indigo-200 dark:border-indigo-800 rounded px-2 py-1 outline-none text-indigo-900 dark:text-indigo-300 cursor-pointer"
                >
                  <option value={1}>{t('wizard.tables.depth_1', '1 Nível (Apenas Relacionamentos Diretos)')}</option>
                  <option value={2}>{t('wizard.tables.depth_2', '2 Níveis (Padrão - Inclui Nível 2)')}</option>
                  <option value={3}>{t('wizard.tables.depth_3', '3 Níveis (Profundo)')}</option>
                  <option value={4}>{t('wizard.tables.depth_4', '4 Níveis (Extremo - Pode causar lentidão)')}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* General settings */}
      <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-[1.5rem] space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20"><Database className="w-4 h-4" /></div>
          <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.pattern_config', 'Configuração de Padrões')}</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.records_per_page', 'Registros por Página (LIMIT)')}</label>
            <input
              type="number" min="1" max="500" placeholder="Ex: 50"
              value={config.layout_config.items_per_page || ''}
              onChange={e => setConfig({ ...config, layout_config: { ...config.layout_config, items_per_page: e.target.value ? parseInt(e.target.value, 10) : undefined } })}
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            />
            <p className="text-[10px] text-neutral-400 font-medium italic ml-1">{t('wizard.layout.records_per_page_hint', 'Deixe em branco para usar o padrão do sistema.')}</p>
          </div>
        </div>
      </div>

      {/* Custom slots (tabs) */}
      {config.logic_type === 'personalizado' && (
        <div className="p-6 bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-[2rem] space-y-6 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 flex items-center justify-center">
              <Layout className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase text-rose-600 tracking-[0.3em]">{t('wizard.personalizado.tabs_layout_title', 'Layout Personalizado (Abas)')}</h4>
              <p className="text-[10px] text-neutral-400 font-medium mt-1">{t('wizard.personalizado.tabs_layout_desc', 'Configure os Widgets para cada aba do registro.')}</p>
            </div>
          </div>

          <div className="space-y-4">
            {(config.layout_config.custom_slots || []).map((slot: any, idx: number) => (
              <div key={slot.id} className="p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col gap-4">
                {/* Slot header row */}
                <div className="flex gap-4 items-start w-full">
                  {/* Icon */}
                  <div className="space-y-2 flex-initial">
                    <label className="text-[9px] font-black uppercase text-neutral-400">{t('wizard.personalizado.icon_label', 'Ícone')}</label>
                    <div className="relative">
                      <button type="button" onClick={() => setEditingSlotTabIconIndex(idx)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-50">
                        <DynamicIcon icon={slot.icon || 'Layout'} className="w-5 h-5 text-neutral-500" />
                      </button>
                      {editingSlotTabIconIndex === idx && (
                        <IconPicker
                          currentIcon={slot.icon || 'Layout'}
                          onSelect={(icon: string) => { updateSlot(idx, s => ({ ...s, icon })); setEditingSlotTabIconIndex(null) }}
                          onClose={() => setEditingSlotTabIconIndex(null)}
                        />
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <div className="space-y-2 flex-1">
                    <label className="text-[9px] font-black uppercase text-neutral-400">{t('wizard.personalizado.tab_title_label', 'Título da Aba')}</label>
                    <input
                      type="text" value={slot.title || ''}
                      onChange={e => updateSlot(idx, s => ({ ...s, title: e.target.value }))}
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-bold text-neutral-700 dark:text-neutral-200 outline-none focus:border-rose-500"
                      placeholder={t('wizard.personalizado.tab_title_placeholder', 'Ex: Detalhes')}
                    />
                  </div>

                  {/* Use case selector */}
                  <div className="space-y-2 flex-1">
                    <label className="text-[9px] font-black uppercase text-neutral-400">{t('wizard.personalizado.use_case_label', 'Caso de Uso')}</label>
                    <select
                      value={slot.use_case_slug || ''}
                      onChange={e => {
                        const selectedUc = useCases?.find(uc => uc.slug === e.target.value)
                        updateSlot(idx, s => ({ ...s, use_case_slug: e.target.value, type: selectedUc?.logic_type || 'personalizado' }))
                      }}
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-bold text-neutral-700 dark:text-neutral-200 outline-none focus:border-rose-500"
                    >
                      <option value="">{t('wizard.personalizado.select_use_case_placeholder', 'Selecione o Caso de Uso...')}</option>
                      {useCases?.map(uc => <option key={uc.slug} value={uc.slug}>{uc.name}</option>)}
                    </select>
                  </div>

                  {/* Widget type (read-only) */}
                  <div className="space-y-2 flex-1">
                    <label className="text-[9px] font-black uppercase text-neutral-400">{t('wizard.personalizado.widget_label', 'Widget')}</label>
                    <select
                      value={useCases?.find(uc => uc.slug === slot.use_case_slug)?.logic_type || slot.type || 'form'}
                      disabled
                      className="w-full bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-bold text-neutral-500 dark:text-neutral-400 outline-none cursor-not-allowed"
                    >
                      <option value="form">{t('wizard.logic.types.pesquisa_cadastro.title', 'Formulário')}</option>
                      <option value="pesquisa_cadastro">{t('wizard.logic.types.pesquisa_cadastro.title', 'Pesquisa / Cadastro')}</option>
                      <option value="kanban">{t('wizard.logic.types.kanban.title', 'Kanban')}</option>
                      <option value="timeline">{t('wizard.logic.types.timeline.title', 'Linha do Tempo')}</option>
                      <option value="scheduler">{t('wizard.logic.types.scheduler.title', 'Agenda / Calendário')}</option>
                      <option value="gantt">{t('wizard.logic.types.gantt.title', 'Gráfico de Gantt')}</option>
                      <option value="mapa_mental">{t('wizard.logic.types.mapa_mental.title', 'Mapa Mental')}</option>
                      <option value="analytics">{t('wizard.logic.types.analytics.title', 'Dashboard BI')}</option>
                      <option value="galeria">{t('wizard.logic.types.galeria.title', 'Galeria Assets')}</option>
                      <option value="map">{t('wizard.logic.types.map.title', 'Mapa Geospatial')}</option>
                      <option value="blueprint">{t('wizard.logic.types.blueprint.title', 'Fluxograma (Blueprint)')}</option>
                      <option value="personalizado">{t('wizard.personalizado.widget_master_detail', 'Mestre/Detalhe (Abas)')}</option>
                    </select>
                  </div>

                  {/* Expand / Delete */}
                  <button
                    onClick={() => setExpandedCustomSlot(expandedCustomSlot === idx ? null : idx)}
                    className="mt-6 p-2.5 text-indigo-500 hover:text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 rounded-lg transition-all"
                    title={expandedCustomSlot === idx ? t('wizard.personalizado.collapse_config', 'Recolher Configurações') : t('wizard.personalizado.expand_config', 'Expandir Configurações')}
                  >
                    {expandedCustomSlot === idx ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {tabToDelete === idx ? (
                    <div className="mt-6 flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                      <button
                        onClick={() => {
                          const newSlots = (config.layout_config.custom_slots || []).filter((_: any, i: number) => i !== idx)
                          setConfig({ ...config, layout_config: { ...config.layout_config, custom_slots: newSlots } })
                          setTabToDelete(null)
                        }}
                        className="p-2.5 text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> {t('common.yes', 'Sim')}
                      </button>
                      <button onClick={() => setTabToDelete(null)} className="p-2.5 text-neutral-500 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-lg transition-all">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setTabToDelete(idx)} className="mt-6 p-2.5 text-neutral-400 hover:text-red-500 bg-neutral-50 hover:bg-red-50 dark:bg-neutral-900 dark:hover:bg-red-900/20 rounded-lg transition-all" title={t('wizard.personalizado.remove_tab', 'Remover Aba')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Expanded slot config */}
                {expandedCustomSlot === idx && (
                  <div className="w-full space-y-4 animate-in slide-in-from-top-2 duration-200">
                    {idx > 0 && (
                      <div className="w-full p-4 mt-2 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-4">
                        {/* Permissions */}
                        <div className="flex flex-col gap-2">
                          <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">Permissões de Ação na Aba</h5>
                          <p className="text-[10px] text-neutral-500">Escolha quais ações os usuários poderão realizar nos registros desta aba.</p>
                          <div className="flex flex-wrap gap-6 mt-2">
                            {[
                              { key: 'can_view',      label: 'Visualizar' },
                              { key: 'can_view_lupa', label: 'Visualizar (Lupa)' },
                              { key: 'can_add',       label: 'Novo' },
                              { key: 'can_edit',      label: 'Editar' },
                              { key: 'can_delete',    label: 'Excluir' }
                            ].map(({ key, label }) => (
                              <label key={key} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={(slot as any)[key] !== false}
                                  onChange={e => updateSlot(idx, s => ({ ...s, [key]: e.target.checked }))}
                                  className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Render mode */}
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">Modo de Exibição da Aba</h5>
                        <div className="flex gap-4 mt-2">
                          {[
                            { value: 'tab',    label: 'Aba (Padrão)' },
                            { value: 'button', label: 'Botão (Oculta Aba)' },
                            { value: 'both',   label: 'Ambos' }
                          ].map(({ value, label }) => (
                            <label key={value} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio" name={`render_mode_${idx}`} value={value}
                                checked={!slot.render_mode ? value === 'tab' : slot.render_mode === value}
                                onChange={() => updateSlot(idx, s => ({ ...s, render_mode: value }))}
                              />
                              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">{label}</span>
                            </label>
                          ))}
                        </div>

                        {/* Button config (when render_mode is button or both) */}
                        {(slot.render_mode === 'button' || slot.render_mode === 'both') && (
                          <div className="mt-4 p-4 bg-white dark:bg-neutral-950/50 border border-indigo-200 dark:border-indigo-800 rounded-lg space-y-4">
                            <h6 className="text-[10px] font-black uppercase text-indigo-500">Configurações do Botão</h6>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-[9px] font-black uppercase text-neutral-400">Localização do Botão</label>
                                <select
                                  value={slot.button_config?.location || 'master_top'}
                                  onChange={e => updateSlot(idx, s => ({ ...s, button_config: { ...(s.button_config || {}), location: e.target.value } }))}
                                  className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium outline-none mt-1"
                                >
                                  <option value="master_top">Aba Mestre (Topo)</option>
                                  <option value="search_grid_record">Tela de Pesquisa (Linha do Grid)</option>
                                  <option value="specific_tab_top">Outra Aba (Topo)</option>
                                  <option value="specific_tab_grid">Outra Aba (Linha do Grid)</option>
                                </select>
                              </div>
                              {(slot.button_config?.location === 'specific_tab_top' || slot.button_config?.location === 'specific_tab_grid') && (
                                <div>
                                  <label className="text-[9px] font-black uppercase text-neutral-400">Aba Alvo</label>
                                  <select
                                    value={slot.button_config?.target_tab_id || ''}
                                    onChange={e => updateSlot(idx, s => ({ ...s, button_config: { ...(s.button_config || {}), target_tab_id: e.target.value } }))}
                                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium outline-none mt-1"
                                  >
                                    <option value="">Selecione a aba...</option>
                                    {(config.layout_config.custom_slots || []).filter((_: any, i: number) => i !== idx).map((otherSlot: any) => (
                                      <option key={otherSlot.id} value={otherSlot.id}>{otherSlot.title}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              <div>
                                <label className="text-[9px] font-black uppercase text-neutral-400">Como deve abrir?</label>
                                <select
                                  value={slot.button_config?.action_type || 'modal'}
                                  onChange={e => updateSlot(idx, s => ({ ...s, button_config: { ...(s.button_config || {}), action_type: e.target.value } }))}
                                  className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium outline-none mt-1"
                                >
                                  <option value="modal">Modal Centralizada</option>
                                  <option value="drawer">Drawer Lateral (Menu Esquerdo)</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[9px] font-black uppercase text-neutral-400">Nome Específico do Botão (Opcional)</label>
                                <input
                                  type="text" placeholder={slot.title || 'Usar título da aba'}
                                  value={slot.button_config?.label || ''}
                                  onChange={e => updateSlot(idx, s => ({ ...s, button_config: { ...(s.button_config || {}), label: e.target.value } }))}
                                  className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium outline-none mt-1"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-black uppercase text-neutral-400">Ícone do Botão (Opcional)</label>
                                <button
                                  onClick={() => setEditingSlotIconIndex(idx)}
                                  className="w-full flex items-center gap-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 mt-1 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors text-left"
                                >
                                  {slot.button_config?.icon ? (
                                    <>
                                      <div className="w-5 h-5 flex items-center justify-center text-indigo-500"><DynamicIcon icon={slot.button_config.icon} /></div>
                                      <span className="text-sm font-medium text-neutral-900 dark:text-white truncate">{slot.button_config.icon}</span>
                                    </>
                                  ) : (
                                    <>
                                      <div className="w-5 h-5 flex items-center justify-center text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded">?</div>
                                      <span className="text-sm font-medium text-neutral-400">Escolher ícone...</span>
                                    </>
                                  )}
                                </button>
                                {editingSlotIconIndex === idx && (
                                  <IconPicker
                                    currentIcon={slot.button_config?.icon || ''}
                                    onSelect={(icon: string) => { updateSlot(idx, s => ({ ...s, button_config: { ...(s.button_config || {}), icon } })); setEditingSlotIconIndex(null) }}
                                    onClose={() => setEditingSlotIconIndex(null)}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="h-px w-full bg-rose-200 dark:bg-rose-900/50" />

                    {/* Data retrieval */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-[10px] font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-300">Recuperação de Dados</h5>
                          <p className="text-[10px] text-neutral-500 mt-0.5">Defina como os dados serão carregados nesta aba.</p>
                        </div>
                        <button
                          onClick={() => updateSlot(idx, s => ({ ...s, use_master_id: s.use_master_id === false ? true : false }))}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                            slot.use_master_id !== false ? "bg-indigo-600 text-white shadow-md" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500"
                          )}
                        >
                          Vincular ao Mestre: {slot.use_master_id !== false ? 'SIM' : 'NÃO'}
                        </button>
                      </div>

                      {slot.use_master_id !== false && (
                        <RelationPathSelector 
                          path={slot.relation_path || []} 
                          onChange={(newPath) => updateSlot(idx, s => ({ ...s, relation_path: newPath }))}
                          relations={relations}
                          models={models}
                        />
                      )}

                      {/* Static filters */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-black uppercase text-neutral-500 tracking-wider">Filtros Estáticos (Opcional)</label>
                          <button
                            onClick={() => updateSlot(idx, s => ({ ...s, static_filters: [...(s.static_filters || []), { field: '', operator: '=', value: '', logic: 'AND' }] }))}
                            className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Adicionar Filtro
                          </button>
                        </div>
                        <div className="space-y-4">
                          {(slot.static_filters || []).map((filter: any, fIdx: number) => (
                            <div key={fIdx} className="flex flex-col gap-2 p-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                              {fIdx > 0 && (
                                <div className="flex justify-center -mt-6">
                                  <select
                                    value={filter.logic || 'AND'}
                                    onChange={e => updateSlot(idx, s => { const sf = [...(s.static_filters || [])]; sf[fIdx] = { ...sf[fIdx], logic: e.target.value }; return { ...s, static_filters: sf } })}
                                    className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md px-2 py-0.5 text-[10px] font-black tracking-widest uppercase text-indigo-600 dark:text-indigo-400 outline-none"
                                  >
                                    <option value="AND">E (AND)</option>
                                    <option value="OR">OU (OR)</option>
                                  </select>
                                </div>
                              )}
                              <div className="flex gap-2 items-center">
                                <select value={filter.field || ''} onChange={e => updateSlot(idx, s => { const sf = [...(s.static_filters || [])]; sf[fIdx] = { ...sf[fIdx], field: e.target.value }; return { ...s, static_filters: sf } })} className="flex-[2] bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500">
                                  {renderSlotFieldOptions(slot.model_id, true, 'Selecione o campo...')}
                                </select>
                                <select value={filter.operator || '='} onChange={e => updateSlot(idx, s => { const sf = [...(s.static_filters || [])]; sf[fIdx] = { ...sf[fIdx], operator: e.target.value }; return { ...s, static_filters: sf } })} className="flex-[1] bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 outline-none focus:border-indigo-500 text-center">
                                  <option value="=">=</option>
                                  <option value=">">&gt;</option>
                                  <option value="<">&lt;</option>
                                  <option value=">=">&ge;</option>
                                  <option value="<=">&le;</option>
                                  <option value="between">Entre</option>
                                </select>
                                <div className="flex-[2] flex gap-2">
                                  <input type="text" value={filter.value || ''} onChange={e => updateSlot(idx, s => { const sf = [...(s.static_filters || [])]; sf[fIdx] = { ...sf[fIdx], value: e.target.value }; return { ...s, static_filters: sf } })} placeholder={filter.operator === 'between' ? 'Valor inicial' : 'Valor desejado'} className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500" />
                                  {filter.operator === 'between' && (
                                    <input type="text" value={filter.value2 || ''} onChange={e => updateSlot(idx, s => { const sf = [...(s.static_filters || [])]; sf[fIdx] = { ...sf[fIdx], value2: e.target.value }; return { ...s, static_filters: sf } })} placeholder="Valor final" className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500" />
                                  )}
                                </div>
                                <button onClick={() => updateSlot(idx, s => { const sf = [...(s.static_filters || [])].filter((_: any, i: number) => i !== fIdx); return { ...s, static_filters: sf } })} className="p-2 text-neutral-400 hover:text-red-500 rounded-lg transition-colors flex-shrink-0">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Dynamic filters */}
                      <div className="space-y-3 pt-4 border-t border-rose-200/50 dark:border-rose-900/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-[9px] font-black uppercase text-neutral-500 tracking-wider">Filtros de Tela (Usuário Final)</label>
                            <p className="text-[10px] text-neutral-400 mt-0.5">Campos que aparecerão como barras de pesquisa acima do Kanban/Grid.</p>
                          </div>
                          <button onClick={() => updateSlot(idx, s => ({ ...s, dynamic_filters: [...(s.dynamic_filters || []), { field: '', label: '' }] }))} className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Adicionar Filtro de Tela
                          </button>
                        </div>
                        {(slot.dynamic_filters || []).map((filterItem: any, fIdx: number) => {
                          const isObject = typeof filterItem === 'object' && filterItem !== null
                          const fieldVal = isObject ? filterItem.field : filterItem
                          const labelVal = isObject ? filterItem.label : ''
                          return (
                            <div key={`dyn-${fIdx}`} className="flex gap-2 items-center">
                              <select value={fieldVal || ''} onChange={e => updateSlot(idx, s => { const df = [...(s.dynamic_filters || [])]; df[fIdx] = { field: e.target.value, label: labelVal }; return { ...s, dynamic_filters: df } })} className="flex-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500">
                                {renderSlotFieldOptions(slot.model_id, true, 'Selecione o campo para pesquisa...')}
                              </select>
                              <input type="text" value={labelVal || ''} onChange={e => updateSlot(idx, s => { const df = [...(s.dynamic_filters || [])]; df[fIdx] = { field: fieldVal, label: e.target.value }; return { ...s, dynamic_filters: df } })} placeholder="Rótulo (opcional)" className="flex-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500" />
                              <button onClick={() => updateSlot(idx, s => { const df = [...(s.dynamic_filters || [])].filter((_: any, i: number) => i !== fIdx); return { ...s, dynamic_filters: df } })} className="p-2 text-neutral-400 hover:text-red-500 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add tab button */}
            <button
              onClick={() => {
                const newSlots = [...(config.layout_config.custom_slots || []), { id: `tab-${Date.now()}`, title: t('wizard.personalizado.new_tab_title', 'Nova Aba'), type: 'form', model_id: config.selected_models[0] }]
                setConfig({ ...config, layout_config: { ...config.layout_config, custom_slots: newSlots } })
              }}
              className="w-full p-4 border-2 border-dashed border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center justify-center gap-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all font-bold text-xs uppercase tracking-widest shadow-sm"
            >
              <Plus className="w-4 h-4" />
              {t('wizard.personalizado.add_tab', 'Adicionar Aba')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
