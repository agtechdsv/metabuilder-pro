'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  MeasuringStrategy,
  useDroppable
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import {
  Plus,
  Trash2,
  GripVertical,
  FolderPlus,
  Link as LinkIcon,
  ChevronDown,
  ChevronRight,
  Save,
  Loader2,
  Layers,
  Layout
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { IconPicker } from './IconPicker'
import { DynamicIcon } from '@/components/runtime/DynamicIcon'

interface MenuItem {
  id: string
  label: string
  description?: string
  icon: string
  type: 'view' | 'link' | 'folder'
  target: string
  show_dashboard?: boolean
  children?: MenuItem[]
}

interface MenuBuilderProps {
  project: any
  views: any[]
  isDownloadsActive?: boolean
  onSave: (menu: MenuItem[]) => Promise<void>
}

// Helpers estruturais para gerenciar a árvore de navegação e DND aninhado
const findItem = (items: MenuItem[], id: string): MenuItem | null => {
  for (const item of items) {
    if (item.id === id) return item
    if (item.children) {
      const found = findItem(item.children, id)
      if (found) return found
    }
  }
  return null
}

const findParent = (items: MenuItem[], id: string, currentParent: string = 'root'): string | null => {
  for (const item of items) {
    if (item.id === id) return currentParent
    if (item.children) {
      const found = findParent(item.children, id, item.id)
      if (found) return found
    }
  }
  return null
}

const removeItem = (items: MenuItem[], id: string): MenuItem[] => {
  return items.filter(item => item.id !== id).map(item => ({
    ...item,
    children: item.children ? removeItem(item.children, id) : undefined
  }))
}

const insertItem = (items: MenuItem[], containerId: string, itemToInsert: MenuItem, index: number): MenuItem[] => {
  if (containerId === 'root') {
    const newItems = [...items]
    newItems.splice(index, 0, itemToInsert)
    return newItems
  }
  return items.map(item => {
    if (item.id === containerId) {
      const newChildren = [...(item.children || [])]
      newChildren.splice(index, 0, itemToInsert)
      return { ...item, children: newChildren }
    }
    if (item.children) {
      return { ...item, children: insertItem(item.children, containerId, itemToInsert, index) }
    }
    return item
  })
}

export function MenuBuilder({ project, views, isDownloadsActive = true, onSave }: MenuBuilderProps) {
  const { t } = useI18n()
  const [menu, setMenu] = useState<MenuItem[]>(project.navigation || [])
  const [isSaving, setIsSaving] = useState(false)
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)

  // Auto-gerenciar link da Central de Downloads
  useEffect(() => {
    const checkExists = (items: MenuItem[]): boolean => items.some(item => item.target === 'downloads' || (item.children && checkExists(item.children)));
    const removeDownloads = (items: MenuItem[]): MenuItem[] => items.filter(item => item.target !== 'downloads').map(item => ({
      ...item,
      children: item.children ? removeDownloads(item.children) : undefined
    }));

    setMenu(currentMenu => {
      let newMenu = [...currentMenu];
      let changed = false;

      if (isDownloadsActive) {
        if (!checkExists(newMenu)) {
          newMenu.push({
            id: 'downloads_auto_' + Math.random().toString(36).substr(2, 9),
            label: 'Central de Downloads',
            description: '',
            icon: 'Layout',
            type: 'view',
            target: 'downloads',
            show_dashboard: true,
          });
          changed = true;
        }
      } else {
        const removed = removeDownloads(newMenu);
        // Compare lengths to see if something was removed
        if (JSON.stringify(removed) !== JSON.stringify(newMenu)) {
          newMenu = removed;
          changed = true;
        }
      }

      if (changed) {
        setTimeout(() => onSave(newMenu).catch(console.error), 0);
        return newMenu;
      }
      return currentMenu;
    });
  }, [isDownloadsActive]);

  // DND State
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeItem = useMemo(() => activeId ? findItem(menu, activeId) : null, [activeId, menu])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // evita acionar drag em cliques normais
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    const overId = over?.id

    if (!overId || active.id === overId) return

    // Previne arrastar uma pasta inteira para dentro dela mesma ou de outra (só permitimos 1 nível)
    const activeItemData = findItem(menu, active.id as string)
    if (activeItemData?.type === 'folder') return // Pastas só se movem na raiz (onDragEnd)

    const activeContainer = findParent(menu, active.id as string)

    // Identifica o container de destino
    let overContainer = findParent(menu, overId as string)
    const overItemData = findItem(menu, overId as string)
    if (overItemData?.type === 'folder') {
      overContainer = overItemData.id
    } else if (String(overId).startsWith('empty-folder-')) {
      overContainer = String(overId).replace('empty-folder-', '')
    }

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return
    }

    setMenu((prev) => {
      const activeItem = findItem(prev, active.id as string)
      if (!activeItem) return prev

      const itemsWithoutActive = removeItem(prev, active.id as string)

      const overContainerItems = overContainer === 'root'
        ? itemsWithoutActive
        : findItem(itemsWithoutActive, overContainer)?.children || []

      const overIndex = overContainerItems.findIndex(i => i.id === overId)

      let newIndex
      if (overIndex >= 0) {
        newIndex = overIndex
      } else {
        newIndex = overContainerItems.length + 1
      }

      return insertItem(itemsWithoutActive, overContainer, activeItem, newIndex)
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId === overId) return

    const activeContainer = findParent(menu, activeId)

    let overContainer = findParent(menu, overId)
    const overItemData = findItem(menu, overId)
    if (overItemData?.type === 'folder') {
      overContainer = overItemData.id
    } else if (String(overId).startsWith('empty-folder-')) {
      overContainer = String(overId).replace('empty-folder-', '')
    }

    if (activeContainer && overContainer && activeContainer === overContainer) {
      setMenu((prev) => {
        const containerItems = activeContainer === 'root'
          ? prev
          : findItem(prev, activeContainer)?.children || []

        const oldIndex = containerItems.findIndex(i => i.id === activeId)
        let newIndex = containerItems.findIndex(i => i.id === overId)

        if (newIndex === -1) {
          newIndex = oldIndex
        }

        if (oldIndex !== newIndex) {
          const reorderedItems = arrayMove(containerItems, oldIndex, newIndex)

          if (activeContainer === 'root') {
            return reorderedItems
          } else {
            const updateFolder = (items: MenuItem[]): MenuItem[] => items.map(item => {
              if (item.id === activeContainer) return { ...item, children: reorderedItems }
              if (item.children) return { ...item, children: updateFolder(item.children) }
              return item
            })
            return updateFolder(prev)
          }
        }
        return prev
      })
    }
  }

  const handleAddItem = (parentId: string | null = null, type: 'view' | 'link' | 'folder' = 'view') => {
    const newId = Math.random().toString(36).substr(2, 9)
    const newItem: MenuItem = {
      id: newId,
      label: '',
      description: '',
      icon: type === 'folder' ? 'Layers' : 'Layout',
      type,
      target: '',
      show_dashboard: true,
      children: type === 'folder' ? [] : undefined
    }

    setLastAddedId(newId)

    if (!parentId) {
      setMenu([...menu, newItem])
    } else {
      const updateChildren = (items: MenuItem[]): MenuItem[] => {
        return items.map(item => {
          if (item.id === parentId) {
            return { ...item, children: [...(item.children || []), newItem] }
          }
          if (item.children) {
            return { ...item, children: updateChildren(item.children) }
          }
          return item
        })
      }
      setMenu(updateChildren(menu))
    }
  }

  const handleRemoveItem = (id: string) => {
    setMenu(removeItem(menu, id))
  }

  const handleUpdateItem = (id: string, updates: Partial<MenuItem>) => {
    const updateItemsDeep = (items: MenuItem[]): MenuItem[] => {
      return items.map(item => {
        if (item.id === id) {
          return { ...item, ...updates }
        }
        if (item.children) {
          return { ...item, children: updateItemsDeep(item.children) }
        }
        return item
      })
    }
    setMenu(updateItemsDeep(menu))
  }

  const handleSaveData = async () => {
    setIsSaving(true)
    try {
      await onSave(menu)
    } finally {
      setIsSaving(false)
    }
  }

  const rootItemsIds = menu.map(item => item.id)

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] overflow-hidden shadow-sm">
      <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-neutral-900 dark:text-white">Gerador de Menu de Navegação</h3>
          <p className="text-[10px] text-neutral-400 font-medium mt-1 uppercase tracking-widest">Organize como seus usuários navegarão no App</p>
        </div>
        <button
          onClick={handleSaveData}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Salvar Estrutura
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        >
          <div className="space-y-3 min-h-[50px]">
            <SortableContext items={rootItemsIds} strategy={verticalListSortingStrategy}>
              {menu.map((item) => (
                <SortableMenuNode
                  key={item.id}
                  item={item}
                  views={views}
                  isDownloadsActive={isDownloadsActive}
                  onUpdate={handleUpdateItem}
                  onRemove={handleRemoveItem}
                  onAddChild={handleAddItem}
                  lastAddedId={lastAddedId}
                />
              ))}
            </SortableContext>

            {menu.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-neutral-100 dark:border-neutral-800 rounded-[2rem] text-neutral-300">
                <Layout className="w-12 h-12 opacity-10 mb-4" />
                <p className="text-xs font-black uppercase tracking-widest">Nenhum item no menu</p>
              </div>
            )}
          </div>

          <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
            {activeItem ? (
              <MenuNodeBase
                item={activeItem}
                views={views}
                isDownloadsActive={isDownloadsActive}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>

        <div className="pt-6 flex gap-3">
          <button
            onClick={() => handleAddItem(null, 'view')}
            className="flex-1 flex items-center justify-center gap-2 py-4 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:border-indigo-500 hover:text-indigo-600 transition-all group"
          >
            <LinkIcon className="w-4 h-4 group-hover:scale-110 transition-transform" /> Adicionar Link
          </button>
          <button
            onClick={() => handleAddItem(null, 'folder')}
            className="flex-1 flex items-center justify-center gap-2 py-4 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:border-emerald-500 hover:text-emerald-600 transition-all group"
          >
            <FolderPlus className="w-4 h-4 group-hover:scale-110 transition-transform" /> Criar Menu
          </button>
        </div>
      </div>
    </div>
  )
}

function SortableMenuNode(props: any) {
  const { item } = props
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data: { type: item.type } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <MenuNodeBase {...props} dragListeners={listeners} dragAttributes={attributes} />
    </div>
  )
}

// O MenuNodeBase contém a UI do item. Ele é separado para poder ser usado pelo SortableMenuNode e pelo DragOverlay.
function MenuNodeBase({ item, views, isDownloadsActive = true, onUpdate, onRemove, onAddChild, lastAddedId, dragListeners, dragAttributes, isOverlay }: any) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (lastAddedId === item.id && inputRef.current) {
      inputRef.current.focus()
    }
  }, [lastAddedId, item.id])

  const childrenIds = item.children?.map((c: any) => c.id) || []

  return (
    <div className={cn("space-y-2", isOverlay && "opacity-90 scale-105 shadow-2xl")}>
      <div className={cn(
        "group flex items-center gap-4 p-4 rounded-2xl border transition-all relative",
        item.type === 'folder'
          ? "bg-emerald-500/5 border-emerald-500/10 dark:bg-emerald-500/10 dark:border-emerald-500/20"
          : "bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800"
      )}>
        <div
          className="p-1 -ml-1 text-neutral-300 hover:text-indigo-500 cursor-grab active:cursor-grabbing shrink-0"
          {...dragAttributes}
          {...dragListeners}
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onUpdate && setShowIconPicker(true)}
            disabled={isOverlay}
            className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group/icon disabled:opacity-50"
            title="Alterar Ícone"
          >
            <DynamicIcon icon={item.icon} size={16} className="group-hover/icon:scale-110 transition-transform" />
          </button>
        </div>

        {showIconPicker && onUpdate && (
          <IconPicker
            currentIcon={item.icon}
            onSelect={(icon) => onUpdate(item.id, { icon })}
            onClose={() => setShowIconPicker(false)}
          />
        )}

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="flex flex-col gap-1">
            <input
              ref={inputRef}
              value={item.label}
              onChange={e => onUpdate?.(item.id, { label: e.target.value })}
              readOnly={isOverlay}
              placeholder={item.type === 'folder' ? 'Nome do Menu...' : 'Nome do Link...'}
              className="bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-sm font-bold text-neutral-900 dark:text-white"
            />
            <input
              value={item.description || ''}
              onChange={e => onUpdate?.(item.id, { description: e.target.value })}
              readOnly={isOverlay}
              placeholder="Descrição curta..."
              className="bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-[9px] font-medium text-neutral-400"
            />
          </div>

          {item.type === 'view' && (
            <select
              value={item.target}
              onChange={e => {
                if (!onUpdate) return
                const selectedSlug = e.target.value
                const selectedView = views.find((v: any) => v.slug === selectedSlug)
                const updates: any = { target: selectedSlug }

                if (!item.label) {
                  if (selectedSlug === 'downloads') updates.label = 'Central de Downloads'
                  else if (selectedView) updates.label = selectedView.name
                }
                onUpdate(item.id, updates)
              }}
              disabled={isOverlay}
              className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-1.5 text-xs font-bold outline-none disabled:opacity-50"
            >
              <option value="">Selecionar Caso de Uso...</option>
              {isDownloadsActive !== false && (
                <option value="downloads">📁 Central de Downloads (Utilitário)</option>
              )}
              {views.map((v: any) => (
                <option key={v.id} value={v.slug}>{v.name}</option>
              ))}
            </select>
          )}

          {item.type === 'link' && (
            <input
              value={item.target}
              onChange={e => onUpdate?.(item.id, { target: e.target.value })}
              readOnly={isOverlay}
              placeholder="https://..."
              className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
            />
          )}

          <div className="flex items-center gap-2 justify-end relative">
            {item.type === 'folder' && onAddChild && (
              <div className="relative">
                <button
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  disabled={isOverlay}
                  className={cn(
                    "p-2 rounded-xl transition-all flex items-center gap-1",
                    showAddMenu ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-neutral-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                  )}
                  title="Adicionar..."
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest pr-1">Adicionar</span>
                </button>

                {showAddMenu && (
                  <div className="absolute top-full right-0 mt-2 w-32 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl z-[100] p-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={() => {
                        onAddChild(item.id, 'view')
                        setShowAddMenu(false)
                        setIsExpanded(true)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-left transition-colors"
                    >
                      <LinkIcon className="w-3 h-3 text-indigo-500" />
                      <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300">Link/View</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <input
                type="checkbox"
                checked={item.show_dashboard !== false}
                onChange={e => onUpdate?.(item.id, { show_dashboard: e.target.checked })}
                disabled={isOverlay}
                className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer disabled:opacity-50"
                id={`dash-${item.id}`}
              />
              <label htmlFor={`dash-${item.id}`} className="text-[9px] font-black tracking-widest text-neutral-400 cursor-pointer select-none">Disponibilizar DashBoard</label>
            </div>

            {onRemove && (
              <button
                onClick={() => onRemove(item.id)}
                disabled={isOverlay}
                className="p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {item.type === 'folder' && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                disabled={isOverlay}
                className="p-2 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {item.type === 'folder' && isExpanded && !isOverlay && (
        <div className="ml-10 border-l-2 border-neutral-100 dark:border-neutral-800 pl-4 space-y-2 min-h-[40px] py-2">
          <SortableContext items={childrenIds} strategy={verticalListSortingStrategy}>
            {item.children?.map((child: any) => (
              <SortableMenuNode
                key={child.id}
                item={child}
                views={views}
                onUpdate={onUpdate}
                onRemove={onRemove}
                onAddChild={onAddChild}
                lastAddedId={lastAddedId}
              />
            ))}
          </SortableContext>
          {(!item.children || item.children.length === 0) && (
            <DroppableEmptyFolder id={item.id} />
          )}
        </div>
      )}
    </div>
  )
}

function DroppableEmptyFolder({ id }: { id: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `empty-folder-${id}`
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "py-6 border-2 border-dashed rounded-2xl flex items-center justify-center transition-all",
        isOver ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-neutral-100 dark:border-neutral-800"
      )}
    >
      <p className="text-[10px] text-neutral-400 italic font-bold">Arraste itens para dentro deste menu</p>
    </div>
  )
}
