import { useState } from 'react'

export function useStepLayoutWidgets(config: any, setConfig: any) {
  const [editingWidget, setEditingWidget] = useState<any>(null)
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false)
  const [editingSlotBIWidget, setEditingSlotBIWidget] = useState<{ slotIdx: number, widget: any } | null>(null)
  const [isSlotWidgetModalOpen, setIsSlotWidgetModalOpen] = useState(false)

  const handleAddWidget = () => {
    setEditingWidget({
      id: Math.random().toString(36).substr(2, 9),
      title: 'Novo Widget',
      type: 'kpi',
      model_id: config.selected_models[0] || '',
      field: '',
      calc: 'COUNT',
      group_by: '',
      width: 'third',
      joins: []
    })
    setIsWidgetModalOpen(true)
  }

  const handleSaveWidget = (updatedWidget: any) => {
    const currentWidgets = config.layout_config.analytics_config?.widgets || []
    const exists = currentWidgets.find((w: any) => w.id === updatedWidget.id)

    let newWidgets
    if (exists) {
      newWidgets = currentWidgets.map((w: any) => w.id === updatedWidget.id ? updatedWidget : w)
    } else {
      newWidgets = [...currentWidgets, updatedWidget]
    }

    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        analytics_config: { ...config.layout_config.analytics_config, widgets: newWidgets }
      }
    })
    setIsWidgetModalOpen(false)
    setEditingWidget(null)
  }

  const handleDeleteWidget = (id: string) => {
    const newWidgets = (config.layout_config.analytics_config?.widgets || []).filter((w: any) => w.id !== id)
    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        analytics_config: { ...config.layout_config.analytics_config, widgets: newWidgets }
      }
    })
  }

  return {
    editingWidget, setEditingWidget,
    isWidgetModalOpen, setIsWidgetModalOpen,
    editingSlotBIWidget, setEditingSlotBIWidget,
    isSlotWidgetModalOpen, setIsSlotWidgetModalOpen,
    handleAddWidget,
    handleSaveWidget,
    handleDeleteWidget
  }
}
