import { useState } from 'react'

export function useCustomActionsState(config: any, setConfig: any) {
  const [isActionModalOpen, setIsActionModalOpen] = useState(false)
  const [editingAction, setEditingAction] = useState<any>(null)
  const [editingActionIndex, setEditingActionIndex] = useState<number | null>(null)
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false)
  const [activeModalTab, setActiveModalTab] = useState<'general' | 'trigger' | 'appearance' | 'bpm'>('general')

  const handleSaveAction = (actionToSave: any) => {
    // Generate backwards compatibility flat arrays
    const action = { ...actionToSave };
    if (action.placements && Array.isArray(action.placements)) {
      const flatContexts = new Set<string>();
      const flatGroupFields = new Set<string>();
      
      action.placements.forEach((p: any) => {
        p.contexts?.forEach((c: string) => {
          if (p.location === 'search') {
            flatContexts.add(c);
          } else if (p.location === 'master') {
            if (c === 'global_top') flatContexts.add('master_top');
            else if (c === 'field_group') flatContexts.add('field_group');
            else flatContexts.add(c);
          } else if (p.location.startsWith('detail:')) {
            if (c === 'global_top') flatContexts.add('detail_top');
            else if (c === 'row') flatContexts.add('detail_row');
            else if (c === 'field_group') flatContexts.add('field_group');
            else flatContexts.add(c);
          } else if (p.location.startsWith('slot:')) {
            flatContexts.add(c);
          }
        });
        
        p.group_fields?.forEach((f: string) => {
          if (p.location === 'master') flatGroupFields.add(`master:\${f}`);
          else if (p.location.startsWith('detail:')) flatGroupFields.add(`detail:\${f}`);
          else flatGroupFields.add(f);
        });
      });
      
      action.contexts = Array.from(flatContexts);
      action.group_fields = Array.from(flatGroupFields);
      if (action.contexts.length > 0) action.context = action.contexts[0];
      if (action.group_fields.length > 0) action.group_field = action.group_fields[0];
    }

    const currentActions = config.layout_config.custom_actions || []
    const isNew = !currentActions.some((a: any) => a.id === action.id)
    const newActions = isNew
      ? [...currentActions, { ...action, id: action.id || Math.random().toString(36).substr(2, 9) }]
      : currentActions.map((a: any) => a.id === action.id ? action : a)

    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        custom_actions: newActions
      }
    })
    setIsActionModalOpen(false)
    setEditingAction(null)
  }

  const handleDeleteAction = (id: string) => {
    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        custom_actions: (config.layout_config.custom_actions || []).filter((a: any) => a.id !== id)
      }
    })
  }

  return {
    isActionModalOpen, setIsActionModalOpen,
    editingAction, setEditingAction,
    editingActionIndex, setEditingActionIndex,
    isIconPickerOpen, setIsIconPickerOpen,
    activeModalTab, setActiveModalTab,
    handleSaveAction,
    handleDeleteAction
  }
}
