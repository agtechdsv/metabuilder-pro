'use client'

import { useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import { MoreVertical, Calendar, User, Tag, GripVertical, Plus, Minimize2, Maximize2, ZoomIn, LayoutGrid, Zap, Pencil, Trash2 } from 'lucide-react'
import DynamicIcon from '@/components/runtime/DynamicIcon'
import { cn, getActionColorClasses } from '@/lib/utils'
import { formatFieldValue } from '@/lib/formatters'
import { useI18n } from '@/i18n/I18nContext'

interface DynamicKanbanProps {
  data: any[]
  fields: any[]
  groupField: any
  onMove: (recordId: string, newValue: any) => void
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => void
  dictionary?: any
  customActions?: any[]
  onCustomAction?: (action: any, row?: any) => void
  kanbanGroupDisplayField?: string
  kanbanCardFields?: string[]
  relationalOptions?: Record<string, any[]>
}

export default function DynamicKanban({
  data,
  fields,
  groupField,
  onMove,
  onView,
  onEdit,
  onDelete,
  dictionary = {},
  customActions = [],
  onCustomAction,
  kanbanGroupDisplayField,
  kanbanCardFields,
  relationalOptions = {}
}: DynamicKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const { t } = useI18n()
  const [scale, setScale] = useState(1.0)
  
  const scales = [
    { value: 0.8, icon: <Minimize2 className="w-3.5 h-3.5" />, label: t('runtime.scale_small', 'Pequeno') },
    { value: 1.0, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: t('runtime.scale_normal', 'Normal') },
    { value: 1.2, icon: <Maximize2 className="w-3.5 h-3.5" />, label: t('runtime.scale_large', 'Grande') },
    { value: 1.5, icon: <ZoomIn className="w-3.5 h-3.5" />, label: t('runtime.scale_xl', 'Extra Grande') }
  ]
  
  // Agrupar dados por colunas baseadas no groupField
  const groupColumnName = groupField?.db_column_name || 'status'
  
  // Descobrir todos os valores únicos do groupField para criar colunas
  const columns = useMemo(() => {
    const values = Array.from(new Set(data.map(item => String(item[groupColumnName] || 'Unassigned'))))
    return values.sort()
  }, [data, groupColumnName])

  // Sensores para DND
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (!over) return

    const activeRecordId = active.id as string
    const overId = over.id as string

    // Se "over" for uma coluna, o overId será o nome da coluna
    // Se "over" for outro card, precisamos descobrir a qual coluna ele pertence
    let newStatus = overId
    if (!columns.includes(overId)) {
      const overRecord = data.find(item => String(item._key || item.id || item.ID) === overId)
      if (overRecord) {
        newStatus = String(overRecord[groupColumnName] || 'Unassigned')
      }
    }

    const activeRecord = data.find(item => String(item._key || item.id || item.ID) === activeRecordId)
    if (activeRecord && String(activeRecord[groupColumnName] || 'Unassigned') !== newStatus) {
      onMove(activeRecordId, newStatus)
    }

    setActiveId(null)
  }

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex justify-end mb-4 px-4 w-full">
        <div className="flex items-center bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800">
          {scales.map(s => (
            <button
              key={s.value}
              onClick={() => setScale(s.value)}
              title={s.label}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                scale === s.value 
                  ? "bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                  : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              )}
            >
              {s.icon}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-6 overflow-x-auto overflow-y-hidden pb-6 h-[calc(100vh-240px)] min-h-[500px] custom-scrollbar px-4 -mx-4" style={{ zoom: scale }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {columns.map(column => {
          let displayTitle = dictionary[column] || column;
          if (column !== 'Unassigned') {
            const sampleItem = data.find(item => String(getNestedValue(item, groupColumnName)) === column);
            if (sampleItem) {
              if (kanbanGroupDisplayField) {
                const nestedVal = getNestedValue(sampleItem, kanbanGroupDisplayField);
                if (nestedVal) displayTitle = nestedVal;
              } else {
                const labelField = `${groupColumnName}_nome`;
                if (sampleItem[labelField]) {
                  displayTitle = sampleItem[labelField];
                }
              }
            }
          }
          return (
          <KanbanColumn
            key={column}
            id={column}
            title={displayTitle}
            fields={fields.filter((f: any) => {
              // Hide group columns from card content
              if (f.db_column_name === groupColumnName || f.db_column_name === kanbanGroupDisplayField) return false;
              // If card fields are specified, only show those
              if (kanbanCardFields && kanbanCardFields.length > 0) {
                return kanbanCardFields.includes(f.db_column_name);
              }
              return true;
            })}
            items={data.filter(item => String(getNestedValue(item, groupColumnName) || 'Unassigned') === column)}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            customActions={customActions}
            onCustomAction={onCustomAction}
            relationalOptions={relationalOptions}
          />
          )
        })}

        <DragOverlay>
          {activeId ? (
            <KanbanCard
              id={activeId}
              item={data.find(item => String(item._key || item.id || item.ID) === activeId)}
              fields={fields}
              isOverlay
              customActions={customActions}
              onCustomAction={onCustomAction}
              relationalOptions={relationalOptions}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
    </div>
  )
}

function KanbanColumn({ id, title, items, fields, onView, onEdit, onDelete, relationalOptions, customActions = [], onCustomAction }: any) {
  return (
    <div className="flex-shrink-0 w-80 flex flex-col bg-neutral-50/50 dark:bg-neutral-900/30 border border-neutral-200/50 dark:border-neutral-800/50 rounded-[2rem] overflow-hidden h-full">
      {/* Column Header */}
      <div className="flex items-center justify-between px-5 py-4 sticky top-0 bg-white dark:bg-[#0a0a0a] z-30 border-b border-neutral-200 dark:border-neutral-800 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]"></div>
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-600 dark:text-neutral-300">
            {title}
          </h3>
          <span className="ml-2 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-md text-[10px] font-black text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
            {items.length}
          </span>
        </div>
        <button className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 transition-all active:scale-90">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Drop Zone / Context - Indepentent Scroll for each column */}
      <SortableContext
        id={id}
        items={items.map((item: any) => String(item._key || item.id || item.ID))}
        strategy={verticalListSortingStrategy}
      >
        <div className="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 min-h-0">
          <AnimatePresence>
            {items.map((item: any) => (
              <KanbanCard 
                key={String(item._key || item.id || item.ID)} 
                id={String(item._key || item.id || item.ID)} 
                item={item} 
                fields={fields}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
                customActions={customActions}
                onCustomAction={onCustomAction}
                relationalOptions={relationalOptions}
              />
            ))}
          </AnimatePresence>
          
          {items.length === 0 && (
            <div className="h-20 flex-shrink-0 flex items-center justify-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-300">Empty Column</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

function getNestedValue(obj: any, path: string) {
  if (!path) return undefined
  if (obj && obj[path] !== undefined) return obj[path]
  return path.split('.').reduce((acc, part) => acc && acc[part], obj)
}

function KanbanCard({ id, item, fields, isOverlay, onView, onEdit, onDelete, relationalOptions, customActions = [], onCustomAction }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  // Pegamos os 2 primeiros campos para o cabeçalho (ex: Nome/Título)
  // E o restante para o corpo
  const mainField = fields[0]
  const subField = fields[1]
  const otherFields = fields.slice(2, 5)

  const mainZoneConfig = mainField?.config?.grid_config || mainField?.config || {}
  const subZoneConfig = subField?.config?.grid_config || subField?.config || {}

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layoutId={id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      {...attributes}
      {...listeners}
      className={cn(
        "group bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 rounded-[2rem] shadow-sm hover:shadow-xl hover:border-indigo-500/30 transition-all cursor-grab active:cursor-grabbing relative overflow-hidden min-h-[140px] flex flex-col justify-between select-none",
        isOverlay && "shadow-2xl border-indigo-500 ring-2 ring-indigo-500/20 rotate-2 scale-105 z-50"
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-0.5">
            <h4 
              style={{
                fontFamily: mainZoneConfig.content?.font,
                fontSize: mainZoneConfig.content?.size || '12px',
                color: mainZoneConfig.content?.color,
              }}
              className="font-bold text-neutral-900 dark:text-white leading-tight"
            >
              {formatFieldValue(getNestedValue(item, mainField?.db_column_name), mainField, relationalOptions, mainZoneConfig) || 'Untitled'}
            </h4>
            {subField && (
              <span 
                style={{
                  fontFamily: subZoneConfig.content?.font,
                  fontSize: subZoneConfig.content?.size || '10px',
                  color: subZoneConfig.content?.color || undefined,
                }}
                className={cn(
                  "text-[10px] font-medium truncate max-w-[180px]",
                  !subZoneConfig.content?.color && "text-neutral-400"
                )}
              >
                {formatFieldValue(getNestedValue(item, subField.db_column_name), subField, relationalOptions, subZoneConfig)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity relative z-20 cursor-pointer">
            {customActions.filter((a: any) => (a.contexts ? (Array.isArray(a.contexts) ? a.contexts : [a.contexts]) : [a.context]).includes('row')).map((action: any) => {
              const colors = getActionColorClasses(action.color)
              return (
                <button
                  key={action.id}
                  title={action.label}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onCustomAction?.(action, item) }}
                  className={cn("p-1 rounded-md transition-all", colors.text, colors.hover)}
                >
                  {action.icon ? <DynamicIcon icon={action.icon} className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                </button>
              )
            })}
            {onEdit && (
              <div
                className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-neutral-400 hover:text-blue-500 transition-all"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onEdit(item) }}
                title="Editar"
              >
                <Pencil className="w-3.5 h-3.5" />
              </div>
            )}
            {onDelete && (
              <div
                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-400 hover:text-red-500 transition-all"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDelete(item) }}
                title="Excluir"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </div>
            )}
            <div 
               className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800" 
               onPointerDown={(e) => e.stopPropagation()}
               onClick={(e) => {
                 e.stopPropagation()
                 onView?.(item)
               }}
            >
               <MoreVertical className="w-3.5 h-3.5 text-neutral-400" />
            </div>
          </div>
        </div>

        {/* Tags / Info */}
        <div className="flex flex-wrap gap-2">
          {otherFields.map((f: any) => {
            const fZoneConfig = f.config?.grid_config || f.config || {}
            return (
              <div key={f.id} className="flex items-center gap-1.5 px-2 py-1 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-100 dark:border-neutral-800">
                 <span 
                  style={{
                    fontFamily: fZoneConfig.label?.font,
                    fontSize: fZoneConfig.label?.size || '8px',
                    color: fZoneConfig.label?.color,
                  }}
                  className={cn(
                    "text-[8px] font-black uppercase tracking-tighter",
                    !fZoneConfig.label?.color && "text-neutral-400"
                  )}
                 >
                   {fZoneConfig.label?.text || f.display_name}:
                 </span>
                 <span 
                  style={{
                    fontFamily: fZoneConfig.content?.font,
                    fontSize: fZoneConfig.content?.size || '9px',
                    color: fZoneConfig.content?.color,
                  }}
                  className={cn(
                    "text-[9px] font-bold",
                    !fZoneConfig.content?.color && "text-neutral-600 dark:text-neutral-300"
                  )}
                 >
                   {formatFieldValue(getNestedValue(item, f.db_column_name), f, relationalOptions, fZoneConfig)}
                 </span>
              </div>
            )
          })}
        </div>

        {/* Footer info (Static mockup icons for premium look) */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-50 dark:border-neutral-800">
          <div className="flex -space-x-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border-2 border-white dark:border-neutral-900 flex items-center justify-center text-[8px] font-black text-white">AG</div>
            <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-800 border-2 border-white dark:border-neutral-900 flex items-center justify-center">
              <User className="w-3 h-3 text-neutral-400" />
            </div>
          </div>
          <div className="flex items-center gap-3 text-neutral-400">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span className="text-[9px] font-black uppercase tracking-tighter">May 12</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
