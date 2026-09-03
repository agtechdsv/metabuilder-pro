export function generateKanbanBoardComponent(files: Map<string, string>) {
  files.set('components/KanbanBoard.tsx', generateKanbanBoardCode())
}

function generateKanbanBoardCode(): string {
  return `'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  rectIntersection,
  CollisionDetection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MoreVertical,
  Calendar,
  User,
  Plus,
  Minimize2,
  Maximize2,
  ZoomIn,
  LayoutGrid,
  Pencil,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DeleteButton } from '@/components/ui/delete-button'

export interface KanbanField {
  id?: string
  dbColumn: string
  label: string
  dataType?: string
  config?: any
}

export interface KanbanBoardProps {
  data: any[]
  fields: KanbanField[]
  groupColumn: string
  groupDisplayField?: string
  cardFields?: string[]
  primaryKey?: string
  basePath?: string
  dictionary?: Record<string, string>
  relationalOptions?: Record<string, Array<{ value: string; label: string }>>
  onMove: (recordId: string, newValue: any) => Promise<void> | void
  onDelete?: (recordId: string) => Promise<void> | void
}

function formatKanbanValue(v: any, f?: KanbanField): string {
  if (v === null || v === undefined || v === '') return '-'
  if (typeof v === 'number') {
    const colName = (f?.dbColumn || '').toLowerCase()
    const label = (f?.label || '').toLowerCase()
    const isCurrency = colName.includes('preco') || colName.includes('valor') || colName.includes('total') || label.includes('r$') || label.includes('preço') || label.includes('valor')
    if (isCurrency) {
      return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }
    return v.toLocaleString('pt-BR')
  }
  if (typeof v === 'string') {
    if (/^\\d{4}-\\d{2}-\\d{2}(T.*)?$/.test(v)) {
      const parts = v.split('T')[0].split('-')
      if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0]
    }
  }
  return String(v)
}

function resolveDisplayLabel(val: any, field?: KanbanField, relationalOptions?: Record<string, Array<{ value: string; label: string }>>): string {
  if (val === null || val === undefined || val === '') return '-'
  const strVal = String(val)
  if (field && relationalOptions) {
    const opts = relationalOptions[field.dbColumn] || (field.id ? relationalOptions[field.id] : undefined) || field.config?.options
    if (opts && Array.isArray(opts)) {
      const found = opts.find((o: any) => String(o.value) === strVal || String(o.id) === strVal)
      if (found) return found.label || found.name || strVal
    }
  }
  return formatKanbanValue(val, field)
}

export function KanbanBoard({
  data,
  fields,
  groupColumn,
  groupDisplayField,
  cardFields,
  primaryKey = 'id',
  basePath = '',
  dictionary = {},
  relationalOptions = {},
  onMove,
  onDelete,
}: KanbanBoardProps) {
  const [localData, setLocalData] = useState<any[]>(data)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [scale, setScale] = useState(1.0)

  useEffect(() => {
    setLocalData(data)
  }, [data])

  const scales = [
    { value: 0.8, icon: <Minimize2 className="w-3.5 h-3.5" />, label: 'Pequeno' },
    { value: 1.0, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: 'Normal' },
    { value: 1.2, icon: <Maximize2 className="w-3.5 h-3.5" />, label: 'Grande' },
    { value: 1.5, icon: <ZoomIn className="w-3.5 h-3.5" />, label: 'Extra Grande' }
  ]

  const groupFieldDef = useMemo(() => {
    return fields.find(f => f.dbColumn === groupColumn)
  }, [fields, groupColumn])

  const configuredOptions = useMemo(() => {
    const opts = relationalOptions[groupColumn] || groupFieldDef?.config?.options
    if (Array.isArray(opts) && opts.length > 0) {
      return opts.map((o: any) => typeof o === 'string' ? o : o.value || o.label)
    }
    return []
  }, [groupFieldDef, relationalOptions, groupColumn])

  const columns = useMemo(() => {
    const valuesFromData = localData.map(item => String(item[groupColumn] ?? 'Unassigned'))
    const set = new Set<string>([...configuredOptions, ...valuesFromData])
    const arr = Array.from(set).filter(Boolean)
    if (arr.length === 0) return ['Unassigned']
    return arr
  }, [localData, groupColumn, configuredOptions])

  const displayFieldsForCards = useMemo(() => {
    let filtered = fields.filter(f => f.dbColumn !== groupColumn && f.dbColumn !== groupDisplayField)
    if (cardFields && cardFields.length > 0) {
      filtered = filtered.filter(f => cardFields.includes(f.dbColumn) || cardFields.includes(f.id || ''))
    }
    return filtered.length > 0 ? filtered : fields
  }, [fields, groupColumn, groupDisplayField, cardFields])

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

  // Estratégia de detecção de colisão robusta:
  // 1. Onde o ponteiro do mouse está apontando diretamente (evita falso positivo com a coluna adjacente)
  // 2. Interseção retangular direta
  // 3. Cantos mais próximos como fallback
  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) {
      return pointerCollisions
    }
    const rectCollisions = rectIntersection(args)
    if (rectCollisions.length > 0) {
      return rectCollisions
    }
    return closestCorners(args)
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) {
      setActiveId(null)
      return
    }

    const activeRecordId = String(active.id)
    const overId = String(over.id)

    let newStatus = overId
    if (!columns.includes(overId)) {
      const overRecord = localData.find(item => String(item[primaryKey] || item.id) === overId)
      if (overRecord) {
        newStatus = String(overRecord[groupColumn] ?? 'Unassigned')
      }
    }

    const activeRecord = localData.find(item => String(item[primaryKey] || item.id) === activeRecordId)
    if (activeRecord && String(activeRecord[groupColumn] ?? 'Unassigned') !== newStatus) {
      setLocalData(prev =>
        prev.map(item =>
          String(item[primaryKey] || item.id) === activeRecordId
            ? { ...item, [groupColumn]: newStatus }
            : item
        )
      )
      await onMove(activeRecordId, newStatus)
    }

    setActiveId(null)
  }

  const activeItem = useMemo(() => {
    if (!activeId) return null
    return localData.find(item => String(item[primaryKey] || item.id) === activeId) || null
  }, [activeId, localData, primaryKey])

  return (
    <div className="flex flex-col h-full w-full">
      {/* Controles de Escala / Zoom */}
      <div className="flex justify-end mb-4 px-4 w-full">
        <div className="flex items-center bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800">
          {scales.map(s => (
            <button
              key={s.value}
              onClick={() => setScale(s.value)}
              title={s.label}
              type="button"
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

      {/* Grid de Colunas com Drag and Drop */}
      <div
        className="flex gap-6 overflow-x-auto overflow-y-hidden pb-6 h-[calc(100vh-240px)] min-h-[500px] custom-scrollbar px-4 -mx-4"
        style={{ zoom: scale }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {columns.map(column => {
            let displayTitle = dictionary[column] || column
            if (groupDisplayField) {
              const sample = localData.find(item => String(item[groupColumn]) === column)
              if (sample && sample[groupDisplayField]) {
                displayTitle = sample[groupDisplayField]
              }
            }

            const columnItems = localData.filter(
              item => String(item[groupColumn] ?? 'Unassigned') === column
            )

            return (
              <BoardColumn
                key={column}
                id={column}
                title={displayTitle}
                items={columnItems}
                fields={displayFieldsForCards}
                primaryKey={primaryKey}
                basePath={basePath}
                groupColumn={groupColumn}
                relationalOptions={relationalOptions}
                onDelete={onDelete}
              />
            )
          })}

          <DragOverlay>
            {activeItem ? (
              <BoardCard
                id={String(activeItem[primaryKey] || activeItem.id)}
                item={activeItem}
                fields={displayFieldsForCards}
                primaryKey={primaryKey}
                basePath={basePath}
                relationalOptions={relationalOptions}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}

function BoardColumn({
  id,
  title,
  items,
  fields,
  primaryKey,
  basePath,
  groupColumn,
  relationalOptions,
  onDelete,
}: {
  id: string
  title: string
  items: any[]
  fields: KanbanField[]
  primaryKey: string
  basePath: string
  groupColumn: string
  relationalOptions?: Record<string, Array<{ value: string; label: string }>>
  onDelete?: (id: string) => Promise<void> | void
}) {
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id })
  const itemIds = useMemo(() => {
    return items.map(item => String(item[primaryKey] || item.id))
  }, [items, primaryKey])

  return (
    <div
      ref={setDroppableRef}
      className={cn(
        "flex-shrink-0 w-80 flex flex-col bg-neutral-50/50 dark:bg-neutral-900/30 border border-neutral-200/50 dark:border-neutral-800/50 rounded-[2rem] overflow-hidden h-full transition-colors",
        isOver && "ring-2 ring-indigo-500/50 bg-indigo-50/20 dark:bg-indigo-950/20"
      )}
    >
      {/* Cabeçalho da Coluna */}
      <div className="flex items-center justify-between px-5 py-4 sticky top-0 bg-white dark:bg-[#0a0a0a] z-30 border-b border-neutral-200 dark:border-neutral-800 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-600 dark:text-neutral-300 truncate max-w-[160px]">
            {title}
          </h3>
          <span className="ml-2 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-md text-[10px] font-black text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
            {items.length}
          </span>
        </div>
        {basePath ? (
          <Link
            href={basePath + '/new?' + groupColumn + '=' + encodeURIComponent(id)}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 transition-all active:scale-90"
            title="Novo registro nesta coluna"
          >
            <Plus className="w-3.5 h-3.5" />
          </Link>
        ) : null}
      </div>

      {/* Zona de Drop com rolagem independente */}
      <SortableContext id={id} items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 min-h-0">
          <AnimatePresence>
            {items.map(item => {
              const itemId = String(item[primaryKey] || item.id)
              return (
                <BoardCard
                  key={itemId}
                  id={itemId}
                  item={item}
                  fields={fields}
                  primaryKey={primaryKey}
                  basePath={basePath}
                  relationalOptions={relationalOptions}
                  onDelete={onDelete}
                />
              )
            })}
          </AnimatePresence>

          {items.length === 0 && (
            <div className="h-24 flex-shrink-0 flex items-center justify-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Coluna Vazia
              </p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

function BoardCard({
  id,
  item,
  fields,
  primaryKey,
  basePath,
  relationalOptions,
  isOverlay = false,
  onDelete,
}: {
  id: string
  item: any
  fields: KanbanField[]
  primaryKey: string
  basePath: string
  relationalOptions?: Record<string, Array<{ value: string; label: string }>>
  isOverlay?: boolean
  onDelete?: (id: string) => Promise<void> | void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  const mainField = fields[0]
  const subField = fields[1]
  const otherFields = fields.slice(2, 5)

  const detailUrl = basePath ? (basePath + '/' + id) : '#'
  const recordTitle = mainField 
    ? resolveDisplayLabel(item[mainField.dbColumn], mainField, relationalOptions) 
    : (item.nome || item.name || item.titulo || item[primaryKey] || 'este registro')

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
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
        {/* Cabeçalho do Card */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-0.5">
            <h4
              className="font-bold text-neutral-900 dark:text-white leading-tight"
            >
              {recordTitle}
            </h4>
            {subField && (
              <span className="text-[10px] font-medium text-neutral-400 truncate max-w-[180px]">
                {resolveDisplayLabel(item[subField.dbColumn], subField, relationalOptions)}
              </span>
            )}
          </div>

          {/* Botões de Ação no Card ao passar o mouse */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity relative z-20">
            {basePath ? (
              <Link
                href={detailUrl}
                onPointerDown={e => e.stopPropagation()}
                className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-neutral-400 hover:text-blue-500 transition-all"
                title="Editar"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Link>
            ) : null}
            {onDelete ? (
              <div
                onPointerDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
              >
                <DeleteButton
                  recordName={recordTitle}
                  onDelete={async () => {
                    await onDelete(id)
                  }}
                />
              </div>
            ) : null}
            <Link
              href={detailUrl}
              onPointerDown={e => e.stopPropagation()}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 transition-all"
              title="Detalhes"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Tags / Campos adicionais */}
        {otherFields.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {otherFields.map(f => (
              <div
                key={f.dbColumn}
                className="flex items-center gap-1.5 px-2 py-1 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-100 dark:border-neutral-800"
              >
                <span className="text-[8px] font-black uppercase tracking-tighter text-neutral-400">
                  {f.label}:
                </span>
                <span className="text-[9px] font-bold text-neutral-600 dark:text-neutral-300 truncate max-w-[120px]">
                  {resolveDisplayLabel(item[f.dbColumn], f, relationalOptions)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Rodapé decorativo com mockup fiel ao Studio */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-50 dark:border-neutral-800">
          <div className="flex -space-x-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border-2 border-white dark:border-neutral-900 flex items-center justify-center text-[8px] font-black text-white">
              AG
            </div>
            <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-800 border-2 border-white dark:border-neutral-900 flex items-center justify-center">
              <User className="w-3 h-3 text-neutral-400" />
            </div>
          </div>
          <div className="flex items-center gap-3 text-neutral-400">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span className="text-[9px] font-black uppercase tracking-tighter">
                {new Date().toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
export default KanbanBoard
`
}
