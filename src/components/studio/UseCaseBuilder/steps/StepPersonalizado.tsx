'use client'

import { useState, type ReactNode } from 'react'
import { SlotDndProvider, SortableContainer, SortableItem, DropZone } from './SortableList'
import { arrayMove } from '@dnd-kit/sortable'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { getGroupBlocks, type GroupBlock } from '@/lib/slotGroups'
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
  const [expandedCustomSlot, setExpandedCustomSlot] = useState<string | null>(null)
  const [tabToDelete, setTabToDelete]               = useState<string | null>(null)
  const [editingSlotTabIconIndex, setEditingSlotTabIconIndex] = useState<string | null>(null)
  const [editingSlotIconIndex, setEditingSlotIconIndex]       = useState<string | null>(null)
  // id (com prefixo slot:/block:/child:) do item que está sendo arrastado
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

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

  // Reordena abas de primeiro nível (a 1ª, a do mestre, é fixa)
  const moveTopSlot = (from: number, to: number) => {
    const list = [...(config.layout_config.custom_slots || [])]
    if (from < 1 || to < 1 || from >= list.length || to >= list.length) return
    const [item] = list.splice(from, 1)
    list.splice(to, 0, item)
    setConfig({ ...config, layout_config: { ...config.layout_config, custom_slots: list } })
  }

  // ───────── Arrastar e soltar ─────────
  const parseDnd = (id: any) => { const str = String(id); const i = str.indexOf(':'); return { kind: str.slice(0, i), key: str.slice(i + 1) } }
  const insertAt = (arr: any[], index: number, item: any) => {
    const next = [...arr]
    next.splice(Math.max(0, Math.min(index, next.length)), 0, item)
    return next
  }
  const withBlocks = (group: any, fn: (blocks: GroupBlock[]) => GroupBlock[]) => {
    const { children: _legacyChildren, group_mode: _legacyMode, ...rest } = group
    return { ...rest, blocks: fn(getGroupBlocks(group)) }
  }
  const findChildLoc = (slots: any[], childId: string) => {
    for (let si = 0; si < slots.length; si++) {
      if (slots[si]?.type !== 'group') continue
      const blocks = getGroupBlocks(slots[si])
      for (let bi = 0; bi < blocks.length; bi++) {
        const ci = blocks[bi].children.findIndex((c: any) => c.id === childId)
        if (ci >= 0) return { si, bi, ci, child: blocks[bi].children[ci] }
      }
    }
    return null
  }
  const findBlockLoc = (slots: any[], blockId: string) => {
    for (let si = 0; si < slots.length; si++) {
      if (slots[si]?.type !== 'group') continue
      const bi = getGroupBlocks(slots[si]).findIndex(b => b.id === blockId)
      if (bi >= 0) return { si, bi }
    }
    return null
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const a = parseDnd(active.id)
    const o = parseDnd(over.id)
    const slots: any[] = [...(config.layout_config.custom_slots || [])]
    const commit = (next: any[]) => setConfig({ ...config, layout_config: { ...config.layout_config, custom_slots: next } })

    // Quando o alvo é um bloco, um filho dele ou a área do bloco: devolve "grupo + bloco + posição"
    const blockTarget = (): { si: number; bi: number; index: number } | null => {
      if (o.kind === 'child') { const l = findChildLoc(slots, o.key); return l ? { si: l.si, bi: l.bi, index: l.ci } : null }
      if (o.kind === 'zone' && o.key !== 'top') { const l = findBlockLoc(slots, o.key); return l ? { si: l.si, bi: l.bi, index: Number.MAX_SAFE_INTEGER } : null }
      if (o.kind === 'block') { const l = findBlockLoc(slots, o.key); return l ? { si: l.si, bi: l.bi, index: Number.MAX_SAFE_INTEGER } : null }
      return null
    }

    // 1) Aba de primeiro nível
    if (a.kind === 'slot') {
      const from = slots.findIndex(sl => sl.id === a.key)
      if (from < 1) return // a aba do mestre é fixa
      if (o.kind === 'slot') {
        const to = slots.findIndex(sl => sl.id === o.key)
        if (to >= 1) moveTopSlot(from, to)
        return
      }
      const target = blockTarget()
      if (!target) return
      const moved = slots[from]
      if (moved.type === 'group') return // grupos não entram em blocos
      const targetGroupId = slots[target.si].id
      slots.splice(from, 1)
      const gi = slots.findIndex(sl => sl.id === targetGroupId)
      if (gi < 0) return
      // a aba vira subaba/quadro do bloco (mantém título, ícone, caso de uso e demais configurações)
      const child = { ...moved, col_span: moved.col_span || '1/2', height: moved.height || 'medium' }
      slots[gi] = withBlocks(slots[gi], bl => bl.map((b, i) => i !== target.bi ? b : { ...b, children: insertAt(b.children, target.index, child) }))
      commit(slots)
      return
    }

    // 2) Subaba / quadro
    if (a.kind === 'child') {
      const src = findChildLoc(slots, a.key)
      if (!src) return
      const removeFromSource = () => {
        slots[src.si] = withBlocks(slots[src.si], bl => bl.map((b, i) => i !== src.bi ? b : { ...b, children: b.children.filter((_: any, j: number) => j !== src.ci) }))
      }
      // para aba de primeiro nível (antes da aba alvo, ou no fim)
      if (o.kind === 'slot' || (o.kind === 'zone' && o.key === 'top')) {
        const toIdx = o.kind === 'slot' ? slots.findIndex(sl => sl.id === o.key) : slots.length
        if (toIdx < 1) return
        if (o.kind === 'slot' && slots[toIdx].id === slots[src.si].id) return // soltou sobre o próprio grupo
        removeFromSource()
        slots.splice(toIdx, 0, src.child)
        commit(slots)
        return
      }
      const target = blockTarget()
      if (!target) return
      if (src.si === target.si && src.bi === target.bi) {
        // reordenar dentro do mesmo bloco
        const last = getGroupBlocks(slots[src.si])[src.bi].children.length - 1
        const to = Math.min(target.index, last)
        if (to === src.ci) return
        slots[src.si] = withBlocks(slots[src.si], bl => bl.map((b, i) => i !== src.bi ? b : { ...b, children: arrayMove(b.children, src.ci, to) }))
      } else {
        // mover para outro bloco (do mesmo grupo ou de outro)
        removeFromSource()
        slots[target.si] = withBlocks(slots[target.si], bl => bl.map((b, i) => i !== target.bi ? b : { ...b, children: insertAt(b.children, target.index, src.child) }))
      }
      commit(slots)
      return
    }

    // 3) Bloco: só reordena dentro do próprio grupo
    if (a.kind === 'block') {
      const src = findBlockLoc(slots, a.key)
      if (!src) return
      let toBi = -1
      if (o.kind === 'block') { const l = findBlockLoc(slots, o.key); if (l && l.si === src.si) toBi = l.bi }
      else if (o.kind === 'child') { const l = findChildLoc(slots, o.key); if (l && l.si === src.si) toBi = l.bi }
      else if (o.kind === 'zone' && o.key !== 'top') { const l = findBlockLoc(slots, o.key); if (l && l.si === src.si) toBi = l.bi }
      if (toBi < 0 || toBi === src.bi) return
      slots[src.si] = withBlocks(slots[src.si], bl => arrayMove(bl, src.bi, toBi))
      commit(slots)
    }
  }

  const dragLabel = (id: string | null): string => {
    if (!id) return ''
    const d = parseDnd(id)
    const slots: any[] = config.layout_config.custom_slots || []
    if (d.kind === 'slot') return slots.find(sl => sl.id === d.key)?.title || 'Aba'
    if (d.kind === 'child') return findChildLoc(slots, d.key)?.child?.title || 'Item'
    if (d.kind === 'block') { const l = findBlockLoc(slots, d.key); return l ? `Bloco ${l.bi + 1}` : 'Bloco' }
    return ''
  }

  const ARROW_BTN = 'p-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 text-neutral-600 dark:text-neutral-300 hover:text-rose-600 disabled:opacity-25 disabled:hover:text-neutral-600'
  const topArrows = (idx: number) => {
    const total = (config.layout_config.custom_slots || []).length
    return (
      <div className="mt-6 flex items-center gap-1">
        <button type="button" disabled={idx <= 1} onClick={() => moveTopSlot(idx, idx - 1)} className={ARROW_BTN} title={t('common.move_up', 'Mover para cima')}>
          <ChevronUp className="w-4 h-4" />
        </button>
        <button type="button" disabled={idx >= total - 1} onClick={() => moveTopSlot(idx, idx + 1)} className={ARROW_BTN} title={t('common.move_down', 'Mover para baixo')}>
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    )
  }

  const updateSlot = (idx: number, updater: (slot: any) => any) => {
    const newSlots = [...(config.layout_config.custom_slots || [])]
    newSlots[idx] = updater({ ...newSlots[idx] })
    setConfig({ ...config, layout_config: { ...config.layout_config, custom_slots: newSlots } })
  }


  // Edita os blocos de um grupo. Grupos antigos (children + group_mode) são convertidos para blocos ao primeiro uso.
  const updateBlocks = (idx: number, fn: (blocks: GroupBlock[]) => GroupBlock[]) => {
    updateSlot(idx, group => {
      const { children: _legacyChildren, group_mode: _legacyMode, ...rest } = group
      return { ...rest, blocks: fn(getGroupBlocks(group)) }
    })
  }

  // Atualiza um filho (subaba/quadro) dentro de um bloco de um grupo
  const updateChild = (idx: number, bIdx: number, cIdx: number, updater: (slot: any) => any) => {
    updateBlocks(idx, blocks => blocks.map((b, i) => i !== bIdx ? b : { ...b, children: b.children.map((c: any, j: number) => j !== cIdx ? c : updater({ ...c })) }))
  }

  // Card de um slot: aba normal (idx) ou filho de um grupo (idx + childIdx)
  const renderSlotCard = (slot: any, idx: number, childPath?: { b: number; c: number }, dragHandle?: ReactNode) => {
    const isChild = !!childPath
    const cardKey = isChild ? `${idx}.${childPath!.b}.${childPath!.c}` : `${idx}`
    const upd = (updater: (s: any) => any) => (isChild ? updateChild(idx, childPath!.b, childPath!.c, updater) : updateSlot(idx, updater))
    const removeCard = () => {
      if (isChild) {
        updateBlocks(idx, blocks => blocks.map((bl, i) => i !== childPath!.b ? bl : { ...bl, children: bl.children.filter((_: any, j: number) => j !== childPath!.c) }))
      } else {
        const newSlots = (config.layout_config.custom_slots || []).filter((_: any, i: number) => i !== idx)
        setConfig({ ...config, layout_config: { ...config.layout_config, custom_slots: newSlots } })
      }
    }
    return (
              <div key={slot.id} className="p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col gap-4">
                {/* Slot header row */}
                <div className="flex gap-4 items-start w-full">
                  {dragHandle && <div className="mt-6">{dragHandle}</div>}
                  {/* Icon */}
                  <div className="space-y-2 flex-initial">
                    <label className="text-[9px] font-black uppercase text-neutral-400">{t('wizard.personalizado.icon_label', 'Ícone')}</label>
                    <div className="relative">
                      <button type="button" onClick={() => setEditingSlotTabIconIndex(cardKey)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-50">
                        <DynamicIcon icon={slot.icon || 'Layout'} className="w-5 h-5 text-neutral-500" />
                      </button>
                      {editingSlotTabIconIndex === cardKey && (
                        <IconPicker
                          currentIcon={slot.icon || 'Layout'}
                          onSelect={(icon: string) => { upd(s => ({ ...s, icon })); setEditingSlotTabIconIndex(null) }}
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
                      onChange={e => upd(s => ({ ...s, title: e.target.value }))}
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
                        upd(s => ({ ...s, use_case_slug: e.target.value, type: selectedUc?.logic_type || 'personalizado' }))
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

                  {!isChild && idx > 0 && topArrows(idx)}

                  {/* Expand / Delete */}
                  <button
                    onClick={() => setExpandedCustomSlot(expandedCustomSlot === cardKey ? null : cardKey)}
                    className="mt-6 p-2.5 text-indigo-500 hover:text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 rounded-lg transition-all"
                    title={expandedCustomSlot === cardKey ? t('wizard.personalizado.collapse_config', 'Recolher Configurações') : t('wizard.personalizado.expand_config', 'Expandir Configurações')}
                  >
                    {expandedCustomSlot === cardKey ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {tabToDelete === cardKey ? (
                    <div className="mt-6 flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                      <button
                        onClick={() => { removeCard(); setTabToDelete(null) }}
                        className="p-2.5 text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> {t('common.yes', 'Sim')}
                      </button>
                      <button onClick={() => setTabToDelete(null)} className="p-2.5 text-neutral-500 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-lg transition-all">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setTabToDelete(cardKey)} className="mt-6 p-2.5 text-neutral-400 hover:text-red-500 bg-neutral-50 hover:bg-red-50 dark:bg-neutral-900 dark:hover:bg-red-900/20 rounded-lg transition-all" title={t('wizard.personalizado.remove_tab', 'Remover Aba')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Expanded slot config */}
                {expandedCustomSlot === cardKey && (
                  <div className="w-full space-y-4 animate-in slide-in-from-top-2 duration-200">
                    {(isChild || idx > 0) && (
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
                                  onChange={e => upd(s => ({ ...s, [key]: e.target.checked }))}
                                  className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {!isChild && (<>
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
                                onChange={() => upd(s => ({ ...s, render_mode: value }))}
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
                                  onChange={e => upd(s => ({ ...s, button_config: { ...(s.button_config || {}), location: e.target.value } }))}
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
                                    onChange={e => upd(s => ({ ...s, button_config: { ...(s.button_config || {}), target_tab_id: e.target.value } }))}
                                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium outline-none mt-1"
                                  >
                                    <option value="">Selecione a aba...</option>
                                    {(config.layout_config.custom_slots || []).filter((_: any, i: number) => isChild || i !== idx).map((otherSlot: any) => (
                                      <option key={otherSlot.id} value={otherSlot.id}>{otherSlot.title}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              <div>
                                <label className="text-[9px] font-black uppercase text-neutral-400">Como deve abrir?</label>
                                <select
                                  value={slot.button_config?.action_type || 'modal'}
                                  onChange={e => upd(s => ({ ...s, button_config: { ...(s.button_config || {}), action_type: e.target.value } }))}
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
                                  onChange={e => upd(s => ({ ...s, button_config: { ...(s.button_config || {}), label: e.target.value } }))}
                                  className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium outline-none mt-1"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-black uppercase text-neutral-400">Ícone do Botão (Opcional)</label>
                                <button
                                  onClick={() => setEditingSlotIconIndex(cardKey)}
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
                                {editingSlotIconIndex === cardKey && (
                                  <IconPicker
                                    currentIcon={slot.button_config?.icon || ''}
                                    onSelect={(icon: string) => { upd(s => ({ ...s, button_config: { ...(s.button_config || {}), icon } })); setEditingSlotIconIndex(null) }}
                                    onClose={() => setEditingSlotIconIndex(null)}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        </>)}
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
                          onClick={() => upd(s => ({ ...s, use_master_id: s.use_master_id === false ? true : false }))}
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
                          onChange={(newPath) => upd(s => ({ ...s, relation_path: newPath }))}
                          relations={relations}
                          models={models}
                        />
                      )}

                      {/* Static filters */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-black uppercase text-neutral-500 tracking-wider">Filtros Estáticos (Opcional)</label>
                          <button
                            onClick={() => upd(s => ({ ...s, static_filters: [...(s.static_filters || []), { field: '', operator: '=', value: '', logic: 'AND' }] }))}
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
                                    onChange={e => upd(s => { const sf = [...(s.static_filters || [])]; sf[fIdx] = { ...sf[fIdx], logic: e.target.value }; return { ...s, static_filters: sf } })}
                                    className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md px-2 py-0.5 text-[10px] font-black tracking-widest uppercase text-indigo-600 dark:text-indigo-400 outline-none"
                                  >
                                    <option value="AND">E (AND)</option>
                                    <option value="OR">OU (OR)</option>
                                  </select>
                                </div>
                              )}
                              <div className="flex gap-2 items-center">
                                <select value={filter.field || ''} onChange={e => upd(s => { const sf = [...(s.static_filters || [])]; sf[fIdx] = { ...sf[fIdx], field: e.target.value }; return { ...s, static_filters: sf } })} className="flex-[2] bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500">
                                  {renderSlotFieldOptions(slot.model_id, true, 'Selecione o campo...')}
                                </select>
                                <select value={filter.operator || '='} onChange={e => upd(s => { const sf = [...(s.static_filters || [])]; sf[fIdx] = { ...sf[fIdx], operator: e.target.value }; return { ...s, static_filters: sf } })} className="flex-[1] bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 outline-none focus:border-indigo-500 text-center">
                                  <option value="=">=</option>
                                  <option value=">">&gt;</option>
                                  <option value="<">&lt;</option>
                                  <option value=">=">&ge;</option>
                                  <option value="<=">&le;</option>
                                  <option value="between">Entre</option>
                                </select>
                                <div className="flex-[2] flex gap-2">
                                  <input type="text" value={filter.value || ''} onChange={e => upd(s => { const sf = [...(s.static_filters || [])]; sf[fIdx] = { ...sf[fIdx], value: e.target.value }; return { ...s, static_filters: sf } })} placeholder={filter.operator === 'between' ? 'Valor inicial' : 'Valor desejado'} className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500" />
                                  {filter.operator === 'between' && (
                                    <input type="text" value={filter.value2 || ''} onChange={e => upd(s => { const sf = [...(s.static_filters || [])]; sf[fIdx] = { ...sf[fIdx], value2: e.target.value }; return { ...s, static_filters: sf } })} placeholder="Valor final" className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500" />
                                  )}
                                </div>
                                <button onClick={() => upd(s => { const sf = [...(s.static_filters || [])].filter((_: any, i: number) => i !== fIdx); return { ...s, static_filters: sf } })} className="p-2 text-neutral-400 hover:text-red-500 rounded-lg transition-colors flex-shrink-0">
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
                          <button onClick={() => upd(s => ({ ...s, dynamic_filters: [...(s.dynamic_filters || []), { field: '', label: '' }] }))} className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Adicionar Filtro de Tela
                          </button>
                        </div>
                        {(slot.dynamic_filters || []).map((filterItem: any, fIdx: number) => {
                          const isObject = typeof filterItem === 'object' && filterItem !== null
                          const fieldVal = isObject ? filterItem.field : filterItem
                          const labelVal = isObject ? filterItem.label : ''
                          return (
                            <div key={`dyn-${fIdx}`} className="flex gap-2 items-center">
                              <select value={fieldVal || ''} onChange={e => upd(s => { const df = [...(s.dynamic_filters || [])]; df[fIdx] = { field: e.target.value, label: labelVal }; return { ...s, dynamic_filters: df } })} className="flex-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500">
                                {renderSlotFieldOptions(slot.model_id, true, 'Selecione o campo para pesquisa...')}
                              </select>
                              <input type="text" value={labelVal || ''} onChange={e => upd(s => { const df = [...(s.dynamic_filters || [])]; df[fIdx] = { field: fieldVal, label: e.target.value }; return { ...s, dynamic_filters: df } })} placeholder="Rótulo (opcional)" className="flex-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500" />
                              <button onClick={() => upd(s => { const df = [...(s.dynamic_filters || [])].filter((_: any, i: number) => i !== fIdx); return { ...s, dynamic_filters: df } })} className="p-2 text-neutral-400 hover:text-red-500 rounded-lg transition-colors">
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
    )
  }

  const GROUP_WIDTHS: Array<[string, string]> = [['1/4', '1/4 (25%)'], ['1/3', '1/3 (33%)'], ['1/2', '1/2 (50%)'], ['2/3', '2/3 (66%)'], ['3/4', '3/4 (75%)'], ['full', 'Total (100%)']]
  const GROUP_HEIGHTS: Array<[string, string]> = [['compact', 'Compacta (320px)'], ['medium', 'Média (480px)'], ['large', 'Grande (640px)'], ['auto', 'Automática'], ['custom', 'Personalizada (px)']]

  // Card de um grupo: contém BLOCOS; cada bloco é "Subabas" (um caso de uso por vez) ou "Quadros" (todos visíveis, em grade)
  const renderGroupCard = (group: any, idx: number, dragHandle?: ReactNode) => {
    const cardKey = `${idx}`
    const blocks = getGroupBlocks(group)
    const modeLabel = (m: string) => (m === 'grid' ? t('wizard.personalizado.group_mode_grid', 'Quadros') : t('wizard.personalizado.group_mode_tabs', 'Subabas'))
    const addBlock = (mode: 'tabs' | 'grid') =>
      updateBlocks(idx, bl => [...bl, { id: `block-${Date.now()}`, mode, children: [] }])
    const moveBlock = (from: number, to: number) => {
      if (to < 0 || to >= blocks.length) return
      updateBlocks(idx, bl => { const list = [...bl]; const [item] = list.splice(from, 1); list.splice(to, 0, item); return list })
    }
    // Move uma subaba/quadro para OUTRO bloco (no fim dele) ou para um bloco novo
    const moveChildToBlock = (fromB: number, cIdx: number, target: string) => {
      updateBlocks(idx, bl => {
        const child = bl[fromB]?.children[cIdx]
        if (!child) return bl
        let next = bl.map((b, i) => i === fromB ? { ...b, children: b.children.filter((_: any, j: number) => j !== cIdx) } : b)
        if (target === 'new-tabs' || target === 'new-grid') {
          next = [...next, { id: `block-${Date.now()}`, mode: target === 'new-grid' ? 'grid' : 'tabs', children: [child] }]
        } else {
          const tIdx = next.findIndex(b => b.id === target)
          if (tIdx < 0) return bl
          next[tIdx] = { ...next[tIdx], children: [...next[tIdx].children, child] }
        }
        return next
      })
    }
    const moveChild = (bIdx: number, from: number, to: number) => {
      updateBlocks(idx, bl => bl.map((b, i) => {
        if (i !== bIdx || to < 0 || to >= b.children.length) return b
        const list = [...b.children]; const [item] = list.splice(from, 1); list.splice(to, 0, item)
        return { ...b, children: list }
      }))
    }
    return (
      <div key={group.id} className="p-4 bg-white dark:bg-neutral-950 border-2 border-rose-200 dark:border-rose-900/50 rounded-xl flex flex-col gap-4">
        <div className="flex gap-4 items-start w-full">
          {dragHandle && <div className="mt-6">{dragHandle}</div>}
          <div className="space-y-2 flex-initial">
            <label className="text-[9px] font-black uppercase text-neutral-400">{t('wizard.personalizado.icon_label', 'Ícone')}</label>
            <div className="relative">
              <button type="button" onClick={() => setEditingSlotTabIconIndex(cardKey)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-50">
                <DynamicIcon icon={group.icon || 'LayoutGrid'} className="w-5 h-5 text-neutral-500" />
              </button>
              {editingSlotTabIconIndex === cardKey && (
                <IconPicker
                  currentIcon={group.icon || 'LayoutGrid'}
                  onSelect={(icon: string) => { updateSlot(idx, g => ({ ...g, icon })); setEditingSlotTabIconIndex(null) }}
                  onClose={() => setEditingSlotTabIconIndex(null)}
                />
              )}
            </div>
          </div>

          <div className="space-y-2 flex-1">
            <label className="text-[9px] font-black uppercase text-neutral-400">{t('wizard.personalizado.group_title_label', 'Título da Aba (Grupo)')}</label>
            <input
              type="text" value={group.title || ''}
              onChange={e => updateSlot(idx, g => ({ ...g, title: e.target.value }))}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-bold text-neutral-700 dark:text-neutral-200 outline-none focus:border-rose-500"
              placeholder={t('wizard.personalizado.group_title_placeholder', 'Ex: Logística')}
            />
          </div>

          {idx > 0 && topArrows(idx)}

          {tabToDelete === cardKey ? (
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
            <button onClick={() => setTabToDelete(cardKey)} className="mt-6 p-2.5 text-neutral-400 hover:text-red-500 bg-neutral-50 hover:bg-red-50 dark:bg-neutral-900 dark:hover:bg-red-900/20 rounded-lg transition-all" title={t('wizard.personalizado.remove_tab', 'Remover Aba')}>
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <p className="text-[10px] text-neutral-400 -mt-2">
          {t('wizard.personalizado.group_hint_blocks', 'Um grupo é feito de blocos, empilhados de cima para baixo. Cada bloco pode ser de Subabas (um caso de uso por vez) ou de Quadros (vários visíveis ao mesmo tempo).')}
        </p>

        <SortableContainer ids={blocks.map(b => `block:${b.id}`)}>
        {blocks.map((block, bIdx) => {
          const blockKey = `${idx}.b${bIdx}`
          return (
            <SortableItem key={block.id} id={`block:${block.id}`}>{(blockHandle) => (
            <div className="space-y-3 p-3 border border-rose-200 dark:border-rose-900/50 rounded-xl bg-rose-50/30 dark:bg-rose-900/5 my-2">
              <div className="flex flex-wrap items-center gap-3">
                {blockHandle}
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">
                  {t('wizard.personalizado.block_n', 'Bloco')} {bIdx + 1}
                </span>
                <div className="flex rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800">
                  {(['tabs', 'grid'] as const).map(m => (
                    <button
                      key={m} type="button"
                      onClick={() => updateBlocks(idx, bl => bl.map((b, i) => i === bIdx ? { ...b, mode: m } : b))}
                      className={cn(
                        'px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all',
                        block.mode === m ? 'bg-rose-500 text-white' : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      )}
                    >
                      {modeLabel(m)}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-neutral-400 flex-1 min-w-[200px]">
                  {block.mode === 'tabs'
                    ? t('wizard.personalizado.group_hint_tabs', 'Cada caso de uso vira uma subaba dentro desta aba.')
                    : t('wizard.personalizado.group_hint_grid', 'Todos os casos de uso ficam visíveis ao mesmo tempo, em quadros. Defina a largura e a altura de cada um.')}
                </p>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={bIdx === 0} onClick={() => moveBlock(bIdx, bIdx - 1)} className={ARROW_BTN} title={t('common.move_up', 'Mover para cima')}>
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button type="button" disabled={bIdx === blocks.length - 1} onClick={() => moveBlock(bIdx, bIdx + 1)} className={ARROW_BTN} title={t('common.move_down', 'Mover para baixo')}>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {tabToDelete === blockKey ? (
                    <div className="flex items-center gap-1 ml-1">
                      <button
                        onClick={() => { updateBlocks(idx, bl => bl.filter((_, i) => i !== bIdx)); setTabToDelete(null) }}
                        className="px-2 py-1 text-white bg-red-500 hover:bg-red-600 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> {t('common.yes', 'Sim')}
                      </button>
                      <button onClick={() => setTabToDelete(null)} className="p-1.5 text-neutral-500 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 rounded-lg"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <button onClick={() => setTabToDelete(blockKey)} className="p-1.5 text-neutral-400 hover:text-red-500 rounded-md" title={t('wizard.personalizado.remove_block', 'Remover bloco')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <DropZone id={`zone:${block.id}`} className="space-y-3 pl-4 border-l-2 border-rose-200 dark:border-rose-900/50 rounded-md transition-colors" activeClassName="bg-rose-100/70 dark:bg-rose-900/20">
                {block.children.length === 0 && (
                  <p className="text-[11px] text-neutral-400 italic">{t('wizard.personalizado.group_empty', 'Nenhum caso de uso neste bloco ainda.')}</p>
                )}
                <SortableContainer ids={block.children.map((c: any) => `child:${c.id}`)}>
                {block.children.map((child: any, cIdx: number) => (
                  <SortableItem key={child.id} id={`child:${child.id}`}>{(childHandle) => (
                  <div className="space-y-2 mb-3">
                    <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-rose-50/60 dark:bg-rose-900/10 rounded-lg">
                      {childHandle}
                      <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">
                        {block.mode === 'tabs' ? t('wizard.personalizado.subtab_n', 'Subaba') : t('wizard.personalizado.panel_n', 'Quadro')} {cIdx + 1}
                      </span>
                      {block.mode === 'grid' && (
                        <>
                          <label className="flex items-center gap-2 text-[9px] font-black uppercase text-neutral-400">
                            {t('wizard.personalizado.panel_width', 'Largura')}
                            <select
                              value={child.col_span || '1/2'}
                              onChange={e => updateChild(idx, bIdx, cIdx, c => ({ ...c, col_span: e.target.value }))}
                              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-xs font-bold text-neutral-700 dark:text-neutral-200 outline-none focus:border-rose-500 normal-case"
                            >
                              {GROUP_WIDTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </label>
                          <label className="flex items-center gap-2 text-[9px] font-black uppercase text-neutral-400">
                            {t('wizard.personalizado.panel_height', 'Altura')}
                            <select
                              value={child.height || 'medium'}
                              onChange={e => updateChild(idx, bIdx, cIdx, c => ({ ...c, height: e.target.value }))}
                              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-xs font-bold text-neutral-700 dark:text-neutral-200 outline-none focus:border-rose-500 normal-case"
                            >
                              {GROUP_HEIGHTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </label>
                          {child.height === 'custom' && (
                            <input
                              type="number" min={120} max={2000} step={10} placeholder="px"
                              value={child.height_px || ''}
                              onChange={e => updateChild(idx, bIdx, cIdx, c => ({ ...c, height_px: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                              className="w-24 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:border-rose-500"
                            />
                          )}
                        </>
                      )}
                      <select
                        value=""
                        onChange={e => { if (e.target.value) moveChildToBlock(bIdx, cIdx, e.target.value) }}
                        className="ml-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-[10px] font-bold text-neutral-600 dark:text-neutral-300 outline-none focus:border-rose-500 normal-case"
                        title={t('wizard.personalizado.move_to_block', 'Mover para outro bloco')}
                      >
                        <option value="">{t('wizard.personalizado.move_to', 'Mover para…')}</option>
                        {blocks.map((b, i) => i === bIdx ? null : (
                          <option key={b.id} value={b.id}>{t('wizard.personalizado.block_n', 'Bloco')} {i + 1} ({modeLabel(b.mode)})</option>
                        ))}
                        <option value="new-tabs">{t('wizard.personalizado.new_block_tabs', 'Novo bloco de Subabas')}</option>
                        <option value="new-grid">{t('wizard.personalizado.new_block_grid', 'Novo bloco de Quadros')}</option>
                      </select>
                      <div className="flex items-center gap-1">
                        <button type="button" disabled={cIdx === 0} onClick={() => moveChild(bIdx, cIdx, cIdx - 1)} className={ARROW_BTN} title={t('common.move_up', 'Mover para cima')}>
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button type="button" disabled={cIdx === block.children.length - 1} onClick={() => moveChild(bIdx, cIdx, cIdx + 1)} className={ARROW_BTN} title={t('common.move_down', 'Mover para baixo')}>
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {renderSlotCard(child, idx, { b: bIdx, c: cIdx })}
                  </div>
                  )}</SortableItem>
                ))}
                </SortableContainer>

                <button
                  onClick={() => updateBlocks(idx, bl => bl.map((b, i) => i !== bIdx ? b : {
                    ...b,
                    children: [...b.children, {
                      id: `sub-${Date.now()}`,
                      title: b.mode === 'tabs' ? t('wizard.personalizado.new_subtab_title', 'Nova Subaba') : t('wizard.personalizado.new_panel_title', 'Novo Quadro'),
                      type: 'form',
                      model_id: config.selected_models[0],
                      col_span: '1/2',
                      height: 'medium',
                    }],
                  }))}
                  className="w-full p-3 border-2 border-dashed border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center justify-center gap-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all font-bold text-[10px] uppercase tracking-widest"
                >
                  <Plus className="w-4 h-4" />
                  {block.mode === 'tabs' ? t('wizard.personalizado.add_subtab', 'Adicionar Subaba') : t('wizard.personalizado.add_panel', 'Adicionar Quadro')}
                </button>
              </DropZone>
            </div>
            )}</SortableItem>
          )
        })}
        </SortableContainer>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={() => addBlock('tabs')} className="p-3 border-2 border-dashed border-rose-300 dark:border-rose-800 rounded-xl flex items-center justify-center gap-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all font-bold text-[10px] uppercase tracking-widest">
            <Plus className="w-4 h-4" /> {t('wizard.personalizado.add_block_tabs', 'Adicionar Bloco de Subabas')}
          </button>
          <button onClick={() => addBlock('grid')} className="p-3 border-2 border-dashed border-rose-300 dark:border-rose-800 rounded-xl flex items-center justify-center gap-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all font-bold text-[10px] uppercase tracking-widest">
            <Plus className="w-4 h-4" /> {t('wizard.personalizado.add_block_grid', 'Adicionar Bloco de Quadros')}
          </button>
        </div>
      </div>
    )
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
            {(() => {
              const allSlots: any[] = config.layout_config.custom_slots || []
              const renderTop = (slot: any, idx: number, handle?: ReactNode) =>
                slot.type === 'group' ? renderGroupCard(slot, idx, handle) : renderSlotCard(slot, idx, undefined, handle)
              return (
                <SlotDndProvider
                  onDragStart={(e: DragStartEvent) => setActiveDragId(String(e.active.id))}
                  onDragEnd={handleDragEnd}
                  onDragCancel={() => setActiveDragId(null)}
                  overlay={activeDragId ? (
                    <div className="px-4 py-2 rounded-xl bg-white dark:bg-neutral-900 border-2 border-rose-400 shadow-xl text-xs font-black uppercase tracking-widest text-rose-600">
                      {dragLabel(activeDragId)}
                    </div>
                  ) : null}
                >
                  {allSlots.length > 0 && renderTop(allSlots[0], 0)}
                  <SortableContainer ids={allSlots.slice(1).map((sl: any) => `slot:${sl.id}`)}>
                    {allSlots.slice(1).map((slot: any, i: number) => (
                      <SortableItem key={slot.id} id={`slot:${slot.id}`}>{(handle) => <div className="mt-4">{renderTop(slot, i + 1, handle)}</div>}</SortableItem>
                    ))}
                  </SortableContainer>
                  {activeDragId && parseDnd(activeDragId).kind === 'child' && (
                    <DropZone
                      id="zone:top"
                      className="mt-4 p-4 border-2 border-dashed border-rose-300 dark:border-rose-800 rounded-xl text-center text-[10px] font-black uppercase tracking-widest text-rose-500 transition-colors"
                      activeClassName="bg-rose-100 dark:bg-rose-900/30"
                    >
                      {t('wizard.personalizado.drop_to_tab', 'Solte aqui para transformar em aba de primeiro nível')}
                    </DropZone>
                  )}
                </SlotDndProvider>
              )
            })()}

            {/* Add tab button */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <button
                disabled={(config.layout_config.custom_slots || []).length === 0}
                title={(config.layout_config.custom_slots || []).length === 0 ? t('wizard.personalizado.add_group_disabled', 'Adicione primeiro a aba do Mestre.') : ''}
                onClick={() => {
                  const newSlots = [...(config.layout_config.custom_slots || []), { id: `group-${Date.now()}`, type: 'group', title: t('wizard.personalizado.new_group_title', 'Novo Grupo'), icon: 'LayoutGrid', blocks: [{ id: `block-${Date.now()}`, mode: 'tabs', children: [] }], model_id: config.selected_models[0] }]
                  setConfig({ ...config, layout_config: { ...config.layout_config, custom_slots: newSlots } })
                }}
                className="w-full p-4 border-2 border-dashed border-rose-300 dark:border-rose-800 rounded-xl flex items-center justify-center gap-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all font-bold text-xs uppercase tracking-widest shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Layout className="w-4 h-4" />
                {t('wizard.personalizado.add_group', 'Adicionar Grupo (Subabas / Quadros)')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
