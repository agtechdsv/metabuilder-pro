import { useState } from 'react'
import {
  KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent, DragStartEvent
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'

export function useStepLayoutDnD(config: any, setConfig: any, models: any[]) {
  const { toast } = useToast()
  const { t } = useI18n()
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)

    // Arrastando da Ã¡rvore (FieldSourcePanel) para as zonas
    if (activeIdStr.startsWith('source-') || activeIdStr.startsWith('table-source-')) {
      const isTable = activeIdStr.startsWith('table-source-')
      const id = activeIdStr.replace(isTable ? 'table-source-' : 'source-', '')

      let targetZone: 'filter_fields' | 'grid_fields' | 'form_fields' | null = null
      if (overIdStr === 'droppable-filter' || overIdStr.startsWith('filter-')) targetZone = 'filter_fields'
      else if (overIdStr === 'droppable-grid' || overIdStr.startsWith('grid-')) targetZone = 'grid_fields'
      else if (overIdStr === 'droppable-form' || overIdStr.startsWith('form-') || overIdStr.startsWith('droppable-form-')) targetZone = 'form_fields'

      if (targetZone) {
        if (isTable) {
          const model = models.find((m: any) => m.id === id)
          if (!model) return

          // Filtra os campos que possuem permissÃ£o para entrar na zona correspondente
          const allowedFields = model.fields.filter((f: any) => {
            if (targetZone === 'grid_fields' && f.is_visible_in_list === false) return false
            if (targetZone === 'form_fields' && f.is_visible_in_form === false) return false
            if (targetZone === 'filter_fields' && f.is_searchable === false) return false
            return true
          })

          const fieldIdsToAdd = allowedFields.map((f: any) => f.id)
          const currentFields = [...config.layout_config[targetZone]]
          const newFields = [...currentFields]
          let addedCount = 0

          fieldIdsToAdd.forEach((fid: string) => {
            if (!newFields.includes(fid)) {
              if (targetZone === 'filter_fields' && (!config.has_arguments || config.logic_type === 'cadastro')) return
              if (targetZone === 'form_fields' && config.logic_type === 'pesquisa') return
              newFields.push(fid)
              addedCount++
            }
          })

          if (addedCount > 0) {
            setConfig({
              ...config,
              layout_config: {
                ...config.layout_config,
                [targetZone]: newFields
              }
            })
            toast(`${addedCount} campos permitidos da tabela "${model.display_name || model.db_table_name}" adicionados com sucesso!`, 'success')
          } else {
            toast('Nenhum novo campo permitido pÃ´de ser adicionado a esta zona.', 'info')
          }
        } else {
          const isVirtualTool = id === 'virtual_calc_tool'
          const fieldId = isVirtualTool ? `virt_${Math.random().toString(36).substring(2, 10)}` : id

          // Achar o campo no modelo para validar
          let fieldObj: any = null
          if (!isVirtualTool) {
            for (const m of models) {
              fieldObj = m.fields.find((f: any) => f.id === fieldId)
              if (fieldObj) break
            }

            if (fieldObj) {
              if (targetZone === 'grid_fields' && fieldObj.is_visible_in_list === false) {
                toast(`O campo "${fieldObj.display_name || fieldObj.db_column_name}" estÃ¡ configurado como nÃ£o visÃ­vel no grid.`, 'error')
                return
              }
              if (targetZone === 'form_fields' && fieldObj.is_visible_in_form === false) {
                toast(`O campo "${fieldObj.display_name || fieldObj.db_column_name}" estÃ¡ configurado como nÃ£o visÃ­vel no formulÃ¡rio.`, 'error')
                return
              }
              if (targetZone === 'filter_fields' && fieldObj.is_searchable === false) {
                toast(`O campo "${fieldObj.display_name || fieldObj.db_column_name}" estÃ¡ configurado como nÃ£o pesquisÃ¡vel (nÃ£o visÃ­vel no filtro).`, 'error')
                return
              }
            }
          }

          const currentFields = [...config.layout_config[targetZone]]
          if (!currentFields.includes(fieldId)) {
            if (targetZone === 'filter_fields' && (!config.has_arguments || config.logic_type === 'cadastro')) return
            if (targetZone === 'form_fields' && config.logic_type === 'pesquisa') return

            currentFields.push(fieldId)

            const newMetadata = { ...(config.layout_config.fields_metadata || {}) }
            if (isVirtualTool) {
              let assignedModelId = null
              if (targetZone === 'form_fields' && overIdStr.startsWith('droppable-form-')) {
                assignedModelId = overIdStr.replace('droppable-form-', '')
              } else if (targetZone === 'form_fields' && overIdStr.startsWith('form-')) {
                const droppedOnFieldId = overIdStr.replace('form-', '')
                for (const m of models) {
                  if (m.fields.some((f: any) => f.id === droppedOnFieldId)) {
                    assignedModelId = m.id
                    break
                  }
                }
                // Herda a zona caso tenha sido solto em cima de outro campo virtual
                if (!assignedModelId && droppedOnFieldId.startsWith('virt_')) {
                  assignedModelId = config.layout_config.fields_metadata?.[droppedOnFieldId]?.virtual_model_id || null
                }
              }

              newMetadata[fieldId] = {
                label: { text: 'Campo Calculado', show: true, position: 'top', width: 'auto' },
                content: { readonly: true, formula_tokens: [] },
                component: { type: 'virtual_calc', rel_table: '', rel_value: '', rel_label: '', fixed_options: '' },
                viacep: { enabled: false },
                virtual_model_id: assignedModelId
              }
            }

            setConfig({
              ...config,
              layout_config: {
                ...config.layout_config,
                [targetZone]: currentFields,
                fields_metadata: newMetadata
              }
            })
            toast(t('common.success', 'Campo adicionado com sucesso!'), 'success')
          } else {
            toast(t('common.info', 'Este campo jÃ¡ estÃ¡ nesta zona.'), 'info')
          }
        }
      }
      return
    }

    if (active.id === over.id) return

    // Arrastando Widgets de Analytics
    const isWidget = activeIdStr.startsWith('widget-')
    if (isWidget) {
      const activeId = activeIdStr.replace('widget-', '')
      const overId = overIdStr.replace('widget-', '')
      setConfig((prev: any) => {
        const widgets = [...(prev.layout_config.analytics_config?.widgets || [])]
        const oldIndex = widgets.findIndex(w => w.id === activeId)
        const newIndex = widgets.findIndex(w => w.id === overId)
        if (oldIndex === -1 || newIndex === -1) return prev
        return {
          ...prev,
          layout_config: {
            ...prev.layout_config,
            analytics_config: {
              ...prev.layout_config.analytics_config,
              widgets: arrayMove(widgets, oldIndex, newIndex)
            }
          }
        }
      })
      return
    }

    // Reordenando campos nas Zonas
    const isFilter = activeIdStr.startsWith('filter-')
    const isGrid = activeIdStr.startsWith('grid-')
    const isForm = activeIdStr.startsWith('form-')

    const listKey = isFilter ? 'filter_fields' : isGrid ? 'grid_fields' : 'form_fields'

    const draggedId = activeIdStr.replace(/^(filter-|grid-|form-)/, '')
    const targetId = overIdStr.replace(/^(filter-|grid-|form-)/, '')

    setConfig((prev: any) => {
      const list = [...prev.layout_config[listKey as keyof typeof prev.layout_config] as string[]]
      const oldIndex = list.indexOf(draggedId)
      const newIndex = list.indexOf(targetId)
      if (oldIndex === -1 || newIndex === -1) return prev
      return {
        ...prev,
        layout_config: {
          ...prev.layout_config,
          [listKey]: arrayMove(list, oldIndex, newIndex)
        }
      }
    })
  }

  return {
    sensors,
    activeId,
    setActiveId,
    handleDragStart,
    handleDragEnd
  }
}
