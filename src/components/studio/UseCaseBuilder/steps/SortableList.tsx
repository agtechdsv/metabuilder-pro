'use client'

import React from 'react'
import {
  DndContext, DragOverlay, closestCenter, pointerWithin, PointerSensor, KeyboardSensor,
  useSensor, useSensors, useDroppable,
  type CollisionDetection, type DragEndEvent, type DragStartEvent, type DragCancelEvent
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Arrastar e soltar do editor de abas/blocos do Personalizado.
 *
 * UM único contexto (SlotDndProvider) cobre tudo, para permitir soltar entre listas diferentes
 * (de um bloco para outro, de aba de primeiro nível para dentro de um bloco e vice-versa).
 * Cada lista reordenável é um SortableContainer; cada item, um SortableItem; blocos aceitam soltar via DropZone.
 * Os ids levam prefixo do tipo (slot:, block:, child:, zone:) e quem usa decide o que cada soltura significa.
 */

// Colisão: primeiro o que contém o ponteiro, do MENOR para o maior (o mais "interno" ganha);
// só se o ponteiro não estiver sobre nada, o mais próximo do centro.
const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  if (within.length > 0) {
    const area = (id: string | number) => {
      const r = args.droppableRects.get(id)
      return r ? r.width * r.height : Number.POSITIVE_INFINITY
    }
    return [...within].sort((a, b) => area(a.id) - area(b.id))
  }
  return closestCenter(args)
}

export function SlotDndProvider({ children, onDragStart, onDragEnd, onDragCancel, overlay }: {
  children: React.ReactNode
  onDragStart?: (event: DragStartEvent) => void
  onDragEnd: (event: DragEndEvent) => void
  onDragCancel?: (event: DragCancelEvent) => void
  overlay?: React.ReactNode
}) {
  const sensors = useSensors(
    // distância mínima: um clique simples na alça não inicia um arrasto sem querer
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {children}
      <DragOverlay dropAnimation={null}>{overlay}</DragOverlay>
    </DndContext>
  )
}

/** Lista reordenável (a ordem visual dos itens dentro dela). `ids` na ordem atual. */
export function SortableContainer({ ids, children }: { ids: string[]; children: React.ReactNode }) {
  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  )
}

/** Área que aceita soltar (ex.: um bloco, mesmo vazio). `activeClassName` é aplicado enquanto algo está sobre ela. */
export function DropZone({ id, className, activeClassName, children }: {
  id: string
  className?: string
  activeClassName?: string
  children?: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={cn(className, isOver && activeClassName)}>
      {children}
    </div>
  )
}

/** Item de uma SortableContainer. O filho recebe a "alça" (botão de arrastar) para colocar onde quiser no cabeçalho. */
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
      title="Arrastar para reordenar ou mover"
      aria-label="Arrastar para reordenar ou mover"
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
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
      }}
    >
      {children(handle)}
    </div>
  )
}
