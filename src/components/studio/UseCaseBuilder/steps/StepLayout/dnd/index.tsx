'use client'

// ─── Drag-and-Drop primitive components for StepLayout ───────────────────────
// These are thin wrappers around dnd-kit primitives that apply project-specific
// styling. They are all colocated here because they share the same imports and
// are only used within StepLayout.

import { CSS } from '@dnd-kit/utilities'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { ChevronDown, ChevronUp, GripVertical, Trash2, Activity, BarChart3, Pencil } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'

// Try a dynamic import of Gauge icon with safe fallback
let Gauge: any = BarChart3
try { Gauge = require('lucide-react').Gauge } catch { /* keep fallback */ }

// ─── DraggableFieldCard ───────────────────────────────────────────────────────

export function DraggableFieldCard({ field }: { field: any }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `source-${field.id}`,
    data: { fieldId: field.id }
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "py-2.5 px-4 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl flex items-center justify-between group cursor-grab active:cursor-grabbing hover:border-indigo-200 dark:hover:border-indigo-800/50 hover:shadow-md transition-all",
        isDragging && "opacity-20 grayscale"
      )}
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200">{field.display_name || field.db_column_name}</span>
        <span className="text-[8px] font-black font-mono text-neutral-400 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded-md opacity-60 uppercase">{field.data_type}</span>
      </div>
    </div>
  )
}

// ─── DroppableZone ────────────────────────────────────────────────────────────

export function DroppableZone({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        "transition-all duration-300 relative",
        isOver && "bg-indigo-100/50 dark:bg-indigo-900/30 border-indigo-500 border-solid scale-[1.02] shadow-[0_0_40px_rgba(99,102,241,0.15)] ring-4 ring-indigo-500/10"
      )}
    >
      {isOver && (
        <div className="absolute inset-0 bg-indigo-500/5 pointer-events-none rounded-[inherit] animate-pulse" />
      )}
      {children}
    </div>
  )
}

// ─── DraggableTableHeader ─────────────────────────────────────────────────────

export function DraggableTableHeader({ model, isCollapsed, onToggle }: { model: any; isCollapsed: boolean; onToggle: () => void }) {
  const { t } = useI18n()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `table-source-${model.id}`,
    data: { tableId: model.id, isTable: true }
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => { if (isDragging) return; onToggle() }}
      className={cn(
        "sticky top-0 z-20 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-5 py-4 flex items-center justify-between cursor-pointer group/header border-b border-neutral-100 dark:border-neutral-800/50 shadow-sm transition-all",
        isDragging && "opacity-20 grayscale"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-4 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
        <div className="flex flex-col">
          <span className="text-[11px] font-black text-neutral-900 dark:text-white uppercase tracking-[0.15em]">
            {model.display_name || model.db_table_name}
          </span>
          <span className="text-[8px] font-bold text-indigo-500/0 group-hover:text-indigo-500 transition-all uppercase tracking-widest leading-none mt-1">
            {t('wizard.layout.drag_to_add_all', 'Arraste para add tudo')}
          </span>
        </div>
      </div>
      <div className="p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover/header:text-indigo-500 group-hover/header:bg-indigo-50 dark:group-hover/header:bg-indigo-500/10 transition-all">
        {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </div>
    </div>
  )
}

// ─── SortableFieldChip ────────────────────────────────────────────────────────

interface SortableFieldChipProps {
  id: string
  itemValue: string
  zoneType: 'filter' | 'grid' | 'form'
  onEdit?: () => void
  toggleField: (fieldId: string, zone: string) => void
  children: React.ReactNode
}

export function SortableFieldChip({ id, itemValue, toggleField, onEdit, children, zoneType }: SortableFieldChipProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { opacity: 0.5, zIndex: 50, position: 'relative' as const } : {})
  }

  const colorClasses: Record<string, string> = {
    filter: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20',
    grid:   'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20',
    form:   'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
  }
  const activeColor = colorClasses[zoneType] || colorClasses.filter

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onEdit}
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2 text-white rounded-xl shadow-lg group cursor-pointer transition-all select-none w-full min-w-0",
        activeColor
      )}
    >
      <div className="flex-1 min-w-0 truncate">{children}</div>
      <Trash2
        className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer hover:text-red-200 transition-colors"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); toggleField(itemValue, `${zoneType}_fields`) }}
      />
    </div>
  )
}

// ─── SortableWidgetCard ───────────────────────────────────────────────────────

interface SortableWidgetCardProps {
  widget: any
  onEdit: () => void
  onDelete: () => void
  getFieldName: (id: string) => string
}

export function SortableWidgetCard({ widget, onEdit, onDelete, getFieldName }: SortableWidgetCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `widget-${widget.id}` })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] flex items-center justify-between group shadow-sm hover:border-indigo-300 transition-all relative overflow-hidden"
    >
      <div className="flex items-center gap-3 relative z-10">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1.5 text-neutral-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all">
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          {widget.type === 'kpi'   ? <Activity className="w-5 h-5" />
          : widget.type === 'gauge' ? <Gauge className="w-5 h-5" />
          : <BarChart3 className="w-5 h-5" />}
        </div>
        <div>
          <h5 className="text-xs font-black uppercase tracking-tight text-neutral-900 dark:text-white">{widget.title}</h5>
          <p className="text-[9px] text-neutral-400 uppercase font-black tracking-widest">
            {widget.type} • {widget.calc} ({getFieldName(widget.field) || 'Toda Tabela'})
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all relative z-10">
        <button onClick={onEdit}   className="p-2 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"><Pencil className="w-3.5 h-3.5" /></button>
        <button onClick={onDelete} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  )
}

// ─── DraggableItem ────────────────────────────────────────────────────────────

export function DraggableItem({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(className, isDragging && "opacity-20 grayscale")}
    >
      {children}
    </div>
  )
}
