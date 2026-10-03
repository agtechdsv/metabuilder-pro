'use client'

import React from 'react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

/**
 * Lista reordenável por arrastar e soltar (alça) ou pelo teclado.
 * `ids` é a ordem atual; `onReorder(de, para)` recebe as posições (índices) de origem e destino.
 * Pode ser aninhada: cada lista tem o próprio contexto e só reordena os próprios itens.
 */
export function SortableList({ ids, onReorder, children }: {
  ids: string[]
  onReorder: (from: number, to: number) => void
  children: React.ReactNode
}) {
  const sensors = useSensors(
    // distância mínima: um clique simples na alça não inicia um arrasto sem querer
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from >= 0 && to >= 0) onReorder(from, to)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

/** Item de uma SortableList. O filho recebe a "alça" (botão de arrastar) para colocar onde quiser no cabeçalho. */
export function SortableItem({ id, children }: {
  id: string
  children: (handle: React.ReactNode) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing touch-none p-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 text-neutral-600 dark:text-neutral-300 hover:text-rose-600"
      title="Arrastar para reordenar"
      aria-label="Arrastar para reordenar"
    >
      <GripVertical className="w-4 h-4" />
    </button>
  )

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        position: 'relative',
        zIndex: isDragging ? 20 : undefined,
      }}
    >
      {children(handle)}
    </div>
  )
}
